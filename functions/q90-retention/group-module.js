"use strict";
/**
 * q90-retention — group module (the ONLY file a future functions/index.js export line would require).
 *
 *   // functions/index.js (owner-approved change, NOT in this branch):
 *   const q90Group = require("./q90-retention/group-module.js");
 *   exports.q90RecordConsent        = q90Group.q90RecordConsent;
 *   exports.q90PlanGeneration       = q90Group.q90PlanGeneration;
 *   exports.q90GenerateInstancePair = q90Group.q90GenerateInstancePair;
 *   exports.q90ReadInstancePair     = q90Group.q90ReadInstancePair;
 *
 * Load-time guarantees (checked by test/group-module.test.js and by the deploy workflow's
 * `require("./index.js")` load probe):
 *   - requiring this file performs NO database access, NO bundle verification, NO param read, NO network,
 *     NO admin.app() initialisation beyond what `firebase-admin` itself does when index.js already called
 *     initializeApp. The RTDB handle, params and the retention module are resolved lazily inside the first call.
 *   - all four callables exist as soon as the module loads, even if bundles/ is absent or corrupt
 *     (saved-read independence; generation then fails with `unavailable`).
 *   - feature flag is server-side only: param Q90_GENERATION_ENABLED (defineString, default "false").
 *     Anything other than the exact string "true" is OFF. Body/request can never turn it on.
 *   - ledger policy is server-side only: params Q90_LEDGER_ACCEPTED_ENVS / _CURRENCIES / _MIN_AMOUNT /
 *     _PAYPAL_MERCHANT_IDS / _PAYPLE_CST_IDS (comma-separated; empty => module default = accepts nothing).
 *     Known gap (API-CONTRACT R7): current writers do not record merchantId/cstId, so leaving the two
 *     merchant lists EMPTY is the only configuration that lets real ledger entries through; that is a
 *     deliberate owner decision to record, not a default this file makes.
 *   - provider verifier and the q90Entitlements writer are NOT wired (see entitlement-writer-contract.js);
 *     a normal first-time purchaser stays closed (ENTITLEMENT_UNVERIFIED) until the owner orders them.
 *
 * Dependency injection for tests: `createQ90Group(deps)` accepts { onCall, HttpsError, logger, params,
 * getDb, runnerOptions }; the default export builds it from firebase-functions / firebase-admin only
 * when those packages are present (they are in functions/package.json; this branch adds none).
 */

const path = require("path");
const { createQ90Callables } = require("./callable-adapter.js");

const CALL_OPTIONS = Object.freeze({ region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120 });
const PARAM_NAMES = Object.freeze({
  enabled: "Q90_GENERATION_ENABLED",
  envs: "Q90_LEDGER_ACCEPTED_ENVS",
  currencies: "Q90_LEDGER_ACCEPTED_CURRENCIES",
  minAmount: "Q90_LEDGER_MIN_AMOUNT",
  paypalMerchants: "Q90_LEDGER_PAYPAL_MERCHANT_IDS",
  paypleCst: "Q90_LEDGER_PAYPLE_CST_IDS",
});
const EXPORT_NAMES = Object.freeze(["q90RecordConsent", "q90PlanGeneration", "q90GenerateInstancePair", "q90ReadInstancePair"]);

