# q90-retention — API & readiness contract (for X emulator verification)

Status: **draft for X sign-off. Module not exported from `functions/index.js`, not deployed.**
Base: `q90/retention-functions` @ 46902eb (module), `q90/retention-bundle` @ b4f18c7 (bundles).
Rule paths: W rules v3 (3823006). Preservation contract: RC02/RC04 P01–P19.

## 1. Surface (what a future `onCall` wrapper would expose)

All calls: `request.auth.uid` is the only uid; body uid is ignored. Feature flag default OFF →
`FEATURE_DISABLED` for every call.

| callable (proposed name) | body | success | error codes (`RetentionError.code` → HttpsError) |
|---|---|---|---|
| `q90RecordConsent` | `{sid, targetBundle, disclosureVersion, locale, priorInstanceId?, coversReportAndProgram:true}` | `{consentEventId}` | `FEATURE_DISABLED`, `CONSENT_INVALID`, `CONSENT_ACTOR_MISMATCH`, `UNKNOWN_GENERATION_VERSION`, `CONSENT_ID_COLLISION` |
| `q90PlanGeneration` (read-only preview) | `{sid, targetBundle, consentEventId?, priorInstanceId?}` | plan (no ids that permit writing) | `FEATURE_DISABLED`, `INVALID_REQUEST`, `UNKNOWN_GENERATION_VERSION`, `SESSION_NOT_SUBMITTED`, `LEGACY_VERSION_UNRESOLVED`, `EXPLICIT_UPGRADE_CONSENT_REQUIRED`, `ENTITLEMENT_NONE`, `ENTITLEMENT_UNVERIFIED` |
| `q90GenerateInstancePair` | same as plan | `{instanceId, reused, recovered?, reportOutputHash, programOutputHash}` **only when both docs are visible** | plan errors + `GENERATION_IN_PROGRESS`, `GENERATION_SUPERSEDED`, `SESSION_CHANGED`, `ENTITLEMENT_REVOKED`, `GENERATION_INCOMPLETE`, `GENERATION_FAILED`, `LOCK_COMPLETE_WITHOUT_ARTIFACT`, `PUBLISHED_PAIR_INCONSISTENT`, `BUNDLE_RUNNER_UNAVAILABLE` |

Client-visible reads (rules v3): `reportInstances/{uid}/{sid}/{instanceId}`,
`programInstances/{uid}/{sid}/{instanceId}`, `generationConsents/{uid}/*`. Everything else server-only.
Legacy `reports/`, `programs/`, `payments/` are never written by this module (P01/P14).

## 2. Instance document shape (both nodes)

```
instanceId, attempt, uid, sid, kind ("report"|"program"),
bundleVersion, bundleHash (64hex), entrypoint ("initial-generation"|"regeneration"), entrypointHash (64hex),
locale, priorInstanceId|null, consentEventId|null,
entitlementSource ("q90Entitlements"|"additionalPayments"|"payments+providerVerified"), entitlementRef,
inputSnapshotHash (64hex), inputSnapshotAt, createdAt, state:"published",
outputHash (64hex of the payload),
report: {...}                       // report doc only
program: {...}, sourceReportInstanceId, reportBundleVersion, reportOutputHash   // program doc only
```
Invariant (checked before any success): `program.sourceReportInstanceId === report.instanceId`,
`program.reportOutputHash === report.outputHash`, same `bundleVersion`/`bundleHash`.

## 3. Readiness matrix — what must be true before wiring (each row has an owner)

| # | condition | owner | evidence required |
|---|---|---|---|
| R1 | rules v3 compiles from the **original** byte file (12:125 whitespace issue resolved) | W | emulator load log on real bytes |
| R2 | rules v3 negative matrix on real bytes incl. `generationStaging`/`q90Entitlements` closed, instance nodes client-write denied | W | 55+ case log |
| R3 | emulator race matrix on this module: two callers same key (fresh lock → `GENERATION_IN_PROGRESS`; stale → takeover, one pair), crash between fence and publish → next call recovers, publish failure → recovery, superseded attempt never writes | X | script + log against the emulator (not the fake) |
| R4 | emulator: `SESSION_CHANGED` and `ENTITLEMENT_REVOKED` when `responses`/`additionalPayments` change mid-run | X | log |
| R5 | emulator: entitlement matrix with the real writers' shapes (paypal capture, payple-cpay, payple-link, unused, other-sid, sandbox env) | X | log |
| R6 | engine runner reproduces `bundle_manifest_gate` hashes inside Functions (`bundleHash`/`entrypointHash` match `assets/data/bundles/manifest.json`) | TL | runner test log |
| R7 | `ledgerPolicy` and `featureEnabled` sourced from server config, never from request | TL + owner | config review |
| R8 | Functions deploy path exists (none today; `functions-diagnose` is read-only) and CODEOWNERS approval for `/functions/` | owner | pipeline + approval |
| R9 | consent UI (loader, PR294 lineage) sends `disclosureVersion:"q90-disclosure-v1"` and covers report+program in one dialog | TL after PR294 | UI review |
| R10 | q90Entitlements writer (approved migration) or provider verifier exists, else first-purchaser path documented as closed | owner + legal gate | separate order |

Wiring (export line in `functions/index.js`) is allowed only when R1–R8 are green; R9/R10 gate the
feature flag, not the deploy.

## 4. What X should NOT infer

- The old 8f515f73 reproduction scripts target the previous API (no `sid` argument to
  `resolveEntitlement`, runner without `bundleVersion`/`entrypoint` echo, no disclosure whitelist).
  A failure of those scripts against 46902eb is an API mismatch, not a regression.
- Rules v3 passing on the substituted copy is not proof for the original bytes (R1).
- 53/53 module tests are on an in-memory fake; they establish decision logic and write ordering only.
