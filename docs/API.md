# API Documentation

## Blue Carbon MRV — REST & Smart Contract API Reference

> **Version**: 1.0  
> **Date**: 2026-08-28  
> **Base URLs**:  
> - Backend API: `http://127.0.0.1:8000/api/v1` (local) or configured via `VITE_BACKEND_URL`  
> - NDVI Scorer: `http://127.0.0.1:8001` (local) or `https://blue-carbon-mrv.vercel.app/api`  
> - Smart Contract: `0x815F9122D29471e161D66068Eef9a508EC079442` on Sepolia

---

## 1. Backend REST API

### 1.1 `POST /api/v1/submissions`

Create a new submission, trigger NDVI scoring, pin evidence to IPFS, and persist to the database.

**Request Body:**

```json
{
  "project_name": "Avicennia marina Restoration — NGO-IND-2048",
  "species": "Avicennia marina",
  "ngo_id": "NGO-IND-2048",
  "latitude": -3.4653,
  "longitude": 114.0917,
  "accuracy": 12.5,
  "claimed_planting_date": "2024-01-15",
  "photo_data_url": "data:image/jpeg;base64,...",
  "beneficiary": "0xBeneficiaryWalletAddress",
  "photo_metadata": {
    "gps_latitude": -3.4653,
    "gps_longitude": 114.0917,
    "captured_at": "2024-01-20T09:30:00Z"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `project_name` | `string` | ✅ | Display name for the submission |
| `species` | `string` | ✅ | Mangrove species name |
| `ngo_id` | `string` | ✅ | NGO identifier (2–50 chars) |
| `latitude` | `float` | ✅ | `[-90, 90]` |
| `longitude` | `float` | ✅ | `[-180, 180]` |
| `accuracy` | `float` | ❌ | GPS accuracy in meters |
| `claimed_planting_date` | `string` (date) | ✅ | ISO 8601 date (not future) |
| `photo_data_url` | `string` | ❌ | Base64 data URI |
| `beneficiary` | `string` | ❌ | Ethereum address |
| `photo_metadata` | `object` | ✅ | See PhotoMetadata schema |

**Response `200 OK`:**

```json
{
  "submission": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "project_name": "Avicennia marina Restoration — NGO-IND-2048",
    "region": "India",
    "species": "Avicennia marina",
    "ngo_id": "NGO-IND-2048",
    "latitude": -3.4653,
    "longitude": 114.0917,
    "accuracy": 12.5,
    "planted_date": "2024-01-15",
    "photo_url": "ipfs://QmEvidenceCID",
    "score": 90,
    "ndvi_before": 0.18,
    "ndvi_after": 0.56,
    "confidence_band": "high",
    "flags": [],
    "status": "scored",
    "on_chain_tx": null,
    "on_chain_block": null,
    "submission_hash": null,
    "created_at": "2026-08-28T08:00:00Z",
    "reviewed_at": null,
    "reviewer_notes": null,
    "beneficiary": null
  },
  "ipfs_cid": "QmEvidenceCID",
  "eligible_for_provisional": true
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `422` | Validation error |
| `503` | NDVI scoring service unavailable |
| `500` | Pinata or Supabase failure |

---

### 1.2 `GET /api/v1/submissions`

Retrieve all submissions, ordered by `created_at DESC`.

