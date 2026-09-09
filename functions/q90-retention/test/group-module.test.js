"use strict";
// node --test functions/q90-retention/test/group-module.test.js
// Proves the load-time contract a future `require("./q90-retention/group-module.js")` line in functions/index.js
// depends on: no DB / bundle / network access at require time, four export names present, feature OFF unless the
// server param is exactly "true", ledger policy from server params only, saved-read independent of bundles.
// Synthetic data, fake DB, onCall double. Real Functions runtime / params resolution / deploy: not covered.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const { createRetention } = require("../index.js");
const { createFakeDb } = require("./fake-db.js");
const gm = require("../group-module.js");

class HttpsError extends Error { constructor(c, m, d) { super(m); this.code = c; this.details = d; } }
const onCallCalls = [];
const onCall = (opts, h) => { onCallCalls.push(opts); const f = (r) => h(r); f.run = h; return f; };
const UID = "synthetic-uid-A", SID = "sid_001";
const okRunner = async ({ bundle, entrypoint }) => ({ report: { s: 1 }, program: { meta: { sourceReportSid: SID } }, bundleHash: "b".repeat(64), entrypointHash: "e".repeat(64), bundleVersion: bundle, entrypoint });
const state = () => ({ responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers: { Q3: 4 } } } }, q90Entitlements: { [UID]: { status: "verified", source: "synthetic" } } });
const call = (fn, uid, data) => fn.run({ auth: uid ? { uid } : undefined, data });
async function expectHttps(p, code, mcode) { try { await p; assert.fail("expected " + code); } catch (e) { if (e.code === "ERR_ASSERTION") throw e; assert.ok(e instanceof HttpsError, String(e && e.stack)); assert.equal(e.code, code); if (mcode) assert.equal(e.details.code, mcode); return e; } }
const paramsOf = (obj) => ({ read: (n) => (n in obj ? obj[n] : "") });

test("require() is side-effect free: no getDb, no bundle read, four export names via createQ90Group", () => {
  let dbCalls = 0, fsReads = 0;
  const realRead = fs.readFileSync; fs.readFileSync = function (...a) { if (String(a[0]).includes("q90-retention/bundles")) fsReads++; return realRead.apply(fs, a); };
  try {
    const g = gm.createQ90Group({ onCall, HttpsError, getDb: () => { dbCalls++; throw new Error("must not be called at construction"); }, params: paramsOf({}), runnerOptions: { bundleRoot: "/nonexistent/" + Date.now() } });
    for (const n of gm.EXPORT_NAMES) assert.equal(typeof g[n], "function", n);
    assert.deepEqual(Object.keys(g).filter((k) => !k.startsWith("_")).sort(), [...gm.EXPORT_NAMES].sort());
    assert.equal(dbCalls, 0); assert.equal(fsReads, 0);
    assert.ok(Object.isFrozen(g));
    // callOptions match the repo's callable conventions (region + cors) for all four
    assert.equal(onCallCalls.length, 4); for (const o of onCallCalls) assert.equal(o.region, "asia-northeast3");
  } finally { fs.readFileSync = realRead; }
});

test("module default export: without firebase-functions installed, only the factory + constants are exported (no throw); with it, the four names appear", () => {
  let hasFns = true; try { require.resolve("firebase-functions/v2/https"); } catch (_) { hasFns = false; }
  assert.equal(typeof gm.createQ90Group, "function");
  for (const n of gm.EXPORT_NAMES) assert.equal(typeof gm[n], hasFns ? "function" : "undefined", n);
});

