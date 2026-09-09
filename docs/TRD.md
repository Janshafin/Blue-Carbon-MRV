# Technical Requirements Document (TRD)

## Blue Carbon MRV — Blockchain Registry & Verification Platform

> **Version**: 1.0  
> **Date**: 2026-08-28  
> **Owner**: Jan Shafin  
> **Domain**: SIH / Ministry of Earth Sciences / NCCR

---

## 1. Executive Summary

Blue Carbon MRV is a **blockchain-based carbon credit registry** that transparently verifies mangrove restoration claims using Sentinel-2 satellite imagery (NDVI analysis), EXIF-validated field evidence, and a role-gated ERC-20 smart contract lifecycle on Ethereum Sepolia. Credits are minted as **non-transferable provisional tokens**, and only become tradeable after vesting, re-verification, and human approval — ensuring every credit represents verifiable restoration activity.

---

## 2. System Overview

The platform consists of four integrated sub-systems:

| Sub-System | Purpose |
|---|---|
| **Smart Contract (Core Engine)** | On-chain credit lifecycle — mint, lock, release, dispute, burn |
| **NDVI Scoring Service** | Satellite plausibility scoring via Sentinel-2 + EXIF cross-checks |
| **Backend API** | Persistence, orchestration, evidence pinning (Supabase + Pinata IPFS) |
| **Web Frontend** | Landing page, field submission form, NCCR admin dashboard |

---

## 3. Functional Requirements

### 3.1 Submission & Field Evidence

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | NGO field teams must capture GPS coordinates (latitude, longitude, accuracy) via browser Geolocation API | P0 |
| FR-02 | Users must upload a site photo (JPG/PNG, ≤ 10 MB) with drag-and-drop or file picker | P0 |
| FR-03 | Users must enter planting date (not future-dated), mangrove species, and NGO ID | P0 |
| FR-04 | Submission form must validate all inputs with Zod schemas before submission | P0 |
| FR-05 | Evidence (photo, geolocation, scoring results) must be pinned to IPFS via Pinata before on-chain registration | P0 |

### 3.2 NDVI Plausibility Scoring

| ID | Requirement | Priority |
|---|---|---|
| FR-06 | The scoring service must query Sentinel-2 L2A imagery via CDSE (Copernicus Data Space Ecosystem) | P0 |
| FR-07 | NDVI must be computed for two windows: near the claimed planting date and the most recent 30-day period | P0 |
| FR-08 | EXIF GPS must be cross-checked against claimed coordinates (> 1 km → flag) | P0 |
| FR-09 | EXIF timestamp must be within 45 days of claimed planting date | P0 |
| FR-10 | Scoring must produce an integer score (0–100), confidence band (low/medium/high), flags array, and NDVI before/after values | P0 |
| FR-11 | Results of `sentinel_imagery_unavailable` must be treated as a valid scored result with a flag, not a system failure | P1 |

### 3.3 Smart Contract Lifecycle

| ID | Requirement | Priority |
|---|---|---|
| FR-12 | `registerSubmission()` must mint provisional (locked) BCC tokens to the beneficiary | P0 |
| FR-13 | Provisional tokens must be **non-transferable** — the `_update()` override must block transfers beyond unlocked balance | P0 |
| FR-14 | `releaseCredits()` must enforce vesting duration (600s demo / 6–24 months production) and `VERIFIER_ROLE` | P0 |
| FR-15 | `disputeSubmission()` must only accept `Provisional` submissions and require `DISPUTER_ROLE` | P0 |
| FR-16 | `resolveDispute(approved=false)` must burn locked tokens and set status to `Rejected` | P0 |
| FR-17 | On-chain submissions must be enumerable (`getSubmissionCount()`, `getSubmissionIdAtIndex()`) | P1 |

### 3.4 Orchestration Policy

| ID | Requirement | Priority |
|---|---|---|
| FR-18 | Auto-provisional mint when: score ≥ 75, confidence = "high", flags = empty | P0 |
| FR-19 | Manual review when score/confidence does not meet the mint rule, or any flag is present | P0 |
| FR-20 | Backend must persist request, full scoring response, Sentinel request windows, and IPFS evidence URI **before** any blockchain transaction | P0 |

### 3.5 Admin Dashboard (NCCR Registry Console)

