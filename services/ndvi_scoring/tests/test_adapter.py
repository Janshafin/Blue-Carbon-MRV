"""
Tests for the Core Engine adapter (app/adapter.py).

Scoring/policy tests use the same FixedNdviProvider pattern as
tests/test_scoring.py — deterministic, no live Sentinel/Copernicus calls.

Contract-lifecycle tests (register/dispute/resolve/release) mock
subprocess.run so they don't require a deployed contract, a funded
wallet, or network access — they verify the adapter builds the right
env vars and action names, and handles success/failure correctly.
"""

import json
from unittest.mock import patch, MagicMock

import pytest

from app.adapter import (
    ContractCallError,
    ScoringUnavailableError,
    dispute_submission,
    evaluate_policy,
    register_submission,
    release_credits,
    resolve_dispute,
    reverify_submission,
    score,
)
from app.models import PhotoMetadata, ScoreSubmissionRequest


class FixedNdviProvider:
    def __init__(self, before: float, after: float):
        self.values = iter((before, after))

    def mean_ndvi(self, latitude, longitude, start_date, end_date) -> float:
        return next(self.values)


def make_submission(**photo_overrides) -> ScoreSubmissionRequest:
    defaults = {
        "gps_latitude": -3.4653,
        "gps_longitude": 114.0917,
        "captured_at": "2024-01-20T09:30:00Z",
    }
    defaults.update(photo_overrides)
    return ScoreSubmissionRequest(
        latitude=-3.4653,
        longitude=114.0917,
        claimed_planting_date="2024-01-15",
        photo_metadata=PhotoMetadata(**defaults),
    )


# =====================================================================
#  Scoring — valid / clean submission
# =====================================================================


def test_valid_submission_scores_high_and_is_eligible():
    submission = make_submission()
    result = score(submission, provider=FixedNdviProvider(before=0.18, after=0.56))

    assert result.score == 90
    assert result.confidence_band == "high"
    assert result.flags == []
    assert evaluate_policy(result) == "eligible_for_registration"


# =====================================================================
#  Low-risk vs high-risk/suspicious submissions
# =====================================================================


def test_low_vegetation_change_is_suspicious_and_goes_to_manual_review():
    submission = make_submission()
    result = score(submission, provider=FixedNdviProvider(before=0.42, after=0.43))

    assert result.score == 30
    assert result.confidence_band == "low"
    assert "no_meaningful_vegetation_increase" in result.flags
    assert evaluate_policy(result) == "manual_review"


def test_gps_and_timestamp_mismatch_is_high_risk_manual_review():
    submission = make_submission(
        gps_latitude=51.5072,
        gps_longitude=-0.1276,
        captured_at="2023-01-01T09:30:00Z",
    )
    result = score(submission, provider=FixedNdviProvider(before=0.20, after=0.60))

    assert result.score == 50
    assert result.confidence_band == "medium"
    assert {"photo_gps_mismatch", "photo_timestamp_mismatch"}.issubset(result.flags)
    # medium confidence -> manual review even though flags exist too
    assert evaluate_policy(result) == "manual_review"


# =====================================================================
#  Invalid submission — request-level validation happens at the Pydantic
#  layer (ScoreSubmissionRequest), before the adapter is ever called.
#  Confirmed via Swagger: out-of-range lat/lon and extra fields both
#  raise pydantic.ValidationError at construction time.
# =====================================================================


def test_invalid_submission_rejected_before_reaching_adapter():
    with pytest.raises(Exception):
        ScoreSubmissionRequest(
            latitude=200,  # out of range
            longitude=114.0917,
            claimed_planting_date="2024-01-15",
            photo_metadata=PhotoMetadata(),
        )


# =====================================================================
#  Scoring unavailable — missing Copernicus credentials
# =====================================================================


def test_score_raises_scoring_unavailable_when_no_credentials(monkeypatch):
    monkeypatch.delenv("COPERNICUS_CLIENT_ID", raising=False)
    monkeypatch.delenv("COPERNICUS_CLIENT_SECRET", raising=False)

    submission = make_submission()
    with pytest.raises(ScoringUnavailableError):
        score(submission)  # no provider injected -> tries real Settings.from_environment()


