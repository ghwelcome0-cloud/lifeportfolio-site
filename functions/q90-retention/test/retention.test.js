"use strict";
// node --test functions/q90-retention/test/retention.test.js
// Synthetic data only. Proves module decision logic against an in-memory fake, NOT RTDB atomicity.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createRetention, RetentionError, PATHS, LOCK_TTL_MS } = require("../index.js");
const { createFakeDb } = require("./fake-db.js");

const UID = "synthetic-uid-A";
const OTHER = "synthetic-uid-B";
const SID = "sid_001";
const H64 = (c) => c.repeat(64);

// real additionalPayments shapes (functions/index.js writers)
const paypalAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "PP-ORDER", captureID: "PP-CAPTURE", provider: "paypal", source: "paypal", ...over });
const paypleCpayAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "pp_1", captureID: "", provider: "payple", source: "payple-cpay", oid: "OID1", payerId: "PAYER1", ...over });
const paypleLinkAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "pp_2", captureID: "", provider: "payple", source: "payple-link", intentTs: 1, ...over });

function baseState(over) {
  return {
    responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers: { Q3: 4, Q6: ["x"] }, name: "Synthetic", submittedAt: 1 } } },
    reports: {}, payments: {}, additionalPayments: {}, q90Entitlements: {},
    ...over,
  };
}
const okRunner = async ({ bundle, entrypoint }) => ({ report: { engineVersion: bundle, entrypoint, sections: [{ id: "s" }] }, program: { meta: { v: 1 } }, bundleHash: H64("b"), entrypointHash: H64("e"), bundleVersion: bundle, entrypoint });
function mk(state, extra = {}) {
  const db = createFakeDb(state);
  const clock = { t: 1_000_000 };
  const r = createRetention({ db, now: () => (clock.t += 1), runBundle: okRunner, featureEnabled: () => true, ...extra });
  return { db, r, clock };
}
const rejects = async (p, code) => { try { await p; assert.fail("expected " + code); } catch (e) { if (e && e.code === "ERR_ASSERTION") throw e; assert.ok(e instanceof RetentionError, "RetentionError expected, got " + (e && e.stack)); assert.equal(e.code, code); } };
const publicDocs = (db) => ({ reports: db.get(PATHS.reportInstances) || {}, programs: db.get(PATHS.programInstances) || {} });
const countInstances = (db) => Object.values(publicDocs(db).reports).flatMap((s) => Object.values(s)).flatMap((i) => Object.keys(i)).length;
const legacyWrites = (db) => db.writes.filter((w) => /^(reports|programs|payments|users)(\/|$)/.test(w.path) || (w.op === "update" && w.path === "" && Object.keys(w.value).some((k) => /^(reports|programs|payments|users)\//.test(k))));
const entitled = (over) => baseState({ additionalPayments: { [UID]: { tok1: paypalAdd({ status: "consumed", consumedBySid: SID }) } }, ...over });
const goodConsent = (over) => ({ actorUid: UID, sid: SID, targetBundle: "q90-input-and-wording-v2", disclosureVersion: "q90-disclosure-v1", locale: "ko", coversReportAndProgram: true, priorInstanceId: null, ...over });
const withCohort = (bundle, entrypoint, over) => entitled({ reports: { [UID]: { [SID]: { engineVersion: "v4.1", report: { keep: true } } } }, programs: { [UID]: { [SID]: { program: { keep: true } } } }, q90Entitlements: { [UID]: { cohorts: { [SID]: { bundle, entrypoint } } } }, ...over });

// ─────────────── feature flag / auth / uid safety ───────────────
test("default OFF: featureEnabled not provided -> FEATURE_DISABLED for plan AND consent", async () => {
  const db = createFakeDb(entitled());
  const r = createRetention({ db, runBundle: okRunner });
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "FEATURE_DISABLED");
  await rejects(r.recordConsent(UID, goodConsent()), "FEATURE_DISABLED");
  assert.equal(db.writes.length, 0);
});
test("uid safety: empty, path-breaking or over-long uid -> UNAUTHENTICATED", async () => {
  const { r } = mk(baseState());
  for (const bad of ["", "a/b", "a.b", "$x", "a#b", "a[b]", "x".repeat(129), undefined, 5]) await rejects(r.planGeneration(bad, { sid: SID, targetBundle: "legacy-b03e219" }), "UNAUTHENTICATED");
});

// ─────────────── entitlement matrix (W 3821811 + reviewer 6-7) ───────────────
test("payments/paid alone -> ENTITLEMENT_UNVERIFIED", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, createdAt: "x" } } }));
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, false); assert.equal(e.code, "ENTITLEMENT_UNVERIFIED");
});
test("payments with provider/orderID/captureID strings alone -> still UNVERIFIED", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, provider: "paypal", orderID: "O", captureID: "C" } } }));
  assert.equal((await r.resolveEntitlement(UID, SID)).code, "ENTITLEMENT_UNVERIFIED");
});
test("payments + server provider re-verification with reference -> accepted", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, provider: "paypal", orderID: "O", captureID: "C" } } }), { verifyProviderCapture: async (q) => ({ status: q.captureID === "C" ? "verified" : "mismatch", reference: "paypal:C" }) });
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, true); assert.equal(e.source, "payments+providerVerified"); assert.equal(e.evidence, "paypal:C");
});
test("verifier 'verified' WITHOUT a reference is not enough", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true, captureID: "C" } } }), { verifyProviderCapture: async () => ({ status: "verified" }) });
  assert.equal((await r.resolveEntitlement(UID, SID)).ok, false);
});
test("additionalPayments real schema: unused (any provider) -> NOT evidence for this sid", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd(), b: paypleCpayAdd(), c: paypleLinkAdd() } } }));
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, false); assert.equal(e.code, "ENTITLEMENT_NONE");
});
test("additionalPayments consumed by ANOTHER sid -> not ours", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: "sid_other" }) } } }));
  assert.equal((await r.resolveEntitlement(UID, SID)).ok, false);
});
test("additionalPayments paypal consumed by THIS sid (captureID present) -> accepted, evidence recorded", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: SID }) } } }));
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, true); assert.equal(e.source, "additionalPayments"); assert.equal(e.evidence, "paypal:PP-CAPTURE");
});
test("additionalPayments payple-cpay (server-confirmed, oid+payerId) consumed by this sid -> accepted", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypleCpayAdd({ status: "consumed", consumedBySid: SID }) } } }));
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, true); assert.equal(e.evidence, "payple:OID1");
});
test("additionalPayments payple-link (issued on client-writable payments/paid + intentTs) consumed by this sid -> REFUSED", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypleLinkAdd({ status: "consumed", consumedBySid: SID }) } } }));
  assert.equal((await r.resolveEntitlement(UID, SID)).ok, false);
});
test("additionalPayments paypal without captureID, or paid!=true -> refused", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: SID, captureID: "" }), b: paypalAdd({ status: "consumed", consumedBySid: SID, paid: false }) } } }));
  assert.equal((await r.resolveEntitlement(UID, SID)).ok, false);
});
test("q90Entitlements verified -> accepted; another uid's ledger never counts", async () => {
  const { r } = mk(baseState({ q90Entitlements: { [UID]: { status: "verified", source: "migration-x" } }, additionalPayments: { [OTHER]: { a: paypalAdd({ status: "consumed", consumedBySid: SID }) } } }));
  assert.equal((await r.resolveEntitlement(UID, SID)).source, "q90Entitlements");
  const { r: r2 } = mk(baseState({ additionalPayments: { [OTHER]: { a: paypalAdd({ status: "consumed", consumedBySid: SID }) } } }));
  assert.equal((await r2.resolveEntitlement(UID, SID)).code, "ENTITLEMENT_NONE");
});

