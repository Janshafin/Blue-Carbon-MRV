# Blue Carbon MRV — Complete End-to-End System

Blockchain-Based Blue Carbon Registry &amp; Measurement, Reporting, and Verification (MRV) System for mangrove restoration.

---

## 🌊 Pipeline Architecture

```
USER
  ↓
React PWA Frontend (Vite + TypeScript)
  ↓
Submission API (POST /api/submissions with multipart/form-data)
  ↓
Photo + GPS + Planting Metadata + Beneficiary Wallet
  ↓
Database Persistence (SQLite + SQLAlchemy non-volatile storage)
  ↓
Photo Storage (Collision-safe filename, path-traversal protection, EXIF extraction)
  ↓
Satellite Imagery API (Copernicus Sentinel-2 CDSE / Deterministic MOCK_NDVI)
  ↓
NDVI Vegetation Analysis (Planting window baseline vs Recent monitoring window)
  ↓
MRV Scoring Engine (Vegetation change + EXIF location/timestamp consistency checks)
  ↓
Eligibility Decision (Score >= 75, High Confidence, 0 Flags)
  ↓
Blockchain Registry Transaction (Web3.py verifier signing)
  ↓
Ethereum Sepolia Testnet (BlueCarbonCredit Contract: 0x815F9122D29471e161D66068Eef9a508EC079442)
  ↓
Transaction Hash & Verification Result
  ↓
Live Registry UI (GET /api/registry)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on v22)
- **Python**: 3.10+ (tested on 3.12)
- **npm** or **pnpm**

### 2. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```

Default local development settings in `.env`:
```ini
MOCK_NDVI=true
VITE_API_URL=http://localhost:8000
DATABASE_URL=sqlite:///data/blue_carbon.db
SEPOLIA_RPC_URL=https://rpc.sepolia.org
CONTRACT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442
```

### 3. Install Dependencies

#### Backend (Python):
```bash
python -m pip install -r services/ndvi_scoring/requirements.txt
python -m pip install web3 pillow
```

#### Frontend (Node):
```bash
npm install
```

### 4. Running Locally

#### Terminal 1 — Start FastAPI Backend:
```bash
python -m uvicorn services.ndvi_scoring.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API root: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

#### Terminal 2 — Start Vite React Frontend:
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Live Registry: `http://localhost:5173/registry`
- Field Submission: `http://localhost:5173/submit`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/submissions` | Multipart form submission (photo, latitude, longitude, planting_date, species, ngo_id, wallet_address) |
| `GET` | `/api/submissions/{id}` | Complete state of a submission including verification and blockchain status |
| `GET` | `/api/submissions/{id}/verification` | Verification status, NDVI before/after/change, score, confidence, flags, blockchain status, tx hash |
| `GET` | `/api/registry` | Verified and provisionally credited projects for the live registry UI |
| `GET` | `/api/evidence/{id}` | Deterministic public evidence metadata JSON (no private paths) |
| `GET` | `/api/evidence/{id}/photo` | Secure photo retrieval with path-traversal protection |
| `GET` | `/api/health` | Service health, database status, satellite mode, and blockchain verifier configuration |
| `POST` | `/score-submission` | Backward-compatible direct NDVI scoring endpoint |

---

## 🛰️ Satellite Engine & MOCK_NDVI Modes

### Mode 1: Development / Hackathon Mode (`MOCK_NDVI=true`)
When `MOCK_NDVI=true`, the engine simulates deterministic, realistic Sentinel-2 vegetation indices:
- Baseline NDVI (~0.18 - 0.25) during planting window
- Restored canopy NDVI (~0.52 - 0.65) during recent monitoring window
- Explicitly labels data with `is_simulated: true` so mock data is never misrepresented as real telemetry.

### Mode 2: Live Copernicus CDSE Mode (`MOCK_NDVI=false`)
When `MOCK_NDVI=false`, the engine queries the Copernicus Data Space Ecosystem Sentinel-2 L2A archive:
- Requires `COPERNICUS_CLIENT_ID` and `COPERNICUS_CLIENT_SECRET`.
- Multi-spectral evaluation script calculates:
  $$NDVI = \frac{B08 - B04}{B08 + B04}$$
- Filters out cloud cover and missing pixels.
- Gracefully reports provider errors without crashing the service.

---

## ⛓️ Smart Contract & Sepolia Integration

- **Contract Name**: `BlueCarbonCredit` (ERC-20 + AccessControl)
- **Token**: `BCC` (18 decimals)
- **Network**: Ethereum Sepolia Testnet
- **Deployed Address**: [`0x815F9122D29471e161D66068Eef9a508EC079442`](https://eth-sepolia.blockscout.com/address/0x815F9122D29471e161D66068Eef9a508EC079442#code)
- **Lifecycle**: `Registered` → `Provisional` (locked vesting) → `Released` (tradeable) / `Disputed`
- **Security**: The backend securely signs role-gated transactions server-side using `VERIFIER_PRIVATE_KEY`. Private keys are **never** sent to or exposed in the frontend.

---

## 🧪 Testing

Run backend unit and integration tests:
```bash
python -m pytest services/ndvi_scoring/tests
```

Build and validate the frontend bundle:
```bash
npm run build
```

Run smart contract test suite:
```bash
npx hardhat test
```
