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
const paypalAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "PP-ORDER", captureID: "PP-CAPTURE", provider: "paypal", source: "paypal", env: "live", currency: "USD", amount: "14.99", merchantId: "MERCH-LIVE", ...over });
const paypleCpayAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "pp_1", captureID: "", provider: "payple", source: "payple-cpay", oid: "OID1", payerId: "PAYER1", env: "live", currency: "KRW", amount: "19900", cstId: "CST-LIVE", ...over });
const paypleLinkAdd = (over) => ({ paid: true, status: "unused", consumedBySid: null, orderID: "pp_2", captureID: "", provider: "payple", source: "payple-link", intentTs: 1, env: "live", currency: "KRW", amount: "19900", ...over });
// production-shaped ledger policy used by the tests (the module default accepts nothing)
const POLICY = { acceptedEnvs: ["live"], acceptedCurrencies: ["USD", "KRW"], minAmount: 1, acceptedPaypalMerchantIds: ["MERCH-LIVE"], acceptedPaypleCstIds: ["CST-LIVE"] };

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
  const r = createRetention({ db, now: () => (clock.t += 1), runBundle: okRunner, featureEnabled: () => true, ledgerPolicy: POLICY, ...extra });
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
  const r = createRetention({ db, runBundle: okRunner, ledgerPolicy: POLICY });
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
  const r = createRetention({ db, now: () => 42, runBundle: okRunner, featureEnabled: () => true, ledgerPolicy: POLICY }); // frozen clock
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
    const r = createRetention({ db, now: () => 42, runBundle: okRunner, featureEnabled: () => true, ledgerPolicy: POLICY });
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
  const shared = { db, now: () => (clock.t += 1), featureEnabled: () => true, ledgerPolicy: POLICY };
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

// ─────────────── C3: ledger policy (env / currency / amount / merchant) ───────────────
test("[C3] no ledgerPolicy injected -> module default accepts NOTHING, even a perfect live entry", async () => {
  const db = createFakeDb(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: SID }) } } }));
  const r = createRetention({ db, runBundle: okRunner, featureEnabled: () => true });
  assert.equal((await r.resolveEntitlement(UID, SID)).ok, false);
});
test("[C3] env sandbox/test/missing -> refused even when consumed by this sid", async () => {
  for (const env of ["sandbox", "test", undefined, "LIVE"]) {
    const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: SID, env }) } } }));
    assert.equal((await r.resolveEntitlement(UID, SID)).ok, false, "env=" + env);
  }
});
test("[C3] wrong currency / zero or non-numeric amount / foreign merchant -> refused", async () => {
  const cases = [{ currency: "EUR" }, { amount: "0" }, { amount: "abc" }, { amount: undefined }, { merchantId: "MERCH-OTHER" }, { merchantId: undefined }];
  for (const c of cases) {
    const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypalAdd({ status: "consumed", consumedBySid: SID, ...c }) } } }));
    assert.equal((await r.resolveEntitlement(UID, SID)).ok, false, JSON.stringify(c));
  }
  const { r: rp } = mk(baseState({ additionalPayments: { [UID]: { a: paypleCpayAdd({ status: "consumed", consumedBySid: SID, cstId: "CST-OTHER" }) } } }));
  assert.equal((await rp.resolveEntitlement(UID, SID)).ok, false);
});
test("[C3] accepted entry records env on the entitlement so instances carry it", async () => {
  const { r } = mk(baseState({ additionalPayments: { [UID]: { a: paypleCpayAdd({ status: "consumed", consumedBySid: SID }) } } }));
  const e = await r.resolveEntitlement(UID, SID); assert.equal(e.ok, true); assert.equal(e.env, "live");
});

