from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.submissions import CreateSubmissionRequest
from backend.app.services.core_engine_adapter import CoreEngineAdapter, CoreEngineError
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
    submission: CreateSubmissionRequest,
):
    try:
        return await submission_service.create_submission(submission)
    except CoreEngineError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error