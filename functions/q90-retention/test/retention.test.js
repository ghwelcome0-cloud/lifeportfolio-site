"use strict";
// node --test functions/q90-retention/test/
// Synthetic data only. Proves module decision logic against an in-memory fake, NOT RTDB atomicity.

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRetention, RetentionError, PATHS } = require("../index.js");
const { createFakeDb } = require("./fake-db.js");

const UID = "synthetic-uid-A";
const OTHER = "synthetic-uid-B";
const SID = "sid_001";

function baseState(over) {
  return {
    responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers: { Q3: 4, Q6: ["x"] }, name: "Synthetic", submittedAt: 1 } } },
    reports: {},        // no legacy result by default -> first generation
    payments: {},
    additionalPayments: {},
    q90Entitlements: {},
    ...over,
  };
}
const okRunner = async ({ bundle }) => ({ report: { engineVersion: bundle, sections: [{ id: "s" }] }, program: { meta: { v: 1 } }, bundleHash: "b".repeat(64), entrypointHash: "e".repeat(64) });
const mk = (state, extra = {}) => {
  const db = createFakeDb(state);
  let t = 1_000_000;
  const r = createRetention({ db, now: () => (t += 1), runBundle: okRunner, featureEnabled: () => true, ...extra });
  return { db, r };
};
const rejects = async (p, code) => { try { await p; assert.fail("expected " + code); } catch (e) { assert.ok(e instanceof RetentionError, "RetentionError expected, got " + e); assert.equal(e.code, code); } };
const publicWrites = (db) => db.writes.filter((w) => JSON.stringify(w).includes(`"${PATHS.reportInstances}/`) || JSON.stringify(w).includes(`"${PATHS.programInstances}/`) || w.path.startsWith(PATHS.reportInstances) || w.path.startsWith(PATHS.programInstances));
const legacyWrites = (db) => db.writes.filter((w) => /(^|")(reports|programs|payments|users)\//.test(w.path) || /"(reports|programs|payments|users)\//.test(JSON.stringify(w.value || {})));

// ── feature flag / auth ──
test("default OFF: featureEnabled not provided -> FEATURE_DISABLED", async () => {
  const db = createFakeDb(baseState({ additionalPayments: { [UID]: { o1: { status: "captured", captureID: "c" } } } }));
  const r = createRetention({ db, runBundle: okRunner });
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "FEATURE_DISABLED");
});
test("uid must be the verified token uid (empty -> UNAUTHENTICATED)", async () => {
  const { r } = mk(baseState());
  await rejects(r.planGeneration("", { sid: SID, targetBundle: "legacy-b03e219" }), "UNAUTHENTICATED");
  await rejects(r.recordConsent(undefined, {}), "UNAUTHENTICATED");
});

// ── entitlement matrix (W 3821811) ──
test("payments/paid alone is NOT accepted (client-writable first write)", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, createdAt: "x" } } }));
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, false); assert.equal(e.code, "ENTITLEMENT_UNVERIFIED");
});
test("payments with provider/orderID/captureID strings alone is NOT accepted", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, provider: "paypal", orderID: "O", captureID: "C" } } }));
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, false); assert.equal(e.code, "ENTITLEMENT_UNVERIFIED");
});
test("payments + server provider re-verification -> accepted with evidence recorded", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, provider: "paypal", orderID: "O", captureID: "C" } } }), { verifyProviderCapture: async (q) => ({ status: q.captureID === "C" ? "verified" : "mismatch", reference: "paypal:C" }) });
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, true); assert.equal(e.source, "payments+providerVerified"); assert.equal(e.evidence, "paypal:C");
});
test("provider verifier mismatch -> still refused", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, captureID: "WRONG" } } }), { verifyProviderCapture: async () => ({ status: "mismatch" }) });
  assert.equal((await r.resolveEntitlement(UID)).ok, false);
});
test("additionalPayments captured (server-only ledger) -> accepted", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { o1: { status: "captured", captureID: "c" } } } }));
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, true); assert.equal(e.source, "additionalPayments");
});
test("additionalPayments pending/unknown status -> refused", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { o1: { status: "pending", captureID: "c" } } } }));
  assert.equal((await r.resolveEntitlement(UID)).ok, false);
});
test("q90Entitlements verified allowlist -> accepted", async () => {
  const { r } = mk(baseState({ q90Entitlements: { [UID]: { status: "verified", source: "migration-2026-09" } } }));
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, true); assert.equal(e.source, "q90Entitlements");
});
test("no evidence -> ENTITLEMENT_NONE; another uid's ledger never counts", async () => {
  const { r } = mk(baseState({ additionalPayments: { [OTHER]: { o1: { status: "captured", captureID: "c" } } } }));
  const e = await r.resolveEntitlement(UID);
  assert.equal(e.ok, false); assert.equal(e.code, "ENTITLEMENT_NONE");
});

