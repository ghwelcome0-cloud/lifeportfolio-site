"use strict";
/**
 * q90-retention — entitlement writer / provider verifier CONTRACT (interface definition + synthetic checkers).
 *
 * Q90-R11 / G10 remainder / API-CONTRACT R10. This file defines the seam between the retention module
 * (reader, TL/owner) and the two server-side producers that do not exist yet and that W/owner will own:
 *
 *   (1) q90Entitlements writer  — an approved migration / admin job that writes
 *       q90Entitlements/{uid} = { status:"verified", source, ... , cohorts/{sid}: { bundle, entrypoint, ... } }
 *   (2) provider verifier       — deps.verifyProviderCapture({uid, provider, orderID, captureID})
 *       -> { status:"verified", reference } | { status:"mismatch"|"unavailable"|"error", reason? }
 *
 * NOTHING here performs a write, calls a payment provider, or touches production. It exports:
 *   - the record SHAPES the reader accepts (documented as JSON-ish schemas + validators),
 *   - `checkEntitlementRecord(rec)`  / `checkCohortRecord(rec)` / `checkVerifierResult(res)` — pure validators
 *     W can run against their rules fixtures and their writer output,
 *   - `describeVerifierContract()`   — the exact call/return contract a live verifier must satisfy,
 *   - `synthesizeFixtures()`         — synthetic (non-customer) fixtures for W's rules tests and for the
 *     owner's reviewer, with positive and negative cases.
 *
 * Reader semantics these shapes plug into (index.js, unchanged):
 *   resolveEntitlement(uid, sid): q90Entitlements/{uid}.status==="verified" && non-empty source
 *     -> { ok, source:"q90Entitlements", ref, evidence: source }
 *   planGeneration(): a saved legacy report REQUIRES q90Entitlements/{uid}/cohorts/{sid} = { bundle, entrypoint }
 *     from KNOWN_BUNDLES/KNOWN_ENTRYPOINTS, else LEGACY_VERSION_UNRESOLVED (generation held, saved report serves).
 *   payments/{uid}.paid===true -> verifyProviderCapture(...) must return { status:"verified", reference } (non-empty
 *     string) or the path stays closed (ENTITLEMENT_UNVERIFIED).
 *
 * Rules interplay (W rules v3): q90Entitlements/** is client read/write:false — only Admin SDK writers can populate
 * it; nothing in the browser can grant itself an entitlement.
 */

const KNOWN_BUNDLES = Object.freeze(["legacy-b03e219", "q90-input-and-wording-v2"]);
const KNOWN_ENTRYPOINTS = Object.freeze(["initial-generation", "regeneration"]);
const WRITER_SOURCES = Object.freeze([
  "migration:legacy-paid-v1",   // one-time approved migration of already-paid legacy customers (owner order)
  "admin:manual-grant",         // operator grant with ticket reference (exception-support policy, G10)
  "provider:paypal-reverified", // written after a server-side PayPal capture re-check
  "provider:payple-reverified", // written after a server-side Payple confirm re-check
]);
const isNonEmptyString = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const isIdSafe = (v) => isNonEmptyString(v, 128) && /^[A-Za-z0-9_-]+$/.test(v);
const isMsEpoch = (v) => Number.isInteger(v) && v > 1_600_000_000_000 && v < 4_000_000_000_000;

/** q90Entitlements/{uid} — what the reader accepts and what an audit needs. Extra keys are rejected by THIS checker.
 * W rules v3 keep the node server-only (.read:false/.write:false) with no per-field validate (W 3871354 probe: extraKey
 * adminWrite=200), and the Admin SDK bypasses rules altogether — so rules can never control what a writer stores here
 * (owner 3871771). Writer self-validation is mandatory: run checkEntitlementRecord before every write, refuse on error. */
const ENTITLEMENT_SCHEMA = Object.freeze({
  status: '"verified" (only value the reader honours; anything else => not entitled)',
  source: `one of ${WRITER_SOURCES.join(" | ")} — non-empty; names the writer, never a client`,
  grantedAt: "ms epoch integer, server time of the write",
  grantedBy: "writer identity: service account / operator id (never a customer uid)",
  evidenceRef: "opaque pointer to the writer's evidence (ledger path, ticket id, provider capture id) — no secrets",
  cohorts: "optional map sid -> cohort record (below)",
});
/** q90Entitlements/{uid}/cohorts/{sid} — server-recorded origin of the saved legacy report (P03/P18). */
const COHORT_SCHEMA = Object.freeze({
  bundle: `one of ${KNOWN_BUNDLES.join(" | ")}`,
  entrypoint: `one of ${KNOWN_ENTRYPOINTS.join(" | ")}`,
  recordedAt: "ms epoch integer",
  recordedBy: "writer identity",
  basis: 'how the cohort was determined: "engine-sha-match" | "generatedAt-window" | "operator-attested" (audit only; reader ignores)',
});

