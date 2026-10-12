'use strict';
// Usage: node build-packet.cjs <e2-samples.json> <rubric-v2.json> <packetsDir> <outDir> [roster-v2.json]
// E2 judge 패킷 생성기 (Peer 6037804 ②-b · Peer 6054792 ① ② ③ · TL 6054779 5조건).
// judge에게는 blind_id + 가린 샘플(이미지 PDF, 텍스트 레이어 없음) + 루브릭(공개판) + 답안 양식 + 규칙만 준다.
// 시트·명부·저장소 경로·회사명은 절대 넣지 않는다. 두 judge는 바이트가 같은 패킷을 받는다(내용 sha 기록).
// 출력: <outDir>/<blind_id>/ { sample.pdf, RUBRIC.md, ANSWER.json(빈 양식), README.md } + <outDir>/<blind_id>.tar.gz
//       (tar는 mtime 고정·정렬 → 바이트 동일 재현)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const [E2, RUBRIC, PK, OUT, ROSTER] = process.argv.slice(2);
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
- **분량(쪽수·글자 수) 자체는 점수 근거가 아닙니다.** 길어서 올리거나 짧아서 내리지 마세요. 축 질문에 답이 있는지만 봅니다.
- 리포트의 모델명·유형명(예: 4유형, 16유형, 34 테마)은 남아 있습니다. 어느 회사 것인지 짐작이 가더라도 점수에 반영하지 말고 guess 칸에만 적으세요.
- 축마다 L1~L5 정수 하나 + 이유 1문장. 숫자 없는 답은 무효입니다.
- 이 패킷 밖의 자료(웹 검색·이미지 검색·저장소·시트·다른 대화 기록·메모)를 보지 마세요. 봤다면 ANSWER.json의 outside_materials_used 에 적으세요.
`;
const readmeMd = bid => `# 채점 패킷 ${bid}

## 하는 일
1. sample.pdf 를 처음부터 끝까지 읽습니다. (이미지 PDF입니다 — 글자 검색이 안 되는 것이 정상입니다.)
2. RUBRIC.md 의 A1~A5 질문에 L1~L5 와 이유 1문장으로 답합니다.
3. ANSWER.json 을 채워 그대로 돌려줍니다(파일명 유지).

