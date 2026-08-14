#!/usr/bin/env node
/**
 * ICON-LEGACY-SAFETY gate  (defect DK)
 * ---------------------------------------------------------------------------
 * WHAT IT ENFORCES
 *   Every emoji that reaches a customer surface must be at or below
 *   U+1F6FF -- the end of the Unicode 6.0 (2010) emoji range. Codepoints above
 *   that cap are absent from the fonts on older phones and older printer
 *   pipelines, so they render as an empty box. The CEO first reported this as
 *   tofu squares in the issued report's chapter I.
 *
 * WHY THIS GATE EXISTS SEPARATELY FROM THE HOMEPAGE GATE
 *   scripts/verify-home-sample-truth.py section J already caps the icons inside
 *   the homepage sample block. It only looks at that one block of index.html.
 *   A live measurement of the rendered report/program books found violations on
 *   THREE files (report.html, program.html, index.html) plus the two data
 *   sources that feed them, none of which section J can see. This gate covers
 *   the whole set of customer-rendered surfaces.
 *
 * WHY IT DECODES ESCAPES  <-- the important part
 *   A plain codepoint scan of source text is BLIND to escape-encoded emoji.
 *   assets/js/program-engine.js stored the compass as
 *       icon: "\uD83E\uDDED"
 *   i.e. the UTF-16 surrogate pair spelled out in ASCII. A repo-wide grep for
 *   the character returned zero files while the glyph was visibly on the page:
 *   the engine materialises it at runtime. A gate that reads only literal
 *   characters would have reported PASS with the defect still shipping -- the
 *   same false-green-light shape as defect DI. So this gate decodes
 *       \uXXXX  \uXXXX (surrogate pairs)   \u{XXXXX}   &#xXXXX;   &#NNNNN;
 *   before scanning.
 *
 * SCOPE (customer-rendered surfaces + the data that feeds them)
 *   Group 1 -- the two issued books and their engines/data:
 *     report.html, program.html, index.html, success.html
 *     assets/js/report-engine-v4.js, assets/js/program-engine.js
 *     assets/i18n/ko.json, assets/i18n/en.json
 *     data/report-rules.json, data/program-rules.json
 *   Group 2 -- the rest of the customer-facing chrome. This group was NOT in
 *     the original scope. It was found by scanning the BUILT ARTIFACT
 *     (dist/hosting) after group 1 measured clean: the artifact is what the
 *     customer actually downloads, so the artifact is the honest scope
 *     boundary. Two of these files are the READER'S GUIDES to the books we
 *     just fixed -- leaving them would ship a guide whose icons contradict
 *     the product (defect DM family).
 *     b2b.html, checkin-21.html, checkin-21-en.html, mypage.html,
 *     product.html, product-v2.html, program-guide.html, report-guide.html,
 *     data/mapping.json
 *
 *   assets/js/report-engine.js is DELIBERATELY EXCLUDED: it is the frozen
 *   legacy engine marked DO NOT MODIFY. It is not on the v4 render path.
 *   blog/posts/** is DELIBERATELY EXCLUDED: dated editorial prose, not product
 *   chrome; rewriting a published post's text is a different decision.
 *   docs/** and marketing/** are excluded: not customer-rendered.
 *   dist/** is excluded: generated output, rebuilt from the sources above.
 *
 * ALSO ENFORCED: the section-icon contract stays internally consistent.
 *   The 12 section icons appear in FOUR places that must agree, or the engine's
 *   own icon_order QA check silently fails:
 *     1. assets/js/report-engine-v4.js  var expectedIcons = [...]
 *     2. data/report-rules.json         structure.order[].icon
 *     3. data/report-rules.json         emojiPolicy / emojiPolicy_en
 *     4. data/report-rules.json         qa[] criterion for qaId "icon_order"
 *   Changing one and forgetting the others is how this coupling breaks.
 *
 * HOW THIS GATE IS WIRED  <-- read before you add another gate
 *   package.json "test" runs THIS FILE and THEN scripts/test-all.mjs:
 *     "test": "node scripts/test-icon-legacy-safety.mjs && node scripts/test-all.mjs"
 *   The obvious wiring -- adding one run() line inside scripts/test-all.mjs --
 *   is NOT AVAILABLE ON A PULL REQUEST. test-all.mjs is listed in
 *   internal/evidence/evidence-contract.json protected_paths, and
 *   scripts/verify-internal-evidence-activation.mjs fails closed on any PR that
 *   touches a protected path or its digest file:
 *       unsupported_until_external_verifier
 *   That is deliberate: the evidence trust root may only change through the
 *   activation path, not through an ordinary feature PR. package.json is not a
 *   protected path, so the composite entry point is the correct seam for a new
 *   product gate. Wire new gates here, not in test-all.mjs.
 *
 * Run: node scripts/test-icon-legacy-safety.mjs   (or: npm test)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CAP = 0x1f6ff;          // last Unicode 6.0 (2010) emoji codepoint
const LOW = 0x1f000;          // start of the astral emoji planes we police
const HIGH = 0x1faff;

const SURFACES = [
  "report.html",
  "program.html",
  "index.html",
  "success.html",
  "assets/js/report-engine-v4.js",
  "assets/js/program-engine.js",
  "assets/i18n/ko.json",
  "assets/i18n/en.json",
  "data/report-rules.json",
  "data/program-rules.json",
  // group 2 -- surfaced by scanning the built hosting artifact (see header)
  "b2b.html",
  "checkin-21.html",
  "checkin-21-en.html",
  "mypage.html",
  "product.html",
  "product-v2.html",
  "program-guide.html",
  "report-guide.html",
  "data/mapping.json"
];

let checks = 0;
const failures = [];
function ck(label, cond, extra) {
  checks += 1;
  const tag = cond ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${label}${extra ? "  " + extra : ""}`);
  if (!cond) failures.push(label + (extra ? " :: " + extra : ""));
}

/** Resolve source escapes so escape-hidden emoji are visible to the scan. */
function decodeEscapes(src) {
  let t = src.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) =>
    String.fromCodePoint(parseInt(h, 16)));
  t = t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h) =>
    String.fromCodePoint(parseInt(h, 16)));
  t = t.replace(/&#(\d{1,7});/g, (_, d) => {
    const n = Number(d);
    return n <= 0x10ffff ? String.fromCodePoint(n) : _;
  });
  // JS string iteration already re-joins valid surrogate pairs into one
  // codepoint, so \uD83E\uDDED -> U+1F9ED without extra work here.
  return t;
}

