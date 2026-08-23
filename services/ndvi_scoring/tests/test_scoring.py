from fastapi.testclient import TestClient

from app.main import create_app


class FixedNdviProvider:
    """Deterministic Sentinel substitute for scoring-rule tests."""

    def __init__(self, before: float, after: float):
        self.values = iter((before, after))

    def mean_ndvi(self, latitude, longitude, start_date, end_date) -> float:
        return next(self.values)


def submission_payload(**photo_metadata):
    return {
        # East Kalimantan mangrove-area coordinates used only as a stable test location.
        "latitude": -3.4653,
        "longitude": 114.0917,
        "claimed_planting_date": "2024-01-15",
        "photo_metadata": {
            "gps_latitude": -3.4653,
            "gps_longitude": 114.0917,
            "captured_at": "2024-01-20T09:30:00Z",
            **photo_metadata,
        },
    }


def test_high_score_for_clear_vegetation_increase():
    client = TestClient(create_app(FixedNdviProvider(before=0.18, after=0.56)))

    response = client.post("/score-submission", json=submission_payload())

    assert response.status_code == 200
    assert response.json() == {
        "score": 90,
        "confidence_band": "high",
        "flags": [],
        "ndvi_before": 0.18,
        "ndvi_after": 0.56,
    }


def test_openapi_publishes_the_provisional_contract():
    client = TestClient(create_app(FixedNdviProvider(before=0.2, after=0.6)))

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    request_schema = schema["components"]["schemas"]["ScoreSubmissionRequest"]
    assert set(request_schema["properties"]) == {
        "latitude",
        "longitude",
        "claimed_planting_date",
        "photo_metadata",
    }
    assert "/score-submission" in schema["paths"]


def test_flags_no_vegetation_change_as_suspicious():
    client = TestClient(create_app(FixedNdviProvider(before=0.42, after=0.43)))

    response = client.post("/score-submission", json=submission_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 30
    assert body["confidence_band"] == "low"
    assert "no_meaningful_vegetation_increase" in body["flags"]


def test_flags_photo_gps_and_timestamp_mismatches():
    client = TestClient(create_app(FixedNdviProvider(before=0.20, after=0.60)))

    response = client.post(
        "/score-submission",
        json=submission_payload(
            gps_latitude=51.5072,
            gps_longitude=-0.1276,
            captured_at="2023-01-01T09:30:00Z",
        ),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 50
    assert body["confidence_band"] == "medium"
    assert {"photo_gps_mismatch", "photo_timestamp_mismatch"}.issubset(body["flags"])
