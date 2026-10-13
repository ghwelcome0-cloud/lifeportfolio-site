'use strict';
// Usage: node own-transcribe.cjs <scorer-output.json> <scorer-sha256> <source-ref> → table/own.json
// 자사 행 전사기(G21 own_row_rule): Q90 2회차 scorer 출력에서 A1~A7 값을 **그대로** 옮긴다. 계산·반올림·해석 없음.
// scorer 출력 형식은 TL 조립기 v4가 정하므로, 여기서는 축 id 키(A1..A7)를 찾는 두 가지 형태만 지원한다:
//  (a) {axes:{A1:{points|level|grade}, …}}  (b) {A1:…, A2:…}
// 값이 없으면 null(=표에 '미측정')로 둔다. 만들어 채우지 않는다.
const fs = require('fs'), crypto = require('crypto');
const [SRC, SHA, REF] = process.argv.slice(2);
if (!SRC || !SHA || !REF) { console.error('usage: own-transcribe.cjs <scorer-output.json> <sha256> <source-ref>'); process.exit(2); }
const buf = fs.readFileSync(SRC); const actual = crypto.createHash('sha256').update(buf).digest('hex');
if (actual !== SHA) { console.error(`sha256 mismatch: expected ${SHA} got ${actual}`); process.exit(3); }
const j = JSON.parse(buf.toString('utf8')); const ax = j.axes || j;
const pick = k => { const v = ax[k]; if (v == null) return null; if (typeof v === 'object') return v.points ?? v.score ?? v.level ?? v.grade ?? null; return v; };
const out = { source: { file: require('path').basename(SRC), sha256: SHA, ref: REF, transcribed_at: new Date().toISOString() },
  rule: 'Q90 2회차 scorer 출력 전사(계산·해석 없음). 2회차 미달이면 미달 점수 그대로. A8은 E3 규칙(sheets/e3-docs.json OWN).',
  A1: pick('A1'), A2: pick('A2'), A3: pick('A3'), A4: pick('A4'), A5: pick('A5'), A6: pick('A6'), A7grade: pick('A7') };
fs.writeFileSync('table/own.json', JSON.stringify(out, null, 1));
console.log('table/own.json', Object.entries(out).filter(([k]) => /^A/.test(k)).map(([k, v]) => `${k}=${v}`).join(' '));
