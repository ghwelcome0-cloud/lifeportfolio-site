#!/usr/bin/env node
// E1 r4 one-click runner (Windows / Mac / Linux). Usage: node runs/run-r4.cjs   (run inside the kit folder)
// Steps: 1 node check  2 tool sha gate  3 puppeteer install  4 Accept-Language probe  5 measure 13 rows + score  6 run-meta + tar
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync, spawnSync } = require('child_process'), os = require('os'), readline = require('readline');
const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const EXPECTED = 'c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const log = s => console.log(s);
const run = (cmd, args, env) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' }); if (r.status !== 0) { log(`[STOP] ${cmd} exited ${r.status}`); process.exit(r.status || 1); } };
(async () => {
  log('== 1/6 Node: ' + process.version);
  log('== 2/6 tool sha (before run)');
  const toolSha = sha('tools/measure-e1.cjs'); log(toolSha);
  if (toolSha !== EXPECTED) { log('[STOP] measure-e1.cjs sha differs from the bound value. Do not run. Tell the coordinator.'); process.exit(2); }
  log('== 3/6 installing puppeteer (1-3 min, once)');
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'puppeteer'))) run('npm', ['i', '--silent', '--no-fund', '--no-audit', 'puppeteer@24']);
  const pptr = require(path.join(ROOT, 'node_modules', 'puppeteer'));
  let exe; try { exe = pptr.executablePath('chrome-headless-shell'); } catch { exe = pptr.executablePath(); }
  if (!fs.existsSync(exe)) { log('headless shell not found, downloading...'); run('npx', ['--yes', 'puppeteer', 'browsers', 'install', 'chrome-headless-shell']); try { exe = pptr.executablePath('chrome-headless-shell'); } catch { exe = pptr.executablePath(); } }
  log('browser: ' + exe);
  const RUN = path.join('runs', new Date().toISOString().slice(0, 10) + '-r4'); fs.mkdirSync(RUN, { recursive: true });
  log('== 4/6 Accept-Language probe (1 request)');
  let AL = 'unknown';
  try { const b = await pptr.launch({ executablePath: exe, headless: 'shell', args: ['--lang=en-US', '--no-sandbox'] }); const pg = await b.newPage(); await pg.goto('https://httpbin.org/headers', { timeout: 30000 }); const t = await pg.evaluate(() => document.body.innerText); const m = t.match(/"Accept-Language":\s*"([^"]*)"/); AL = m ? m[1] : 'unknown'; await b.close(); } catch (e) { AL = 'unknown (' + String(e.message).slice(0, 40) + ')'; }
  log('Accept-Language: ' + AL);
  const START = new Date().toISOString();
  log('== 5/6 measuring 13 rows (3-10 min, leave it running)');
  const env = { PPTR_CORE: path.join(ROOT, 'node_modules', 'puppeteer'), LP_BROWSER_PATH: exe };
  const m = spawnSync(process.execPath, ['tools/measure-e1.cjs', 'roster/roster-v2.r4-subset.json', RUN], { encoding: 'utf8', env: { ...process.env, ...env } });
  fs.writeFileSync(path.join(RUN, 'measure.log'), (m.stdout || '') + (m.stderr || '')); process.stdout.write((m.stderr || '').split('\n').filter(l => l.startsWith('measuring')).join('\n') + '\n');
  if (m.status !== 0) { log('[STOP] measure failed, see ' + RUN + '/measure.log'); process.exit(3); }
  const s = spawnSync(process.execPath, ['tools/score-e1.cjs', RUN], { encoding: 'utf8' }); fs.writeFileSync(path.join(RUN, 'score.log'), (s.stdout || '') + (s.stderr || '')); process.stdout.write(s.stdout || '');
  const END = new Date().toISOString();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const NET = await new Promise(r => rl.question('Network kind (home-wifi / office-wired / mobile-tether): ', a => { rl.close(); r((a || 'unknown').trim()); }));
  let bv = 'puppeteer ' + require(path.join(ROOT, 'node_modules', 'puppeteer', 'package.json')).version + ' bundled chrome-headless-shell';
  try { bv += ' ' + execSync(`"${exe}" --version`, { encoding: 'utf8' }).trim(); } catch {}
  const meta = { bound_commit: '9557e46', run: 'r4', egress_country: 'KR', machine_kind: 'owner-local-pc', network_kind: NET, browser: bv, profile: 'fresh (puppeteer new page, no cookies/cache, not logged in)', rows_requested: 13, bridge_rows: ['K02', 'K05', 'K13', 'K18'], started_utc: START, ended_utc: END, browser_lang_flag: 'en-US', os_kind: `${os.type()} ${os.release()}`, os_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accept_language_sent: AL, tool_sha_before_run: toolSha, roster_subset_sha256: sha('roster/roster-v2.r4-subset.json') };
  fs.writeFileSync(path.join(RUN, 'run-meta.json'), JSON.stringify(meta, null, 1));
  log('== 6/6 packing');
  const tar = spawnSync('tar', ['-czf', 'r4-result.tar.gz', RUN], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (tar.status === 0) { log('result tar sha256: ' + sha('r4-result.tar.gz')); log('\nDONE. Send the single file  r4-result.tar.gz  (in this folder) to the coordinator, plus the two sha lines above.'); }
  else { log('tar not available — send the whole folder ' + RUN + ' as a zip instead. tool sha above.'); }
})().catch(e => { log('[STOP] ' + e.message); process.exit(1); });
