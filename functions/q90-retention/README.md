# q90-retention — server-side generation boundary (design + unit-tested module, NOT wired)

Status: **not exported from `functions/index.js`, not deployed, default OFF.**
This directory is a self-contained CommonJS module with zero new dependencies
(`firebase-admin` is injected by the caller; tests use an in-memory fake).

Contract source: Q90-LEGACY-PRESERVE-RC02 (P01–P19). Paths agreed with W (3821629):

```
reportInstances/{uid}/{sid}/{instanceId}     client read: uid-scoped (published only)   client write: false
programInstances/{uid}/{sid}/{instanceId}    client read: uid-scoped (published only)   client write: false
generationConsents/{uid}/{consentEventId}    client read: uid-scoped, client write: false (W rules v3; server records)
generationLocks/{lockKey}                    client read/write: false
generationStaging/{lockKey}                  client read/write: false   (accepted by W, rules patch v3)
```

## What the module does

`createRetention(deps)` returns four operations. Every operation takes the **verified token uid**
from the caller (`request.auth.uid`), never a uid from the body. `featureEnabled` defaults to OFF
for every operation, including consent recording.

| op | contract | notes |
|----|----------|-------|
| `recordConsent(uid, event)` | P16 | whitelisted `disclosureVersion`/`locale`, `actorUid === uid`, boolean-only rejected, must cover report+program; **create-once** transaction, id salted with a nonce so same-ms consents never collide |
| `resolveEntitlement(uid, sid)` | P15 + W 3821811 | **fail closed.** `payments/{uid}/paid` alone never suffices. See "Entitlement sources" — uses the real `additionalPayments` schema (`paid/status/consumedBySid`) and requires the entry to be **consumed by this sid** |
| `planGeneration(uid, req)` | P02/P03/P05/P07/P18 | cohort **and entrypoint** from the server record only; same-bundle re-generation reproduces the cohort entrypoint, upgrade/first use `regeneration`; `priorInstanceId` comes from the consent record and the request may not contradict it; session hash frozen for TOCTOU re-check |
| `generateInstancePair(uid, req)` | P08/P13/P17 | fenced lock state machine (below); report+program built into `generationStaging/{lockKey}/{attempt}`, fence commits the lock to `complete`, then **one multi-location publish**; recovery path re-publishes from staging if the publish step crashed |

Never reads-for-write or writes `reports/`, `programs/`, `payments/`, `users/`. Legacy read paths untouched (P01/P14).

## Fencing (why "read lock then update" was not enough)

Reviewer counterexamples 1–3 (3824089) showed the first version could publish two pairs, regress a
complete lock to `attempt 1`, or reclassify a successful publish as failed because a log call threw.
The rewrite makes `attempt` a fencing token:

```
acquire   : transaction  null|failed|stale-pending  -> pending(attempt=n+1)
build     : staging/{lockKey}/{n}  (client-invisible)
fence     : transaction  pending(attempt==n) -> complete(attempt=n, instanceId)   <- loser aborts, publishes nothing
publish   : one update   reportInstances + programInstances + staging/{lockKey}=null
fail      : transaction  pending(attempt==n) -> failed(attempt=n)                  <- loser leaves lock untouched
recover   : complete lock + doc missing + staging/{lockKey}/{attempt} present -> publish again (idempotent)
```

A `complete` lock is never written by any later transaction (every transition requires `pending`).
Logging is wrapped so it can never change an outcome. The runner must echo the requested
`bundleVersion` and `entrypoint` and return 64-hex hashes, or the attempt fails closed.

## Why a staging node

W's rule shape gives the uid read access to everything under `reportInstances/{uid}/…`. If a half-built
instance were written there while the program half was still running, a client could observe a report
without its program pair (P13 violation). So: build both under `generationStaging/{lockKey}/{attempt}`
(client-invisible), fence the lock to `complete`, then publish with **one** multi-location update
containing exactly three paths — `reportInstances/{uid}/{sid}/{id}`, `programInstances/{uid}/{sid}/{id}`,
`generationStaging/{lockKey} = null`. The lock is not part of the publish update (it was already fenced).
Failure at any point leaves nothing under the public nodes. W accepted the staging path (rules v3,
read/write false); W's emulator case shows rules do not block such a multi-path admin update — RTDB
atomicity of the update itself is a platform property, not something these tests or rules prove.

## Success means "pair visible", not "lock complete" (C1)

A `complete` lock only says a winner was decided. Every success return — first publish, idempotent reuse,
recovery, or a superseded attempt returning the winner — goes through `assertPublishedPair`, which
requires both public docs to exist for this uid/sid/instance, share `bundleVersion` and `bundleHash`, and
the program to point at the report (`sourceReportInstanceId`, `reportOutputHash`). Otherwise the caller
gets: a recovery publish from staging when the artifact is there; `GENERATION_IN_PROGRESS` while the
winner is fresh; `LOCK_COMPLETE_WITHOUT_ARTIFACT` after TTL; `PUBLISHED_PAIR_INCONSISTENT` when the docs
disagree. None of these paths rewrite an existing doc.

