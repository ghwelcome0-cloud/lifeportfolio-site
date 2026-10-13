'use strict';
// Usage: node build-table.cjs <roster.json> <rubric.json> <runDir> [e3.json] [e2.json] [own.json] → <runDir>/table-v2.md + table-v2.html + table-v2.json
// 공개 비교표 v2 빌더 — 프로필형(순위 열 없음), 셀마다 근거 등급, 미측정 ≠ 0.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [ROSTER, RUBRIC, RUN, E3, E2, OWN] = process.argv.slice(2);
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8')), rubric = JSON.parse(fs.readFileSync(RUBRIC, 'utf8'));
const e1raw = fs.existsSync(path.join(RUN, 'e1-results.json')) ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(RUN, 'e1-results.json'), 'utf8')).results.map(r => [r.row, r])) : {};
const e1 = fs.existsSync(path.join(RUN, 'e1-scored.json')) ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(RUN, 'e1-scored.json'), 'utf8')).map(r => [r.row, r])) : {};
const e3 = E3 && fs.existsSync(E3) ? Object.fromEntries(JSON.parse(fs.readFileSync(E3, 'utf8')).rows.map(r => [r.id, r])) : {};
const e2 = E2 && fs.existsSync(E2) ? Object.fromEntries(JSON.parse(fs.readFileSync(E2, 'utf8')).rows.map(r => [r.id, r])) : {};
const own = OWN && fs.existsSync(OWN) ? JSON.parse(fs.readFileSync(OWN, 'utf8')) : null;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const NM = '미측정';
// E3 시트 값은 {value, source_url, ...} 묶음. source_url 없는 value는 표에 올리지 않는다(시트 규칙).
const NA = '해당 없음';
// E3 셀: {value,source_url,note}. value null + note '해당 없음' + 근거 URL → '해당 없음'(미측정과 구분, E3 rule 3차-b)
const v3 = x => x == null ? null : (typeof x === 'object' && 'value' in x) ? (x.value != null && x.source_url ? x.value : (x.source_url && /^해당 없음/.test(x.note || '') ? NA : null)) : x;
// G21 §26: E2 대안 경로 꼬리표 — (샘플)=회사 공개 샘플 · (문서도판)=공식 문서 안 리포트 도판 · (응시)/(구매)=실제 1인 결과. 같은 열이라도 직접 비교 금지.
const e2tag = s => { const p = s && s.e2_alt && s.e2_alt.path || ''; if (p.includes('문서도판')) { const m = /부분 (\d+\/\d+)/.exec((s.redaction && s.redaction.visual_check && s.redaction.visual_check.note) || ''); return m ? `(문서도판·부분 ${m[1]})` : '(문서도판)'; } if (p.includes('AI응시')) return '(응시)'; if (p.includes('구매')) return '(구매)'; return '(샘플)'; };
const cell = (v, grade, mark = '', tag = '(샘플)') => v == null ? NM : grade === 'E1' ? `**${v}**` : grade === 'E2' ? `${v}${mark} ${tag}` : grade === 'E3' ? `${v} (문서)` : String(v);
// ‡ = judge 간 차이≥2 → 제3자 선택 축(시트 final.third_used). 각주는 표 아래.
const third = (s, ax) => (s.final && Array.isArray(s.final.third_used) && s.final.third_used.includes(ax)) ? '‡' : '';
let thirdCells = [];
// G21 §24: 조립 run(assemble-latest.cjs)이면 E1 칸에 run·출구 국가 태그(예: r4·KR), r3 해외 시간초과 후 r4 측정 행은 각주
const rtag = x => x.run_tag ? ` <sub>${x.run_tag}</sub>` : '';
let priorFail = [];
const rows = roster.rows.filter(r => !r.retired).map(r => {
  const x = e1[r.id] || {}, d0 = e3[r.id] || {}, s = e2[r.id] || {};
  const d = Object.fromEntries(Object.entries(d0).map(([k, v]) => [k, k === 'E4' ? (v && v.value) || null : v3(v)]));
  const a6 = x.a6partial ? `${x.a6partial.points}/${x.a6partial.max}` : null;
  const o = r.own && own ? own : null; // OWN: Q90 scorer transcription only
  const ax = {
    A1: o ? cell(o.A1, 'E1') : s.A1 != null ? cell(s.A1, 'E2', third(s, 'A1'), e2tag(s)) : NM,
    A2: o ? cell(o.A2, 'E1') : s.A2 != null ? cell(s.A2, 'E2', third(s, 'A2'), e2tag(s)) : NM,
    A3: o ? cell(o.A3, 'E1') : s.A3 != null ? cell(s.A3, 'E2', third(s, 'A3'), e2tag(s)) : NM,
    A4: o ? cell(o.A4, 'E1') : s.A4 != null ? cell(s.A4, 'E2', third(s, 'A4'), e2tag(s)) : NM,
    A5: o ? cell(o.A5, 'E1') : (d.A5 != null ? cell(d.A5, 'E3') : (s.A5 != null ? cell(s.A5, 'E2', third(s, 'A5'), e2tag(s)) : NM)),
    A6: o ? cell(o.A6, 'E1') : (a6 ? cell(a6 + ' (3/6지표)', 'E1') + rtag(x) : (x.failure_class ? `미측정(${x.failure_class})` : (x.a6err && /측정 무효/.test(x.a6err) ? x.a6err : (x.partial === 'A7만' ? (/측정 무효/.test(x.partial_why || '') ? x.partial_why : `미측정(${x.partial_why})`) + rtag(x) : NM)))),
    A7: o ? cell(o.A7grade, 'E1') : (x.a7grade ? cell(x.a7grade, 'E1') + rtag(x) + (e1raw[r.id] && e1raw[r.id].carried_from_round1 ? ' (1판 값 이월 2026-10-09)' : '') : (x.failure_class ? `미측정(${x.failure_class})` : (x.a7err && /측정 무효/.test(x.a7err) ? x.a7err : NM))),
    A8: d.A8 != null ? cell(d.A8, 'E3') : NM
  };
  for (const ax of ['A1','A2','A3','A4','A5']) if (third(s, ax)) thirdCells.push(`${r.id} ${ax}=L${s[ax]}`);
  if (x.prior_failure_note) priorFail.push(`${r.id}: ${x.prior_failure_note}`);
  return { id: r.id, name: r.name, group: r.group, country: r.country, own: !!r.own, appeal: d.appeal || r.appeal || '', limits: d.limits || r.limits || '', price_band: d.price_band || (r.price_krw_band === 0 ? '무료' : null) || NM, time_min: d.time_min != null ? d.time_min : (r.time_min || null), docs_url: d.docs_url || null, ...ax, e4: d.E4 || null };
});
const h = ['ID', '도구', '구분', '이럴 때 이 도구', 'A1', 'A2 ★', 'A3 ★', 'A4 ★', 'A5', 'A6', 'A7(등급)', 'A8', '비용 구간', '소요(분)', '한계(공개 문서 기준)'];
const e1full = Object.values(e1).filter(v => !v.own && v.a61 && v.a71).length; const e1n = Object.values(e1).filter(v => !v.own && (v.a61 || v.a71)).length, nonOwn = roster.rows.filter(r => !r.retired && !r.own).length;
let md = `# 공개 비교표 v2 — ${path.basename(RUN)}\n\n자: rubric ${rubric.version} (sha256 ${sha(RUBRIC).slice(0, 16)}…) · 명부 ${roster.version} (sha256 ${sha(ROSTER).slice(0, 16)}…) · 생성 ${new Date().toISOString()}\n\n`;
md += `E1 실측 분모: ${e1n}/${nonOwn}행(전체 ${e1full} + 부분 ${e1n - e1full}; 최종 응답 2xx만 성공으로 셈, 비-2xx 축은 "측정 무효(HTTP 코드)") (나머지 행은 E1 미측정). **자사(OWN) 행은 Q90 scorer 전사, 비교 대상은 E2 블라인드 judge — 측정 방식이 다르므로 같은 열이라도 직접 비교 금지.**\n\n`;
md += `표기: **굵게**=E1 실측 · (샘플)=E2 공개 샘플 리포트(회사가 고른 최상 예시) · (문서도판)=회사 공식 문서 안에 실린 리포트 도판(쪽수 적음, 부분 n/m=판독 가능 쪽) — **(샘플)과 (문서도판)은 같은 열이라도 직접 비교 금지** · (문서)=E3 공개 문서 · 미측정=근거 없음(0점 아님) · 비용 구간 "비공개"=회사가 가격을 공개하지 않음(공식 출처 확인, 점수 아님) · "해당 없음"=제품 유형상 그 칸이 성립하지 않음(근거 URL 있음) · ★=고정 축(A2·A3·A4). 순위 없음, 명부 ID 순.\n\n`;
const asm = fs.existsSync(path.join(RUN, 'assembly.json')) ? JSON.parse(fs.readFileSync(path.join(RUN, 'assembly.json'), 'utf8')) : null;
if (asm) md += `E1 조립(G21 §24): 행마다 성공적으로 측정한 가장 최근 run 값 — 입력 ${asm.inputs.map(i => `${i.run}·${i.egress_country}(${i.rows}행)`).join(', ')} · 도구 sha ${String(asm.tool_sha256).slice(0, 12)}… · E1 칸의 \`rN·CC\` = 측정 run 번호·출구 국가 · 미측정(시간 초과/접근 차단/대상 없음/기타 오류)=실패 분류, 0점 아님 · 미측정(시간 초과)인 고용24 행은 국내 접속에서도 시간 초과.\n\n`;
md += '| ' + h.join(' | ') + ' |\n|' + h.map(() => '---').join('|') + '|\n';
for (const r of rows) md += `| ${r.id} | ${r.own ? '**' + r.name + '** (자사)' : r.name} | ${r.group} | ${r.appeal || '_(채움 예정)_'} | ${r.A1} | ${r.A2} | ${r.A3} | ${r.A4} | ${r.A5} | ${r.A6} | ${r.A7} | ${r.A8} | ${r.price_band} | ${r.time_min ?? '—'} | ${r.limits || '_(채움 예정)_'} |\n`;
if (thirdCells.length) md += `\n‡ judge 2인 차이≥2 → 제3자가 두 답 중 하나를 고른 칸(${thirdCells.length}칸: ${thirdCells.join(' · ')}). 제3자와 judge1은 같은 모델(Claude Opus 5.5, 자기신고·대표 선택). ${thirdCells.length}칸 모두 judge1 답 선택 = 모두 낮은 쪽 값 선택(사실만, 검정 불가, 결과 보고 판정 안 바꿈 — 결과 전 결박).\n`;
if (priorFail.length) md += `\n※ 해외 접속 시 시간 초과였다가 국내 접속에서 측정된 행(${priorFail.length}): ${priorFail.map(p => p.split(':')[0]).join(' · ')} — ${priorFail[0].split(': ')[1]}.\n`;
md += `\n주장 범위: 자사 점수는 tag q90-r2-candidate(3d3ebb4) 시점 제품에 한함. 공공 무료 검사는 세금으로 운영됨. 보안(A7)은 등급만 공개(대표 결정 D2).\n`;
fs.writeFileSync(path.join(RUN, 'table-v2.md'), md);
fs.writeFileSync(path.join(RUN, 'table-v2.json'), JSON.stringify({ rubric: rubric.version, rubric_sha256: sha(RUBRIC), roster: roster.version, roster_sha256: sha(ROSTER), generatedAt: new Date().toISOString(), third_cells: thirdCells, rows }, null, 1));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<i class=t>($1)</i>');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>공개 비교표 v2 — ${esc(path.basename(RUN))}</title><style>body{font:14px/1.5 -apple-system,"Noto Sans KR",sans-serif;margin:24px;color:#222}table{border-collapse:collapse;font-size:12.5px}th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}th{background:#f6f6f6;position:sticky;top:0}tr.own td{background:#fffbe6}.t{color:#999}.nm{color:#aaa}.lead{color:#555;max-width:980px}.tag{display:inline-block;background:#eef;border-radius:4px;padding:2px 8px;margin-right:6px;font-size:12px}</style></head><body>
<span class="tag">공개 비교표 v2 · 틀</span><span class="tag">순위 없음 · 근거 등급 표기</span><span class="tag">자사 점수 = Q90 2회차 전사만</span>
<h1>자기진단 도구 비교표 — 같은 자로, 각 도구의 자리에서</h1>
<p class="lead">점수는 "좋다/나쁘다"가 아니라 "이 축에서 이렇게 설계됐다"를 뜻합니다. ★ A2·A3·A4는 고객 가치의 실체라 어떤 개정에서도 빠지지 않습니다. <b>굵게</b>=직접 잼 · (샘플)=회사 공개 샘플 리포트 채점 · (문서도판)=공식 문서 안 리포트 도판 채점(샘플과 직접 비교 금지) · (문서)=공개 문서 · 미측정=근거 없음(0점 아님).</p>
<table><thead><tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>
${rows.map(r => `<tr${r.own ? ' class="own"' : ''}>${[r.id, (r.own ? '**' + r.name + '** (자사)' : r.name), r.group, r.appeal || '_(채움 예정)_', r.A1, r.A2, r.A3, r.A4, r.A5, r.A6, r.A7, r.A8, r.price_band, r.time_min ?? '—', r.limits || '_(채움 예정)_'].map(v => `<td${v === NM ? ' class="nm"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('\n')}
</tbody></table>
<p class="lead">E1 실측 분모 ${e1n}/${nonOwn}행. <b>자사 행은 Q90 scorer 전사, 비교 대상은 E2 블라인드 judge — 측정 방식이 다르므로 같은 열이라도 직접 비교 금지.</b></p>
<p class="lead">자: rubric ${rubric.version} · 명부 ${roster.version} · 자사 점수는 tag q90-r2-candidate(3d3ebb4) 시점 제품에 한함 · 공공 무료 검사는 세금으로 운영됨 · 보안은 등급만 공개.</p></body></html>`;
fs.writeFileSync(path.join(RUN, 'table-v2.html'), html);
console.log('rows', rows.length, '→', path.join(RUN, 'table-v2.{md,html,json}'));
