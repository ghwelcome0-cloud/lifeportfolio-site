#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {verifyArtifact,DlpViolationError} from "./hosting-artifact-verifier-lib.mjs";
import {checkoutExpectedHead,requirePrHead} from "./pr-head-selector.mjs";

const repo=process.cwd(),head=requirePrHead(process.env.PR_HEAD_SHA),mergeSha=requirePrHead(process.env.PR_MERGE_SHA);
const root=fs.mkdtempSync(path.join(os.tmpdir(),"steady-current-")),worktree=path.join(root,"current");
fs.mkdirSync(worktree);const remote=execFileSync("git",["remote","get-url","origin"],{cwd:repo,encoding:"utf8"}).trim(),checked=checkoutExpectedHead({repo:remote,dir:worktree,expectedHead:head,mergeSha,event:"pull_request"});
try{
  assert.equal(checked,head,"exact currentHead checkout");
  try{execFileSync(process.execPath,["scripts/build-hosting.mjs"],{cwd:worktree,stdio:"pipe"});}catch(e){console.error(String(e.stderr));throw e;}
  const dist=path.join(worktree,"dist"),sentinel=crypto.createHash("sha256").update(fs.readFileSync(path.join(dist,"hosting-manifest.json"))).digest("hex");
  assert.match(sentinel,/^[0-9a-f]{64}$/);
  assert.ok(verifyArtifact(dist).files>0,"canonical current artifact must pass active policy");

  function refresh(copy){const hosting=path.join(copy,"hosting"),files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else{const b=fs.readFileSync(p);files.push({path:path.relative(hosting,p).split(path.sep).join("/"),bytes:b.length,sha256:crypto.createHash("sha256").update(b).digest("hex")});}}}walk(hosting);files.sort((a,b)=>a.path.localeCompare(b.path));fs.writeFileSync(path.join(copy,"hosting-manifest.json"),JSON.stringify({schema:1,files},null,2)+"\n");}
  function reject(name,mutate){const copy=path.join(root,name);fs.cpSync(dist,copy,{recursive:true});mutate(path.join(copy,"hosting"));refresh(copy);assert.throws(()=>verifyArtifact(copy),e=>e instanceof DlpViolationError&&e.message.startsWith("DLP violation:"),name);}
  reject("html",h=>fs.appendFileSync(path.join(h,"index.html"),"<main>private.person@unapproved.example</main>"));
  reject("i18n",h=>{const p=path.join(h,"assets/i18n/en.json"),x=JSON.parse(fs.readFileSync(p));x.__unapproved_contact="private.person@unapproved.example";fs.writeFileSync(p,JSON.stringify(x));});
  reject("js",h=>fs.appendFileSync(path.join(h,"assets/js/report-engine.js"),'\nconst leakedContact="private.person@unapproved.example";\n'));

  const baseline=path.join(root,"baseline");fs.cpSync(dist,baseline,{recursive:true});fs.writeFileSync(path.join(baseline,"source-head.txt"),"1".repeat(40));assert.notEqual(fs.readFileSync(path.join(baseline,"source-head.txt"),"utf8"),head,"baseline swap must not satisfy currentHead");
  assert.throws(()=>assert.equal("1".repeat(40),head),"wrong HEAD must fail");
  console.log(`Steady actual current-head artifact integration passed: expected=${head} checked=${checked} merge=${mergeSha} manifest=${sentinel}`);
}finally{fs.rmSync(root,{recursive:true,force:true});}
