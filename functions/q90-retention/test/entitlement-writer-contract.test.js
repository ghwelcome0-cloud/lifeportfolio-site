"use strict";
// node --test functions/q90-retention/test/entitlement-writer-contract.test.js
// Synthetic contract tests: the shapes W's future writer / provider verifier must produce are exactly the shapes the
// retention module (index.js, unchanged) accepts, and the negative fixtures are rejected by both the validator and
// the module. No writes, no provider calls, no production.

const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../entitlement-writer-contract.js");
const { createRetention, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS } = require("../index.js");
const { createFakeDb } = require("./fake-db.js");

const UID = "synthetic-uid-A", SID = "sid_001";
const fx = c.synthesizeFixtures();
const okRunner = async ({ bundle, entrypoint }) => ({ report: { s: 1 }, program: { meta: { sourceReportSid: SID } }, bundleHash: "b".repeat(64), entrypointHash: "e".repeat(64), bundleVersion: bundle, entrypoint });
const base = (ent, extra = {}) => ({ responses: { [UID]: { [SID]: { status: "submitted", lang: "ko", answers: { Q3: 4 } } } }, q90Entitlements: ent ? { [UID]: ent } : {}, ...extra });

test("constants stay aligned with the module (bundles/entrypoints)", () => {
  assert.deepEqual([...c.KNOWN_BUNDLES], [...KNOWN_BUNDLES]);
  assert.deepEqual([...c.KNOWN_ENTRYPOINTS], [...KNOWN_ENTRYPOINTS]);
});

test("positive fixtures validate and are accepted by resolveEntitlement as source q90Entitlements", async () => {
  for (const [name, rec] of Object.entries(fx.positive)) {
    assert.deepEqual(c.checkEntitlementRecord(rec), { ok: true, errors: [] }, name);
    const r = createRetention({ db: createFakeDb(base(rec)), runBundle: okRunner, featureEnabled: () => true });
    const e = await r.resolveEntitlement(UID, SID);
    assert.equal(e.ok, true, name); assert.equal(e.source, "q90Entitlements"); assert.equal(e.evidence, rec.source);
  }
});

test("negative fixtures fail the validator (checker layer; rules v3 = server-only node without field validate, so the writer must apply this checker); the module also refuses wrong status/source", async () => {
  for (const [name, rec] of Object.entries(fx.negative)) {
    const v = c.checkEntitlementRecord(rec);
    assert.equal(v.ok, false, name); assert.ok(v.errors.length > 0, name);
  }
  // module view: wrong status -> not entitled; client-shaped source string is still "verified" to the reader, which is
  // exactly why rules v3 (client write:false) + the writer allow-list are the real gate — record this explicitly.
  const wrong = createRetention({ db: createFakeDb(base(fx.negative.wrongStatus)), runBundle: okRunner, featureEnabled: () => true });
  assert.equal((await wrong.resolveEntitlement(UID, SID)).ok, false);
  const clientShaped = createRetention({ db: createFakeDb(base(fx.negative.clientShaped)), runBundle: okRunner, featureEnabled: () => true });
  assert.equal((await clientShaped.resolveEntitlement(UID, SID)).ok, true, "reader trusts the node; only rules + writer identity prevent this shape from existing");
  assert.ok(c.checkEntitlementRecord(fx.negative.clientShaped).errors.some((e) => /approved writer/.test(e)));
});

test("cohort record: positive accepted by planGeneration for a saved legacy report; bad cohort -> LEGACY_VERSION_UNRESOLVED (saved report keeps serving)", async () => {
  const legacy = { reports: { [UID]: { [SID]: { engineVersion: "v4.1" } } } };
  const ok = createRetention({ db: createFakeDb(base(fx.positive.migrated, legacy)), runBundle: okRunner, featureEnabled: () => true });
  const plan = await ok.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" });
  assert.equal(plan.originBundle, "legacy-b03e219"); assert.equal(plan.entrypoint, "initial-generation");
  const bad = createRetention({ db: createFakeDb(base(fx.negative.badCohort, legacy)), runBundle: okRunner, featureEnabled: () => true });
  await assert.rejects(bad.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), (e) => e.code === "LEGACY_VERSION_UNRESOLVED");
  const none = createRetention({ db: createFakeDb(base(fx.positive.manualGrant, legacy)), runBundle: okRunner, featureEnabled: () => true });
  await assert.rejects(none.planGeneration(UID, { sid: SID, targetBundle: "legacy-b03e219" }), (e) => e.code === "LEGACY_VERSION_UNRESOLVED");
  assert.equal(c.checkCohortRecord(fx.positive.migrated.cohorts.sid_001).ok, true);
  assert.equal(c.checkCohortRecord({ bundle: "legacy-b03e219", entrypoint: "regeneration" }).ok, false, "audit fields required by the contract");
});

