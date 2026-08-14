import assert from "node:assert/strict";
import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalPayloadSha, deriveEventId, deriveIdempotencyKey, reduceShadowEvent } from "../scripts/l1a-shadow-ledger-lib.mjs";

const schema = JSON.parse(fs.readFileSync("contracts/l1a-shadow-ledger.schema.json"));
const fixture = JSON.parse(fs.readFileSync("tests/fixtures/l1a-shadow-ledger.synthetic.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv); const validate = ajv.compile(schema);
const event = fixture.event; event.idempotency_key = deriveIdempotencyKey(event); event.event_id = deriveEventId(event); event.canonical_payload_sha256 = canonicalPayloadSha(event);
assert.equal(validate(fixture), true);
for (const mutate of [x=>x.write_enabled=true,x=>x.runtime_enforced=true,x=>x.contract_status="active",x=>x.event.raw_email="synthetic@example.invalid",x=>x.event.reconciliation_state="ready",x=>x.event.provider_reference_pseudo="raw-order"]){const bad=structuredClone(fixture);mutate(bad);assert.equal(validate(bad),false);}
const state = new Map(); assert.equal(reduceShadowEvent(state,event).status,"inserted_shadow"); assert.equal(reduceShadowEvent(state,structuredClone(event)).status,"original_shadow");
for(const mutate of [x=>x.amount_minor++,x=>x.provider="payple",x=>x.environment="production",x=>x.event_type="refund_verified"]){const bad=structuredClone(event);mutate(bad);assert.throws(()=>reduceShadowEvent(state,bad));}
assert.equal(fs.existsSync("functions/_append_only_payment_ledger.js"),false);
console.log("L1A shadow-only schema/reducer/synthetic fixtures PASS; runtime/write/export absent");