**Response `200 OK`:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "project_name": "...",
    "score": 90,
    "status": "scored",
    ...
  }
]
```

---

### 1.3 `POST /api/v1/submissions/{id}/review`

Update a submission's lifecycle status after reviewer action.

**Request Body:**

```json
{
  "action": "approved",
  "reviewer_notes": "NDVI delta confirms restoration",
  "tx_hash": "0x1234...abcd",
  "block_number": 12345678
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | `string` | ✅ | `approved`, `rejected`, `disputed`, or `resolved` |
| `reviewer_notes` | `string` | ❌ | Free-text reviewer notes |
| `tx_hash` | `string` | ❌ | On-chain transaction hash |
| `block_number` | `integer` | ❌ | Block number |
| `approved` | `boolean` | ❌ | Required when `action = "resolved"` |

**Response `200 OK`:** Returns the updated submission object.

---

### 1.4 `GET /api/v1/submissions/activity`

Retrieve the activity log.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `integer` | `10` | Maximum entries to return |

**Response `200 OK`:**

```json
[
  {
    "id": "...",
    "kind": "submit",
    "text": "Avicennia marina Restoration scored — NDVI score 90",
    "submission_id": "550e8400-...",
    "created_at": "2026-08-28T08:00:00Z"
  }
]
```

---

## 2. NDVI Scoring API

### 2.1 `POST /score-submission`

Score a submission using Sentinel-2 NDVI analysis and EXIF cross-checks.

**Base URL:** NDVI scorer (`http://127.0.0.1:8001` or Vercel `/api`)

**Request Body:**

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

| Field | Type | Required | Constraints |
|---|---|---|---|
| `latitude` | `float` | ✅ | `[-90, 90]` |
| `longitude` | `float` | ✅ | `[-180, 180]` |
| `claimed_planting_date` | `string` (date) | ✅ | ISO 8601 date |
| `photo_metadata.gps_latitude` | `float \| null` | ❌ | EXIF GPS latitude |
| `photo_metadata.gps_longitude` | `float \| null` | ❌ | EXIF GPS longitude |
| `photo_metadata.captured_at` | `datetime \| null` | ❌ | EXIF capture timestamp |

**Response `200 OK`:**

```json
{
  "score": 90,
  "confidence_band": "high",
  "flags": [],
  "ndvi_before": 0.18,
  "ndvi_after": 0.56
}
```

| Field | Type | Description |
|---|---|---|
| `score` | `integer` | Plausibility score (0–100) |
| `confidence_band` | `string` | `"low"` (< 50), `"medium"` (50–74), `"high"` (≥ 75) |
| `flags` | `string[]` | Machine-readable flag codes |
| `ndvi_before` | `float \| null` | Mean NDVI near planting date (−1 to 1) |
| `ndvi_after` | `float \| null` | Mean NDVI from recent 30-day window (−1 to 1) |

**Scoring Rules:**

| Condition | Score | Flags |
|---|---|---|
| NDVI increase ≥ 0.15 | 90 | — |
| NDVI increase 0.05–0.15 | 60 | — |
| NDVI increase < 0.05 | 30 | `no_meaningful_vegetation_increase` |
| Recent NDVI < 0.20 | 20 | `low_current_vegetation` |
| EXIF GPS > 1 km from claim | −25 | `photo_gps_mismatch` |
| EXIF timestamp > 45 days | −15 | `photo_timestamp_mismatch` |
| Missing EXIF GPS | −10 | `photo_gps_missing` |
| Missing EXIF timestamp | −10 | `photo_timestamp_missing` |

**OpenAPI docs:** `http://127.0.0.1:8001/docs` (Swagger UI) and `/openapi.json`

---

### 2.2 `GET /api/health`

Health check endpoint (Vercel deployment only).

**Response `200 OK`:**

```json
{
  "service": "Blue Carbon live NDVI scorer",
  "status": "running"
}
```

---

## 3. Smart Contract API

### 3.1 Contract Details

| Property | Value |
|---|---|
| **Address** | `0x815F9122D29471e161D66068Eef9a508EC079442` |
| **Network** | Ethereum Sepolia |
| **Token** | Blue Carbon Credit (BCC), 18 decimals |
| **Standard** | ERC-20 + AccessControl (OpenZeppelin v5) |
| **Compiler** | Solidity 0.8.28 |

### 3.2 Write Functions

#### `registerSubmission(bytes32, string, address, uint256)`

Register a plantation submission and mint provisional (locked) credits.

| Parameter | Type | Description |
|---|---|---|
| `submissionId` | `bytes32` | Unique identifier (keccak256 of backend UUID) |
| `metadataURI` | `string` | IPFS evidence URI (`ipfs://Qm...`) |
| `beneficiary` | `address` | Wallet to receive credits (non-zero) |
| `creditAmount` | `uint256` | BCC tokens to mint (18 decimals, non-zero) |

**Access:** `VERIFIER_ROLE`  
**Emits:** `SubmissionRegistered`, `CreditProvisional`  
**Errors:** `ZeroAddress`, `ZeroCreditAmount`, `SubmissionAlreadyExists`

#### `releaseCredits(bytes32)`

Release credits after vesting period (tokens become transferable).

| Parameter | Type | Description |
|---|---|---|
| `submissionId` | `bytes32` | Submission to release |

**Access:** `VERIFIER_ROLE`  
**Requires:** Status = `Provisional`, vesting period elapsed  
**Emits:** `CreditReleased`  
**Errors:** `InvalidStatus`, `VestingNotElapsed`

#### `disputeSubmission(bytes32, string)`

Flag a provisional submission before release.

| Parameter | Type | Description |
|---|---|---|
| `submissionId` | `bytes32` | Submission to dispute |
| `reason` | `string` | Human-readable dispute reason |

**Access:** `DISPUTER_ROLE`  
**Requires:** Status = `Provisional`  
**Emits:** `SubmissionDisputed`  
**Errors:** `InvalidStatus`

#### `resolveDispute(bytes32, bool)`

Resolve a dispute — approve (return to Provisional) or reject (burn tokens).

| Parameter | Type | Description |
|---|---|---|
| `submissionId` | `bytes32` | Disputed submission |
| `approved` | `bool` | `true` = resume, `false` = reject and burn |

**Access:** `VERIFIER_ROLE`  
**Requires:** Status = `Disputed`  
**Emits:** `DisputeResolved`  
**Errors:** `InvalidStatus`

### 3.3 Read Functions

| Function | Returns | Description |
|---|---|---|
| `getSubmission(bytes32)` | `Submission` | Full submission details |
| `getSubmissionCount()` | `uint256` | Total registered submissions |
| `getSubmissionIdAtIndex(uint256)` | `bytes32` | Submission ID by index |
| `lockedBalance(address)` | `uint256` | Non-transferable token balance |
| `unlockedBalanceOf(address)` | `uint256` | Freely transferable balance |
| `balanceOf(address)` | `uint256` | Total token balance (ERC-20) |
| `vestingDuration()` | `uint256` | Vesting period in seconds |
| `VERIFIER_ROLE()` | `bytes32` | Role identifier |
| `DISPUTER_ROLE()` | `bytes32` | Role identifier |
| `hasRole(bytes32, address)` | `bool` | Role membership check |

### 3.4 Events

```solidity
event SubmissionRegistered(
    bytes32 indexed submissionId,
    address indexed beneficiary,
    uint256 creditAmount,
    string metadataURI
);

event CreditProvisional(
    bytes32 indexed submissionId,
    address indexed beneficiary,
    uint256 amount
);

event CreditReleased(
    bytes32 indexed submissionId,
    address indexed beneficiary,
    uint256 amount
);

event SubmissionDisputed(
    bytes32 indexed submissionId,
    address indexed disputedBy,
    string reason
);

event DisputeResolved(
    bytes32 indexed submissionId,
    bool approved,
    address indexed resolvedBy
);
```

### 3.5 Submission ID Convention

The on-chain `submissionId` is a `bytes32` derived from the backend UUID:

```typescript
// If already a 0x-prefixed 64-char hex, use as-is
if (/^0x[0-9a-fA-F]{64}$/.test(id)) return id;
// Otherwise, hash the string
return keccak256(toUtf8Bytes(id));
```

---

## 4. Contract Management CLI

Interact with the deployed contract via Hardhat:

```bash
# Grant verifier role
BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=grant-verifier \
ROLE_ACCOUNT=0xYOUR_ADDRESS \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia

# Register a submission
BLUE_CARBON_ACTION=register \
SUBMISSION_ID=submission-001 \
METADATA_URI=ipfs://QmCID \
BENEFICIARY_ADDRESS=0xBENEFICIARY \
CREDIT_AMOUNT=100 \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia

# Dispute a submission
BLUE_CARBON_ACTION=dispute \
SUBMISSION_ID=submission-001 \
DISPUTE_REASON="No vegetation increase" \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia

# Release credits
BLUE_CARBON_ACTION=release \
SUBMISSION_ID=submission-001 \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia

# Resolve dispute
BLUE_CARBON_ACTION=resolve \
SUBMISSION_ID=submission-001 \
DISPUTE_APPROVED=true \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia
```

**Available Actions:** `grant-verifier`, `grant-disputer`, `register`, `release`, `dispute`, `resolve`

---

## 5. Error Codes Reference

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | `422` | Request body fails schema validation |
| `SUBMISSION_NOT_FOUND` | `404` | Backend record absent or contract `SubmissionNotFound` |
| `SUBMISSION_ALREADY_EXISTS` | `409` | Duplicate submission ID |
| `INVALID_STATUS_TRANSITION` | `409` | Action not allowed in current status |
| `VESTING_NOT_ELAPSED` | `409` | Release before vesting period |
| `ZERO_CREDIT_AMOUNT` | `422` | `creditAmount == 0` |
| `ZERO_ADDRESS` | `422` | Zero beneficiary address |
| `CONTRACT_ROLE_DENIED` | `403` | Signer lacks required contract role |
| `SCORING_SERVICE_UNAVAILABLE` | `503` | NDVI scorer unreachable |
| `BLOCKCHAIN_ERROR` | `502` | On-chain transaction failed |
| `INTERNAL_ERROR` | `500` | Unexpected server error |
