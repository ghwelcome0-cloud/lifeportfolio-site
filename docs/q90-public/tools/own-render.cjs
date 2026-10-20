'use strict';
// Usage: PPTR_CORE=/tmp/pp/node_modules/puppeteer-core CHROME=<path> node own-render.cjs <genDir> [theme=screen]
// own-generate.cjs 결과(report.json·program.json)를 **실제 report.html / program.html의 책 엔진**(buildBookData/buildProgramBookData → buildBookHTML)
// 으로 렌더해 A4 PDF로 인쇄한다. 방식은 scripts/audit-conditional-browser.cjs 의 openReader 와 같다:
//  firebase import 제거 + 가짜 Auth/DB 스텁(쓰기 기록), 모든 네트워크는 저장소 파일로만 응답(그 외 차단). 쓰기 0건이어야 통과.
// 출력: <genDir>/report-book.pdf, program-book.pdf, render-meta.json
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [GEN, THEME = 'screen'] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, '../../..');
const puppeteer = require(process.env.PPTR_CORE || 'puppeteer');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ctype = r => r.endsWith('.js') ? 'application/javascript' : r.endsWith('.json') ? 'application/json' : r.endsWith('.css') ? 'text/css' : r.endsWith('.svg') ? 'image/svg+xml' : r.endsWith('.png') ? 'image/png' : r.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';

async function bookHtml(browser, surface, value, meta) {
  let source = fs.readFileSync(path.join(ROOT, surface + '.html'), 'utf8');
  const adapter = surface === 'report' ? 'buildBookData' : 'buildProgramBookData';
  const anchor = surface === 'report' ? '      window.__buildBookHTML =' : '      window.__buildProgramBookHTML =';
  if (!source.includes(anchor)) throw new Error('anchor missing in ' + surface);
  source = source.replace(anchor, `      window.__ownBook=(value,theme)=>buildBookHTML(${adapter}(value),{theme});\n` + anchor);
  const boot = `<script>window.__writes=[];
 const user={uid:'offline-e2-own',email:'',getIdToken:async()=> 'x'};
 const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:user}),getDatabase=()=>({}),getFunctions=()=>({});
 const httpsCallable=()=>async()=>{throw Error('blocked callable');},query=p=>p,orderByChild=()=>0,equalTo=()=>0,limitToLast=()=>0;
 const onAuthStateChanged=()=>()=>{},ref=(_d,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'}),get=async()=>({exists:()=>false,val:()=>null});
 const set=async(p)=>__writes.push(p),update=set,remove=set,push=set;</script>`;
  source = source.replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g, '').replace('<script type="module">', boot + '<script type="module">');
  const p = await browser.newPage(); const errors = [], blocked = [];
  p.on('pageerror', e => errors.push(e.message)); await p.setRequestInterception(true);
  p.on('request', req => { try { const u = new URL(req.url());
    if (u.hostname === 'reader.invalid') {
      if (req.isNavigationRequest()) return req.respond({ status: 200, contentType: 'text/html', body: source });
      const rel = decodeURIComponent(u.pathname).replace(/^\//, ''), file = path.resolve(ROOT, rel);
      if (file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return req.respond({ status: 200, contentType: ctype(rel), body: fs.readFileSync(file) });
    }
    blocked.push(u.hostname); return req.abort(); } catch (e) { errors.push(e.message); return req.abort(); } });
  await p.goto('https://reader.invalid/' + surface + '.html?lang=ko', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof window.__ownBook === 'function', { timeout: 30000 });
  await p.waitForFunction(() => typeof window.LP_I18N?.onReady === 'function', { timeout: 30000 });
  await p.evaluate(() => new Promise(r => window.LP_I18N.onReady(r)));
  const html = await p.evaluate((v, t) => window.__ownBook(v, t), value, THEME);
  const writes = await p.evaluate(() => window.__writes.length);
  await p.close();
  if (!html || html.startsWith('ERR:')) throw new Error(surface + ' book failed: ' + String(html).slice(0, 200));
  if (writes) throw new Error(surface + ' writes ' + writes);
  meta[surface] = { errors, blocked_hosts: [...new Set(blocked)], writes, html_sha256: sha(html) };
  return html;
}
async function toPdf(browser, html, out) {
  const p = await browser.newPage(); await p.setViewport({ width: 1240, height: 1754 });
  await p.setRequestInterception(true); p.on('request', r => (r.url().startsWith('data:') || r.url() === 'about:blank') ? r.continue() : r.abort());
  await p.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts && document.fonts.ready); await new Promise(r => setTimeout(r, 1500));
  await p.emulateMediaType('print'); const pdf = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await p.close(); fs.writeFileSync(out, pdf); return sha(pdf);
}
(async () => {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const meta = { tool: 'own-render.cjs', tool_sha256: sha(fs.readFileSync(__filename)), at: new Date().toISOString(), theme: THEME };
  try {
    const report = JSON.parse(fs.readFileSync(path.join(GEN, 'report.json'), 'utf8'));
    const html = await bookHtml(browser, 'report', report, meta);
    meta.report.pdf_sha256 = await toPdf(browser, html, path.join(GEN, 'report-book.pdf'));
  } catch (e) { if (!meta.report) meta.report = {}; meta.report.fatal = String(e.message || e); }
  try {
    const program = JSON.parse(fs.readFileSync(path.join(GEN, 'program.json'), 'utf8'));
    const html = await bookHtml(browser, 'program', program, meta);
    meta.program.pdf_sha256 = await toPdf(browser, html, path.join(GEN, 'program-book.pdf'));
  } catch (e) { if (!meta.program) meta.program = {}; meta.program.fatal = String(e.message || e); }
  await browser.close();
  fs.writeFileSync(path.join(GEN, 'render-meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta, null, 1).slice(0, 1500));
})();