// ── consent (P16) ──
const goodConsent = () => ({ actorUid: UID, sid: SID, targetBundle: "q90-input-and-wording-v2", disclosureVersion: "disc-v1", locale: "ko", coversReportAndProgram: true, priorInstanceId: null });
test("consent: boolean-only rejected", async () => { const { r } = mk(baseState()); await rejects(r.recordConsent(UID, { actorUid: UID, consent: true, sid: SID }), "CONSENT_INVALID"); });
test("consent: actorUid mismatch rejected", async () => { const { r } = mk(baseState()); await rejects(r.recordConsent(UID, { ...goodConsent(), actorUid: OTHER }), "CONSENT_ACTOR_MISMATCH"); });
test("consent: must cover report AND program", async () => { const { r } = mk(baseState()); await rejects(r.recordConsent(UID, { ...goodConsent(), coversReportAndProgram: false }), "CONSENT_INVALID"); });
test("consent: unknown bundle rejected", async () => { const { r } = mk(baseState()); await rejects(r.recordConsent(UID, { ...goodConsent(), targetBundle: "latest" }), "UNKNOWN_GENERATION_VERSION"); });
test("consent: valid -> server timestamp recorded under generationConsents/{uid}", async () => {
  const { db, r } = mk(baseState());
  const { consentEventId, record } = await r.recordConsent(UID, goodConsent());
  assert.ok(consentEventId.length === 32);
  assert.equal(typeof record.serverTimestamp, "number");
  assert.deepEqual(db.get(`${PATHS.generationConsents}/${UID}/${consentEventId}`).targetBundle, "q90-input-and-wording-v2");
});

