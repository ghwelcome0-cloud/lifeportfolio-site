import fs from "node:fs";
export const FREEZE_PATH="contracts/production-deploy-freeze.json";
export const OPEN_TRANSITIONS=Object.freeze(["unsupported-until-approved-verifier","ceo-approved-explicit-open"]);
export function readProductionFreeze(path=FREEZE_PATH,read=fs.readFileSync){let value;try{value=JSON.parse(read(path,"utf8"));}catch{throw new Error("Production freeze contract missing or malformed");}if(!value||value.schema!==1||typeof value.enabled!=="boolean"||typeof value.reason!=="string"||!value.reason||!OPEN_TRANSITIONS.includes(value.open_transition))throw new Error("Production freeze contract schema invalid");return value;}
// PR #262 (CEO explicit approval, 2026-08-14): the second, unconditional throw
// ("Production opening is unsupported until an approved verifier is merged") is removed.
// The `enabled` switch is KEPT and is now the single load-bearing gate: a closed contract
// still throws, and no approval-shaped payload can bypass it. See scripts/test-production-freeze.mjs.
export function requireProductionOpen(value){if(!value||value.enabled!==true)throw new Error("Production freeze is closed");return value;}
