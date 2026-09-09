"use strict";
// node --test functions/q90-retention/test/read-fallback-policy.test.js
// Synthetic boundary tests for the S1 failure -> legacy fallback decision (owner correction 3871771).
// No I/O, no DB, no engine: the policy is a pure function over S0/S1/legacy read results.

const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../read-fallback-policy.js");
const { ERROR_MAP } = require("../callable-adapter.js");

const UID = "synthetic-uid-A", OTHER = "synthetic-uid-B", SID = "sid_001";
const legacyRecord = (over = {}) => ({
  sid: SID, engineVersion: "v1.3", lang: "ko", manualOverrideHtml: null,
  report: { engineVersion: "v1.3", lang: "ko", _v4Meta: { fingerprint64: "abcdef0123456789" } },
  ...over,
});
const legacyOk = (over) => ({ status: "ok", pathUid: UID, record: legacyRecord(over) });
const s0With = (n = 1) => ({ status: "ok", instances: Array.from({ length: n }, (_, i) => ({ instanceId: `inst_${i}`, bundleVersion: "legacy-b03e219", createdAt: 1_760_000_000_000 + i })) });
const s0Absent = { status: "absent" };
const s1Err = (code, requestId = "req_1") => ({ status: "error", code, requestId });
const pairOk = { status: "ok", pair: { report: { s: 1 }, program: { m: 1 }, bundleVersion: "legacy-b03e219", reportOutputHash: "a".repeat(64), programOutputHash: "b".repeat(64) } };

test("every adapter HttpsError code has a failure class (closed map stays aligned with ERROR_MAP)", () => {
  const codes = new Set(Object.values(ERROR_MAP).map(([c]) => c));
  codes.add("internal");
  for (const c of codes) assert.notEqual(p.classifyS1Error(c), "unknown", `unclassified HttpsError code: ${c}`);
  assert.equal(p.classifyS1Error("made-up-code"), "unknown");
  // the four classes the owner named are distinct
  assert.equal(p.classifyS1Error("data-loss"), "integrity");
  assert.equal(p.classifyS1Error("unauthenticated"), "unauthenticated");
  assert.equal(p.classifyS1Error("permission-denied"), "no-right");
  assert.equal(p.classifyS1Error("unavailable"), "transient");
});

test("mayGenerate is false in every outcome (a read failure never triggers generation)", () => {
  const cases = [
    { tokenUid: null, sid: SID, s0: s0Absent, s1: null, legacy: legacyOk() },
    { tokenUid: UID, sid: SID, s0: s0With(), s1: pairOk, legacy: legacyOk() },
    { tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("data-loss"), legacy: legacyOk() },
    { tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("unavailable"), legacy: { status: "absent" } },
    { tokenUid: UID, sid: SID, s0: { status: "error", code: "network" }, s1: null, legacy: { status: "error", code: "network" } },
  ];
  for (const c of cases) assert.equal(p.decideSavedView(c).mayGenerate, false);
});

test("S1 ok -> render-instance, legacy not consulted, no notice", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: pairOk, legacy: { status: "error", code: "network" } });
  assert.equal(d.view, "render-instance"); assert.equal(d.notice, null); assert.equal(d.superseded, false);
});

test("S1 ok with malformed pair is treated as integrity, never rendered", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: { status: "ok", pair: { report: "x" } }, legacy: legacyOk() });
  assert.equal(d.view, "render-legacy"); assert.equal(d.failureClass, "integrity"); assert.equal(d.notice, "superseded-integrity");
});

test("no signed-in uid, or S1 unauthenticated -> auth-required; legacy is NOT shown even if readable", () => {
  const a = p.decideSavedView({ tokenUid: null, sid: SID, s0: s0Absent, s1: null, legacy: legacyOk() });
  assert.equal(a.view, "auth-required");
  const b = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("unauthenticated"), legacy: legacyOk() });
  assert.equal(b.view, "auth-required"); assert.equal(b.failureClass, "unauthenticated"); assert.equal(b.requestId, "req_1");
});

