#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer";

const root=process.cwd(),email="faise@lifeportfolio.co.kr",href=`mailto:${email}`;
const survey=fs.readFileSync("suvey.html","utf8"),mypage=fs.readFileSync("mypage.html","utf8");
const ko=JSON.parse(fs.readFileSync("assets/i18n/ko.json","utf8")),en=JSON.parse(fs.readFileSync("assets/i18n/en.json","utf8"));
for(const [name,src] of [["survey",survey],["mypage",mypage]]){
  assert.match(src,new RegExp(href.replaceAll(".","\\.")),`${name}: policy mailto missing`);
  assert.doesNotMatch(src,/href=["']\/contact(?:["'?#])/i,`${name}: nonexistent /contact route`);
}
for(const dict of [ko,en]){
  assert.equal(typeof dict.survey.contact_support,"string");
  assert.equal(typeof dict.mypage.contact_support,"string");
  assert.ok(dict.survey.contact_support.length>8&&dict.mypage.contact_support.length>5);
}
assert.match(survey,/data-testid="survey-contact-support"[^>]+data-public-contact="true"[^>]+href="mailto:faise@lifeportfolio\.co\.kr"/);
assert.match(survey,/dataset\.testid = "survey-guard-contact-support"/);
assert.match(mypage,/data-testid="mypage-contact-support"[^>]+data-public-contact="true"[^>]+href="mailto:faise@lifeportfolio\.co\.kr"/);

const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,"http://fixture.local").pathname).replace(/^\/+/,"")||"index.html";if(!["suvey.html","mypage.html"].includes(rel)){res.statusCode=404;return res.end("not found");}res.setHeader("content-type","text/html; charset=utf-8");res.end(fs.readFileSync(path.join(root,rel)));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
  for(const [width,height] of [[1440,1000],[320,800],[375,812],[430,932]]){
    for(const [route,selector] of [["suvey.html",'[data-testid="survey-contact-support"]'],["mypage.html",'[data-testid="mypage-contact-support"]']]){
      const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setViewport({width,height});await page.goto(`${base}/${route}`,{waitUntil:"domcontentloaded"});
      const result=await page.$eval(selector,el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{href:el.getAttribute("href"),w:r.width,h:r.height,display:s.display,visibility:s.visibility,right:r.right,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};});
      assert.equal(result.href,href);assert.notEqual(result.display,"none");assert.notEqual(result.visibility,"hidden");assert.ok(result.w>=44&&result.h>=44,`${route}/${width}: touch target ${result.w}x${result.h}`);assert.ok(result.right<=result.viewport+2,`${route}/${width}: clipped`);assert.ok(result.scrollWidth<=result.viewport+2,`${route}/${width}: horizontal overflow`);await page.close();
    }
  }
  console.log("Contact recovery links KO/EN contract and 1440/320/375/430 static geometry passed");
}finally{await browser.close();server.close();}