test("verifier contract: only {status:'verified', reference} opens payments/{uid}; every other shape stays closed in the module", async () => {
  const pay = { payments: { [UID]: { paid: true, provider: "paypal", orderID: "O", captureID: "C" } } };
  const mk = (res) => createRetention({ db: createFakeDb(base(null, pay)), runBundle: okRunner, featureEnabled: () => true, verifyProviderCapture: async () => res });
  assert.deepEqual(c.checkVerifierResult(fx.verifier.ok), { ok: true, verified: true, errors: [] });
  assert.equal((await mk(fx.verifier.ok).resolveEntitlement(UID, SID)).source, "payments+providerVerified");
  for (const [name, res] of Object.entries({ noRef: fx.verifier.noRef, mismatch: fx.verifier.mismatch })) {
    const v = c.checkVerifierResult(res); assert.equal(v.verified, false, name);
    const e = await mk(res).resolveEntitlement(UID, SID); assert.equal(e.ok, false, name); assert.equal(e.code, "ENTITLEMENT_UNVERIFIED");
  }
  assert.equal(c.checkVerifierResult(fx.verifier.leaky).ok, false);
  assert.equal(c.checkVerifierResult({ status: "verified", reference: "x", extra: 1 }).ok, false);
  // default (no verifier injected) is closed
  const dflt = createRetention({ db: createFakeDb(base(null, pay)), runBundle: okRunner, featureEnabled: () => true });
  assert.equal((await dflt.resolveEntitlement(UID, SID)).code, "ENTITLEMENT_UNVERIFIED");
  const d = c.describeVerifierContract();
  assert.ok(d.mustNot.length >= 5 && /read-only/.test(d.mustNot[1]));
  // W 3871081 (a): verified-only-if conditions cover custom_id / amount / currency / product / env / merchant / stored reference
  for (const kw of ["custom_id", "amount", "currency", "product", "environment", "merchant", "stored reference"]) assert.ok(d.verifiedOnlyIf.some((x) => x.includes(kw)), kw);
  assert.ok(/N03/.test(d.reusableAcceptanceTests));
  // adminClass: optional on rejections, forbidden on verified, unknown values rejected
  assert.equal(c.checkVerifierResult({ status: "mismatch", adminClass: "refunded" }).ok, true);
  assert.equal(c.checkVerifierResult({ status: "verified", reference: "x", adminClass: "refunded" }).ok, false);
  assert.equal(c.checkVerifierResult({ status: "mismatch", adminClass: "weird" }).ok, false);
  // module ignores adminClass (display-only): still closed
  const refunded = createRetention({ db: createFakeDb(base(null, pay)), runBundle: okRunner, featureEnabled: () => true, verifyProviderCapture: async () => ({ status: "mismatch", adminClass: "refunded", reason: "refunded" }) });
  assert.equal((await refunded.resolveEntitlement(UID, SID)).code, "ENTITLEMENT_UNVERIFIED");
});

test("the verifier is invoked with the token uid and the ledger fields only — never with body data", async () => {
  let seen = null;
  const r = createRetention({ db: createFakeDb(base(null, { payments: { [UID]: { paid: true, provider: "payple", orderID: "OID", captureID: "" } } })), runBundle: okRunner, featureEnabled: () => true, verifyProviderCapture: async (q) => { seen = q; return { status: "unavailable" }; } });
  await r.resolveEntitlement(UID, SID);
  assert.deepEqual(Object.keys(seen).sort(), ["captureID", "orderID", "provider", "uid"]);
  assert.equal(seen.uid, UID); assert.equal(seen.provider, "payple");
});