function checkEntitlementRecord(rec) {
  const errors = [];
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return { ok: false, errors: ["record must be an object"] };
  const allowed = new Set(["status", "source", "grantedAt", "grantedBy", "evidenceRef", "cohorts"]);
  for (const k of Object.keys(rec)) if (!allowed.has(k)) errors.push(`unknown key ${k} (checker rejects; rules cannot — admin writes bypass rules, writer must self-validate)`);
  if (rec.status !== "verified") errors.push('status must be "verified"');
  if (!WRITER_SOURCES.includes(rec.source)) errors.push("source must name an approved writer");
  if (!isMsEpoch(rec.grantedAt)) errors.push("grantedAt must be a ms epoch integer");
  if (!isNonEmptyString(rec.grantedBy, 200) || /^[A-Za-z0-9]{20,}$/.test(rec.grantedBy) && rec.grantedBy.length === 28) errors.push("grantedBy must be a writer identity, not a customer uid");
  if (!isNonEmptyString(rec.evidenceRef, 300)) errors.push("evidenceRef required");
  if (/secret|token|key=|Bearer /i.test(String(rec.evidenceRef))) errors.push("evidenceRef must not carry secrets");
  if (rec.cohorts !== undefined) {
    if (!rec.cohorts || typeof rec.cohorts !== "object") errors.push("cohorts must be a map");
    else for (const [sid, c] of Object.entries(rec.cohorts)) { if (!isIdSafe(sid)) errors.push(`cohort sid ${sid} not id-safe`); const r = checkCohortRecord(c); if (!r.ok) errors.push(...r.errors.map((e) => `cohorts/${sid}: ${e}`)); }
  }
  return { ok: errors.length === 0, errors };
}
function checkCohortRecord(c) {
  const errors = [];
  if (!c || typeof c !== "object") return { ok: false, errors: ["cohort must be an object"] };
  const allowed = new Set(["bundle", "entrypoint", "recordedAt", "recordedBy", "basis"]);
  for (const k of Object.keys(c)) if (!allowed.has(k)) errors.push(`unknown key ${k}`);
  if (!KNOWN_BUNDLES.includes(c.bundle)) errors.push("bundle unknown");
  if (!KNOWN_ENTRYPOINTS.includes(c.entrypoint)) errors.push("entrypoint unknown");
  if (!isMsEpoch(c.recordedAt)) errors.push("recordedAt must be a ms epoch integer");
  if (!isNonEmptyString(c.recordedBy, 200)) errors.push("recordedBy required");
  if (!["engine-sha-match", "generatedAt-window", "operator-attested"].includes(c.basis)) errors.push("basis unknown");
  return { ok: errors.length === 0, errors };
}

