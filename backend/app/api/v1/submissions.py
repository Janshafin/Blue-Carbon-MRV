from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.submissions import CreateSubmissionRequest, ReviewRequest
from backend.app.services.core_engine_adapter import CoreEngineAdapter, CoreEngineError
from backend.app.services.submission_service import SubmissionService, SubmissionServiceError
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
    except (CoreEngineError, SubmissionServiceError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error


@router.get("")
async def list_submissions():
    try:
        return await submission_service.list_submissions()
    except SubmissionServiceError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.get("/queue")
async def review_queue():
    return await list_submissions()


@router.get("/activity")
async def activity(limit: int = 20):
    try:
        return await submission_service.list_activity(min(max(limit, 1), 100))
    except SubmissionServiceError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.post("/{submission_id}/review")
async def review_submission(submission_id: str, review: ReviewRequest):
    try:
        return await submission_service.review(submission_id, review)
    except SubmissionServiceError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