// ─────────────── consent (P16, reviewer 5 + whitelist) ───────────────
test("consent: boolean-only, actor mismatch, program not covered, unknown bundle, unknown disclosure, bad locale", async () => {
  const { r } = mk(baseState());
  await rejects(r.recordConsent(UID, { actorUid: UID, consent: true, sid: SID }), "CONSENT_INVALID");
  await rejects(r.recordConsent(UID, goodConsent({ actorUid: OTHER })), "CONSENT_ACTOR_MISMATCH");
  await rejects(r.recordConsent(UID, goodConsent({ coversReportAndProgram: false })), "CONSENT_INVALID");
  await rejects(r.recordConsent(UID, goodConsent({ targetBundle: "latest" })), "UNKNOWN_GENERATION_VERSION");
  await rejects(r.recordConsent(UID, goodConsent({ disclosureVersion: "made-up" })), "CONSENT_INVALID");
  await rejects(r.recordConsent(UID, goodConsent({ locale: "jp" })), "CONSENT_INVALID");
});
test("consent: valid -> create-once record with serverTimestamp", async () => {
  const { db, r } = mk(baseState());
  const { consentEventId, record } = await r.recordConsent(UID, goodConsent());
  assert.equal(consentEventId.length, 32); assert.equal(typeof record.serverTimestamp, "number");
  assert.equal(db.get(`${PATHS.generationConsents}/${UID}/${consentEventId}`).locale, "ko");
  assert.equal(db.writes.filter((w) => w.op === "transaction").length, 1, "consent is written via create-once transaction");
});
test("[reviewer 5] two consents in the SAME ms (ko then en) -> two distinct ids, nothing overwritten", async () => {
  const db = createFakeDb(baseState());
  const r = createRetention({ db, now: () => 42, runBundle: okRunner, featureEnabled: () => true }); // frozen clock
  const a = await r.recordConsent(UID, goodConsent({ locale: "ko" }));
  const b = await r.recordConsent(UID, goodConsent({ locale: "en" }));
  assert.notEqual(a.consentEventId, b.consentEventId);
  const all = db.get(`${PATHS.generationConsents}/${UID}`);
  assert.equal(Object.keys(all).length, 2);
  assert.equal(all[a.consentEventId].locale, "ko"); assert.equal(all[b.consentEventId].locale, "en");
});
test("consent create-once: pre-existing record at the id -> CONSENT_ID_COLLISION, original untouched", async () => {
  const db = createFakeDb(baseState());
  const realRandom = crypto.randomBytes;
  crypto.randomBytes = () => Buffer.from("0000000000000000", "hex"); // force identical nonce
  try {
    const r = createRetention({ db, now: () => 42, runBundle: okRunner, featureEnabled: () => true });
    const a = await r.recordConsent(UID, goodConsent());
    await rejects(r.recordConsent(UID, goodConsent()), "CONSENT_ID_COLLISION");
    assert.deepEqual(db.get(`${PATHS.generationConsents}/${UID}/${a.consentEventId}`), a.record);
  } finally { crypto.randomBytes = realRandom; }
});

