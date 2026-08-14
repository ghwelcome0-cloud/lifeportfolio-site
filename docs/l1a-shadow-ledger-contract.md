# L1A shadow ledger contract

- Target/unverified schema only.
- No consumer imports this new shadow contract; no Functions export/call, database rule, or payment client wires it to runtime. Existing payment writers elsewhere in the repository are unchanged and are not claimed absent.
- Synthetic fixtures only; no customer/payment/provider values.
- Reducer models append-only idempotency in memory and never writes to a backend.
- Activation requires a later external-verifier-backed contract and provider sandbox/reconciliation evidence.
