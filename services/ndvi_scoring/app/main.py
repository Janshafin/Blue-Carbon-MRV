import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .imagery import ImageryProvider, SentinelHubNdviProvider
from .models import ScoreSubmissionRequest, ScoreSubmissionResponse
from .scoring import score_submission
from .settings import SentinelHubConfigurationError, Settings


class FixedNdviProvider:
    """Deterministic provider for local development/testing."""

    def mean_ndvi(self, latitude, longitude, start_date, end_date) -> float:
        # Simulated Sentinel-2 values for local testing.
        if start_date.year <= 2024:
            return 0.18

        return 0.56


def create_app(provider: ImageryProvider | None = None) -> FastAPI:
    app = FastAPI(
        title="Blue Carbon NDVI Plausibility Service",
        version="0.1.0",
        description=(
            "Scores a blue-carbon planting submission using Sentinel-2 NDVI "
            "change and photo-EXIF consistency checks."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://blue-carbon-mrv-web.vercel.app",
            "http://localhost:5173",
        ],
        allow_methods=["POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.post(
        "/score-submission",
        response_model=ScoreSubmissionResponse,
        summary="Score a planting submission's NDVI and EXIF plausibility",
    )
    def score_endpoint(
        submission: ScoreSubmissionRequest,
    ) -> ScoreSubmissionResponse:
        try:
            if provider is not None:
                active_provider = provider
            elif os.getenv("MOCK_NDVI", "false").lower() == "true":
                active_provider = FixedNdviProvider()
            else:
                active_provider = SentinelHubNdviProvider(
                    Settings.from_environment()
                )

            return score_submission(submission, active_provider)

        except SentinelHubConfigurationError as error:
            raise HTTPException(
                status_code=503,
                detail=str(error),
            ) from error

    return app


app = create_app()
