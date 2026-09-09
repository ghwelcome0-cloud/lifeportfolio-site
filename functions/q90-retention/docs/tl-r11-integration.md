# tl-r11-integration — wiring contract for the Q90 retention callables (TL, Q90-R11, G10/G11/G12)

Status: **proposal + tested seam. No `functions/index.js` export, no loader edit, no rules edit, no deploy.**
Baseline (frozen for review): `q90/tl-callable-adapter` @ ab24d5dc0f480f8d6a0c80e39cdc5b9a22793083
(core index.js = 9f2c3f9712ffbeb613419df0e7cbd8a22ea54f03, bundles = b4f18c756d4a0ab4f2bdd18c3e0fe5a5f1acc09f).
This branch (`q90/tl-r11-integration`) adds only TL-owned files under `functions/q90-retention/`.
Observed `origin/main` = ca47ef3da587d232b60c36361efe367d085f91ce (not counted as Q90 progress).

## 1. Minimum file set to reach `functions/index.js` exports

| file | owner | state | change needed before wiring |
|---|---|---|---|
| `functions/q90-retention/index.js` | owner (core) | 9f2c3f9 | none |
| `functions/q90-retention/{runner.js, scripts/vendor-bundles.cjs, bundles/**}` | TL | ab24d5d | none (PIN.json present, anchor d0bdd52d…) |
| `functions/q90-retention/callable-adapter.js` | TL | ab24d5d | none |
| `functions/q90-retention/group-module.js` | TL | **this branch** | none — the single file index.js would `require` |
| `functions/index.js` | owner (CODEOWNERS `/functions/`) | main ca47ef3 | **+6 lines** (below) — owner-approved PR only |
| `functions/package.json` | owner | main ca47ef3 | **none** — zero new dependencies (`firebase-functions ^6.1.0`, `firebase-admin ^12.7.0` already present; adapter/runner/module use only `crypto`, `fs`, `path`, `vm`, `child_process`(vendoring script only, not at runtime)) |
| `database.rules.json` | W | rules v3 candidate (W branch) | W's R1/R2 — instance nodes uid-read, staging/locks/entitlements closed |
| loaders (`report-loading.html`, `program-loading.html`, `report.html`, `program.html`) | TL after PR294 | main | **none for the export step**; browser seam in §4 is behind the same OFF flag |

Proposed `functions/index.js` addition (append after the B2B group block, style-matched; NOT applied here):
```js
// Q90 retention (new report/program instances; default OFF via Q90_GENERATION_ENABLED param)
const q90Group = require("./q90-retention/group-module.js");
exports.q90RecordConsent        = q90Group.q90RecordConsent;
exports.q90PlanGeneration       = q90Group.q90PlanGeneration;
exports.q90GenerateInstancePair = q90Group.q90GenerateInstancePair;
exports.q90ReadInstancePair     = q90Group.q90ReadInstancePair;
```

## 2. Conflict / preservation check against latest main

- `git merge-tree` of ab24d5d vs `origin/main` ca47ef3: **0 conflicts**. main's only `functions/index.js` change since
  our base is the B2B e-mail link text (4 lines, unrelated region).
- Existing exports on main (26 callables/schedules incl. B2B group): untouched. The four new names are prefixed
  `q90*` and do not collide (`grep -c "^exports.q90" functions/index.js` = 0 on main).
- Deploy path on main (new since our base): `.github/workflows/firebase-functions-deploy.yml` — manual
  `workflow_dispatch`, `--only functions` or `functions:<name>`, runs `npm ci --omit=dev` then a load probe
  `require("./index.js")` counting exports. `group-module.js` is built to pass that probe: **require-time does no DB,
  no params read, no bundle verification, no network** (test/group-module.test.js "deploy-workflow load probe").
  Recommended first deploy scope: `functions:q90ReadInstancePair` alone (read-only surface), then the other three.
- `setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 })` in index.js applies; group-module's
  `CALL_OPTIONS` = `{ region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120 }`
  (engine run inside vm needs the memory; read path is cheap).

## 3. Server-side configuration (params; never request-controlled)

| param | default | meaning |
|---|---|---|
| `Q90_GENERATION_ENABLED` | `"false"` | exactly `"true"` enables consent/plan/generate; anything else OFF. Read is never gated. |
| `Q90_LEDGER_ACCEPTED_ENVS` | `""` | e.g. `live`. Empty ⇒ module default accepts **nothing** from `additionalPayments`. |
| `Q90_LEDGER_ACCEPTED_CURRENCIES` | `""` | e.g. `USD,KRW` |
| `Q90_LEDGER_MIN_AMOUNT` | `""` | numeric floor; empty/NaN ⇒ null ⇒ closed |
| `Q90_LEDGER_PAYPAL_MERCHANT_IDS` / `Q90_LEDGER_PAYPLE_CST_IDS` | `""` | **R7 gap**: current writers do not store merchantId/cstId, so any non-empty list closes every real entry. Leaving them empty is the only working configuration today and must be an explicit owner decision. |

