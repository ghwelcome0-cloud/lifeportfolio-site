#!/usr/bin/env node
/**
 * build_manual_html.js  (v1.3 — PPT 슬라이드 + 자동 페이지네이션 / 머리글·꼬리글 안전 여백)
 *
 * 인생포트폴리오 제작 매뉴얼 HTML 생성기 (대기업 수준 고급 PDF 변환용)
 *
 * 핵심 개선:
 *  - PPT 슬라이드 방식: 모든 페이지 = 정확히 A4 한 장 (210mm × 297mm)
 *      ┌──────────────── HEADER (18mm, 고정 영역) ────────────────┐
 *      │                                                          │
 *      │                BODY  (가변, 슬라이드 캔버스)                │
 *      │                                                          │
 *      └──────────────── FOOTER (14mm, 고정 영역) ────────────────┘
 *  - 후처리 wrapPages() 가 모든 <section class="page">… 의 내용을
 *    .page-head + .page-body + .page-foot 3단 구조로 자동 변환
 *  - 카드/표는 page-break-inside: avoid 로 깨짐 방지
 *  - 톤 5종 결정 매핑 완전 제거 → 응답 기반 7개 시그니처 슬롯으로 교체
 *  - 13대 영역 샘플 (정치/경제/교육/예술/기술/복지/종교/스포츠/미디어/법률/환경/농업/의료)
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT     = path.resolve(__dirname, "..");
const OUT_HTML = path.join(ROOT, "reports/manual_v1/manual.html");

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const questions    = read("data/questions.json");
const mapping      = read("data/mapping.json");
const reportRules  = read("data/report-rules.json");
const programRules = read("data/program-rules.json");
const samples      = read("reports/manual_v1/samples_extract.json");

const VERSION  = "v1.3";
const PUB_DATE = "2026-05-06";
const FOOT_DEFAULT = `인생포트폴리오 제작 매뉴얼 ${VERSION} · ${PUB_DATE} · Life Portfolio Production Standard`;

// ──────────────────────────────────────────────────────────────
// Util
// ──────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const join = (arr) => Array.isArray(arr) ? arr.map(esc).join(" · ") : esc(arr);

const qText = {};
(questions.sections||[]).forEach(sec => {
  (sec.questions||[]).forEach(q => { qText[q.id] = q.text; });
});

// ──────────────────────────────────────────────────────────────
// 매핑·구조 표
// ──────────────────────────────────────────────────────────────
function axisRows(){
  const a = mapping.axes;
  return Object.keys(a).map(k => `<tr>
    <td class="ico">${esc(a[k].icon)}</td>
    <td><strong>${esc(a[k].title)}</strong> <span class="mono">(${esc(a[k].english||"")})</span></td>
    <td>${esc(a[k].description||"")}</td>
  </tr>`).join("\n");
}
function structureRows(){
  return reportRules.structure.order.map(o => `<tr>
    <td class="num">${esc(o.step)}</td>
    <td class="ico">${esc(o.icon)}</td>
    <td><strong>${esc(o.title)}</strong></td>
    <td class="mono">${esc(o.id)}</td>
  </tr>`).join("\n");
}
function mappingRowsAll(){
  const m = mapping.questionMapping;
  return Object.keys(m).sort((a,b)=>+a.replace("Q","")-+b.replace("Q","")).map(qid => {
    const x = m[qid];
    const axes  = (x.axes||[]).map(a => mapping.axes[a]?mapping.axes[a].title:a).join(" + ");
    const sects = (x.sections||[]).map(s => reportRules.structure.order.find(o=>o.id===s)).filter(Boolean)
      .map(o => o.icon+" "+o.title).join(" / ");
    return `<tr>
      <td class="mono">${esc(qid)}</td>
      <td>${esc(qText[qid] || x.comment || "—")}</td>
      <td>${esc(axes)}</td>
      <td>${esc(sects||"—")}</td>
      <td class="num">${esc(x.weight)}</td>
    </tr>`;
  }).join("\n");
}
// 매핑표는 길어 두 페이지로 분할
function mappingRowsChunk(start, end){
  const m = mapping.questionMapping;
  const all = Object.keys(m).sort((a,b)=>+a.replace("Q","")-+b.replace("Q",""));
  return all.slice(start,end).map(qid => {
    const x = m[qid];
    const axes  = (x.axes||[]).map(a => mapping.axes[a]?mapping.axes[a].title:a).join(" + ");
    const sects = (x.sections||[]).map(s => reportRules.structure.order.find(o=>o.id===s)).filter(Boolean)
      .map(o => o.icon+" "+o.title).join(" / ");
    return `<tr>
      <td class="mono">${esc(qid)}</td>
      <td>${esc(qText[qid] || x.comment || "—")}</td>
      <td>${esc(axes)}</td>
      <td>${esc(sects||"—")}</td>
      <td class="num">${esc(x.weight)}</td>
    </tr>`;
  }).join("\n");
}
function mappingTotalCount(){
  return Object.keys(mapping.questionMapping).length;
}

// ──────────────────────────────────────────────────────────────
// 응답 기반 7개 시그니처 슬롯 (구 톤 5종 표 대체)
// ──────────────────────────────────────────────────────────────
function signatureSlotRows(){
  const slots = [
    ["valueAnchor",    "가치 앵커",       "Q13",      "3개 핵심가치 → 가치 결의 첫 결"],
    ["compassPhrase",  "내적 나침반",     "Q63",      "의미·원칙 카테고리 응답을 결로 옮김"],
    ["axisLeadVerb",   "주도 동사",       "4축 비율",  "4축 백분율의 결합 패턴(예: dadd)으로 동사 결정"],
    ["traitColor",     "성향 결",         "Q6",       "3개 트레잇을 명사형 결로 변환"],
    ["primaryDomain",  "1차 도메인",      "Q75[0]",   "응답한 1순위 영역"],
    ["secondaryDomain","2차 도메인",      "Q75[1]",   "응답한 2순위 영역"],
    ["compassRaw",     "활동 트리거",     "Q39 + Q41","활동·열정 응답으로 사명/비전 footer 트리거 결정"]
  ];
  return slots.map(([key,label,src,desc]) => `<tr>
    <td class="mono">${esc(key)}</td>
    <td><strong>${esc(label)}</strong></td>
    <td class="mono">${esc(src)}</td>
    <td>${esc(desc)}</td>
  </tr>`).join("\n");
}

// ──────────────────────────────────────────────────────────────
// v4 레이어 카드
// ──────────────────────────────────────────────────────────────
function v4LayerCards(){
  const q = reportRules.qualityUpgradeLayer || {};
  const layers = [
    ["P0-1","강점 페어 매트릭스",    q.P0_1_strengthPairMatrix],
    ["P0-2","진로/교육 폴백 풀",     q.P0_2_careerEducationFallback],
    ["P0-3","사명·비전 7-슬롯 합성", q.P0_3_missionVision7Slot],
    ["P0-4","축×Tier 코멘트 매트릭스",q.P0_4_axisTierAxisComment],
    ["P1-1","시그니처 해상도",       q.P1_1_toneResolution],
    ["P1-2","도메인 21×21 확장",    q.P1_2_domainExpansion],
    ["P1-3","다양성 가드",           q.P1_3_diversityGuard],
    ["P2-1","Fingerprint(56문항)", q.P2_1_fullFingerprint],
    ["P2-2","자동 품질 검증",        q.P2_2_validateReport]
  ];
  return layers.map(([code,name,obj]) => obj ? `
    <div class="v4-layer">
      <div class="v4-code">${esc(code)}</div>
      <div class="v4-name">${esc(name)}</div>
      <div class="v4-desc">${esc(obj.description||"")}</div>
    </div>` : "").join("");
}

// ──────────────────────────────────────────────────────────────
// 체크리스트
// ──────────────────────────────────────────────────────────────
function checklistOrigin(){
  return (reportRules.qualityChecklist||[]).map((c,i) => `<tr>
    <td class="num">${i+1}</td>
    <td><strong>${esc(c.item)}</strong></td>
    <td>${esc(c.criterion)}</td>
    <td class="mono">${esc(c.qaId)}</td>
    <td class="check">☐</td>
  </tr>`).join("\n");
}
function checklistDesign(){
  const items = [
    ["폰트 계층",        "제목 13pt / 인용 11pt / 본문 10pt — Noto Sans KR"],
    ["이모지 순서",      "📘 → 🟦 → 🟩 → 🟥 → 🧭 → 📍 → 🧠 → 🎙 → 🎯 → 🚀 → 🧩 → 🧪"],
    ["볼드 처리",        "마크다운(**) 금지, 실제 서식(<strong>)으로만 강조"],
    ["인용 블록",        "12px 상하 여백, 본문(11pt)보다 작은 인용 블록"],
    ["표 스타일",        "회색 헤더 + 일정 행 간격 (구조 통일 필수)"],
    ["섹션 간격",        "headingTop 12px / sectionGap 16px"],
    ["고객 이름 표기",    "{name}님의 인생포트폴리오 헤더 고정"],
    ["사명/비전 형식",    "「당신의 사명은 '…' 입니다.」 / 「당신의 비전은 '…' 입니다.」 + 🔍 footer"],
    ["4축 카드 3단 구조","핵심 한 줄 + 감성 '~' 인용 + 키워드 4개(가운뎃점)"],
    ["요약하자면 마무리","🧩 핵심 2줄 + 🎯/🛠/🎓 3개 하위 항목"],
    ["파일명 규칙",      "인생포트폴리오_{name}_{yyyy-mm-dd}.pdf"],
    ["고지 문구 포함",   "📌 자동 안내 문구 + 🧪 이 리포트는… 고정 텍스트"]
  ];
  return items.map((it,i) => `<tr>
    <td class="num">${i+1}</td>
    <td><strong>${esc(it[0])}</strong></td>
    <td>${esc(it[1])}</td>
    <td class="check">☐</td>
  </tr>`).join("\n");
}

// ──────────────────────────────────────────────────────────────
// 13대 영역 샘플 카드 (페이지 1장 = 1 샘플)
// ──────────────────────────────────────────────────────────────
function sampleCards(){
  const total = samples.length;
  return samples.map((s,i) => {
    const ep  = s.ep || {};
    const gm  = s.gm || {};
    const ce  = s.ce || {};
    const app = s.app || {};
    const sm  = s.summary || {};
    const pr  = s.program || {};
    const eff = pr.effects || {};
    const ns  = pr.nextSteps || [];
    const sig = sm._signatureVars || {};
    return `
<section class="page sample-page" data-foot="샘플 ${i+1}/${total} · ${esc(s.domain)} 영역 — ${esc(s.name)}  ·  fingerprint ${esc(s.fp)}">
  <div class="page-head">
    <span class="ph-tag">샘플 ${i+1}/${total}</span>
    <span class="ph-domain">${esc(s.domain)} 영역</span>
    <span class="ph-name">${esc(s.name)}</span>
  </div>

  <div class="card sample-meta">
    <h3>① 입력 응답 → 개별성 시그니처 슬롯</h3>
    <table class="kv">
      <tr><th>fingerprint (56문항)</th><td class="mono">${esc(s.fp)}</td></tr>
      <tr><th>가치 앵커 (Q13)</th><td>${esc(sig.valueAnchor || "—")}</td></tr>
      <tr><th>내적 나침반 (Q63)</th><td>${esc(sig.compassPhrase || "—")}</td></tr>
      <tr><th>주도 동사 (4축)</th><td>${esc(sig.axisLeadVerb || "—")} <span class="mono">(${esc(sig.axisSig || "")})</span></td></tr>
      <tr><th>성향 결 (Q6)</th><td>${esc(sig.traitColor || "—")}</td></tr>
      <tr><th>1·2차 도메인 (Q75)</th><td>${esc(sig.primaryDomain || "—")} · ${esc(sig.secondaryDomain || "—")}</td></tr>
      <tr><th>실행 유형 / 스타일</th><td>${esc(ep.type || "")} / ${esc(ep.style || "")}</td></tr>
    </table>
  </div>

  <div class="card sample-summary">
    <h3>② 요약 (📘 summary)</h3>
    <p class="hd">${esc(sm.header || "")}</p>
    <p class="core">${esc(sm.coreOneLine || "")}</p>
  </div>

  <div class="card sample-ep">
    <h3>③ 실행 프로파일 (🟩 execution_profile)</h3>
    <table class="kv">
      <tr><th>추진력 요인 (Q13)</th><td>${join(ep.drivers)}</td></tr>
      <tr><th>몰입 환경 (Q47/Q49)</th><td>${join(ep.environment)}</td></tr>
      <tr><th>잘 맞는 활동 (Q39/Q41)</th><td>${join(ep.activities)}</td></tr>
      <tr><th>추천 도구 (Q73 + 시그니처 베이스)</th><td>${join(ep.tools)}</td></tr>
    </table>
  </div>

  <div class="card sample-gm">
    <h3>④ 성장 가이드맵 (🟥 growth_map) · ⑤ 진로·교육 (🧭 career_education)</h3>
    <div class="two-col">
      <div>
        <h4>TOP3 강점</h4>
        <ul>${(gm.strengths||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <h4>TOP2 성장 포인트</h4>
        <ul>${(gm.growth||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div>
        <h4>추천 진로 3</h4>
        <ul>${(ce.careers||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <h4>추천 교육 3</h4>
        <ul>${(ce.education||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </div>
  </div>

  <div class="card sample-app">
    <h3>⑥ 활용 예시 (📍 application) + 첫 행동 3가지</h3>
    <table class="kv small">
      <tr><th>직무 적용</th><td>${esc(app.job || "")}</td></tr>
      <tr><th>학습 적용</th><td>${esc(app.learning || "")}</td></tr>
    </table>
    <ol class="first-actions">${(app.firstActions||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
  </div>

  <div class="card sample-program">
    <h3>⑦ 맞춤 실행 프로그램 (3주 / 3개월 / 1년)</h3>
    <ol class="weeks">${(pr.weeks||[]).slice(0,3).map(w=>`<li><strong>${esc(w.title || "")}</strong>${(w.actions||[]).length ? ` — ${(w.actions||[]).slice(0,2).map(esc).join(" / ")}` : ""}</li>`).join("")}</ol>
    <table class="kv small mt8">
      <tr><th>fitJob</th><td>${esc(eff.fitJob || "")}</td></tr>
      <tr><th>vision</th><td>${esc(eff.vision || "")}</td></tr>
      <tr><th>newPaths</th><td>${(pr.newPaths||[]).map(esc).join(" · ")}</td></tr>
    </table>
    <ul class="ns mt8">${ns.slice(0,3).map(n=>`<li><strong>${esc(n.when || "")}:</strong> ${esc(n.task || "")}</li>`).join("")}</ul>
  </div>
</section>`;
  }).join("\n");
}

// ──────────────────────────────────────────────────────────────
// PPT 슬라이드 후처리: <section class="page" …> 내부 구조를
//   .page-head + .page-body + .page-foot 3단으로 자동 정리
// ──────────────────────────────────────────────────────────────
function wrapPages(html){
  // 모든 <section class="page …" …>…</section> 매칭
  return html.replace(
    /<section class="(page[^"]*)"([^>]*)>([\s\S]*?)<\/section>/g,
    (m, klass, attrs, inner) => {
      // data-foot 속성 추출
      const footMatch = attrs.match(/data-foot="([^"]*)"/);
      const footText  = footMatch ? footMatch[1] : FOOT_DEFAULT;

      // page-head 추출 (있으면)
      let head = "";
      const headMatch = inner.match(/<div class="page-head">([\s\S]*?)<\/div>/);
      if (headMatch) {
        head = headMatch[0];
        inner = inner.replace(headMatch[0], "");
      } else {
        head = `<div class="page-head"><span class="ph-tag">인생포트폴리오</span><span class="ph-domain">제작 매뉴얼</span><span class="ph-name">${VERSION}</span></div>`;
      }

      // 본문을 .page-body로 감쌈
      const body = `<div class="page-body">${inner.trim()}</div>`;

      // 꼬리글 영역
      const foot = `<div class="page-foot"><span class="pf-left">${esc(footText)}</span><span class="pf-right">${esc(VERSION)} · ${esc(PUB_DATE)}</span></div>`;

      // attrs에서 data-foot은 제거
      const cleanAttrs = attrs.replace(/\s*data-foot="[^"]*"/, "");
      return `<section class="${klass}"${cleanAttrs}>${head}${body}${foot}</section>`;
    }
  );
}

// ──────────────────────────────────────────────────────────────
// HTML 본체
// ──────────────────────────────────────────────────────────────
const rawHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>인생포트폴리오 제작 매뉴얼 ${VERSION} — Life Portfolio Production Standard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Noto+Serif+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#1a1d24; --ink-soft:#3b4252; --muted:#6b7280;
  --line:#e5e7eb; --line-soft:#f1f5f9;
  --brand:#1c3a5e; --brand-2:#2e6cb6; --accent:#c79b3a;
  --bg:#ffffff; --bg-soft:#f8fafc; --bg-card:#fbfaf6;
  --ok:#107a4d; --warn:#a85d00;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0; background:#fff}
body{
  font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  color:var(--ink); font-size:9.8pt; line-height:1.55;
  -webkit-font-smoothing:antialiased; word-break:keep-all;
  counter-reset:slide;
}
h1,h2,h3,h4{font-family:'Noto Serif KR','Noto Sans KR',serif; color:var(--brand); letter-spacing:-0.01em; margin:0}
h1{font-size:22pt; line-height:1.3; font-weight:900}
h2{font-size:15pt; line-height:1.3;  font-weight:700; margin:0 0 9px}
h3{font-size:11.5pt; line-height:1.4; font-weight:700; margin:0 0 5px; color:var(--brand)}
h4{font-size:10pt; line-height:1.4; font-weight:700; margin:8px 0 3px; color:var(--ink)}
p{margin:0 0 5px}
strong{font-weight:700; color:var(--ink)}
em{font-style:normal; color:var(--brand-2); font-weight:500}
ul,ol{margin:0 0 5px 0; padding-left:18px}
li{margin:0 0 2px}
.mono{font-family:'SF Mono','Consolas','Menlo',monospace; font-size:8.7pt; color:var(--ink-soft)}
.muted{color:var(--muted)}
.mt8{margin-top:6px}
.center{text-align:center}

/* =========================================================
   PPT 슬라이드 시스템 v1.3 — A4 (210 × 297mm) + 자동 페이지네이션
   • @page 마진 (top 24mm / bottom 20mm) → 머리글·꼬리글이
     Puppeteer displayHeaderFooter 로 모든 장에 자동 인쇄됨
   • .page 는 슬라이드 1장 = A4 캔버스 (콘텐츠 영역 가득 채움)
   • 콘텐츠가 캔버스를 넘어가면 동일 head/foot 가 반복되며
     자동으로 다음 슬라이드로 분할됨 (PPT 스타일)
   ========================================================= */
