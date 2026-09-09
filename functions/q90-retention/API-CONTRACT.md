# q90-retention — API & readiness contract (for X emulator verification)

Status: **module not exported from `functions/index.js`, not deployed, default OFF.**
Base: integration commit `q90/owner-retention-core` @ f7f49cd (owner core 1861b57 + TL runner 34dccf6),
bundles `q90/retention-bundle` @ b4f18c7 (vendored copy under `bundles/`, see §6).
Rule paths: W rules v3 (3823006). Preservation contract: RC02/RC04 P01–P19.

Verification tiers used in this document (never conflate them):

| tier | what it is | what it proves |
|---|---|---|
| unit | `node --test` on the in-memory fake (57) + runner (11) | decision logic, write ordering, runner integrity |
| real SDK **cold** | firebase-admin (12.7 / 13.10) against the RTDB emulator, fresh client, no listeners — the Functions cold-start cache state | transaction semantics as the SDK really behaves; **the only accepted evidence for R3** |
| real SDK warm | same, with a root listener keeping the cache warm | diagnostic only; never evidence of product behaviour |
| **not verified** | Functions `onCall` auth / HttpsError mapping, browser, PDF export, W rules on the original bytes, production data, deploy pipeline | nothing here claims these |

## 1. Surface (what a future `onCall` wrapper would expose)

All calls: `request.auth.uid` (the **verified token uid**) is the only uid; body uid is ignored. The
wrapper MUST pass that uid as the first argument of every module call — the module rejects an unsafe or
empty uid (`UNAUTHENTICATED`) but cannot know whether the wrapper verified it. Feature flag default OFF →
`FEATURE_DISABLED` for every **generation** call; `readInstancePair` is deliberately NOT behind the flag.

| callable (proposed name) | body | success | error codes (`RetentionError.code` → HttpsError) |
|---|---|---|---|
| `q90RecordConsent` | `{sid, targetBundle, disclosureVersion, locale, priorInstanceId?, coversReportAndProgram:true}` | `{consentEventId}` | `FEATURE_DISABLED`, `CONSENT_INVALID`, `CONSENT_ACTOR_MISMATCH`, `UNKNOWN_GENERATION_VERSION`, `CONSENT_ID_COLLISION` |
| `q90PlanGeneration` (read-only preview) | `{sid, targetBundle, consentEventId?, priorInstanceId?}` | plan (no ids that permit writing) | `FEATURE_DISABLED`, `INVALID_REQUEST`, `UNKNOWN_GENERATION_VERSION`, `SESSION_NOT_SUBMITTED`, `LEGACY_VERSION_UNRESOLVED`, `EXPLICIT_UPGRADE_CONSENT_REQUIRED`, `ENTITLEMENT_NONE`, `ENTITLEMENT_UNVERIFIED` |
| `q90GenerateInstancePair` | same as plan | `{instanceId, reused, recovered?, lockKey, reportOutputHash, programOutputHash}` **only when both docs are visible and validate** | plan errors + `GENERATION_IN_PROGRESS`, `GENERATION_SUPERSEDED`, `SESSION_CHANGED`, `ENTITLEMENT_REVOKED`, `GENERATION_INCOMPLETE`, `GENERATION_FAILED`, `LOCK_COMPLETE_WITHOUT_ARTIFACT`, `PUBLISHED_PAIR_INCONSISTENT`, `STAGING_MISMATCH`, `BUNDLE_RUNNER_UNAVAILABLE` |
| `q90ReadInstancePair` | `{sid, instanceId}` | `{instanceId, bundleVersion, reportOutputHash, programOutputHash, report, program}` — `report`/`program` are the parsed **authoritative** `payloadJson` | `UNAUTHENTICATED`, `INVALID_REQUEST`, `SAVED_INSTANCE_NOT_FOUND`, `PUBLISHED_PAIR_INCONSISTENT` |

Notes on the error table:
- `SESSION_CHANGED` / `ENTITLEMENT_REVOKED` / `FEATURE_DISABLED` can also come out of the **recovery**
  path (`settleComplete` → `publishFromStaging`): a staged-but-unpublished artifact is only published if
  the live `responses` still hash to the staged `inputSnapshotHash`, the live entitlement still hashes to
  the staged `entitlementEvidenceHash`, and the flag is still on. Otherwise nothing is published and the
  staged artifact stays where it is.
