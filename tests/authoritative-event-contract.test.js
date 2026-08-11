"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fixture = require("./fixtures/payment-authority.synthetic.json");
const {
  EVENT_NAMES,
  assertNoPiiKeys,
  buildAuthoritativeEvent,
  deterministicEventId,
} = require("../functions/_authoritative_event_contract");

function purchaseInput() {
  return {
    event_name: "purchase_verified",
    idempotency_parts: ["paypal", fixture.payments.paypal_initial.order_id],
    occurred_at: "2026-08-11T00:00:00.000Z",
    subject_pseudo_id: "pseudo-subject-001",
    source_system: "capturePaypalOrder",
    release_id: fixture.release_id,
    consent_version: fixture.consent_version,
    links: {
      uid: fixture.actors.paid_user,
      order_id: fixture.payments.paypal_initial.order_id,
    },
    properties: {
      provider: fixture.payments.paypal_initial.provider,
      amount_minor: 1499,
      currency: fixture.payments.paypal_initial.currency,
      payment_kind: "initial",
    },
  };
}

test("authority chain event names stay frozen in the approved order", () => {
  assert.deepEqual(EVENT_NAMES, [
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
});

test("same authority input produces the same event id", () => {
  const first = buildAuthoritativeEvent(purchaseInput());
  const second = buildAuthoritativeEvent(purchaseInput());
  assert.equal(first.event_id, second.event_id);
  assert.equal(first.authority, "server_verified");
  assert.equal(first.schema_version, "authority-event.v1");
});

test("different provider order produces a different event id", () => {
  const paypal = deterministicEventId("purchase_verified", ["paypal", "ORDER-001"]);
  const payple = deterministicEventId("purchase_verified", ["payple", "ORDER-001"]);
  assert.notEqual(paypal, payple);
});

test("PII-like keys are rejected at any depth", () => {
  assert.throws(() => assertNoPiiKeys({ properties: { customer_email: "synthetic@example.invalid" } }), /PII-like field/);
  assert.throws(() => buildAuthoritativeEvent({ ...purchaseInput(), properties: { answers: [1, 2, 3] } }), /PII-like field/);
});

test("unsupported client/legacy event names cannot enter the authority ledger", () => {
  assert.throws(() => buildAuthoritativeEvent({ ...purchaseInput(), event_name: "purchase" }), /Unsupported event_name/);
  assert.throws(() => buildAuthoritativeEvent({ ...purchaseInput(), event_name: "assessment_complete" }), /Unsupported event_name/);
});
