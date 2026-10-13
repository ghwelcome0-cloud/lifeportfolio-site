#!/usr/bin/env node
// 마무리 전용: 측정이 끝난 뒤 run-meta.json 작성 + tar 묶기만 한다(브라우저를 띄우지 않음). Usage: node runs/finish-r4.cjs <network-kind>
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const NET = (process.argv[2] || 'unknown').trim();
const runs = fs.readdirSync('runs').filter(d => /-r4$/.test(d) && fs.existsSync(path.join('runs', d, 'e1-results.json')));
if (!runs.length) { console.log('[STOP] runs/*-r4/e1-results.json 이 없습니다 — 측정이 안 끝난 상태'); process.exit(2); }
const RUN = path.join('runs', runs.sort().pop()); const res = JSON.parse(fs.readFileSync(path.join(RUN, 'e1-results.json'), 'utf8'));
if (!fs.existsSync(path.join(RUN, 'e1-scored.json'))) { const s = spawnSync(process.execPath, ['tools/score-e1.cjs', RUN], { encoding: 'utf8' }); fs.writeFileSync(path.join(RUN, 'score.log'), (s.stdout || '') + (s.stderr || '')); }
const END = res.results.map(r => r.measuredAt).filter(Boolean).sort().pop() || new Date().toISOString();
let exe = ''; try { exe = require(path.join(ROOT, 'node_modules', 'puppeteer')).executablePath(); } catch {}
const bvm = exe.match(/(win64|linux|mac[^\\/]*)-(\d+\.\d+\.\d+\.\d+)/);
const meta = { bound_commit: '9557e46', run: 'r4', egress_country: 'KR', machine_kind: 'owner-local-pc', network_kind: NET, browser: 'puppeteer ' + (fs.existsSync(path.join(ROOT, 'node_modules', 'puppeteer', 'package.json')) ? require(path.join(ROOT, 'node_modules', 'puppeteer', 'package.json')).version : '?') + ' bundled chrome ' + (bvm ? bvm[2] : '(경로 미확인)'), profile: 'fresh (puppeteer new page, no cookies/cache, not logged in)', rows_requested: res.results.length, bridge_rows: ['K02', 'K05', 'K13', 'K18'], started_utc: res.startedAt, ended_utc: END, browser_lang_flag: 'en-US', os_kind: `${os.type()} ${os.release()}`, os_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accept_language_sent: 'en-US,en;q=0.9 (4/6 단계 출력값 전사)', tool_sha_before_run: sha('tools/measure-e1.cjs'), roster_subset_sha256: sha('roster/roster-v2.r4-subset.json'), finish_note: 'run-r4.cjs 6단계가 chrome --version 호출로 GUI 창을 띄워(⑲) 중단 → finish-r4.cjs 로 메타·묶기 수행. 측정(5단계)은 그 전에 완료됨' };
fs.writeFileSync(path.join(RUN, 'run-meta.json'), JSON.stringify(meta, null, 1));
const tar = spawnSync('tar', ['-czf', 'r4-result.tar.gz', RUN], { stdio: 'inherit', shell: process.platform === 'win32' });
console.log('tool sha: ' + meta.tool_sha_before_run);
if (tar.status === 0) console.log('result tar sha256: ' + sha('r4-result.tar.gz') + '\n\nDONE. 이 폴더의 r4-result.tar.gz 하나를 보내 주세요.'); else console.log('tar 실패 — ' + RUN + ' 폴더를 zip으로 묶어 보내 주세요.');
