// 다국어 파이프라인 공통 함수 (의존성 없음, Node 20+)
// 원본 폴더 i18n/ 과 scripts/ 는 호스팅에 올라가지 않는다 (hosting-allowlist 밖).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
export const I18N_DIR = path.join(ROOT, "i18n");

export function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

export function loadLocales() { return readJson(path.join(I18N_DIR, "locales.json")); }
export function loadGlossary() { return readJson(path.join(I18N_DIR, "glossary.json")); }
export function loadFacts() { return readJson(path.join(I18N_DIR, "facts.json")); }
export function loadStyle(lang) {
  const p = path.join(I18N_DIR, "style", `${lang}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

// 중첩 사전 <-> 평평한 사전 ("a.b.c": "문장")
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
export function unflatten(flat) {
  const out = {};
  for (const [key, v] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ??= {};
    cur[parts.at(-1)] = v;
  }
  return out;
}

export const HANGUL = /[\uAC00-\uD7A3\u3131-\u318E]/;
export function hangulCount(s) { return (String(s).match(/[\uAC00-\uD7A3\u3131-\u318E]/g) || []).length; }

export function hashText(s) { return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 16); }

// 번역 금지 조각: HTML 태그, {변수}, {{변수}}, %s, 숫자·가격, URL, HTML 엔티티
const PROTECT_RE = /(<[^>]+>|\{\{[^}]+\}\}|\{[A-Za-z0-9_.]+\}|%[sd]|https?:\/\/\S+|&[a-z#0-9]+;|[$₩]?\d[\d,.:]*(?:원|%)?)/g;
export function protectTokens(text) {
  const tokens = [];
  const masked = String(text).replace(PROTECT_RE, (m) => { tokens.push(m); return `⟦${tokens.length - 1}⟧`; });
  return { masked, tokens };
}
export function restoreTokens(text, tokens) {
  return String(text).replace(/⟦(\d+)⟧/g, (m, i) => (tokens[+i] !== undefined ? tokens[+i] : m));
}
// 원화 가격 → 해당 언어 판매가 (facts.json·locales.json 기준). 번역 전에 적용.
// 판매가(19,900원)만 바꾸고 다른 원화 금액(예: 커피값 비유)은 "₩숫자"로 표기해 한글을 없앤다.
export function localizePrices(text, lang, locales = loadLocales(), facts = loadFacts()) {
  const L = locales.locales[lang];
  if (!L || lang === locales.default) return String(text);
  const krw = Number(facts.price.KRW);
  const sale = L.currency === "USD" ? `$${L.price}` : `${L.price} ${L.currency}`;
  return String(text).replace(/(\d[\d,]*)\s*원/g, (m, n) => (Number(n.replace(/,/g, "")) === krw ? sale : `₩${n}`));
}

// 태그·변수가 번역 뒤에도 같은 개수로 남았는지 (숫자는 언어별 표기가 달라 제외)
export function structuralTokens(text) {
  return (String(text).match(/<[^>]+>|\{\{[^}]+\}\}|\{[A-Za-z0-9_.]+\}|%[sd]/g) || []).map((t) => t.replace(/\s+/g, " ")).sort();
}
export function sameStructure(a, b) {
  const x = structuralTokens(a), y = structuralTokens(b);
  return x.length === y.length && x.every((t, i) => t === y[i]);
}

// 공개 파일 연락처 금지 (이메일·전화)
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
export const PHONE_RE = /(?:\+?82[-\s]?|0)1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}/;

// LLM 프록시 설정: ~/.genspark_llm.yaml 에서만 읽음 (커밋 금지)
export function loadLlmConfig() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
    return { apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL };
  }
  const p = path.join(os.homedir(), ".genspark_llm.yaml");
  if (!fs.existsSync(p)) throw new Error("LLM 설정 없음: ~/.genspark_llm.yaml 또는 OPENAI_API_KEY/OPENAI_BASE_URL");
  const y = fs.readFileSync(p, "utf8");
  const apiKey = (y.match(/api_key:\s*["']?([^"'\s]+)/) || [])[1];
  const baseUrl = (y.match(/base_url:\s*["']?([^"'\s]+)/) || [])[1];
  if (!apiKey || !baseUrl) throw new Error("~/.genspark_llm.yaml 형식 오류");
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}

export async function chat({ model, messages, json = true }, cfg = loadLlmConfig()) {
  const body = { model, messages };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, usage: data.usage || {} };
}

export function glossaryFor(lang, glossary = loadGlossary()) {
  return glossary.terms
    .map((t) => (t.dnt ? `- "${t.ko}" → keep as is` : t[lang] ? `- "${t.ko}" → "${t[lang]}"` : null))
    .filter(Boolean)
    .join("\n");
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      out[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
    } else out._.push(a);
  }
  return out;
}

export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}
