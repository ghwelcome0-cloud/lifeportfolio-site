#!/usr/bin/env node
// 제작규칙서 v2.0 → 디자인된 PDF 변환기
// 마크다운 → 스타일 HTML(표지/목차/브랜딩) → PDF (Playwright/Chromium)
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const SRC = '/home/user/webapp/docs/제작규칙서_v2.0_최종본.md';
const OUT_HTML = '/home/user/webapp/docs/제작규칙서_v2.0_최종본.html';
const OUT_PDF = '/home/user/webapp/docs/인생포트폴리오_제작규칙서_v2.0.pdf';

let md = readFileSync(SRC, 'utf-8');

// 표지로 따로 뺄 제목 라인 제거 (첫 H1 + 인용 블록)
// 본문에서 첫 번째 H1("# 인생포트폴리오 제작규칙서...")는 표지로 대체
const lines = md.split('\n');
// 첫 H1 라인 인덱스
const firstH1 = lines.findIndex(l => l.startsWith('# 인생포트폴리오 제작규칙서'));
// '---' 구분자(첫 번째) 인덱스 — 표지 블록 끝
let firstHr = -1;
for (let i = firstH1 + 1; i < lines.length; i++) {
  if (lines[i].trim() === '---') { firstHr = i; break; }
}
// 표지 인용문(성경 구절) 추출
const coverBlock = lines.slice(firstH1, firstHr).join('\n');
const verse1 = '"주인이 자기 집 사람들을 맡겨 때를 따라 양식을 나눠 줄 충성되고 지혜로운 종" — 마태복음 24:45';
const verse2 = '"가서 모든 민족을 제자로 삼아 … 분부한 모든 것을 가르쳐 지키게 하라 … 세상 끝날까지 너희와 항상 함께 있으리라" — 마태복음 28:18–20';

// 본문은 표지 블록 이후부터
const bodyMd = lines.slice(firstHr + 1).join('\n');

// marked 설정 — 헤딩에 id 부여
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = text.replace(/<[^>]+>/g, '');
      const id = 'h-' + plain.replace(/[^\wㄱ-ㅎ가-힣0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const partClass = (depth === 1 && /^제\d+부/.test(plain)) ? ' class="part-title"' : '';
      const dividerBefore = (depth === 1 && /^제\d+부/.test(plain)) ? '<div class="part-divider"></div>' : '';
      return `${dividerBefore}<h${depth} id="${id}"${partClass}>${text}</h${depth}>\n`;
    }
  }
});

const bodyHtml = marked.parse(bodyMd);

// 목차(TOC) 자동 생성 — H1(제N부), H2 수집
const tocItems = [];
const headingRe = /<h([12]) id="([^"]+)"[^>]*>(.*?)<\/h[12]>/g;
let m;
while ((m = headingRe.exec(bodyHtml)) !== null) {
  const level = parseInt(m[1], 10);
  const id = m[2];
  const text = m[3].replace(/<[^>]+>/g, '').trim();
  if (text.startsWith('부록') || /^제\d+부/.test(text) || (level === 1)) {
    tocItems.push({ level, id, text });
  } else if (level === 2 && /^\d+\.\d/.test(text) === false && /^[A-D]\./.test(text)) {
    tocItems.push({ level: 2, id, text });
  }
}

const tocHtml = tocItems.map(it =>
  `<div class="toc-row toc-l${it.level}"><a href="#${it.id}"><span class="toc-text">${it.text}</span></a></div>`
).join('\n');