- `PUBLISHED_PAIR_INCONSISTENT` covers: only one member of the pair exists (**partial pair — never
  treated as "in progress", never overwritten**), payloadJson/hash/view mismatch, metadata mismatch
  between the two docs, unknown saved bundle. Manual review; the module never repairs a published doc.
- `readInstancePair` works with the generation feature OFF and after the customer's `responses` have
  changed since generation (P01 — the saved instance keeps serving). It is uid-scoped only.

Client-visible reads (rules v3): `reportInstances/{uid}/{sid}/{instanceId}`,
`programInstances/{uid}/{sid}/{instanceId}`, `generationConsents/{uid}/*`. Everything else server-only.
Legacy `reports/`, `programs/`, `payments/` are never written by this module (P01/P14).

## 2. Instance document shape (both nodes)

```
instanceId, attempt, uid, sid, kind ("report"|"program"),
bundleVersion, bundleHash (64hex), entrypoint ("initial-generation"|"regeneration"), entrypointHash (64hex),
locale ("ko"|"en"), priorInstanceId|null, consentEventId|null,
entitlementSource ("q90Entitlements"|"additionalPayments"|"payments+providerVerified"), entitlementRef,
entitlementEvidenceHash (64hex),                 // sha256(canonical(plan.entitlement)) — what was accepted
inputHashFormat: "q90-cjson-v1",
inputSnapshotHash (64hex),                        // sha256(canonical(responses/{uid}/{sid} snapshot))
inputSnapshotAt, createdAt (ms epoch, server), state: "published",
payloadFormat: "q90-cjson-v1",
payloadJson (string),                             // AUTHORITATIVE payload
outputHash (64hex) = sha256(payloadJson),
report: {...}                                     // report doc only — RTDB compatibility VIEW of payloadJson
program: {...}, sourceReportInstanceId, reportBundleVersion, reportOutputHash   // program doc only
```

### 2.1 `payloadJson` is the payload; `report`/`program` objects are a view

RTDB storage is lossy for JSON: `null` values and empty objects/arrays are dropped, arrays with
integer-like keys can come back as objects, and key order is not preserved. Therefore:

- **Authority.** A reader (server wrapper, future page loader, export) MUST obtain the report/program by
  `JSON.parse(doc.payloadJson)` after checking `doc.payloadFormat === "q90-cjson-v1"` and
  `sha256(doc.payloadJson) === doc.outputHash`. The `report`/`program` object fields exist only so RTDB
  tooling and the existing uid-scoped read rules can see the content; they are never the source for
  rendering or hashing.
- **Canonical form (`q90-cjson-v1`).** `payloadJson` is `JSON.stringify` of the payload with every object's
  keys sorted (recursively, code-point order), arrays in place, numbers finite, and `null` / `{}` / `[]`
  **preserved verbatim**. Non-JSON values (undefined, NaN, functions, Dates) are a `PAYLOAD_INVALID` build
  failure — nothing is published.
- **View consistency check.** On every read/validation the module projects both the parsed `payloadJson`
  and the stored `report`/`program` object through the same RTDB projection (drop null/empty, sort keys)
  and requires equality. A view that was edited in place therefore fails closed even if the string is
  intact, and vice versa.
- **Hash scheme.** `outputHash` identifies exactly one `payloadJson` string. `inputSnapshotHash` and
  `entitlementEvidenceHash` use the same canonical serialisation (`inputHashFormat` records this).
  `program.reportOutputHash === report.outputHash` links the pair at the hash level;
  `program.payload.meta.sourceReportSid === sid` links it at the payload level (runner-enforced).
- **Legacy untouched.** Hashes or formats of existing `reports/`, `programs/` documents are never
  recomputed, migrated or compared to this scheme. This scheme applies to new instances only.

### 2.2 Pair invariants (checked before any success or read)

