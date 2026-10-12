// 공식 가격 페이지를 로컬 headless chrome으로 렌더해 본문 텍스트에서 가격 줄만 뽑는다(출처=그 URL, 렌더 시각 기록)
const pptr = require('puppeteer-core'); const fs = require('fs');
const EXE = '/home/user/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell';
const targets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const b = await pptr.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const out = {};
  for (const [id, url] of Object.entries(targets)) {
    const p = await b.newPage(); await p.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/148 price-check');
    try { await p.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }); await new Promise(r => setTimeout(r, 2500));
      const txt = await p.evaluate(() => document.body.innerText);
      const lines = txt.split('\n').map(s => s.trim()).filter(s => /[$£€₩]\s?\d|\d[\d,]*\s?원|USD|GBP|KRW|per (month|user|seat|year)|\/mo/i.test(s));
      out[id] = { url, renderedAt: new Date().toISOString(), chars: txt.length, price_lines: [...new Set(lines)].slice(0, 25) };
    } catch (e) { out[id] = { url, error: String(e).slice(0, 120) }; }
    await p.close(); console.error(id, out[id].error || out[id].price_lines.length + ' lines');
  }
  await b.close(); fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
})();
