'use strict';
// Usage: node build-packet.cjs <e2-samples.json> <rubric-v2.json> <packetsDir> <outDir>
// E2 judge 패킷 생성기 (Peer 6037804 ②-b): judge에게는 blind_id + 가린 샘플 PDF + 루브릭(공개판) + 답안 양식만 준다.
// 시트·명부·저장소 경로·회사명은 절대 넣지 않는다. 패킷 sha256을 시트 행에 기록한다.
// 출력: <outDir>/<blind_id>/  { sample.pdf, RUBRIC.md, ANSWER.json(빈 양식), README.md } + <outDir>/<blind_id>.tar.gz
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const [E2, RUBRIC, PK, OUT] = process.argv.slice(2);
const e2 = JSON.parse(fs.readFileSync(E2, 'utf8')), rb = JSON.parse(fs.readFileSync(RUBRIC, 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const q = rb.e2_judge_rubric_public;
const rubricMd = `# E2 블라인드 채점 루브릭 (공개판)

입력: ${q.input}
척도: ${q.scale}

| 축 | 질문 |
|---|---|
${Object.entries(q.per_axis_question).filter(([a]) => a !== 'A6').map(([a, t]) => `| ${a} | ${t} |`).join('\n')}

레벨 앵커: L1 전혀 아님 · L2 흔적만 · L3 있으나 일반론/부분 · L4 구체적이고 응답과 연결 · L5 즉시 쓸 수 있을 만큼 구체적이고 일관됨

주의
- 샘플은 회사가 공개한 "최상 예시"입니다. 가림 처리(회색/검은 상자, 표지 제거, 이미지 제거)는 채점 대상이 아닙니다 — 가려진 곳 때문에 점수를 깎지 마세요.
- 리포트의 모델명·유형명(예: 4유형, 16유형, 34 테마)은 남아 있습니다. 어느 회사 것인지 짐작이 가더라도 점수에 반영하지 말고 guess 칸에만 적으세요.
- 축마다 이유 1문장. 숫자 없는 답은 무효입니다.
- 이 패킷 밖의 자료(저장소, 시트, 검색)를 보지 마세요. 봤다면 ANSWER.json의 outside_materials_used 에 적으세요.
`;
const answer = bid => ({ blind_id: bid, judge_session: null, A1: { level: null, reason: '' }, A2: { level: null, reason: '' }, A3: { level: null, reason: '' }, A4: { level: null, reason: '' }, A5: { level: null, reason: '' }, guess: { thinks_knows: null, note: '' }, outside_materials_used: null, time_spent_min: null });
let n = 0;
for (const r of e2.rows) {
  if (!['redacted', 'redacted_pending_visual'].includes(r.status)) continue;
  const src = path.join(PK, `${r.blind_id}.pdf`); if (!fs.existsSync(src)) { console.error('missing', src); continue; }
  const d = path.join(OUT, r.blind_id); fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(src, path.join(d, 'sample.pdf'));
  fs.writeFileSync(path.join(d, 'RUBRIC.md'), rubricMd);
  fs.writeFileSync(path.join(d, 'ANSWER.json'), JSON.stringify(answer(r.blind_id), null, 1));
  fs.writeFileSync(path.join(d, 'README.md'), `# 채점 패킷 ${r.blind_id}\n\n1. sample.pdf 를 처음부터 끝까지 읽습니다.\n2. RUBRIC.md 의 A1~A5 질문에 L1~L5 와 이유 1문장으로 답합니다.\n3. ANSWER.json 을 채워 그대로 돌려줍니다(파일명 유지).\n\n이 패킷에는 회사명이 없습니다. 찾으려 하지 마세요.\n`);
  execFileSync('tar', ['-czf', path.join(OUT, `${r.blind_id}.tar.gz`), '-C', OUT, r.blind_id]);
  const psha = sha(fs.readFileSync(path.join(OUT, `${r.blind_id}.tar.gz`)));
  r.packet_sha256 = psha; r.packet_files = { 'sample.pdf': sha(fs.readFileSync(src)), 'RUBRIC.md': sha(Buffer.from(rubricMd)) };
  n++; console.log(r.blind_id, 'packet', psha.slice(0, 16));
}
fs.writeFileSync(E2, JSON.stringify(e2, null, 1));
console.log('packets', n, '→', OUT, '| 주의: tar.gz는 생성 시각이 들어가 sha가 매번 다름 → packet_files의 내용 sha가 기준');
