// 각 .page의 실제 콘텐츠 높이를 측정해 297mm(약 1122.5px @96dpi) 초과(=잘림) 페이지 탐지
const { chromium } = require('playwright-core');
const path = require('path');
const CHROME = '/home/user/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const HTML = 'file://' + path.resolve(__dirname, 'ebook.html');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(HTML, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if(document.fonts) await document.fonts.ready; });
  await page.waitForTimeout(800);

  const res = await page.evaluate(() => {
    const MM = 96/25.4;              // px per mm @96dpi
    const LIMIT = 297*MM;            // A4 height in px
    const pages = Array.from(document.querySelectorAll('.page'));
    return pages.map((p,i)=>{
      // 콘텐츠 실제 높이 = scrollHeight (overflow:hidden이어도 측정됨)
      const sh = p.scrollHeight;
      const over = sh - LIMIT;
      // 식별용 라벨
      const pg = (p.querySelector('.pg')?.textContent||'').trim();
      const title = (p.querySelector('.part-title')?.textContent||p.querySelector('.kicker')?.textContent||'').trim().slice(0,20);
      return { idx:i+1, pg, title, scrollH:Math.round(sh), limit:Math.round(LIMIT), over:Math.round(over) };
    });
  });
  console.log('LIMIT(px)=', Math.round(297*96/25.4));
  res.forEach(r=>{
    const flag = r.over>2 ? `⚠ 초과 +${r.over}px (≈${(r.over/(96/25.4)).toFixed(1)}mm 잘림)` : 'OK';
    console.log(`p${String(r.idx).padStart(2)} [${r.pg||'cover'}] ${r.title.padEnd(16)} h=${r.scrollH}  ${flag}`);
  });
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