.page{
  width:170mm;            /* A4 - 좌우 안전 여백 (20mm × 2) */
  min-height:243mm;       /* A4 - (top 24mm + bottom 20mm + head/foot breath 10mm) */
  margin:0 auto;
  position:relative;
  padding:0;
  /* PPT 슬라이드: 한 슬라이드 끝나면 다음 장 시작
     단, 본문이 캔버스를 넘기면 자연 분할 허용 (잘림 방지) */
  page-break-before:always; break-before:page;
  page-break-after:always;  break-after:page;
}
.page:first-of-type{page-break-before:auto; break-before:auto}
.page:last-of-type{page-break-after:auto; break-after:auto}

/* PAGE-HEAD : 슬라이드 제목 영역 (페이지 첫 장에만 표시 / 분할시 비표시) */
.page-head{
  height:14mm;
  padding:0 0 6px;
  margin:0 0 8px;
  border-bottom:1.5px solid var(--brand);
  display:flex; justify-content:space-between; align-items:flex-end;
  font-size:9pt; color:var(--brand);
  background:#fff;
  position:relative;
  break-inside:avoid; page-break-inside:avoid;
  break-after:avoid;  page-break-after:avoid;
}
.page-head::before{
  content:""; position:absolute; left:0; top:-2mm;
  width:60mm; height:3px; background:var(--accent);
}
.ph-tag{font-weight:700; letter-spacing:0.05em}
.ph-domain{font-weight:500}
.ph-name{font-weight:500; color:var(--ink-soft)}

