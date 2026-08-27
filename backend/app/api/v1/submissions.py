from datetime import date
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from backend.app.schemas.submissions import CreateSubmissionRequest, PhotoMetadata
from backend.app.services.core_engine_adapter import CoreEngineAdapter, CoreEngineError
from backend.app.services.pinata_service import PinataError, upload_file
from backend.app.services.submission_service import SubmissionService


router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"],
)


submission_service = SubmissionService(
    core_engine=CoreEngineAdapter(),
)


@router.post(
    "",
    status_code=status.HTTP_200_OK,
)
async def create_submission(
    latitude: float = Form(...),
    longitude: float = Form(...),
    claimed_planting_date: date = Form(...),
    photo_gps_latitude: float | None = Form(default=None),
    photo_gps_longitude: float | None = Form(default=None),
    photo_captured_at: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
):
    try:
        metadata = PhotoMetadata(
            gps_latitude=photo_gps_latitude,
            gps_longitude=photo_gps_longitude,
            captured_at=photo_captured_at,
        )

        submission = CreateSubmissionRequest(
            latitude=latitude,
            longitude=longitude,
            claimed_planting_date=claimed_planting_date,
            photo_metadata=metadata,
        )

        evidence_uri = None

        if photo is not None:
            temp_path = f"temp_{photo.filename}"

            try:
                with open(temp_path, "wb") as file:
                    file.write(await photo.read())

                evidence_uri = await upload_file(temp_path)

            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

        return await submission_service.create_submission(
            submission,
            evidence_uri=evidence_uri,
        )

    except (PinataError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except CoreEngineError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
@router.get("/count")
async def get_submission_count():
    try:
        result = (
            submission_service.supabase
            .table("submissions")
            .select("id", count="exact")
            .execute()
        )

        return {
            "count": result.count or 0
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get submission count: {error}",
        ) from error
