# 🌊 Blue Carbon MRV — Blockchain Registry & Verification

A **Blockchain-Based Blue Carbon Credit Registry** with AI-driven NDVI plausibility scoring, built for transparent and auditable carbon credit lifecycle management.

## Architecture

```mermaid
graph TD
    subgraph Core Engine
        SC["BlueCarbonCredit.sol<br/>(ERC-20 + AccessControl)"]
        AI["NDVI Plausibility Scorer<br/>(Part 2 — AI Service)"]
    end

    subgraph Sub-Teams
        MOB["Mobile App"]
        DASH["Admin Dashboard"]
        BACK["Backend / Infra"]
    end

    MOB -->|"submits plantation data"| BACK
    BACK -->|"calls registerSubmission()"| SC
    AI -->|"verifies NDVI score"| BACK
    SC -->|"emits events"| DASH
    DASH -->|"reads on-chain state"| SC