// ── plan (P02/P03/P05/P07) ──
test("unknown bundle -> UNKNOWN_GENERATION_VERSION (no fallback to latest/legacy)", async () => {
  const { r } = mk(baseState()); await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "v4.1" }), "UNKNOWN_GENERATION_VERSION");
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: undefined }), "UNKNOWN_GENERATION_VERSION");
});
test("session not submitted -> refused", async () => {
  const { r } = mk(baseState({ responses: { [UID]: { [SID]: { status: "draft" } } }, additionalPayments: { [UID]: { o1: { status: "captured", captureID: "c" } } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "SESSION_NOT_SUBMITTED");
});
test("saved legacy report with NO server cohort record -> LEGACY_VERSION_UNRESOLVED (held, saved report keeps serving)", async () => {
  const { db, r } = mk(baseState({ reports: { [UID]: { [SID]: { engineVersion: "v4.1", report: {} } } }, additionalPayments: { [UID]: { o1: { status: "captured", captureID: "c" } } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "LEGACY_VERSION_UNRESOLVED");
  assert.deepEqual(db.get(`reports/${UID}/${SID}`), { engineVersion: "v4.1", report: {} }); // untouched
});
test("cohort recorded, same bundle -> no consent needed; different bundle -> consent required", async () => {
  const state = baseState({ reports: { [UID]: { [SID]: { engineVersion: "v4.1", report: {} } } }, q90Entitlements: { [UID]: { status: "verified", source: "m", cohorts: { [SID]: { bundle: "legacy-b03e219", entrypoint: "initial-generation" } } } } });
  const { r } = mk(state);
  const p = await r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(p.upgrade, false); assert.equal(p.mayOverwriteExisting, false);
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2" }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
});
test("upgrade with a consent event that belongs to another sid/bundle/uid -> refused", async () => {
  const state = baseState({ reports: { [UID]: { [SID]: { report: {} } } }, q90Entitlements: { [UID]: { status: "verified", source: "m", cohorts: { [SID]: { bundle: "legacy-b03e219", entrypoint: "regeneration" } } } } });
  const { r } = mk(state);
  const { consentEventId } = await r.recordConsent(UID, { ...goodConsent(), sid: "sid_other" });
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
});
test("entitlement failure blocks the plan even when everything else is valid", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "ENTITLEMENT_UNVERIFIED");
});

// ── generate (P08/P13/P17) ──
const entitled = (over) => baseState({ additionalPayments: { [UID]: { o1: { status: "captured", captureID: "c" } } }, ...over });
test("happy path: staging first, then ONE multi-location publish of report+program+lock; staging cleared; legacy nodes untouched", async () => {
  const { db, r } = mk(entitled());
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.reused, false);
  const rep = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`);
  const prog = db.get(`${PATHS.programInstances}/${UID}/${SID}/${res.instanceId}`);
  assert.ok(rep && prog);
  assert.equal(prog.sourceReportInstanceId, res.instanceId);
  assert.equal(prog.reportOutputHash, rep.outputHash);
  assert.equal(rep.bundleVersion, "legacy-b03e219"); assert.equal(rep.entitlementSource, "additionalPayments");
  assert.equal(db.get(`${PATHS.generationLocks}/${res.lockKey}`).state, "complete");
  assert.equal(db.get(`${PATHS.generationStaging}/${res.lockKey}`), undefined);
  // publish happened in exactly one root update containing both public paths
  const pub = db.writes.filter((w) => w.op === "update" && w.path === "" && Object.keys(w.value).some((k) => k.startsWith(PATHS.reportInstances)));
  assert.equal(pub.length, 1);
  assert.ok(Object.keys(pub[0].value).some((k) => k.startsWith(PATHS.programInstances)));
  // nothing public before that update
  const idx = db.writes.indexOf(pub[0]);
  assert.equal(publicWrites(db).filter((w) => db.writes.indexOf(w) < idx).length, 0);
  assert.equal(legacyWrites(db).length, 0);
});
test("idempotent: same (uid,sid,bundle,consent) -> same instanceId, no second publish", async () => {
  const { db, r } = mk(entitled());
  const a = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const n = db.writes.length;
  const b = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(b.reused, true); assert.equal(b.instanceId, a.instanceId); assert.equal(db.writes.length, n);
});
test("in-flight lock (fresh pending) -> GENERATION_IN_PROGRESS, nothing written", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "pending", startedAt: 1_000_000, attempt: 1 } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_IN_PROGRESS");
  assert.equal(publicWrites(db).length, 0);
});
test("stale pending lock (older than TTL) is taken over with attempt+1", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "pending", startedAt: 1, attempt: 1 } } });
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.reused, false); assert.equal(db.get(`${PATHS.generationLocks}/${res.lockKey}`).attempt, 2);
});
test("engine failure mid-way -> lock failed, staging cleared, NOTHING under public nodes", async () => {
  const { db, r } = mk(entitled(), { runBundle: async () => { throw new Error("engine blew up"); } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_FAILED");
  assert.equal(publicWrites(db).length, 0);
  const lock = Object.values(db.get(PATHS.generationLocks))[0];
  assert.equal(lock.state, "failed");
  assert.equal(db.get(PATHS.generationStaging), undefined);
});
test("incomplete pair from runner (program missing) -> refused, nothing public", async () => {
  const { db, r } = mk(entitled(), { runBundle: async () => ({ report: { a: 1 }, bundleHash: "b".repeat(64), entrypointHash: "e".repeat(64) }) });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_INCOMPLETE");
  assert.equal(publicWrites(db).length, 0);
});
test("failed publish write -> lock failed, staging cleared, nothing public (fake: write failure on report path)", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk(st);
  // instanceId is derived from key+attempt; block the exact public path
  const crypto = require("crypto");
  const instanceId = crypto.createHash("sha256").update(`${p.idempotencyKey}|1`).digest("hex").slice(0, 32);
  db.failOn.paths.add(`${PATHS.reportInstances}/${UID}/${SID}/${instanceId}`);
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_FAILED");
  assert.equal(db.get(PATHS.reportInstances), undefined);
  assert.equal(db.get(PATHS.programInstances), undefined);
  assert.equal(Object.values(db.get(PATHS.generationLocks))[0].state, "failed");
});
test("upgrade path records consentEventId + priorInstanceId on both docs and never touches reports/programs", async () => {
  const st = entitled({ reports: { [UID]: { [SID]: { engineVersion: "v4.1", report: { keep: true } } } }, programs: { [UID]: { [SID]: { program: { keep: true } } } }, q90Entitlements: { [UID]: { status: "verified", source: "m", cohorts: { [SID]: { bundle: "legacy-b03e219", entrypoint: "regeneration" } } } } });
  const { db, r } = mk(st);
  const { consentEventId } = await r.recordConsent(UID, goodConsent());
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId, priorInstanceId: "legacy_saved" });
  const rep = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`);
  assert.equal(rep.consentEventId, consentEventId); assert.equal(rep.priorInstanceId, "legacy_saved"); assert.equal(rep.bundleVersion, "q90-input-and-wording-v2");
  assert.deepEqual(db.get(`reports/${UID}/${SID}`), { engineVersion: "v4.1", report: { keep: true } });
  assert.deepEqual(db.get(`programs/${UID}/${SID}`), { program: { keep: true } });
  assert.equal(legacyWrites(db).length, 0);
});
