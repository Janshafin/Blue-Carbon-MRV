from datetime import date, datetime
from typing import Literal

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

    project_name: str = Field(min_length=2, max_length=200)
    species: str = Field(min_length=2, max_length=120)
    ngo_id: str = Field(min_length=2, max_length=50)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    claimed_planting_date: date
    photo_metadata: PhotoMetadata
    photo_data_url: str | None = Field(default=None, max_length=14_000_000)
    beneficiary: str | None = Field(default=None, pattern=r"^0x[a-fA-F0-9]{40}$")


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["approved", "rejected", "disputed", "resolved"]
    reviewer_notes: str = Field(min_length=2, max_length=2_000)
    tx_hash: str | None = Field(default=None, pattern=r"^0x[a-fA-F0-9]{64}$")
    block_number: int | None = Field(default=None, ge=0)
    approved: bool | None = None
