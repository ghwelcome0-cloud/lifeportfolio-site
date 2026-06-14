// 인생포트폴리오 공식 서비스 안내서 — HTML → 고품질 PDF 변환
// playwright-core + 설치된 Chromium 사용
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/home/user/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const HTML = 'file://' + path.resolve(__dirname, 'ebook.html');
const OUT = path.resolve(__dirname, '인생포트폴리오_공식_서비스_안내서.pdf');

(async () => {
  console.log('[1/5] Chromium 실행…');
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();

  console.log('[2/5] HTML 로드…', HTML);
  await page.goto(HTML, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('[3/5] 폰트 로드 대기…');
  // 웹폰트 + 이미지 모두 로드 완료 보장
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve()
      : new Promise(res => { img.onload = img.onerror = res; })));
  });
  await page.waitForTimeout(1200); // 렌더 안정화

  console.log('[4/5] PDF 생성…');
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  await browser.close();

  const sz = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`[5/5] 완료 ✓  ${OUT}  (${sz} MB)`);
})().catch(e => { console.error('ERR', e); process.exit(1); });
