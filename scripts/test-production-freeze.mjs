#!/usr/bin/env node
import assert from "node:assert/strict";
import {readProductionFreeze,requireProductionOpen} from "./production-freeze-lib.mjs";
const json=x=>()=>JSON.stringify(x),closed={schema:1,enabled:false,reason:"incident",open_transition:"unsupported-until-approved-verifier"};assert.deepEqual(readProductionFreeze("x",json(closed)),closed);
for(const read of [()=>{throw new Error("missing")},()=>"{",json(null),json({}),json({...closed,schema:2}),json({...closed,enabled:"false"}),json({...closed,reason:""}),json({...closed,open_transition:"input-override"})])assert.throws(()=>readProductionFreeze("x",read));assert.throws(()=>requireProductionOpen(closed));
for(const approval of [{},{decision:"approved",head_sha:"mismatch"},{decision:"approved",expired:true},{decision:"approved",reused:true},{decision:"approved",head_sha:"a".repeat(40),source_run_id:1,manifest_sha256:"b".repeat(64)}])assert.throws(()=>requireProductionOpen({...closed,enabled:true,approval}));
console.log("Versioned production freeze is closed; missing/malformed/open-transition negatives passed");
