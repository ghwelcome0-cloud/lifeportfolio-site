'use strict';
// Digital diary — download (PDF·print / text). Offline, synthetic member record only, no network.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const S = require('../assets/js/diary-schema.js');
const X = require('../assets/js/diary-export.js');
const app = fs.readFileSync(path.join(root, 'assets/js/diary-app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'diary.html'), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS ' + name); };

const st = {
  seed: { name: '김하늘' },
  meta: { startDate: '2026-10-08' },
  pages: {
    mission: { fields: { core: '배운 것을 나누어 다른 사람의 첫걸음을 돕는다.', word: '나눔' } },
    'week-1-l': { fields: { a: '포트폴리오 초안 한 쪽 쓰기', day1: '도서관 2시간', if1: '만약 피곤하면, 그러면 10분만 쓴다' } },
    'week-1-r': { fields: { good: '초안을 끝냈다', dd_date: '2026-10-10' } },
    'month-1-grid': { fields: { c15: '스터디 모임' } },
    'tracker-2': { fields: { w1_done: true, w1_memo: '좋았다' } },
    'daily-1': { fields: { mood: '좋음', note: '줄 1\n줄 2' } },
    'lifemap-1-r': { fields: { d1: 7 } },
    'career': { fields: { dirs: ['글쓰기', '강의'] } },
    'week-3-l': { fields: {} },
  },
  logs: [
    { id: 'log_2', date: '2026-10-09', text: '설명 영상 한 편 찍기', kept: '3분 영상' },
    { id: 'log_1', date: '2026-10-08', text: '<script>x</script> 첫 기록' },
    { id: 'log_3', date: '2028-01-01', text: '1년 지난 뒤 기록' },
  ],
};
const title = (p) => p.key; // the app passes its own pageTitle
const m = X.buildModel(S, st, title, '2026-10-20');
const txt = X.toText(m), ph = X.toPrintHTML(m);

