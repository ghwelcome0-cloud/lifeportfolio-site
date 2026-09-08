# q90-retention — server-side generation boundary (design + unit-tested module, NOT wired)

Status: **not exported from `functions/index.js`, not deployed, default OFF.**
This directory is a self-contained CommonJS module with zero new dependencies
(`firebase-admin` is injected by the caller; tests use an in-memory fake).

Contract source: Q90-LEGACY-PRESERVE-RC02 (P01–P19). Paths agreed with W (3821629):

```
reportInstances/{uid}/{sid}/{instanceId}     client read: uid-scoped (published only)   client write: false
programInstances/{uid}/{sid}/{instanceId}    client read: uid-scoped (published only)   client write: false
generationConsents/{uid}/{consentEventId}    client read/write: false (server records)
generationLocks/{lockKey}                    client read/write: false
generationStaging/{lockKey}                  client read/write: false   (accepted by W, rules patch v3)
```

## What the module does

`createRetention(deps)` returns four pure-ish operations. Every operation takes the
**verified token uid** from the caller (`request.auth.uid`), never a uid from the body.

| op | contract | notes |
|----|----------|-------|
| `recordConsent(uid, event)` | P16 | validates shape, stamps `serverTimestamp`, refuses boolean-only consent, refuses `actorUid !== uid` |
| `resolveEntitlement(uid)` | P15 + W 3821811 | **fail closed.** `payments/{uid}/paid` alone is never sufficient (client can write the first `paid:true`). See "Entitlement sources". |
| `planGeneration(uid, req)` | P02/P03/P05/P07 | resolves cohort/version from server data only; unknown/unverified legacy cohort → `LEGACY_VERSION_UNRESOLVED`; upgrade requires a recorded consent event |
| `generateInstancePair(uid, req)` | P08/P13/P17 | idempotent; lock `pending → complete|failed` via RTDB transaction; report + program written to **staging**, then published to both instance nodes with **one multi-location `update()`** (all-or-nothing) |

Never reads or writes `reports/`, `programs/`, `payments/` (write), or `users/`.
Legacy read paths are untouched (P01/P14).

## Why a staging node

W's rule shape gives the uid read access to everything under
`reportInstances/{uid}/…`. If a half-built instance were written there while the program
half was still running, a client could observe a report without its program pair (P13
violation). So: build both under `generationStaging/{lockKey}` (client-invisible), then
publish with a single atomic multi-path update that also flips the lock to `complete`.
Failure at any point leaves nothing under the public nodes. W accepted this path (rules v3,
read/write false) and added an emulator case showing the 4-path atomic publish is allowed.

## Entitlement sources (fail closed)

W reproduced (emulator, synthetic uid) that an authenticated user can write the *first*
`payments/{uid} = {paid:true}` themselves. Therefore:

| evidence | accepted? | why |
|----------|-----------|-----|
| `payments/{uid}/paid === true` alone | **no** | client-writable first write |
| `payments/{uid}` with `provider`, `orderID`, `captureID` strings | **no** | still client-writable strings |
| `payments/{uid}` **re-verified** against the provider from the server (`deps.verifyProviderCapture`) | yes, when the verifier returns a match | verifier is an injected dependency, **not implemented here** — the default verifier returns `unavailable`, so this path is closed until PayPal/Payple server lookups are wired and reviewed |
| `additionalPayments/{uid}/*` with server-only write (`.write:false`) and `status: "captured"` | yes | server-only ledger, but covers *additional* purchases only |
| `q90Entitlements/{uid}` (server-only allowlist, client read/write false — accepted by W, rules v3) | yes | no writer exists yet: the approved migration that would populate it is a separate order under the payment-rights legal gate. Until then this path is empty and first-purchasers stay `ENTITLEMENT_UNVERIFIED` |

**Explicitly incomplete:** a normal first-time purchaser whose only record is
`payments/{uid}` cannot be upgraded until either the provider re-verification or the
`q90Entitlements` migration exists. The module returns `ENTITLEMENT_UNVERIFIED` and the
caller must keep serving the legacy saved report. No entitlement is ever removed,
reclassified, or written by this module.

## What the tests prove / do not prove

`node --test functions/q90-retention/test/retention.test.js` — 29 tests (`assert.*` calls: 39 + 29 `rejects` code checks) over an **in-memory fake**
of the RTDB Admin SDK (`ref().once/set/update/transaction`, multi-path update).
They prove the module's decision logic, idempotency key, lock state machine, consent
validation, entitlement fail-closed matrix and "nothing public on failure" — **not** real
RTDB transaction atomicity, rules enforcement, Functions auth, or emulator behaviour.
Emulator tests (P17: two-tab race, retry, mid-failure, stale lock) are the next step and
belong with X.

## Remaining before wiring (blockers, not this branch)

- W: `generationStaging` / `q90Entitlements` accepted in rules v3 (55/55 on the substituted copy).
  Still open: original `database.rules.json` byte compile (12:125 whitespace) — release stays blocked.
- Owner/W: Functions deploy pipeline (none exists today; `functions-diagnose` is read-only)
  and CODEOWNERS approval for `/functions/`.
- TL: engine execution inside Functions (`deps.runBundle`) — bundles are hosted under
  `assets/js/bundles/**` (branch `q90/retention-bundle`); Functions need a vendored copy or
  a build step that copies the manifest-pinned files into `functions/q90-retention/bundles/`
  and verifies sha256 against `manifest.json` at cold start.
- TL: `functions/index.js` export line (after deploy plan approval).
- X: emulator race/retry/failure matrix; browser/PDF/auth E2E.