# =====================================================================
#  Re-verification
# =====================================================================


def test_reverify_submission_returns_result_and_policy_decision():
    submission = make_submission()
    result, decision = reverify_submission(
        submission, provider=FixedNdviProvider(before=0.18, after=0.56)
    )

    assert result.score == 90
    assert decision == "eligible_for_registration"


def test_reverify_submission_manual_review_when_no_longer_clean():
    submission = make_submission()
    result, decision = reverify_submission(
        submission, provider=FixedNdviProvider(before=0.42, after=0.43)
    )

    assert decision == "manual_review"


# =====================================================================
#  Contract lifecycle — subprocess mocked, no live network/wallet needed
# =====================================================================


def _mock_completed_process(stdout_obj: dict, returncode: int = 0, stderr: str = ""):
    mock = MagicMock()
    mock.returncode = returncode
    mock.stdout = json.dumps(stdout_obj) + "\n"
    mock.stderr = stderr
    return mock


@patch("app.adapter.subprocess.run")
def test_register_submission_success(mock_run):
    mock_run.return_value = _mock_completed_process(
        {"action": "register", "transactionHash": "0xabc", "status": 1}
    )

    result = register_submission(
        contract_address="0x815F9122D29471e161D66068Eef9a508EC079442",
        submission_id="submission-001",
        metadata_uri="ipfs://test-cid",
        beneficiary_address="0x0000000000000000000000000000000000dEaD",
        credit_amount="100",
    )

    assert result["status"] == 1
    called_env = mock_run.call_args.kwargs["env"]
    assert called_env["BLUE_CARBON_ACTION"] == "register"
    assert called_env["SUBMISSION_ID"] == "submission-001"


@patch("app.adapter.subprocess.run")
def test_dispute_submission_success(mock_run):
    mock_run.return_value = _mock_completed_process(
        {"action": "dispute", "transactionHash": "0xdef", "status": 1}
    )

    result = dispute_submission(
        contract_address="0x815F9122D29471e161D66068Eef9a508EC079442",
        submission_id="submission-001",
        reason="Re-check found no meaningful vegetation increase",
    )

    assert result["status"] == 1
    called_env = mock_run.call_args.kwargs["env"]
    assert called_env["BLUE_CARBON_ACTION"] == "dispute"
    assert called_env["DISPUTE_REASON"] == "Re-check found no meaningful vegetation increase"


@patch("app.adapter.subprocess.run")
def test_resolve_dispute_approved(mock_run):
    mock_run.return_value = _mock_completed_process(
        {"action": "resolve", "transactionHash": "0x111", "status": 1}
    )

    resolve_dispute(
        contract_address="0x815F9122D29471e161D66068Eef9a508EC079442",
        submission_id="submission-001",
        approved=True,
    )

    called_env = mock_run.call_args.kwargs["env"]
    assert called_env["DISPUTE_APPROVED"] == "true"


@patch("app.adapter.subprocess.run")
def test_release_credits_success(mock_run):
    mock_run.return_value = _mock_completed_process(
        {"action": "release", "transactionHash": "0x222", "status": 1}
    )

    result = release_credits(
        contract_address="0x815F9122D29471e161D66068Eef9a508EC079442",
        submission_id="submission-001",
    )

    assert result["status"] == 1
    called_env = mock_run.call_args.kwargs["env"]
    assert called_env["BLUE_CARBON_ACTION"] == "release"


@patch("app.adapter.subprocess.run")
def test_contract_call_error_on_nonzero_exit(mock_run):
    mock_run.return_value = _mock_completed_process(
        {}, returncode=1, stderr="VestingNotElapsed"
    )

    with pytest.raises(ContractCallError) as exc_info:
        release_credits(
            contract_address="0x815F9122D29471e161D66068Eef9a508EC079442",
            submission_id="submission-001",
        )

    assert "VestingNotElapsed" in str(exc_info.value)