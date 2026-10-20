#!/usr/bin/env node
// 다국어 CI 검사 (기획안 C-7). PR-0~PR-6: 일부 항목 경고, PR-7 이후 --strict 로 실패 전환.
//   node scripts/i18n/check.mjs [--strict]
import fs from "node:fs";
import path from "node:path";
import {
  ROOT, I18N_DIR, readJson, flatten, HANGUL, EMAIL_RE, PHONE_RE, loadLocales, loadFacts, loadGlossary, sameStructure, parseArgs,
} from "./lib.mjs";
import { renderPage, stripI18nAttrs, headTags } from "./render.mjs";

const a = parseArgs();
const STRICT = !!a.strict || process.env.LP_I18N_STRICT === "1";
const errors = [];
const warns = [];
const soft = (msg) => (STRICT ? errors : warns).push(msg);

// 1) 등록부 형식
const locales = loadLocales();
const LANGS = locales.order;
for (const l of LANGS) {
  const L = locales.locales[l];
  if (!L) { errors.push(`locales.json: ${l} 정의 없음`); continue; }
  for (const f of ["path", "htmlLang", "hreflang", "ogLocale", "payment", "currency", "price", "bible"]) if (!L[f]) errors.push(`locales.json: ${l}.${f} 없음`);
  if (!fs.existsSync(path.join(I18N_DIR, "style", `${l}.md`))) errors.push(`style/${l}.md 없음`);
}
if (!LANGS.includes(locales.default) || locales.locales[locales.default].path !== "/") errors.push("locales.json: 기본 언어 경로는 / 여야 함");

// 2) 사실 카드와 등록부 가격 일치
const facts = loadFacts();
for (const l of LANGS) {
  const L = locales.locales[l];
  if (facts.price[L.currency] !== L.price) errors.push(`facts.json 가격(${L.currency}=${facts.price[L.currency]}) ≠ locales.${l}.price(${L.price})`);
}
if (JSON.stringify(facts.languages) !== JSON.stringify(LANGS)) errors.push("facts.languages ≠ locales.order");

// 3) 용어집: 모든 언어 칸
for (const t of loadGlossary().terms) if (!t.dnt) for (const l of LANGS.filter((x) => x !== "ko")) if (!t[l]) errors.push(`glossary: "${t.ko}" ${l} 없음`);

// 4) functions/_locale.js 일치 (PR-2에서 생김. 있으면 반드시 일치)
const fnLocale = path.join(ROOT, "functions", "_locale.js");
if (fs.existsSync(fnLocale)) {
  const m = fs.readFileSync(fnLocale, "utf8").match(/LOCALES\s*=\s*(\{[\s\S]*?\});/);
  if (!m || JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(locales)) errors.push("functions/_locale.js 내용이 i18n/locales.json 과 다름");
}

// 5) 화면 사전: 키 개수·빠진 키·변수/태그 보존·남은 한글
const dictDir = path.join(ROOT, "assets", "i18n");
const ko = flatten(readJson(path.join(dictDir, "ko.json")));
for (const l of LANGS.filter((x) => x !== "ko")) {
  const f = path.join(dictDir, `${l}.json`);
  if (!fs.existsSync(f)) { soft(`assets/i18n/${l}.json 없음 (PR-1 이후 생성)`); continue; }
  const d = flatten(readJson(f));
  const miss = Object.keys(ko).filter((k) => !(k in d));
  if (miss.length) soft(`${l}.json 빠진 키 ${miss.length}개 (예: ${miss.slice(0, 3).join(", ")})`);
  const brokenStruct = Object.keys(ko).filter((k) => typeof d[k] === "string" && typeof ko[k] === "string" && !sameStructure(ko[k], d[k]));
  if (brokenStruct.length) soft(`${l}.json 태그·변수 불일치 ${brokenStruct.length}개 (예: ${brokenStruct.slice(0, 3).join(", ")})`);
  const hangulLeft = Object.entries(d).filter(([, v]) => typeof v === "string" && HANGUL.test(v)).map(([k]) => k);
  if (hangulLeft.length) soft(`${l}.json 남은 한글 ${hangulLeft.length}곳`);
}

