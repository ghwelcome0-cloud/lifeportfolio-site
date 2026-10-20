#!/usr/bin/env node
// 번역 검수: (1) 기계 검사 — 용어집·태그/변수 보존·길이·남은 한글  (2) 선택: 역번역 비교 (--back)
//   node scripts/i18n/review.mjs --src i18n/extract/dict.json --dir i18n/out --langs en,ja,zh,es [--back] [--model gpt-5-mini] [--out report.json]
// 결제·약관·메일 문장은 --model gpt-5 로 한 번 더 돌린다 (기획안 C-6).
import path from "node:path";
import fs from "node:fs";
import { ROOT, readJson, writeJson, loadGlossary, sameStructure, HANGUL, chat, parseArgs, pool, localizePrices } from "./lib.mjs";

export function mechanicalReview(lang, src, tr, glossary = loadGlossary()) {
  const issues = [];
  for (const [key, orig] of Object.entries(src)) {
    const s = localizePrices(orig, lang);
    const t = tr[key];
    if (typeof t !== "string") { issues.push({ key, type: "missing" }); continue; }
    if (!sameStructure(s, t)) issues.push({ key, type: "structure" });
    if (HANGUL.test(t)) issues.push({ key, type: "hangul_left" });
    const ratio = t.length / Math.max(1, s.length);
    const [lo, hi] = lang === "ja" || lang === "zh" ? [0.4, 3.5] : [0.6, 6];
    if (s.length >= 8 && (ratio < lo || ratio > hi)) issues.push({ key, type: "length", ratio: +ratio.toFixed(2) });
    // 긴 용어부터 검사하고, 맞은 부분은 지움 → "Only One 리포트" 안의 "리포트"를 따로 검사하지 않음
    let rest = s;
    for (const term of [...glossary.terms].sort((x, y) => y.ko.length - x.ko.length)) {
      if (!rest.includes(term.ko)) continue;
      rest = rest.split(term.ko).join(" ");
      const want = term.dnt ? term.ko : term[lang];
      if (want && !t.toLowerCase().includes(want.toLowerCase())) issues.push({ key, type: "glossary", term: term.ko, want });
    }
  }
  return issues;
}

async function backTranslate(lang, src, tr, model) {
  const keys = Object.keys(src).filter((k) => typeof tr[k] === "string");
  const batches = [];
  for (let i = 0; i < keys.length; i += 40) batches.push(keys.slice(i, i + 40));
  const flagged = [];
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  await pool(batches, 2, async (ks) => {
    const items = Object.fromEntries(ks.map((k) => [k, { ko: src[k], tr: tr[k] }]));
    const { content, usage: u } = await chat({
      model,
      messages: [
        { role: "system", content: `You check ${lang} translations of Korean UI/marketing text. For each id, back-translate the translation to Korean mentally and compare meaning with the original. Return JSON {"bad":[{"id":"...","why":"short reason"}]} listing only items with meaning errors, omissions, wrong prices/numbers, or unnatural tone. Empty list if all fine.` },
        { role: "user", content: JSON.stringify(items) },
      ],
    });
    usage.prompt_tokens += u.prompt_tokens || 0; usage.completion_tokens += u.completion_tokens || 0;
    try { flagged.push(...(JSON.parse(content).bad || [])); } catch { flagged.push({ id: "*", why: "parse error" }); }
  });
  return { flagged, usage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs();
  const src = readJson(path.resolve(ROOT, a.src));
  const dir = path.resolve(ROOT, a.dir || "i18n/out");
  const langs = String(a.langs || "en,ja,zh,es").split(",");
  const report = {};
  for (const lang of langs) {
    const f = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(f)) { report[lang] = { error: "no file" }; continue; }
    const tr = readJson(f);
    report[lang] = { issues: mechanicalReview(lang, src, tr) };
    if (a.back) report[lang].back = await backTranslate(lang, src, tr, a.model || "gpt-5-mini");
    const b = report[lang].back;
    console.log(`[${lang}] 기계 검사 ${report[lang].issues.length}건${b ? `, 역번역 지적 ${b.flagged.length}건 (토큰 ${b.usage.prompt_tokens}/${b.usage.completion_tokens})` : ""}`);
  }
  if (a.out) writeJson(path.resolve(ROOT, a.out), report);
  const hard = Object.values(report).some((r) => (r.issues || []).some((i) => i.type === "structure" || i.type === "missing"));
  if (hard) process.exitCode = 1;
}
