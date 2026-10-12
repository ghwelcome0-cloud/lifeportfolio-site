'use strict';
// Usage: node gen-e2-sheet.cjs <roster.json> <e3.json> <out.json> [existing-e2.json]
// E2(공개 샘플 리포트 블라인드 채점) 시트 생성기.
// - e3 시트에서 sample_report_url이 있는 행만 채점 대상이 된다(없으면 A1~A5 = 미측정).
// - 자사(OWN)는 제외: 자사 점수는 Q90 2회차 scorer 전사만 쓴다(own_row_rule).
// - judge 2인이 독립 채점. 블라인드를 위해 blind_id(무작위)로만 샘플을 건넨다. 회사명은 unblind 단계에서만 연결.
const fs = require('fs'), crypto = require('crypto');
const [ROSTER, E3, OUT, PREV] = process.argv.slice(2);
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
const e3 = Object.fromEntries(JSON.parse(fs.readFileSync(E3, 'utf8')).rows.map(r => [r.id, r]));
const prev = PREV && fs.existsSync(PREV) ? Object.fromEntries(JSON.parse(fs.readFileSync(PREV, 'utf8')).rows.map(r => [r.id, r])) : {};
const AX = ['A1', 'A2', 'A3', 'A4', 'A5'];
const judge = () => Object.fromEntries(AX.map(a => [a, { level: null, reason: '' }]));
const rows = roster.rows.filter(r => !r.own).map(r => {
  if (prev[r.id]) return prev[r.id];
  const s = e3[r.id] && e3[r.id].sample_report_url && e3[r.id].sample_report_url.value;
  return {
    id: r.id, name: r.name,
    blind_id: 'S-' + crypto.createHash('sha256').update(r.id + '|' + roster.version).digest('hex').slice(0, 6), // 명부 고정 → 재현 가능, 회사명은 드러나지 않음
    sample_url: s || null, sample_sha256: s ? (e3[r.id].sample_report_sha256.value || null) : null,
    status: s ? 'ready' : 'no_sample', // no_sample → ready → judged(2인) → resolved(차이≥2는 제3자) → final
    judge1: judge(), judge2: judge(), judge3: null,
    final: Object.fromEntries(AX.map(a => [a, null])), // 평균 레벨(L) → 공개 가중 환산은 build-table에서
    ...Object.fromEntries(AX.map(a => [a, null])) // build-table이 읽는 칸: final과 동일하게 채운다
  };
});
fs.writeFileSync(OUT, JSON.stringify({
  sheet: 'E2 공개 샘플 리포트 블라인드 채점', roster_version: roster.version, generatedAt: new Date().toISOString(),
  procedure: ['① 샘플 파일 내려받아 sha256 고정', '② 회사명·로고 가린 사본을 blind_id로 저장(샘플 자체의 유형명은 남김)', '③ judge1·judge2 독립 채점(rubric-v2 e2_judge_rubric_public, L1~L5, 이유 1문장)', '④ 축별 차이≥2 → judge3', '⑤ final = 평균(소수 1자리) · 표에는 (샘플) 꼬리표', '⑥ judge는 Q90 2회차 judge 세션과 분리'],
  judges: { judge1: null, judge2: null, judge3: null }, // 채점 세션 식별자만 적는다(사람 이름 아님)
  rows
}, null, 1));
console.log('rows', rows.length, 'ready', rows.filter(r => r.status === 'ready').length, 'no_sample', rows.filter(r => r.status === 'no_sample').length, '→', OUT);