`report.instanceId === program.instanceId === instanceId`; same `uid`, `sid`, `bundleVersion`,
`bundleHash`, `entrypoint`, `entrypointHash`, `locale`, `attempt`, `createdAt`, `inputHashFormat`,
`inputSnapshotHash`, `inputSnapshotAt`, `entitlementSource`, `entitlementRef`, `entitlementEvidenceHash`,
`consentEventId`, `priorInstanceId`; `program.sourceReportInstanceId === instanceId`;
`program.reportBundleVersion === bundleVersion`; `program.reportOutputHash === report.outputHash`;
both `state:"published"`, both payloads decode per §2.1.

### 2.3 Clock and timezone policy

All server instants are `Date.now()` ms integers (`inputSnapshotAt`, `createdAt`) or their exact
`toISOString()` form (`publishedAt` passed to the runner). Engines run with **that** instant as their clock
(`report.generatedAt`, `report._v4Meta.generatedAt`, `program.meta.generatedAt` = the ISO string;
`program.meta.publishedAt` = `YYYY.MM.DD` derived from it). Date-only strings are computed in the process
TZ; **Functions and CI run with `TZ=UTC`** — that is the policy, not an accident. Runner tests are executed
under UTC, Asia/Seoul and America/Los_Angeles to show the payload is a pure function of the request.

## 3. Readiness matrix — what must be true before wiring (each row has an owner)

| # | condition | owner | evidence required |
|---|---|---|---|
| R1 | rules v3 compiles from the **original** byte file (12:125 whitespace issue resolved) | W | emulator load log on real bytes |
| R2 | rules v3 negative matrix on real bytes incl. `generationStaging`/`q90Entitlements` closed, instance nodes client-write denied | W | 55+ case log |
| R3 | **cold** real-SDK matrix: (a) single caller, fresh client, no listener → one published pair (first condition — 521e60f failed exactly here); (b) two callers same key (fresh lock → `GENERATION_IN_PROGRESS`; stale → takeover, one pair); (c) crash between fence and publish → next call recovers; (d) publish failure → recovery re-validates the **staged** input/entitlement, refuses on change; (e) superseded attempt never writes; (f) partial pair → `PUBLISHED_PAIR_INCONSISTENT`; (g) payload/view/hash tamper → fail closed; (h) lock `pending@n` never left behind by a single caller | X | cold script + JSON log against the emulator (warm runs are diagnostics, not evidence) |
| R4 | real SDK: `SESSION_CHANGED` / `ENTITLEMENT_REVOKED` when `responses`/entitlement change mid-run **and** during recovery | X | log |
| R5 | real SDK: entitlement matrix with the real writers' shapes (paypal capture, payple-cpay, payple-link, unused, other-sid, sandbox env, no policy) | X | log |
| R6 | runner recomputes `bundleHash` **and every `entrypointHash`** from content-verified file hashes (manifest values compared, never echoed); vendored copy pinned (`PIN.json`) and self-sufficient; `sid`/`publishedAt` bound into the payload | TL | `runner.test.js` 11/11 (3 TZ), `vendor-bundles.cjs self-test` 12/12, `check` identical |
| R7 | `ledgerPolicy` and `featureEnabled` sourced from server config, never from request. **Known gap:** current ledger writers do not record `merchantId`/`cstId`; a policy with non-empty `acceptedPaypalMerchantIds`/`acceptedPaypleCstIds` closes every real entry (fail-closed, but must be an explicit decision, not an accident) | TL + owner | config review |
| R8 | Functions deploy path exists (none today; `functions-diagnose` is read-only) and CODEOWNERS approval for `/functions/`; deploy tree contains `q90-retention/bundles/` with a `PIN.json` whose `sourceCommit` equals the approved bundle commit | owner | pipeline + approval |
| R9 | consent UI (loader, PR294 lineage) sends `disclosureVersion:"q90-disclosure-v1"` and covers report+program in one dialog | TL after PR294 | UI review |
| R10 | q90Entitlements writer (approved migration) or provider verifier exists, else the normal first-purchaser path is documented as **closed** (it is, today: `payments/{uid}` alone → `ENTITLEMENT_UNVERIFIED`) | owner + legal gate | separate order |

Wiring (export line in `functions/index.js`) is allowed only when R1–R8 are green; R9/R10 gate the
feature flag, not the deploy.

## 4. What X should NOT infer