Params are read at first call, not at require time (deploy load probe safe). The deploy workflow snapshots live
env into `functions/.env`; new params with defaults need no `.env` entry to deploy OFF.

## 4. Saved-first read contract + browser seam (for X)

Principle (P01): a saved instance is served from its stored `payloadJson`; the browser never re-runs an engine for
a saved instance and never needs the generation flag or an entitlement to read one.

Callable surface the loaders would use (all `httpsCallable(getFunctions(app, "asia-northeast3"), name)` —
the same pattern `payment-success.html` already uses for `issuePaypleAdditionalToken`):

| step | callable | body | success | UI on error |
|---|---|---|---|---|
| S0 list saved instances | *(none — direct RTDB read, rules v3)* | `get(ref(db, reportInstances/${uid}/${sid}))` → keys = instanceIds; each child has `bundleVersion, createdAt, outputHash` | pick newest `createdAt` | if node absent → legacy `reports/{uid}/{sid}` path exactly as today |
| S1 read | `q90ReadInstancePair` | `{sid, instanceId}` | `{report, program, bundleVersion, reportOutputHash, programOutputHash}` — render `report`/`program` objects directly (they are the parsed authoritative JSON) | `not-found` → fall back to S0 legacy; `data-loss` → show "저장본 확인 필요" + keep legacy; any other → legacy |
| S2 plan (upgrade UI only) | `q90PlanGeneration` | `{sid, targetBundle}` | preview: `upgrade`, `entrypoint`, `entitlementSource`, `inputSnapshotHash` | `unavailable` (OFF) → hide upgrade UI; `permission-denied` → show entitlement-required copy, no self-serve fix; `failed-precondition` → LEGACY_VERSION_UNRESOLVED ⇒ keep saved report, no button |
| S3 consent | `q90RecordConsent` | `{sid, targetBundle, disclosureVersion:"q90-disclosure-v1", locale, coversReportAndProgram:true, priorInstanceId?}` | `{consentEventId}` | `invalid-argument` ⇒ UI bug; never retry-loop |
| S4 generate | `q90GenerateInstancePair` | `{sid, targetBundle, consentEventId?}` | `{instanceId, reused, recovered, …}` → S1 with that instanceId | `aborted` (IN_PROGRESS/SESSION_CHANGED/SUPERSEDED) → one manual retry button, no auto-retry; `data-loss` → support copy; `unavailable` → hide |

Seam rules the loader change (later, TL after PR294) must honour — X should test these once the loader lands:
1. **Flag OFF ⇒ pixel-identical legacy behaviour.** With `Q90_GENERATION_ENABLED` unset, S0 finds no
   `reportInstances` node for legacy customers and the page runs today's code path untouched. No new network call
   on the legacy path except the single S0 `get` (rules v3: uid-scoped read; absent node ⇒ null).
2. **Saved-first.** If an instance exists, S1 is used and the legacy engine (`report-engine*.js`, `Date.now()`
   cache-busted) is **not** loaded for that view. If S1 fails for any reason, the page falls back to the legacy
   saved report — never to a fresh engine run.
3. **No client hashing / no client verification.** The client renders what `q90ReadInstancePair` returns; integrity
   is the server's job (payloadJson hash + view projection). The client may display `reportOutputHash` for support.
4. **PDF/identity preservation.** The unique code `LP-<fp64>` and the PDF export keep reading from the object the
   page renders; for an instance that is `report._v4Meta.fingerprint64` inside the payload — unchanged engine
   output, so the printed code for a *reproduced* legacy instance equals the saved one (P18 cohort entrypoint).
5. **No body uid.** The client never sends `uid`; the callable rejects it anyway.
6. **Error copy is generic.** HttpsError `message` is already client-safe; `details.code` may be shown for support,
   `details.requestId` should be shown so operators can correlate logs.

X harness entry points: `createQ90Callables({onCall, HttpsError, retention})` (already used in ADP.*) or, once the
group module is mounted in a test index.js, the real `httpsCallable` names above against the Functions emulator.
Auth-boundary evidence still requires the real HTTP callable with valid / forged / missing ID tokens (R8 runtime).

## 5. Explicitly not in this branch

- `functions/index.js` edit (owner PR), `package.json` (none needed), rules (W), loaders (post-PR294), deploy.
- Provider verifier / q90Entitlements writer implementation — interface only (`entitlement-writer-contract.js`).
- Any stuck-key remediation (see `tl-r11-g10-stuck-key.md`).
