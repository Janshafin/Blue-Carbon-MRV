from backend.app.schemas.submissions import CreateSubmissionRequest
from backend.app.services.core_engine_adapter import CoreEngineAdapter
class SubmissionService:
    def __init__(self, core_engine: CoreEngineAdapter):
        self.core_engine = core_engine

    async def create_submission(
        self,
        submission: CreateSubmissionRequest,
    ) -> dict:
        scoring_result = await self.core_engine.score_submission(submission)

        eligible_for_provisional = (
            scoring_result["score"] >= 75
            and scoring_result["confidence_band"] == "high"
            and not scoring_result["flags"]
        )

        return {
            "status": "SCORED",
            "verification": scoring_result,
            "eligible_for_provisional": eligible_for_provisional,
            "manual_review_required": not eligible_for_provisional,
        }