- Scripts written against 8f515f73 or 521e60f target older APIs (no `sid`/`publishedAt` to the runner,
  `outputHash` over the raw object, `sha256(JSON.stringify(doc.report))` comparisons). A failure of those
  scripts against f7f49cd is an API mismatch, not a regression; compare `sha256(doc.payloadJson)`.
- Rules v3 passing on the substituted copy is not proof for the original bytes (R1).
- 57/57 + 11/11 unit tests are on an in-memory fake / local vm; they establish decision logic, write
  ordering and runner integrity only. A warm-cache emulator pass is a diagnostic, not R3 evidence.
- Owner's cold real-SDK runs (9/9 lock matrix, 9/9 saved-pair re-read, 8/8 real-engine × RTDB
  2 bundles × 2 entrypoints × KO/EN) were executed on the owner's private copy of f7f49cd; X's independent
  re-run is the acceptance evidence.
- Nothing here has been run through a Functions `onCall` wrapper, a browser, PDF export, or on production
  data. "Unit pass" or "cold pass" is never "production pass".

## 5. Runner request/response (for the wrapper and for X)

```
runBundle({ bundle, entrypoint, answers, profile:{name, submittedAt}, locale:"ko"|"en",
            sid,                       // REQUIRED, idSafe; bound into program.meta.sourceReportSid
            publishedAt })             // REQUIRED, strict Date#toISOString UTC string of the server instant
 -> { report, program, bundleVersion, entrypoint, bundleHash, entrypointHash, sid, publishedAt, generatedAt(ms), reportEngineVersion }
errors: UNKNOWN_BUNDLE, UNKNOWN_ENTRYPOINT, BAD_LOCALE, SID_REQUIRED, PUBLISHED_AT_REQUIRED, MANIFEST_SCHEMA,
        MANIFEST_ENTRYPOINT_MISMATCH, MANIFEST_PINNED_MISMATCH, BUNDLE_FILE_MISSING, BUNDLE_INTEGRITY,
        REPORT_INCOMPLETE, PROGRAM_INCOMPLETE, VENDORED_TREE_MISMATCH
```
The module passes `sid: plan.sid` and `publishedAt: new Date(t0).toISOString()` where `t0` is the
attempt's `now()`; `createdAt`/`inputSnapshotAt` in the docs equal `t0`.

## 6. Vendored bundles (`bundles/`, `scripts/vendor-bundles.cjs`)

Deploy trees have no sibling worktree, so the runner reads a vendored copy:
`node scripts/vendor-bundles.cjs build` reads every manifest-listed file with `git show <SOURCE_COMMIT>:<path>`
(never the working tree), verifies manifest schema + entrypoint file sets, every file's sha256/bytes,
recomputed `bundleHash` and `entrypointHash`, enforces the path policy (relative, normalised, no `..`,
only under `assets/{js,data}/bundles/<version>/`, no duplicates), empties the output dir, writes only those
files plus the manifest and `PIN.json` (`sourceCommit`, `manifestSha256`, per-file sha256, no timestamp).
`check` rebuilds to a temp dir and requires byte-identity; `self-test` runs the negative controls (byte
tamper, manifest-vs-pin, manifest+pin forged, extra file, path escape, absolute path, outside-bundle path,
wrong pinned commit, output-dir policy, short sha). `createVendoredRunner()` refuses an unpinned, re-pinned
or drifted `bundles/`. The legacy bundle bytes are copied and hashed, never modified.

## 7. Callable adapter (`callable-adapter.js`) — authenticated boundary, not exported

`createQ90Callables({ onCall, HttpsError, logger?, retention | assemble, callOptions?, now? })` returns
`{ recordConsent, planGeneration, generateInstancePair, readInstancePair, handlers, ERROR_MAP }`. The
Functions SDK pieces are injected (real `firebase-functions/v2/https` in deploy, a double in tests, the
emulator harness via `handlers`), so the same code is testable without a deploy. Nothing is exported from
`functions/index.js`; no loader/rules/provider wiring.

Contract:
- **uid** = `request.auth.uid` only. Body keys `uid | actorUid | userId | user_id | owner | ownerUid` are never
  read; if present and different from the token uid → `invalid-argument`; equal → ignored. `recordConsent`'s
  `actorUid` is set from the token. Missing/unsafe token uid → `unauthenticated` before body validation.