test("feature flag: only the exact server param string \"true\" enables generation; read always serves", async () => {
  const db = createFakeDb(state());
  // seed one saved pair with a stub retention so read has something to return
  const seed = createRetention({ db, runBundle: okRunner, featureEnabled: () => true });
  const made = await seed.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  for (const v of ["", "false", "TRUE", "True", "1", "yes", " true", undefined]) {
    const g = gm.createQ90Group({ onCall, HttpsError, getDb: () => db, params: paramsOf({ [gm.PARAM_NAMES.enabled]: v }) });
    await expectHttps(call(g.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219" }), "unavailable", "FEATURE_DISABLED");
    await expectHttps(call(g.q90GenerateInstancePair, UID, { sid: SID, targetBundle: "legacy-b03e219" }), "unavailable", "FEATURE_DISABLED");
    const rd = await call(g.q90ReadInstancePair, UID, { sid: SID, instanceId: made.instanceId });
    assert.equal(rd.instanceId, made.instanceId);
  }
  const on = gm.createQ90Group({ onCall, HttpsError, getDb: () => db, params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true" }) });
  const plan = await call(on.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(plan.sid, SID);
  // body cannot enable: an "enabled" field is an unknown key -> invalid-argument, still OFF
  const off = gm.createQ90Group({ onCall, HttpsError, getDb: () => db, params: paramsOf({}) });
  await expectHttps(call(off.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219", enabled: true }), "invalid-argument");
});

test("getDb is resolved lazily on first call and exactly once", async () => {
  let n = 0; const db = createFakeDb(state());
  const g = gm.createQ90Group({ onCall, HttpsError, getDb: () => { n++; return db; }, params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true" }) });
  assert.equal(n, 0);
  await expectHttps(call(g.q90ReadInstancePair, UID, { sid: SID, instanceId: "i".repeat(32) }), "not-found");
  assert.equal(n, 1);
  await expectHttps(call(g.q90ReadInstancePair, UID, { sid: SID, instanceId: "j".repeat(32) }), "not-found");
  assert.equal(n, 1);
});

test("ledger policy comes from server params only; empty params => module default (accepts nothing); merchant lists are optional by design (R7 gap)", async () => {
  const p = gm.ledgerPolicyFromParams(paramsOf({}).read);
  assert.deepEqual(p, { acceptedEnvs: [], acceptedCurrencies: [], minAmount: null, acceptedPaypalMerchantIds: [], acceptedPaypleCstIds: [] });
  const full = gm.ledgerPolicyFromParams(paramsOf({ [gm.PARAM_NAMES.envs]: "live", [gm.PARAM_NAMES.currencies]: " USD, KRW ", [gm.PARAM_NAMES.minAmount]: "1", [gm.PARAM_NAMES.paypalMerchants]: "", [gm.PARAM_NAMES.paypleCst]: "" }).read);
  assert.deepEqual(full, { acceptedEnvs: ["live"], acceptedCurrencies: ["USD", "KRW"], minAmount: 1, acceptedPaypalMerchantIds: [], acceptedPaypleCstIds: [] });
  assert.equal(gm.ledgerPolicyFromParams(paramsOf({ [gm.PARAM_NAMES.minAmount]: "abc" }).read).minAmount, null);
  // end-to-end: real additionalPayments shape passes only with a policy; with empty params it is closed
  const ledger = { paid: true, status: "consumed", consumedBySid: SID, orderID: "O", captureID: "C", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99" };
  const st = { responses: state().responses, additionalPayments: { [UID]: { k: ledger } } };
  const closed = gm.createQ90Group({ onCall, HttpsError, getDb: () => createFakeDb(st), params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true" }) });
  await expectHttps(call(closed.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219" }), "permission-denied", "ENTITLEMENT_NONE");
  const open = gm.createQ90Group({ onCall, HttpsError, getDb: () => createFakeDb(st), params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true", [gm.PARAM_NAMES.envs]: "live", [gm.PARAM_NAMES.currencies]: "USD", [gm.PARAM_NAMES.minAmount]: "1" }) });
  const plan = await call(open.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(plan.entitlementSource, "additionalPayments");
  // a merchant list set while the writer records no merchantId closes every real entry (fail-closed, documented gap)
  const strict = gm.createQ90Group({ onCall, HttpsError, getDb: () => createFakeDb(st), params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true", [gm.PARAM_NAMES.envs]: "live", [gm.PARAM_NAMES.currencies]: "USD", [gm.PARAM_NAMES.minAmount]: "1", [gm.PARAM_NAMES.paypalMerchants]: "MERCH-LIVE" }) });
  await expectHttps(call(strict.q90PlanGeneration, UID, { sid: SID, targetBundle: "legacy-b03e219" }), "permission-denied", "ENTITLEMENT_NONE");
});

test("saved-read independent of bundles/: missing vendored tree keeps read working; new generation -> unavailable BUNDLE_RUNNER_UNAVAILABLE", async () => {
  const db = createFakeDb(state());
  const seed = createRetention({ db, runBundle: okRunner, featureEnabled: () => true });
  const made = await seed.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const g = gm.createQ90Group({ onCall, HttpsError, getDb: () => db, params: paramsOf({ [gm.PARAM_NAMES.enabled]: "true" }), runnerOptions: { bundleRoot: "/nonexistent/" + Date.now() } });
  const rd = await call(g.q90ReadInstancePair, UID, { sid: SID, instanceId: made.instanceId });
  assert.deepEqual(rd.report, { s: 1 });
  await db.ref(`responses/${UID}/sid_002`).set({ status: "submitted", answers: { Q3: 1 } });
  const e = await expectHttps(call(g.q90GenerateInstancePair, UID, { sid: "sid_002", targetBundle: "legacy-b03e219" }), "unavailable", "BUNDLE_RUNNER_UNAVAILABLE");
  assert.ok(!e.message.includes("/nonexistent"));
});

test("deploy-workflow load probe shape: a stand-in index.js that requires the group module exposes >=1 exports and does not touch DB", () => {
  // mirrors .github/workflows/firebase-functions-deploy.yml step: require("./index.js") and count exports
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "q90-index-probe-"));
  try {
    fs.writeFileSync(path.join(tmp, "index.js"), `"use strict";
const gm = require(${JSON.stringify(path.resolve(__dirname, "..", "group-module.js"))});
class HttpsError extends Error {}
const onCall = (o, h) => { const f = (r) => h(r); f.run = h; return f; };
const g = gm.createQ90Group({ onCall, HttpsError, getDb: () => { throw new Error("DB touched at load"); }, params: { read: () => "" } });
for (const n of gm.EXPORT_NAMES) exports[n] = g[n];
`);
    process.env.FUNCTIONS_EMULATOR = "true";
    const m = require(path.join(tmp, "index.js"));
    assert.deepEqual(Object.keys(m).sort(), [...gm.EXPORT_NAMES].sort());
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
