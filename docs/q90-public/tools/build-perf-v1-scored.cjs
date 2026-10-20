'use strict';
// Usage: node build-perf-v1-scored.cjs [outDir=runs/latest]
// 성능표 1판 100점 환산판(내부판, 대표 결정 2026-10-20 "총점 100점 만점").
//  - 입력 = e2-samples.json 확정 레벨(final, L1~L5) 그대로. 레벨은 바꾸지 않고 환산만 한다.
//  - 주 점수(균등): 축당 20점, 축 점수 = (L-1) × 5 → L1 0 · L2 5 · L3 10 · L4 15 · L5 20, 5축 합 100.
//    결과를 본 뒤 정한 표시 규칙이므로 재량이 없는 균등 가중을 주 점수로 쓴다.
//  - 참고 점수(사전 가중): rubric v2.0(2026-10-12 결과 전 동결) public_weight A1 10·A2 20·A3 20·A4 20·A5 10 을 100으로 정규화.
//  - 타사 중간값 행 = 18건 축별 중간값과 총점 중간값(합계의 중간값, 축 중간값의 합 아님).
//  - 앵커(kind=anchor)는 표 행이 아님(검증 각주).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const B = path.resolve(__dirname, '..'); const OUT = path.resolve(B, process.argv[2] || 'runs/latest');
const J = p => JSON.parse(fs.readFileSync(path.join(B, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(B, p))).digest('hex');
const e2 = J('sheets/e2-samples.json'), roster = J('roster/roster-v2.json'), rubric = J('rubric/rubric-v2.json');
const AX = ['A1', 'A2', 'A3', 'A4', 'A5'];
const ax = Object.fromEntries(rubric.axes.map(a => [a.id, a]));
const W = Object.fromEntries(AX.map(a => [a, ax[a].public_weight])); const Wsum = AX.reduce((s, a) => s + W[a], 0);
const done = r => AX.every(a => Number.isInteger(r[a]));
const pt = L => (L - 1) * 5;
const total = r => AX.reduce((s, a) => s + pt(r[a]), 0);
const wtotal = r => Math.round(AX.reduce((s, a) => s + (r[a] - 1) / 4 * W[a] * 100 / Wsum, 0) * 10) / 10;
const median = arr => { const s = [...arr].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const ro = id => roster.rows.find(x => x.id === id) || {};
const third = r => Object.entries((r.final || {}).axes || {}).filter(([, v]) => /third/.test(v.rule)).map(([k]) => k);
const comp = e2.rows.filter(r => !r.kind && done(r));
// 대표 결정 2026-10-21: 자사 행 = 실제 고객 리포트(OWN-R2·OWN-P2). 가상 인물 리포트(OWN-R·OWN-P)는 이력·검증용으로만 남김.
const OWN_IDS = ['OWN-R2', 'OWN-P2'];
const own = OWN_IDS.map(id => e2.rows.find(r => r.id === id)).filter(r => r && done(r));
if (own.length < OWN_IDS.length) { console.error('자사 실제 리포트 확정 전 — 표 생성 보류:', OWN_IDS.filter(id => !own.find(r => r.id === id)).join(',')); process.exit(2); }
const ownName = { 'OWN-R2': '인생포트폴리오 리포트', 'OWN-P2': '인생포트폴리오 자산화 맞춤 실행 프로그램' };
const rows = [...own.map(r => ({ r, own: true })), ...comp.map(r => ({ r, own: false }))]
  .map(o => ({ ...o, id: o.r.id, name: o.own ? ownName[o.r.id] : (ro(o.r.id).name || o.r.name), country: o.own ? 'KR' : ro(o.r.id).country, L: Object.fromEntries(AX.map(a => [a, o.r[a]])), P: Object.fromEntries(AX.map(a => [a, pt(o.r[a])])), total: total(o.r), wtotal: wtotal(o.r), third: third(o.r), url: o.r.sample_url || null, sha: o.r.sample_sha256 || null }))
  .sort((a, b) => b.total - a.total || (a.own === b.own ? 0 : a.own ? 1 : -1)); // 동점이면 자사를 뒤에(보수적), 참고 점수로 순서를 정하지 않음
const med = { P: Object.fromEntries(AX.map(a => [a, median(comp.map(r => pt(r[a])))])), total: median(comp.map(total)), wtotal: median(comp.map(wtotal)) };
const top = Object.fromEntries(AX.map(a => [a, Math.max(...comp.map(r => pt(r[a])))]));
const ac = e2.anchor_check_r11 ? { ...e2.anchor_check, ...e2.anchor_check_r11 } : (e2.anchor_check || {});
const nThird = rows.reduce((s, x) => s + x.third.length, 0);
const meta = { generated: new Date().toISOString().slice(0, 16) + 'Z', sheet_sha: sha('sheets/e2-samples.json'), rubric_sha: sha('rubric/rubric-v2.json'), rubric_version: rubric.version, rubric_frozen_at: rubric.frozen_at, n_comp: comp.length, n_own: own.length, anchor_sha: ac.expected_sha256, anchor_max_diff: ac.max_diff };
const anchorRule = 'L1 전혀 없음 · L2 흔적만 · L3 있으나 일반론/부분 · L4 구체적이고 응답과 연결 · L5 바로 쓸 수 있을 만큼 구체적이고 일관됨';
const Q = Object.fromEntries(AX.map(a => [a, (rubric.e2_judge_rubric_public.per_axis_question || {})[a]]));
fs.writeFileSync(path.join(OUT, 'perf-v1-scored.json'), JSON.stringify({ meta, scoring: { main: '(L-1)×5 per axis, 5 axes, 100', ref: 'rubric v2.0 public_weight normalized to 100', weights: W }, median: med, rows: rows.map(({ r, ...x }) => x) }, null, 1));

// ---------- HTML ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bar = (v, max, own) => `<div class="bar"><i style="width:${v / max * 100}%" class="${own ? 'o' : ''}"></i><b>${v}</b></div>`;
const cell = (v, a, own) => `<td class="c ${v === 20 ? 'top' : ''}" data-v="${v}">${bar(v, 20, own)}</td>`;
let tr = '';
for (const x of rows) tr += `<tr class="${x.own ? 'own' : ''}"><td class="nm">${x.own ? '<span class="tag">자사</span>' : `<span class="cc">${x.country === 'KR' ? '국내' : '해외'}</span>`}${esc(x.name)}${x.third.length ? `<sup title="두 심사위원 차이 2단계 이상 → 제3 심사위원이 선택">†${x.third.join('·')}</sup>` : ''}</td><td class="t" data-v="${x.total}"><strong>${x.total}</strong></td>${AX.map(a => cell(x.P[a], a, x.own)).join('')}<td class="w" data-v="${x.wtotal}">${x.wtotal}</td></tr>`;
tr += `<tr class="med"><td class="nm">타사 ${comp.length}곳 중간값</td><td class="t" data-v="${med.total}"><strong>${med.total}</strong></td>${AX.map(a => `<td class="c" data-v="${med.P[a]}">${bar(med.P[a], 20)}</td>`).join('')}<td class="w" data-v="${med.wtotal}">${med.wtotal}</td></tr>`;
const axRows = AX.map(a => `<tr><td><b>${a}</b> ${esc(ax[a].name)}</td><td>${esc(Q[a])}</td><td>${esc(ax[a].customer_line)}</td><td class="r">20</td><td class="r">${W[a] * 100 / Wsum}</td></tr>`).join('');
const src = rows.filter(x => !x.own).map(x => `<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td class="u">${x.url ? `<a href="${esc(x.url)}">${esc(x.url.length > 70 ? x.url.slice(0, 70) + '…' : x.url)}</a>` : ''}</td><td class="m">${esc((x.sha || '').slice(0, 12))}</td><td>${AX.map(a => x.L[a]).join(' · ')}</td></tr>`).join('');
const ownRow = id => rows.find(x => x.id === id);
const R = ownRow('OWN-R2'), P = ownRow('OWN-P2');
const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>자기이해 리포트 성능표 1판 — 100점 환산 (내부판)</title>
<style>
body{font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;margin:0;background:#f6f7f9;color:#1d2330}
main{max-width:1180px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:19px;margin:36px 0 10px;border-left:4px solid #3b5bdb;padding-left:10px}
.sub{color:#5c6577;font-size:14px}.badge{display:inline-block;background:#fff3bf;color:#7a5b00;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700;margin-right:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:18px 0}
.card{background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px #0001}.card .k{font-size:12px;color:#5c6577}.card .v{font-size:26px;font-weight:800}.card .d{font-size:12px;color:#5c6577}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px #0001;font-size:13.5px}
th,td{padding:8px 10px;border-bottom:1px solid #edf0f4;text-align:left;vertical-align:middle}
th{background:#1d2330;color:#fff;font-weight:600;font-size:12.5px;cursor:pointer;white-space:nowrap}
.main th.s:after{content:' ↕';opacity:.5}
tr.own{background:#edf2ff}tr.own .nm{font-weight:800}tr.med{background:#f1f3f5;font-style:italic;border-top:2px solid #adb5bd}
.nm{min-width:260px}.tag{background:#3b5bdb;color:#fff;font-size:12px;border-radius:3px;padding:1px 6px;margin-right:6px;font-style:normal}
.cc{color:#868e96;font-size:12px;border:1px solid #ced4da;border-radius:3px;padding:0 4px;margin-right:6px}
sup{color:#e8590c;font-size:12px;margin-left:3px}
.t{font-size:17px;text-align:center;min-width:60px}.w{text-align:center;color:#5c6577}
.bar{position:relative;background:#f1f3f5;height:18px;border-radius:3px;min-width:84px}.bar i{position:absolute;left:0;top:0;bottom:0;background:#adb5bd;border-radius:3px}.bar i.o{background:#4c6ef5}.bar b{position:relative;font-size:12px;padding-left:6px;line-height:18px}
td.top .bar i{background:#2f9e44}td.top .bar i.o{background:#2b8a3e}
.box{background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px #0001;font-size:14px;line-height:1.7}
.box ol,.box ul{margin:6px 0;padding-left:20px}.r{text-align:right}.u{font-size:12px;word-break:break-all}.m{font-family:monospace;font-size:12px}
.note{font-size:12.5px;color:#5c6577;margin-top:8px;line-height:1.6}
code{background:#f1f3f5;padding:1px 4px;border-radius:3px;font-size:12px}
</style></head><body><main>
<span class="badge">내부판 · 외부 공개는 대표 승인 뒤</span><span class="badge" style="background:#e7f5ff;color:#1864ab">채점 루브릭 ${esc(rubric.version)} · ${esc(rubric.frozen_at)} 결과 전 동결</span>
<h1>자기이해·진로 리포트 성능표 1판 — 100점 환산</h1>
<div class="sub">타사 공개 샘플 리포트 ${comp.length}종 + 인생포트폴리오 실제 리포트 ${own.length}종 · 같은 루브릭 · 같은 블라인드 심사위원 · 생성 ${meta.generated}</div>
<div class="cards">
<div class="card"><div class="k">인생포트폴리오 리포트</div><div class="v">${R ? R.total : '-'}<span style="font-size:14px">/100</span></div><div class="d">타사 중간값 ${med.total} · 타사 최고 ${Math.max(...comp.map(total))}</div></div>
<div class="card"><div class="k">자산화 실행 프로그램 리포트</div><div class="v">${P ? P.total : '-'}<span style="font-size:14px">/100</span></div><div class="d">A4 자산화 ${P ? P.P.A4 : '-'}/20 (타사 최고 ${top.A4})</div></div>
<div class="card"><div class="k">비교 대상</div><div class="v">${comp.length}종</div><div class="d">해외 ${comp.filter(r => ro(r.id).country !== 'KR').length} · 국내 ${comp.filter(r => ro(r.id).country === 'KR').length} (공식 공개 샘플만)</div></div>
<div class="card"><div class="k">채점 검증(앵커)</div><div class="v">±${ac.max_diff ?? '-'}단계</div><div class="d">미리 봉인한 기대 점수와 최대 차이</div></div>
</div>

<h2>성능표 (총점 순 · 열 제목을 누르면 다시 정렬)</h2>
<table class="main" id="perf"><thead><tr><th class="s">서비스(리포트)</th><th class="s">총점<br>/100</th>${AX.map(a => `<th class="s">${a} ${esc(ax[a].name)}<br>/20</th>`).join('')}<th class="s">참고: 사전 가중<br>/100</th></tr></thead><tbody>${tr}</tbody></table>
<div class="note">초록 막대 = 그 축 만점(20). † = 두 심사위원 차이가 2단계 이상이라 제3 심사위원이 둘 중 하나를 고른 축(${nThird}칸). 총점이 같으면 자사를 타사 뒤에 둡니다(보수적). 중간값 행의 총점은 ${comp.length}곳 총점의 중간값입니다(축 중간값의 합이 아님).</div>

<h2>1. 무엇을 비교했나 — 축과 질문 (결과 전 동결)</h2>
<table><thead><tr><th>축</th><th>심사위원이 답한 질문(원문)</th><th>쉬운 말</th><th>주 점수 배점</th><th>참고 가중</th></tr></thead><tbody>${axRows}</tbody></table>
<div class="note">질문 원문은 루브릭 ${esc(rubric.version)}(${esc(rubric.frozen_at)} 동결, 대표 승인, 파일 sha256 <code>${meta.rubric_sha.slice(0, 16)}…</code>)에서 그대로 옮겼고, 채점 패킷의 RUBRIC.md와 같은 문장입니다. 레벨 기준: ${esc(anchorRule)}.<br><b>기준 보충 v2.1(2026-10-21, 모든 샘플 동일)</b>: A1의 "처음 1페이지" = 표지·목차·사용 안내를 뺀 <b>첫 결과 페이지</b>. 회사마다 표지·목차 구성이 달라 생기는 불공정을 없애기 위한 보충이며, 심사위원 해석이 갈렸던 사실이 확인된 뒤 정했습니다.</div>

<h2>2. 어떻게 채점했나 — 8단계 절차</h2>
<div class="box"><ol>
<li><b>샘플 수집</b> — 각 회사가 <u>공식 사이트에 직접 공개한</u> 샘플 리포트만 씁니다(제3자 사본 제외). 주소·수집 시각·파일 sha256을 기록합니다(부록 표).</li>
<li><b>자사 리포트</b> — 실제 서비스에서 실제 응답으로 만들어진 고객 리포트(리포트·실행 프로그램 각 1부, 2026-10-21 발행본)를 손대지 않은 그대로 썼습니다(파일 sha256 기록).</li>
<li><b>가림(블라인드)</b> — 회사명·서비스명·로고·주소·연락처·고객 이름을 가리고, 글자층이 없는 이미지 PDF로 바꾼 뒤 자동 누출 검사(0건)와 사람 눈 확인을 거칩니다. 파일 이름도 무작위 번호(S-xxxxxx)라 심사위원은 어느 회사인지 모릅니다. <b>우리 리포트도 똑같이</b> 가렸습니다.</li>
<li><b>독립 채점</b> — <u>20종 모두 똑같은 AI 심사위원 2명</u>(서로 다른 모델, 샘플마다 기억 없는 새 대화)이 각자 5축을 L1~L5로 매기고 축마다 이유 1문장을 씁니다. 패킷 밖 자료(검색 등)는 금지입니다.</li>
<li><b>합치기 규칙(평균 금지)</b> — 두 점수 차이가 1 이하면 <u>낮은 쪽</u>(보수적). 2 이상이면 제3 심사위원이 이유를 보고 둘 중 하나를 고릅니다. 새 값·평균은 만들지 않습니다.</li>
<li><b>채점 검증(앵커)</b> — 일부러 아주 좋은 리포트와 아주 나쁜 리포트를 만들어 섞고, 기대 점수를 미리 봉인(sha256 <code>${esc((ac.expected_sha256 || '').slice(0, 16))}…</code>)했습니다. 결과 최대 차이 ${ac.max_diff ?? '-'}단계 → 심사위원이 좋고 나쁨을 제대로 가린다는 확인입니다. 앵커는 표에 넣지 않습니다.</li>
<li><b>공개 문서 반영(A5, 모든 회사 동일)</b> — 신뢰 근거는 리포트 안의 문구와 <u>회사가 공식 공개한 문서</u>(기술 매뉴얼·연구 보고서·공개 성능표) 중 높은 쪽을 씁니다. 공개 문서에 신뢰도 계수나 규준 인원 수치가 있으면 L4, 검증 범위와 한계를 공식 문서에 명시했으면 L3. 근거 문서 주소는 공개 문서 시트에 기록돼 있습니다.</li>
<li><b>100점 환산</b> — 레벨은 그대로 두고 표시만 바꿉니다. 축 점수 = (레벨−1)×5 → L1 0 · L2 5 · L3 10 · L4 15 · L5 20, 5축 합 100점. 축마다 똑같이 20점(재량 없음).</li>
</ol></div>

<h2>3. 점수 계산 예시 (누구나 다시 계산 가능)</h2>
<div class="box">${R ? `인생포트폴리오 리포트 레벨 = ${AX.map(a => `${a} L${R.L[a]}`).join(' · ')}<br>→ ${AX.map(a => `(${R.L[a]}−1)×5=${R.P[a]}`).join(' + ')} = <b>${R.total}점</b>` : ''}<br>
참고 점수(사전 가중)는 루브릭 ${esc(rubric.version)}에 결과 전에 적어 둔 공개 가중(A1 ${W.A1} · A2 ${W.A2} · A3 ${W.A3} · A4 ${W.A4} · A5 ${W.A5})을 100으로 맞춘 값입니다. 우리에게 유리한 A4 가중이 크기 때문에 <u>주 점수로 쓰지 않고 참고로만</u> 보여 줍니다.</div>

<h2>4. 결과 한눈에</h2>
<div class="box"><ul>
${AX.map(a => `<li><b>${a} ${esc(ax[a].name)}</b> — 타사 중간값 ${med.P[a]}/20 · 타사 최고 ${top[a]}/20 · 인생포트폴리오 리포트 ${R ? R.P[a] : '-'}/20 · 실행 프로그램 ${P ? P.P[a] : '-'}/20</li>`).join('\n')}
</ul></div>

<h2>5. 공정성을 위해 밝혀 두는 한계</h2>
<div class="box"><ul>
<li><b>비교한 것은 "보여 줄 수 있는 결과지"입니다.</b> 타사는 각 회사가 공식 홈페이지에 직접 올린 대표 예시 리포트를, 인생포트폴리오는 실제 고객이 받는 리포트를 그대로 채점했습니다. 각 회사의 대표 예시는 가장 잘 보여 주고 싶은 모습일 수 있다는 점을 감안해 읽어 주세요.</li>
<li>성능표는 인생포트폴리오가 만들었습니다. 그래서 채점은 우리 리포트 작성에 관여하지 않은 별도 심사위원이 회사 이름을 가린 채 했고, 합치기·환산은 정해진 계산식이 하며 사람이 값을 고치지 않습니다. 자료와 계산식은 요청하시면 그대로 보여 드립니다.</li>
<li>모델명·유형명(예: 16유형)은 가리면 읽을 수 없어 남겼습니다. 심사위원이 회사를 짐작한 경우 기록만 하고 점수에 쓰지 않았습니다.</li>
<li>이 표는 리포트(결과지) 5축만 봅니다. 홈페이지 편의성(A6)·보안(A7)·비용은 포함하지 않았습니다.</li>
<li>100점 환산 방식은 결과를 본 뒤(2026-10-20 대표 결정) 정했습니다. 그래서 재량이 없는 균등 배점을 주 점수로 씁니다. 레벨 값 자체는 결과 전에 정한 규칙으로만 나왔습니다.</li>
<li>공식 샘플을 받을 수 없는 서비스(접속 불가·로그인·구매 필요)는 넣지 않았고, 0점으로 치지도 않았습니다(예: 고용24 7종은 접속 불가로 이번 판 제외).</li>
<li>채점 기준 보충(첫 결과 페이지)과 공개 문서 반영 규칙은 1차 채점 뒤 해석 차이가 확인되어 정했고, <b>20종 모두에 똑같이</b> 적용해 다시 채점했습니다. 검증용 리포트에서 심사위원 판정이 기대와 2단계 차이 난 칸이 있었다면 아래 카드에 표시됩니다.</li>
<li>최종 채점은 서로 다른 AI 모델 3개(같은 회사 계열)가 맡았습니다. 평가 기준과 규칙은 사람이 정하고 결과를 검토해 최종 승인했으며, 점수 자체는 사람이 고치지 않았습니다.</li>
<li>검증용으로 만든 낮은 품질 리포트의 첫인상을 심사위원이 기대보다 높게 본 칸이 있어, 첫인상 점수는 모든 회사가 조금 후하게 나왔을 수 있습니다(같은 조건이라 순위 영향 없음).</li>
<li>각 서비스명·상표는 해당 회사의 소유이며, 이 표는 각 회사가 공개한 예시 리포트만으로 만든 비교입니다.</li>
<li>AI 심사위원 채점이며, 사람 대상 효과 검증이 아닙니다. 점수는 "리포트가 루브릭 질문에 얼마나 답하는가"이지 검사의 과학적 타당도가 아닙니다.</li>
</ul></div>

<h2>부록. 타사 샘플 출처 (누구나 같은 파일을 받아 확인 가능)</h2>
<table><thead><tr><th>ID</th><th>서비스</th><th>공식 샘플 주소</th><th>sha256 앞 12자</th><th>확정 레벨 A1~A5</th></tr></thead><tbody>${src}</tbody></table>
<div class="note">자료: 시트 e2-samples.json sha256 <code>${meta.sheet_sha.slice(0, 16)}…</code> · 도구 build-perf-v1-scored.cjs · 레벨 원자료와 심사위원 답 원본은 내부 보관(요청 시 대조 가능).</div>
</main>
<script>
document.querySelectorAll('#perf th').forEach((th,i)=>th.onclick=()=>{const tb=document.querySelector('#perf tbody');const med=tb.querySelector('tr.med');const rs=[...tb.querySelectorAll('tr:not(.med)')];const d=th.dataset.d=th.dataset.d==='a'?'d':'a';rs.sort((x,y)=>{const a=x.children[i],b=y.children[i];const va=a.dataset.v,vb=b.dataset.v;const r=va!==undefined?(+va)-(+vb):a.innerText.localeCompare(b.innerText,'ko');return d==='a'?r:-r});rs.forEach(r=>tb.appendChild(r));tb.appendChild(med);});
</script></body></html>`;
fs.writeFileSync(path.join(OUT, 'perf-v1-scored.html'), html);

// ---------- MD ----------
let md = `# 성능표 1판 — 100점 환산 (내부판, 외부 공개는 대표 승인 뒤)\n\n생성 ${meta.generated} · 루브릭 ${rubric.version}(${rubric.frozen_at} 결과 전 동결, sha ${meta.rubric_sha.slice(0, 12)}…) · 시트 sha ${meta.sheet_sha.slice(0, 12)}… · 도구 build-perf-v1-scored.cjs\n\n`;
md += `환산: 축 점수 = (L−1)×5 (L1 0 · L2 5 · L3 10 · L4 15 · L5 20), 5축 합 100. 참고 = rubric 사전 가중(A1 ${W.A1}·A2 ${W.A2}·A3 ${W.A3}·A4 ${W.A4}·A5 ${W.A5}) 100 정규화. † = 제3 심사위원 선택 축.\n\n`;
md += `| 서비스 | 총점 | ${AX.map(a => `${a} ${ax[a].name}`).join(' | ')} | 참고(사전 가중) |\n|---|---|${AX.map(() => '---').join('|')}|---|\n`;
for (const x of rows) md += `| ${x.own ? '**[자사] ' + x.name + '**' : x.name}${x.third.length ? ' †' + x.third.join('·') : ''} | ${x.own ? '**' + x.total + '**' : x.total} | ${AX.map(a => x.P[a]).join(' | ')} | ${x.wtotal} |\n`;
md += `| *타사 ${comp.length}곳 중간값* | *${med.total}* | ${AX.map(a => '*' + med.P[a] + '*').join(' | ')} | *${med.wtotal}* |\n`;
md += `\n채점 절차·기준·한계·출처는 perf-v1-scored.html 1~5절과 부록 참조. 앵커 검증: 기대 봉인 sha ${(ac.expected_sha256 || '').slice(0, 12)}… → 최대 차이 ${ac.max_diff}단계.\n`;
fs.writeFileSync(path.join(OUT, 'perf-v1-scored.md'), md);
console.log('perf-v1-scored', 'rows', rows.length, 'comp', comp.length, 'own', own.length, '→', path.relative(B, OUT), '(점수는 파일에만)');
