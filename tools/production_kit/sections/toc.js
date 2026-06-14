// sections/toc.js — 목차
const { esc } = require('../templates/render_helpers');

module.exports = function renderToc(){
  const items = [
    { no: 'A', label: '신규 규칙 제작서 — 사명/비전 응답 직합성(RESPONSE-DIRECT)과 슬롯 매핑', page: '03' },
    { no: 'B', label: '5톤 인생포트폴리오 리포트 샘플 (압축판)',          page: '07' },
    { no: 'C', label: '5톤 맞춤형 실행 프로그램 샘플 (압축판)',            page: '12' },
    { no: 'D', label: '수동 제작용 템플릿 프롬프트 (KR · 사람/AI 공용)',   page: '17' },
    { no: 'E', label: '매핑표 + QA 체크리스트 + 정규화 가드',               page: '21' }
  ];
  const list = items.map(function(it){
    return '<li><span class="toc-label"><span class="toc-no">' + esc(it.no) + '.</span><span>' + esc(it.label) + '</span></span><span class="toc-page">p. ' + esc(it.page) + '</span></li>';
  }).join('\n');
  return [
    '<section class="page toc">',
    '  <h1>목차</h1>',
    '  <p class="section-lede">본 매뉴얼은 인생포트폴리오 v4.1의 신규 규칙을 사람과 AI가 모두 동일한 결과로 재현할 수 있도록 정리한 압축형 production kit 입니다.</p>',
    '  <ol class="toc-list">' + list + '</ol>',
    '  <div class="callout">',
    '    <div class="callout-title">사용 안내</div>',
    '    <div>· A 섹션 — 규칙의 “왜”와 “구조”를 이해할 때 / B·C — 결과물 톤별 비교 / D — 수동 제작 시 LLM 또는 사람에게 그대로 전달 / E — 검수 단계에서 체크리스트 사용.</div>',
    '  </div>',
    '</section>'
  ].join('\n');
};
