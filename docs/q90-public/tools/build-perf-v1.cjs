'use strict';
// Usage: node build-perf-v1.cjs [outDir=runs/latest]
// 성능표 1판(내부판, op:q90-auto-210 C) — E2 블라인드 확정값(final) A1~A5만 모은 "같은 자·같은 judge" 비교표.
//  - 대상: 비교 행(kind 없음) 중 final 있음 + 자사 E2 트랙(kind=own). 앵커(kind=anchor)는 표에서 빼고 검증 결과만 각주.
//  - 순위 없음(명부 순), 합계·가중 점수 계산 안 함(rubric 원칙: 점수 합산 공개 없음). 미측정 ≠ 0.
//  - A2·A3·A4 = ★핵심축(public_weight 20). 값은 시트 그대로(평균·새 값 금지).
//  - (샘플)=회사가 고른 공개 예시, (자사)=가상 응답 1회로 오프라인 생성한 최신판 — 측정 경로가 달라 같은 열이라도 해석 주의.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const B = path.resolve(__dirname, '..'); const OUT = path.resolve(B, process.argv[2] || 'runs/latest');
const J = p => JSON.parse(fs.readFileSync(path.join(B, p), 'utf8'));
const e2 = J('sheets/e2-samples.json'), roster = J('roster/roster-v2.json'), rubric = J('rubric/rubric-v2.json');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(B, p))).digest('hex');
const AX = ['A1', 'A2', 'A3', 'A4', 'A5'];
const axName = Object.fromEntries(rubric.axes.map(a => [a.id, a.name]));
const done = r => AX.every(a => Number.isInteger(r[a]));
const order = Object.fromEntries(roster.rows.map((r, i) => [r.id, i]));
const comp = e2.rows.filter(r => !r.kind && done(r)).sort((a, b) => (order[a.id] ?? 999) - (order[b.id] ?? 999));
const own = e2.rows.filter(r => r.kind === 'own' && done(r));
const pending = e2.rows.filter(r => !r.kind && ['redacted', 'judged'].includes(r.status) && !done(r)).map(r => r.id);
const nm = id => (roster.rows.find(x => x.id === id) || {}).name || id;
const cnt = (rows, a, lv) => rows.filter(r => r[a] >= lv).length;
const median = arr => { const s = [...arr].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
let md = `# 성능표 1판 (내부판 — 외부 공개는 대표 승인 뒤)\n\n`;
md += `생성 ${new Date().toISOString().slice(0, 16)}Z · 도구 build-perf-v1.cjs · 시트 e2-samples.json sha ${sha('sheets/e2-samples.json').slice(0, 12)}… · rubric ${rubric.version}\n\n`;
md += `**읽는 법** — 같은 루브릭(A1~A5, L1~L5)·같은 블라인드 judge 2인(+차이≥2는 제3자) 확정값만 실었습니다. 순위·합계 없음(명부 순). 미측정 ≠ 0. ★ = 핵심 축(공개 가중 20).\n`;
md += `- 타사 = 회사가 공개한 **최상 예시 샘플**(회사가 고른 것). 자사 = 가상 인물 1명의 **실제 응답 1회**로 최신 출시판 엔진에서 오프라인 생성(운영 데이터·쓰기 0). 측정 경로가 달라 같은 열이라도 1:1 우열 비교는 주의.\n`;
md += `- 이해상충 각주: 자사 샘플 생성 절차는 총괄이 운영. 답은 타사 응시와 같은 페르소나·같은 응시 AI가 냈고 총괄은 수정하지 않음(answers sha ${String(e2.own_e2_track && e2.own_e2_track.respondent && e2.own_e2_track.respondent.answers_sha256).slice(0, 12)}…).\n`;
md += `- 분모: 비교 샘플 확정 ${comp.length}건 / 확보 대상 ${e2.rows.filter(r => !r.kind && !['not_applicable'].includes(r.status) && !(r.closure && r.closure.state === '종결')).length}건(종결·해당 없음 제외)${pending.length ? ` · 채점 진행 중 ${pending.join('·')}` : ''}.\n\n`;
md += `| ID | 도구 | ${AX.map(a => `${a}${['A2', 'A3', 'A4'].includes(a) ? '★' : ''} ${axName[a]}`).join(' | ')} |\n|---|---|${AX.map(() => '---').join('|')}|\n`;
for (const r of own) md += `| **${r.id}** | **${r.name}** (자사 최신판) | ${AX.map(a => `**${r[a]}**`).join(' | ')} |\n`;
for (const r of comp) md += `| ${r.id} | ${nm(r.id)} (샘플) | ${AX.map(a => r[a]).join(' | ')} |\n`;
md += `\n## 축별 요약 (타사 샘플 ${comp.length}건 분포 vs 자사)\n\n| 축 | 타사 중앙값 | 타사 L4 이상 | 자사 리포트 | 자사 실행 프로그램 |\n|---|---|---|---|---|\n`;
const oR = own.find(r => r.id === 'OWN-R'), oP = own.find(r => r.id === 'OWN-P');
for (const a of AX) md += `| ${a} ${axName[a]} | ${median(comp.map(r => r[a]))} | ${cnt(comp, a, 4)}/${comp.length} | ${oR ? oR[a] : '미측정'} | ${oP ? oP[a] : '미측정'} |\n`;
const ac = e2.anchor_check;
md += `\n## 채점 신뢰 확인(앵커)\n${ac ? `- 가상 앵커 2부(상·하) 기대 수준을 발송 전 봉인(sha ${ac.expected_sha256.slice(0, 12)}…) → 확정값과 최대 차이 **${ac.max_diff}단계** → ${ac.verdict}. 앵커는 표 행이 아님.` : '- 앵커 결과 없음'}\n`;
md += `\n## 한계\n- E2 샘플은 회사가 고른 최상 예시라 실제 고객이 받는 리포트보다 좋게 보일 수 있음. 자사도 가상 응답 1회 기준.\n- 모델명·유형명은 가리지 않음(가리면 읽을 수 없음) → judge가 계열을 짐작할 수 있음(guess 칸 기록, 점수 미반영).\n- 고용24 7행은 공식 결과예시 존재 확인, 원문 전체 확보 전(국내 출구 필요) — 2판에서 추가.\n- A6(모바일)·A7(보안)·A8(비용)·E1/E3 열은 공개 비교표 v2(table-v2.md)에 있음. 이 표는 E2 리포트 품질 축만.\n`;
fs.writeFileSync(path.join(OUT, 'perf-v1-internal.md'), md);
fs.writeFileSync(path.join(OUT, 'perf-v1-internal.json'), JSON.stringify({ generated: new Date().toISOString(), own: own.map(r => ({ id: r.id, ...Object.fromEntries(AX.map(a => [a, r[a]])) })), comparison: comp.map(r => ({ id: r.id, name: nm(r.id), ...Object.fromEntries(AX.map(a => [a, r[a]])) })), pending, anchor_check: ac || null }, null, 1));
console.log('perf-v1', 'own', own.length, 'comparison', comp.length, 'pending', pending.join(',') || '-', '→', path.relative(B, OUT));
