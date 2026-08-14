import crypto from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
export function canonicalPayloadSha(event) { const value = structuredClone(event); delete value.canonical_payload_sha256; return sha256(canonical(value)); }
export function deriveIdempotencyKey(event) { return `lp_idem_${sha256([event.provider, event.environment, event.provider_reference_pseudo, event.event_type].join("\0"))}`; }
export function deriveEventId(event) { return `lp_evt_${sha256([event.event_type, deriveIdempotencyKey(event)].join("\0"))}`; }

export function reduceShadowEvent(state, event) {
  if (event.reconciliation_state !== "shadow_unverified") throw new Error("shadow state only");
  if (event.idempotency_key !== deriveIdempotencyKey(event) || event.event_id !== deriveEventId(event) || event.canonical_payload_sha256 !== canonicalPayloadSha(event)) throw new Error("derived authority fields mismatch");
  const old = state.get(event.idempotency_key);
  if (!old) { state.set(event.idempotency_key, structuredClone(event)); return { status: "inserted_shadow", event: state.get(event.idempotency_key) }; }
  if (old.canonical_payload_sha256 === event.canonical_payload_sha256) return { status: "original_shadow", event: old };
  throw new Error("shadow idempotency conflict");
}
