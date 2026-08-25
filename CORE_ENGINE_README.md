# Core Engine: scoring-to-registry integration

This document is the hand-off contract for Jan and Arlin. The FastAPI scoring service and Sepolia contract are intentionally separate: the backend evaluates an off-chain score, retains the evidence, then submits the appropriate role-gated contract transaction. It must not use the score alone as evidence of carbon sequestration or automate an irreversible decision without the project's governance review.

## Deployed contract

| Network | Contract | Explorer |
| --- | --- | --- |
| Ethereum Sepolia | `0x815F9122D29471e161D66068Eef9a508EC079442` | [Blockscout verified source](https://eth-sepolia.blockscout.com/address/0x815F9122D29471e161D66068Eef9a508EC079442#code) |

Before backend workflows begin, the admin deployer must grant the operational accounts their roles. `VERIFIER_ROLE` can register and release; `DISPUTER_ROLE` can open disputes. The current deployer is only the default admin, not automatically a verifier/disputer.

```bash
BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=grant-verifier \
ROLE_ACCOUNT=0xYOUR_VERIFIER_ADDRESS \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia

BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=grant-disputer \
ROLE_ACCOUNT=0xYOUR_DISPUTER_ADDRESS \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia
```

Use the private key of the account holding the required role when running each action. The local `.env` file is ignored by Git and supplies `SEPOLIA_RPC_URL` and `PRIVATE_KEY`.

## Scoring endpoint

The FastAPI service is in [`services/ndvi_scoring`](services/ndvi_scoring/README.md). Its field names are provisional until the team provides the locked submission-data contract. Start it locally:

```bash
cd services/ndvi_scoring
.venv/bin/uvicorn app.main:app --reload
```

Call it with the photo's decoded EXIF metadata (not an unverified client assertion):

```bash
curl --request POST http://127.0.0.1:8000/score-submission \
  --header 'content-type: application/json' \
  --data '{
    "latitude": -3.4653,
    "longitude": 114.0917,
    "claimed_planting_date": "2024-01-15",
    "photo_metadata": {
      "gps_latitude": -3.4653,
      "gps_longitude": 114.0917,
      "captured_at": "2024-01-20T09:30:00Z"
    }
  }'
```

It returns this dashboard contract:

```json
{
  "score": 90,
  "confidence_band": "high",
  "flags": [],
  "ndvi_before": 0.18,
  "ndvi_after": 0.56
}
```

OpenAPI is available at `http://127.0.0.1:8000/docs` and `http://127.0.0.1:8000/openapi.json`.

## Orchestration policy

The backend must persist the request, full response, Sentinel request windows, and an evidence URI before any blockchain transaction. Build `submissionId` consistently across all components: the script uses `keccak256(utf8(SUBMISSION_ID))` unless `SUBMISSION_ID` is already a 32-byte `0x…` value.

| Decision | Exact scoring rule | Backend action | Resulting contract state |
| --- | --- | --- | --- |
| Provisional mint | `score >= 75`, `confidence_band == "high"`, and `flags` is empty | Verifier calls `registerSubmission(submissionId, metadataURI, beneficiary, creditAmount)` | `Provisional`; tokens are minted but locked |
| Manual review | Any score or confidence not meeting the mint rule, or any flag | Store evidence; do **not** call `registerSubmission` | No on-chain record/mint |
| Release after re-verification | Existing `Provisional` submission; vesting interval has elapsed; a new score again meets the same clean high-confidence mint rule; a human verifier approves | Verifier calls `releaseCredits(submissionId)` | `Released`; its tokens become transferable |
| Dispute | An already-Provisional submission has a suspicious re-check, credible external challenge, or material evidence conflict | Authorized disputer calls `disputeSubmission(submissionId, reason)` | `Disputed`; it cannot be released |
| Resolve dispute | A human verifier reviews the evidence | `resolveDispute(submissionId, true)` restores `Provisional`; `false` rejects and burns the locked credits | `Provisional` or `Rejected` |

Do not make a direct `Released` mint: the contract deliberately has no such function. `releaseCredits` enforces the configured vesting duration and `VERIFIER_ROLE`; `disputeSubmission` only accepts `Provisional`, so a dispute must be raised before release.

## Contract calls

The callable helper is [`scripts/manage-blue-carbon.ts`](scripts/manage-blue-carbon.ts). It awaits and prints the transaction receipt. Set `PRIVATE_KEY` in `.env` to the role holder for the action.

After a clean high score, submit a provisional mint with an immutable evidence URI:

```bash
BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=register \
SUBMISSION_ID=submission-001 \
METADATA_URI=ipfs://YOUR_EVIDENCE_CID \
BENEFICIARY_ADDRESS=0xYOUR_BENEFICIARY_ADDRESS \
CREDIT_AMOUNT=100 \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia
```

To open a dispute, change `.env` to the private key of a `DISPUTER_ROLE` holder:

```bash
BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=dispute \
SUBMISSION_ID=submission-001 \
DISPUTE_REASON='Re-check found no meaningful vegetation increase' \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia
```

To release after the re-verification policy passes and the vesting period has elapsed, use a `VERIFIER_ROLE` key:

```bash
BLUE_CARBON_CREDIT_ADDRESS=0x815F9122D29471e161D66068Eef9a508EC079442 \
BLUE_CARBON_ACTION=release \
SUBMISSION_ID=submission-001 \
npx hardhat run scripts/manage-blue-carbon.ts --network sepolia
```

## Phase 2 delivery status

- FastAPI `POST /score-submission`, OpenAPI docs, Sentinel-2/CDSE provider, NDVI rules, EXIF checks: complete.
- Live CDSE smoke test: complete; the service returned a valid structured response from Sentinel imagery.
- Unit/API tests: 5 passing.
- Final schema mapping from the team's locked data contract: pending team input. Update `ScoreSubmissionRequest` and this document when it arrives.
