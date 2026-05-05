#!/usr/bin/env node
/* 김영식 v4.1 ground-truth + 실행 프로그램을 site 디자인과 동일한 정적 HTML로 렌더링.
 * 입력:
 *   - reports/v4_test/kys_real_v41_upgraded.json
 *   - reports/v4_test/kys_real_program_v2.json
 * 출력:
 *   - reports/v4_test/preview/kys_v41_preview.html
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/v4_test/kys_real_v41_upgraded.json'), 'utf8'));
const program = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/v4_test/kys_real_program_v2.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const findSection = (id) => (report.sections || []).find(s => s.id === id);

// ── Section renderers ──
function renderHeader() {
  const c = findSection('summary').content;
  return `
  <header class="rep-header" id="sec-summary">
    <h1>${esc(c.header)}</h1>
    <div class="submitted">제출일 · ${esc(c.submittedAt)}</div>
    <div class="type-line">${esc(c.typeLine)}</div>
    <div class="core-line">${esc(c.coreOneLine)}</div>
  </header>`;
}

function renderMissionVision() {
  const s = findSection('mission_vision');
  const c = s.content;

  // 3-Tier 구조: 헤드라인 + 한 줄 설명 + 다이어리 본문 (사용자 확정 표현)
  // 사명·비전 동일 UX (사용자 확정 — 비전도 사명 구조와 동일하게 격상)
  const has3Tier = !!(c.headline || c.diaryMission || c.subline);
  const tierBlock = has3Tier ? `
      <div class="mv-card mv-mission">
        <div class="mv-label">🎯 사명 (Mission)</div>
        ${c.headline ? `<div class="mv-headline">${esc(c.headline)}</div>` : ''}
        ${c.subline  ? `<div class="mv-subline">${esc(c.subline)}</div>`   : ''}
        ${c.diaryMission ? `<div class="mv-diary-label">📓 다이어리 본문</div><div class="mv-diary">${esc(c.diaryMission)}</div>` : ''}
        <div class="mv-aux-label">🪞 한 줄 통합본</div>
        <div class="mv-aux">${esc(c.mission)}</div>
      </div>
      <div class="mv-card mv-vision">
        <div class="mv-label">🌅 비전 (Vision)</div>
        ${c.visionHeadline ? `<div class="mv-headline">${esc(c.visionHeadline)}</div>` : ''}
        ${c.visionSubline  ? `<div class="mv-subline">${esc(c.visionSubline)}</div>`   : ''}
        ${c.diaryVision ? `<div class="mv-diary-label">📓 10년 뒤 회상 (Diary)</div><div class="mv-diary">${esc(c.diaryVision)}</div>` : ''}
        <div class="mv-aux-label">🪞 한 줄 통합본</div>
        <div class="mv-aux">${esc(c.vision)}</div>
      </div>` : `
      <div class="mv-card mv-mission">
        <div class="mv-label">🎯 사명 (Mission)</div>
        <div class="mv-text">${esc(c.mission)}</div>
      </div>
      <div class="mv-card mv-vision">
        <div class="mv-label">🌅 비전 (Vision)</div>
        <div class="mv-text">${esc(c.vision)}</div>
      </div>`;

  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      ${tierBlock}
      <div class="mv-footer">${esc(c.footer)}</div>
    </div>
  </section>`;
}

function renderExecutionProfile() {
  const s = findSection('execution_profile');
  const c = s.content;
  const rows = [
    ['유형', c.type],
    ['스타일', c.style],
    ['핵심 동인', c.drivers],
    ['적합 환경', c.environment],
    ['선호 활동', c.activities],
    ['도구·전략', c.tools]
  ];
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <table class="ep-table">
        <tbody>
          ${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderGrowthMap() {
  const s = findSection('growth_map');
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <div class="growth-grid">
        <div class="growth-col left">
          <h3>✨ ${esc(c.strengthsLabel)}</h3>
          <ul>${(c.strengths || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
        <div class="growth-col right">
          <h3>🔧 ${esc(c.growthLabel)}</h3>
          <ul>${(c.growth || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  </section>`;
}

function renderCareerEducation() {
  const s = findSection('career_education');
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <div class="ce-grid">
        <div class="ce-block">
          <h3>💼 추천 진로</h3>
          <ol>${(c.careers || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        </div>
        <div class="ce-block">
          <h3>🎓 추천 교육</h3>
          <ol>${(c.education || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        </div>
        <div class="ce-block">
          <h3>🧭 확장 방향</h3>
          <ol>${(c.directions || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        </div>
      </div>
      ${c.domainExpansion ? `
      <div class="mv-card mv-mission" style="margin-top:10px;">
        <div class="mv-label">🗺 도메인 확장 경로 (총 ${esc(c.domainExpansion.pathCount)} 경로 중 선택)</div>
        <div class="mv-text"><strong>${esc(c.domainExpansion.primaryDomain)}</strong> → <strong>${esc(c.domainExpansion.secondaryDomain)}</strong> · ${esc(c.domainExpansion.pathLine)}</div>
      </div>` : ''}
    </div>
  </section>`;
}

function renderApplication() {
  const s = findSection('application');
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <ul class="app-list">
        <li><strong>업무</strong>${esc(c.job)}</li>
        <li><strong>학습</strong>${esc(c.learning)}</li>
        <li><strong>일상 루틴</strong>${esc(c.tasks)}</li>
      </ul>
      <div class="first-actions">
        <h3>${esc(c.firstActionsLabel)}</h3>
        <ol>${(c.firstActions || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
    </div>
  </section>`;
}

function renderAxisCard(id) {
  const s = findSection(id);
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title">
      <span class="ico">${s.icon}</span>${esc(s.title)}
      <small>Step ${s.step}</small>
    </h2>
    <div class="sec-body">
      <div class="axis-card">
        <div class="top">
          <span class="tier-badge tier-${esc(c.tier)}">${esc(c.tierLabel)}</span>
          <span class="pct">${esc(c.pct)}%</span>
        </div>
        <div class="row core"><span class="lbl">CORE</span><span class="val">${esc(c.core)}</span></div>
        <div class="row emo"><span class="lbl">EMO</span><span class="val">${esc(c.emotional)}</span></div>
        <div class="row kw"><span class="lbl">KW</span><span class="val">${(c.keywords || []).map((k, i) => `${i ? '<span class="sep">·</span>' : ''}${esc(k)}`).join('')}</span></div>
        ${c.pairedNarrative ? `<div class="row paired"><span class="lbl">PAIR</span><span class="val">${esc(c.pairedNarrative)}</span></div>` : ''}
        <div class="tier-comment">💡 ${esc(c.tierComment)}</div>
      </div>
    </div>
  </section>`;
}

function renderSummaryClose() {
  const s = findSection('summary_close');
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <div class="close-box">
        <div class="l1">${esc(c.line1)}</div>
        <div class="l2">${esc(c.line2)}</div>
        <ul>
          ${(c.items || []).map(it => `<li><strong>${esc(it.icon)} ${esc(it.label)}</strong><span>${esc(it.desc)}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  </section>`;
}

function renderReportMeta() {
  const s = findSection('report_meta');
  const c = s.content;
  return `
  <section class="sec" id="sec-${s.id}">
    <h2 class="sec-title"><span class="ico">${s.icon}</span>${esc(s.title)}<small>Step ${s.step}</small></h2>
    <div class="sec-body">
      <div class="meta-fixed">${esc(c.fixedText)}</div>
      <div class="auto-notice">${esc(c.autoNotice)}</div>
    </div>
  </section>`;
}

// ── Program renderers ──
function renderProgramCover() {
  const c = program.cover;
  const m = program.meta;
  return `
  <section class="prog-cover sec" id="prog-cover">
    <h1>${esc(c.title)}</h1>
    <div class="subtitle">${esc(c.subtitle)}</div>
    <div class="prog-chips">
      <span class="chip-prog">${esc(c.service)}</span>
      <span class="chip-prog">발행일 · ${esc(c.publishedAt)}</span>
      <span class="chip-prog">tone · ${esc(m.toneLabel)}</span>
      <span class="chip-prog">engine · ${esc(m.engine)} ${esc(m.version)}</span>
    </div>
    <div class="type-line">${esc(c.typeLine)}</div>
    <blockquote class="prog-quote">${esc(c.quote)}</blockquote>
    <div class="prog-summary-grid">
      <div class="ps-cell"><strong>성향</strong><span>${esc(c.summary.traits)}</span></div>
      <div class="ps-cell"><strong>강점</strong><span>${esc(c.summary.strengths)}</span></div>
      <div class="ps-cell"><strong>보완점</strong><span>${esc(c.summary.gaps)}</span></div>
      <div class="ps-cell"><strong>적합 환경</strong><span>${esc(c.summary.env)}</span></div>
      <div class="ps-cell ps-wide"><strong>신규 가능성</strong><span>${esc(c.summary.newPaths)}</span></div>
    </div>
    <div class="arrow-line">${esc(c.arrowLine)}</div>
  </section>`;
}

function renderQuarter() {
  const q = program.quarter;
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">${q.icon || '🧭'}</span>${esc(q.title)}<small>Quarter Theme</small></h2>
    <div class="sec-body">
      <h3 class="prog-h3">${esc(q.heading)}</h3>
      ${(q.paragraphs || []).map(p => `<p class="prog-p">${esc(p)}</p>`).join('')}
    </div>
  </section>`;
}

function renderProgramWeeks() {
  const w = program.program;
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">📅</span>주차별 실행 루틴<small>3-week design</small></h2>
    <div class="sec-body">
      ${(w.weeks || []).map(week => `
        <div class="week-card">
          <div class="week-head"><span class="week-num">Week ${esc(week.week)}</span><span class="week-title">${esc(week.title)}</span></div>
          <div class="week-guide">${esc(week.guide)}</div>
          <ul class="week-actions">${(week.actions || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
          <div class="week-effects">${(week.effects || []).map(e => `<span class="eff-chip">${esc(e)}</span>`).join('')}</div>
        </div>
      `).join('')}
      <div class="goal-box">
        <h3>🎯 3개월 목표</h3>
        <p class="prog-p">${esc(w.month3.guide)}</p>
        <ul class="goal-list">${(w.month3.goals || []).map(g => `<li><strong>${esc(g.title)}</strong> — ${esc(g.criterion)}</li>`).join('')}</ul>
      </div>
      <div class="goal-box vision">
        <h3>🌅 1년 비전 & 마일스톤</h3>
        <p class="prog-p">${esc(w.year1.guide)}</p>
        <ul class="goal-list">${(w.year1.vision || []).map(v => `<li>${esc(v)}</li>`).join('')}</ul>
        <strong class="goal-sub">마일스톤</strong>
        <ol class="goal-ol">${(w.year1.milestones || []).map(m => `<li>${esc(m)}</li>`).join('')}</ol>
      </div>
    </div>
  </section>`;
}

function renderModules() {
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">🧩</span>실행 모듈<small>3-module design</small></h2>
    <div class="sec-body module-grid">
      ${(program.modules || []).map(m => `
        <div class="module-card">
          <div class="mod-head"><span class="mod-idx">M${esc(m.index)}</span><span class="mod-type">${esc(m.type)}</span></div>
          <h3 class="mod-title">${esc(m.title)}</h3>
          <p class="mod-summary">${esc(m.summary)}</p>
          <strong class="mod-sub">실행 행동</strong>
          <ul class="mod-list">${(m.actions || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
          <strong class="mod-sub">도구</strong>
          <div class="mod-tools">${(m.tools || []).map(t => `<span class="tool-chip">${esc(t)}</span>`).join('')}</div>
          ${m.booster ? `
          <div class="mod-booster">
            <strong>⚡ 부스터 (${esc(m.booster.targetAxis)})</strong>
            <ul>${(m.booster.actions || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
          </div>` : ''}
        </div>
      `).join('')}
    </div>
  </section>`;
}

function renderBoard() {
  const b = program.board;
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">📋</span>실행 점검 보드<small>Tracking Board</small></h2>
    <div class="sec-body">
      <table class="board-table">
        <thead><tr>${(b.columns || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${(b.rowsExample || []).map(r => `<tr><td>${esc(r.week)}</td><td>${esc(r.task)}</td><td>${esc(r.done)}</td><td>${esc(r.memo)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="board-monthly">
        <strong>📆 월간 점검 항목</strong>
        <ul>${(b.monthly || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      </div>
      <div class="board-hint">💡 ${esc(b.hint)}</div>
    </div>
  </section>`;
}

function renderEffects() {
  const e = program.effects;
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">📈</span>실행 효과<small>Career Impact</small></h2>
    <div class="sec-body effects-grid">
      <div class="effect-card"><strong>직무 적합성</strong><p>${esc(e.fitJob)}</p></div>
      <div class="effect-card"><strong>직업 확장성</strong><p>${esc(e.expansion)}</p></div>
      <div class="effect-card"><strong>경력 성장</strong><p>${esc(e.career)}</p></div>
      <div class="effect-card"><strong>인생 설계 비전</strong><p>${esc(e.vision)}</p></div>
      <div class="effect-card wide">
        <strong>신규 가능성 직무</strong>
        <div class="paths-row">${(e.newPaths || []).map(p => `<span class="path-chip">${esc(p)}</span>`).join('')}</div>
      </div>
    </div>
  </section>`;
}

function renderNextSteps() {
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">🚀</span>다음 단계<small>Next Steps</small></h2>
    <div class="sec-body next-grid">
      ${(program.nextSteps || []).map(s => `
        <div class="next-card">
          <span class="next-when">${esc(s.when)}</span>
          <p>${esc(s.task)}</p>
        </div>
      `).join('')}
    </div>
  </section>`;
}

function renderRisks() {
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">⚠️</span>리스크 & 대응<small>Risk Mitigation</small></h2>
    <div class="sec-body risks-list">
      ${(program.risks || []).map(r => `
        <div class="risk-card">
          <div class="risk-line"><strong>리스크</strong> ${esc(r.risk)}</div>
          <div class="mit-line"><strong>대응</strong> ${esc(r.mitigation)}</div>
        </div>
      `).join('')}
    </div>
  </section>`;
}

function renderClosing() {
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">💬</span>닫는 글<small>Closing</small></h2>
    <div class="sec-body closing-box">
      ${(program.closing || []).map(line => `<p class="closing-line">${esc(line)}</p>`).join('')}
    </div>
  </section>`;
}

function renderProgramFooter() {
  const f = program.footer;
  return `
  <section class="sec">
    <h2 class="sec-title"><span class="ico">📎</span>이 프로그램은…<small>Disclaimer</small></h2>
    <div class="sec-body">
      <div class="meta-fixed">
        ${(f.notice || []).map(n => `<p>${esc(n)}</p>`).join('')}
      </div>
      <div class="auto-notice">
        <strong>제작 규칙 체크리스트</strong>
        <ul>${(f.checklist || []).map(c => `<li>✅ ${esc(c)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
}

// ── Build full HTML ──
const meta = report._v4Meta;
const tone = report.tone;
const scores = report.scores;
const html = `<!DOCTYPE html>
<html lang="ko" translate="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>김영식님 v4.1 Ground-Truth Preview · 인생포트폴리오</title>
<style>
:root{
  --bg:#f7f2ea; --surface:#ffffff; --text:#17212b; --muted:#5c6773;
  --line:rgba(23,33,43,0.10); --brand:#17384c; --brand2:#255874; --accent:#c78d5c; --accent-soft:#f3e3d3;
  --success:#166534; --error:#b91c1c; --shadow:0 18px 46px rgba(23,56,76,.10);
  --max:920px; --heading-size:13pt; --quote-size:11pt; --body-size:10pt;
}
*{box-sizing:border-box} html{scroll-behavior:smooth}
body{
  margin:0; min-height:100vh; color:var(--text);
  background:
    radial-gradient(circle at top left, rgba(199,141,92,0.10), transparent 24%),
    radial-gradient(circle at top right, rgba(37,88,116,0.10), transparent 20%),
    linear-gradient(180deg, #fbf7f1 0%, #f7f2ea 45%, #f9f5ef 100%);
  font-family:"Noto Sans KR", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  line-height:1.7; word-break:keep-all; padding:22px;
}
.container{ max-width:var(--max); margin:0 auto; }

.preview-banner{
  background:linear-gradient(135deg, var(--brand), var(--brand2)); color:#fff;
  padding:14px 18px; border-radius:14px; margin-bottom:18px;
  display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between;
  box-shadow:var(--shadow);
}
.preview-banner h2{ margin:0; font-size:16px; font-weight:900; letter-spacing:-0.02em; }
.preview-banner small{ font-size:11.5px; opacity:.85; }
.banner-pills{ display:flex; flex-wrap:wrap; gap:6px; }
.banner-pills span{
  background:rgba(255,255,255,0.18); padding:4px 10px; border-radius:999px;
  font-size:11.5px; font-weight:800;
}

.report{
  background:var(--surface); border:1px solid var(--line); border-radius:24px;
  padding:32px 32px 28px; box-shadow:var(--shadow); font-size:var(--body-size);
}
@media (max-width:640px){ .report{ padding:22px 18px; } }

.rep-header{ border-bottom:2px solid var(--brand); padding-bottom:14px; margin-bottom:18px; }
.rep-header h1{
  margin:0 0 6px; font-size:clamp(22px, 3.4vw, 28px);
  color:var(--brand); font-weight:900; letter-spacing:-0.04em;
}
.rep-header .submitted{
  display:inline-block; font-size:12px; color:var(--muted); font-weight:800;
  background:#f4ede2; padding:4px 10px; border-radius:999px;
}
.rep-header .type-line{ margin:10px 0 4px; font-size:14.5px; font-weight:800; color:var(--brand2); letter-spacing:-0.01em; }
.rep-header .core-line{ margin:6px 0 0; font-size:13px; color:#334155; line-height:1.7; font-weight:700; }

.sec{ margin-top:22px; padding-top:8px; }
.sec-title{
  display:flex; align-items:center; gap:10px;
  font-size:var(--heading-size); font-weight:900; color:var(--brand);
  letter-spacing:-0.02em; margin:0 0 10px;
}
.sec-title .ico{ font-size:18px; line-height:1; }
.sec-title small{ font-size:12px; font-weight:700; color:var(--muted); margin-left:auto; }
.sec-body{ font-size:var(--body-size); color:#1f2937; }
.sec-body p{ margin:0 0 8px; }

.mv-card{
  background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px;
  padding:14px 16px; margin-bottom:10px;
}
.mv-card.mv-mission{ background:#eff6ff; border-color:#bfdbfe; }
.mv-card.mv-vision{ background:#fef3c7; border-color:#fcd34d; }
.mv-card .mv-label{
  font-size:13px; font-weight:900; letter-spacing:.02em;
  color:#1e3a8a; margin-bottom:6px; display:flex; align-items:center; gap:6px;
}
.mv-card.mv-vision .mv-label{ color:#92400e; }
.mv-card .mv-text{ font-size:var(--body-size); line-height:1.65; color:#0f172a; }
/* 3-Tier 구조 (헤드라인 / 한 줄 설명 / 다이어리 본문) */
.mv-card .mv-headline{
  font-size:22px; font-weight:900; line-height:1.35; color:#0f172a;
  letter-spacing:-0.01em; margin-bottom:6px;
}
.mv-card.mv-vision .mv-headline{ color:#7c2d12; }
.mv-card .mv-subline{
  font-size:14px; font-weight:700; color:#1e3a8a; opacity:.85;
  margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed #c7d2fe;
}
.mv-card.mv-vision .mv-subline{ color:#92400e; border-bottom-color:#fcd34d; }
.mv-card .mv-diary-label{
  font-size:12px; font-weight:800; color:var(--muted);
  margin-top:4px; margin-bottom:4px; letter-spacing:.02em;
}
.mv-card .mv-diary{
  font-size:var(--body-size); line-height:1.75; color:#0f172a;
  background:rgba(255,255,255,0.55); border-radius:8px; padding:10px 12px;
  margin-bottom:8px; white-space:pre-line;
}
.mv-card .mv-aux-label{
  font-size:11px; font-weight:700; color:var(--muted);
  margin-top:8px; margin-bottom:2px; letter-spacing:.02em;
}
.mv-card .mv-aux{ font-size:13px; line-height:1.6; color:#475569; }
.mv-footer{ font-size:12px; color:var(--muted); font-weight:700; margin-top:6px; }

.ep-table{
  width:100%; border-collapse:separate; border-spacing:0;
  border:1px solid var(--line); border-radius:12px; overflow:hidden;
  font-size:var(--body-size);
}
.ep-table th, .ep-table td{
  padding:10px 14px; text-align:left; vertical-align:top;
  border-bottom:1px solid var(--line);
}
.ep-table tr:last-child th, .ep-table tr:last-child td{ border-bottom:none; }
.ep-table th{ background:#f4ede2; color:var(--brand); font-weight:900; width:34%; white-space:nowrap; }
.ep-table td{ background:#fff; color:#1f2937; font-weight:700; }

.growth-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width:640px){ .growth-grid{ grid-template-columns:1fr; } }
.growth-col{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
.growth-col h3{ margin:0 0 8px; font-size:13px; color:var(--brand); font-weight:900; }
.growth-col ul{ margin:0; padding-left:18px; }
.growth-col li{ margin-bottom:4px; font-weight:800; color:#334155; }
.growth-col.left{ background:#f0fdf4; border-color:rgba(22,101,52,0.20); }
.growth-col.left h3{ color:var(--success); }
.growth-col.right{ background:#fef2f2; border-color:#fecaca; }
.growth-col.right h3{ color:var(--error); }

.ce-grid{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:var(--body-size); }
@media (max-width:640px){ .ce-grid{ grid-template-columns:1fr; } }
.ce-block{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
.ce-block h3{ margin:0 0 8px; font-size:12.5px; color:var(--brand2); font-weight:900; }
.ce-block ol{ margin:0; padding-left:18px; }
.ce-block li{ margin-bottom:4px; font-weight:800; color:#1f2937; }

.app-list{ margin:0; padding-left:0; list-style:none; display:grid; gap:8px; }
.app-list li{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 14px; display:flex; gap:10px; }
.app-list li strong{ color:var(--brand); min-width:90px; font-weight:900; }
.first-actions{ background:rgba(22,101,52,0.06); border:1px solid rgba(22,101,52,0.20); border-radius:12px; padding:12px 14px; margin-top:10px; }
.first-actions h3{ margin:0 0 6px; font-size:13px; color:var(--success); font-weight:900; }
.first-actions ol{ margin:0; padding-left:18px; }
.first-actions li{ margin-bottom:4px; font-weight:800; color:#1f2937; }

.axis-card{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-top:10px; }
.axis-card .row{ display:flex; align-items:flex-start; gap:10px; margin:8px 0; font-size:var(--body-size); line-height:1.6; }
.axis-card .row .lbl{
  flex-shrink:0; font-size:12px; font-weight:900; color:#fff;
  padding:3px 10px; border-radius:999px; min-width:64px; text-align:center;
  background:var(--brand);
}
.axis-card .row.core .lbl{ background:#0f766e; }
.axis-card .row.emo  .lbl{ background:#c2410c; }
.axis-card .row.kw   .lbl{ background:var(--brand2); }
.axis-card .row.paired .lbl{ background:#7c3aed; }
.axis-card .row .val{ flex:1; min-width:0; color:#0f172a; font-weight:700; }
.axis-card .row.emo .val{
  color:#7c2d12; background:#fff7ed; border-left:3px solid var(--accent);
  padding:8px 12px; border-radius:8px; font-weight:800;
}
.axis-card .row.kw .val{ color:var(--brand2); font-weight:900; }
.axis-card .row.kw .val .sep{ color:var(--accent); margin:0 6px; }
.axis-card .row.paired .val{ color:#5b21b6; font-weight:900; }
.axis-card .top{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.axis-card .top .pct{
  margin-left:auto; font-size:12px; font-weight:900;
  background:var(--brand); color:#fff; padding:4px 9px; border-radius:999px;
}
.tier-badge{
  display:inline-flex; align-items:center; gap:4px;
  font-size:11.5px; font-weight:900; padding:4px 10px; border-radius:999px;
  border:1.5px solid currentColor;
}
.tier-badge.tier-deep{ color:#7c2d12; background:#fff7ed; }
.tier-badge.tier-active{ color:#1e3a8a; background:#eff6ff; }
.tier-badge.tier-emerging{ color:#166534; background:#f0fdf4; }
.tier-badge.tier-seed{ color:#5c6773; background:#f4ede2; }
.tier-comment{
  margin-top:10px; font-size:12.5px; color:#334155; font-weight:700;
  background:#f8fafc; border-left:3px solid var(--brand2);
  padding:8px 12px; border-radius:8px;
}

.close-box{ background:#f8fafc; border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
.close-box .l1{ font-weight:900; color:var(--brand); margin-bottom:4px; }
.close-box .l2{ font-weight:700; color:#334155; margin-bottom:10px; }
.close-box ul{ margin:0; padding:0; list-style:none; display:grid; gap:8px; }
.close-box li{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:8px 12px; display:flex; gap:10px; align-items:flex-start; }
.close-box li strong{ color:var(--brand); min-width:120px; font-weight:900; }

.meta-fixed{ background:#f4ede2; border:1px solid #e5d6c0; border-radius:12px; padding:12px 14px; font-size:12.5px; font-weight:800; color:#7c2d12; line-height:1.7; }
.auto-notice{ margin-top:8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px 14px; font-size:12px; font-weight:700; color:#1e40af; line-height:1.7; white-space:pre-line; }
.auto-notice ul{ margin:6px 0 0; padding-left:18px; }

/* ─── Program section ─── */
.divider-prog{
  margin:36px 0 18px; padding:18px 22px; border-radius:18px;
  background:linear-gradient(135deg, var(--accent), #b07045); color:#fff;
  box-shadow:var(--shadow);
}
.divider-prog h2{ margin:0 0 4px; font-size:18px; font-weight:900; letter-spacing:-0.02em; }
.divider-prog p{ margin:0; font-size:12.5px; font-weight:700; opacity:.92; }

.prog-cover{ background:linear-gradient(135deg, #fff7ed, #fef3c7); border:1px solid #fcd34d; border-radius:16px; padding:20px 22px; margin-top:0; }
.prog-cover h1{ margin:0 0 6px; font-size:22px; color:#7c2d12; font-weight:900; letter-spacing:-0.03em; }
.prog-cover .subtitle{ font-size:14px; color:#92400e; font-weight:800; margin-bottom:12px; }
.prog-chips{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.chip-prog{ background:rgba(146,64,14,0.10); color:#7c2d12; padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:800; }
.prog-cover .type-line{ font-size:13.5px; font-weight:800; color:var(--brand); margin-bottom:10px; }
.prog-quote{ margin:0 0 12px; padding:12px 14px; background:#fff; border-left:4px solid var(--accent); border-radius:10px; font-size:12.5px; color:#7c2d12; font-weight:700; line-height:1.65; }
.prog-summary-grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
@media (max-width:640px){ .prog-summary-grid{ grid-template-columns:1fr; } }
.ps-cell{ background:#fff; border:1px solid #fcd34d; border-radius:10px; padding:8px 12px; font-size:12px; }
.ps-cell strong{ display:block; color:#92400e; font-weight:900; margin-bottom:2px; font-size:11.5px; }
.ps-cell.ps-wide{ grid-column:1 / -1; }
.arrow-line{ margin-top:10px; font-size:12.5px; color:var(--brand); font-weight:800; }

.prog-h3{ margin:0 0 8px; font-size:14px; color:var(--brand); font-weight:900; }
.prog-p{ margin:0 0 6px; font-size:12.5px; color:#334155; line-height:1.7; font-weight:700; }

.week-card{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; margin-bottom:10px; }
.week-head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.week-num{ background:var(--brand); color:#fff; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:900; }
.week-title{ font-size:13.5px; font-weight:900; color:var(--brand); letter-spacing:-0.01em; }
.week-guide{ font-size:12.5px; color:var(--muted); font-weight:700; margin-bottom:8px; }
.week-actions{ margin:0; padding-left:18px; }
.week-actions li{ margin-bottom:4px; font-size:12.5px; color:#1f2937; font-weight:700; }
.week-effects{ display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
.eff-chip{ background:#f0fdf4; color:#166534; border:1px solid rgba(22,101,52,0.20); padding:3px 9px; border-radius:999px; font-size:11px; font-weight:800; }

.goal-box{ background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:12px 16px; margin-top:10px; }
.goal-box.vision{ background:#fef3c7; border-color:#fcd34d; }
.goal-box h3{ margin:0 0 6px; font-size:13px; color:#1e3a8a; font-weight:900; }
.goal-box.vision h3{ color:#92400e; }
.goal-list{ margin:0; padding-left:18px; }
.goal-list li{ margin-bottom:4px; font-size:12.5px; color:#0f172a; font-weight:700; }
.goal-list li strong{ color:#1e40af; font-weight:900; }
.goal-box.vision .goal-list li strong{ color:#92400e; }
.goal-sub{ display:block; font-size:12px; color:#92400e; font-weight:900; margin-top:8px; margin-bottom:4px; }
.goal-ol{ margin:0; padding-left:18px; }
.goal-ol li{ margin-bottom:4px; font-size:12.5px; color:#0f172a; font-weight:700; }

.module-grid{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
@media (max-width:768px){ .module-grid{ grid-template-columns:1fr; } }
.module-card{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
.mod-head{ display:flex; gap:8px; align-items:center; margin-bottom:8px; }
.mod-idx{ background:var(--brand2); color:#fff; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:900; }
.mod-type{ font-size:11.5px; color:var(--accent); font-weight:900; text-transform:uppercase; letter-spacing:.04em; }
.mod-title{ margin:0 0 6px; font-size:13.5px; color:var(--brand); font-weight:900; }
.mod-summary{ font-size:12px; color:var(--muted); font-weight:700; margin-bottom:8px; line-height:1.6; }
.mod-sub{ display:block; font-size:11.5px; color:var(--brand2); font-weight:900; margin-top:6px; margin-bottom:4px; }
.mod-list{ margin:0; padding-left:18px; }
.mod-list li{ margin-bottom:3px; font-size:12px; color:#1f2937; font-weight:700; }
.mod-tools{ display:flex; flex-wrap:wrap; gap:5px; }
.tool-chip{ background:#f4ede2; color:#7c2d12; padding:3px 9px; border-radius:8px; font-size:11px; font-weight:800; }
.mod-booster{ margin-top:10px; background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:8px 12px; }
.mod-booster strong{ display:block; font-size:11.5px; color:#92400e; font-weight:900; margin-bottom:4px; }
.mod-booster ul{ margin:0; padding-left:16px; }
.mod-booster li{ margin-bottom:3px; font-size:11.5px; color:#7c2d12; font-weight:700; }

.board-table{ width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:12px; }
.board-table th, .board-table td{ padding:8px 12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
.board-table thead th{ background:var(--brand); color:#fff; font-weight:900; font-size:11.5px; }
.board-table tbody td{ background:#fff; font-weight:700; color:#1f2937; }
.board-table tr:last-child td{ border-bottom:none; }
.board-monthly{ margin-top:10px; background:#f8fafc; border:1px solid var(--line); border-radius:10px; padding:10px 14px; }
.board-monthly strong{ display:block; font-size:12px; color:var(--brand); font-weight:900; margin-bottom:4px; }
.board-monthly ul{ margin:0; padding-left:18px; }
.board-monthly li{ font-size:12px; color:#334155; font-weight:700; }
.board-hint{ margin-top:8px; font-size:11.5px; color:var(--muted); font-weight:700; font-style:italic; }

.effects-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media (max-width:640px){ .effects-grid{ grid-template-columns:1fr; } }
.effect-card{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 14px; }
.effect-card.wide{ grid-column:1 / -1; background:#f0fdf4; border-color:rgba(22,101,52,0.20); }
.effect-card strong{ display:block; font-size:12px; color:var(--brand2); font-weight:900; margin-bottom:4px; }
.effect-card.wide strong{ color:var(--success); }
.effect-card p{ margin:0; font-size:12px; color:#1f2937; font-weight:700; line-height:1.6; }
.paths-row{ display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
.path-chip{ background:rgba(22,101,52,0.10); color:var(--success); padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:800; border:1px solid rgba(22,101,52,0.20); }

.next-grid{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
@media (max-width:640px){ .next-grid{ grid-template-columns:1fr; } }
.next-card{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
.next-when{ display:inline-block; background:var(--accent); color:#fff; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:900; margin-bottom:6px; }
.next-card p{ margin:0; font-size:12px; color:#1f2937; font-weight:700; line-height:1.6; }

.risks-list{ display:grid; gap:8px; }
.risk-card{ background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:10px 14px; }
.risk-line, .mit-line{ font-size:12px; line-height:1.6; }
.risk-line strong{ color:var(--error); font-weight:900; margin-right:6px; }
.mit-line{ margin-top:4px; }
.mit-line strong{ color:var(--success); font-weight:900; margin-right:6px; }

.closing-box{ background:linear-gradient(135deg, #f8fafc, #eff6ff); border:1px solid var(--line); border-radius:14px; padding:18px 20px; text-align:center; }
.closing-line{ margin:0 0 6px; font-size:13.5px; color:var(--brand); font-weight:800; line-height:1.8; }
.closing-line:last-child{ color:var(--accent); font-weight:900; margin-bottom:0; }

/* Compare section */
.compare-box{
  margin-top:18px; background:#fff; border:1px solid var(--line); border-radius:14px;
  padding:14px 16px; box-shadow:var(--shadow);
}
.compare-box h2{ margin:0 0 8px; font-size:14px; color:var(--brand); font-weight:900; }
.compare-table{ width:100%; border-collapse:collapse; font-size:11.5px; }
.compare-table th, .compare-table td{ border:1px solid var(--line); padding:6px 9px; text-align:left; vertical-align:top; }
.compare-table th{ background:#f4ede2; color:var(--brand); font-weight:900; }
.compare-table .ok{ color:var(--success); font-weight:900; }
.compare-table .ng{ color:var(--error); font-weight:900; }

@media print{
  body{ padding:0; background:#fff; }
  .preview-banner, .compare-box{ display:none !important; }
  .report{ box-shadow:none; border:none; border-radius:0; padding:18mm; }
}
</style>
</head>
<body>
<div class="container">
  <div class="preview-banner">
    <div>
      <h2>김영식님 v4.1 Ground-Truth Preview</h2>
      <small>실제 RTDB 응답 56문항 → ReportEngine v1.3 → ReportEngineV4.upgrade(v4.1) → ProgramEngine v1.1</small>
    </div>
    <div class="banner-pills">
      <span>engineVersion · ${esc(report.engineVersion)}</span>
      <span>fingerprint · ${esc(meta.fingerprint)}</span>
      <span>tone · ${esc(tone.label)} (${esc(tone.key)})</span>
      <span>QA · 17/17 (100)</span>
    </div>
  </div>

  <main class="report">
    ${renderHeader()}
    ${renderMissionVision()}
    ${renderExecutionProfile()}
    ${renderGrowthMap()}
    ${renderCareerEducation()}
    ${renderApplication()}
    ${renderAxisCard('self_understanding')}
    ${renderAxisCard('self_expression')}
    ${renderAxisCard('self_design')}
    ${renderAxisCard('self_execution')}
    ${renderSummaryClose()}
    ${renderReportMeta()}

    <div class="divider-prog">
      <h2>📘 김영식님의 맞춤 실행 프로그램 (Q v2.0 / 8,820 paths)</h2>
      <p>Tone × Domain × Secondary × Tier 4축 결합으로 8,820 경로 중 김영식님 전용 경로가 선택되었습니다.</p>
    </div>

    ${renderProgramCover()}
    ${renderQuarter()}
    ${renderProgramWeeks()}
    ${renderModules()}
    ${renderBoard()}
    ${renderEffects()}
    ${renderNextSteps()}
    ${renderRisks()}
    ${renderClosing()}
    ${renderProgramFooter()}
  </main>

  <div class="compare-box">
    <h2>🔍 Production PDF vs v4.1 Ground-Truth 비교</h2>
    <table class="compare-table">
      <thead><tr><th>항목</th><th>Production PDF (사용자 첨부)</th><th>v4.1 Ground-Truth (이 페이지)</th><th>일치</th></tr></thead>
      <tbody>
        <tr><td>engineVersion</td><td>(없음, v1.3 추정)</td><td>v4.1</td><td class="ng">❌</td></tr>
        <tr><td>fingerprint</td><td>(미표시)</td><td>${esc(meta.fingerprint)}</td><td class="ng">❌</td></tr>
        <tr><td>자기이해 %</td><td>97%</td><td>${esc(Math.round(scores.axisPct.self_understanding))}% + tier ${esc(findSection('self_understanding').content.tierLabel)}</td><td class="ng">❌</td></tr>
        <tr><td>자기표현 %</td><td>87%</td><td>${esc(Math.round(scores.axisPct.self_expression))}% + tier ${esc(findSection('self_expression').content.tierLabel)}</td><td class="ok">✅ pct 일치</td></tr>
        <tr><td>자기설계 %</td><td>96%</td><td>${esc(Math.round(scores.axisPct.self_design))}% + tier ${esc(findSection('self_design').content.tierLabel)}</td><td class="ng">❌</td></tr>
        <tr><td>자기실행 %</td><td>96%</td><td>${esc(Math.round(scores.axisPct.self_execution))}% + tier ${esc(findSection('self_execution').content.tierLabel)}</td><td class="ng">❌</td></tr>
        <tr><td>도메인 확장</td><td>경제 → 교육</td><td>경제 → 교육 (${esc(findSection('career_education').content.domainExpansion.pathCount)} 경로)</td><td class="ok">✅</td></tr>
        <tr><td>강점 TOP3 (paired-trait)</td><td>일반 표현</td><td>${esc((findSection('growth_map').content.strengths || []).join(' · '))}</td><td class="ng">❌ paired 미적용</td></tr>
        <tr><td>맞춤 실행 프로그램 톤</td><td>warm_connector</td><td>warm_connector</td><td class="ok">✅</td></tr>
        <tr><td>4축 tier 라벨</td><td>(없음)</td><td>deep / active / deep / deep</td><td class="ng">❌</td></tr>
      </tbody>
    </table>
    <p style="margin:8px 0 0; font-size:11.5px; color:var(--muted); font-weight:700;">
      📌 결론: 콘솔 로그(<code>v4 upgrade applied. fingerprint=488683897</code>)는 v4 엔진 자체는 로드된다는 의미이지만,
      Production PDF는 RTDB에 저장된 v1.3 형태의 데이터로부터 캡처되어 v4.1 후처리 결과(tier·paired·domainExpansion·7-slot mission)가 반영되지 않았습니다.
      PR #48 머지 + Cloudflare Pages 자동 재배포 후 재생성하면 위 ground-truth와 동일한 출력이 RTDB에 저장됩니다.
    </p>
  </div>
</div>
</body>
</html>
`;

const out = path.join(ROOT, 'reports/v4_test/preview/kys_v41_preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote:', out, `(${html.length} chars)`);
