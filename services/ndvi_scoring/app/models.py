from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PhotoMetadata(BaseModel):
    """Provisional EXIF fields until the team publishes its locked data contract."""

    model_config = ConfigDict(extra="forbid")

    gps_latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
        description="Latitude decoded from the submitted photo's EXIF GPS tag.",
    )
    gps_longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
        description="Longitude decoded from the submitted photo's EXIF GPS tag.",
    )
    captured_at: datetime | None = Field(
        default=None,
        description="Timestamp decoded from EXIF, in ISO 8601 format when available.",
    )


class ScoreSubmissionRequest(BaseModel):
    """
    Provisional request contract.

    The repository does not yet contain the team's locked submission schema. The
    field names below intentionally match the Phase 2 brief and are published in
    OpenAPI so downstream teams can integrate against one explicit contract.
    """

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90, examples=[-3.4653])
    longitude: float = Field(ge=-180, le=180, examples=[114.0917])
    claimed_planting_date: date = Field(examples=["2024-01-15"])
    photo_metadata: PhotoMetadata = Field(
        description="GPS and timestamp decoded from the submission photo's EXIF metadata."
    )


class ScoreSubmissionResponse(BaseModel):
    score: int = Field(ge=0, le=100, description="Explainable NDVI/EXIF plausibility score.")
    confidence_band: Literal["low", "medium", "high"]
    flags: list[str] = Field(default_factory=list)
    ndvi_before: float | None = Field(
        default=None,
        ge=-1,
        le=1,
        description="Mean valid-pixel NDVI near the claimed planting date.",
    )
    ndvi_after: float | None = Field(
        default=None,
        ge=-1,
        le=1,
        description="Mean valid-pixel NDVI from a recent Sentinel-2 window.",
    )
