#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),root=process.cwd();
const Report=require("../assets/js/report-engine.js"),V4=require("../assets/js/report-engine-v4.js"),Program=require("../assets/js/program-engine.js");
const j=f=>JSON.parse(fs.readFileSync(f,"utf8")),questions=j("data/questions.json"),mapping=j("data/mapping.json"),rules=j("data/report-rules.json"),programRules=j("data/program-rules.json");
const src=fs.readFileSync("scripts/test_v4_kys_regen.js","utf8"),answers=eval("("+src.match(/const\s+KYS_ANSWERS\s*=\s*(\{[\s\S]*?\n\});/)[1]+")"),profile=eval("("+src.match(/const\s+KYS_PROFILE\s*=\s*(\{[\s\S]*?\n\});/)[1]+")");
const build=lang=>V4.upgrade(Report.build({questions,mapping,rules,answers,profile,lang}),{questions,mapping,rules,answers,profile,lang});
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split("?")[0]||"/"));try{const f=fs.statSync(p).isDirectory()?path.join(p,"index.html"):p;res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end("not found");}});await new Promise(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${server.address().port}`;
const systemChrome=[process.env.PUPPETEER_EXECUTABLE_PATH,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(x=>x&&fs.existsSync(x));
const browser=await puppeteer.launch({headless:true,...(systemChrome?{executablePath:systemChrome}:{}),args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
 for(const lang of ["ko","en"]){
  const report=build(lang),program=Program.build({report,rules:programRules,name:profile.name,lang});
  const p=await browser.newPage();await p.setRequestInterception(true);let reportDocument=true;p.on("request",r=>{if(r.isNavigationRequest()&&r.resourceType()==="document"){if(reportDocument){reportDocument=false;r.continue();}else r.abort();}else r.continue();});await p.evaluateOnNewDocument(r=>window.__SAMPLE__=r,report);await p.goto(base+"/report.html",{waitUntil:"domcontentloaded"}).catch(()=>{});await p.waitForFunction(()=>typeof window.__buildBookHTML==="function",{timeout:15000});const html=await p.evaluate(()=>window.__buildBookHTML("screen"));await p.setRequestInterception(false);await p.setContent(html,{waitUntil:"domcontentloaded"});
  const text=await p.$$eval('[data-anchor="ch9"],[data-anchor="ch10"]',xs=>xs.map(x=>x.innerText).join("\n"));assert.ok(text.length>300);if(lang==="en"){assert.doesNotMatch(text,/[가-힣]/,"EN IX/X contains Korean");for(const s of ["same release, engine, and input","pseudonymous identifier","test-retest reliability","validity","Response code"])assert.ok(text.includes(s),`EN IX/X missing ${s}`);}else{for(const s of ["동일 release","가명 식별자","재검사 신뢰도","타당도","응답 코드"])assert.ok(text.includes(s),`KO IX/X missing ${s}`);}
  for(const width of [1440,320,375,430]){await p.setViewport({width,height:1000});await p.setContent(html,{waitUntil:"domcontentloaded"});const geom=await p.$$eval('[data-anchor="ch9"],[data-anchor="ch10"]',xs=>xs.map(x=>({sw:x.scrollWidth,cw:x.clientWidth,kids:[...x.querySelectorAll("*")].some(k=>{const r=k.getBoundingClientRect(),q=x.getBoundingClientRect();return r.left<q.left-1||r.right>q.right+1;})})));for(const g of geom){assert.ok(g.sw<=g.cw+1,`${lang}/${width}: horizontal overflow`);assert.equal(g.kids,false,`${lang}/${width}: clipped child`);}}
  await p.emulateMediaType("print");const printGeom=await p.$$eval('[data-anchor="ch9"],[data-anchor="ch10"]',xs=>xs.map(x=>{const b=x.querySelector('.page__body').getBoundingClientRect(),n=x.querySelector('.page__num').getBoundingClientRect();return {overflow:x.scrollHeight>x.clientHeight+2,footer:n.top<b.bottom};}));for(const g of printGeom){assert.equal(g.overflow,false,"PDF page overflow");assert.equal(g.footer,false,"PDF footer clipping");}
  const pp=await browser.newPage();await pp.setRequestInterception(true);let programDocument=true;pp.on("request",r=>{if(r.isNavigationRequest()&&r.resourceType()==="document"){if(programDocument){programDocument=false;r.continue();}else r.abort();}else r.continue();});await pp.goto(base+"/program.html",{waitUntil:"domcontentloaded"}).catch(()=>{});await pp.waitForFunction(()=>typeof window.__buildProgramBookHTML==="function",{timeout:15000});const ph=await pp.evaluate(x=>window.__buildProgramBookHTML("screen",x),program);assert.match(ph,lang==="en"?/response code/:/응답 코드/);await pp.close();await p.close();
 }
 console.log("P0-A browser KO/EN IX/X, program, PC/mobile and print geometry passed");
}finally{await browser.close();server.close();}
