"""
Core Engine Adapter.

Purpose: give the FastAPI backend ONE clean interface to the Core Engine,
so the backend never needs to know about:
  - scoring.py internals (NDVI thresholds, EXIF penalty logic)
  - imagery.py internals (Sentinel/Copernicus provider details)
  - Solidity contract internals (custom errors, role names, enums)
  - Hardhat/manage-blue-carbon.ts script internals

This file WRAPS existing behavior. It does not change scoring thresholds,
confidence bands, or contract logic. See CORE_ENGINE_INTERFACE.md for the
documented as-is behavior this wraps.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from .imagery import ImageryProvider, ImageryUnavailableError, SentinelHubNdviProvider
from .models import ScoreSubmissionRequest, ScoreSubmissionResponse
from .scoring import score_submission
from .settings import SentinelHubConfigurationError, Settings

REPO_ROOT = Path(__file__).resolve().parents[3]

PolicyDecision = Literal["eligible_for_registration", "manual_review"]


# =====================================================================
#  Clean result / error types the backend actually consumes
# =====================================================================


@dataclass(frozen=True)
class ScoringResult:
    """Backend-facing scoring result. Mirrors ScoreSubmissionResponse 1:1 —
    kept as a separate type so the backend depends on the adapter, not on
    the scoring service's Pydantic model directly."""

    score: int
    confidence_band: str
    flags: list[str]
    ndvi_before: float | None
    ndvi_after: float | None

    @classmethod
    def from_response(cls, response: ScoreSubmissionResponse) -> "ScoringResult":
        return cls(
            score=response.score,
            confidence_band=response.confidence_band,
            flags=list(response.flags),
            ndvi_before=response.ndvi_before,
            ndvi_after=response.ndvi_after,
        )


class CoreEngineError(RuntimeError):
    """Base error for all Core Engine adapter failures."""


class ScoringUnavailableError(CoreEngineError):
    """Raised when scoring cannot run at all (e.g. missing Copernicus credentials)."""


class ContractCallError(CoreEngineError):
    """Raised when a blockchain transaction (via manage-blue-carbon.ts) fails."""

    def __init__(self, action: str, stderr: str):
        self.action = action
        self.stderr = stderr
        super().__init__(f"Contract call '{action}' failed: {stderr}")


# =====================================================================
#  Scoring
# =====================================================================


def score(
    submission: ScoreSubmissionRequest, provider: ImageryProvider | None = None
) -> ScoringResult:
    """
    Score a submission. Uses the real Copernicus/Sentinel provider unless a
    provider is injected (tests should inject a fake provider — see
    tests/test_scoring.py::FixedNdviProvider for the existing pattern).

    Raises ScoringUnavailableError if Copernicus credentials are not configured.
    Does NOT raise on imagery-unavailable — that is a valid structured result
    (score=0, flags=["sentinel_imagery_unavailable"]), per existing behavior.
    """
    try:
        active_provider = provider or SentinelHubNdviProvider(Settings.from_environment())
    except SentinelHubConfigurationError as error:
        raise ScoringUnavailableError(str(error)) from error

    response = score_submission(submission, active_provider)
    return ScoringResult.from_response(response)


# =====================================================================
#  Policy evaluation
# =====================================================================


def evaluate_policy(result: ScoringResult) -> PolicyDecision:
    """
    Apply the documented clean/high-confidence mint policy
    (see CORE_ENGINE_README.md → Orchestration policy table).

    score >= 75 AND confidence_band == "high" AND flags is empty
        -> eligible_for_registration
    otherwise
        -> manual_review

    This function encodes policy ONLY. It does not call the contract.
    """
    if result.score >= 75 and result.confidence_band == "high" and not result.flags:
        return "eligible_for_registration"
    return "manual_review"


# =====================================================================
#  Blockchain lifecycle — wraps scripts/manage-blue-carbon.ts via subprocess
# =====================================================================


def _run_contract_action(action: str, env_vars: dict[str, str]) -> dict:
    """
    Shell out to the existing manage-blue-carbon.ts script. This script is
    CLI-only (not an importable module), so subprocess is the integration
    seam — see CORE_ENGINE_INTERFACE.md section 5.

    Returns the parsed JSON the script prints on success.
    Raises ContractCallError on any non-zero exit.
    """
    import os

    full_env = {**os.environ, **env_vars, "BLUE_CARBON_ACTION": action}

    completed = subprocess.run(
        ["npx", "hardhat", "run", "scripts/manage-blue-carbon.ts", "--network", "sepolia"],
        cwd=REPO_ROOT,
        env=full_env,
        capture_output=True,
        text=True,
    )

    if completed.returncode != 0:
        raise ContractCallError(action, completed.stderr.strip())

    try:
        return json.loads(completed.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as error:
        raise ContractCallError(action, f"could not parse script output: {completed.stdout}") from error


def register_submission(
    contract_address: str,
    submission_id: str,
    metadata_uri: str,
    beneficiary_address: str,
    credit_amount: str,
) -> dict:
    """Call registerSubmission — should only be invoked after
    evaluate_policy() returns 'eligible_for_registration'."""
    return _run_contract_action(
        "register",
        {
            "BLUE_CARBON_CREDIT_ADDRESS": contract_address,
            "SUBMISSION_ID": submission_id,
            "METADATA_URI": metadata_uri,
            "BENEFICIARY_ADDRESS": beneficiary_address,
            "CREDIT_AMOUNT": credit_amount,
        },
    )


def dispute_submission(contract_address: str, submission_id: str, reason: str) -> dict:
    return _run_contract_action(
        "dispute",
        {
            "BLUE_CARBON_CREDIT_ADDRESS": contract_address,
            "SUBMISSION_ID": submission_id,
            "DISPUTE_REASON": reason,
        },
    )


def resolve_dispute(contract_address: str, submission_id: str, approved: bool) -> dict:
    return _run_contract_action(
        "resolve",
        {
            "BLUE_CARBON_CREDIT_ADDRESS": contract_address,
            "SUBMISSION_ID": submission_id,
            "DISPUTE_APPROVED": "true" if approved else "false",
        },
    )


def reverify_submission(
    submission: ScoreSubmissionRequest, provider: ImageryProvider | None = None
) -> tuple[ScoringResult, PolicyDecision]:
    """
    Re-verification is NOT a separate contract function (confirmed — no such
    function exists on-chain). It is scoring run again, evaluated against the
    same clean-mint policy. The caller (backend) is responsible for requiring
    human approval before calling release_credits, per orchestration policy.
    """
    result = score(submission, provider)
    decision = evaluate_policy(result)
    return result, decision


def release_credits(contract_address: str, submission_id: str) -> dict:
    """
    Calls releaseCredits. IMPORTANT: the contract only checks status==Provisional
    and vesting elapsed — it does NOT re-verify NDVI. Callers MUST run
    reverify_submission() and get human approval BEFORE calling this, per
    CORE_ENGINE_INTERFACE.md section 4. This adapter does not enforce that
    ordering itself (no orchestration state store exists yet) — documenting
    the requirement here is a deliberate choice, not an oversight, pending
    the backend team's persistence layer.
    """
    return _run_contract_action(
        "release",
        {
            "BLUE_CARBON_CREDIT_ADDRESS": contract_address,
            "SUBMISSION_ID": submission_id,
        },
    )