#!/usr/bin/env node
// 원본 HTML + 언어 사전 → 언어별 완성 페이지.
// PR-0: 함수와 CLI만 제공 (build:hosting 연결은 PR-1).
//   node scripts/i18n/render.mjs --page index.html --lang en --dict i18n/out/en.json --out /tmp/en/index.html
// 같은 입력이면 같은 출력 (시간·난수 사용 금지).
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, loadLocales, flatten, parseArgs } from "./lib.mjs";

export const SITE = "https://lifeportfolio.co.kr";

export function pageSlug(file) {
  const base = path.basename(file).replace(/\.html$/, "");
  return base === "index" ? "" : base;
}
export function urlFor(lang, slug, locales = loadLocales()) {
  const prefix = locales.locales[lang].path; // "/" 또는 "/en/"
  return SITE + prefix + slug;
}

function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

export function headTags(lang, slug, locales = loadLocales()) {
  const L = locales.locales;
  const lines = [`<link rel="canonical" href="${urlFor(lang, slug, locales)}">`];
  for (const l of locales.order) lines.push(`<link rel="alternate" hreflang="${L[l].hreflang}" href="${urlFor(l, slug, locales)}">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${urlFor(locales.xDefault, slug, locales)}">`);
  lines.push(`<meta property="og:locale" content="${L[lang].ogLocale}">`);
  for (const l of locales.order) if (l !== lang) lines.push(`<meta property="og:locale:alternate" content="${L[l].ogLocale}">`);
  return lines.join("\n");
}

const HEAD_STRIP = [
  /<link\b[^>]*\brel="canonical"[^>]*>\s*/g,
  /<link\b[^>]*\bhreflang="[^"]*"[^>]*>\s*/g,
  /<meta\b[^>]*\bproperty="og:locale(?::alternate)?"[^>]*>\s*/g,
];

export function renderPage(html, { lang, dict, slug = "", locales = loadLocales(), pages = null }) {
  const flat = dict && Object.values(dict).some((v) => v && typeof v === "object") ? flatten(dict) : dict || {};
  const missing = [];
  let out = html;

  // 1) <html lang>
  out = out.replace(/<html\b([^>]*?)\slang="[^"]*"/, `<html$1 lang="${locales.locales[lang].htmlLang}"`);

  // 2) 요소 안쪽 문장
  out = out.replace(/(<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, inner, close) => {
    if (/data-i18n-attr="[^":]*"/.test(open)) return m; // 구형 '속성 전용' 표시는 아래에서 처리
    if (typeof flat[key] !== "string") { missing.push(key); return m; }
    const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
    return open + lead + flat[key] + trail + close;
  });

  // 3) 속성 (data-i18n-attr="placeholder:키;title:키2")
  out = out.replace(/<[^>]*\sdata-i18n-attr="([^"]*:[^"]*)"[^>]*>/g, (tagStr, spec) => {
    let t = tagStr;
    for (const pair of spec.split(";")) {
      const [attr, key] = pair.split(":").map((s) => s && s.trim());
      if (!attr || !key) continue;
      if (typeof flat[key] !== "string") { missing.push(key); continue; }
      t = t.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), `$1${escAttr(flat[key])}$2`);
    }
    return t;
  });

  // 4) canonical / hreflang / og:locale 교체
  if (/<\/head>/i.test(out)) {
    for (const re of HEAD_STRIP) out = out.replace(re, "");
    out = out.replace(/<\/head>/i, headTags(lang, slug, locales) + "\n</head>");
  }

  // 5) 내부 링크를 같은 언어 주소로 (번역된 페이지 목록에 있는 것만)
  if (lang !== locales.default && pages) {
    const prefix = locales.locales[lang].path;
    out = out.replace(/(\shref=")(\/(?!\/)[^"#?]*)([^"]*")/g, (m, a, p, rest) => {
      const slugOf = p.replace(/^\//, "").replace(/\.html$/, "");
      if (slugOf.startsWith("assets/") || slugOf.includes(".")) return m;
      return pages.has(slugOf) ? a + prefix + slugOf + rest : m;
    });
  }
  return { html: out, missing: [...new Set(missing)] };
}

// 한국어 원본 동일성: data-i18n 계열 속성을 지운 뒤 바이트 비교 (기획안 C-2)
export function stripI18nAttrs(html) {
  return html.replace(/\sdata-i18n(?:-attr)?="[^"]*"/g, "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs();
  if (!a.page || !a.lang || !a.dict) { console.error("사용법: --page <html> --lang <xx> --dict <json> [--out <file>]"); process.exit(2); }
  const html = fs.readFileSync(path.resolve(ROOT, a.page), "utf8");
  const { html: out, missing } = renderPage(html, { lang: a.lang, dict: readJson(path.resolve(ROOT, a.dict)), slug: pageSlug(a.page) });
  if (a.out) { fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true }); fs.writeFileSync(path.resolve(a.out), out); }
  console.log(`${a.page} → ${a.lang}: 빠진 키 ${missing.length}개${a.out ? `, 저장 ${a.out}` : ""}`);
}