// ─────────────── C1: complete != published ───────────────
// A reads step-0 (lock null), then — before A's acquire transaction — B acquires, builds, fences to complete,
// and STOPS before publish. A's acquire aborts on complete. Old code returned reused:true with no docs.
async function c1Scenario({ bPublishes }) {
  const st = entitled();
  const db = createFakeDb(st);
  const clock = { t: 1_000_000 };
  const shared = { db, now: () => (clock.t += 1), featureEnabled: () => true, ledgerPolicy: POLICY };
  // B: runs until just before publish (we stop it by making the publish update throw once), so lock=complete, staging present
  let bStopped = false;
  const rB = createRetention({ ...shared, runBundle: okRunner });
  const rA = createRetention({ ...shared, runBundle: okRunner });
  let fired = false;
  db.hooks.beforeTransaction = async (path) => {
    if (fired || !path.startsWith(PATHS.generationLocks)) return;
    fired = true;
    const stopB = async (p, op) => { if (op === "update" && p.startsWith(PATHS.reportInstances)) { bStopped = true; throw new Error("B paused before publish"); } };
    db.hooks.beforeWrite = stopB;
    try { await rB.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }); } catch (_) { /* B paused */ }
    db.hooks.beforeWrite = null;
    if (bPublishes) { /* B later completes its publish */ }
  };
  let aErr = null, aRes = null;
  try { aRes = await rA.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }); } catch (e) { aErr = e; }
  return { db, aErr, aRes, bStopped };
}
test("[C1] B complete-but-unpublished when A's acquire aborts -> A never returns bare success: it recovers from B's staging and publishes the pair", async () => {
  const { db, aErr, aRes, bStopped } = await c1Scenario({ bPublishes: false });
  assert.equal(bStopped, true);
  assert.equal(aErr, null, aErr && aErr.stack);
  assert.equal(aRes.reused, true); assert.equal(aRes.recovered, true);
  assert.ok(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${aRes.instanceId}`) && db.get(`${PATHS.programInstances}/${UID}/${SID}/${aRes.instanceId}`), "both docs exist before success was returned");
  assert.equal(countInstances(db), 1);
  assert.equal(db.get(`${PATHS.generationLocks}`)[Object.keys(db.get(PATHS.generationLocks))[0]].attempt, 1, "B's attempt; A never acquired");
});
test("[C1] complete lock, no staging, no docs, winner fresh -> GENERATION_IN_PROGRESS (not success, not manual-review yet)", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const { db, r, clock } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "complete", attempt: 1, instanceId: "x".repeat(32), completedAt: 1_000_000 } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "GENERATION_IN_PROGRESS");
  clock.t += LOCK_TTL_MS + 5;
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "LOCK_COMPLETE_WITHOUT_ARTIFACT");
  assert.equal(db.writes.length, 0);
});
test("[C1] only the report doc exists (program missing) -> inconsistent pair, never overwritten", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const iid = "y".repeat(32);
  const { r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "complete", attempt: 1, instanceId: iid, completedAt: 1_000_000 } }, reportInstances: { [UID]: { [SID]: { [iid]: { instanceId: iid, uid: UID, sid: SID, bundleVersion: "legacy-b03e219", state: "published", outputHash: H64("1"), bundleHash: H64("b") } } } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "PUBLISHED_PAIR_INCONSISTENT");
});
test("[C1] pair exists but program points at a different report hash -> PUBLISHED_PAIR_INCONSISTENT (manual review), no rewrite", async () => {
  const st = entitled(); const { r: r0 } = mk(st);
  const p = await r0.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const iid = "z".repeat(32);
  const doc = (kind, extra) => ({ instanceId: iid, uid: UID, sid: SID, bundleVersion: "legacy-b03e219", state: "published", outputHash: H64("1"), bundleHash: H64("b"), kind, ...extra });
  const { db, r } = mk({ ...st, generationLocks: { [p.idempotencyKey]: { state: "complete", attempt: 1, instanceId: iid, completedAt: 1 } },
    reportInstances: { [UID]: { [SID]: { [iid]: doc("report") } } }, programInstances: { [UID]: { [SID]: { [iid]: doc("program", { sourceReportInstanceId: iid, reportOutputHash: H64("2") }) } } } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "PUBLISHED_PAIR_INCONSISTENT");
  assert.equal(db.writes.length, 0);
});
test("[C1] happy-path success return carries hashes read back from the PUBLISHED docs", async () => {
  const { db, r } = mk(entitled());
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(res.reportOutputHash, db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`).outputHash);
  assert.equal(res.programOutputHash, db.get(`${PATHS.programInstances}/${UID}/${SID}/${res.instanceId}`).outputHash);
});

