#!/usr/bin/env node
import assert from "node:assert/strict";
import {readProductionOpen,requireProductionOpen} from "./production-freeze-lib.mjs";
assert.equal(requireProductionOpen("true"),true);
for(const value of [undefined,"","false","TRUE","1"])assert.throws(()=>requireProductionOpen(value));
const repo="owner/repo";
assert.equal(readProductionOpen({repository:repo,exec:()=>"true\n"}),true);
for(const value of ["","false\n","TRUE\n"])assert.throws(()=>readProductionOpen({repository:repo,exec:()=>value}));
assert.throws(()=>readProductionOpen({repository:repo,exec:()=>{throw new Error("API unavailable")}}));
assert.throws(()=>readProductionOpen({repository:"bad",exec:()=>"true"}));
console.log("Production freeze missing/false/error/true negative matrix passed");
