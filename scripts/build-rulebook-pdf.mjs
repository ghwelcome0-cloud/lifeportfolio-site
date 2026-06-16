// 제작규칙서 v2.0 → 디자인된 PDF 변환 파이프라인
// markdown → styled HTML(표지/목차/브랜딩) → PDF (Playwright + Chromium)
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const MD_PATH = '/home/user/webapp/docs/제작규칙서_v2.0_최종본.md';
const HTML_OUT = '/home/user/webapp/docs/제작규칙서_v2.0.html';
const PDF_OUT = '/home/user/webapp/docs/인생포트폴리오_제작규칙서_v2.0.pdf';

let md = readFileSync(MD_PATH, 'utf-8');

// --- 1) 표지/본문 분리: 첫 H1과 인용 블록을 표지로 추출 ---
// 본문 마크다운 전체를 그대로 렌더, 다만 첫 H1(타이틀)은 본문에서 제거(표지에서 별도 처리)
const lines = md.split('\n');
// 본문 시작: 첫 '---' 이후 (표지 메타 끝)
const firstHrIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
const bodyMd = lines.slice(firstHrIdx + 1).join('\n');

// --- 2) marked 설정 + heading id/슬러그 + TOC 수집 ---
const toc = []; // {level, text, id}
let hCounter = 0;
const slug = (t) => 'h' + (hCounter++);

function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

// marked v18: renderer methods receive a token object; use parser to render inline text
const renderer = {
  heading(token) {
    const level = token.depth;
    const text = this.parser.parseInline(token.tokens);
    const raw = token.text;
    const id = slug(raw);
    if (level === 1 || level === 2) toc.push({ level, text: stripTags(raw), id });
    const cls = level === 1 ? ' class="part-divider"' : '';
    return `<h${level} id="${id}"${cls}>${text}</h${level}>\n`;
  }
};

marked.use({ renderer, breaks: false, gfm: true });
const bodyHtml = marked.parse(bodyMd);

// --- 3) TOC HTML ---
const tocHtml = toc.map(t => {
  const cls = t.level === 1 ? 'toc-part' : 'toc-chap';
  return `<div class="${cls}"><a href="#${t.id}">${t.text}</a></div>`;
}).join('\n');

