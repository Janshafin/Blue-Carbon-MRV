# Blue Carbon MRV live demo script

Use this only after the deployment checklist in the README is complete. Do not
claim a live NDVI or on-chain result unless the relevant URL and transaction
have been verified immediately before presenting.

## Pre-demo checklist

1. Open the production submission page in a private browser window and confirm
   there are no console errors.
2. Open the production dashboard in a separate tab and confirm it shows at
   least four real Supabase rows: two clean, two flagged.
3. Open the Sepolia contract on Blockscout and Etherscan. Keep the contract
   address, a seeded `SubmissionRegistered` transaction, and the source-code
   verification page ready in tabs.
4. Keep one pre-scored clean claim, one pre-scored flagged claim, and their
   dashboard rows ready. Do not enter data live.
5. Record a 60–90 second backup clip of this same sequence and save screenshots
   of the dashboard queue, score response, and transaction receipt.

## Click-through order (about three minutes)

1. **Homepage:** State the problem in one sentence: restoration evidence is
   checked against satellite imagery before credits become tradeable. Point to
   the Sepolia contract link in the footer.
2. **Submission page:** Open the already-completed clean claim. Show the photo,
   captured coordinates, planting date, and the persisted submission ID. Open
   its score response and call out the Sentinel-2 NDVI before/after values,
   high confidence, and no flags.
3. **Dashboard queue:** Refresh the page. Find the clean claim and the flagged
   claim. Explain the distinct flags on the suspicious claim (for example, no
   meaningful vegetation increase or EXIF/GPS mismatch).
4. **Approve the clean claim:** Connect the verifier wallet, approve the
   pre-scored clean claim, confirm the MetaMask transaction, then open the
   resulting Sepolia transaction. Show `SubmissionRegistered` and
   `CreditProvisional`; refresh the dashboard to show its stored transaction
   hash and approved status.
5. **On-chain state:** Open `getSubmission` or the event log for the same
   submission ID. Explain that the credit is provisional and locked for the
   vesting period, not tradeable yet.
6. **Flagged claim:** Open the suspicious record. Show its flags and explain it
   remains in manual review rather than being auto-minted. If the dispute flow
   is deployed, dispute it, show the event, then resolve it with the verifier
   wallet and show the final state.
7. **Close:** Return to the dashboard and state that each claim has persisted
   data, source imagery evidence, and an auditable on-chain lifecycle.

## Fallback

If a wallet, RPC, or internet request fails, say that the live endpoint is
unavailable rather than continuing with local/demo data. Play the backup clip
and show the date-stamped screenshots of the same seeded records and Sepolia
transaction.
