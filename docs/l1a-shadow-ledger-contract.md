# L1A shadow ledger contract

- Target/unverified schema only.
- No Functions export, runtime writer, database rules, payment client, or deployment change.
- Synthetic fixtures only; no customer/payment/provider values.
- Reducer models append-only idempotency in memory and never writes to a backend.
- Activation requires a later external-verifier-backed contract and provider sandbox/reconciliation evidence.
