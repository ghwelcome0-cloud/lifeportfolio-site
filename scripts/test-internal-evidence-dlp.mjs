#!/usr/bin/env node
import fs from "node:fs";import path from "node:path";
const ROOT=path.resolve(import.meta.dirname,".."),DIR=path.join(ROOT,"internal/evidence"),fail=[];
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else files.push(p);}}walk(DIR);
const patterns=[
  ["email",/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["phone",/(?:\+?82[- .]?)?0(?:2|1[016789]|[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}/g],
  ["jwt",/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["bearer",/\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi],
  ["uuid",/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi],
  ["private-url",/https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^\s/]*\.internal)(?:[^\s"'`]*)/gi],
  ["query-credential",/[?&](?:code|key|auth|session|credential|jwt|token|access_token|refresh_token|sig|email)=[^\s&#"'`]+/gi],
  ["generic-secret",/\b(?:sk_live|pk_live|AIza)[A-Za-z0-9_-]{16,}\b/g]
];
const officialHosts=new Set(["www.law.go.kr","law.go.kr","www.privacy.go.kr","privacy.go.kr","json-schema.org","lifeportfolio.invalid"]);
for(const file of files){const rel=path.relative(ROOT,file).split(path.sep).join("/"),body=fs.readFileSync(file,"utf8");
  for(const [label,re] of patterns){re.lastIndex=0;for(const m of body.matchAll(re)){if(label==="query-credential"){try{const start=body.lastIndexOf("https://",m.index),url=body.slice(start).match(/^https:\/\/[^\s"'`]+/)?.[0];if(url&&officialHosts.has(new URL(url).hostname))continue;}catch{}}fail.push(`${rel}: ${label}`);}}
  const quoted=/"([A-Za-z0-9+/_=-]{48,})"/g;for(const m of body.matchAll(quoted)){const v=m[1];if(!/^[0-9a-f]{40,64}$/i.test(v)&&/[A-Z]/.test(v)&&/[a-z]/.test(v)&&/\d/.test(v))fail.push(`${rel}: high-entropy token candidate`);}
}
if(fail.length){console.error([...new Set(fail)].join("\n"));process.exit(1);}console.log("Internal evidence full-tree value-shape DLP passed");
