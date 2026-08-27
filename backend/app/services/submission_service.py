
import os
import uuid

from dotenv import load_dotenv
from supabase import Client, create_client

from backend.app.schemas.submissions import CreateSubmissionRequest
from backend.app.services.core_engine_adapter import CoreEngineAdapter


load_dotenv()


class SubmissionService:
    def __init__(self, core_engine: CoreEngineAdapter):
        self.core_engine = core_engine

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set"
            )

        self.supabase: Client = create_client(
            supabase_url,
            supabase_key,
        )

    async def create_submission(
        self,
        submission: CreateSubmissionRequest,
        evidence_uri: str | None = None,
    ) -> dict:

        scoring_result = await self.core_engine.score_submission(
            submission
        )

        eligible_for_provisional = (
            scoring_result["score"] >= 75
            and scoring_result["confidence_band"] == "high"
            and not scoring_result["flags"]
        )

        submission_id = str(uuid.uuid4())

        record = {
            "id": submission_id,
            "latitude": submission.latitude,
            "longitude": submission.longitude,
            "claimed_planting_date": (
                submission.claimed_planting_date.isoformat()
            ),
            "photo_gps_latitude": (
                submission.photo_metadata.gps_latitude
            ),
            "photo_gps_longitude": (
                submission.photo_metadata.gps_longitude
            ),
            "photo_captured_at": (
                submission.photo_metadata.captured_at.isoformat()
                if submission.photo_metadata.captured_at
                else None
            ),
            "score": scoring_result["score"],
            "confidence_band": scoring_result["confidence_band"],
            "flags": scoring_result["flags"],
            "ndvi_before": scoring_result["ndvi_before"],
            "ndvi_after": scoring_result["ndvi_after"],
            "status": "SCORED",
            "eligible_for_provisional": eligible_for_provisional,
            "manual_review_required": not eligible_for_provisional,
            "evidence_uri": evidence_uri,
        }

        self.supabase.table("submissions").insert(record).execute()

        return {
            "submission_id": submission_id,
            "status": "SCORED",
            "verification": scoring_result,
            "eligible_for_provisional": eligible_for_provisional,
            "manual_review_required": not eligible_for_provisional,
        }