// ─────────────── C2: immutable input snapshot + pre-publish change detection ───────────────
test("[C2] engine consumes the plan snapshot, not a fresh read; answers changed DURING runBundle -> SESSION_CHANGED, nothing published", async () => {
  let engineSaw = null;
  const { db, r } = mk(entitled(), { runBundle: async (a) => { engineSaw = JSON.parse(JSON.stringify(a.answers)); db.get("responses")[UID][SID].answers.Q3 = 1; return okRunner(a); } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "SESSION_CHANGED");
  assert.deepEqual(engineSaw, { Q3: 4, Q6: ["x"] }, "engine received the immutable snapshot");
  assert.equal(countInstances(db), 0);
  assert.equal(Object.values(db.get(PATHS.generationLocks))[0].state, "failed");
});
test("[C2] answers changed between plan and acquire -> SESSION_CHANGED (pre-publish check), nothing published", async () => {
  const { db, r } = mk(entitled());
  let done = false;
  db.hooks.beforeTransaction = async (path) => { if (!done && path.startsWith(PATHS.generationLocks)) { done = true; db.get("responses")[UID][SID].answers.Q3 = 1; } };
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "SESSION_CHANGED");
  assert.equal(countInstances(db), 0);
});
test("[C2/P17] entitlement revoked during generation -> ENTITLEMENT_REVOKED, nothing published, ledger untouched", async () => {
  const { db, r } = mk(entitled(), { runBundle: async (a) => { db.get("additionalPayments")[UID].tok1.consumedBySid = "sid_other"; return okRunner(a); } });
  await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "ENTITLEMENT_REVOKED");
  assert.equal(countInstances(db), 0);
  assert.equal(legacyWrites(db).length, 0);
});
test("[C2] published instance carries inputSnapshotHash equal to sha256 of the responses node it was built from", async () => {
  const { db, r } = mk(entitled());
  const res = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const rep = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${res.instanceId}`);
  // Independent canonical fixture string, not the production serializer.
  const canonical = '{"answers":{"Q3":4,"Q6":["x"]},"lang":"ko","name":"Synthetic","status":"submitted","submittedAt":1}';
  assert.equal(rep.inputHashFormat, "q90-cjson-v1");
  assert.equal(rep.inputSnapshotHash, crypto.createHash("sha256").update(canonical).digest("hex"));
});

// New saved-instance contract. These are decision tests, not SDK fidelity tests.
test("[R8] saved JSON preserves null/empty containers; read ignores generation flag and changed responses", async () => {
  const report = { z: null, empty: {}, list: [null, [], {}, false, 0], a: "saved" };
  const { db, r } = mk(entitled(), { runBundle: async a => ({ ...await okRunner(a), report }) });
  const made = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  const doc = db.get(`${PATHS.reportInstances}/${UID}/${SID}/${made.instanceId}`);
  assert.equal(doc.payloadFormat, "q90-cjson-v1");
  assert.equal(crypto.createHash("sha256").update(doc.payloadJson).digest("hex"), doc.outputHash);
  db.get(`responses/${UID}/${SID}`).answers.Q3 = 1;
  const off = createRetention({ db });
  assert.deepEqual((await off.readInstancePair(UID, SID, made.instanceId)).report, report);
  await rejects(off.readInstancePair(OTHER, SID, made.instanceId), "SAVED_INSTANCE_NOT_FOUND");
  await rejects(off.readInstancePair("", SID, made.instanceId), "UNAUTHENTICATED");
  assert.equal(legacyWrites(db).length, 0);
});

test("[R8] JSON, compatibility view, claimed hash and pair metadata tampering each fail closed", async () => {
  for (const mutation of [
    d => { d.payloadJson += " "; },
    d => { d.report.sections[0].id = "tampered"; },
    d => { d.outputHash = H64("f"); },
    d => { d.locale = "en"; },
  ]) {
    const { db, r } = mk(entitled());
    const made = await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
    mutation(db.get(`${PATHS.reportInstances}/${UID}/${SID}/${made.instanceId}`));
    const before = db.writes.length;
    await rejects(r.readInstancePair(UID, SID, made.instanceId), "PUBLISHED_PAIR_INCONSISTENT");
    assert.equal(db.writes.length, before);
  }
});

test("[R8] recovery checks original staged input and entitlement evidence, not just a fresh plan", async () => {
  for (const change of ["input", "evidence"]) {
    const { db, r } = mk(entitled());
    let block = true;
    db.hooks.beforeWrite = (path, op) => { if (block && op === "update" && path.startsWith("reportInstances/")) throw Error("precommit failure"); };
    await assert.rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }));
    block = false;
    if (change === "input") db.get(`responses/${UID}/${SID}`).answers.Q3 = 1;
    else db.get(`additionalPayments/${UID}/tok1`).captureID = "DIFFERENT-CAPTURE";
    await rejects(r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), change === "input" ? "SESSION_CHANGED" : "ENTITLEMENT_REVOKED");
    assert.equal(countInstances(db), 0);
    assert.equal(legacyWrites(db).length, 0);
  }
});

test("[R9] changed entitlement evidence fails BEFORE completion fence; stable retry can acquire a new attempt", async () => {
  let mutate = true;
  const { db, r } = mk(entitled(), { runBundle: async a => {
    if (mutate) db.get(`additionalPayments/${UID}/tok1`).captureID = "NEW-SYNTHETIC-CAPTURE";
    return okRunner(a);
  } });
  const req = { sid: SID, targetBundle: "legacy-b03e219" };
  await rejects(r.generateInstancePair(UID, req), "ENTITLEMENT_REVOKED");
  assert.equal(countInstances(db), 0);
  const lock = Object.values(db.get(PATHS.generationLocks))[0];
  assert.equal(lock.state, "failed", "changed evidence must not leave an immutable complete lock");
  assert.equal(db.writes.some(w => w.op === "transaction" && w.value && w.value.state === "complete"), false);
  mutate = false;
  const result = await r.generateInstancePair(UID, req);
  assert.ok(result.instanceId);
  assert.equal(Object.values(db.get(PATHS.generationLocks))[0].attempt, 2);
  assert.equal(countInstances(db), 1);
  assert.equal(legacyWrites(db).length, 0);
});

test("[R8] runner receives server ISO timestamp and sid; invalid JSON payload is never published", async () => {
  let args;
  const { r } = mk(entitled(), { now: () => 1788868800000, runBundle: async a => { args = a; return okRunner(a); } });
  await r.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(args.sid, SID);
  assert.equal(args.publishedAt, new Date(1788868800000).toISOString());
  for (const bad of [undefined, NaN, Infinity]) {
    const { db, r: invalid } = mk(entitled(), { runBundle: async a => ({ ...await okRunner(a), report: { bad } }) });
    await rejects(invalid.generateInstancePair(UID, { sid: SID, targetBundle: "legacy-b03e219" }), "PAYLOAD_INVALID");
    assert.equal(countInstances(db), 0);
  }
});
