from datetime import date
from math import asin, cos, radians, sin, sqrt

from .imagery import ImageryProvider, ImageryUnavailableError, planting_window, recent_window
from .models import ScoreSubmissionRequest, ScoreSubmissionResponse


EXIF_LOCATION_TOLERANCE_METERS = 1_000
EXIF_DATE_TOLERANCE_DAYS = 45


def _distance_meters(
    latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float
) -> float:
    """Great-circle distance using the haversine formula."""

    earth_radius_meters = 6_371_000
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    haversine = sin(latitude_delta / 2) ** 2 + cos(radians(latitude_a)) * cos(
        radians(latitude_b)
    ) * sin(longitude_delta / 2) ** 2
    return 2 * earth_radius_meters * asin(sqrt(haversine))


def _apply_exif_checks(submission: ScoreSubmissionRequest, score: int, flags: list[str]) -> int:
    photo = submission.photo_metadata
    if photo.gps_latitude is None or photo.gps_longitude is None:
        flags.append("photo_gps_missing")
        score -= 10
    elif (
        _distance_meters(
            submission.latitude,
            submission.longitude,
            photo.gps_latitude,
            photo.gps_longitude,
        )
        > EXIF_LOCATION_TOLERANCE_METERS
    ):
        flags.append("photo_gps_mismatch")
        score -= 25

    if photo.captured_at is None:
        flags.append("photo_timestamp_missing")
        score -= 10
    elif abs((photo.captured_at.date() - submission.claimed_planting_date).days) > EXIF_DATE_TOLERANCE_DAYS:
        flags.append("photo_timestamp_mismatch")
        score -= 15
    return score


def score_submission(
    submission: ScoreSubmissionRequest, provider: ImageryProvider, today: date | None = None
) -> ScoreSubmissionResponse:
    """Produce a deliberately simple, reviewable plausibility assessment."""

    evaluation_date = today or date.today()
    before_start, before_end = planting_window(submission.claimed_planting_date, 30)
    after_start, after_end = recent_window(evaluation_date, 30)
    try:
        ndvi_before = provider.mean_ndvi(
            submission.latitude, submission.longitude, before_start, before_end
        )
        ndvi_after = provider.mean_ndvi(
            submission.latitude, submission.longitude, after_start, after_end
        )
    except ImageryUnavailableError:
        return ScoreSubmissionResponse(
            score=0,
            confidence_band="low",
            flags=["sentinel_imagery_unavailable"],
            ndvi_before=None,
            ndvi_after=None,
        )

    flags: list[str] = []
    ndvi_change = ndvi_after - ndvi_before
    if ndvi_after < 0.20:
        score = 20
        flags.append("low_current_vegetation")
    elif ndvi_change < 0.05:
        score = 30
        flags.append("no_meaningful_vegetation_increase")
    elif ndvi_change < 0.15:
        score = 60
    else:
        score = 90

    score = max(0, min(100, _apply_exif_checks(submission, score, flags)))
    confidence_band = "high" if score >= 75 else "medium" if score >= 50 else "low"
    return ScoreSubmissionResponse(
        score=score,
        confidence_band=confidence_band,
        flags=flags,
        ndvi_before=round(ndvi_before, 4),
        ndvi_after=round(ndvi_after, 4),
    )
