"use strict";
/**
 * read-fallback-policy — the S1 (`q90ReadInstancePair`) failure → legacy fallback decision, as a pure function.
 *
 * Owner correction (Q90-R12, 3871771): "on failure always fall back to legacy" is NOT the contract. The loader must
 *   1. classify the S1 failure — integrity (data-loss) / unauthenticated / no right (permission-denied) /
 *      transient (unavailable, internal, deadline, network) / caller bug (invalid-argument) / not-found — and
 *      show a different notice per class;
 *   2. display the legacy saved report ONLY when the legacy record itself is confirmed as the caller's own and
 *      structurally intact (checkLegacyRecord); otherwise withhold it;
 *   3. when a newer saved edition exists (S0 listed an instance) but cannot be shown, say so — the customer must
 *      be told the original edition was superseded and is being shown (or withheld) in its place;
 *   4. never run or request a new generation from a read failure (`mayGenerate` is always false);
 *   5. (R13) an unauthenticated S0 ends the decision like an unauthenticated S1; when S0 listed an instance but S1 has
 *      not returned (not attempted / in flight / unrecognised shape) the view is withheld as `pending-saved-read` —
 *      the legacy edition is never shown silently in place of a newer saved one; `classifyS1Error` is a closed
 *      own-property schema (prototype keys and non-strings are "unknown").
 *
 * This module has no I/O. The loader (TL, post-PR294) feeds it the S0/S1/legacy read results and renders the
 * returned `view`/`notice`. Server integrity of an instance is decided by `readInstancePair` (payload hash + view
 * projection); this module never re-checks hashes on the client (seam rule 3). Legacy records carry no stored hash,
 * so "integrity" for them is ownership (path uid == token uid) + structural shape — reported as
 * `integrity: "structural-only"`, never as cryptographic.
 */

const VIEWS = Object.freeze([
  "auth-required",    // no verified uid, or S1 said unauthenticated: read nothing, show login
  "render-instance",  // S1 ok: render report/program from the callable response
  "render-legacy",    // legacy record verified: render today's saved report (+ notice when superseded)
  "withheld",         // nothing may be displayed: legacy unverified/absent and no instance readable
]);

// HttpsError code -> failure class. Closed map; anything else is "unknown".
const S1_CLASS = Object.freeze({
  "unauthenticated":   "unauthenticated",
  "permission-denied": "no-right",
  "data-loss":         "integrity",
  "not-found":         "not-found",
  "failed-precondition": "not-applicable",
  "invalid-argument":  "caller-bug",
  "unavailable":       "transient",
  "internal":          "transient",
  "deadline-exceeded": "transient",
  "resource-exhausted": "transient",
  "aborted":           "transient",
  "cancelled":         "transient",
  "network":           "transient", // loader-side: fetch failed / offline
});

// Per class: may the loader offer a manual retry of S1; does support need to hear about it.
const CLASS_POLICY = Object.freeze({
  "unauthenticated": { retry: false, support: false },
  "no-right":        { retry: false, support: true  },
  "integrity":       { retry: false, support: true  },
  "not-found":       { retry: false, support: true  },
  "not-applicable":  { retry: false, support: false },
  "caller-bug":      { retry: false, support: true  },
  "transient":       { retry: true,  support: false },
  "unknown":         { retry: false, support: true  },
  "pending":         { retry: true,  support: false }, // saved-first read not finished (R13-2); never a silent legacy render
});

const LANGS = Object.freeze(["ko", "en"]);
const isIdSafe = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v);
const isSafeUid = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(v);
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Legacy record gate. `pathUid` is the uid segment the loader actually read (`reports/{pathUid}/{sid}`), `tokenUid`
 * the verified auth uid. Structural checks mirror what report.html needs to render (report object, engineVersion,
 * lang) and what identifies the record (sid). Returns {ok, errors, integrity:"structural-only"}.
 */
function checkLegacyRecord({ tokenUid, pathUid, sid, record }) {
  const errors = [];
  if (!isSafeUid(tokenUid)) errors.push("no verified uid");
  if (pathUid !== tokenUid) errors.push("legacy path uid is not the caller");
  if (!isIdSafe(sid)) errors.push("sid malformed");
  if (!isPlainObject(record)) return { ok: false, errors: [...errors, "legacy record absent or not an object"], integrity: "structural-only" };
  if (record.sid !== sid) errors.push("legacy record sid does not match the requested sid");
  if (!isPlainObject(record.report)) errors.push("legacy report object missing");
  else {
    if (typeof record.report.engineVersion !== "string" || !record.report.engineVersion) errors.push("legacy report engineVersion missing");
    const m = record.report._v4Meta;
    if (m !== undefined && (!isPlainObject(m) || (m.fingerprint64 !== undefined && typeof m.fingerprint64 !== "string"))) errors.push("legacy _v4Meta malformed");
  }
  const lang = record.lang || (record.report && record.report.lang);
  if (!LANGS.includes(lang)) errors.push("legacy lang not ko|en");
  if (record.manualOverrideHtml != null && typeof record.manualOverrideHtml !== "string") errors.push("manualOverrideHtml malformed");
  return { ok: errors.length === 0, errors, integrity: "structural-only" };
}

const FAILURE_CLASSES = Object.freeze(["unauthenticated", "no-right", "integrity", "not-found", "not-applicable", "caller-bug", "transient", "unknown"]);
/** Closed schema: only a string that is an OWN key of S1_CLASS classifies; "__proto__"/"constructor"/"toString" and any
 * non-string are "unknown" (owner counterexample 3, R13). The result is always one of FAILURE_CLASSES. */