- **Body validation** (before the module): plain object only; unknown keys rejected; `sid`/`instanceId`/
  `consentEventId`/`priorInstanceId` id-safe; `targetBundle`/`disclosureVersion`/`locale` from the module's
  allow-lists; `coversReportAndProgram === true`. Bodies: §1 table.
- **Error mapping**: closed allow-list `ERROR_MAP` (module code → FunctionsErrorCode + fixed client-safe
  message). Unknown codes / non-Retention errors → `internal` "Internal error.". `HttpsError.details` is exactly
  `{ code, requestId }`; module messages (which may carry paths/refs) are never forwarded.
  `FEATURE_DISABLED→unavailable`, `ENTITLEMENT_*→permission-denied`, `SESSION_NOT_SUBMITTED |
  LEGACY_VERSION_UNRESOLVED | EXPLICIT_UPGRADE_CONSENT_REQUIRED→failed-precondition`, `GENERATION_IN_PROGRESS |
  GENERATION_SUPERSEDED | SESSION_CHANGED | CONSENT_ID_COLLISION→aborted`, `STAGING_MISMATCH |
  LOCK_COMPLETE_WITHOUT_ARTIFACT | PUBLISHED_PAIR_INCONSISTENT→data-loss`, `SAVED_INSTANCE_NOT_FOUND→not-found`,
  `BUNDLE_RUNNER_UNAVAILABLE→unavailable`, `GENERATION_FAILED | GENERATION_INCOMPLETE | PAYLOAD_INVALID→internal`.
- **Response shaping**: plan preview exposes only `action, sid, targetBundle, entrypoint, upgrade, originBundle,
  locale, consentEventId, priorInstanceId, entitlementSource, inputSnapshotHash` — never `inputSnapshot`
  (answers), `entitlement.ref/evidence`, `idempotencyKey`. Generate → `{instanceId, reused, recovered,
  reportOutputHash, programOutputHash}`. Read → `{instanceId, bundleVersion, reportOutputHash,
  programOutputHash, report, program}` where `report`/`program` are the parsed authoritative `payloadJson`.
- **Logging**: one structured row per call, `{ requestId, fn, uidHash (sha256 prefix), sid, code, ms
  [, errorType] }`. Never bodies, answers, ledger fields, module messages or the raw uid. A throwing logger
  never changes an outcome.
- **Flag**: `featureEnabled` injected, default OFF (also in `assemble` when omitted). `readInstancePair` is not
  gated (saved instances keep serving with the flag off and after the customer edits `responses`).
- **Assembly**: `assemble: { db, featureEnabled?, ledgerPolicy?, verifyProviderCapture?, runnerOptions? }` wires
  `createRetention` with `createVendoredRunner().runBundle` — the only engine runner permitted at this boundary;
  a tampered/unpinned `bundles/` fails construction (no callable is created).
- **Not done here**: no export line, no provider payment call, no rules/loader change, **no automatic staging
  cleanup, no lock-TTL re-opening, no answer restore, no entitlement consumption** for a key stuck after a
  pre-publish transport failure followed by a permanent `responses` change (X 3827817 / owner 3868585) — that
  stays `SESSION_CHANGED` + saved-read until the owner's exception-support / explicit-regeneration policy
  (G10 remainder). Atomicity limit unchanged: entitlement/response re-validation and the publish update are
  separate operations; a change landing between them is detected on the next read, not prevented.

Tests: `test/callable-adapter.test.js` (12) — mapping completeness vs. every code the module throws, valid
FunctionsErrorCode set, unauthenticated matrix, body-uid contract for all six uid-like keys, input validation
matrix (module never reached, zero writes), default OFF + saved-read independence + cross-uid not-found, plan
preview allow-list, end-to-end code mapping (permission-denied / failed-precondition / aborted / data-loss with
stored state untouched), no-leak assertions over HttpsError + logs with sensitive markers, assembly with the
vendored runner (default OFF, tampered tree refused at construction), happy path with real engines on the fake
DB (generate → reused → read, `publishedAt`/`generatedAt` from server clock). Real Functions `onCall` runtime,
App Check, emulator functions, browser, PDF, production: not covered.
