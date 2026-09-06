"""Backend-only persistence and evidence orchestration."""

from __future__ import annotations

import os
from typing import Any

import httpx

from backend.app.schemas.submissions import CreateSubmissionRequest, ReviewRequest
from backend.app.services.core_engine_adapter import CoreEngineAdapter


class SubmissionServiceError(RuntimeError):
    pass


class SubmissionService:
    def __init__(self, core_engine: CoreEngineAdapter):
        self.core_engine = core_engine
        self.supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.pinata_jwt = os.getenv("PINATA_JWT", "")

    def _headers(self) -> dict[str, str]:
        if not self.supabase_url or not self.supabase_key:
            raise SubmissionServiceError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the backend.")
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def _rest(self, method: str, path: str, **kwargs: Any) -> Any:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.request(method, f"{self.supabase_url}/rest/v1/{path}", headers=self._headers(), **kwargs)
        if response.status_code >= 400:
            raise SubmissionServiceError(f"Supabase request failed with HTTP {response.status_code}: {response.text[:240]}")
        return response.json() if response.content else None

    async def _pin_evidence(self, evidence: dict[str, Any]) -> str:
        if not self.pinata_jwt:
            raise SubmissionServiceError("PINATA_JWT must be configured on the backend.")
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                headers={"Authorization": f"Bearer {self.pinata_jwt}"},
                json={"pinataContent": evidence, "pinataMetadata": {"name": "blue-carbon-evidence.json"}},
            )
        if response.status_code >= 400:
            raise SubmissionServiceError(f"Pinata upload failed with HTTP {response.status_code}.")
        cid = response.json().get("IpfsHash")
        if not cid:
            raise SubmissionServiceError("Pinata did not return an IPFS CID.")
        return cid

    async def create_submission(self, submission: CreateSubmissionRequest) -> dict[str, Any]:
        scoring = await self.core_engine.score_submission(submission)
        evidence = {
            "schema_version": "1.0", "project_name": submission.project_name, "species": submission.species,
            "ngo_id": submission.ngo_id, "latitude": submission.latitude, "longitude": submission.longitude,
            "accuracy": submission.accuracy, "claimed_planting_date": submission.claimed_planting_date.isoformat(),
            "photo_metadata": submission.photo_metadata.model_dump(mode="json"), "photo_data_url": submission.photo_data_url,
            "scoring": scoring,
        }
        cid = await self._pin_evidence(evidence)
        row = {
            "project_name": submission.project_name, "region": self._detect_region(submission.latitude, submission.longitude),
            "species": submission.species, "ngo_id": submission.ngo_id, "latitude": submission.latitude,
            "longitude": submission.longitude, "accuracy": submission.accuracy,
            "planted_date": submission.claimed_planting_date.isoformat(), "photo_url": f"ipfs://{cid}",
            "score": scoring["score"], "ndvi_before": scoring["ndvi_before"], "ndvi_after": scoring["ndvi_after"],
            "confidence_band": scoring["confidence_band"], "flags": scoring["flags"], "status": "scored",
            "beneficiary": submission.beneficiary,
        }
        saved = (await self._rest("POST", "submissions", params={"select": "*"}, json=row))[0]
        flagged = bool(scoring["flags"])
        await self._rest("POST", "activity_log", json={"kind": "flag" if flagged else "submit", "text": f"{submission.project_name} {'flagged' if flagged else 'scored'} — NDVI score {scoring['score']}", "submission_id": saved["id"]})
        return {"submission": saved, "ipfs_cid": cid, "eligible_for_provisional": scoring["score"] >= 75 and scoring["confidence_band"] == "high" and not flagged}

    async def list_submissions(self) -> list[dict[str, Any]]:
        return await self._rest("GET", "submissions", params={"select": "*", "order": "created_at.desc"})

    async def list_activity(self, limit: int) -> list[dict[str, Any]]:
        return await self._rest("GET", "activity_log", params={"select": "*", "order": "created_at.desc", "limit": str(limit)})

    async def review(self, submission_id: str, review: ReviewRequest) -> dict[str, Any]:
        final_status = review.action
        if review.action == "resolved":
            if review.approved is None:
                raise SubmissionServiceError("A resolved dispute requires approved=true or approved=false.")
            final_status = "approved" if review.approved else "rejected"
        patch: dict[str, Any] = {"status": final_status, "reviewer_notes": review.reviewer_notes}
        if review.tx_hash: patch["on_chain_tx"] = review.tx_hash
        if review.block_number is not None: patch["on_chain_block"] = review.block_number
        result = await self._rest(
            "PATCH",
            "submissions",
            params={"id": f"eq.{submission_id}", "select": "*"},
            json=patch,
        )
        if not result: raise SubmissionServiceError("Submission not found.")
        kind = "approve" if final_status == "approved" else "reject" if final_status == "rejected" else "dispute"
        await self._rest("POST", "activity_log", json={"kind": kind, "text": f"Submission {submission_id[:8]}… {final_status}", "submission_id": submission_id})
        return result[0]

    @staticmethod
    def _detect_region(lat: float, lng: float) -> str:
        if 21 < lat < 23 and 87 < lng < 90: return "West Bengal"
        if 22 < lat < 25 and 84 < lng < 87: return "Jharkhand"
        if 20 < lat < 24 and 68 < lng < 72: return "Gujarat"
        if 8 < lat < 13 and 74 < lng < 78: return "Kerala"
        if 8 < lat < 14 and 77 < lng < 81: return "Tamil Nadu"
        return "India"
