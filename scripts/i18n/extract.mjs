#!/usr/bin/env node
// 원본에서 번역할 문장을 뽑아 평평한 사전으로 저장.
//   node scripts/i18n/extract.mjs --dict assets/i18n/ko.json --out i18n/extract/dict.json [--limit 50] [--prefix common,meta]
//   node scripts/i18n/extract.mjs --html index.html --out i18n/extract/index.json
// HTML 모드: data-i18n="키" 요소의 안쪽 문장, data-i18n-attr="속성:키" 의 속성값을 뽑는다.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, writeJson, flatten, HANGUL, parseArgs } from "./lib.mjs";

export function extractFromDict(dict, { prefixes = null, limit = Infinity } = {}) {
  const flat = flatten(dict);
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    if (typeof v !== "string" || !HANGUL.test(v)) continue;
    if (prefixes && !prefixes.some((p) => k === p || k.startsWith(p + "."))) continue;
    out[k] = v;
    if (Object.keys(out).length >= limit) break;
  }
  return out;
}

export function extractFromHtml(html) {
  const out = {};
  const dup = [];
  const put = (k, v) => {
    if (k in out && out[k] !== v) dup.push(k);
    out[k] = v;
  };
  // 안쪽 문장 (중첩 없는 요소 기준; 중첩 요소는 안쪽 HTML 그대로 보존)
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(re)) {
    const attrs = m[2] + m[4];
    if (/data-i18n-attr=/.test(attrs) && !/data-i18n-attr="[^"]*:/.test(attrs)) continue; // 구형 속성 전용 표시
    const inner = m[5].trim();
    if (inner && HANGUL.test(inner)) put(m[3], inner);
  }
  // 속성: data-i18n-attr="placeholder:키;title:키2"
  for (const m of html.matchAll(/<[^>]*\sdata-i18n-attr="([^"]*:[^"]*)"[^>]*>/g)) {
    for (const pair of m[1].split(";")) {
      const [attr, key] = pair.split(":").map((s) => s && s.trim());
      if (!attr || !key) continue;
      const v = (m[0].match(new RegExp(`\\s${attr}="([^"]*)"`)) || [])[1];
      if (v && HANGUL.test(v)) put(key, v);
    }
  }
  return { strings: out, duplicates: dup };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs();
  let strings;
  if (a.dict) {
    strings = extractFromDict(readJson(path.resolve(ROOT, a.dict)), {
      prefixes: a.prefix ? String(a.prefix).split(",") : null,
      limit: a.limit ? +a.limit : Infinity,
    });
  } else if (a.html) {
    const r = extractFromHtml(fs.readFileSync(path.resolve(ROOT, a.html), "utf8"));
    if (r.duplicates.length) console.warn(`경고: 같은 키에 다른 문장 ${r.duplicates.length}건: ${r.duplicates.slice(0, 5).join(", ")}`);
    strings = r.strings;
  } else {
    console.error("사용법: --dict <ko.json> 또는 --html <page.html>, --out <파일>");
    process.exit(2);
  }
  const chars = Object.values(strings).join("").length;
  if (a.out) writeJson(path.resolve(ROOT, a.out), strings);
  console.log(`문장 ${Object.keys(strings).length}개, ${chars}자${a.out ? ` → ${a.out}` : ""}`);
}