function violations(text) {
  const hits = new Map();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= LOW && cp <= HIGH && cp > CAP) {
      const k = "U+" + cp.toString(16).toUpperCase();
      hits.set(k, (hits.get(k) || 0) + 1);
    }
  }
  return hits;
}

console.log("== ICON-LEGACY-SAFETY (defect DK) ==");
console.log(`   cap = U+${CAP.toString(16).toUpperCase()} (Unicode 6.0 / 2010)`);

console.log("\n-- A. literal scan --");
for (const rel of SURFACES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { ck(`${rel} present`, false, "missing"); continue; }
  const hits = violations(fs.readFileSync(p, "utf8"));
  ck(`literal: ${rel}`, hits.size === 0,
     hits.size ? JSON.stringify(Object.fromEntries(hits)) : "clean");
}

console.log("\n-- B. escape-decoded scan (catches \\uD83E\\uDDED style) --");
for (const rel of SURFACES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const hits = violations(decodeEscapes(fs.readFileSync(p, "utf8")));
  ck(`decoded: ${rel}`, hits.size === 0,
     hits.size ? JSON.stringify(Object.fromEntries(hits)) : "clean");
}

console.log("\n-- C. section-icon contract stays coupled --");
const engPath = path.join(ROOT, "assets/js/report-engine-v4.js");
const eng = fs.readFileSync(engPath, "utf8");
const m = eng.match(/var expectedIcons\s*=\s*\[(.*?)\];/s);
ck("expectedIcons array found in report-engine-v4.js", !!m);
let expected = [];
if (m) {
  expected = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  ck("expectedIcons has 12 entries", expected.length === 12, `${expected.length}`);
  ck("expectedIcons all within cap",
     expected.every((s) => [...s].every((c) => c.codePointAt(0) <= CAP)),
     expected.join(""));
}

const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));
const order = (rules.structure && rules.structure.order) || [];
ck("report-rules structure.order has 12 sections", order.length === 12, `${order.length}`);
const ruleIcons = order.map((s) => s.icon);
ck("structure.order icons equal expectedIcons, in order",
   expected.length === 12 && ruleIcons.length === 12 &&
   ruleIcons.every((ic, i) => ic === expected[i]),
   `rules=${ruleIcons.join("")} engine=${expected.join("")}`);

for (const key of ["emojiPolicy", "emojiPolicy_en"]) {
  const pol = rules.format ? rules.format[key] : undefined;
  ck(`format.${key} present`, typeof pol === "string", typeof pol);
  if (typeof pol === "string") {
    const inPol = [...pol].filter((c) => {
      const cp = c.codePointAt(0);
      return cp >= LOW && cp <= HIGH;
    });
    ck(`format.${key} lists the same 12 icons in order`,
       inPol.length === 12 && inPol.every((c, i) => c === expected[i]),
       inPol.join(""));
  }
}

const qa = Array.isArray(rules.qualityChecklist) ? rules.qualityChecklist : [];
const iconQa = qa.find((x) => x && x.qaId === "icon_order");
ck("qualityChecklist entry icon_order exists", !!iconQa);
if (iconQa) {
  const inQa = [...String(iconQa.criterion)].filter((c) => {
    const cp = c.codePointAt(0);
    return cp >= LOW && cp <= HIGH;
  });
  ck("icon_order criterion lists the same 12 icons in order",
     inQa.length === 12 && inQa.every((c, i) => c === expected[i]),
     inQa.join(""));
}

const mp = rules.promptTemplates && rules.promptTemplates.manualPrompt
  ? rules.promptTemplates.manualPrompt
  : JSON.stringify(rules);
ck("promptTemplates.manualPrompt present",
   !!(rules.promptTemplates && rules.promptTemplates.manualPrompt), "");
const inMp = [...String(mp)].filter((c) => {
  const cp = c.codePointAt(0);
  return cp >= LOW && cp <= HIGH && cp > CAP;
});
ck("manualPrompt carries no capped-out icon", inMp.length === 0, inMp.join(""));

console.log("\n-- D. the fix is not a one-off: cap is documented --");
ck("this gate names the cap so the next worker can see it",
   fs.readFileSync(new URL(import.meta.url)).toString().includes("U+1F6FF"), "");

console.log(`\n${checks} checks, ${failures.length} failed`);
if (failures.length) {
  console.error("\nICON-LEGACY-SAFETY FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("ICON-LEGACY-SAFETY PASS");