## Immutable input snapshot (C2)

`planGeneration` copies `responses/{uid}/{sid}` once (`inputSnapshot`, hash `inputSnapshotHash`). The
engine consumes **only that snapshot** — never a fresh read — so a mid-run edit cannot leak into the
output. Immediately before the fence, the live `responses` node is compared to the snapshot hash and the
entitlement is resolved again; a change or a revoked/re-bound entitlement fails the attempt
(`SESSION_CHANGED` / `ENTITLEMENT_REVOKED`) with nothing published. The published docs carry
`inputSnapshotHash` + `inputSnapshotAt` so a reader can tell which responses the instance reflects.
This is a snapshot policy with change detection, not a claim of atomicity between `responses` and the
instance nodes — a write that lands between the pre-publish check and the publish update is detectable
afterwards (hash mismatch) but not prevented.

## Entitlement sources (fail closed)

W reproduced (emulator, synthetic uid) that an authenticated user can write the *first*
`payments/{uid} = {paid:true}` themselves. The real `additionalPayments` schema (from
`functions/index.js`) is `{paid:true, status:"unused"|"consumed", consumedBySid, provider, source, orderID,
captureID, oid, payerId, env, amount, currency, ...}`; there is no `captured` status. Writers differ in trust:
`captureAdditionalPaypalOrder` (PayPal capture confirmed server-side) and `confirmAdditionalPayplePayment`
(`source:"payple-cpay"`, Payple server confirm) record provider-confirmed entries; `issuePaypleAdditionalToken`
(`source:"payple-link"`) trusts client-writable `payments/paid` + client `intentTs` and is **not** one.

Accepting a ledger entry is a **policy decision**, not a provider re-check. The deploying environment must
inject `ledgerPolicy` (`acceptedEnvs`, `acceptedCurrencies`, `minAmount`, `acceptedPaypalMerchantIds`,
`acceptedPaypleCstIds`); the module default accepts nothing, so `env:"sandbox"|"test"`, a missing env,
a foreign currency, a zero/garbage amount or an unknown merchant all close the path (C3).

| evidence | accepted? | why |
|----------|-----------|-----|
| `payments/{uid}/paid === true` alone | **no** | client-writable first write |
| `payments/{uid}` with `provider`/`orderID`/`captureID` strings | **no** | still client-writable strings |
| `payments/{uid}` **re-verified** against the provider from the server (`deps.verifyProviderCapture` → `{status:"verified", reference}`) | yes | verifier is injected and **not implemented here**; default returns `unavailable` ⇒ closed |
| `additionalPayments/{uid}/*` provider-confirmed writer shape (paypal captureID+orderID, or payple-cpay oid+payerId) **and** passes `ledgerPolicy` **and** `status:"consumed"` **and** `consumedBySid === sid` | yes | server-only ledger, production policy, bound to the session being regenerated |
| `additionalPayments` `unused` (any provider) | **no** | a purchase for a future assessment, not evidence for this sid |
| `additionalPayments` consumed by another sid | **no** | not this session's right |
| `additionalPayments` `source:"payple-link"` | **no** | issued on client-trusted inputs |
| `additionalPayments` with non-production `env`, wrong currency/amount/merchant | **no** | policy closed |
| `q90Entitlements/{uid}` `{status:"verified", source}` (server-only, W rules v3) | yes | no writer exists yet — the approved migration is a separate order under the payment-rights legal gate |

**Explicitly incomplete:** a normal first-time purchaser whose only record is `payments/{uid}` cannot
be upgraded until either the provider re-verification or the `q90Entitlements` migration exists. The
module returns `ENTITLEMENT_UNVERIFIED` / `ENTITLEMENT_NONE` and the caller must keep serving the legacy
saved report. No entitlement is ever removed, reclassified, or written by this module.

## What the tests prove / do not prove

`node --test functions/q90-retention/test/retention.test.js` — 53 tests over an **in-memory fake** of the
RTDB Admin SDK (`once/set/update/transaction`, multi-path update, injectable failures and interleavings).
Reviewer counterexamples reproduced as regressions: 3824089 (1–7) and 3824741 C1 (winner complete but
unpublished when another caller's acquire aborts → recovery, never bare success; report-only; inconsistent
pair; fresh vs stale winner), C2 (mid-run answer edit → engine saw the snapshot, `SESSION_CHANGED`,
nothing published; entitlement revoked mid-run), C3 (default policy accepts nothing; sandbox/test env,
currency, amount, merchant). Mutations checked by hand: removing the fence condition fails reviewer-1;
returning bare `reused` on a complete lock fails C1; dropping the pre-publish hash check fails C2.

They prove the module's decision logic and write ordering against the fake — **not** real RTDB
transaction semantics, rules enforcement, Functions auth, cold-start behaviour, or emulator results.
**Real RTDB verification is not done.** The emulator matrix (P17: two-tab race, retry, mid-failure,
stale lock, rules interplay) belongs with X and is still open.

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
