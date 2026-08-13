#!/usr/bin/env node
import assert from "node:assert/strict";import fs from "node:fs";import {validateEventSchema,validateLegalManifest,verifyLegalFiles} from "./legal-contract-lib.mjs";
verifyLegalFiles();const b2c=JSON.parse(fs.readFileSync("contracts/legal-manifest.b2c.json"));const schemas=JSON.parse(fs.readFileSync("contracts/legal-event-schemas.json"));
for(const mutate of [m=>m.active=false,m=>delete m.documents.terms.sha256,m=>m.age.minimum_years=13,m=>m.age.server_authoritative=false,m=>m.age.unknown_or_unverified="allow",m=>m.validation.server_authoritative=false,m=>m.event.append_only=false,m=>m.idempotency.required=false,m=>m.offers[0].amount_minor=-1]){const m=structuredClone(b2c);mutate(m);assert.throws(()=>validateLegalManifest(m));}
for(const mutate of [s=>s.age.deny_unknown=false,s=>s.age.server_authoritative=false,s=>s.event.append_only=false,s=>s.idempotency.conflict="overwrite",s=>s.event.immutable.pop()]){const s=structuredClone(schemas);mutate(s);assert.throws(()=>validateEventSchema(s));}
console.log("B2C/B2B legal manifest, document SHA, age/event/idempotency fail-closed fixtures passed");
