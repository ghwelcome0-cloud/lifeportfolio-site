'use strict';
// Usage: node fetch-sample.cjs <e3.json> <id> <url> <storeDir> [note]
// E2 공개 샘플 리포트 수집기 — 내려받아 sha256·바이트·페이지 수를 E3 시트에 기록한다.
// 파일 원본은 저장소 밖 storeDir에 둔다(저작물 재배포 금지·용량). 저장소에는 URL + sha256 + 수집일만 남는다.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const [E3, ID, URL, STORE, NOTE] = process.argv.slice(2);
if (!E3 || !ID || !URL || !STORE) { console.error('usage: fetch-sample.cjs <e3.json> <id> <url> <storeDir> [note]'); process.exit(2); }
const S = JSON.parse(fs.readFileSync(E3, 'utf8')); const row = S.rows.find(r => r.id === ID);
if (!row) throw new Error('no row ' + ID);
fs.mkdirSync(STORE, { recursive: true });
const ext = (URL.split('?')[0].match(/\.(pdf|png|jpg|jpeg|html?)$/i) || [, 'bin'])[1].toLowerCase();
const out = path.join(STORE, `${ID}.${ext}`);
execFileSync('curl', ['-sL', '--max-time', '60', '-A', 'Mozilla/5.0 (X11; Linux x86_64) q90-public-sample-fetch', '-o', out, URL], { stdio: 'inherit' });
const buf = fs.readFileSync(out); if (buf.length < 1024) throw new Error('too small: ' + buf.length + ' bytes');
const sha = crypto.createHash('sha256').update(buf).digest('hex');
let pages = null; try { pages = +(execFileSync('pdfinfo', [out], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/) || [])[1] || null; } catch { }
const at = new Date().toISOString().slice(0, 10);
row.sample_report_url = { value: URL, source_url: URL, collected_at: at, note: (NOTE || '') + ` | ${buf.length} bytes` + (pages ? `, ${pages}p` : '') + ` | 원본은 저장소 밖 보관` };
row.sample_report_sha256 = { value: sha, source_url: URL, collected_at: at, note: 'fetch-sample.cjs' };
if (row.status === 'empty') row.status = 'partial';
fs.writeFileSync(E3, JSON.stringify(S, null, 1));
console.log(ID, sha.slice(0, 16), buf.length, 'bytes', pages ? pages + 'p' : '', '→', out);