const today = '2026-06-16';

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>인생포트폴리오 제작규칙서 v2.0</title>
<style>
  :root{
    --ink:#1a1f2e; --muted:#5b6478; --line:#e3e7ef;
    --brand:#2d4a7c; --brand2:#3a6ea5; --gold:#b8893a;
    --bg-soft:#f6f8fb; --code-bg:#f3f5f9;
  }
  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; }
  body{
    font-family:'Noto Sans CJK KR','Noto Sans CJK JP','NanumSquare_ac',sans-serif;
    color:var(--ink); font-size:10.3pt; line-height:1.72;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }

  /* ===== 표지 ===== */
  .cover{
    height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;
    text-align:center; page-break-after:always; position:relative;
    background:linear-gradient(160deg,#2d4a7c 0%,#1e3559 55%,#162844 100%);
    color:#fff; padding:0 60px;
  }
  .cover .crest{
    width:74px;height:74px;border:2.5px solid rgba(255,255,255,.7);border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:34px;
    color:#f3d9a6;
  }
  .cover .kicker{ letter-spacing:.42em; font-size:11pt; color:#bcd0ec; margin-bottom:18px; font-weight:300; }
  .cover h1{ font-size:33pt; font-weight:800; margin:0 0 8px; line-height:1.25; letter-spacing:-.01em; }
  .cover .subtitle{ font-size:13pt; color:#dbe6f5; font-weight:400; margin-bottom:30px; }
  .cover .ver-badge{
    display:inline-block; border:1.5px solid #f3d9a6; color:#f3d9a6; border-radius:30px;
    padding:7px 26px; font-size:12pt; font-weight:700; letter-spacing:.08em; margin-bottom:46px;
  }
  .cover .verses{ max-width:620px; }
  .cover .verse{ font-size:9.6pt; color:#cdddf0; font-style:italic; line-height:1.85; margin:7px 0; font-weight:300; }
  .cover .flow{
    margin-top:40px; font-size:11.5pt; font-weight:600; color:#f3d9a6; letter-spacing:.06em;
  }
  .cover .footer-meta{
    position:absolute; bottom:42px; left:0; right:0; text-align:center;
    font-size:9pt; color:#9fb6d6; letter-spacing:.04em;
  }

  /* ===== 목차 ===== */
  .toc-page{ page-break-after:always; padding:46px 8px 20px; }
  .toc-page h2.toc-head{
    font-size:20pt; color:var(--brand); border:none; margin:0 0 6px; padding:0;
    font-weight:800; letter-spacing:-.01em;
  }
  .toc-page .toc-sub{ color:var(--muted); font-size:9.5pt; margin-bottom:26px; border-bottom:2px solid var(--brand); padding-bottom:12px; }
  .toc-row a{ text-decoration:none; color:var(--ink); display:flex; align-items:baseline; }
  .toc-row{ padding:3px 0; }
  .toc-l1{ font-weight:700; font-size:11pt; margin-top:9px; color:var(--brand); }
  .toc-l2{ font-weight:400; font-size:9.6pt; padding-left:20px; color:var(--muted); }
  .toc-text{ }

  /* ===== 본문 ===== */
  .content{ padding:0 6px; }
  h1{ font-size:17pt; }
  .part-divider{
    page-break-before:always; height:0;
  }
  h1.part-title{
    color:#fff; background:linear-gradient(120deg,var(--brand),var(--brand2));
    padding:18px 22px; border-radius:10px; margin:8px 0 22px; font-size:18pt; font-weight:800;
    letter-spacing:-.01em; box-shadow:0 3px 10px rgba(45,74,124,.18);
  }
  h2{
    font-size:13.2pt; color:var(--brand); margin:26px 0 10px; padding-bottom:6px;
    border-bottom:1.5px solid var(--line); font-weight:700;
  }
  h3{ font-size:11.4pt; color:var(--brand2); margin:18px 0 8px; font-weight:700; }
  h4{ font-size:10.4pt; color:var(--ink); margin:14px 0 6px; font-weight:700; }
  p{ margin:8px 0; }
  a{ color:var(--brand2); }
  strong{ color:var(--ink); font-weight:700; }
  ul,ol{ margin:8px 0; padding-left:22px; }
  li{ margin:3px 0; }

  blockquote{
    margin:14px 0; padding:12px 18px; background:var(--bg-soft);
    border-left:4px solid var(--gold); border-radius:0 8px 8px 0; color:#3a4256;
  }
  blockquote p{ margin:4px 0; }

  code{
    font-family:'Noto Sans Mono CJK KR','DejaVu Sans Mono',monospace;
    background:var(--code-bg); padding:1.5px 5px; border-radius:4px; font-size:8.8pt; color:#b8336a;
  }
  pre{
    background:#1e2430; color:#e6ebf2; padding:14px 16px; border-radius:9px;
    overflow-x:auto; font-size:8.6pt; line-height:1.6; page-break-inside:avoid;
  }
  pre code{ background:none; color:inherit; padding:0; }

  table{
    border-collapse:collapse; width:100%; margin:14px 0; font-size:8.9pt;
    page-break-inside:avoid; box-shadow:0 1px 4px rgba(26,31,46,.06); border-radius:8px; overflow:hidden;
  }
  thead th{
    background:var(--brand); color:#fff; padding:9px 10px; text-align:left; font-weight:700;
    border:none; font-size:9pt;
  }
  tbody td{ padding:7px 10px; border-top:1px solid var(--line); vertical-align:top; }
  tbody tr:nth-child(even){ background:var(--bg-soft); }

  hr{ border:none; border-top:1px dashed var(--line); margin:22px 0; }

  /* 강조 박스(인용을 활용한 핵심 박스 X) — 헤딩 keep-with-next */
  h1,h2,h3,h4{ page-break-after:avoid; }
  img,table,pre{ page-break-inside:avoid; }
</style>
</head>
<body>

  <!-- 표지 -->
  <section class="cover">
    <div class="crest">✦</div>
    <div class="kicker">L I F E&nbsp;&nbsp;P O R T F O L I O</div>
    <h1>인생포트폴리오<br>제작규칙서</h1>
    <div class="subtitle">PRODUCTION RULES · 설명서(SPECIFICATION / MANUAL)</div>
    <div class="ver-badge">v2.0 최종 통합본</div>
    <div class="verses">
      <div class="verse">${verse1}</div>
      <div class="verse">${verse2}</div>
    </div>
    <div class="flow">발견 → 살아냄 → 남김 → 인생 자산화</div>
    <div class="footer-meta">제정 2026-05-06 · v1.4 2026-06-15 · v2.0 통합 ${today}　|　이 문서 하나로 서비스를 재구현할 수 있도록 작성됨</div>
  </section>

  <!-- 목차 -->
  <section class="toc-page">
    <h2 class="toc-head">목차 · CONTENTS</h2>
    <div class="toc-sub">왜(철학) → 무엇을(규칙) → 어떻게(구현 스펙) → 검증(게이트)</div>
    ${tocHtml}
  </section>

  <!-- 본문 -->
  <main class="content">
    ${bodyHtml}
  </main>

</body>
</html>`;

writeFileSync(OUT_HTML, html, 'utf-8');
console.log('HTML written:', OUT_HTML, '(' + html.length + ' bytes)');

// PDF 렌더링
const launchOpts = { args: ['--no-sandbox','--disable-dev-shm-usage'], headless: true };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
const browser = await puppeteer.launch(launchOpts);
const page = await browser.newPage();
await page.goto('file://' + OUT_HTML, { waitUntil: 'networkidle0' });
await page.pdf({
  path: OUT_PDF,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:7.5pt;color:#9aa3b5;font-family:sans-serif;padding:0 15mm;display:flex;justify-content:space-between;"><span>인생포트폴리오 제작규칙서 v2.0</span><span class="pageNumber"></span></div>'
});
await browser.close();
console.log('PDF written:', OUT_PDF);