/* PAGE-BODY : 슬라이드 캔버스 (가득 채움 + 자동 분할) */
.page-body{
  display:flex; flex-direction:column;
  gap:5px;
  /* 한 슬라이드 안에 가득 채울 수 있는 최대 높이 */
  min-height:215mm;
  /* 콘텐츠가 넘치면 다음 슬라이드로 자연 분할 */
  break-inside:auto; page-break-inside:auto;
}
.page-body > *:last-child{margin-bottom:0}

/* 슬라이드 분할 시 콘텐츠 단위 보호 — 카드/표는 절대 잘리지 않음 */
.page-body > .card,
.page-body > table,
.page-body > pre,
.page-body > .v4-grid > .v4-layer{
  break-inside:avoid; page-break-inside:avoid;
}

/* PAGE-FOOT (legacy — 인쇄 시 displayHeaderFooter로 대체되므로 숨김) */
.page-foot{display:none}
.pf-left,.pf-right{display:none}

/* 카드 — 페이지 깨짐 방지 */
.card{
  break-inside:avoid; page-break-inside:avoid;
  background:var(--bg-card);
  border:1px solid var(--line);
  border-radius:6px;
  padding:9px 12px;
  margin:0 0 6px;
}
.card h3{margin:0 0 5px}
.card h4{margin:6px 0 3px}

/* 표 */
table{
  width:100%; border-collapse:collapse;
  break-inside:avoid; page-break-inside:avoid;
  font-size:9pt;
}
table.kv th{
  width:32%; text-align:left; vertical-align:top;
  background:var(--bg-soft);
  padding:4px 7px; border:1px solid var(--line);
  font-weight:500; color:var(--ink-soft);
}
table.kv td{padding:4px 7px; border:1px solid var(--line); vertical-align:top}
table.kv.small{font-size:8.7pt}
table.grid th, table.grid td{
  padding:4px 7px; border:1px solid var(--line);
  vertical-align:top; text-align:left;
}
table.grid th{
  background:var(--brand); color:#fff;
  font-weight:500; font-size:9pt; letter-spacing:0.02em;
}
table.grid tbody tr:nth-child(even){background:var(--bg-soft)}
table.grid td.num, table.grid th.num{text-align:center; width:8%}
table.grid td.ico, table.grid th.ico{text-align:center; width:7%; font-size:12pt}
table.grid td.mono{font-family:'SF Mono','Consolas',monospace; font-size:8.2pt}
table.grid td.check{text-align:center; width:7%; font-size:13pt}
table.grid tr{break-inside:avoid; page-break-inside:avoid}

.two-col{display:grid; grid-template-columns:1fr 1fr; gap:10px}
.two-col h4{margin-top:0}

