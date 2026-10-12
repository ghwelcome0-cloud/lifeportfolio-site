'use strict';
// Usage: node gen-e2-sheet.cjs <roster.json> <e3.json> <out.json> [existing-e2.json]
// E2(공개 샘플 리포트 블라인드 채점) 시트 생성기. Method 6037069 · Peer 6037125 · TL 6037115 결박 반영(결과 보기 전 고정).
// ① blind_id = sha256(salt | id | roster.version) 앞 6자. salt = 32바이트 난수, 총괄만 보관(E2_SALT_FILE), 채점 끝난 뒤 공개.
//    채점 전에는 salt_sha256만 시트에 적어 나중에 바꾸지 않았음을 증명한다. (salt 없는 고정 함수는 41행 해시로 1초 안에 역산됨 → 블라인드 아님)
// ② 내용 블라인드: 이름·도메인·로고 대체텍스트·고유 상품명 목록을 시트에 고정, 처리 도구 sha, 처리 후 누출 검사(명부 문자열 0건).
//    judge에게 "어디인지 알 것 같다" 칸(guess)을 두되 점수에는 쓰지 않는다.
// ③ 집계: 척도 L1~L5. 두 judge 차이 ≤1 → 낮은 값(보수적). 차이 ≥2 → 제3자가 두 값 중 하나를 근거와 함께 선택. 새 값·평균 금지.
// ④ judge·제3자는 Q90 judge·adjudicator·X1~X4와 다른 actor. 자사(OWN)는 채점 대상 아님(own_row_rule).
const fs = require('fs'), crypto = require('crypto');
const [ROSTER, E3, OUT, PREV] = process.argv.slice(2);
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
const e3 = Object.fromEntries(JSON.parse(fs.readFileSync(E3, 'utf8')).rows.map(r => [r.id, r]));
const prevDoc = PREV && fs.existsSync(PREV) ? JSON.parse(fs.readFileSync(PREV, 'utf8')) : null;
const prev = prevDoc ? Object.fromEntries(prevDoc.rows.map(r => [r.id, r])) : {};
// salt: 기존 시트의 salt_sha256과 맞는 파일이 있어야 blind_id를 다시 계산한다. 없으면 blind_id는 비워 둔다(채점 시작 불가).
const SALT_FILE = process.env.E2_SALT_FILE || '';
let salt = null, saltSha = prevDoc ? prevDoc.salt_sha256 : null;
if (SALT_FILE && fs.existsSync(SALT_FILE)) {
  salt = fs.readFileSync(SALT_FILE); if (salt.length < 32) throw new Error('salt는 32바이트 이상');
  const s = crypto.createHash('sha256').update(salt).digest('hex');
  if (saltSha && s !== saltSha) throw new Error('salt 파일이 시트의 salt_sha256과 다름 — salt를 바꾸면 안 된다');
  saltSha = s;
}
const bid = id => salt ? 'S-' + crypto.createHash('sha256').update(Buffer.concat([salt, Buffer.from('|' + id + '|' + roster.version)])).digest('hex').slice(0, 6) : null;
const AX = ['A1', 'A2', 'A3', 'A4', 'A5'];
const judge = () => ({ ...Object.fromEntries(AX.map(a => [a, { level: null, reason: '' }])), guess: { thinks_knows: null, note: '' } });
const rows = roster.rows.filter(r => !r.own).map(r => {
  if (prev[r.id]) { const o = prev[r.id]; if (!o.blind_id && salt) o.blind_id = bid(r.id); return o; }
  const s = e3[r.id] && e3[r.id].sample_report_url && e3[r.id].sample_report_url.value;
  return {
    id: r.id, name: r.name, blind_id: bid(r.id),
    sample_url: s || null, sample_sha256: s ? (e3[r.id].sample_report_sha256.value || null) : null,
    redaction: { items_found: [], tool_sha256: null, leak_check: { roster_strings_found: null, checked_at: null }, redacted_sha256: null },
    status: s ? 'ready' : 'no_sample', // no_sample → ready → redacted → judged(2인) → resolved → final
    judge1: judge(), judge2: judge(), judge3: null, // judge3 = {A?: {picked: 'judge1'|'judge2', reason}} 차이≥2 축만
    final: Object.fromEntries(AX.map(a => [a, null])),
    ...Object.fromEntries(AX.map(a => [a, null])) // build-table이 읽는 칸(final과 동일 값)
  };
});
fs.writeFileSync(OUT, JSON.stringify({
  sheet: 'E2 공개 샘플 리포트 블라인드 채점', roster_version: roster.version, generatedAt: new Date().toISOString(),
  salt_sha256: saltSha, salt_revealed: prevDoc ? prevDoc.salt_revealed || null : null, // 채점 종료 후 salt hex를 여기에 적어 공개
  blind_id_rule: 'S- + sha256(salt|id|roster.version)[0:6]; salt 32B+ 난수, 총괄 보관, 채점 뒤 공개',
  redaction_items: ['서비스명·회사명(명부 name·provider)', '도메인·URL(명부 url·docs_url)', '로고·로고 대체텍스트', '고유 상품명·등록상표', '고객센터 연락처'],
  redaction_leak_check: '처리본에서 명부 41행의 name/provider/도메인 문자열 검색 → 0건이어야 redacted 상태로 넘어간다',
  aggregation: { scale: 'L1~L5 정수', diff_le_1: '낮은 값', diff_ge_2: '제3자가 judge1/judge2 값 중 하나를 근거와 함께 선택', forbidden: ['평균', '새 값'] },
  actor_isolation: 'judge1·judge2·judge3는 Q90 2회차 judge·adjudicator·X1~X4와 다른 actor. 겹치면 G16 (16) 격리 기록 필요',
  procedure: ['① 샘플 파일 내려받아 sha256 고정', '② redaction_items 가림 → 누출 검사 0건 → redacted_sha256', '③ judge1·judge2 독립 채점(rubric-v2 e2_judge_rubric_public, L1~L5, 이유 1문장, guess 칸)', '④ 축별 차이≥2 → judge3 선택', '⑤ final = 집계 규칙 적용 · 표에는 (샘플) 꼬리표', '⑥ 채점 종료 후 salt 공개(salt_revealed)'],
  judges: { judge1: null, judge2: null, judge3: null }, // 채점 세션 식별자(사람 이름 아님)
  rows
}, null, 1));
console.log('rows', rows.length, 'ready', rows.filter(r => r.status === 'ready').length, 'no_sample', rows.filter(r => r.status === 'no_sample').length, 'blind_id', salt ? 'set' : 'EMPTY(salt 없음 — 채점 시작 불가)', '→', OUT);
