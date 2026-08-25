# NDVI Plausibility Scoring Service

FastAPI service for a transparent first-pass blue-carbon MRV check. It requests Sentinel-2 L2A imagery from the Copernicus Data Space Ecosystem (CDSE), compares mean NDVI near the claimed planting date against a recent 30-day window, and checks supplied photo EXIF coordinates/timestamp.

## Data contract status

The repository does not contain the team's locked submission data contract. Therefore the endpoint publishes the following **provisional** request fields exactly as specified in the Phase 2 brief:

```json
{
  "latitude": -3.4653,
  "longitude": 114.0917,
  "claimed_planting_date": "2024-01-15",
  "photo_metadata": {
    "gps_latitude": -3.4653,
    "gps_longitude": 114.0917,
    "captured_at": "2024-01-20T09:30:00Z"
  }
}
```

`photo_metadata.gps_latitude`, `photo_metadata.gps_longitude`, and `photo_metadata.captured_at` are nullable because EXIF can be stripped from a photo; missing values produce flags. Replace or map these fields once the locked contract is shared.

The response contract is:

```json
{
  "score": 90,
  "confidence_band": "high",
  "flags": [],
  "ndvi_before": 0.18,
  "ndvi_after": 0.56
}
```

## Run locally

```bash
cd services/ndvi_scoring
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

FastAPI publishes OpenAPI at [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json) and interactive Swagger documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Add these values to the root `.env` file (never commit them):

```env
COPERNICUS_CLIENT_ID=...
COPERNICUS_CLIENT_SECRET=...
```

Create the OAuth client in the CDSE Sentinel Hub dashboard. The service uses CDSE's OAuth token endpoint and `https://sh.dataspace.copernicus.eu` base URL, as documented by the [Copernicus Data Space Ecosystem](https://documentation.dataspace.copernicus.eu/notebook-samples/sentinelhub/CLMS_data_with_Process_Statistical_APIs.html).

## Scoring rules

- NDVI increase of at least `0.15`: score 90.
- Increase from `0.05` to `<0.15`: score 60.
- Increase `<0.05`: score 30 plus `no_meaningful_vegetation_increase`.
- Recent NDVI below `0.20`: score 20 plus `low_current_vegetation`.
- EXIF GPS farther than 1 km from the claimed location: minus 25.
- EXIF timestamp over 45 days from the claimed planting date: minus 15.
- Missing EXIF GPS/timestamp: minus 10 each.

This is intentionally explainable triage, not proof of sequestration or an automated credit-issuance decision. Review flagged submissions manually.

## Tests

```bash
cd services/ndvi_scoring
.venv/bin/python -m pytest
```

The tests inject deterministic NDVI values instead of calling CDSE, covering clear vegetation increase, no meaningful change, and EXIF mismatch flags.
