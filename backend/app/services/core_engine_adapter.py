import os

import httpx

from backend.app.schemas.submissions import CreateSubmissionRequest


class CoreEngineError(Exception):
    """Raised when the Core Engine cannot process a submission."""


class CoreEngineAdapter:
    def __init__(self, base_url: str | None = None):
        self.base_url = (
            base_url
            or os.getenv(
                "CORE_ENGINE_URL",
                "http://127.0.0.1:8001",
            )
        ).rstrip("/")

    async def score_submission(
        self,
        submission: CreateSubmissionRequest,
    ) -> dict:
        # The scoring service accepts only geospatial/EXIF evidence. Keep
        # project and persistence fields out of this strict request contract.
        payload = {
            "latitude": submission.latitude,
            "longitude": submission.longitude,
            "claimed_planting_date": submission.claimed_planting_date.isoformat(),
            "photo_metadata": submission.photo_metadata.model_dump(mode="json"),
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/score-submission",
                    json=payload,
                )
        except httpx.RequestError as error:
            raise CoreEngineError(
                "Unable to connect to the Core Engine."
            ) from error

        if response.status_code >= 400:
            raise CoreEngineError(
                f"Core Engine returned HTTP {response.status_code}: "
                f"{response.text}"
            )

        return response.json()
