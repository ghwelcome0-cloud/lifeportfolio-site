'use strict';
// Usage: node verify-run-meta.cjs <runDir> [expectedToolSha] [expectedRosterSha]   (G21 §24 수령 검사 1~3단계)
// 1 도구 sha 2 명부 부분집합 sha 3 run-meta 비공개 항목 유입(IP·호스트명·사용자 경로) 4 국가 코드 형식. 하나라도 실패 → exit 1.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [RUN, TOOL_SHA = 'c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b', ROSTER_SHA = 'ca0d23d5e9f3a0b0bf06a9376fb6c14f0e2e2514288df380bf37a5cc40f3657a'] = process.argv.slice(2);
if (!RUN) { console.error('usage: node verify-run-meta.cjs <runDir> [toolSha] [rosterSha]'); process.exit(2); }
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fails = [], notes = [];
const res = JSON.parse(fs.readFileSync(path.join(RUN, 'e1-results.json'), 'utf8'));
if (res.tool_sha256 !== TOOL_SHA) fails.push(`도구 sha 불일치: ${res.tool_sha256}`); else notes.push('도구 sha 일치');
const metaPath = path.join(RUN, 'run-meta.json');
if (!fs.existsSync(metaPath)) fails.push('run-meta.json 없음');
else {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (meta.roster_subset_sha256 && meta.roster_subset_sha256 !== ROSTER_SHA && meta.rows_requested !== 40) fails.push(`명부 부분집합 sha 불일치: ${meta.roster_subset_sha256}`); else notes.push('명부 sha 일치(또는 전체 40행)');
  if (!/^[A-Z]{2}$/.test(meta.egress_country || '')) fails.push(`egress_country 는 국가 코드 2글자여야 함: ${meta.egress_country}`);
  const txt = JSON.stringify(meta);
  if (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(txt)) fails.push('IP 주소 패턴 발견 — 공개 폴더 금지');
  if (/[A-Za-z0-9-]+\.(local|lan|home|corp)\b/i.test(txt) || /\b(DESKTOP|LAPTOP|MacBook|iMac)-?[A-Za-z0-9]*/i.test(txt)) fails.push('기계 이름 패턴 발견 — 공개 폴더 금지');
  if (/\/Users\/[^/"]+|C:\\\\Users\\\\[^\\"]+|\/home\/(?!user\b)[^/"]+/.test(txt)) fails.push('사용자 경로 패턴 발견 — 공개 폴더 금지');
  for (const k of ['bound_commit', 'browser', 'profile', 'started_utc', 'ended_utc', 'machine_kind']) if (!meta[k]) fails.push(`run-meta.${k} 비어 있음`);
  if (meta.bound_commit && meta.bound_commit !== '9557e46') notes.push(`bound_commit=${meta.bound_commit} (§24 는 9557e46)`);
}
// 결과·로그 파일에도 IP 유입 검사(측정기는 IP를 적지 않음 — 혹시 모를 유입 방지)
for (const f of ['measure.log', 'score.log']) { const p = path.join(RUN, f); if (fs.existsSync(p) && /\b\d{1,3}(\.\d{1,3}){3}\b/.test(fs.readFileSync(p, 'utf8'))) fails.push(`${f} 에 IP 패턴`); }
const ok = res.results.filter(r => !r.skip && r.mobile && r.mobile.ok).length;
notes.push(`행 ${res.results.length}, 성공 ${ok}`);
console.log(fails.length ? 'FAIL\n- ' + fails.join('\n- ') : 'PASS', '\n' + notes.map(n => '· ' + n).join('\n'));
process.exit(fails.length ? 1 : 0);