t('only-written-pages', () => {
  assert.deepEqual(m.sections.map((s) => s.key), ['mission', 'career', 'lifemap-1-r', 'month-1-grid', 'week-1-l', 'week-1-r', 'tracker-2', 'daily-1', 'logs']);
  assert.equal(m.pagesWritten, 8); assert.equal(m.logCount, 3);
  assert.ok(!m.sections.some((s) => s.key === 'week-3-l'), 'empty page skipped');
});
t('no-blank-forms-exported', () => {
  // 약관 제8조 ④: 회원 기록과 분리된 빈 양식이 되지 않도록 — 값이 없는 질문은 나오지 않는다.
  m.sections.forEach((s) => s.items.forEach((it) => assert.ok(String(it.a).trim(), s.key + ' ' + it.q)));
  assert.ok(!txt.includes('여섯 가지 중 가장 의외였던'), 'unanswered profile question absent');
});
t('values-formatted', () => {
  const w1 = m.sections.find((s) => s.key === 'week-1-l');
  assert.equal(w1.range, '10.08 – 10.14');
  assert.ok(w1.items.some((i) => i.q === '10.08 (목) 일정' && i.a === '도서관 2시간'));
  assert.ok(m.sections.find((s) => s.key === 'month-1-grid').items[0].q.startsWith('10.15'));
  assert.equal(m.sections.find((s) => s.key === 'lifemap-1-r').items[0].a, '7점');
  assert.equal(m.sections.find((s) => s.key === 'career').items[0].a, '글쓰기, 강의');
  assert.equal(m.sections.find((s) => s.key === 'tracker-2').items[0].q, '추적 8주 · 이 주의 A를 마쳤나요?');
  assert.equal(m.sections.find((s) => s.key === 'week-1-r').items.find((i) => i.q === '이번 주 깊이 기록할 날').a, '2026.10.10 (토)');
});
t('logs-placed-by-week-and-rest-at-end', () => {
  const r1 = m.sections.find((s) => s.key === 'week-1-r');
  assert.deepEqual(r1.logs.map((l) => l.date), ['2026.10.08 (목)', '2026.10.09 (금)']);
  assert.equal(r1.logs[1].kept, '3분 영상');
  assert.deepEqual(m.sections.at(-1).logs.map((l) => l.text), ['1년 지난 뒤 기록']);
});
t('text-file-windows-friendly', () => {
  assert.ok(txt.startsWith('\uFEFF')); assert.ok(txt.includes('\r\n')); assert.ok(!/[^\r]\n/.test(txt));
  assert.ok(txt.includes('  줄 1\r\n  줄 2'));
  assert.ok(txt.includes('<script>x</script> 첫 기록'), 'text keeps raw characters');
});
t('print-html-escapes-member-text', () => {
  assert.ok(!ph.includes('<script>')); assert.ok(ph.includes('&lt;script&gt;x&lt;/script&gt;'));
});
t('front-cover-only-title-and-owner', () => {
  const cover = ph.slice(0, ph.indexOf('</section>'));
  ['LIFE PORTFOLIO', '인생포트폴리오 맞춤형 다이어리', 'Only One', '김하늘'].forEach((s) => assert.ok(cover.includes(s), s));
  assert.ok(!/시작한 날|내려받은 날|담긴 기록|2026년/.test(cover), 'dates/counts moved off the cover (owner feedback 2026-10-09)');
  assert.ok(!/©|저작권|회원님의 것/.test(cover), 'no on-screen copyright line on the cover (owner decision 2026-10-08)');
  assert.ok(!/©/.test(txt.split('────')[0]), 'text cover too');
});
t('page-two-opens-with-record-info', () => {
  const rest = ph.slice(ph.indexOf('</section>') + 10);
  assert.ok(rest.startsWith('<section class="xp-info">'));
  const info = rest.slice(0, rest.indexOf('</section>'));
  ['시작한 날', '2026년 10월 8일', '내려받은 날', '2026년 10월 20일', '직접 쓰신 쪽 8쪽 · 해 본 일 3개'].forEach((s) => assert.ok(info.includes(s), s));
  assert.ok(!/xp-info\{[^}]*break-after:page/.test(X.PRINT_CSS), 'info shares page 2 with the first records');
});
t('back-cover-closes-the-book', () => {
  const back = ph.slice(ph.lastIndexOf('<section class="xp-back">'));
  assert.ok(ph.trim().endsWith('</p></section>') && back.includes('LIFE PORTFOLIO') && back.includes('Only One'));
  assert.ok(/직접 쓰신 기록입니다\. 다이어리 양식 © 파이스/.test(back), 'colophon on the back cover only');
  assert.equal((ph.match(/©/g) || []).length, 1);
  assert.ok(/xp-back\{[^}]*break-before:page/.test(X.PRINT_CSS) && /xp-back\{[^}]*height:258mm/.test(X.PRINT_CSS));
  assert.ok(!/<input|<textarea|xp-it/.test(back), 'back cover is not a writing page');
});
t('file-name', () => {
  assert.equal(X.fileBase(m), '인생포트폴리오_다이어리_김하늘_20261020');
  assert.equal(X.fileBase(X.buildModel(S, { seed: { name: '김 / 하:늘' }, meta: null, pages: {}, logs: [] }, title, '2026-10-20')), '인생포트폴리오_다이어리_김하늘_20261020');
});
t('empty-diary', () => {
  const e = X.buildModel(S, { seed: {}, meta: null, pages: {}, logs: [] }, title, '2026-10-20');
  assert.equal(e.sections.length, 0); assert.ok(X.toText(e).includes('아직 적은 내용이 없어요.')); assert.ok(!X.toPrintHTML(e).includes('시작한 날'));
});
t('every-template-exports-without-error', () => {
  const pages = {};
  S.PAGES.filter(Boolean).forEach((p) => { const f = (S.TEMPLATES[p.tpl].fields || [])[0]; if (!f) return; const v = { check: true, score: 5, multi: [f.options && f.options[0]], choice: f.options && f.options[0], date: '2026-10-09', year: 2030 }[f.type] ?? 'x'; pages[p.key] = { fields: { [f.key]: v } }; });
  const all = X.buildModel(S, { seed: { name: 'A' }, meta: { startDate: '2026-10-08' }, pages, logs: [] }, title, '2026-10-20');
  assert.equal(all.pagesWritten, Object.keys(pages).length);
  assert.ok(X.toText(all).length > 1000 && X.toPrintHTML(all).length > 1000);
});
t('print-css-isolates-export', () => {
  assert.ok(X.PRINT_CSS.includes('body.dy-printing>*:not(#dy-print){display:none!important}'));
  assert.ok(X.PRINT_CSS.includes('@page{size:A4'));
  assert.ok(/xp-cover\{[^}]*break-after:page/.test(X.PRINT_CSS));
});
t('wired-into-app-locally-no-network', () => {
  assert.ok(html.includes('<script src="/assets/js/diary-export.js"></script>\n<script src="/assets/js/diary-app.js"></script>'));
  ['id="sh-export"', 'id="xp-pdf"', 'id="xp-txt"', 'id="xp-copy"', 'id="bar-dl"'].forEach((s) => assert.ok(html.includes(s), s));
  assert.ok(/data-export/.test(app) && /function runExport/.test(app) && /flushAll\(\)\.then/.test(app));
  const src = fs.readFileSync(path.join(root, 'assets/js/diary-export.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|st\.call|navigator\.sendBeacon/.test(src), 'export never sends data anywhere');
});
console.log(JSON.stringify({ passed: n, scope: 'offline; synthetic record' }));
