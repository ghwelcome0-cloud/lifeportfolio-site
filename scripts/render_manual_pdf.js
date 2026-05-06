#!/usr/bin/env node
/**
 * render_manual_pdf.js  (v1.3 — PPT 슬라이드 + 자동 페이지네이션)
 * Puppeteer로 manual.html 을 고급 PDF로 변환.
 *
 *  핵심:
 *  - A4 (210 × 297mm), 위/아래/좌우 안전 여백 (24/20/20/20mm) → CSS @page 와 일치
 *  - displayHeaderFooter: true → 모든 장에 머리글/꼬리글 자동 인쇄
 *      · 머리글: 인생포트폴리오 제작 매뉴얼 (브랜드 라인)
 *      · 꼬리글: 발행 정보 + 페이지 번호
 *  - preferCSSPageSize: true (CSS @page 우선)
 *  - 본문이 슬라이드 캔버스를 넘으면 같은 head/foot 가 반복되며 자연 분할 (PPT 스타일)
 *  - 한글 폰트(Noto Sans KR / Noto Serif KR) 로딩 대기
 */
"use strict";

const fs   = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "reports/manual_v1/manual.html");
const PDF  = path.join(ROOT, "reports/manual_v1/lifeportfolio_production_manual_v1.pdf");

const VERSION  = "v1.2";
const PUB_DATE = "2026-05-06";

// ─── 모든 페이지 공통 머리글 (얇은 브랜드 라인) ───
const headerTpl = `
<div style="
  font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-size:8.5pt; color:#1c3a5e;
  width:100%; padding:0 20mm; box-sizing:border-box;
  display:flex; justify-content:space-between; align-items:flex-end;
  border-bottom:1.2px solid #1c3a5e; padding-bottom:3mm;
  position:relative;
">
  <span style="position:absolute; left:20mm; top:-1mm; width:60mm; height:2.4px; background:#c79b3a"></span>
  <span style="font-weight:700; letter-spacing:0.05em">인생포트폴리오 · 제작 매뉴얼</span>
  <span style="font-weight:400; color:#3b4252">Life Portfolio Production Standard ${VERSION}</span>
</div>`;

// ─── 모든 페이지 공통 꼬리글 (페이지 번호 포함) ───
const footerTpl = `
<div style="
  font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-size:8pt; color:#6b7280;
  width:100%; padding:0 20mm; box-sizing:border-box;
  display:flex; justify-content:space-between; align-items:center;
  border-top:1px solid #e5e7eb; padding-top:3mm;
">
  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%">
    인생포트폴리오 제작 매뉴얼 ${VERSION} · ${PUB_DATE}
  </span>
  <span style="font-family:'SF Mono','Consolas',monospace; color:#3b4252; font-size:8pt">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </span>
</div>`;

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=medium",
      "--disable-dev-shm-usage"
    ]
  });
  const page = await browser.newPage();

  const html = fs.readFileSync(HTML, "utf8");
  await page.setContent(html, { waitUntil: ["load", "domcontentloaded", "networkidle0"] });

  // 폰트 완전 로드 대기
  await page.evaluateHandle("document.fonts.ready");
  await new Promise(r => setTimeout(r, 1500));

  await page.pdf({
    path: PDF,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    // CSS @page 마진 (24/20/20/20mm)이 사용됨. margin은 fallback.
    margin: { top: "24mm", right: "20mm", bottom: "20mm", left: "20mm" },
    displayHeaderFooter: true,
    headerTemplate: headerTpl,
    footerTemplate: footerTpl
  });

  await browser.close();

  const sz = (fs.statSync(PDF).size / 1024).toFixed(1);
  console.log("✓ PDF written:", PDF, "(" + sz + " KB)");
})();
