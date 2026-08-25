from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PhotoMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gps_latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
    )
    gps_longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
    )
    captured_at: datetime | None = None


class CreateSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    claimed_planting_date: date
    photo_metadata: PhotoMetadata