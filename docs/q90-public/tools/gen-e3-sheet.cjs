'use strict';
// Usage: node gen-e3-sheet.cjs <roster.json> <out.json> [existing-e3.json]
// E3(공개 문서) 수집 시트 생성기 — 명부의 모든 행(자사 포함)에 대해 빈 칸을 만든다.
// 기존 e3 파일이 있으면 채워진 값은 보존하고 새 행만 추가한다(축적 원칙: 지우지 않는다).
// 각 값은 {value, source_url, collected_at, note} 묶음으로 적는다 → 출처 없는 값은 표에 올리지 않는다.
const fs = require('fs');
const [ROSTER, OUT, PREV] = process.argv.slice(2);
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
const prev = PREV && fs.existsSync(PREV) ? Object.fromEntries(JSON.parse(fs.readFileSync(PREV, 'utf8')).rows.map(r => [r.id, r])) : {};
const field = () => ({ value: null, source_url: null, collected_at: null, note: '' });
const FIELDS = {
  provider: '운영 주체(회사·기관) 공식 명칭',
  access: '접근 방식: 웹/앱/오프라인/기관 경유',
  time_min: '소요 시간(분) — 공식 문서 숫자만',
  price_krw: '1회 가격(원). 무료=0. 환율은 collected_at 기준 매매기준율',
  price_band: '비용 구간: 무료 / ~1만 / 1~5만 / 5~15만 / 15만+ (A8.2)',
  price_transparency: 'A8.1 가격 투명성: 공개 / 문의 / 숨김',
  reuse_price_krw: 'A8.3 재응시·재열람 비용(원). 무제한 재열람=0',
  docs_url: '기술 매뉴얼·규준·신뢰도 문서 URL',
  reliability_coef: 'A5 신뢰도 계수(알파·재검사 등) 문서 기재값',
  norm_sample_n: 'A5 규준 표본 수(문서 기재값)',
  sample_report_url: 'E2용 공개 샘플 리포트 URL (없으면 null)',
  sample_report_sha256: '샘플 리포트 파일 sha256 (수집 시점 고정)',
  privacy_policy_url: '개인정보처리방침 URL (A7 등급 참고용, 점수 아님)',
  appeal: '"이럴 때 이 도구" — 그 회사 공식 문구 바탕 1~2문장(폄하 금지)',
  limits: '"한계" — 공개 문서 기준 사실만(예: 영어만, 기관 경유만). 추측 금지',
  korean_support: '한국어 지원: 전체 / 부분 / 없음',
  E4: '{direction:+/−/혼재, sample_n, sources:[], collected_at} — 표본<20이면 null'
};
const rows = roster.rows.map(r => {
  const p = prev[r.id];
  if (p) return p;
  const o = { id: r.id, name: r.name, group: r.group, url: r.url, own: !!r.own };
  for (const k of Object.keys(FIELDS)) o[k] = field();
  // 명부에 이미 적힌 값은 출처 '명부 v2(G18 1판 당시 확인)'로 옮겨 적는다
  if (r.price_krw_band != null) o.price_krw = { value: r.price_krw_band, source_url: r.url, collected_at: r.since, note: '명부 v2 이관 — 재확인 필요' };
  if (r.time_min) o.time_min = { value: r.time_min, source_url: r.url, collected_at: r.since, note: '명부 v2 이관 — 재확인 필요' };
  o.A5 = null; o.A8 = null; // 채점 결과 칸: fill-e3 단계에서 rubric A5/A8 지표로 계산해 적는다
  o.status = 'empty'; // empty → partial → complete(모든 필수 칸에 source_url) → reviewed(2인 확인)
  return o;
});
fs.writeFileSync(OUT, JSON.stringify({ sheet: 'E3 공개 문서 수집', roster_version: roster.version, generatedAt: new Date().toISOString(), field_guide: FIELDS, rule: ['source_url 없는 value는 표에 올리지 않는다', '값은 덮어쓰지 않고 note에 이력 추가', '자사(OWN) 행도 같은 칸을 같은 기준으로 채운다'], rows }, null, 1));
console.log('rows', rows.length, '→', OUT, '| preserved', Object.keys(prev).length);
