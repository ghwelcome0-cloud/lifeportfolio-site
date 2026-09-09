"use strict";
// node --test functions/q90-retention/test/callable-adapter.test.js
// Adapter boundary tests with an injected onCall/HttpsError double that mirrors firebase-functions/v2/https:
//   onCall(opts, handler) -> callable; callable.run(request) invokes handler(request) (same as the SDK's
//   CallableFunction.run used by firebase-functions-test / the emulator harness).
// The retention module underneath runs on the in-memory fake DB (synthetic data only). Real Functions auth,
// emulator, browser, PDF, production: NOT covered here (API-CONTRACT tiers).

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createRetention, RetentionError, PATHS } = require("../index.js");
const { createFakeDb } = require("./fake-db.js");
const { createQ90Callables, ERROR_MAP, validateBody, toHttpsError, shapePlan, AdapterReject, UID_LIKE_KEYS } = require("../callable-adapter.js");

// ---- firebase-functions/v2/https double ------------------------------------------------------------------
const FUNCTIONS_ERROR_CODES = new Set(["ok", "cancelled", "unknown", "invalid-argument", "deadline-exceeded", "not-found", "already-exists", "permission-denied", "resource-exhausted", "failed-precondition", "aborted", "out-of-range", "unimplemented", "internal", "unavailable", "data-loss", "unauthenticated"]);
class HttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    if (!FUNCTIONS_ERROR_CODES.has(code)) throw new Error(`Unknown error code: ${code}`); // the real class throws too
    this.code = code; this.details = details; this.httpErrorCode = { canonicalName: code.toUpperCase().replace(/-/g, "_") };
  }
}
const onCallCalls = [];
function onCall(optsOrHandler, maybeHandler) {
  const opts = typeof optsOrHandler === "function" ? {} : optsOrHandler;
  const handler = typeof optsOrHandler === "function" ? optsOrHandler : maybeHandler;
  onCallCalls.push(opts);
  const fn = (req) => handler(req);
  fn.run = handler; fn.__endpoint = { platform: "gcfv2", callableTrigger: {} , ...opts };
  return fn;
}
function memLogger() { const rows = []; return { rows, info: (o) => rows.push(["info", o]), warn: (o) => rows.push(["warn", o]), error: (o) => rows.push(["error", o]) }; }

