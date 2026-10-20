'use strict';
// 방문 통계 동의(lp-consent.js)를 쓰는 모든 화면: 화면 안 보안 규칙(meta CSP)이 동의 서버 연결을 막지 않아야 한다.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const FN = 'https://asia-northeast3-lifeporfolio.cloudfunctions.net';
let n = 0;
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  if (!s.includes('lp-consent.js')) continue;
  const m = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(s);
  if (!m) continue;
  const cs = /connect-src([^;]*)/.exec(m[1]);
  if (!cs) continue;
  assert.ok(cs[1].split(/\s+/).includes(FN), f + ': meta CSP connect-src must allow ' + FN);
  n++;
}
assert.ok(n >= 16, 'expected >=16 pages with meta CSP, got ' + n);
console.log('consent CSP ok: ' + n + ' pages');
