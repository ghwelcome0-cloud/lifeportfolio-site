import {execFileSync} from "node:child_process";

export function requireProductionOpen(value){if(value!=="true")throw new Error("Production freeze is closed");return true;}
export function readProductionOpen({repository,exec=execFileSync}){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||""))throw new Error("Expected repository missing");
  const value=exec("gh",["api",`repos/${repository}/actions/variables/PRODUCTION_DEPLOY_ENABLED`,"--jq",".value"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
  return requireProductionOpen(value);
}
