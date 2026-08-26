# Core Engine Interface — Documented (as-is, before adapter)

This documents the ACTUAL current behavior of the Core Engine, verified by direct
inspection and live testing. No business logic was changed to produce this document.

## 1. Scoring Service — HTTP Interface

**Endpoint:** `POST /score-submission`
**App factory:** `create_app(provider: ImageryProvider | None = None) -> FastAPI`
Module-level `app = create_app()` is what uvicorn loads (`app.main:app`).

### Request — `ScoreSubmissionRequest`
```json
{
  "latitude": -3.4653,          // float, -90..90, required
  "longitude": 114.0917,        // float, -180..180, required
  "claimed_planting_date": "2024-01-15",  // date, required
  "photo_metadata": {
    "gps_latitude": -3.4653,    // float|null, -90..90
    "gps_longitude": 114.0917,  // float|null, -180..180
    "captured_at": "2024-01-20T09:30:00Z"  // datetime|null, ISO 8601
  }
}
```
- `extra="forbid"` on both `ScoreSubmissionRequest` and `PhotoMetadata` — unknown fields rejected.
- Models are explicitly marked **provisional** in code docstrings — team has not published a locked submission schema yet.

### Response — `ScoreSubmissionResponse` (200 OK)
```json
{
  "score": 90,               // int 0..100
  "confidence_band": "high", // "low" | "medium" | "high"
  "flags": [],                // list[str]
  "ndvi_before": 0.18,        // float -1..1, or null
  "ndvi_after": 0.56          // float -1..1, or null
}
```

### Error responses (all verified live via Swagger)
| Condition | Code | Body shape |
|---|---|---|
| Missing `COPERNICUS_CLIENT_ID`/`COPERNICUS_CLIENT_SECRET` env vars | 503 | `{"detail": "<string>"}` |
| Field out of range (e.g. `latitude > 90`) | 422 | `{"detail": [{...pydantic error...}]}` |
| Unknown/extra field in request | 422 | `{"detail": [{...}], "type": "extra_forbidden"}` |
| `ImageryUnavailableError` internally (bad Sentinel response / no valid pixels) | 200 | `{"score":0,"confidence_band":"low","flags":["sentinel_imagery_unavailable"],"ndvi_before":null,"ndvi_after":null}` — **not an HTTP error**, a structured result |

Note: 503 happens during provider construction (before scoring runs) if no `provider` was
injected into `create_app()`. Injecting a provider bypasses this entirely — this is the
existing seam tests use for mocking.

## 2. Scoring Business Logic (`app/scoring.py`) — unchanged, documented only

NDVI base score thresholds:
- `ndvi_after < 0.20` → score 20, flag `low_current_vegetation`
- `ndvi_change < 0.05` → score 30, flag `no_meaningful_vegetation_increase`
- `ndvi_change < 0.15` → score 60, no flag
- else → score 90

EXIF penalties (applied after base score):
- GPS missing → flag `photo_gps_missing`, -10
- GPS >1000m from submission (haversine) → flag `photo_gps_mismatch`, -25
- Timestamp missing → flag `photo_timestamp_missing`, -10
- Timestamp >45 days from claimed planting date → flag `photo_timestamp_mismatch`, -15

Score clamped 0–100. Confidence band: ≥75 high / ≥50 medium / <50 low.

**Note:** `planting_window()` is a ±30-day window centered on the claimed planting date
(not strictly "before" despite the name) — used to compute `ndvi_before`.
`recent_window()` is strictly backward-looking from evaluation date — used for `ndvi_after`.

## 3. Imagery Provider (`app/imagery.py`)

`ImageryProvider` is a `Protocol` — any object with a matching `mean_ndvi(lat, lon, start, end) -> float` satisfies it. No inheritance needed. This is the existing test-mocking seam (see `FixedNdviProvider` in `tests/test_scoring.py`).

`SentinelHubNdviProvider` hits Copernicus Data Space Ecosystem (CDSE), not commercial
Sentinel Hub. Raises `ImageryUnavailableError` on request failure or zero valid pixels.

## 4. Blockchain Contract (`contracts/BlueCarbonCredit.sol`)

Deployed: Ethereum Sepolia, `0x815F9122D29471e161D66068Eef9a508EC079442`
(verified source on Blockscout).

Status enum: `Registered, Provisional, Released, Disputed, Rejected`
(constructor mints directly to `Provisional`, `Registered` is unused in current flow)

| Function | Role required | Preconditions | Result |
|---|---|---|---|
| `registerSubmission(id, metadataURI, beneficiary, amount)` | VERIFIER_ROLE | beneficiary≠0, amount≠0, id not already used | mints locked tokens, status→Provisional |
| `releaseCredits(id)` | VERIFIER_ROLE | status==Provisional, vesting elapsed | status→Released, tokens unlocked |
| `disputeSubmission(id, reason)` | DISPUTER_ROLE | status==Provisional | status→Disputed |
| `resolveDispute(id, approved)` | VERIFIER_ROLE | status==Disputed | approved→Provisional; rejected→Rejected + burn |

**Important:** `releaseCredits` only checks status + vesting time. It does NOT perform
NDVI re-verification on-chain. Re-verification is an off-chain responsibility that must
happen BEFORE calling `releaseCredits` — this is an orchestration requirement, not
something the contract enforces.

Custom errors: `SubmissionAlreadyExists`, `SubmissionNotFound`, `InvalidStatus`,
`VestingNotElapsed`, `ZeroCreditAmount`, `ZeroAddress`, `TransferExceedsUnlocked`.

## 5. Contract Access Path (`scripts/manage-blue-carbon.ts`)

CLI-only script, one action per invocation via env vars + `npx hardhat run ... --network sepolia`.
Actions: `grant-verifier`, `grant-disputer`, `register`, `release`, `dispute`, `resolve`.
**Not importable as a module** — a Python backend cannot call it directly. Adapter must
either shell out via subprocess or reimplement calls in Python (e.g. web3.py).

`submissionId` convention: `keccak256(utf8(SUBMISSION_ID))` unless `SUBMISSION_ID` is
already a 32-byte `0x…` hex string (see `submissionId()` helper in the script).

## 6. Orchestration Policy (from CORE_ENGINE_README.md — authoritative, unchanged)

| Decision | Rule | Action | Result |
|---|---|---|---|
| Provisional mint | score≥75, confidence=="high", flags empty | call `registerSubmission` | Provisional |
| Manual review | anything else | store evidence, do NOT call `registerSubmission` | no on-chain record |
| Release | Provisional + vesting elapsed + fresh score again meets clean rule + human approval | call `releaseCredits` | Released |
| Dispute | suspicious re-check / challenge / evidence conflict on a Provisional submission | call `disputeSubmission` | Disputed |
| Resolve | human review of a Disputed submission | `resolveDispute(true/false)` | Provisional or Rejected |

There is no direct path to `Released` other than through `releaseCredits` — no shortcut mint.

## 7. Test Baseline (before adapter changes)

- Hardhat/Solidity: 31 passing
- Python/pytest: 5 passing

Both must still pass after adapter work is added.