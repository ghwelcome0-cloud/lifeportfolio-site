# q90-retention — server-side generation boundary (design + unit-tested module, NOT wired)

Status: **not exported from `functions/index.js`, not deployed, default OFF.** Integration base
`q90/owner-retention-core` @ f7f49cd (owner core 1861b57 + TL runner 34dccf6); `index.js` is owner-maintained
from that commit on, `runner.js`/`scripts/`/`bundles/`/docs are TL-maintained.
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

`createRetention(deps)` returns five operations. Every operation takes the **verified token uid**
from the caller (`request.auth.uid`) as its first argument, never a uid from the body — the wrapper is
responsible for that verification; the module only rejects malformed/empty uids. `featureEnabled`
defaults to OFF for every generation operation, including consent recording; `readInstancePair` is not
behind the flag (a saved instance keeps serving when generation is off).

| op | contract | notes |
|----|----------|-------|
| `recordConsent(uid, event)` | P16 | whitelisted `disclosureVersion`/`locale`, `actorUid === uid`, boolean-only rejected, must cover report+program; **create-once** transaction, id salted with a nonce so same-ms consents never collide |
| `resolveEntitlement(uid, sid)` | P15 + W 3821811 | **fail closed.** `payments/{uid}/paid` alone never suffices. See "Entitlement sources" — uses the real `additionalPayments` schema (`paid/status/consumedBySid`) and requires the entry to be **consumed by this sid** |
| `planGeneration(uid, req)` | P02/P03/P05/P07/P18 | cohort **and entrypoint** from the server record only; same-bundle re-generation reproduces the cohort entrypoint, upgrade/first use `regeneration`; `priorInstanceId` comes from the consent record and the request may not contradict it; session hash frozen for TOCTOU re-check |
| `generateInstancePair(uid, req)` | P08/P13/P17 | fenced lock state machine (below); report+program built into `generationStaging/{lockKey}/{attempt}`, fence commits the lock to `complete`, then **one multi-location publish**; recovery path re-publishes from staging only after re-validating the **staged** input/entitlement |
| `readInstancePair(uid, sid, instanceId)` | P01 | returns the parsed authoritative `payloadJson` of both docs after full pair validation; independent of the feature flag and of the customer's current `responses`; uid-scoped (`SAVED_INSTANCE_NOT_FOUND` for another uid) |

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
recover   : complete lock + docs missing + staging/{lockKey}/{attempt} present
            -> re-validate staged inputSnapshotHash / entitlementEvidenceHash / flag against LIVE data
            -> publish again (idempotent), else SESSION_CHANGED / ENTITLEMENT_REVOKED / FEATURE_DISABLED