test("the four failure classes yield distinct notices on a verified legacy record, all flagged superseded", () => {
  const seen = new Map();
  for (const [code, cls, retry, support] of [["data-loss", "integrity", false, true], ["unauthenticated", "unauthenticated", false, false], ["permission-denied", "no-right", false, true], ["unavailable", "transient", true, false]]) {
    const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err(code), legacy: legacyOk() });
    if (cls === "unauthenticated") { assert.equal(d.view, "auth-required"); continue; }
    assert.equal(d.view, "render-legacy", code); assert.equal(d.failureClass, cls, code);
    assert.equal(d.superseded, true, code); assert.equal(d.notice, `superseded-${cls}`, code);
    assert.equal(d.allowRetry, retry, code); assert.equal(d.contactSupport, support, code);
    assert.ok(!seen.has(d.notice), "notices must differ"); seen.set(d.notice, code);
  }
});

test("not-found (instance listed by S0 but S1 cannot find it) is its own class, not transient", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("not-found"), legacy: legacyOk() });
  assert.equal(d.failureClass, "not-found"); assert.equal(d.allowRetry, false); assert.equal(d.contactSupport, true); assert.equal(d.view, "render-legacy");
});

test("pure legacy customer (S0 absent, S1 not attempted) renders legacy with no notice", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0Absent, s1: null, legacy: legacyOk() });
  assert.equal(d.view, "render-legacy"); assert.equal(d.notice, null); assert.equal(d.superseded, false); assert.equal(d.failureClass, null);
});

test("legacy record owned by another uid is withheld even when the read succeeded", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0Absent, s1: null, legacy: { status: "ok", pathUid: OTHER, record: legacyRecord() } });
  assert.equal(d.view, "withheld"); assert.equal(d.notice, "withheld-no-legacy"); assert.equal(d.contactSupport, true);
  assert.ok(d.legacyCheck.errors.includes("legacy path uid is not the caller"));
});

test("legacy record structurally broken (sid mismatch / report missing / lang / _v4Meta) is withheld", () => {
  const broken = [
    legacyRecord({ sid: "sid_999" }),
    legacyRecord({ report: null }),
    legacyRecord({ report: { lang: "ko" } }),                          // engineVersion missing
    legacyRecord({ lang: "fr", report: { engineVersion: "v1.3" } }),   // lang not ko|en, none inside report
    legacyRecord({ report: { engineVersion: "v1.3", _v4Meta: { fingerprint64: 42 } } }),
    legacyRecord({ manualOverrideHtml: { html: "<b>" } }),
    "not-an-object",
  ];
  for (const record of broken) {
    const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("unavailable"), legacy: { status: "ok", pathUid: UID, record } });
    assert.equal(d.view, "withheld", JSON.stringify(record).slice(0, 60));
    assert.equal(d.notice, "withheld-superseded-transient");
    assert.equal(d.superseded, true); assert.equal(d.legacyCheck.ok, false); assert.equal(d.legacyCheck.integrity, "structural-only");
  }
});

test("legacy absent or unreadable while an instance exists but S1 fails -> withheld with superseded notice, retry only for transient", () => {
  const t = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("unavailable"), legacy: { status: "absent" } });
  assert.equal(t.view, "withheld"); assert.equal(t.notice, "withheld-superseded-transient"); assert.equal(t.allowRetry, true);
  const i = p.decideSavedView({ tokenUid: UID, sid: SID, s0: s0With(), s1: s1Err("data-loss"), legacy: { status: "error", code: "permission-denied" } });
  assert.equal(i.view, "withheld"); assert.equal(i.notice, "withheld-superseded-integrity"); assert.equal(i.allowRetry, false); assert.equal(i.contactSupport, true);
});

test("S0 itself failing (network) with a verified legacy record renders legacy, flagged transient, not superseded", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: SID, s0: { status: "error", code: "network" }, s1: null, legacy: legacyOk() });
  assert.equal(d.view, "render-legacy"); assert.equal(d.failureClass, "transient"); assert.equal(d.superseded, false); assert.equal(d.notice, "legacy-transient"); assert.equal(d.allowRetry, true);
});

test("malformed sid is a caller bug: withheld, support flagged, nothing read", () => {
  const d = p.decideSavedView({ tokenUid: UID, sid: "../x", s0: s0With(), s1: pairOk, legacy: legacyOk() });
  assert.equal(d.view, "withheld"); assert.equal(d.failureClass, "caller-bug"); assert.equal(d.notice, "invalid-sid");
});

test("checkLegacyRecord never claims cryptographic integrity", () => {
  const ok = p.checkLegacyRecord({ tokenUid: UID, pathUid: UID, sid: SID, record: legacyRecord() });
  assert.deepEqual(ok, { ok: true, errors: [], integrity: "structural-only" });
});
