from fastapi import FastAPI, HTTPException

from .imagery import ImageryProvider, SentinelHubNdviProvider
from .models import ScoreSubmissionRequest, ScoreSubmissionResponse
from .scoring import score_submission
from .settings import SentinelHubConfigurationError, Settings


def create_app(provider: ImageryProvider | None = None) -> FastAPI:
    app = FastAPI(
        title="Blue Carbon NDVI Plausibility Service",
        version="0.1.0",
        description=(
            "Scores a blue-carbon planting submission using Sentinel-2 NDVI change "
            "and basic photo-EXIF consistency checks. Request fields are provisional "
            "until the team publishes its locked data contract."
        ),
    )

    @app.post(
        "/score-submission",
        response_model=ScoreSubmissionResponse,
        summary="Score a planting submission's NDVI and EXIF plausibility",
    )
    def score_endpoint(submission: ScoreSubmissionRequest) -> ScoreSubmissionResponse:
        try:
            active_provider = provider or SentinelHubNdviProvider(Settings.from_environment())
            return score_submission(submission, active_provider)
        except SentinelHubConfigurationError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    return app


app = create_app()
