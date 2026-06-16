const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VERSION  = "v1.0";
const PUB_DATE = "2026-06-16";

const headerTpl = `
<div style="font-family:'Noto Sans CJK KR','NanumSquare',sans-serif;font-size:8.5pt;color:#3A5269;
  width:100%;padding:0 20mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-end;
  border-bottom:1.2px solid #3A5269;padding-bottom:3mm;position:relative;">
  <span style="position:absolute;left:20mm;top:-1mm;width:60mm;height:2.4px;background:#C49E45"></span>
  <span style="font-weight:700;letter-spacing:0.05em">인생포트폴리오 · 코칭 상담 스크립트 매뉴얼</span>
  <span style="font-weight:400;color:#64748B">Coaching Script Manual ${VERSION}</span>
</div>`;

const footerTpl = `
<div style="font-family:'Noto Sans CJK KR','NanumSquare',sans-serif;font-size:8pt;color:#64748B;
  width:100%;padding:0 20mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;
  border-top:1px solid #E2E8F0;padding-top:3mm;">
  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">
    코칭 상담 스크립트 매뉴얼 ${VERSION} · ${PUB_DATE} · 21일 점검 동행
  </span>
  <span style="font-family:'DejaVu Sans Mono',monospace;color:#3A5269;font-size:8pt">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </span>
</div>`;

(async () => {
  const htmlPath = 'file://' + path.resolve(__dirname, '..', 'docs', 'manual', 'coaching-script-manual_v1.0.html');
  const outPath  = path.resolve(__dirname, '..', 'docs', 'manual', '인생포트폴리오_코칭상담스크립트매뉴얼_v1.0.pdf');

  const browser = await puppeteer.launch({
    executablePath: '/home/user/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'], timeout: 60000 });
  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 1500));

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '24mm', right: '20mm', bottom: '20mm', left: '20mm' },
    displayHeaderFooter: true,
    headerTemplate: headerTpl,
    footerTemplate: footerTpl
  });
  await browser.close();

  const sz = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('✓ PDF generated:', outPath, '(' + sz + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