function classifyS1Error(code) {
  if (typeof code !== "string" || !Object.prototype.hasOwnProperty.call(S1_CLASS, code)) return "unknown";
  const cls = S1_CLASS[code];
  return FAILURE_CLASSES.includes(cls) ? cls : "unknown";
}

/**
 * decideSavedView — the whole loader decision for one (uid, sid) view.
 *
 * @param {object} p
 * @param {string|null} p.tokenUid           verified auth uid (null => not signed in)
 * @param {string} p.sid
 * @param {object} p.s0   {status:"ok", instances:[{instanceId,bundleVersion,createdAt}]} | {status:"absent"} | {status:"error", code}
 * @param {object|null} p.s1  null when S1 was not attempted (no instance); {status:"ok", pair} | {status:"error", code, requestId?}
 * @param {object} p.legacy {status:"ok", pathUid, record} | {status:"absent"} | {status:"error", code}
 * @returns {{view:string, notice:string|null, failureClass:string|null, superseded:boolean, allowRetry:boolean,
 *            contactSupport:boolean, requestId:string|null, mayGenerate:false, legacyCheck:object|null}}
 */
function decideSavedView({ tokenUid, sid, s0, s1, legacy }) {
  const base = { failureClass: null, superseded: false, allowRetry: false, contactSupport: false, requestId: null, mayGenerate: false, legacyCheck: null };
  if (!isSafeUid(tokenUid)) return { ...base, view: "auth-required", notice: "auth-required" };
  if (!isIdSafe(sid)) return { ...base, view: "withheld", notice: "invalid-sid", failureClass: "caller-bug", contactSupport: true };

  const instanceListed = !!(s0 && s0.status === "ok" && Array.isArray(s0.instances) && s0.instances.length > 0);

  // (R13-1) An unauthenticated S0 ends the decision exactly like an unauthenticated S1: nothing else is read or shown.
  if (s0 && s0.status === "error" && classifyS1Error(s0.code) === "unauthenticated") {
    return { ...base, view: "auth-required", notice: "auth-required", failureClass: "unauthenticated" };
  }
  // (R13-2) Saved-first is not complete until S1 has RETURNED. If S0 listed an instance and S1 was not attempted, is
  // still in flight, or ended in an unrecognised shape, the view is withheld as "pending" — the legacy edition must
  // never be shown silently in place of a newer saved edition. `s1.status === "error"` and `"ok"` are the only
  // finished states.
  if (instanceListed && !(s1 && (s1.status === "ok" || s1.status === "error"))) {
    return { ...base, view: "withheld", notice: "pending-saved-read", failureClass: "pending", superseded: true, contactSupport: false, allowRetry: true };
  }

  // S1 success: render the instance. No legacy involvement, no notice. The check here is a minimal shape check only
  // (report/program are objects); the client is bound to the server response by contract (seam rule 3) and does not
  // verify payload integrity — that is `readInstancePair`'s job. Stated limit, not a gap to close client-side.
  if (s1 && s1.status === "ok" && isPlainObject(s1.pair) && isPlainObject(s1.pair.report) && isPlainObject(s1.pair.program)) {
    return { ...base, view: "render-instance", notice: null };
  }

  // S1 failed or was not attempted. Classify first — unauthenticated ends the decision (nothing else may be read).
  let failureClass = null, requestId = null;
  if (s1 && s1.status === "error") {
    failureClass = classifyS1Error(s1.code);
    requestId = typeof s1.requestId === "string" ? s1.requestId : null;
    if (failureClass === "unauthenticated") return { ...base, view: "auth-required", notice: "auth-required", failureClass, requestId };
  } else if (s1 && s1.status === "ok") {
    failureClass = "integrity"; // ok status with a malformed pair: treat as integrity, never render
  } else if (s0 && s0.status === "error") {
    failureClass = classifyS1Error(s0.code); // S0 itself failed; classify the same way
  }
  const policy = failureClass ? CLASS_POLICY[failureClass] : null;

  // Legacy gate: displayed only when the record is the caller's and intact. This gate does not depend on WHY S1
  // failed — the failure class only chooses the notice/retry/support flags.
  const legacyCheck = legacy && legacy.status === "ok"
    ? checkLegacyRecord({ tokenUid, pathUid: legacy.pathUid, sid, record: legacy.record })
    : { ok: false, errors: [legacy && legacy.status === "error" ? `legacy read failed: ${legacy.code || "error"}` : "legacy record absent"], integrity: "structural-only" };

  const superseded = instanceListed; // a saved edition exists that is not being shown
  const common = {
    ...base, failureClass, requestId, superseded, legacyCheck,
    allowRetry: !!(policy && policy.retry),
    contactSupport: !!(policy && policy.support) || !legacyCheck.ok,
  };

  if (legacyCheck.ok) {
    // notice tells the customer what they are looking at and why; "superseded-*" means a newer edition exists.
    const notice = failureClass === null
      ? null                                     // pure legacy customer: no instance, plain legacy view, no notice
      : (superseded ? `superseded-${failureClass}` : `legacy-${failureClass}`);
    return { ...common, view: "render-legacy", notice };
  }
  // Nothing verifiable to show. Still no generation.
  return { ...common, view: "withheld", notice: superseded ? `withheld-superseded-${failureClass || "unknown"}` : `withheld-${failureClass || "no-legacy"}` };
}

module.exports = { decideSavedView, checkLegacyRecord, classifyS1Error, VIEWS, S1_CLASS, CLASS_POLICY, FAILURE_CLASSES };
