import fs from "node:fs";
export const FREEZE_PATH="contracts/production-deploy-freeze.json";
export function readProductionFreeze(path=FREEZE_PATH,read=fs.readFileSync){let value;try{value=JSON.parse(read(path,"utf8"));}catch{throw new Error("Production freeze contract missing or malformed");}if(!value||value.schema!==1||typeof value.enabled!=="boolean"||typeof value.reason!=="string"||!value.reason||value.open_transition!=="unsupported-until-approved-verifier")throw new Error("Production freeze contract schema invalid");return value;}
export function requireProductionOpen(value){if(!value||value.enabled!==true)throw new Error("Production freeze is closed");throw new Error("Production opening is unsupported until an approved verifier is merged");}