## 지켜야 할 규칙 (어기면 답안 무효)
- **첫 줄 자기선언**: 답장 첫 줄에 "나는 이 평가 대상의 다른 역할(작성·검수·채점·심판)에 관여한 적이 없다"를 적고 ANSWER.json의 declaration 에도 같은 문장을 넣습니다. 관여했다면 채점하지 말고 그 사실만 적어 돌려줍니다.
- **역추적 금지**: 웹 검색·이미지 검색·메시지 검색으로 이 샘플이 어느 회사 것인지 알아내려 하지 마세요.
- **기억·메모 금지**: 이전 대화나 저장된 메모를 꺼내 쓰지 마세요. 이 패킷만으로 답합니다.
- **독립**: 다른 채점자와 상의하지 마세요. 다른 채점자가 누구인지 묻지 마세요.
- 이 패킷에는 회사명이 없습니다. 찾으려 하지 마세요. 짐작이 들면 guess 칸에만 적습니다.
- ANSWER.json 의 judge_actor_id 에 본인 actor id, scored_at_utc 에 채점 끝낸 UTC 시각을 적습니다.
- ANSWER.json 의 pages_total 에 PDF 전체 쪽 수, pages_viewed 에 **실제로 읽은 쪽 수**, 읽히지 않은 쪽이 있으면 unreadable_pages 에 쪽 번호를 적습니다. 다 읽지 못했으면 솔직히 적습니다 — 점수에 불이익은 없고, 표에 따로 표시만 됩니다.
- competitor_research_done_before (**세 채점자 공통**, Method 6063269): 업무로 진로·성격 검사 서비스(어느 회사든)를 조사·열람·비교한 적이 있으면 true 와 한 줄 설명, 없으면 false. 솔직한 답이 중요하며 점수·판정 방식은 바뀌지 않습니다.
`;
const answer = bid => ({
  blind_id: bid, judge_actor_id: null, scored_at_utc: null, declaration: '',
  A1: { level: null, reason: '' }, A2: { level: null, reason: '' }, A3: { level: null, reason: '' }, A4: { level: null, reason: '' }, A5: { level: null, reason: '' },
  guess: { thinks_knows: null, note: '' }, outside_materials_used: null, time_spent_min: null,
  // Peer 6057976 ③: 긴 이미지 PDF는 앞부분만 읽힐 수 있다 → 실제로 본 쪽 수와 못 읽은 쪽을 적게 한다. 다 읽지 않은 채점은 표에서 따로 표시.
  pages_total: null, pages_viewed: null, unreadable_pages: [],
  // Method 6057992·6063269: 세 채점자 공통 — 업무로 경쟁 서비스를 조사·열람한 적이 있으면 적는다(해당되면 G21 공개)
  competitor_research_done_before: null,
});
// 패킷 문서 누출 검사 (Peer ③): RUBRIC/README/ANSWER에 명부 이름·자사명이 들어가면 중단
const banned = ['인생포트폴리오', 'lifeportfolio', 'q90', 'roster', 'e2-samples', 'docs/q90-public'];
if (ROSTER && fs.existsSync(ROSTER)) {
  const ro = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  for (const r of (ro.rows || [])) {
    for (const k of ['name', 'provider', 'domain']) if (r[k] && String(r[k]).length >= 3) banned.push(String(r[k]).toLowerCase());
    // Peer 6063344 조건 2: roster v2에는 domain 키가 없고 url·docs_url만 있음 → 호스트를 뽑아 넣는다
    for (const k of ['url', 'docs_url']) { const m = /^https?:\/\/([^/]+)/.exec(r[k] || ''); if (m) { const h = m[1].toLowerCase().replace(/^www\./, ''); banned.push(h); const root = h.split('.')[0]; if (root.length >= 5) banned.push(root); } }
  }
}
const leakCheck = (label, txt) => {
  const low = txt.toLowerCase(); const hits = [...new Set(banned.filter(b => low.includes(b)))];
  if (hits.length) { console.error(`LEAK in ${label}:`, hits); process.exit(2); }
};
leakCheck('RUBRIC.md', rubricMd);
let n = 0; const order = [];
for (const r of e2.rows) {
  // Peer 6063344 조건 1: 시각 확인을 거치지 않은 행은 패킷이 되면 안 된다(⑩은 자동 2겹이 놓친 것을 시각 확인이 잡은 사례)
  if (!(r.status === 'redacted' && r.redaction && r.redaction.visual_check && r.redaction.visual_check.passed === true)) continue;
  const finalName = (r.redaction && r.redaction.final_file) || `${r.blind_id}.img.pdf`;
  const src = path.join(PK, finalName); if (!fs.existsSync(src)) { console.error('missing', src); continue; }
  if (!finalName.endsWith('.img.pdf')) { console.error('not image-pdf (Peer 6054792 ① 차단급):', finalName); continue; }
  const hs = r.redaction && r.redaction.hidden_structure;
  if (!hs || hs.text_layer_bytes > 0 || (hs.fonts && hs.fonts.length) || hs.annots || hs.links || hs.toc || hs.embedded_files) { console.error('hidden structure not clean:', r.blind_id, hs); continue; }
  const rd = readmeMd(r.blind_id); leakCheck(`README.md(${r.blind_id})`, rd);
  const an = JSON.stringify(answer(r.blind_id), null, 1); leakCheck(`ANSWER.json(${r.blind_id})`, an);
  const d = path.join(OUT, r.blind_id); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(src, path.join(d, 'sample.pdf'));
  fs.writeFileSync(path.join(d, 'RUBRIC.md'), rubricMd);
  fs.writeFileSync(path.join(d, 'ANSWER.json'), an);
  fs.writeFileSync(path.join(d, 'README.md'), rd);
  // 재현 가능한 tar: mtime 고정, 소유자 0, 이름 정렬 → 두 judge에게 바이트 동일 파일
  execFileSync('tar', ['--sort=name', '--mtime=2026-01-01 00:00Z', '--owner=0', '--group=0', '--numeric-owner', '-cf', path.join(OUT, `${r.blind_id}.tar`), '-C', OUT, r.blind_id]);
  execFileSync('gzip', ['-nf', path.join(OUT, `${r.blind_id}.tar`)]);
  const psha = sha(fs.readFileSync(path.join(OUT, `${r.blind_id}.tar.gz`)));
  r.packet_sha256 = psha;
  r.packet_files = { 'sample.pdf': sha(fs.readFileSync(src)), 'RUBRIC.md': sha(Buffer.from(rubricMd)), 'README.md': sha(Buffer.from(rd)), 'ANSWER.json': sha(Buffer.from(an)) };
  r.packet_format = 'image-pdf + md + json; tar --sort=name --mtime fixed; gzip -n (byte-reproducible)';
  order.push(r.blind_id); n++; console.log(r.blind_id, 'packet', psha.slice(0, 16));
}
// judge에게 보낼 순서: blind_id 사전순(명부 순서 노출 방지)
e2.packet_order = order.sort();
fs.writeFileSync(E2, JSON.stringify(e2, null, 1));
console.log('packets', n, '→', OUT, '| 전달 순서(blind_id 사전순):', e2.packet_order.join(' '));