// ─────────────── plan (P02/P03/P05/P07/P18) ───────────────
test("unknown bundle -> UNKNOWN_GENERATION_VERSION (no fallback)", async () => {
  const { r } = mk(entitled());
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "v4.1" }), "UNKNOWN_GENERATION_VERSION");
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: undefined }), "UNKNOWN_GENERATION_VERSION");
});
test("session not submitted -> refused", async () => {
  const { r } = mk(entitled({ responses: { [UID]: { [SID]: { status: "draft" } } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "SESSION_NOT_SUBMITTED");
});
test("saved legacy report with NO cohort record -> LEGACY_VERSION_UNRESOLVED, saved report untouched", async () => {
  const { db, r } = mk(entitled({ reports: { [UID]: { [SID]: { engineVersion: "v4.1", report: {} } } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "LEGACY_VERSION_UNRESOLVED");
  assert.deepEqual(db.get(`reports/${UID}/${SID}`), { engineVersion: "v4.1", report: {} });
});
test("cohort with unknown entrypoint -> LEGACY_VERSION_UNRESOLVED", async () => {
  const { r } = mk(withCohort("legacy-b03e219", "mystery"));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "LEGACY_VERSION_UNRESOLVED");
});
test("[reviewer 4] same-bundle re-generation reproduces the cohort entrypoint (initial-generation), and the runner receives it", async () => {
  let seen = null;
  const { db, r } = mk(withCohort("legacy-b03e219", "initial-generation"), { runBundle: async (a) => { seen = a; return okRunner(a); } });
  const p = await r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(p.entrypoint, "initial-generation"); assert.equal(p.upgrade, false);
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(seen.entrypoint, "initial-generation");
  assert.equal(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`).entrypoint, "initial-generation");
});
test("upgrade or first generation uses 'regeneration' entrypoint", async () => {
  const { r } = mk(entitled());
  assert.equal((await r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" })).entrypoint, "regeneration");
  const st = withCohort("legacy-b03e219", "initial-generation"); const { r: r2 } = mk(st);
  const { consentEventId } = await r2.recordConsent(UID, goodConsent());
  assert.equal((await r2.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId })).entrypoint, "regeneration");
});
test("runner echoing a different entrypoint/bundle than requested -> GENERATION_INCOMPLETE, nothing public", async () => {
  const { db, r } = mk(withCohort("legacy-b03e219", "initial-generation"), { runBundle: async (a) => ({ ...(await okRunner(a)), entrypoint: "regeneration" }) });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_INCOMPLETE");
  assert.equal(countInstances(db), 0);
});
test("bundle change requires a matching recorded consent; foreign sid consent refused; consent on non-upgrade refused", async () => {
  const { r } = mk(withCohort("legacy-b03e219", "regeneration"));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2" }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
  const { consentEventId } = await r.recordConsent(UID, goodConsent({ sid: "sid_other" }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219", consentEventId }), "INVALID_REQUEST");
});
test("[reviewer] priorInstanceId comes from the consent record; a contradicting request value is refused", async () => {
  const { db, r } = mk(withCohort("legacy-b03e219", "regeneration"));
  const { consentEventId } = await r.recordConsent(UID, goodConsent({ priorInstanceId: "legacy_saved" }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId, priorInstanceId: "something_else" }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId });
  assert.equal(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`).priorInstanceId, "legacy_saved");
  // consent recorded null prior -> request cannot inject one
  const { consentEventId: c2 } = await r.recordConsent(UID, goodConsent({ priorInstanceId: null }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId: c2, priorInstanceId: "legacy_saved" }), "EXPLICIT_UPGRADE_CONSENT_REQUIRED");
});
test("entitlement failure blocks the plan even when everything else is valid", async () => {
  const { r } = mk(baseState({ payments: { [UID]: { paid: true } } }));
  await rejects(r.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "ENTITLEMENT_UNVERIFIED");
});

// ─────────────── generate: happy path, idempotency, ordering ───────────────
test("happy path: fence commits lock BEFORE any public write; ONE multi-location publish; staging cleared; legacy untouched", async () => {
  const { db, r } = mk(entitled());
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.reused, false);
  const rep = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`), prog = db.get(`${PATHS.programInstances}/${UID}/${SID}/${res.instanceId}`);
  assert.ok(rep && prog);
  assert.equal(prog.sourceReportInstanceId, res.instanceId); assert.equal(prog.reportOutputHash, rep.outputHash);
  assert.equal(rep.entitlementSource, "additionalPayments"); assert.equal(rep.attempt, 1);
  assert.equal(db.get(`${PATHS.generationLocks}/${res.lockKey}`).state, "complete");
  assert.equal(db.get(PATHS.generationStaging), undefined);
  const pubIdx = db.writes.findIndex((w) => w.op === "update" && w.path === "" && Object.keys(w.value).some((k) => k.startsWith(PATHS.reportInstances)));
  const fenceIdx = db.writes.findIndex((w) => w.op === "transaction" && w.value && w.value.state === "complete");
  assert.ok(fenceIdx >= 0 && pubIdx > fenceIdx, "fence transaction precedes publish");
  assert.equal(db.writes.filter((w) => w.op === "update" && w.path === "").length, 1);
  assert.equal(legacyWrites(db).length, 0);
});
test("idempotent: same key -> reused instanceId, no new writes", async () => {
  const { db, r } = mk(entitled());
  const a = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const n = db.writes.length;
  const b = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(b.reused, true); assert.equal(b.instanceId, a.instanceId); assert.equal(db.writes.length, n);
});
test("in-flight fresh lock -> GENERATION_IN_PROGRESS, nothing written", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "pending", startedAt: 1_000_000, attempt: 1 } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_IN_PROGRESS");
  assert.equal(countInstances(db), 0); assert.equal(db.writes.length, 0);
});
test("stale pending lock is taken over with attempt+1; instanceId derives from attempt", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "pending", startedAt: 1, attempt: 1 } } });
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(db.get(`${PATHS.generationLocks}/${res.lockKey}`).attempt, 2);
  assert.equal(res.instanceId, crypto.createHash("sha256").update(`${p.idempotencyKey}|2`).digest("hex").slice(0, 32));
});

// ─────────────── reviewer 1-3: races and post-publish failures ───────────────
// Interleaving helper: attempt A's runBundle awaits; while it is suspended the clock jumps past TTL and
// attempt B (same key) runs to completion; then A resumes.
async function raceAB({ aFails } = {}) {
  const st = entitled();
  const db = createFakeDb(st);
  const clock = { t: 1_000_000 };
  const shared = { db, now: () => (clock.t += 1), featureEnabled: () => true };
  const rB = createRetention({ ...shared, runBundle: okRunner });
  let bResult = null;
  const rA = createRetention({ ...shared, runBundle: async (a) => {
    clock.t += LOCK_TTL_MS + 1;                                     // A's lock is now stale
    bResult = await rB.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }); // B takes over, completes
    if (aFails) throw new Error("A engine failure after B completed");
    return okRunner(a);
  } });
  let aErr = null, aResult = null;
  try { aResult = await rA.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }); } catch (e) { aErr = e; }
  return { db, aErr, aResult, bResult };
}
test("[reviewer 1] A suspended past TTL, B completes attempt 2, A succeeds late -> exactly ONE pair, lock stays complete@attempt2, A returns B's instance", async () => {
  const { db, aErr, aResult, bResult } = await raceAB();
  assert.equal(aErr, null);
  assert.equal(bResult.reused, false); assert.equal(bResult.instanceId.length, 32);
  assert.equal(aResult.reused, true); assert.equal(aResult.instanceId, bResult.instanceId);
  assert.equal(countInstances(db), 1);
  const lock = Object.values(db.get(PATHS.generationLocks))[0];
  assert.equal(lock.state, "complete"); assert.equal(lock.attempt, 2); assert.equal(lock.instanceId, bResult.instanceId);
  assert.equal(db.get(PATHS.generationStaging), undefined, "A's late staging is cleared, B's was cleared at publish");
});
test("[reviewer 2] A suspended past TTL, B completes, A fails -> B's publication and complete lock are untouched", async () => {
  const { db, aErr, bResult } = await raceAB({ aFails: true });
  assert.ok(aErr instanceof RetentionError); assert.equal(aErr.code, "GENERATION_FAILED");
  assert.equal(countInstances(db), 1);
  const lock = Object.values(db.get(PATHS.generationLocks))[0];
  assert.equal(lock.state, "complete"); assert.equal(lock.attempt, 2); assert.equal(lock.instanceId, bResult.instanceId);
  assert.ok(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${bResult.instanceId}`));
});
test("[reviewer 3] logger throws after a successful publish -> result is still success, lock stays complete, nothing reclassified", async () => {
  const { db, r } = mk(entitled(), { logger: { info() { throw new Error("log sink down"); }, warn() { throw new Error("log sink down"); } } });
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.reused, false);
  assert.equal(db.get(`${PATHS.generationLocks}/${res.lockKey}`).state, "complete");
  assert.ok(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`));
});
test("engine failure (no race) -> fenced fail: lock failed@attempt, staging cleared, nothing public", async () => {
  const { db, r } = mk(entitled(), { runBundle: async () => { throw new Error("engine blew up"); } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_FAILED");
  assert.equal(countInstances(db), 0);
  const lock = Object.values(db.get(PATHS.generationLocks))[0]; assert.equal(lock.state, "failed"); assert.equal(lock.attempt, 1);
  assert.equal(db.get(PATHS.generationStaging), undefined);
});
test("incomplete pair / non-hex hashes from runner -> GENERATION_INCOMPLETE, nothing public", async () => {
  const { db, r } = mk(entitled(), { runBundle: async (a) => ({ report: { a: 1 }, bundleHash: H64("b"), entrypointHash: H64("e"), bundleVersion: a.bundle, entrypoint: a.entrypoint }) });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_INCOMPLETE");
  const { db: db2, r: r2 } = mk(entitled(), { runBundle: async (a) => ({ ...(await okRunner(a)), bundleHash: "not-hex" }) });
  await rejects(r2.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_INCOMPLETE");
  assert.equal(countInstances(db), 0); assert.equal(countInstances(db2), 0);
});
test("[reviewer TOCTOU] responses change between plan and engine run -> SESSION_CHANGED, nothing public", async () => {
  const { db, r } = mk(entitled());
  const orig = db.ref;
  r; // planGeneration reads responses once; mutate before the second read inside generate
  db.hooks.beforeTransaction = async (path) => { if (path.startsWith(PATHS.generationLocks) && !db.hooks._done) { db.hooks._done = true; db.get("responses")[UID][SID].answers.Q3 = 1; } };
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "SESSION_CHANGED");
  assert.equal(countInstances(db), 0);
  void orig;
});
test("publish write fails after fence -> lock complete, artifact stays in staging, next call recovers and publishes (no second instance)", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const instanceId = crypto.createHash("sha256").update(`${p.idempotencyKey}|1`).digest("hex").slice(0, 32);
  const { db, r } = mk(st);
  db.failOn.paths.add(`${PATHS.reportInstances}/${UID}/${SID}/${instanceId}`);
  let err = null; try { await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }); } catch (e) { err = e; }
  assert.ok(err, "publish failure surfaces to the caller");
  assert.equal(countInstances(db), 0);
  assert.equal(db.get(`${PATHS.generationLocks}/${p.idempotencyKey}`).state, "complete", "fence already committed; not reclassified as failed");
  assert.ok(db.get(`${PATHS.generationStaging}/${p.idempotencyKey}/1`), "artifact retained in staging");
  db.failOn.paths.clear();
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.recovered, true); assert.equal(res.instanceId, instanceId);
  assert.equal(countInstances(db), 1); assert.equal(db.get(PATHS.generationStaging), undefined);
});
test("complete lock with neither published doc nor staging -> LOCK_COMPLETE_WITHOUT_ARTIFACT (manual review), no new attempt", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "complete", attempt: 1, instanceId: "ghost" } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "LOCK_COMPLETE_WITHOUT_ARTIFACT");
  assert.equal(db.writes.length, 0);
});
test("upgrade path: consent + prior recorded on both docs; reports/programs/payments never written", async () => {
  const { db, r } = mk(withCohort("legacy-b03e219", "regeneration"));
  const { consentEventId } = await r.recordConsent(UID, goodConsent({ priorInstanceId: "legacy_saved" }));
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "q90-input-and-wording-v2", consentEventId });
  const rep = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`);
  assert.equal(rep.consentEventId, consentEventId); assert.equal(rep.priorInstanceId, "legacy_saved"); assert.equal(rep.bundleVersion, "q90-input-and-wording-v2"); assert.equal(rep.entrypoint, "regeneration");
  assert.deepEqual(db.get(`reports/${UID}/${SID}`), { engineVersion: "v4.1", report: { keep: true } });
  assert.deepEqual(db.get(`programs/${UID}/${SID}`), { program: { keep: true } });
  assert.equal(legacyWrites(db).length, 0);
});