// 6) 공개되는 다국어 파일에 이메일·전화 금지
const publicI18n = [
  ...fs.readdirSync(dictDir).filter((f) => f.endsWith(".json")).map((f) => path.join(dictDir, f)),
  path.join(I18N_DIR, "facts.json"), path.join(I18N_DIR, "glossary.json"), path.join(I18N_DIR, "locales.json"),
];
// 기존 ko/en 사전의 연락처는 공개 연락처 정책(public-contact-router)이 별도로 다룸 → 경고만.
// 새로 생기는 파일(ja/zh/es, i18n/)은 처음부터 금지 → 실패. 예시 주소(example.com)는 허용.
const LEGACY_CONTACT = new Set(["ko.json", "en.json"]);
for (const f of publicI18n) {
  const s = fs.readFileSync(f, "utf8").replace(/[A-Za-z0-9._%+-]+@example\.com/g, "");
  const push = LEGACY_CONTACT.has(path.basename(f)) && path.dirname(f) === dictDir ? (m) => warns.push(m + " (기존, 공개 연락처 정책에서 처리)") : (m) => errors.push(m);
  if (EMAIL_RE.test(s)) push(`${path.relative(ROOT, f)}: 이메일 글자`);
  if (PHONE_RE.test(s)) push(`${path.relative(ROOT, f)}: 전화 글자`);
}

// 7) 렌더러 자체 검사 (고정 입력): hreflang 짝·canonical·lang, 한국어 동일성
{
  const src = `<!DOCTYPE html><html lang="ko"><head><link rel="canonical" href="x"><meta property="og:locale" content="ko_KR"></head><body><h1 data-i18n="t.h">안녕 <b>{name}</b></h1><input data-i18n-attr="placeholder:t.p" placeholder="이메일"><a href="/product">상품</a></body></html>`;
  const dict = { "t.h": "Hello <b>{name}</b>", "t.p": "Email" };
  const pages = new Set(["", "product"]);
  const r1 = renderPage(src, { lang: "en", dict, slug: "product", locales, pages });
  const r2 = renderPage(src, { lang: "en", dict, slug: "product", locales, pages });
  if (r1.html !== r2.html) errors.push("render: 같은 입력 다른 출력");
  if (!r1.html.includes('<html lang="en"')) errors.push("render: lang 속성");
  const hre = r1.html.match(/hreflang="[^"]+"/g) || [];
  if (hre.length !== LANGS.length + 1 || !r1.html.includes('hreflang="x-default"')) errors.push(`render: hreflang ${hre.length}개 (기대 ${LANGS.length + 1})`);
  if ((r1.html.match(/rel="canonical"/g) || []).length !== 1 || !r1.html.includes('href="https://lifeportfolio.co.kr/en/product"')) errors.push("render: canonical");
  if (!r1.html.includes(">Hello <b>{name}</b><") || !r1.html.includes('placeholder="Email"')) errors.push("render: 문장 교체");
  if (!r1.html.includes('href="/en/product"')) errors.push("render: 내부 링크 언어 주소");
  if (stripI18nAttrs(src) !== src.replace(/\sdata-i18n(?:-attr)?="[^"]*"/g, "")) errors.push("render: 속성 제거 함수");
  if (headTags("ko", "", locales).indexOf('hreflang="zh-Hans"') < 0) errors.push("render: zh-Hans hreflang");
}

// 8) 한국어 원본 바이트 동일성: 기준 해시가 있는 페이지만 (PR-1부터 기준 기록)
const baseFile = path.join(I18N_DIR, "ko-baseline.json");
if (fs.existsSync(baseFile)) {
  const crypto = await import("node:crypto");
  for (const [page, sha] of Object.entries(readJson(baseFile))) {
    const p = path.join(ROOT, page);
    if (!fs.existsSync(p)) { errors.push(`ko-baseline: ${page} 없음`); continue; }
    const got = crypto.createHash("sha256").update(stripI18nAttrs(fs.readFileSync(p, "utf8"))).digest("hex");
    if (got !== sha) errors.push(`한국어 원본 변경: ${page} (data-i18n 속성 제거 후 기준과 다름)`);
  }
}

for (const w of warns) console.log(`경고: ${w}`);
for (const e of errors) console.log(`실패: ${e}`);
console.log(`i18n check: 실패 ${errors.length}, 경고 ${warns.length}${STRICT ? " (strict)" : ""}`);
if (errors.length) process.exit(1);
