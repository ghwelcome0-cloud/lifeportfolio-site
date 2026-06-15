const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const htmlPath = 'file://' + path.resolve(__dirname, 'rules_v1.4_slides.html');
  const outPath = path.resolve(__dirname, '..', 'docs', 'PRODUCTION_RULES_v1.4.pdf');

  const browser = await puppeteer.launch({
    executablePath: '/home/user/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });
  // 폰트 로드 대기
  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 1500));

  await page.pdf({
    path: outPath,
    width: '1280px',
    height: '720px',
    printBackground: true,
    pageRanges: '',
    preferCSSPageSize: true
  });
  await browser.close();
  console.log('PDF generated:', outPath);
})().catch(e => { console.error(e); process.exit(1); });