```

A `complete` lock is never written by any later transaction (every transition requires `pending`).

### Cold-cache transaction semantics (FAISE-20260908-Q90-01)

The real Admin SDK runs a `transaction()` update function first against its **local cache guess**, which
is `null` on a fresh client (a Functions cold start), and treats `undefined` as an abort **without a server
round trip**. 521e60f's fence/fail transactions (`cur && cur.state === "pending" && … ? next : undefined`)
therefore aborted on every single-caller first generation with `GENERATION_SUPERSEDED`, leaving the lock
`pending@1` — reproduced by the owner and X on firebase-admin 12.7.0 and 13.10.0 against database-emulator
4.11.2, and hidden by the in-memory fake (which always hands the current value). The fix (1861b57):

- `cur === null → return null` in fence and fail: on the cache guess this requests a server
  compare-and-swap and the function is re-run with the real value; on a genuinely missing node it commits a
  `null → null` no-op, so every fence/fail result is additionally checked with `snapshot.exists()` and the
  expected `instanceId`/`state` — **a null no-op is never interpreted as ownership**.
- No root listener, no read-then-update, no cache priming: the module holds no subscriptions; each lock
  transaction is self-contained.
- `acquire` keeps its `undefined` abort only for the real "complete" / fresh-pending cases; those are reached
  after the server value is known because the initial `null` guess falls into the create branch and is then
  re-run by the SDK when the server disagrees.
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
recovery, or a superseded attempt returning the winner — goes through `assertPublishedPair` →
`validatePair`, which requires both public docs to exist for this uid/sid/instance, decode per the payload
scheme below, share every common metadata field, and the program to point at the report
(`sourceReportInstanceId`, `reportBundleVersion`, `reportOutputHash`). Otherwise the caller gets: a recovery
publish from staging when the artifact is there and still valid; `GENERATION_IN_PROGRESS` while the winner
is fresh and nothing is visible; `LOCK_COMPLETE_WITHOUT_ARTIFACT` after TTL; `PUBLISHED_PAIR_INCONSISTENT`
when the docs disagree **or only one of the two exists** (a partial pair is never "in progress" and is never
completed by writing the missing half). None of these paths rewrite an existing doc.

## Payload scheme: `payloadJson` is authoritative (`q90-cjson-v1`)

RTDB drops `null`, `{}` and `[]`, may return arrays as index-keyed objects and does not keep key order, so
`sha256(JSON.stringify(readBackObject))` never equals a hash taken before the write (owner/X reproduced this
on the real emulator with both the stub and the real engines). New instances therefore store:

- `payloadJson` — canonical JSON string (recursively sorted keys, `null`/empty containers preserved,
  finite numbers only), `payloadFormat: "q90-cjson-v1"`, `outputHash = sha256(payloadJson)`.
- `report` / `program` object — the RTDB **compatibility view** of the same payload, for tooling and the
  existing uid-scoped read rules. It is never the rendering or hashing source.
- Readers MUST `JSON.parse(payloadJson)` after checking format + hash (that is what `readInstancePair`
  returns). Validation also projects both the parsed string and the stored view through the same RTDB
  projection and requires equality, so editing either one fails closed.
- `inputSnapshotHash` (`inputHashFormat: "q90-cjson-v1"`) and `entitlementEvidenceHash` use the same
  canonical form. Legacy `reports/`/`programs/` hashes are never recomputed or migrated.

## Recovery re-validates the original request, not a fresh plan

Owner counterexample (3825516 #1): publish transport fails → lock `complete` + staging present → customer
changes an answer → retry built a fresh plan (which validated) and then published the **old** staged
payload. `publishFromStaging` now requires the staged docs to validate as a pair, to match the plan's
`inputSnapshotHash`/locale/entrypoint/consent/prior, and the LIVE `responses` and entitlement to hash to the
**staged** `inputSnapshotHash` / `entitlementEvidenceHash`, with the feature still enabled. Otherwise
`SESSION_CHANGED` / `ENTITLEMENT_REVOKED` / `FEATURE_DISABLED` and the staged artifact is left in place.
If the docs are already visible, their `payloadJson` must equal the staged strings or the call is
`PUBLISHED_PAIR_INCONSISTENT` — still no overwrite.

## Immutable input snapshot (C2)

`planGeneration` copies `responses/{uid}/{sid}` once (`inputSnapshot`, hash `inputSnapshotHash`). The
engine consumes **only that snapshot** — never a fresh read — so a mid-run edit cannot leak into the
output. Immediately before the fence, the live `responses` node is compared to the snapshot hash and the
entitlement is resolved again; a change or a revoked/re-bound entitlement fails the attempt
(`SESSION_CHANGED` / `ENTITLEMENT_REVOKED`) with nothing published. The published docs carry
`inputSnapshotHash` + `inputSnapshotAt` so a reader can tell which responses the instance reflects.
This is a snapshot policy with change detection **during the attempt**, not a claim of atomicity between
`responses` and the instance nodes. A write that lands between the pre-publish check and the publish update is
neither prevented nor guaranteed to be detected later: `readInstancePair` deliberately reads neither current
answers nor entitlement, and a published pair is reused by `settleComplete`. The docs carry `inputSnapshotHash`
and `entitlementEvidenceHash` so a caller *may* compare them with current data; the module does not (3868952 B).

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

Tiers, kept separate on purpose: **unit** (fake / local vm) → **real SDK cold** (fresh client, no
listener — the Functions cold-start state; the only evidence accepted for lock semantics) → **real SDK
warm** (root listener; diagnostic only) → **not verified** (Functions `onCall` auth + HttpsError mapping,
browser, PDF export, W rules on original bytes, production data, deploy). A unit or cold pass is never an
operational pass.

`node --test functions/q90-retention/test/retention.test.js` — 57 tests over an **in-memory fake** of the
RTDB Admin SDK (`once/set/update/transaction`, multi-path update, injectable failures and interleavings).
Reviewer counterexamples reproduced as regressions: 3824089 (1–7) and 3824741 C1 (winner complete but
unpublished when another caller's acquire aborts → recovery, never bare success; report-only; inconsistent
pair; fresh vs stale winner), C2 (mid-run answer edit → engine saw the snapshot, `SESSION_CHANGED`,
nothing published; entitlement revoked mid-run), C3 (default policy accepts nothing; sandbox/test env,
currency, amount, merchant). Mutations checked by hand: removing the fence condition fails reviewer-1;
returning bare `reused` on a complete lock fails C1; dropping the pre-publish hash check fails C2.

Owner additions (1861b57): partial pair → `PUBLISHED_PAIR_INCONSISTENT`; saved JSON preserves null/empty
containers and reads with the flag OFF and changed responses; JSON/view/hash/metadata tampering each fail
closed; recovery checks staged input + entitlement evidence; runner receives server ISO + sid; invalid JSON
payload never published.

They prove the module's decision logic and write ordering against the fake — **not** real RTDB
transaction semantics (the fake hid the cold-cache abort), rules enforcement, or Functions auth.
Real-SDK cold runs on f7f49cd exist on the owner's private copy (lock matrix 9/9, saved-pair re-read 9/9,
real engines × RTDB 8/8); **X's independent cold re-run is the acceptance evidence** (API-CONTRACT §3 R3–R5).
Functions `onCall`, browser, PDF and production remain unverified.

## Engine runner (`runner.js`)

`createBundleRunner({ bundleRoot, pinnedManifestSha256? })` loads a pinned bundle from a directory that
mirrors `assets/js/bundles/**` + `assets/data/bundles/**` + `manifest.json`. Before executing anything it
checks the manifest schema, requires the manifest's entrypoint file sets to equal the runner's hard-coded
`ENTRYPOINTS` (the trust anchor, mirroring `scripts/q90/bundle-patches.mjs`), verifies every file's
sha256/bytes, and **recomputes `bundleHash` and every `entrypointHash`** with the build-bundles formula
(sorted `path:sha256` lines) — manifest values are compared, never echoed (3825516 #4). It then runs the
requested entrypoint in an isolated `vm` context: `initial-generation` (no career engine, no careerRules —
the report-loading.html shape) or `regeneration` (career engine + careerRules — the report.html shape), and
builds the program from that same report (program-loading.html shape).

Request: `sid` (required; bound into `program.meta.sourceReportSid`, runner-checked — 3825516 #5) and
`publishedAt` (required; strict `Date#toISOString` UTC string of the server instant — 3825516 #3). The vm's
`Date` is frozen to that instant, so `report.generatedAt`, `_v4Meta.generatedAt`, `program.meta.generatedAt`
and `program.meta.publishedAt` all derive from the server clock; the host clock never reaches the engines and
the output is a pure function of the request (determinism test is now byte-exact, clock fields included, under
TZ=UTC / Asia/Seoul / America/Los_Angeles; policy for Functions and CI is `TZ=UTC`).

`test/runner.test.js` — 11 tests: integrity tamper; hashes = manifest; P18 inside the runner; v2 otherId;
byte-exact determinism; server clock; sid binding; forged `entrypointHash` / forged file hash / altered
entrypoint set / pinned manifest; vendored copy self-sufficient and equal to the worktree; tampered or unpinned
vendored copy refused. Bundle root: `Q90_BUNDLE_ROOT` > sibling worktree > `bundles/` (so the suite runs
with no worktree at all).

## Vendored bundles (`bundles/`, `scripts/vendor-bundles.cjs`)

`node scripts/vendor-bundles.cjs build` copies the manifest-pinned files of the frozen bundle commit
(`SOURCE_COMMIT` = b4f18c7, read via `git show`, never the working tree) into `bundles/` after full
verification (schema, entrypoint sets, every file hash/bytes, recomputed bundle/entrypoint hashes, path
policy: relative, normalised, no `..`, only under `assets/{js,data}/bundles/<version>/`, no duplicates), empties
the output first (no stray file survives), and writes `PIN.json` (`sourceCommit`, `manifestSha256`, per-file
sha256, no timestamp → rebuild is byte-identical). `check` rebuilds into a temp dir and requires identity;
`self-test` runs 31 negative/positive controls (byte tamper, manifest-vs-pin, manifest+pin forged,
**coherent payload+manifest+PIN rewrite**, extra file, path policy ×8, wrong pinned commit, output policy ×9 incl.
source module dir / parents / repo root / non-empty foreign dir / symlinked path with a spy proving no
`rmSync`/`renameSync` is reached, re-vendor over a previous tree, short sha).

Trust anchors (3868172): `PINNED_MANIFEST_SHA256` is fixed **in code** (sha256 of `manifest.json` at the frozen
commit, `d0bdd52d…`); both the vendored `manifest.json` and `PIN.manifestSha256` must equal it, and the runner is
opened with that code constant, never with a value read from the tree. PIN.json and manifest.json travel together
and could be rewritten coherently with mutated payload files — the code anchor is what refuses that. Limit: this
is an artifact-integrity boundary; it cannot defend against modification of the runtime code itself.
Output policy: the target is exactly `bundles/` or a directory under the OS temp dir that is empty or a previous
vendored tree; the source module dir, its ancestors, the repo, any non-empty foreign dir and any path with a
symlink component are refused **before** anything is deleted. Files are written to a sibling staging dir,
verified there, and swapped in with `rename` (previous tree restored if the swap fails). Deploy code opens the
copy with `createVendoredRunner()`, which refuses an unpinned, re-pinned, re-anchored or drifted tree. The legacy
bundle bytes are copied and hashed, never modified; the original `assets/js/bundles/**` stays the source.

## Remaining before wiring (blockers, not this branch)

See `API-CONTRACT.md` §3 (R1–R10) for the owner-tagged readiness matrix. In short:
- W: rules v3 compiled from the **original** bytes (12:125 whitespace) — release blocked until then.
- X: emulator race/recovery/revocation/entitlement matrices against this module (not the fake).
- TL: consent UI alignment after PR294; `functions/index.js` export line only after R1–R8 (vendoring
  is in place; R8 deploy tree must carry `bundles/PIN.json` for the approved commit).
- Owner: Functions deploy pipeline (none exists), CODEOWNERS approval for `/functions/`,
  `ledgerPolicy`/`featureEnabled` server config, q90Entitlements writer or provider verifier.