/** deps.verifyProviderCapture contract. */
function describeVerifierContract() {
  return Object.freeze({
    call: "verifyProviderCapture({ uid, provider: 'paypal'|'payple'|null, orderID: string|null, captureID: string|null }) -> Promise<result>",
    accepted: "{ status: 'verified', reference: <non-empty string, provider-side id, e.g. 'paypal:<captureID>'> }",
    // W 3871081 (a): the module delegates ALL of these to the verifier; a live verifier may return 'verified' only when
    // every one holds against the PROVIDER's record (never against payments/{uid} fields, which are client-written).
    verifiedOnlyIf: [
      "provider record exists for orderID/captureID (PayPal capture / Payple confirm) and its status is COMPLETED/approved (not pending, voided, refunded, partially refunded, cancelled)",
      "provider custom_id / merchant reference === the token uid passed in the call (replay of another uid's capture => mismatch)",
      "provider amount === the configured product price and currency === configured currency (equality, not floor; single-price product)",
      "provider item / product code === the assessment product (a different SKU is a mismatch)",
      "provider environment === server-configured production env (a sandbox/test capture is never 'verified' for entitlement)",
      "provider merchant / cst id === the server-configured merchant (someone else's live merchant is a mismatch)",
      "if a stored reference exists on the server ledger for this uid, it equals the provider record (substituted reference => mismatch)",
      "reference returned is the PROVIDER's id, not a string echoed from the request",
    ],
    reusableAcceptanceTests: "W regression w-r11-entitlement-regression.mjs cases N03, N07–N12, N16 (custom_id, amount, currency, product, env, merchant, stored-reference) are the acceptance tests for these conditions; a verifier implementation must pass them before the module wires it",
    rejected: "{ status: 'mismatch' | 'unavailable' | 'error', reason?: string, adminClass?: 'refunded'|'cancelled'|'duplicate-evidence'|'admin-recovery' }  (reader treats ALL non-verified as closed; adminClass is display/ops-only, optional — W interface-note differences 3–5)",
    mustNot: [
      "trust any field of payments/{uid} (client-writable first write) — the call is the re-check, not the evidence",
      "write to payments/, additionalPayments/, q90Entitlements/ (the verifier is read-only; a writer is a separate order)",
      "return 'verified' without a reference",
      "include secrets or raw provider responses in `reason`",
      "be invoked from the browser or with a body-supplied uid",
    ],
    environment: "provider env (live/sandbox) comes from server config (PAYPAL_ENV param today); sandbox verifications are never 'verified' for production entitlement",
    idempotency: "pure read; repeated calls with the same input return the same status",
  });
}
function checkVerifierResult(res) {
  const errors = [];
  if (!res || typeof res !== "object") return { ok: false, verified: false, errors: ["result must be an object"] };
  const allowed = new Set(["status", "reference", "reason", "adminClass"]);
  for (const k of Object.keys(res)) if (!allowed.has(k)) errors.push(`unknown key ${k}`);
  if (!["verified", "mismatch", "unavailable", "error"].includes(res.status)) errors.push("status unknown");
  const verified = res.status === "verified" && isNonEmptyString(res.reference, 200);
  if (res.status === "verified" && !isNonEmptyString(res.reference, 200)) errors.push("verified requires a non-empty reference");
  if (res.reason !== undefined && (!isNonEmptyString(res.reason, 300) || /secret|token|Bearer |access_token/i.test(res.reason))) errors.push("reason must be a short string without secrets");
  if (res.adminClass !== undefined && !["refunded", "cancelled", "duplicate-evidence", "admin-recovery"].includes(res.adminClass)) errors.push("adminClass unknown");
  if (res.status === "verified" && res.adminClass !== undefined) errors.push("verified result cannot carry an adminClass");
  return { ok: errors.length === 0, verified, errors };
}

/** Synthetic fixtures (no customer data) for W rules tests and the reviewer. */
function synthesizeFixtures() {
  const t = 1_788_900_000_000;
  return Object.freeze({
    positive: {
      migrated: { status: "verified", source: "migration:legacy-paid-v1", grantedAt: t, grantedBy: "sa:q90-migration@synthetic", evidenceRef: "payments/synthetic-uid-A (paid:true, captureID present) reviewed batch 2026-09-01", cohorts: { sid_001: { bundle: "legacy-b03e219", entrypoint: "initial-generation", recordedAt: t, recordedBy: "sa:q90-migration@synthetic", basis: "engine-sha-match" } } },
      manualGrant: { status: "verified", source: "admin:manual-grant", grantedAt: t, grantedBy: "operator:faise", evidenceRef: "ticket:Q90-EX-0001" },
      reverified: { status: "verified", source: "provider:paypal-reverified", grantedAt: t, grantedBy: "sa:q90-verifier@synthetic", evidenceRef: "paypal:CAPTURE-SYNTH-1" },
    },
    negative: {
      clientShaped: { status: "verified", source: "client", grantedAt: t, grantedBy: "synthetic-uid-A", evidenceRef: "self" },
      wrongStatus: { status: "pending", source: "migration:legacy-paid-v1", grantedAt: t, grantedBy: "sa", evidenceRef: "x" },
      extraKey: { status: "verified", source: "migration:legacy-paid-v1", grantedAt: t, grantedBy: "sa", evidenceRef: "x", paid: true },
      secretInEvidence: { status: "verified", source: "admin:manual-grant", grantedAt: t, grantedBy: "operator:faise", evidenceRef: "access_token=abc" },
      badCohort: { status: "verified", source: "migration:legacy-paid-v1", grantedAt: t, grantedBy: "sa", evidenceRef: "x", cohorts: { sid_001: { bundle: "latest", entrypoint: "regeneration", recordedAt: t, recordedBy: "sa", basis: "engine-sha-match" } } },
    },
    verifier: {
      ok: { status: "verified", reference: "paypal:CAPTURE-SYNTH-1" },
      noRef: { status: "verified" },
      mismatch: { status: "mismatch", reason: "capture not found for order" },
      leaky: { status: "mismatch", reason: "access_token=... rejected" },
    },
  });
}

module.exports = { ENTITLEMENT_SCHEMA, COHORT_SCHEMA, WRITER_SOURCES, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS, checkEntitlementRecord, checkCohortRecord, checkVerifierResult, describeVerifierContract, synthesizeFixtures };
