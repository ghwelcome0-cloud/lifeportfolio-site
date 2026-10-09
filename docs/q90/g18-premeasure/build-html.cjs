'use strict';
// Build a content-grade HTML performance table (owner-only preview) from scored.json + own-out/scored.json.
const fs = require('fs');
const S = require('./out/scored.json').filter(o => !o.own);
const O = require('./own-out/scored.json');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = x => Math.round(x * 100) + '%';
const G = { '진단': '진단 도구', '실행축적': '실행·축적 도구', '국내': '국내 도구' };
const lvlCls = l => l >= 5 ? 'l5' : l >= 4 ? 'l4' : l >= 3 ? 'l3' : l >= 2 ? 'l2' : 'l1';
const chip = (l, txt) => `<span class="lv ${lvlCls(l)}">L${l}</span><span class="sub">${esc(txt)}</span>`;
const na = (t) => `<span class="na">${esc(t)}</span>`;
const bar = (v, max) => `<div class="bar"><b>${v.toFixed(2)}</b><i>/ ${max}</i><div style="--w:${(v / max * 100).toFixed(1)}%"></div></div>`;

function row(o, own) {
  const name = `<td class="nm"><span class="rid">${esc(o.row)}</span><strong>${esc(o.name)}</strong><em>${esc(G[o.group] || o.group)}</em></td>`;
  if (own) return `<tr class="own">${name}<td colspan="9"><div class="blank"><span>__</span> 자사 칸은 2회차 봉인·블라인드 판정 뒤에만 채웁니다 (E-2). 지금 숫자를 넣으면 이 표가 거짓이 됩니다.</div></td></tr>`;
  if (o.a6err) {
    const why = /403/.test(o.a6err) ? '봇 차단 403 — 공개 페이지가 자동 측정을 거부' : /timeout/.test(o.a6err) ? '60초 응답 없음 ×2 — 측정 불가' : o.a6err;
    return `<tr>${name}<td colspan="4" class="unm">미측정<small>${esc(why)}</small></td>${a7(o)}${a5(o)}</tr>`;
  }
  const a61why = o.a61.pass ? 'viewport·확대·폭 모두 OK' : [!o.a61.vp ? 'viewport 없음' : '', o.a61.zoomBlocked ? '확대 차단' : '', o.a61.overflow ? `가로 ${o.a61.docW}px` : ''].filter(Boolean).join(' · ');
  return `<tr>${name}
<td>${chip(o.a61.level, a61why)}</td>
<td>${chip(o.a63.level, `≥16px ${pct(o.a63.ratio)} (${o.a63.ge16}/${o.a63.blocks})` + (o.a63.lt12 ? ` · <12px ${o.a63.lt12}개` : ''))}</td>
<td>${o.a64 ? chip(o.a64.level, `≥44px ${pct(o.a64.ratio)} (${o.a64.ok44}/${o.a64.total}) · ≥24px ${pct(o.a64.ratio24)}`) : na('대상 0')}</td>
<td class="pt">${bar(o.a6partial.points, 9)}</td>${a7(o)}${a5(o)}</tr>`;
}
function a7(o) {
  if (!o.a71) return `<td colspan="3" class="unm">미측정</td>`;
  const hs = ['HSTS', 'XCTO', 'Frame', 'Referrer', 'Permissions'].filter((k, i) => [o.a71.hsts, o.a71.xcto, o.a71.frame, o.a71.referrer, o.a71.permissions][i]);
  return `<td><span class="lv ${lvlCls(o.a71.level)}">L${o.a71.level}</span><span class="sub">HTTPS ${o.a71.https ? 'O' : 'X'} · 헤더 <b class="${o.a71.controls === 5 ? 'good' : o.a71.controls === 0 ? 'bad' : ''}">${o.a71.controls}/5</b>${hs.length ? '<br>' + hs.join(' · ') : ''}</span></td>
<td><span class="lv ${lvlCls(o.a76.level)}">L${o.a76.level}</span><span class="sub">CSP ${o.a76.csp ? 'O' : 'X'} · 보고 ${o.a76.reporting ? '<b class="good">O</b>' : 'X'}</span></td>
<td>${o.a75probe.exposed.length ? `<span class="warn">관측 ${o.a75probe.exposed.join(', ')}</span><span class="sub">6경로 중 ${o.a75probe.exposed.length} · 메타파일, 비밀정보 아님</span>` : '<span class="ok">0 / 6</span>'}</td>`;
}
function a5(o) {
  return `<td>${o.a58 ? chip(o.a58, '기존증거 D3') : na('미측정')}</td><td>${o.a59 === '비적용' ? na('비적용 (검사 아님)') : o.a59 ? chip(o.a59, '기존증거 D4') : na('미측정')}</td>`;
}
const ok = S.filter(o => !o.a6err);
const agg = {
  n: ok.length, a61: ok.filter(o => o.a61.pass).length, a63: ok.filter(o => o.a63.ratio >= .75).length, lt12: ok.filter(o => o.a63.lt12 > 0).length,
  a64: ok.filter(o => o.a64 && o.a64.ratio >= .5).length, med: [...ok.map(o => o.a6partial.points)].sort((a, b) => a - b)[Math.floor(ok.length / 2)],
  h5: S.filter(o => o.a71 && o.a71.controls === 5).length, h0: S.filter(o => o.a71 && o.a71.controls === 0).length, csp: S.filter(o => o.a76 && o.a76.reporting).length,
};
const top = [...ok].sort((a, b) => b.a6partial.points - a.a6partial.points).slice(0, 5).map(o => `${o.name.replace(/\s*\(.*\)/, '')} ${o.a6partial.points.toFixed(2)}`).join(' · ');
const ownRows = O.map(o => `<tr><td class="nm"><strong>${esc(o.name)}</strong></td><td>${chip(o.a61.level, o.a61.pass ? '충족' : '미충족')}</td><td>${chip(o.a63.level, `≥16px ${pct(o.a63.ratio)} (${o.a63.ge16}/${o.a63.blocks})` + (o.a63.lt12 ? ` · <12px ${o.a63.lt12}개` : ''))}</td><td>${chip(o.a64.level, `≥44px ${pct(o.a64.ratio)} (${o.a64.ok44}/${o.a64.total})`)}</td><td class="pt">${bar(o.a6partial.points, 9)}</td><td><span class="lv l3">L3</span><span class="sub">HTTPS O · 헤더 <b class="good">5/5</b></span></td><td><span class="lv l2">L2</span><span class="sub">CSP O · 보고 <b class="good">O</b></span></td><td><span class="ok">0 / 6</span></td></tr>`).join('');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>G17 공개 성능표 — 비교대상 사전 측정판</title>
<style>
:root{--ink:#111827;--mut:#6b7280;--line:#e5e7eb;--bg:#f8fafc;--own:#fff7ed;--l5:#15803d;--l4:#65a30d;--l3:#ca8a04;--l2:#ea580c;--l1:#dc2626}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:14px/1.5 -apple-system,"Pretendard","Noto Sans KR","Apple SD Gothic Neo",Segoe UI,Roboto,sans-serif;width:1600px}
.wrap{padding:36px 40px}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.01em}.lead{color:var(--mut);margin:0 0 18px;font-size:15px}
.tag{display:inline-block;background:#fee2e2;color:#991b1b;border-radius:999px;padding:3px 12px;font-weight:700;font-size:13px;margin-right:8px}
.tag.g{background:#dcfce7;color:#166534}.tag.b{background:#dbeafe;color:#1e40af}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0 22px}
.k{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:14px 16px}.k b{display:block;font-size:26px;letter-spacing:-.02em}.k span{color:var(--mut);font-size:12.5px}
.k.warn{background:#fff1f2;border-color:#fecdd3}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
th{background:#0f172a;color:#fff;text-align:left;padding:10px 10px;font-weight:600;font-size:12px;vertical-align:bottom;line-height:1.3}
th small{display:block;color:#cbd5e1;font-weight:400;font-size:10.5px;margin-top:3px}
td{border-bottom:1px solid var(--line);padding:9px 10px;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
td.nm{width:230px}.rid{display:inline-block;font-size:10.5px;color:#fff;background:#64748b;border-radius:4px;padding:1px 6px;margin-bottom:3px}
td.nm strong{display:block;font-size:13px;line-height:1.25}td.nm em{font-style:normal;color:var(--mut);font-size:11px}
.lv{display:inline-block;min-width:30px;text-align:center;color:#fff;border-radius:6px;padding:2px 6px;font-weight:800;font-size:12px;margin-right:6px}
.l5{background:var(--l5)}.l4{background:var(--l4)}.l3{background:var(--l3)}.l2{background:var(--l2)}.l1{background:var(--l1)}
.sub{color:#374151;font-size:11.5px;line-height:1.35;display:inline-block;max-width:170px;vertical-align:top}
.na{color:#9ca3af;font-size:11.5px}.unm{color:#9ca3af;font-weight:600;text-align:center}.unm small{display:block;font-weight:400;font-size:11px}
.bar{display:flex;align-items:center;gap:8px}.bar div{position:relative;height:14px;flex:1;background:#e5e7eb;border-radius:4px;overflow:hidden}.bar div::after{content:'';position:absolute;inset:0;width:var(--w);background:linear-gradient(90deg,#60a5fa,#2563eb)}.bar b{font-size:15px;min-width:36px;text-align:right}.bar i{font-style:normal;font-size:11px;color:#64748b}
td.pt{width:170px}.good{color:var(--l5)}.bad{color:var(--l1)}.ok{color:var(--l5);font-weight:700}.warn{color:#b45309;font-weight:700;display:block}
tr.own td{background:var(--own)!important;border-top:2px solid #f59e0b;border-bottom:2px solid #f59e0b}
.blank{display:flex;align-items:center;gap:14px;color:#9a3412;font-size:13px}.blank span{font-family:ui-monospace,monospace;font-size:28px;font-weight:800;color:#f59e0b;letter-spacing:.1em}
h2{font-size:18px;margin:30px 0 8px}.note{background:var(--bg);border-left:4px solid #0f172a;padding:12px 16px;border-radius:0 10px 10px 0;margin:10px 0;font-size:13px}
.note b{display:block;margin-bottom:4px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
ul{margin:6px 0 0 18px;padding:0}li{margin:3px 0}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--mut);font-size:12px;margin:8px 0 14px}.legend .lv{min-width:26px}
.foot{color:var(--mut);font-size:11.5px;margin-top:22px;border-top:1px solid var(--line);padding-top:10px}
</style></head><body><div class="wrap">
<div><span class="tag">대표 열람용 · 외부 게시 금지</span><span class="tag b">G17 사전 측정판</span><span class="tag g">자사 칸 의도적 공란</span></div>
<h1>공개 성능표 — 비교대상 26곳 사전 측정 (같은 자, 문 밖에서 잴 수 있는 것만)</h1>
<p class="lead">측정 2026-10-09 06:4x UTC · 각 회사 <b>공개 첫 페이지 1장</b>을 iPhone 폭(390px)으로 열어 기계로 잰 값입니다. 로그인·응시·구매·문항 열람 없음. 7축 25지표 중 공개 표면에서 잴 수 있는 <b>9지표</b>만 있고, 나머지는 <b>미측정(0점 아님)</b>이라 어느 회사도 총점은 내지 않았습니다.</p>
<div class="kpis">
<div class="k"><b>${agg.a61}<small>/${agg.n}</small></b><span>A6.1 모바일 적합 충족<br>미충족 = 확대 차단 5 · 가로 넘침 6</span></div>
<div class="k"><b>${agg.a63}<small>/${agg.n}</small></b><span>A6.3 본문 16px↑ 75% 이상<br>12px 미만 글자 있는 곳 ${agg.lt12}</span></div>
<div class="k warn"><b>${agg.a64}<small>/${agg.n}</small></b><span>A6.4 버튼 44px 50% 이상<br>대부분 미달 — 업계 공통 약점</span></div>
<div class="k"><b>${agg.med.toFixed(2)}<small>/9</small></b><span>A6 부분합 중앙값<br>상위: ${esc(top)}</span></div>
<div class="k warn"><b>${agg.h5}<small>/26</small></b><span>A7.1 보안 헤더 5/5<br>0/5인 곳 ${agg.h0} (국내 4곳 포함)</span></div>
<div class="k"><b>${agg.csp}<small>/26</small></b><span>A7.6 CSP 위반 보고 설정<br>비공개 경로 탐침 노출 1 (메타파일)</span></div>
</div>
<div class="legend"><span class="lv l5">L5</span>전수 충족 <span class="lv l4">L4</span>75%↑ <span class="lv l3">L3</span>50%↑ <span class="lv l2">L2</span>25%↑ <span class="lv l1">L1</span>25% 미만 · <b>미측정</b> = 재지 않음(점수 없음) · <b>비적용</b> = 해당 없음</div>
<table><thead><tr>
<th>대상<small>G18 1판 행 ID</small></th>
<th>A6.1 모바일 적합<small>viewport · 확대 허용 · 390px 넘침 0</small></th>
<th>A6.3 본문 가독성<small>computed font-size ≥16px 비율 · &lt;12px 0</small></th>
<th>A6.4 터치 타깃<small>≥44×44 CSS px 비율 (≥24px 병기)</small></th>
<th>A6 부분합<small>3지표(60/100) → 배점 9/15</small></th>
<th>A7.1 전송·헤더<small>HTTPS + HSTS·XCTO·Frame·Referrer·Permissions</small></th>
<th>A7.6 CSP 보고<small>report-to / report-uri</small></th>
<th>A7.5 비공개 경로<small>/.env /.git /wp-config 등 6경로</small></th>
<th>A5.8 한계 고지<small>G18 D3 기존증거</small></th>
<th>A5.9 신뢰도 근거<small>G18 D4 기존증거</small></th>
</tr></thead><tbody>
${S.map(o => row(o)).join('\n')}
${row({ row: 'OWN', name: '인생포트폴리오 (자사)', group: '자사' }, true)}
</tbody></table>

<div class="grid2">
<div class="note"><b>이 표에서 읽을 수 있는 것</b><ul>
<li>보안 헤더를 다 갖춘 곳은 Cappfinity(Strengths Profile)·15Five 두 곳뿐. 국내 4곳(커리어넷·어세스타·태니지먼트·고용24)과 Hogan·IPIP·SDS는 HTTPS 외 보안 헤더 0.</li>
<li>모바일 확대를 막아 둔 곳 5(Hogan·Birkman·Working Genius·SDS·어세스타) — 접근성 기본 위반. 커리어넷은 모바일 레이아웃이 없어 1380px로 열림.</li>
<li>44px 버튼은 업계 공통으로 안 지켜짐(24px 기준은 대부분 50%↑). 우리도 해설서에서 같은 문제.</li>
<li>HEXACO 사이트는 <code>/.DS_Store</code>가 열림(디렉터리 메타파일, 비밀정보 아님).</li></ul></div>
<div class="note"><b>이 표가 말하지 못하는 것 (게시 시 그대로 적을 한계)</b><ul>
<li><b>같은 자가 아닙니다.</b> 타사는 공개 대문 1장, 우리 2회차는 설문·리포트·프로그램 전체 화면을 잽니다. 그래서 우열 문장은 쓸 수 없습니다(템플릿 §0.2-6).</li>
<li>A1~A4(직관성·자기인식·실행·축적)와 A5 대부분은 응시 없이는 잴 수 없어 전부 미측정.</li>
<li>A7은 공개 1경로만 봐서 L2 천장(전체 전송보호 검증 주장 불가).</li>
<li>마케팅 랜딩은 큰 헤드라인이 많아 16px 비율이 쉽게 오르고, 각주가 많으면 12px 미만에 걸립니다(Lattice 40개). 측정 편향을 숨기지 않습니다.</li>
<li>16Personalities는 봇 차단, 고용24는 무응답 — 측정 불가이지 결함이 아님.</li></ul></div>
</div>

<h2>표 밖 참고 — 같은 스크립트를 자사 공개 페이지에 돌린 값 (점수 아님 · 봉인·블라인드 없음)</h2>
<table><thead><tr><th>페이지</th><th>A6.1</th><th>A6.3 본문 가독성</th><th>A6.4 터치</th><th>A6 부분합</th><th>A7.1</th><th>A7.6</th><th>A7.5</th></tr></thead><tbody>${ownRows}</tbody></table>
<div class="note" style="border-color:#dc2626;background:#fff1f2"><b>참고값에서 발견된 자사 결함 — 2회차 전 수정 대상</b><ul>
<li><b>모바일 본문 글자 12~15px.</b> 홈 14px 35블록·12px 12블록, 해설서 14.5px 50블록·12.5px 15블록. 계약 A6.3("모바일 본문 16px 이상, 12px 미만 0")대로면 2회차 A6.3은 <b>L1(최저)</b>이 됩니다. 비교대상 24곳 중 16px 75%↑가 10곳이므로 이 지표에서 우리는 하위권입니다.</li>
<li><b>해설서 텍스트 링크 44px 미만.</b> 사전 동등 타깃 예외를 결박하거나 링크 패딩을 키워야 합니다.</li>
<li>보안 헤더 5/5·CSP 보고·탐침 0은 비교대상 최상위(Cappfinity·15Five)와 동급.</li>
<li>2회차 judge가 보는 <b>설문 진행 화면·리포트·프로그램 화면</b>은 이 참고값에 없습니다. 재동결 전에 그 화면들도 같은 스크립트로 재야 합니다.</li></ul></div>
<p class="foot">출처: 계약 c25fff3a… 지표 A6.1·6.3·6.4·A7.1·7.5·7.6·A5.8·5.9 앵커 · 명부 G18 1판(51행 중 URL 있는 비중복 26행) · 원자료 docs/q90/g18-premeasure/results.json (932d01d7…) · 스크립트 measure.cjs/score.cjs · 재측정: node measure.cjs && node score.cjs. 이 문서는 AI·기계 측정 기반 대체 평가이며 인증·순위·우열 주장이 아닙니다. 타사 상표는 식별 목적으로만 표기.</p>
</div></body></html>`;
fs.writeFileSync('out/G17_premeasure.html', html);
console.log('html bytes', html.length);