// ---- synthetic state --------------------------------------------------------------------------------------
const UID = "synthetic-uid-A", OTHER = "synthetic-uid-B", SID = "sid_001";
const SECRET_ANSWER = "very-private-answer-text-zzz";
const H64 = (c) => c.repeat(64);
const okRunner = async ({ bundle, entrypoint }) => ({ report: { engineVersion: bundle, entrypoint, sections: [{ id: "s", nul: null, empty: {} }] }, program: { meta: { v: 1, sourceReportSid: SID } }, bundleHash: H64("b"), entrypointHash: H64("e"), bundleVersion: bundle, entrypoint });
function state(over) {
  return {
    responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers: { Q3: 4, Q6: [SECRET_ANSWER] }, name: "Synthetic", submittedAt: 1 } } },
    reports: {}, payments: {}, additionalPayments: { [UID]: { k1: { paid: true, status: "consumed", consumedBySid: SID, orderID: "PP-ORDER-SECRET", captureID: "PP-CAPTURE-SECRET", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99", merchantId: "MERCH-LIVE" } } },
    q90Entitlements: {}, ...over,
  };
}
const POLICY = { acceptedEnvs: ["live"], acceptedCurrencies: ["USD", "KRW"], minAmount: 1, acceptedPaypalMerchantIds: ["MERCH-LIVE"], acceptedPaypleCstIds: ["CST-LIVE"] };
function mk(st, extra = {}) {
  const db = createFakeDb(st || state());
  const clock = { t: 1_700_000_000_000 };
  const retention = createRetention({ db, now: () => (clock.t += 7), runBundle: okRunner, featureEnabled: extra.featureEnabled || (() => true), ledgerPolicy: POLICY, ...extra.retention });
  const logger = memLogger();
  onCallCalls.length = 0;
  const q90 = createQ90Callables({ onCall, HttpsError, logger, retention, callOptions: extra.callOptions || { region: "asia-northeast3" }, now: () => (clock.t += 1) });
  return { db, retention, logger, q90, clock };
}
const call = (fn, auth, data) => fn.run({ auth, data, rawRequest: {} });
const authed = (uid) => ({ uid, token: { uid } });
async function expectHttps(p, code, moduleCode) {
  try { await p; assert.fail(`expected HttpsError ${code}`); }
  catch (e) { if (e.code === "ERR_ASSERTION") throw e; assert.ok(e instanceof HttpsError, "HttpsError expected, got " + (e && e.stack)); assert.equal(e.code, code); if (moduleCode) assert.equal(e.details.code, moduleCode); assert.ok(/^[0-9a-f]{16}$/.test(e.details.requestId)); return e; }
}
const LEAK_MARKERS = [SECRET_ANSWER, "PP-CAPTURE-SECRET", "PP-ORDER-SECRET", "additionalPayments/", "responses/", "generationLocks", "MERCH-LIVE"];
const assertNoLeak = (s, where) => { for (const m of LEAK_MARKERS) assert.ok(!s.includes(m), `${where} leaks "${m}"`); };

// ============================================================================================================
test("ERROR_MAP: every RetentionError code the module can throw is mapped to a valid FunctionsErrorCode; messages are fixed and free of paths", () => {
  const src = require("fs").readFileSync(require.resolve("../index.js"), "utf8");
  const thrown = new Set([...src.matchAll(/RetentionError\("([A-Z_]+)"/g)].map((m) => m[1]));
  // ENTITLEMENT_* are thrown via planGeneration from resolveEntitlement's {code} — include them
  thrown.add("ENTITLEMENT_NONE"); thrown.add("ENTITLEMENT_UNVERIFIED");
  for (const c of thrown) assert.ok(ERROR_MAP[c], `unmapped module code ${c}`);
  for (const [c, [https, msg]] of Object.entries(ERROR_MAP)) { assert.ok(FUNCTIONS_ERROR_CODES.has(https), `${c} -> ${https}`); assert.ok(msg.length < 120 && !/\/|\{|\}/.test(msg), `${c} message shape`); }
  // unknown/unexpected -> internal, generic, details.code INTERNAL
  const e = toHttpsError(HttpsError, new Error("db path /responses/u/s exploded"), "0123456789abcdef");
  assert.equal(e.code, "internal"); assert.equal(e.message, "Internal error."); assert.deepEqual(e.details, { code: "INTERNAL", requestId: "0123456789abcdef" });
  const e2 = toHttpsError(HttpsError, new RetentionError("NOT_A_REAL_CODE", "x"), "0123456789abcdef");
  assert.equal(e2.code, "internal"); assert.equal(e2.details.code, "INTERNAL");
  // module message is never forwarded
  const e3 = toHttpsError(HttpsError, new RetentionError("SESSION_CHANGED", "responses/uid/sid changed " + SECRET_ANSWER), "0123456789abcdef");
  assert.equal(e3.code, "aborted"); assertNoLeak(e3.message + JSON.stringify(e3.details), "HttpsError");
});

test("factory: requires onCall + HttpsError; passes callOptions to onCall for all four callables; exposes raw handlers", () => {
  assert.throws(() => createQ90Callables({}), /onCall/);
  assert.throws(() => createQ90Callables({ onCall }), /HttpsError/);
  assert.throws(() => createQ90Callables({ onCall, HttpsError }), /retention|assemble/);
  const { q90 } = mk(null, { callOptions: { region: "asia-northeast3", enforceAppCheck: true } });
  assert.equal(onCallCalls.length, 4);
  for (const o of onCallCalls) assert.deepEqual(o, { region: "asia-northeast3", enforceAppCheck: true });
  for (const k of ["recordConsent", "planGeneration", "generateInstancePair", "readInstancePair"]) { assert.equal(typeof q90[k], "function"); assert.equal(typeof q90.handlers[k], "function"); }
});

test("unauthenticated: no auth / no uid / unsafe uid -> unauthenticated, before any body validation or module call", async () => {
  const { q90, db } = mk();
  for (const auth of [undefined, null, {}, { uid: "" }, { uid: "a/b" }, { uid: "x".repeat(129) }, { uid: 42 }]) {
    for (const k of ["recordConsent", "planGeneration", "generateInstancePair", "readInstancePair"]) {
      await expectHttps(call(q90[k], auth, { sid: SID, targetBundle: "legacy-b03e219", instanceId: "i" }), "unauthenticated", "UNAUTHENTICATED");
    }
  }
  assert.equal(db.writes.length, 0);
});

test("body uid contract: uid-like fields are never read; a body uid different from the token uid is rejected; equal is ignored", async () => {
  const { q90, retention } = mk();
  let seenUid = null; const orig = retention.planGeneration; retention.planGeneration = async (uid, req) => { seenUid = uid; return orig(uid, req); };
  for (const k of UID_LIKE_KEYS) {
    await expectHttps(call(q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219", [k]: OTHER }), "invalid-argument", "INVALID_REQUEST");
  }
  assert.equal(seenUid, null);
  const plan = await call(q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219", uid: UID });
  assert.equal(seenUid, UID); assert.equal(plan.sid, SID);
  // recordConsent: actorUid from token even if body omits it; body actorUid of another uid -> rejected
  const c = await call(q90.recordConsent, authed(UID), { sid: SID, targetBundle: "legacy-b03e219", disclosureVersion: "q90-disclosure-v1", locale: "ko", coversReportAndProgram: true });
  assert.ok(/^[0-9a-f]{32}$/.test(c.consentEventId)); assert.deepEqual(Object.keys(c), ["consentEventId"]);
  await expectHttps(call(q90.recordConsent, authed(UID), { sid: SID, targetBundle: "legacy-b03e219", disclosureVersion: "q90-disclosure-v1", locale: "ko", coversReportAndProgram: true, actorUid: OTHER }), "invalid-argument", "INVALID_REQUEST");
});

test("input validation: non-object body, unknown fields, unsafe sid/instanceId/ids, bad bundle/locale/disclosure, non-true coversReportAndProgram -> invalid-argument; module never reached", async () => {
  const { q90, db } = mk();
  const bad = [null, "str", 7, [], { sid: SID, targetBundle: "legacy-b03e219", extra: 1 }, { sid: "a/b", targetBundle: "legacy-b03e219" }, { sid: "", targetBundle: "legacy-b03e219" }, { sid: SID, targetBundle: "latest" }, { sid: SID, targetBundle: "legacy-b03e219", consentEventId: "x y" }, { sid: SID, targetBundle: "legacy-b03e219", priorInstanceId: 5 }, { targetBundle: "legacy-b03e219" }, { sid: SID }, { sid: { $gt: "" }, targetBundle: "legacy-b03e219" }, Object.create({ sid: SID, targetBundle: "legacy-b03e219" })];
  for (const b of bad) await expectHttps(call(q90.generateInstancePair, authed(UID), b), "invalid-argument", "INVALID_REQUEST");
  for (const b of [{ sid: SID }, { sid: SID, instanceId: "../x" }, { sid: SID, instanceId: "i", more: 1 }]) await expectHttps(call(q90.readInstancePair, authed(UID), b), "invalid-argument", "INVALID_REQUEST");
  const consentBase = { sid: SID, targetBundle: "legacy-b03e219", disclosureVersion: "q90-disclosure-v1", locale: "ko", coversReportAndProgram: true };
  for (const b of [{ ...consentBase, locale: "jp" }, { ...consentBase, disclosureVersion: "v0" }, { ...consentBase, coversReportAndProgram: "true" }, { ...consentBase, coversReportAndProgram: false }, { ...consentBase, consent: true }, { ...consentBase, priorInstanceId: "a b" }]) await expectHttps(call(q90.recordConsent, authed(UID), b), "invalid-argument", "INVALID_REQUEST");
  assert.equal(db.writes.length, 0);
  // validateBody unit: undefined optional fields are dropped, null kept
  assert.deepEqual(validateBody("planGeneration", { sid: SID, targetBundle: "legacy-b03e219", consentEventId: undefined, priorInstanceId: null }, UID), { sid: SID, targetBundle: "legacy-b03e219", priorInstanceId: null });
  assert.throws(() => validateBody("planGeneration", { sid: SID, targetBundle: "legacy-b03e219", uid: OTHER }, UID), (e) => e instanceof AdapterReject && e.code === "INVALID_REQUEST");
});

test("default OFF: generation callables -> unavailable FEATURE_DISABLED; readInstancePair still serves a saved instance", async () => {
  // first publish with the flag on, then flip it off and read
  const st = state();
  const { q90, db } = mk(st);
  const gen = await call(q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
  assert.deepEqual(Object.keys(gen).sort(), ["instanceId", "programOutputHash", "recovered", "reportOutputHash", "reused"]);
  const off = createQ90Callables({ onCall, HttpsError, retention: createRetention({ db, runBundle: okRunner, featureEnabled: () => false, ledgerPolicy: POLICY }) });
  for (const [k, body] of [["recordConsent", { sid: SID, targetBundle: "legacy-b03e219", disclosureVersion: "q90-disclosure-v1", locale: "ko", coversReportAndProgram: true }], ["planGeneration", { sid: SID, targetBundle: "legacy-b03e219" }], ["generateInstancePair", { sid: SID, targetBundle: "legacy-b03e219" }]]) {
    await expectHttps(call(off[k], authed(UID), body), "unavailable", "FEATURE_DISABLED");
  }
  // and the assembled default (no featureEnabled given) is OFF too
  const dflt = createQ90Callables({ onCall, HttpsError, retention: createRetention({ db, runBundle: okRunner, ledgerPolicy: POLICY }) });
  await expectHttps(call(dflt.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "unavailable", "FEATURE_DISABLED");
  // saved read with flag OFF and after the customer changed an answer
  await db.ref(`responses/${UID}/${SID}/answers/Q3`).set(1);
  const rd = await call(off.readInstancePair, authed(UID), { sid: SID, instanceId: gen.instanceId });
  assert.equal(rd.instanceId, gen.instanceId); assert.equal(rd.reportOutputHash, gen.reportOutputHash);
  assert.deepEqual(rd.report.sections[0], { id: "s", nul: null, empty: {} }); // authoritative payloadJson, not the RTDB view
  assert.equal(rd.program.meta.sourceReportSid, SID);
  // another uid cannot read it; unknown instance -> not-found
  await expectHttps(call(off.readInstancePair, authed(OTHER), { sid: SID, instanceId: gen.instanceId }), "not-found", "SAVED_INSTANCE_NOT_FOUND");
  await expectHttps(call(off.readInstancePair, authed(UID), { sid: SID, instanceId: "nope" }), "not-found", "SAVED_INSTANCE_NOT_FOUND");
});

test("plan preview never exposes raw answers, entitlement refs/evidence, idempotency key or snapshot", async () => {
  const { q90 } = mk();
  const plan = await call(q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
  assert.deepEqual(Object.keys(plan).sort(), ["action", "consentEventId", "entitlementSource", "entrypoint", "inputSnapshotHash", "locale", "originBundle", "priorInstanceId", "sid", "targetBundle", "upgrade"]);
  assert.equal(plan.entitlementSource, "additionalPayments"); assert.equal(plan.entrypoint, "regeneration");
  assertNoLeak(JSON.stringify(plan), "plan preview");
  assert.ok(!("inputSnapshot" in plan) && !("idempotencyKey" in plan) && !("entitlement" in plan) && !("uid" in plan));
});

test("module error mapping end-to-end: entitlement none -> permission-denied; not submitted -> failed-precondition; upgrade without consent -> failed-precondition; in-progress -> aborted; inconsistent pair -> data-loss", async () => {
  const noEnt = mk(state({ additionalPayments: {} }));
  await expectHttps(call(noEnt.q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "permission-denied", "ENTITLEMENT_NONE");
  const notSub = mk(state({ responses: { [UID]: { [SID]: { status: "draft", answers: {} } } } }));
  await expectHttps(call(notSub.q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "failed-precondition", "SESSION_NOT_SUBMITTED");
  const paidOnly = mk(state({ additionalPayments: {}, payments: { [UID]: { paid: true } } }));
  await expectHttps(call(paidOnly.q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "permission-denied", "ENTITLEMENT_UNVERIFIED");
  const legacy = mk(state({ reports: { [UID]: { [SID]: { engineVersion: "v4.1" } } }, q90Entitlements: { [UID]: { cohorts: { [SID]: { bundle: "legacy-b03e219", entrypoint: "initial-generation" } } } } }));
  await expectHttps(call(legacy.q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "q90-input-and-wording-v2" }), "failed-precondition", "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
  const unres = mk(state({ reports: { [UID]: { [SID]: { engineVersion: "v4.1" } } } }));
  await expectHttps(call(unres.q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "failed-precondition", "LEGACY_VERSION_UNRESOLVED");
  // in progress: fresh pending lock held by another attempt
  const { retention: r0 } = mk();
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const busy = mk(state({ generationLocks: { [p.idempotencyKey]: { state: "pending", attempt: 1, startedAt: 1_700_000_000_000 } } }));
  await expectHttps(call(busy.q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "aborted", "GENERATION_IN_PROGRESS");
  // partial pair -> data-loss; adapter adds no repair, no staging cleanup, no lock reopening
  const iid = "i".repeat(32);
  const partial = mk(state({ generationLocks: { [p.idempotencyKey]: { state: "complete", attempt: 1, instanceId: iid, completedAt: 1 } }, reportInstances: { [UID]: { [SID]: { [iid]: { instanceId: iid, uid: UID, sid: SID, bundleVersion: "legacy-b03e219", state: "published" } } } } }));
  const before = partial.db.snapshot();
  await expectHttps(call(partial.q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "data-loss", "PUBLISHED_PAIR_INCONSISTENT");
  assert.deepEqual(partial.db.snapshot(), before, "adapter/module must not touch stored state on an inconsistent pair");
});

test("no leak: HttpsError message/details and structured logs never contain answers, ledger fields, paths or module messages; logs carry requestId/fn/uidHash/sid/code/ms only", async () => {
  const { q90, logger, retention } = mk();
  // force a module error whose message embeds sensitive text
  retention.generateInstancePair = async () => { throw new RetentionError("ENTITLEMENT_REVOKED", `ref additionalPayments/${UID}/k1 PP-CAPTURE-SECRET ${SECRET_ANSWER}`); };
  const e = await expectHttps(call(q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "permission-denied", "ENTITLEMENT_REVOKED");
  assertNoLeak(e.message + JSON.stringify(e.details), "HttpsError");
  // unexpected error -> internal, errorType only
  retention.planGeneration = async () => { const x = new TypeError(`Cannot read ${SECRET_ANSWER}`); throw x; };
  const e2 = await expectHttps(call(q90.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "internal", "INTERNAL");
  assert.equal(e2.message, "Internal error.");
  const logText = JSON.stringify(logger.rows);
  assertNoLeak(logText, "logs");
  assert.ok(!logText.includes(UID), "raw uid must not be logged (hash only)");
  for (const [level, row] of logger.rows) {
    assert.ok(["info", "warn", "error"].includes(level));
    const keys = Object.keys(row.q90).sort();
    assert.ok(keys.every((k) => ["requestId", "fn", "uidHash", "sid", "code", "ms", "errorType"].includes(k)), `unexpected log key in ${keys}`);
    assert.equal(row.q90.uidHash, crypto.createHash("sha256").update(UID).digest("hex").slice(0, 16));
  }
  assert.equal(logger.rows.find(([, r]) => r.q90.code === "INTERNAL")[1].q90.errorType, "TypeError");
  assert.equal(logger.rows.find(([, r]) => r.q90.code === "INTERNAL")[0], "error");
  // a throwing logger never changes the outcome
  const { q90: q2 } = mk(null, {});
  const throwing = createQ90Callables({ onCall, HttpsError, logger: { info() { throw new Error("sink"); }, warn() { throw new Error("sink"); }, error() { throw new Error("sink"); } }, retention: mk().retention });
  const ok = await call(throwing.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
  assert.ok(ok.instanceId); void q2;
});

test("[3868952 A] assembly: factory never touches DB or bundles; missing/corrupt bundles/ leaves readInstancePair working and blocks generation only (no engine run for saved read)", async () => {
  const vendor = require("../scripts/vendor-bundles.cjs");
  const fs = require("fs"), path = require("path");
  // (1) owner's non-destructive probe: db.ref throws on access, bundleRoot does not exist -> factory must still construct
  const poisonDb = { ref() { throw new Error("DB must not be touched at construction"); } };
  let created = false, q90;
  q90 = createQ90Callables({ onCall, HttpsError, assemble: { db: poisonDb, runnerOptions: { bundleRoot: "/nonexistent/q90-bundles-" + Date.now() } } });
  created = true;
  assert.ok(created && typeof q90.readInstancePair === "function" && typeof q90.generateInstancePair === "function");
  // (2) prepare a normal saved pair on a fake DB with a stub runner, then serve it through an adapter whose vendored
  //     bundles are MISSING and one whose bundles are TAMPERED: read succeeds, generate is blocked, no engine ran
  const db = createFakeDb(state());
  const seedRet = createRetention({ db, runBundle: okRunner, featureEnabled: () => true, ledgerPolicy: POLICY, now: (() => { let t = 1_700_000_000_000; return () => (t += 3); })() });
  const made = await seedRet.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "q90-adapter-lazy-"));
  try {
    const missing = path.join(tmp, "missing");
    const tampered = path.join(tmp, "tampered");
    const haveVendored = fs.existsSync(path.join(vendor.DEFAULT_OUT, "PIN.json"));
    if (haveVendored) { fs.cpSync(vendor.DEFAULT_OUT, tampered, { recursive: true }); fs.appendFileSync(path.join(tampered, "assets/js/bundles/legacy-b03e219/program-engine.js"), "\n//x\n"); }
    let n = 1;
    for (const bundleRoot of haveVendored ? [missing, tampered] : [missing]) {
      const newSid = `sid_00${++n}`; // fresh sid per iteration; the SID pair (and its complete lock) stays untouched
      const adapter = createQ90Callables({ onCall, HttpsError, assemble: { db, featureEnabled: () => true, ledgerPolicy: POLICY, runnerOptions: { bundleRoot } } });
      const writesBefore = db.writes.length;
      // saved read works, returns the authoritative payload, and runs no engine
      const rd = await call(adapter.readInstancePair, authed(UID), { sid: SID, instanceId: made.instanceId });
      assert.equal(rd.instanceId, made.instanceId); assert.deepEqual(rd.report.sections[0], { id: "s", nul: null, empty: {} });
      assert.equal(db.writes.length, writesBefore, "saved read must not write");
      // idempotent reuse of the already-published pair also needs no engine (module returns settled pair)
      const again = await call(adapter.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
      assert.equal(again.reused, true); assert.equal(again.instanceId, made.instanceId);
      // a NEW generation (other sid) needs the engine -> blocked with unavailable/BUNDLE_RUNNER_UNAVAILABLE, nothing published
      await db.ref(`responses/${UID}/${newSid}`).set({ status: "submitted", lang: "ko", answers: { Q3: 2 } });
      await db.ref(`additionalPayments/${UID}/k${n}`).set({ paid: true, status: "consumed", consumedBySid: newSid, orderID: "O2", captureID: "C2", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99", merchantId: "MERCH-LIVE" });
      const e = await expectHttps(call(adapter.generateInstancePair, authed(UID), { sid: newSid, targetBundle: "legacy-b03e219" }), "unavailable", "BUNDLE_RUNNER_UNAVAILABLE");
      assertNoLeak(e.message + JSON.stringify(e.details), "runner-unavailable error");
      assert.ok(!(e.message + JSON.stringify(e.details)).includes(bundleRoot), "bundle path must not leak");
      assert.equal(db.get(`reportInstances/${UID}/${newSid}`), undefined);
      // the failed attempt is fenced to failed (retryable), not left pending, and the read still works afterwards
      const locks = Object.values(db.get("generationLocks") || {}); assert.ok(locks.some((l) => l.state === "failed" && l.errorCode === "BUNDLE_RUNNER_UNAVAILABLE"));
      const rd2 = await call(adapter.readInstancePair, authed(UID), { sid: SID, instanceId: made.instanceId }); assert.equal(rd2.instanceId, made.instanceId);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("assembly API: healthy vendored runner is verified lazily on first generation and cached; default OFF when featureEnabled omitted", async () => {
  const vendor = require("../scripts/vendor-bundles.cjs");
  const fs = require("fs"), path = require("path");
  if (!fs.existsSync(path.join(vendor.DEFAULT_OUT, "PIN.json"))) return;
  const db = createFakeDb(state());
  const off = createQ90Callables({ onCall, HttpsError, assemble: { db, ledgerPolicy: POLICY } });
  await expectHttps(call(off.planGeneration, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" }), "unavailable", "FEATURE_DISABLED");
  // lazy: spy on createVendoredRunner via the module cache
  const runnerMod = require("../runner.js"); const orig = runnerMod.createVendoredRunner; let constructions = 0;
  runnerMod.createVendoredRunner = (...a) => { constructions++; return orig(...a); };
  try {
    const q = JSON.parse(fs.readFileSync(path.join(vendor.DEFAULT_OUT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
    const answers = {}; q.sections.flatMap((s) => s.questions).forEach((x, i) => { answers[x.id] = x.type === "likert" ? (i % 5) + 1 : x.type === "multi_choice" ? [x.options[i % x.options.length]] : x.options[i % x.options.length]; });
    const db2 = createFakeDb(state({ responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers, name: "S", submittedAt: "2026-01-01T00:00:00Z" }, sid_002: { status: "submitted", lang: "en", answers, name: "S", submittedAt: "2026-01-01T00:00:00Z" } } }, additionalPayments: { [UID]: { k1: { paid: true, status: "consumed", consumedBySid: SID, orderID: "O", captureID: "C", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99", merchantId: "MERCH-LIVE" }, k2: { paid: true, status: "consumed", consumedBySid: "sid_002", orderID: "O2", captureID: "C2", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99", merchantId: "MERCH-LIVE" } } } }));
    const on = createQ90Callables({ onCall, HttpsError, assemble: { db: db2, ledgerPolicy: POLICY, featureEnabled: () => true, now: () => Date.UTC(2026, 8, 9) } });
    assert.equal(constructions, 0, "no runner construction at factory time");
    await call(on.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
    assert.equal(constructions, 1);
    await call(on.generateInstancePair, authed(UID), { sid: "sid_002", targetBundle: "legacy-b03e219" });
    assert.equal(constructions, 1, "verified runner is cached");
  } finally { runnerMod.createVendoredRunner = orig; }
});

test("happy path through the callable surface with the assembled vendored runner (real engines, fake DB): generate -> reused -> read returns authoritative payload", async () => {
  const vendor = require("../scripts/vendor-bundles.cjs");
  const fs = require("fs"), path = require("path");
  if (!fs.existsSync(path.join(vendor.DEFAULT_OUT, "PIN.json"))) return;
  const q = JSON.parse(fs.readFileSync(path.join(vendor.DEFAULT_OUT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const answers = {}; q.sections.flatMap((s) => s.questions).forEach((x, i) => { answers[x.id] = x.type === "likert" ? (i % 5) + 1 : x.type === "multi_choice" ? [x.options[i % x.options.length]] : x.options[i % x.options.length]; });
  const db = createFakeDb(state({ responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers, name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" } } } }));
  const q90 = createQ90Callables({ onCall, HttpsError, assemble: { db, ledgerPolicy: POLICY, featureEnabled: () => true, now: () => Date.UTC(2026, 8, 9) } });
  const a = await call(q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(a.reused, false);
  const b = await call(q90.generateInstancePair, authed(UID), { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(b.reused, true); assert.equal(b.instanceId, a.instanceId);
  const rd = await call(q90.readInstancePair, authed(UID), { sid: SID, instanceId: a.instanceId });
  assert.ok(Array.isArray(rd.report.sections) && rd.report._v4Meta);
  assert.equal(rd.program.meta.sourceReportSid, SID);
  assert.equal(rd.program.meta.publishedAt, "2026.09.09");
  assert.equal(rd.program.meta.generatedAt, new Date(Date.UTC(2026, 8, 9)).toISOString());
  assert.equal(rd.reportOutputHash, a.reportOutputHash);
  // legacy nodes untouched by the whole flow
  assert.deepEqual(db.get("reports"), {}); assert.deepEqual(db.get("programs"), undefined);
});

test("shapePlan drops everything not on the allow-list even if the module adds fields later", () => {
  const p = shapePlan({ action: "x", sid: SID, targetBundle: "b", entrypoint: "regeneration", upgrade: false, originBundle: null, locale: "ko", consentEventId: null, priorInstanceId: null, entitlement: { source: "s", ref: "secret/ref", evidence: "e" }, sessionHash: "h", inputSnapshot: { answers: { Q1: SECRET_ANSWER } }, idempotencyKey: "k", newField: "leak" });
  assert.ok(!("newField" in p) && !("idempotencyKey" in p) && !("inputSnapshot" in p));
  assertNoLeak(JSON.stringify(p), "shapePlan");
});
