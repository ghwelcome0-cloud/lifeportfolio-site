#!/usr/bin/env node
import assert from "node:assert/strict";
import {readProductionFreeze,requireProductionOpen} from "./production-freeze-lib.mjs";
const json=x=>()=>JSON.stringify(x),closed={schema:1,enabled:false,reason:"incident",open_transition:"unsupported-until-approved-verifier"},opened={schema:1,enabled:true,reason:"roadmap8-release-approved-by-ceo-2026-08-14",open_transition:"ceo-approved-explicit-open"};assert.deepEqual(readProductionFreeze("x",json(closed)),closed);assert.deepEqual(readProductionFreeze("x",json(opened)),opened);
for(const read of [()=>{throw new Error("missing")},()=>"{",json(null),json({}),json({...closed,schema:2}),json({...closed,enabled:"false"}),json({...closed,reason:""}),json({...closed,open_transition:"input-override"}),json({...opened,open_transition:"input-override"}),json({...opened,open_transition:""}),json({...opened,reason:""})])assert.throws(()=>readProductionFreeze("x",read));assert.throws(()=>requireProductionOpen(closed));
// PR #262 redefinition (CEO explicit approval, 2026-08-14): the unconditional second throw is gone,
// so `enabled` is now the single load-bearing gate. These negatives therefore no longer assert
// "a valid approval still throws"; they assert the stronger, still-required property that NO
// approval-shaped payload can open a CLOSED contract. Deleting the matrix was not an option
// (defect CW: never satisfy a gate by weakening the gate) - it is re-pointed at the new invariant.
for(const approval of [{},{decision:"approved",head_sha:"mismatch"},{decision:"approved",expired:true},{decision:"approved",reused:true},{decision:"approved",head_sha:"a".repeat(40),source_run_id:1,manifest_sha256:"b".repeat(64)}]){assert.throws(()=>requireProductionOpen({...closed,approval}),/Production freeze is closed/);assert.throws(()=>requireProductionOpen({...closed,enabled:"true",approval}),/Production freeze is closed/);}
for(const value of [null,undefined,0,"",{},{enabled:"true"},{enabled:1},{enabled:null},{...opened,enabled:false},{...opened,enabled:"true"}])assert.throws(()=>requireProductionOpen(value),/Production freeze is closed/);
assert.equal(requireProductionOpen(opened),opened);assert.doesNotThrow(()=>requireProductionOpen({...closed,enabled:true}));
console.log("Versioned production freeze: enabled switch is the single gate; closed/malformed/approval-bypass negatives passed");
