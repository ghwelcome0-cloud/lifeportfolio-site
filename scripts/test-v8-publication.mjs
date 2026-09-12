// Publication structure checks only; this does NOT approve or activate a policy.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parse } from 'parse5';
import { TREE_EXCLUDES } from './hosting-allowlist.mjs';
const licensePath='assets/fonts/lp-v8/licenses.html';
const sourcePath='assets/fonts/lp-v8/Font_Licenses.txt';
const source=fs.readFileSync(sourcePath);
const digest=crypto.createHash('sha256').update(source).digest('hex');
assert.equal(digest,'4d9b203b1cc1aa9fa2d8c866b8614122b7cfba7e94cf9a6ccf35d9954d23f3bd','Approved original license bytes must remain intact');
function attr(n,k){return n.attrs?.find(a=>a.name===k)?.value;}
function find(n,p){if(p(n))return n;for(const c of n.childNodes||[]){const found=find(c,p);if(found)return found;}}
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');}
const doc=parse(fs.readFileSync(licensePath,'utf8'));
const notice=find(doc,n=>attr(n,'id')==='license-original');
assert.ok(notice);assert.equal(attr(notice,'data-public-contact'),'true');
assert.equal(attr(notice,'hidden'),undefined);assert.notEqual(attr(notice,'aria-hidden'),'true');
assert.equal(text(notice),source.toString('utf8'),'Published license must preserve complete original text');
assert.ok(TREE_EXCLUDES.includes(sourcePath),'Publish complete HTML replacement, retaining tracked original');
const home=parse(fs.readFileSync('index.html','utf8'));
const footer=find(home,n=>n.tagName==='footer'&&attr(n,'class')==='v6-footer');
assert.ok(footer);
for(const value of ['파이스','김영식','656-12-02589','제 2026-서울서초-1920 호','010-5179-9206','faise@lifeportfolio.co.kr','매헌로 16','100% 전액 환불'])assert.ok(text(footer).includes(value),value);
for(const href of ['/'+licensePath,'mailto:faise@lifeportfolio.co.kr','tel:010-5179-9206','/privacy','/terms'])assert.ok(find(footer,n=>n.tagName==='a'&&attr(n,'href')===href),href);
console.log('V8 publication structure passed: original bytes, complete notice, business details and links; policy approval not tested');