// --- 4) 전체 HTML 조립 ---
const today = '2026-06-16';
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  :root{
    --navy:#1a2744; --navy2:#22325a; --gold:#b88a3e; --gold2:#d8b15f;
    --ink:#222; --muted:#5b6477; --line:#d8dde6; --bg-soft:#f5f7fb;
    --code-bg:#f4f1ea; --code-ink:#5a4a2a;
  }
  *{box-sizing:border-box;}
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{
    font-family:'Noto Sans CJK KR','Noto Sans CJK JP','NanumSquare_ac',sans-serif;
    color:var(--ink); font-size:10.3pt; line-height:1.72; margin:0;
  }

  /* ===== 표지 ===== */
  .cover{
    height:1020px; display:flex; flex-direction:column; justify-content:space-between;
    background:linear-gradient(160deg,var(--navy) 0%,var(--navy2) 55%,#2c3e6b 100%);
    color:#fff; padding:90px 70px 70px; page-break-after:always; position:relative;
  }
  .cover::before{
    content:""; position:absolute; left:70px; right:70px; top:300px; height:2px;
    background:linear-gradient(90deg,transparent,var(--gold2),transparent);
  }
  .cover .kicker{ letter-spacing:.45em; font-size:11pt; color:var(--gold2); font-weight:700; }
  .cover h1{
    font-size:34pt; line-height:1.28; margin:26px 0 0; font-weight:800; border:none; padding:0;
  }
  .cover .sub{ margin-top:22px; font-size:12.5pt; color:#cdd6ea; line-height:1.7; max-width:560px;}
  .cover .verse{
    font-size:10.5pt; color:#aebbd8; font-style:italic; line-height:1.85; max-width:600px;
  }
  .cover .verse b{ color:var(--gold2); font-style:normal; }
  .cover .footer-meta{ display:flex; justify-content:space-between; align-items:flex-end; font-size:10pt; color:#c2cbe0;}
  .cover .badge{
    display:inline-block; border:1.5px solid var(--gold2); color:var(--gold2);
    padding:7px 18px; border-radius:30px; font-weight:700; letter-spacing:.1em; font-size:11pt;
  }
  .cover .principle{ margin-top:14px; font-size:10pt; color:#d4dcef; line-height:1.8;}
  .cover .principle .tag{ color:var(--gold2); font-weight:700; }

  /* ===== 목차 ===== */
  .toc-page{ padding:60px 64px; page-break-after:always; }
  .toc-page h2{ color:var(--navy); border-bottom:3px solid var(--gold); padding-bottom:10px; font-size:20pt; margin:0 0 24px;}
  .toc-part{ margin:14px 0 4px; font-weight:800; color:var(--navy); font-size:11.5pt;}
  .toc-part a{ color:var(--navy); text-decoration:none;}
  .toc-chap{ margin:2px 0 2px 22px; color:var(--muted); font-size:10pt;}
  .toc-chap a{ color:var(--muted); text-decoration:none;}

  /* ===== 본문 컨테이너 ===== */
  .content{ padding:0 60px; }

  h1.part-divider{
    color:#fff; background:linear-gradient(135deg,var(--navy),var(--navy2));
    padding:26px 30px; border-radius:10px; font-size:19pt; font-weight:800;
    margin:0 0 22px; page-break-before:always; border-left:8px solid var(--gold2);
    box-shadow:0 3px 8px rgba(26,39,68,.18);
  }
  /* 첫 part는 페이지 강제 분리 안 함(목차 다음 바로) */
  .content > h1.part-divider:first-child{ page-break-before:auto; }

  h2{ color:var(--navy); font-size:14.5pt; font-weight:800; margin:26px 0 10px;
      border-bottom:2px solid var(--line); padding-bottom:6px;}
  h3{ color:var(--navy2); font-size:12pt; font-weight:700; margin:18px 0 8px;
      padding-left:11px; border-left:4px solid var(--gold);}
  h4{ color:var(--gold); font-size:10.8pt; font-weight:700; margin:14px 0 6px;}

  p{ margin:8px 0; }
  a{ color:var(--navy2); }
  strong{ color:var(--navy); }
  hr{ border:none; border-top:1px dashed var(--line); margin:22px 0;}

  ul,ol{ margin:8px 0 8px 4px; padding-left:22px;}
  li{ margin:4px 0;}

  /* 인용(성경/철학) */
  blockquote{
    margin:14px 0; padding:14px 20px; background:var(--bg-soft);
    border-left:5px solid var(--gold); border-radius:0 8px 8px 0;
    color:var(--navy2); font-size:10pt;
  }
  blockquote p{ margin:5px 0; }

  /* 코드 */
  code{ background:var(--code-bg); color:var(--code-ink); padding:1px 6px; border-radius:4px;
        font-family:'D2Coding','Noto Sans Mono CJK KR',monospace; font-size:9pt;}
  pre{ background:#1e2435; color:#e6e9f2; padding:16px 18px; border-radius:8px; overflow:hidden;
       font-size:8.6pt; line-height:1.55; page-break-inside:avoid; border-left:4px solid var(--gold2);}
  pre code{ background:none; color:inherit; padding:0; font-size:8.6pt;}

  /* 표 */
  table{ width:100%; border-collapse:collapse; margin:14px 0; font-size:9pt; page-break-inside:avoid;}
  thead th{ background:var(--navy); color:#fff; padding:8px 10px; text-align:left; font-weight:700;
            border:1px solid var(--navy);}
  tbody td{ padding:7px 10px; border:1px solid var(--line); vertical-align:top;}
  tbody tr:nth-child(even){ background:var(--bg-soft);}

  /* 페이지 여백/번호 */
  @page{
    size:A4; margin:18mm 0 16mm;
    @bottom-center{ content:counter(page); color:#8a93a6; font-size:9pt; }
  }
  @page:first{ margin:0; }
</style>
</head>
<body>

  <!-- 표지 -->
  <section class="cover">
    <div>
      <div class="kicker">LIFE&nbsp;PORTFOLIO</div>
      <h1>인생포트폴리오<br>제작규칙서</h1>
      <div class="sub">리포트 합성 · 맞춤 실행프로그램 · 진로/교육 매핑 · 자산화 구조<br>
        <span style="font-size:10.5pt;color:#aebbd8;">이 문서 하나만으로 서비스를 처음부터 재구현할 수 있도록 작성한 설명서</span>
      </div>
      <div class="principle">
        <span class="tag">대원칙-A</span> 고유성 종합 × 직관적 단일표현(2단 구조)<br>
        <span class="tag">대원칙-B</span> 축적 원칙(비파괴 · 재현성)<br>
        발견 → 살아냄 → 남김 → <b style="color:var(--gold2)">인생 자산화</b>
      </div>
    </div>
    <div class="verse">
      <p>“주인이 자기 집 사람들을 맡겨 때를 따라 양식을 나눠 줄 충성되고 지혜로운 종” — <b>마태복음 24:45</b></p>
      <p>“가서 모든 민족을 제자로 삼아 … 분부한 모든 것을 가르쳐 지키게 하라 … 세상 끝날까지 너희와 항상 함께 있으리라” — <b>마태복음 28:18–20</b></p>
    </div>
    <div class="footer-meta">
      <div>
        <span class="badge">v2.0 최종 통합본</span>
        <div style="margin-top:14px;">제정 2026-05-06 · v1.4 2026-06-15 · v2.0 통합 ${today}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;color:var(--gold2);">PRODUCTION RULES</div>
        <div>제자화(訓練)용 · 보관본</div>
      </div>
    </div>
  </section>

  <!-- 목차 -->
  <section class="toc-page">
    <h2>목차 (Contents)</h2>
    ${tocHtml}
  </section>

  <!-- 본문 -->
  <main class="content">
    ${bodyHtml}
  </main>

</body>
</html>`;

writeFileSync(HTML_OUT, html, 'utf-8');
console.log('HTML written:', HTML_OUT, '(', html.length, 'bytes )');

// --- 5) Puppeteer Chromium → PDF ---
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto('file://' + HTML_OUT, { waitUntil: 'networkidle0' });
await page.pdf({
  path: PDF_OUT,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log('PDF written:', PDF_OUT);
