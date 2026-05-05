// PDF builder - converts preview_full.html to A4 PDF using Playwright
const path = require('path');
const fs = require('fs');

(async () => {
  const { chromium } = require('playwright');
  const htmlPath = path.resolve(__dirname, 'preview_full.html');
  const pdfOut = path.resolve(__dirname, 'LifePortfolio_v4.1_ProductionKit.pdf');
  if (!fs.existsSync(htmlPath)) { console.error('preview_full.html not found'); process.exit(1); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfOut,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    preferCSSPageSize: true
  });
  await browser.close();
  const sz = fs.statSync(pdfOut).size;
  console.log('OK PDF:', pdfOut, '(' + Math.round(sz/1024) + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
