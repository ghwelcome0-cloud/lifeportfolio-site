#!/usr/bin/env node
// LLM 프록시로 번역. 번역 기록(memory)에 있는 문장은 다시 번역하지 않는다.
//   node scripts/i18n/translate.mjs --in i18n/extract/dict.json --langs en,ja,zh,es \
//        [--model gpt-5-mini] [--batch 50] [--concurrency 4] [--out-dir i18n/out] [--usage-out file.json] [--dry]
// 결과: i18n/memory/{lang}.json 갱신 + {out-dir}/{lang}.json (키: 번역)
import path from "node:path";
import fs from "node:fs";
import {
  ROOT, I18N_DIR, readJson, writeJson, hashText, protectTokens, restoreTokens, sameStructure,
  glossaryFor, loadStyle, chat, parseArgs, pool, loadLocales, localizePrices,
} from "./lib.mjs";

const LANG_NAME = { en: "English", ja: "Japanese", zh: "Simplified Chinese", es: "Spanish" };

export function buildPrompt(lang, items) {
  const sys = [
    `You are a professional Korean-to-${LANG_NAME[lang] || lang} translator for "Life Portfolio", a Christian self-discovery and life-design service.`,
    "Translate naturally for native readers; keep meaning, warmth and brevity.",
    "Placeholders like ⟦0⟧ ⟦1⟧ must appear in the output exactly once each, unchanged. They hide HTML tags, variables, numbers and prices.",
    "Do not add explanations. Return JSON: {\"t\": {\"<id>\": \"<translation>\", ...}} with every id.",
    "Glossary (must use):",
    glossaryFor(lang),
    "Style rules:",
    loadStyle(lang),
  ].join("\n");
  const user = JSON.stringify(Object.fromEntries(items.map((it) => [it.id, it.masked])));
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

function memPath(lang) { return path.join(I18N_DIR, "memory", `${lang}.json`); }
export function loadMemory(lang) { return fs.existsSync(memPath(lang)) ? readJson(memPath(lang)) : {}; }

export async function translateLang(lang, strings, opts = {}) {
  const { model = "gpt-5-mini", batch = 50, concurrency = 1, dry = false, chatFn = chat } = opts;
  const memory = loadMemory(lang);
  const result = {};
  const todo = [];
  for (const [key, orig] of Object.entries(strings)) {
    const src = localizePrices(orig, lang); // 가격이 바뀐 문장은 해시도 달라져 다시 번역됨
    const h = hashText(src);
    if (memory[h]) { result[key] = memory[h].t; continue; }
    const { masked, tokens } = protectTokens(src);
    todo.push({ id: String(todo.length), key, src, h, masked, tokens });
  }
  const usage = { prompt_tokens: 0, completion_tokens: 0, calls: 0, chars: todo.reduce((n, t) => n + t.src.length, 0) };
  const failed = [];
  const batches = [];
  for (let i = 0; i < todo.length; i += batch) batches.push(todo.slice(i, i + batch));
  if (dry) return { result, usage, failed, pending: todo.length, cached: Object.keys(result).length };

  await pool(batches, concurrency, async (items) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { content, usage: u } = await chatFn({ model, messages: buildPrompt(lang, items) });
        usage.calls++; usage.prompt_tokens += u.prompt_tokens || 0; usage.completion_tokens += u.completion_tokens || 0;
        const t = JSON.parse(content).t || {};
        const bad = [];
        for (const it of items) {
          const raw = t[it.id];
          if (typeof raw !== "string") { bad.push(it); continue; }
          // 자리표시(⟦n⟧)가 원문과 정확히 같은 집합으로, 각각 한 번씩 있어야 함 → 문장 뒤바뀜·누락 차단
          const want = (it.masked.match(/⟦\d+⟧/g) || []).sort().join();
          const got = (raw.match(/⟦\d+⟧/g) || []).sort().join();
          if (want !== got) { bad.push(it); continue; }
          const out = restoreTokens(raw, it.tokens);
          if (/⟦\d+⟧/.test(out) || !sameStructure(it.src, out)) { bad.push(it); continue; }
          result[it.key] = out;
          memory[it.h] = { t: out, model, src: it.src.slice(0, 80) };
        }
        if (!bad.length) return;
        items = bad; // 실패한 문장만 다시
      } catch (e) {
        if (attempt === 3) console.warn(`[${lang}] 묶음 실패: ${e.message}`);
      }
    }
    failed.push(...items.map((it) => it.key));
  });
  writeJson(memPath(lang), Object.fromEntries(Object.entries(memory).sort()));
  return { result, usage, failed, cached: Object.keys(strings).length - todo.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs();
  if (!a.in) { console.error("사용법: --in <추출 파일> --langs en,ja,zh,es"); process.exit(2); }
  const strings = readJson(path.resolve(ROOT, a.in));
  const langs = String(a.langs || loadLocales().order.filter((l) => l !== "ko").join(",")).split(",");
  const outDir = path.resolve(ROOT, a["out-dir"] || "i18n/out");
  const t0 = Date.now();
  const report = {};
  await Promise.all(langs.map(async (lang) => {
    const r = await translateLang(lang, strings, {
      model: a.model, batch: a.batch ? +a.batch : 50, concurrency: a.concurrency ? +a.concurrency : 1, dry: !!a.dry,
    });
    if (!a.dry) writeJson(path.join(outDir, `${lang}.json`), r.result);
    report[lang] = { ...r.usage, cached: r.cached, failed: r.failed.length, ...(a.dry ? { pending: r.pending } : {}) };
    console.log(`[${lang}] ${JSON.stringify(report[lang])}`);
  }));
  const total = Object.values(report).reduce((s, r) => ({
    prompt_tokens: s.prompt_tokens + (r.prompt_tokens || 0), completion_tokens: s.completion_tokens + (r.completion_tokens || 0),
  }), { prompt_tokens: 0, completion_tokens: 0 });
  const summary = { model: a.model || "gpt-5-mini", langs, strings: Object.keys(strings).length, seconds: (Date.now() - t0) / 1000, total, perLang: report };
  if (a["usage-out"]) writeJson(path.resolve(ROOT, a["usage-out"]), summary);
  console.log(JSON.stringify({ total, seconds: summary.seconds }));
  if (Object.values(report).some((r) => r.failed)) process.exitCode = 1;
}
