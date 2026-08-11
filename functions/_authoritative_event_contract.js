"use strict";

const crypto = require("crypto");

const SCHEMA_VERSION = "authority-event.v1";
const AUTHORITY = "server_verified";
const EVENT_NAMES = Object.freeze([
  "purchase_verified",
  "assessment_session_created",
  "assessment_submitted",
  "report_generated",
  "report_viewed",
  "program_generated",
  "action_completed",
  "return_visit",
  "refund_completed",
]);

const EVENT_NAME_SET = new Set(EVENT_NAMES);
const PII_KEY_PATTERN = /(^|_)(email|e_mail|name|phone|mobile|address|birth|user_agent|ip|free_text|answer|answers)(_|$)/i;
const ALLOWED_STRUCTURAL_KEYS = new Set(["event_name"]);

function requireString(value, field, maxLength = 200) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new TypeError(`${field} must be a non-empty string up to ${maxLength} characters`);
  }
  return value;
}

function assertNoPiiKeys(value, path = "event") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPiiKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (!ALLOWED_STRUCTURAL_KEYS.has(key) && PII_KEY_PATTERN.test(key)) {
      throw new TypeError(`PII-like field is not allowed: ${path}.${key}`);
    }
    assertNoPiiKeys(nested, `${path}.${key}`);
  }
}

function deterministicEventId(eventName, idempotencyParts) {
  requireString(eventName, "event_name", 80);
  if (!EVENT_NAME_SET.has(eventName)) throw new TypeError(`Unsupported event_name: ${eventName}`);
  if (!Array.isArray(idempotencyParts) || idempotencyParts.length === 0) {
    throw new TypeError("idempotency_parts must be a non-empty array");
  }
  const canonical = idempotencyParts.map((part, index) =>
    requireString(part, `idempotency_parts[${index}]`, 300)
  ).join("\u001f");
  const digest = crypto.createHash("sha256").update(`${eventName}\u001e${canonical}`, "utf8").digest("hex");
  return `${eventName}:${digest}`;
}

function buildAuthoritativeEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }

  const eventName = requireString(input.event_name, "event_name", 80);
  if (!EVENT_NAME_SET.has(eventName)) throw new TypeError(`Unsupported event_name: ${eventName}`);

  const event = {
    schema_version: SCHEMA_VERSION,
    event_name: eventName,
    event_id: deterministicEventId(eventName, input.idempotency_parts),
    occurred_at: requireString(input.occurred_at, "occurred_at", 40),
    subject_pseudo_id: requireString(input.subject_pseudo_id, "subject_pseudo_id", 128),
    authority: AUTHORITY,
    source_system: requireString(input.source_system, "source_system", 80),
    release_id: requireString(input.release_id, "release_id", 120),
    consent_version: requireString(input.consent_version, "consent_version", 120),
    links: Object.assign({}, input.links || {}),
    properties: Object.assign({}, input.properties || {}),
  };

  assertNoPiiKeys(event);
  return event;
}

module.exports = {
  AUTHORITY,
  EVENT_NAMES,
  SCHEMA_VERSION,
  assertNoPiiKeys,
  buildAuthoritativeEvent,
  deterministicEventId,
};