/* 표지 */
.cover{
  width:210mm; height:297mm;
  padding:30mm 18mm;
  background:linear-gradient(155deg, #fff 60%, #f0eee5 100%);
  position:relative;
  page-break-after:always; break-after:page;
  display:flex; flex-direction:column;
  overflow:hidden;
}
.cover .brand-bar{width:60mm; height:3px; background:var(--brand); margin-bottom:24mm}
.cover .doc-type{font-size:11pt; color:var(--brand); letter-spacing:0.5em; font-weight:700; margin-bottom:6mm}
.cover .title{font-family:'Noto Serif KR',serif; font-size:34pt; line-height:1.25; font-weight:900; color:var(--ink); margin-bottom:10mm}
.cover .subtitle{font-size:12pt; color:var(--ink-soft); line-height:1.7; margin-bottom:14mm; font-weight:400}
.cover .badge-row{display:flex; gap:6px; margin-bottom:18mm; flex-wrap:wrap}
.cover .badge{border:1.5px solid var(--brand); color:var(--brand); padding:3px 10px; border-radius:14px; font-size:8.5pt; font-weight:500}
.cover .meta-block{border-top:2px solid var(--brand); padding-top:8mm; display:grid; grid-template-columns:auto 1fr; gap:5px 14px; font-size:9.5pt}
.cover .meta-block dt{color:var(--muted); font-weight:500}
.cover .meta-block dd{margin:0; color:var(--ink); font-weight:500}
.cover .seal{
  position:absolute; right:18mm; bottom:24mm;
  width:38mm; height:38mm; border-radius:50%;
  border:2px solid var(--accent); color:var(--accent);
  display:flex; align-items:center; justify-content:center;
  font-family:'Noto Serif KR',serif; font-weight:700; text-align:center;
  font-size:9pt; letter-spacing:0.05em; background:rgba(255,255,255,0.85);
}
.cover .seal small{display:block; font-size:7.2pt; margin-top:2px; letter-spacing:0.1em}

/* 목차 */
.toc-table{font-size:9.5pt}
.toc-table td{padding:5px 8px; border-bottom:1px dotted var(--line)}
.toc-table td:first-child{width:9%; color:var(--muted); font-weight:500}
.toc-table td:nth-child(3){text-align:right; color:var(--muted); width:8%}

/* 섹션 헤더 */
.section-title{
  display:flex; align-items:baseline; gap:9px;
  border-bottom:2px solid var(--brand); padding-bottom:5px; margin:0 0 9px;
}
.section-title .num{
  background:var(--brand); color:#fff;
  font-size:9pt; padding:2px 7px; border-radius:3px;
  font-weight:700; letter-spacing:0.05em;
}
.section-title h2{margin:0}

.lead{
  background:#f7f4ec; border-left:4px solid var(--accent);
  padding:8px 12px; margin:0 0 8px; border-radius:0 5px 5px 0;
  font-size:9.5pt; line-height:1.65;
}

/* 매핑표 전용 */
table.mapping th:nth-child(1){width:7%}
table.mapping th:nth-child(2){width:38%}
table.mapping th:nth-child(3){width:18%}
table.mapping th:nth-child(4){width:27%}
table.mapping th:nth-child(5){width:8%; text-align:center}

/* 시그니처 표 */
table.sig th:nth-child(1){width:18%}
table.sig th:nth-child(2){width:18%}
table.sig th:nth-child(3){width:14%}

/* v4 그리드 */
.v4-grid{display:grid; grid-template-columns:repeat(3, 1fr); gap:6px}
.v4-layer{
  padding:7px 9px; background:#fff;
  border:1px solid var(--line); border-radius:5px;
  break-inside:avoid; page-break-inside:avoid;
}
.v4-layer .v4-code{
  font-family:'SF Mono',monospace; font-size:7.8pt;
  background:var(--brand); color:#fff;
  padding:1px 5px; border-radius:3px;
  display:inline-block; margin-bottom:3px; letter-spacing:0.04em;
}
.v4-layer .v4-name{font-weight:700; font-size:9.5pt; margin-bottom:2px; color:var(--brand)}
.v4-layer .v4-desc{font-size:8.5pt; line-height:1.5; color:var(--ink-soft)}

/* 프롬프트 코드 */
pre.prompt{
  background:#0f1722; color:#dbe6f1;
  padding:10px 13px; border-radius:6px;
  font-family:'SF Mono','Consolas',monospace;
  font-size:8.2pt; line-height:1.55;
  white-space:pre-wrap; word-break:break-all;
  break-inside:avoid; page-break-inside:avoid;
  border-left:4px solid var(--accent);
  margin:0;
}
pre.prompt .ph{color:#f9c660}
pre.prompt .key{color:#7ed1ff; font-weight:600}

/* 체크리스트 */
table.checklist td.check{font-size:13pt; color:var(--brand)}
table.checklist td:nth-child(1){width:6%; text-align:center}
table.checklist td:nth-child(2){width:24%}
table.checklist td:nth-child(3){width:48%}
table.checklist td:nth-child(4){width:14%; font-family:'SF Mono',monospace; font-size:8pt}
table.checklist td:nth-child(5){width:8%; text-align:center}

/* 샘플 페이지 — 구분 */
.sample-page .page-head{border-bottom-color:var(--accent)}
.sample-page .ph-tag{background:var(--accent); color:#fff; padding:1px 8px; border-radius:3px}
.sample-meta{background:#fff8e8; border-color:#e7d8a3}
.sample-summary{background:#eef4fb}
.sample-program{background:#eef9ee; border-color:#bce0bc}
.sample-page .card h3{font-size:10.5pt}
.sample-page .card{padding:7px 10px; margin-bottom:5px}
.sample-summary .hd{font-weight:700; margin:0 0 3px; font-size:9.5pt}
.sample-summary .core{margin:0; font-size:9pt; line-height:1.6}
ul.weeks li{margin-bottom:3px; font-size:8.7pt}
ul.ns li{margin-bottom:3px; line-height:1.5; font-size:8.6pt}
ol.first-actions li{font-size:8.7pt; margin-bottom:2px}

/* 발행자 서명란 */
.sig-row{display:grid; grid-template-columns:1fr 1fr; gap:18mm; margin-top:30mm}
.sig-row .sig-box{
  border-top:1.2px solid var(--ink);
  padding-top:5px; font-size:9.5pt; color:var(--ink-soft);
  text-align:center;
}
.sig-row .sig-box strong{display:block; color:var(--ink); margin-bottom:14mm}

/* =========================================================
   인쇄 PDF — A4 + 머리글/꼬리글 안전 여백
   • @page margin 으로 페이지 외곽 breath (PPT 슬라이드 프레임)
   • Puppeteer displayHeaderFooter 가 이 마진 안에 head/foot 인쇄
   ========================================================= */
@page{
  size:A4;
  margin:24mm 20mm 20mm 20mm;  /* top / right / bottom / left */
}
@page :first{
  margin:0;  /* 표지는 가장자리까지 */
}
@media print{
  body{font-size:9.8pt}
  .cover{margin:0; width:210mm; height:297mm}
  .page{margin:0 auto}
  a{color:inherit; text-decoration:none}
}
</style>
</head>
<body>

<!-- ───────────── COVER ───────────── -->
<section class="cover">
  <div class="brand-bar"></div>
  <div class="doc-type">PRODUCTION   STANDARD   MANUAL</div>
  <h1 class="title">인생포트폴리오<br>제작 매뉴얼</h1>
  <div class="subtitle">
    누구나 동일한 퀄리티의 리포트와 맞춤형 실행 프로그램을 제작할 수 있도록<br>
    매핑·제작·검수·운영 전 과정의 단일 표준을 정의합니다.<br>
    <em>AI 자동 생성 · 사람의 수동 제작 — 두 경로의 산출 결과가 동일한 품질을 보장합니다.</em>
  </div>
  <div class="badge-row">
    <span class="badge">매핑 v2.1</span>
    <span class="badge">리포트 룰북 P v4.0</span>
    <span class="badge">프로그램 룰북 Q v2.0</span>
    <span class="badge">엔진 v1.3 + v4.1</span>
    <span class="badge">고유성 1 / 8,000,000,000</span>
    <span class="badge">13대 영역 샘플</span>
  </div>
  <dl class="meta-block">
    <dt>발행</dt><dd>인생포트폴리오 제작팀 (Life Portfolio Production Team)</dd>
    <dt>버전</dt><dd>${esc(VERSION)} (PPT Slide System · 톤 5종 매핑 폐지)</dd>
    <dt>발행일</dt><dd>${esc(PUB_DATE)}</dd>
    <dt>적용 범위</dt><dd>리포트 + 맞춤형 실행 프로그램 — 한국어/English 양 언어</dd>
    <dt>준수 의무</dt><dd>본 매뉴얼은 모든 제작 인력(AI/사람)에게 동일하게 적용됩니다</dd>
    <dt>보안 등급</dt><dd>내부 — 외부 배포 금지 (NDA 대상)</dd>
  </dl>
  <div class="seal">인생포트폴리오<br>제작 표준<br><small>STANDARD</small></div>
</section>

<!-- ───────────── 발행 정보 / 서문 ───────────── -->
<section class="page" data-foot="발행 정보 · 서문 · 개정 이력">
  <div class="page-head">
    <span class="ph-tag">발행 정보</span>
    <span class="ph-domain">서문 · 개정 이력</span>
    <span class="ph-name">${esc(VERSION)} / ${esc(PUB_DATE)}</span>
  </div>
  <div class="section-title"><span class="num">PREFACE</span><h2>이 매뉴얼이 보장하는 것</h2></div>
  <div class="lead">
    인생포트폴리오는 <strong>"오직 응답에 근거한 매핑 → 매핑에 근거한 리포트 합성 → 리포트에 근거한 실행 프로그램 합성"</strong>의 3단 폐쇄 루프로 작동합니다.
    본 매뉴얼은 이 루프의 모든 단계에서 <strong>AI 자동 생성과 사람 수작업이 동일한 산출 품질</strong>을 내도록 단일 표준을 정의합니다.
  </div>
  <div class="card">
    <h3>① 핵심 원칙 (Production Principles)</h3>
    <ol>
      <li><strong>응답 단일 진실(Source of Truth):</strong> 모든 합성 슬롯은 본인의 Q3~Q78 응답에서만 도출됩니다. 외부 데이터·추측 주입 금지.</li>
      <li><strong>매핑 폐쇄성(Closed Mapping):</strong> Q→4축, Q→6섹션 매핑은 <span class="mono">data/mapping.json</span> 의 <span class="mono">questionMapping</span> 만 사용합니다.</li>
      <li><strong>응답 기반 개별성 합성(Response-Driven Signature):</strong> 인위적인 톤·유형 분류는 사용하지 않습니다. 회원의 56문항 응답에서 <strong>7개 시그니처 슬롯</strong>(가치 앵커·내적 나침반·주도 동사·성향 결·1·2차 도메인·활동 트리거)을 직접 도출해 본문 합성에 사용합니다.</li>
      <li><strong>구조 고정(Fixed Structure):</strong> 12단 구조·이모지 순서·폰트 계층 변경 금지.</li>
      <li><strong>이중 검증(Dual Validation):</strong> 산출 직후 <em>17개 자동 품질 검증</em> + <em>12개 디자인/템플릿 준수 체크리스트</em> 모두 통과 필수.</li>
      <li><strong>고유성 보장(Uniqueness):</strong> 56문항 fingerprint + 7-슬롯 시그니처 합성 + 도메인 21×21 확장 = 약 80억분의 1.</li>
    </ol>
  </div>
  <div class="card">
    <h3>② 개정 이력 (Revision History)</h3>
    <table class="grid">
      <thead><tr><th class="num">#</th><th>버전</th><th>일자</th><th>주요 변경</th><th>승인</th></tr></thead>
      <tbody>
        <tr><td class="num">1</td><td>v1.0</td><td>2026-05-06</td><td>최초 발행 — 매핑 v2.1 + 리포트 룰북 P v4.0 + 프로그램 룰북 Q v2.0 + 7대 영역 샘플</td><td>제작팀</td></tr>
        <tr><td class="num">2</td><td>v1.1</td><td>2026-05-06</td><td>샘플을 13대 영역으로 확장(스포츠·미디어·법률·환경·농업·의료 추가)</td><td>제작팀</td></tr>
        <tr><td class="num">3</td><td>v1.2</td><td>2026-05-06</td><td>톤 5종 결정 매핑 제거 → 응답 기반 7슬롯으로 전환 / PPT 슬라이드 페이지 시스템 도입(머리글 18mm + 본문 + 꼬리글 14mm)</td><td>제작팀</td></tr>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h3>③ 본 매뉴얼의 사용 흐름</h3>
    <ol>
      <li>고객의 76문항 응답 데이터를 수령한다 (CSV/JSON/Sheets).</li>
      <li><strong>Part Ⅱ 매핑표</strong>에 따라 각 Q의 4축·섹션·가중치 + 7개 시그니처 슬롯을 추출한다.</li>
      <li><strong>Part Ⅲ 제작 규칙</strong>의 12단 구조 + v4 강화 레이어를 적용해 본문을 합성한다.</li>
      <li>AI 자동 생성: <span class="mono">scripts/build_kys_program.js</span> 와 동일 패턴으로 엔진을 호출한다. 수동: <strong>Part Ⅳ 프롬프트</strong>를 ChatGPT/Claude에 입력한다.</li>
      <li><strong>Part Ⅴ 체크리스트</strong>로 산출 근거 17 + 디자인 12 항목 통과시킨다.</li>
      <li><strong>Part Ⅵ 샘플 13개</strong>의 영역별 시그니처 결을 비교해 일관성을 점검한다.</li>
      <li><strong>Part Ⅶ 거버넌스</strong>에 따라 발행·전달·기록을 완료한다.</li>
    </ol>
  </div>
</section>

<!-- ───────────── TOC ───────────── -->
<section class="page" data-foot="목차 (Table of Contents)">
  <div class="page-head">
    <span class="ph-tag">CONTENTS</span>
    <span class="ph-domain">목차</span>
    <span class="ph-name">12장 구성</span>
  </div>
  <div class="section-title"><span class="num">TOC</span><h2>목차</h2></div>
  <table class="toc-table">
    <tr><td>Part Ⅰ</td><td>제품 개요와 제작 원리 (3단 폐쇄 루프)</td><td>04</td></tr>
    <tr><td>Part Ⅱ</td><td>최신 매핑표 — 4축 / 6섹션 / Q3~Q78 / 응답 기반 7슬롯</td><td>05</td></tr>
    <tr><td>Part Ⅲ</td><td>제작 규칙 — 12단 구조 + 응답 기반 합성 + v4 강화 레이어</td><td>09</td></tr>
    <tr><td>Part Ⅳ</td><td>수동 제작 템플릿 프롬프트 (ChatGPT/Claude 직접 사용)</td><td>11</td></tr>
    <tr><td>Part Ⅴ</td><td>평가 체크리스트 — 산출 근거 17 + 디자인 12 + QA SOP</td><td>14</td></tr>
    <tr><td>Part Ⅵ</td><td>13대 영역 샘플 (정치·경제·교육·예술·기술·복지·종교·스포츠·미디어·법률·환경·농업·의료)</td><td>17</td></tr>
    <tr><td>Part Ⅶ</td><td>운영 거버넌스 — 역할·권한·SOP·사고 대응</td><td>30</td></tr>
    <tr><td>부록 A</td><td>용어집 (Glossary)</td><td>32</td></tr>
    <tr><td>부록 B</td><td>변경 관리 / 버전 관리 표</td><td>33</td></tr>
    <tr><td>발행자</td><td>서명란 (Sign-off)</td><td>34</td></tr>
  </table>
  <div class="card mt8">
    <h3>페이지 시스템 (PPT Slide System)</h3>
    <p>모든 페이지는 A4 1장(210×297mm)에 정확히 맞춰지며, 머리글(18mm) + 본문(슬라이드 캔버스) + 꼬리글(14mm) 3단 구조로 구성됩니다. 카드와 표는 페이지 경계에서 잘리지 않도록 보호됩니다.</p>
  </div>
</section>

<!-- ───────────── PART I ───────────── -->
<section class="page" data-foot="Part Ⅰ · 제품 개요와 제작 원리 (3단 폐쇄 루프)">
  <div class="page-head"><span class="ph-tag">PART Ⅰ</span><span class="ph-domain">제품 개요</span><span class="ph-name">3단 폐쇄 루프</span></div>
  <div class="section-title"><span class="num">Ⅰ</span><h2>제품 개요와 제작 원리</h2></div>
  <div class="card">
    <h3>① 제품 정의</h3>
    <p>인생포트폴리오 패키지는 두 개의 산출물로 구성됩니다.</p>
    <ol>
      <li><strong>인생포트폴리오 리포트</strong> — 12단 고정 구조의 PDF 리포트 (📘 ~ 🧪)</li>
      <li><strong>맞춤형 실행 프로그램</strong> — 3주 / 3개월 / 1년 단위로 전개되는 실행 안내서</li>
    </ol>
    <p>두 산출물은 동일한 응답 데이터에서 도출된 <strong>7개 시그니처 슬롯</strong>으로 결을 일치시켜 같은 사람의 두 얼굴이 끊김 없이 이어지도록 설계됩니다.</p>
  </div>
  <div class="card">
    <h3>② 3단 폐쇄 루프 (Closed Loop)</h3>
    <table class="grid">
      <thead><tr><th class="num">단계</th><th>작업</th><th>입력</th><th>출력</th><th>책임 모듈</th></tr></thead>
      <tbody>
        <tr><td class="num">1</td><td><strong>응답 → 매핑</strong></td><td>76문항 응답</td><td>4축 점수 + 6섹션 가중 점수 + 7개 시그니처 슬롯</td><td>report-engine.js</td></tr>
        <tr><td class="num">2</td><td><strong>매핑 → 리포트</strong></td><td>매핑 결과 + 시그니처 + 응답</td><td>12단 리포트 (📘 ~ 🧪)</td><td>report-engine-v4.js</td></tr>
        <tr><td class="num">3</td><td><strong>리포트 → 프로그램</strong></td><td>v4 리포트</td><td>3주 / 3개월 / 1년 실행 프로그램</td><td>program-engine.js</td></tr>
      </tbody>
    </table>
    <p class="muted">※ 어떠한 단계에서도 외부 가설·추측을 주입하지 않습니다. 모든 슬롯은 응답에서만 채워집니다.</p>
  </div>
  <div class="card">
    <h3>③ 고유성(Uniqueness) 모델</h3>
    <ul>
      <li><strong>fingerprint:</strong> 56문항 djb2 해시 → 응답 1비트만 달라도 fingerprint가 변합니다.</li>
      <li><strong>강점 페어 매트릭스:</strong> 12 trait → 66 페어 × 4 변형 = 228 합성문</li>
      <li><strong>사명·비전 7-슬롯:</strong> 7개 슬롯 합성 × 21 도메인 × 21 보조 = 약 7.2백만 변형</li>
      <li><strong>도메인 21×21 확장:</strong> 441 경로 × 5 템플릿 = 2,205 변형</li>
      <li><strong>합산 결과:</strong> 1 / 8,000,000,000 (80억 분의 1)의 고유 식별성</li>
    </ul>
  </div>
</section>

<!-- ───────────── PART II - 1 (4축 + 6섹션) ───────────── -->
<section class="page" data-foot="Part Ⅱ-1 · 4축 정의 + 6 리포트 섹션 정의">
  <div class="page-head"><span class="ph-tag">PART Ⅱ</span><span class="ph-domain">최신 매핑표</span><span class="ph-name">매핑 v2.1</span></div>
  <div class="section-title"><span class="num">Ⅱ-1</span><h2>4축 정의</h2></div>
  <table class="grid">
    <thead><tr><th class="ico">아이콘</th><th>축</th><th>정의</th></tr></thead>
    <tbody>${axisRows()}</tbody>
  </table>
  <div class="section-title" style="margin-top:10px"><span class="num">Ⅱ-2</span><h2>6 리포트 섹션 정의</h2></div>
  <table class="grid">
    <thead><tr><th class="ico">아이콘</th><th>섹션</th><th>ID</th></tr></thead>
    <tbody>
      ${Object.keys(mapping.reportSections).map(k => `<tr>
        <td class="ico">${esc(mapping.reportSections[k].icon)}</td>
        <td><strong>${esc(mapping.reportSections[k].title)}</strong></td>
        <td class="mono">${esc(k)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</section>

<!-- ───────────── PART II - 2 (Mapping Q3~Q40) ───────────── -->
<section class="page" data-foot="Part Ⅱ-3 · 문항별 매핑표 (전반)">
  <div class="page-head"><span class="ph-tag">PART Ⅱ</span><span class="ph-domain">Q3~Q40 매핑표</span><span class="ph-name">매핑 v2.1 (1/2)</span></div>
  <div class="section-title"><span class="num">Ⅱ-3</span><h2>문항별 매핑표 (전반)</h2></div>
  <p class="muted">각 문항은 (1) 4축 중 1개 이상, (2) 6섹션 중 1개 이상으로 매핑되며, weight(0.0~2.0)에 따라 가중 합산됩니다.</p>
  <table class="grid mapping">
    <thead><tr><th>Q ID</th><th>문항 요지</th><th>4축</th><th>6섹션</th><th class="num">w</th></tr></thead>
    <tbody>${mappingRowsChunk(0, Math.ceil(mappingTotalCount()/2))}</tbody>
  </table>
</section>

<!-- ───────────── PART II - 3 (Mapping Q41~Q78) ───────────── -->
<section class="page" data-foot="Part Ⅱ-3 · 문항별 매핑표 (후반)">
  <div class="page-head"><span class="ph-tag">PART Ⅱ</span><span class="ph-domain">Q41~Q78 매핑표</span><span class="ph-name">매핑 v2.1 (2/2)</span></div>
  <div class="section-title"><span class="num">Ⅱ-3</span><h2>문항별 매핑표 (후반)</h2></div>
  <table class="grid mapping">
    <thead><tr><th>Q ID</th><th>문항 요지</th><th>4축</th><th>6섹션</th><th class="num">w</th></tr></thead>
    <tbody>${mappingRowsChunk(Math.ceil(mappingTotalCount()/2), mappingTotalCount())}</tbody>
  </table>
</section>

<!-- ───────────── PART II - 4 (Signature Slots) ───────────── -->
<section class="page" data-foot="Part Ⅱ-4 · 응답 기반 개별성 시그니처 7슬롯">
  <div class="page-head"><span class="ph-tag">PART Ⅱ</span><span class="ph-domain">개별성 시그니처</span><span class="ph-name">응답 기반 7슬롯</span></div>
  <div class="section-title"><span class="num">Ⅱ-4</span><h2>응답 기반 개별성 시그니처 — 7개 합성 슬롯</h2></div>
  <div class="lead">
    본 제품은 <strong>인위적인 5종 분류(톤)</strong>를 사용하지 않습니다. 각 회원의 56문항 응답에서
    <strong>7개의 시그니처 슬롯</strong>을 직접 도출하고, 이 슬롯의 조합으로 약 80억 분의 1 수준의 고유한 결을 만들어 냅니다.
    제작자는 어떤 경우에도 응답 데이터를 임의의 카테고리에 끼워 넣지 않습니다.
  </div>
  <table class="grid sig">
    <thead><tr><th>슬롯 키</th><th>한국어 라벨</th><th>응답 출처</th><th>도출 규칙</th></tr></thead>
    <tbody>${signatureSlotRows()}</tbody>
  </table>
  <div class="card mt8">
    <h3>가치 카테고리 ↔ Q13 키워드 (참고용 합성 사전)</h3>
    <p class="muted">아래 매핑은 회원을 카테고리로 분류하기 위한 것이 아니라, Q13 응답 키워드를 자연어 문장으로 풀어내는 합성 사전입니다.</p>
    <table class="grid">
      <thead><tr><th>카테고리</th><th>해당 Q13 키워드</th></tr></thead>
      <tbody>
        ${Object.keys(mapping.valueKeywordMap).filter(k=>k!=="$comment").map(k =>
          `<tr><td><strong>${esc(k)}</strong></td><td>${(mapping.valueKeywordMap[k]||[]).map(esc).join(" · ")}</td></tr>`
        ).join("")}
      </tbody>
    </table>
  </div>
</section>

<!-- ───────────── PART III - 1 (12단 구조 + 서식) ───────────── -->
<section class="page" data-foot="Part Ⅲ-1 · 리포트 12단 고정 구조 + 서식 규칙">
  <div class="page-head"><span class="ph-tag">PART Ⅲ</span><span class="ph-domain">제작 규칙</span><span class="ph-name">룰북 P v4.0</span></div>
  <div class="section-title"><span class="num">Ⅲ-1</span><h2>리포트 12단 고정 구조</h2></div>
  <p class="muted">순서·이모지·제목은 어떠한 경우에도 변경 금지.</p>
  <table class="grid">
    <thead><tr><th class="num">#</th><th class="ico">아이콘</th><th>섹션 제목</th><th>ID</th></tr></thead>
    <tbody>${structureRows()}</tbody>
  </table>
  <div class="section-title" style="margin-top:10px"><span class="num">Ⅲ-2</span><h2>서식 규칙 (Format)</h2></div>
  <table class="grid">
    <thead><tr><th>항목</th><th>규칙</th></tr></thead>
    <tbody>
      <tr><td>폰트 패밀리</td><td>Noto Sans KR (한국어) / Inter, system-ui (English)</td></tr>
      <tr><td>폰트 계층</td><td>제목 13pt / 인용 11pt / 본문 10pt</td></tr>
      <tr><td>볼드</td><td>실제 서식(&lt;strong&gt;)으로만 강조 — 마크다운(**) 금지</td></tr>
      <tr><td>섹션 간격</td><td>headingTop 12px / sectionGap 16px</td></tr>
      <tr><td>표 스타일</td><td>회색 헤더 + 일정 행 간격</td></tr>
      <tr><td>이모지 정책</td><td>📘 🟦 🟩 🟥 🧭 📍 🧠 🎙 🎯 🚀 🧩 🧪 (고정 순서)</td></tr>
      <tr><td>파일명</td><td><span class="mono">인생포트폴리오_{name}_{yyyy-mm-dd}.pdf</span></td></tr>
    </tbody>
  </table>
</section>

<!-- ───────────── PART III - 3 (v4 layers) ───────────── -->
<section class="page" data-foot="Part Ⅲ-3 · v4 품질 강화 레이어 9 항목">
  <div class="page-head"><span class="ph-tag">PART Ⅲ</span><span class="ph-domain">v4 강화 레이어</span><span class="ph-name">9 항목</span></div>
  <div class="section-title"><span class="num">Ⅲ-3</span><h2>v4 품질 강화 레이어 9 항목</h2></div>
  <p class="muted">v1.3 룰베이스 위에 적용되는 후처리 레이어입니다. 모든 항목이 적용되어야 1/80억 고유성과 추천 다양성이 보장됩니다.</p>
  <div class="v4-grid">${v4LayerCards()}</div>
  <div class="card mt8">
    <h3>핵심 데이터 모듈</h3>
    <table class="grid">
      <thead><tr><th>모듈</th><th>경로</th><th>역할</th></tr></thead>
      <tbody>
        <tr><td>매핑</td><td class="mono">data/mapping.json</td><td>4축/6섹션/Q-매핑/가치사전</td></tr>
        <tr><td>리포트 룰</td><td class="mono">data/report-rules.json</td><td>12단 구조/서식/v4 레이어/체크리스트</td></tr>
        <tr><td>프로그램 룰</td><td class="mono">data/program-rules.json</td><td>3주/3개월/1년 프로그램 합성 규칙</td></tr>
        <tr><td>문항</td><td class="mono">data/questions.json</td><td>76문항 정의 + 보기 옵션</td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- ───────────── PART IV - Manual Prompt (Report) ───────────── -->
<section class="page" data-foot="Part Ⅳ-1 · 수동 제작 마스터 프롬프트 (리포트)">
  <div class="page-head"><span class="ph-tag">PART Ⅳ</span><span class="ph-domain">수동 제작 프롬프트</span><span class="ph-name">리포트</span></div>
  <div class="section-title"><span class="num">Ⅳ-1</span><h2>수동 제작 마스터 프롬프트 — 리포트</h2></div>
  <div class="lead">
    아래 프롬프트의 <span class="mono">{...}</span> 자리에 고객 응답 데이터를 그대로 채워 ChatGPT/Claude에 입력하면, 본 매뉴얼과 동일한 표준의 리포트 JSON이 산출됩니다.
    AI가 응답 외 추측으로 슬롯을 채우지 못하도록 안전장치가 포함되어 있습니다.
  </div>
  <pre class="prompt"><span class="key">[역할]</span>
당신은 인생포트폴리오 리포트 제작 전문 작가입니다.
모든 출력은 "리포트 룰북 P v4.0 + 매핑 v2.1"을 위반하지 않습니다.

<span class="key">[고정 규칙]</span>
1) 12단 구조 고정: 📘 → 🟦 → 🟩 → 🟥 → 🧭 → 📍 → 🧠 → 🎙 → 🎯 → 🚀 → 🧩 → 🧪
2) 인위적인 톤·유형 분류 금지. 회원의 56문항 응답에서 7개 시그니처 슬롯
   (가치 앵커·내적 나침반·주도 동사·성향 결·1차 도메인·2차 도메인·활동 트리거)을
   직접 도출해 본문 합성에 사용합니다.
3) 폰트 계층: 제목 13pt / 인용 11pt / 본문 10pt — 마크다운 ** 금지, &lt;strong&gt; 만 사용
4) 사명/비전 형식 고정:
   "당신의 사명은 '(내용)' 입니다."
   "당신의 비전은 '(내용)' 입니다."
   마지막 줄: "🔍 활동 응답({trigger})과 자기성찰 성향을 기반으로 도출되었습니다."
5) 4축 카드(🧠🎙🎯🚀): 핵심 1줄 + 감성 '~' 인용 + 키워드 4개(가운뎃점 ·)
6) 강점은 페어 매트릭스 변환된 명사형 사용 (Q6 trait 단독 노출 금지)
7) 사명/비전 최소 길이: 한국어 60자 이상
8) 슬롯에 채울 단어/구문은 응답에 등장한 표현에서만 도출. 응답 외 분류 금지.

<span class="key">[안전 장치 — 위반 시 출력 거부]</span>
- 응답 데이터에 없는 사실/도메인/사람/숫자를 추측해 추가하지 않는다.
- "보통 ~한 사람은…" 같은 일반화 문장을 생성하지 않는다.
- 회원의 응답 키워드(Q6/Q13/Q39/Q41/Q47/Q49/Q63/Q73/Q75)를 본문에 5개 이상 그대로 노출한다.

<span class="key">[입력 — 고객 응답 데이터]</span>
이름: <span class="ph">{name}</span>
이메일: <span class="ph">{email}</span>
제출일: <span class="ph">{submittedAt}</span>
4축 점수(0~100): 자기이해 <span class="ph">{a1}</span> / 자기표현 <span class="ph">{a2}</span> / 자기설계 <span class="ph">{a3}</span> / 자기실행 <span class="ph">{a4}</span>
Q6 성향 3개: <span class="ph">{traits3}</span>
Q13 핵심가치 3개: <span class="ph">{values3}</span>
Q39 활동: <span class="ph">{activities}</span>
Q41 열정 주제: <span class="ph">{topics}</span>
Q47 몰입 환경: <span class="ph">{places}</span>
Q49 하루 리듬: <span class="ph">{rhythms}</span>
Q63 선택 기준: <span class="ph">{criteria}</span>
Q73 성취 조건: <span class="ph">{achievement}</span>
Q75 관심 분야 3개: <span class="ph">{domains3}</span>

<span class="key">[출력 — JSON 스키마 고정]</span>
{
  "signature": {
    "valueAnchor":     "...(Q13에서 도출)",
    "compassPhrase":   "...(Q63에서 도출)",
    "axisLeadVerb":    "...(4축 비율에서 도출)",
    "traitColor":      "...(Q6 명사형 결로 변환)",
    "primaryDomain":   "...(Q75[0])",
    "secondaryDomain": "...(Q75[1])",
    "compassRaw":      "...(Q39 + Q41 활동 트리거)"
  },
  "sections": [
    { "id":"summary",          "icon":"📘", "content": { "header":"...", "coreOneLine":"..." } },
    { "id":"mission_vision",   "icon":"🟦", "content": { "missionText":"...", "visionText":"...", "footer":"..." } },
    { "id":"execution_profile","icon":"🟩", "content": { ... } },
    { "id":"growth_map",       "icon":"🟥", "content": { "strengths":[...], "growth":[...] } },
    { "id":"career_education", "icon":"🧭", "content": { "careers":[...], "education":[...], "directions":[...] } },
    { "id":"application",      "icon":"📍", "content": { ... } },
    { "id":"self_understanding","icon":"🧠", "content": { "core":"...", "emotional":"'...'", "keywords":["·","·","·","·"], "tier":"deep|active|emerging|seed" } },
    { "id":"self_expression",  "icon":"🎙", "content": { ... } },
    { "id":"self_design",      "icon":"🎯", "content": { ... } },
    { "id":"self_execution",   "icon":"🚀", "content": { ... } },
    { "id":"summary_close",    "icon":"🧩", "content": { ... } },
    { "id":"report_meta",      "icon":"🧪", "content": { "fixedText":"이 리포트는 …" } }
  ]
}

<span class="key">[검수 — 출력 직후 자가 점검]</span>
- 응답 키워드 5개 이상 본문 노출 ✅
- 12단 구조 모두 채움 ✅
- 사명/비전 60자 이상 ✅
- 4축 카드 키워드 정확히 4개 ✅
- 마크다운 ** 미사용 ✅
- 일반화 문장 0개 ✅</pre>
</section>

<!-- ───────────── PART IV - Manual Prompt (Program) ───────────── -->
<section class="page" data-foot="Part Ⅳ-2 · 맞춤형 실행 프로그램 수동 제작 프롬프트">
  <div class="page-head"><span class="ph-tag">PART Ⅳ</span><span class="ph-domain">수동 프로그램 프롬프트</span><span class="ph-name">3주/3개월/1년</span></div>
  <div class="section-title"><span class="num">Ⅳ-2</span><h2>맞춤형 실행 프로그램 — 수동 제작 프롬프트</h2></div>
  <pre class="prompt"><span class="key">[역할]</span>
당신은 인생포트폴리오 실행 프로그램 설계자입니다.
앞서 산출된 리포트 JSON을 입력받아 3주/3개월/1년 단위의 실행 프로그램을 작성합니다.

<span class="key">[고정 규칙]</span>
1) 입력은 반드시 v4.1 리포트 JSON. 응답 데이터에 없는 사실 추측 금지.
2) 출력은 cover/quarter/weeks/modules/effects/newPaths/nextSteps/risks/closing 9개 섹션.
3) weeks 는 정확히 3개 (1주차/2주차/3주차) 각 actions 2~4개.
4) effects.fitJob / expansion / vision 각각 60자 이상.
5) newPaths 는 회원의 1·2차 도메인을 잇는 직무명 4개.
6) nextSteps 는 1개월/3개월/1년 시점의 task 3개.
7) closing 은 시그니처 슬롯의 가치 앵커를 반영한 마무리 1줄.

<span class="key">[입력 — 리포트 v4.1 JSON]</span>
<span class="ph">{report_json_paste}</span>

<span class="key">[출력 — JSON 스키마]</span>
{
  "cover":{ "title":"...", "subtitle":"..." },
  "quarter":{ "theme":"...", "focus":"..." },
  "weeks":[
    { "title":"1주차 — ...", "actions":["...","..."] },
    { "title":"2주차 — ...", "actions":["...","..."] },
    { "title":"3주차 — ...", "actions":["...","..."] }
  ],
  "modules":[ "...", "..." ],
  "effects":{ "fitJob":"...", "expansion":"...", "vision":"..." },
  "newPaths":[ "...", "...", "...", "..." ],
  "nextSteps":[
    { "when":"1개월", "task":"..." },
    { "when":"3개월", "task":"..." },
    { "when":"1년",   "task":"..." }
  ],
  "risks":[
    { "name":"...", "mitigation":"..." }
  ],
  "closing":"..."
}</pre>
</section>

<!-- ───────────── PART V-1 (산출 근거 17) ───────────── -->
<section class="page" data-foot="Part Ⅴ-1 · 산출 근거 평가 체크리스트 (17 항목)">
  <div class="page-head"><span class="ph-tag">PART Ⅴ</span><span class="ph-domain">평가 체크리스트</span><span class="ph-name">산출 근거 17</span></div>
  <div class="section-title"><span class="num">Ⅴ-1</span><h2>산출 근거 평가 체크리스트 (17 항목)</h2></div>
  <p class="muted">v4 자동 검증과 동일한 체크리스트입니다. 17항목 모두 ☑이어야 발행 가능합니다.</p>
  <table class="grid checklist">
    <thead><tr><th class="num">#</th><th>항목</th><th>판정 기준</th><th>QA ID</th><th>☑</th></tr></thead>
    <tbody>${checklistOrigin()}</tbody>
  </table>
</section>

<!-- ───────────── PART V-2 (디자인 12) ───────────── -->
<section class="page" data-foot="Part Ⅴ-2 · 디자인/템플릿 준수 체크리스트 (12 항목) + Ⅴ-3 QA SOP">
  <div class="page-head"><span class="ph-tag">PART Ⅴ</span><span class="ph-domain">디자인 체크리스트</span><span class="ph-name">12 항목 + QA SOP</span></div>
  <div class="section-title"><span class="num">Ⅴ-2</span><h2>디자인 / 템플릿 준수 체크리스트 (12 항목)</h2></div>
  <table class="grid checklist">
    <thead><tr><th class="num">#</th><th>항목</th><th>판정 기준</th><th>☑</th></tr></thead>
    <tbody>${checklistDesign()}</tbody>
  </table>
  <div class="section-title" style="margin-top:10px"><span class="num">Ⅴ-3</span><h2>QA 3-게이트 SOP</h2></div>
  <div class="card">
    <h3>게이트 1 — 자동 검증 (엔진 직출)</h3>
    <ul>
      <li>v4 ValidateReport 17개 항목 자동 통과 ✅</li>
      <li>fingerprint 생성 + 기존 발행본과 중복 없음 확인</li>
      <li>합격선: <strong>17/17 통과</strong></li>
    </ul>
  </div>
  <div class="card">
    <h3>게이트 2 — 사람 검수 (편집장)</h3>
    <ul>
      <li>Part Ⅴ-1 산출 근거 17 + Ⅴ-2 디자인 12 모두 ☑</li>
      <li>샘플 13개 영역의 시그니처·결 일관성 비교</li>
      <li>응답 외 사실/숫자 주입 여부 정밀 검토</li>
      <li>합격선: <strong>29/29 통과</strong></li>
    </ul>
  </div>
  <div class="card">
    <h3>게이트 3 — 발행 직전 최종 점검</h3>
    <ul>
      <li>PDF 파일명 규칙 일치: <span class="mono">인생포트폴리오_{name}_{yyyy-mm-dd}.pdf</span></li>
      <li>고지 문구 포함: 🧪 "이 리포트는 …" + 📌 자동 안내 문구</li>
      <li>회원 식별자(이메일·이름) 정확성 더블체크</li>
      <li>발행자 서명 기록 (발행자 페이지)</li>
    </ul>
  </div>
</section>

<!-- ───────────── PART VI - Index ───────────── -->
<section class="page" data-foot="Part Ⅵ · 13대 영역 샘플 — 인덱스">
  <div class="page-head"><span class="ph-tag">PART Ⅵ</span><span class="ph-domain">13대 영역 샘플</span><span class="ph-name">실측 산출본</span></div>
  <div class="section-title"><span class="num">Ⅵ</span><h2>13대 영역 샘플 — 실엔진 산출본 (인덱스)</h2></div>
  <div class="lead">
    아래 13개 샘플은 본 매뉴얼의 매핑 v2.1 + 룰북 P v4.0 + 룰북 Q v2.0 을 13명의 가상 응답자에게 적용해
    실엔진(<span class="mono">report-engine.js → report-engine-v4.js → program-engine.js</span>)으로 직접 산출한 결과입니다.
    13명 모두 응답이 다르므로 56문항 fingerprint·시그니처 슬롯·매핑·문장이 모두 다르게 결정됩니다.
  </div>
  <table class="grid">
    <thead><tr><th class="num">#</th><th>영역</th><th>이름</th><th>가치 앵커 (Q13)</th><th>1·2차 도메인 (Q75)</th><th class="mono">fingerprint</th></tr></thead>
    <tbody>
      ${samples.map((s,i) => {
        const sig = (s.summary && s.summary._signatureVars) || {};
        return `<tr>
          <td class="num">${i+1}</td>
          <td><strong>${esc(s.domain)}</strong></td>
          <td>${esc(s.name)}</td>
          <td>${esc(sig.valueAnchor || "—")}</td>
          <td>${esc(sig.primaryDomain || s.domain)} · ${esc(sig.secondaryDomain || "—")}</td>
          <td class="mono">${esc(s.fp)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
  <p class="muted mt8">※ 다음 페이지부터 영역별 1페이지씩 (총 13페이지) 상세 샘플 카드가 배치됩니다.</p>
</section>

${sampleCards()}

<!-- ───────────── PART VII Governance 1 ───────────── -->
<section class="page" data-foot="Part Ⅶ-1 · 역할과 권한 (RACI) + 제출/검수/배포 SOP">
  <div class="page-head"><span class="ph-tag">PART Ⅶ</span><span class="ph-domain">운영 거버넌스</span><span class="ph-name">RACI / SOP</span></div>
  <div class="section-title"><span class="num">Ⅶ-1</span><h2>역할과 권한 (RACI)</h2></div>
  <table class="grid">
    <thead><tr><th>단계</th><th>제작자</th><th>검수자</th><th>편집장</th><th>발행자</th></tr></thead>
    <tbody>
      <tr><td>응답 수령·정합성 확인</td><td>R</td><td>C</td><td>I</td><td>I</td></tr>
      <tr><td>매핑·시그니처 도출</td><td>R</td><td>A</td><td>I</td><td>I</td></tr>
      <tr><td>리포트 본문 합성</td><td>R</td><td>A</td><td>C</td><td>I</td></tr>
      <tr><td>실행 프로그램 합성</td><td>R</td><td>A</td><td>C</td><td>I</td></tr>
      <tr><td>QA 게이트 1·2·3</td><td>C</td><td>R</td><td>A</td><td>I</td></tr>
      <tr><td>발행·전달·기록</td><td>I</td><td>C</td><td>R</td><td>A</td></tr>
    </tbody>
  </table>
  <p class="muted">R=Responsible / A=Accountable / C=Consulted / I=Informed</p>
  <div class="section-title" style="margin-top:10px"><span class="num">Ⅶ-2</span><h2>제출 → 검수 → 배포 SOP</h2></div>
  <div class="card">
    <ol>
      <li><strong>제출:</strong> 제작자는 산출 직후 v4 자동 검증(17/17) 통과를 확인하고 검수 큐에 등록한다.</li>
      <li><strong>검수:</strong> 검수자는 Ⅴ-1 17항 + Ⅴ-2 12항 (총 29) 합격 여부를 확인한다.</li>
      <li><strong>편집장 승인:</strong> 13개 샘플과 결의 일관성을 확인하고 편집장이 승인한다.</li>
      <li><strong>발행:</strong> 발행자는 파일명 규칙 + 고지 문구 + 식별자 정확성을 최종 확인 후 PDF를 고객에게 전달한다.</li>
      <li><strong>기록:</strong> 발행 즉시 발행 로그(이름, 이메일, 발행일, fingerprint, 검수자, 편집장, 발행자)를 남긴다.</li>
    </ol>
  </div>
</section>

<!-- ───────────── PART VII Governance 2 ───────────── -->
<section class="page" data-foot="Part Ⅶ-3 · 사고 대응 (Recall) + 데이터 보호 정책">
  <div class="page-head"><span class="ph-tag">PART Ⅶ</span><span class="ph-domain">사고 대응 / 데이터 보호</span><span class="ph-name">Recall · NDA</span></div>
  <div class="section-title"><span class="num">Ⅶ-3</span><h2>사고 대응 (Recall) 절차</h2></div>
  <div class="card">
    <ol>
      <li><strong>탐지:</strong> 회원 클레임/내부 발견으로 산출 결함이 확인되면 즉시 발행 중단.</li>
      <li><strong>봉인:</strong> 해당 fingerprint에 해당하는 모든 발행본을 회수 대상으로 표시.</li>
      <li><strong>분석:</strong> 매핑/시그니처/엔진 로그를 점검해 결함 단계(L1~L3)를 결정.</li>
      <li><strong>재발행:</strong> 동일 응답 데이터를 동일 엔진 버전으로 재구동, 17/17 + 29/29 재통과 확인.</li>
      <li><strong>고지:</strong> 회원에게 회수·재발행 사실을 사과 메시지와 함께 통지.</li>
      <li><strong>사후관리:</strong> 룰북/엔진 패치 버전을 발행하고 개정 이력에 반영.</li>
    </ol>
  </div>
  <div class="section-title" style="margin-top:10px"><span class="num">Ⅶ-4</span><h2>데이터 보호 정책</h2></div>
  <div class="card">
    <ul>
      <li><strong>개인정보 최소수집:</strong> 이름·이메일·응답값 외 어떤 식별자도 수집/저장하지 않습니다.</li>
      <li><strong>저장 분리:</strong> 응답 원본과 산출물은 분리 저장하며, 산출물 PDF는 회원만 접근 가능한 채널로 전달.</li>
      <li><strong>외부 송신 금지:</strong> 산출물·응답을 본 매뉴얼이 정의한 발행 채널 외 어떤 외부 시스템에도 송신하지 않습니다.</li>
      <li><strong>로그 보존:</strong> 발행 로그는 6개월간 보존 후 자동 폐기.</li>
      <li><strong>NDA:</strong> 본 매뉴얼·룰북은 내부 전용. 외부 배포 금지.</li>
    </ul>
  </div>
</section>

<!-- ───────────── 부록 A. 용어집 ───────────── -->
<section class="page" data-foot="부록 A · 용어집 (Glossary)">
  <div class="page-head"><span class="ph-tag">부록 A</span><span class="ph-domain">용어집</span><span class="ph-name">Glossary</span></div>
  <div class="section-title"><span class="num">A</span><h2>용어집 (Glossary)</h2></div>
  <table class="grid">
    <thead><tr><th>용어</th><th>설명</th></tr></thead>
    <tbody>
      <tr><td><strong>4축</strong></td><td>자기이해 🧠 / 자기표현 🎙 / 자기설계 🎯 / 자기실행 🚀 — 모든 매핑의 기본 분석 축.</td></tr>
      <tr><td><strong>6 리포트 섹션</strong></td><td>summary 📘 / mission_vision 🟦 / execution_profile 🟩 / growth_map 🟥 / career_education 🧭 / application 📍.</td></tr>
      <tr><td><strong>12단 구조</strong></td><td>리포트의 고정 섹션 배열. 순서·이모지·제목 변경 금지.</td></tr>
      <tr><td><strong>시그니처 슬롯</strong></td><td>응답에서 도출된 7개 합성 슬롯. 톤 5종 분류를 대체하는 개별성의 기본 단위.</td></tr>
      <tr><td><strong>fingerprint</strong></td><td>56문항 응답을 djb2 해시한 10자리 정수. 1비트만 달라도 값이 변함.</td></tr>
      <tr><td><strong>강점 페어 매트릭스</strong></td><td>12 trait → 66 페어 × 4 변형 = 228 합성문 (P0-1).</td></tr>
      <tr><td><strong>도메인 21×21</strong></td><td>1·2차 도메인 결합으로 만들어지는 441 경로 × 5 템플릿 = 2,205 변형 (P1-2).</td></tr>
      <tr><td><strong>다양성 가드</strong></td><td>최근 발행본과 핵심 슬롯 중복을 감지해 변형을 강제하는 후처리 (P1-3).</td></tr>
      <tr><td><strong>3주/3개월/1년 프로그램</strong></td><td>리포트 시그니처를 기반으로 합성되는 실행 안내서 (룰북 Q v2.0).</td></tr>
      <tr><td><strong>QA 3 게이트</strong></td><td>자동 검증(17) → 사람 검수(29) → 발행 직전 최종 점검의 3단 게이트.</td></tr>
    </tbody>
  </table>
</section>

<!-- ───────────── 부록 B. 변경 / 버전 관리 ───────────── -->
<section class="page" data-foot="부록 B · 변경 관리 / 버전 관리">
  <div class="page-head"><span class="ph-tag">부록 B</span><span class="ph-domain">변경 관리</span><span class="ph-name">Version Control</span></div>
  <div class="section-title"><span class="num">B</span><h2>변경 관리 / 버전 관리</h2></div>
  <table class="grid">
    <thead><tr><th>코드</th><th>모듈</th><th>현재 버전</th><th>호환 엔진</th><th>릴리즈 정책</th></tr></thead>
    <tbody>
      <tr><td>F</td><td>설문지 (questions.json)</td><td>v2.1</td><td>engine v1.3+</td><td>문항 변경 시 메이저 버전 상승 + 매핑 재검증 필수</td></tr>
      <tr><td>M</td><td>매핑 (mapping.json)</td><td>v2.1</td><td>engine v1.3+</td><td>questionMapping 변경 시 자동 검증 17 재실행</td></tr>
      <tr><td>P</td><td>리포트 룰북 (report-rules.json)</td><td>v4.0</td><td>engine v1.3 + v4.1</td><td>구조·이모지 변경은 메이저, 문장 템플릿은 마이너</td></tr>
      <tr><td>Q</td><td>프로그램 룰북 (program-rules.json)</td><td>v2.0</td><td>program-engine v1.0+</td><td>리포트 v4 시그니처와 호환 보장</td></tr>
      <tr><td>본 매뉴얼</td><td>build_manual_html.js</td><td>${esc(VERSION)}</td><td>모든 룰북</td><td>룰북 메이저 변경 시 매뉴얼도 메이저 상승</td></tr>
    </tbody>
  </table>
  <div class="card mt8">
    <h3>변경 절차 (Change Procedure)</h3>
    <ol>
      <li><strong>제안:</strong> 변경 제안서(목적/영향 범위/리스크) 작성.</li>
      <li><strong>검토:</strong> 편집장 + 엔지니어 + 검수자 합동 검토.</li>
      <li><strong>적용:</strong> Dev 환경에서 13개 샘플 회귀 테스트 통과.</li>
      <li><strong>발행:</strong> 룰북 + 매뉴얼 동시 버전업, 개정 이력 기록.</li>
      <li><strong>모니터:</strong> 발행 후 7일간 사고 발생 여부 모니터링.</li>
    </ol>
  </div>
</section>

<!-- ───────────── 발행자 서명란 ───────────── -->
<section class="page" data-foot="발행자 서명란 (Sign-off)">
  <div class="page-head"><span class="ph-tag">SIGN-OFF</span><span class="ph-domain">발행자 서명란</span><span class="ph-name">${esc(VERSION)} / ${esc(PUB_DATE)}</span></div>
  <div class="section-title"><span class="num">END</span><h2>발행자 서명란 (Sign-off)</h2></div>
  <div class="lead">
    본 매뉴얼은 아래 책임자의 서명으로 발효되며, 모든 제작 인력(AI/사람)에게 동일하게 적용됩니다.
    본 매뉴얼의 단일 표준을 따라 산출된 모든 결과물은 동일한 품질을 보장합니다.
  </div>
  <div class="card">
    <h3>적용 범위</h3>
    <ul>
      <li>인생포트폴리오 리포트 (12단 구조 PDF) — 한국어/English</li>
      <li>맞춤형 실행 프로그램 (3주 / 3개월 / 1년) — 한국어/English</li>
      <li>13대 영역 (정치·경제·교육·예술·기술·복지·종교·스포츠·미디어·법률·환경·농업·의료) 전체</li>
      <li>본 매뉴얼이 정의한 모든 매핑/룰북/체크리스트</li>
    </ul>
  </div>
  <div class="sig-row">
    <div class="sig-box"><strong>품질 책임자 (Editor-in-Chief)</strong>서명 / 일자</div>
    <div class="sig-box"><strong>발행 책임자 (Publisher)</strong>서명 / 일자</div>
  </div>
  <div class="sig-row" style="margin-top:14mm">
    <div class="sig-box"><strong>제작팀 리드 (Production Lead)</strong>서명 / 일자</div>
    <div class="sig-box"><strong>운영 책임자 (Operations Lead)</strong>서명 / 일자</div>
  </div>
</section>

</body>
</html>`;

// ─── PPT 슬라이드 후처리 적용 ───
const finalHtml = wrapPages(rawHtml);

fs.writeFileSync(OUT_HTML, finalHtml, "utf8");
const sz = (fs.statSync(OUT_HTML).size / 1024).toFixed(1);
console.log("✓ HTML written:", OUT_HTML, "(" + sz + " KB)");