| ID | Requirement | Priority |
|---|---|---|
| FR-21 | KPI cards: Pending Review, Approved, Flagged Submissions, Open Disputes | P0 |
| FR-22 | Review queue table with docket ID, project, region, type, submission date, score bar, flag indicator | P0 |
| FR-23 | Submission detail view with NDVI before/after comparison slider, composite score gauge, score breakdown | P0 |
| FR-24 | Approve/Reject seal stamps that trigger on-chain `registerSubmission()` via MetaMask | P0 |
| FR-25 | Dispute button triggering on-chain `disputeSubmission()` via MetaMask | P0 |
| FR-26 | Wallet connection (MetaMask) with Sepolia chain switch | P0 |

---

## 4. Non-Functional Requirements

| ID | Requirement | Category | Target |
|---|---|---|---|
| NFR-01 | Smart contract must pass all 22 Hardhat tests (deployment, registration, vesting, disputes, access control, edge cases) | Reliability | 100% pass |
| NFR-02 | NDVI scoring endpoint must respond within 60 seconds (Sentinel-2 imagery fetch is the bottleneck) | Performance | ≤ 60s |
| NFR-03 | Vercel serverless functions must complete within 60 seconds | Performance | ≤ 60s |
| NFR-04 | Web frontend must be responsive down to 360px viewport width | Usability | Mobile-first |
| NFR-05 | All environment secrets (`.env`, `.env.local`) must be git-ignored | Security | Enforced |
| NFR-06 | Supabase RLS must be enabled on all tables | Security | Enforced |
| NFR-07 | Smart contract must pass Slither static analysis without high-severity findings | Security | Zero high/critical |
| NFR-08 | Contract must support ERC-165 interface detection | Standards | ERC-165 compliant |
| NFR-09 | The system must respect `prefers-reduced-motion` for all animations | Accessibility | WCAG 2.1 AA |

---

## 5. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Smart Contract** | Solidity + OpenZeppelin (ERC-20, AccessControl) | 0.8.28 |
| **Contract Tooling** | Hardhat 3 + hardhat-toolbox-viem | ^3.14.0 |
| **Testnet** | Ethereum Sepolia | — |
| **NDVI Scoring** | FastAPI + Sentinel Hub (CDSE) + NumPy | Python 3.10+ |
| **Backend API** | FastAPI + httpx | Python 3.10+ |
| **Database** | Supabase (PostgreSQL) | — |
| **Evidence Storage** | Pinata (IPFS) | — |
| **Frontend** | React 19 + TypeScript + Vite 6 | ^19.1.0 |
| **Form Handling** | react-hook-form + Zod | ^7.86.0 |
| **Blockchain Client** | ethers.js v6 (browser) / viem (scripts) | ^6.17.0 |
| **Deployment** | Vercel (web + serverless Python) | — |
| **Security Analysis** | Slither + solc-select | — |

---

## 6. Integration Points

```
┌─────────────────┐     POST /score-submission     ┌─────────────────────┐
│                 │ ──────────────────────────────► │                     │
│  Backend API    │                                 │  NDVI Scoring       │
│  (FastAPI)      │ ◄────────────────────────────── │  (FastAPI + CDSE)   │
│                 │     ScoreSubmissionResponse      │                     │
└────────┬────────┘                                 └─────────────────────┘
         │
         │  REST (httpx)                    ┌───────────────────┐
         ├─────────────────────────────────►│  Supabase (Pg)    │
         │  Supabase REST API               └───────────────────┘
         │
         │  POST /pinning/pinJSONToIPFS     ┌───────────────────┐
         ├─────────────────────────────────►│  Pinata (IPFS)    │
         │                                  └───────────────────┘
         │
         │  JSON-RPC (Sepolia)              ┌───────────────────┐
         └─────────────────────────────────►│  BlueCarbonCredit │
                                            │  Smart Contract   │
┌─────────────────┐     MetaMask + ethers   └───────────────────┘
│  Web Frontend   │ ──────────────────────────────────┘
│  (React + Vite) │
└─────────────────┘
```

---

## 7. Constraints & Assumptions

1. **Testnet Only** — All BCC tokens are on Sepolia. They have **no monetary value**.
2. **Demo Vesting** — The vesting duration defaults to 600 seconds (10 minutes). Production deployments should set 6–24 months.
3. **No Authentication** — The backend and Supabase currently use open (demo) RLS policies. Production requires JWT-based authentication.
4. **Scoring ≠ Proof** — NDVI scoring is explainable triage, not proof of sequestration. All flagged submissions must be reviewed manually.
5. **Evidence Immutability** — Once pinned to IPFS and referenced on-chain via `metadataURI`, evidence cannot be altered.
6. **Schema Provisional** — The NDVI scoring request schema is provisional pending the team's locked submission-data contract.