const splitList = (s) => (typeof s === "string" ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

function ledgerPolicyFromParams(read) {
  const min = read(PARAM_NAMES.minAmount);
  const minAmount = min === "" || min == null ? null : Number(min);
  return {
    acceptedEnvs: splitList(read(PARAM_NAMES.envs)),
    acceptedCurrencies: splitList(read(PARAM_NAMES.currencies)),
    minAmount: Number.isFinite(minAmount) ? minAmount : null,
    acceptedPaypalMerchantIds: splitList(read(PARAM_NAMES.paypalMerchants)),
    acceptedPaypleCstIds: splitList(read(PARAM_NAMES.paypleCst)),
  };
}

/**
 * deps.params.read(name) -> string value at CALL time (firebase-functions params resolve at runtime, never at load).
 * deps.getDb() -> Admin RTDB handle, called lazily on first use.
 */
function createQ90Group(deps) {
  if (!deps || typeof deps.onCall !== "function" || typeof deps.HttpsError !== "function") throw new Error("createQ90Group: onCall + HttpsError required");
  if (typeof deps.getDb !== "function") throw new Error("createQ90Group: getDb() required (lazy Admin RTDB handle)");
  const readParam = deps.params && typeof deps.params.read === "function" ? deps.params.read : () => "";

  // Lazy DB proxy: the adapter's assemble receives an object whose `ref` resolves the real handle on first use.
  let db = null;
  const lazyDb = { ref(p) { if (!db) db = deps.getDb(); return db.ref(p); } };

  const featureEnabled = () => readParam(PARAM_NAMES.enabled) === "true"; // exact string; anything else OFF
  // ledgerPolicy: firebase-functions params are process-stable once the instance is up, but MUST NOT be read at
  // require time. createRetention copies the policy object when it is built, so the retention module itself is
  // built lazily on the first call (adapter `retention` injected as a lazy facade), reading params at that moment.
  let retention = null;
  const buildRetention = () => {
    if (retention) return retention;
    const { createRetention } = require("./index.js");
    // runner: lazily verified vendored copy (same semantics as the adapter's assemble path)
    let runnerState = null;
    const runBundle = async (req) => {
      if (!runnerState) { try { runnerState = { runner: require("./runner.js").createVendoredRunner(deps.runnerOptions || { bundleRoot: path.join(__dirname, "bundles") }) }; } catch (e) { runnerState = { error: e }; } }
      if (runnerState.error) { const { RetentionError } = require("./index.js"); throw new RetentionError("BUNDLE_RUNNER_UNAVAILABLE", "vendored engine bundle missing or failed verification"); }
      return runnerState.runner.runBundle(req);
    };
    retention = createRetention({ db: lazyDb, runBundle, featureEnabled, ledgerPolicy: ledgerPolicyFromParams(readParam), logger: deps.moduleLogger });
    return retention;
  };
  // facade: each module op resolves the real module at call time (no DB / params / bundles at construction)
  const facade = {};
  for (const m of ["recordConsent", "planGeneration", "generateInstancePair", "readInstancePair"]) facade[m] = (...a) => buildRetention()[m](...a);

  const callables = createQ90Callables({
    onCall: deps.onCall, HttpsError: deps.HttpsError, logger: deps.logger,
    callOptions: deps.callOptions || CALL_OPTIONS,
    retention: facade,
  });
  return Object.freeze({
    q90RecordConsent: callables.recordConsent,
    q90PlanGeneration: callables.planGeneration,
    q90GenerateInstancePair: callables.generateInstancePair,
    q90ReadInstancePair: callables.readInstancePair,
    _internals: Object.freeze({ handlers: callables.handlers, featureEnabled, getLedgerPolicy: () => ledgerPolicyFromParams(readParam), PARAM_NAMES, CALL_OPTIONS, EXPORT_NAMES }),
  });
}

// Default wiring — only when the Functions runtime packages are resolvable. Never throws at require time in
// a test environment without them; index.js would import the real thing.
function defaultGroup() {
  let https, params, logger, admin;
  try { https = require("firebase-functions/v2/https"); params = require("firebase-functions/params"); logger = require("firebase-functions/logger"); admin = require("firebase-admin"); }
  catch (_) { return null; }
  const defined = {};
  for (const name of Object.values(PARAM_NAMES)) defined[name] = params.defineString(name, { default: name === PARAM_NAMES.enabled ? "false" : "" });
  return createQ90Group({
    onCall: https.onCall, HttpsError: https.HttpsError, logger,
    params: { read: (name) => { try { return String(defined[name].value() ?? ""); } catch (_) { return ""; } } },
    getDb: () => admin.database(),
  });
}

const group = defaultGroup();
module.exports = Object.assign({ createQ90Group, PARAM_NAMES, CALL_OPTIONS, EXPORT_NAMES, ledgerPolicyFromParams }, group || {});
