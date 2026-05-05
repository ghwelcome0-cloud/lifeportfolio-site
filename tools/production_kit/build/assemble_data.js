// tools/production_kit/build/assemble_data.js
// 5톤 샘플 + KYS 실데이터를 Production Kit PDF 빌드용 데이터로 어셈블
//
// 사용: node tools/production_kit/build/assemble_data.js
// 출력: tools/production_kit/build/kit_data.json

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const sampleDir = path.join(repoRoot, 'reports/v4_test/samples_5tone');
const outDir    = path.join(repoRoot, 'tools/production_kit/build');

// ── 76문항 + mapping 결합 ──
const questionsRaw = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/questions.json'), 'utf8'));
const mappingRaw   = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/mapping.json'), 'utf8'));
const qm = mappingRaw.questionMapping || {};

// 한국어 축 라벨
const AXIS_KO = {
  self_understanding: '자기이해',
  self_expression:    '자기표현',
  self_design:        '자기설계',
  self_execution:     '자기실행'
};
const SECTION_KO = {
  summary:            '요약',
  mission_vision:     '사명/비전',
  growth_map:         '성장지도',
  career_education:   '진로/교육',
  execution_profile:  '실행 프로파일',
  closing:            '마무리'
};

// 본문항 + 부속(otherId) 76개 평탄화
const allQuestions76 = [];
(questionsRaw.sections || []).forEach(function(sec){
  (sec.questions || []).forEach(function(qq){
    // 본문항
    allQuestions76.push({
      id: qq.id,
      type: qq.type,
      text: qq.text || '',
      sectionKey: sec.key,
      sectionTitle: sec.title || sec.key,
      isFollowUp: false,
      parentId: null
    });
    // otherId follow-up — '기타 직접 입력'
    if (qq.otherId) {
      allQuestions76.push({
        id: qq.otherId,
        type: 'text_input',
        text: '(기타) ' + (qq.text || '').slice(0, 40) + ' — 직접 입력',
        sectionKey: sec.key,
        sectionTitle: sec.title || sec.key,
        isFollowUp: true,
        parentId: qq.id
      });
    }
  });
});

// 매핑 결합 — 각 문항에 axes/sections/weight/comment 부착
allQuestions76.forEach(function(q){
  const m = qm[q.id] || {};
  q.axes     = m.axes || [];
  q.sections = m.sections || [];
  q.weight   = (typeof m.weight === 'number') ? m.weight : null;
  q.comment  = m.comment || '';
  q.axesKo     = q.axes.map(function(a){ return AXIS_KO[a] || a; });
  q.sectionsKo = q.sections.map(function(s){ return SECTION_KO[s] || s; });
});

// ── 5톤 톤 메타 ──
const TONES = [
  { key: 'principled_designer', label: '원칙형 설계자', color: '#5B6CFF', emoji: '🧭' },
  { key: 'warm_connector',      label: '따뜻한 연결자', color: '#FF7A8A', emoji: '💛' },
  { key: 'visionary_creator',   label: '비저너리 크리에이터', color: '#A55BFF', emoji: '✨' },
  { key: 'pragmatic_achiever',  label: '실용적 성취가', color: '#FF9A3C', emoji: '🎯' },
  { key: 'reflective_explorer', label: '사색형 탐험가', color: '#3CC2A0', emoji: '🌿' }
];

// ── 톤별 샘플 로드 ──
const samples = TONES.map(function(t){
  const upgraded = JSON.parse(fs.readFileSync(path.join(sampleDir, t.key + '_v41_upgraded.json'), 'utf8'));
  const qa       = JSON.parse(fs.readFileSync(path.join(sampleDir, t.key + '_v41_qa.json'), 'utf8'));
  let program = null;
  const progPath = path.join(sampleDir, t.key + '_program.json');
  if (fs.existsSync(progPath)) {
    program = JSON.parse(fs.readFileSync(progPath, 'utf8'));
  }
  // 발췌
  const mvSec  = (upgraded.sections || []).find(function(s){ return s.id === 'mission_vision'; });
  const gmSec  = (upgraded.sections || []).find(function(s){ return s.id === 'growth_map'; });
  const ceSec  = (upgraded.sections || []).find(function(s){ return s.id === 'career_education'; });
  const axes   = ['self_understanding','self_expression','self_design','self_execution'].map(function(id){
    const s = (upgraded.sections || []).find(function(sec){ return sec.id === id; });
    return {
      id: id,
      pct: s && s.content && s.content.pct,
      tier: s && s.content && s.content.tier,
      tierLabel: s && s.content && s.content.tierLabel,
      keyword: s && s.content && (s.content.keyword || s.content.keywordLabel)
    };
  });
  return {
    tone: t,
    name: upgraded.profile && upgraded.profile.name || (upgraded.meta && upgraded.meta.name) || '',
    fingerprint: upgraded._v4Meta && upgraded._v4Meta.fingerprint,
    chosenTone: upgraded._v4Meta && upgraded._v4Meta.toneResolution && upgraded._v4Meta.toneResolution.toneKey,
    axes: axes,
    mission: mvSec && mvSec.content,
    strengths: gmSec && gmSec.content && gmSec.content.strengths || [],
    growth:    gmSec && gmSec.content && gmSec.content.growth    || [],
    careers:   ceSec && ceSec.content && ceSec.content.careers   || [],
    education: ceSec && ceSec.content && ceSec.content.education || [],
    directions:ceSec && ceSec.content && ceSec.content.directions|| [],
    qa: { passed: qa.passed, total: qa.total, score: qa.score },
    program: program
  };
});

// ── 17 QA 체크리스트 항목 ──
const QA_ITEMS = [
  { id: 'structure_12',     label: '12단 구조 일치' },
  { id: 'icon_order',       label: '이모지 순서 일치 (📘🟦🟩🟥🧭📍🧠🎙🎯🚀🧩🧪)' },
  { id: 'no_raw_trait',     label: '원시 Q6 형용사 미노출 (trait 정규화)' },
  { id: 'strengths_min_len',label: '강점 항목 최소 길이 ≥ 4' },
  { id: 'edu_unique',       label: '교육 추천 3개 중복 없음' },
  { id: 'career_unique',    label: '진로 추천 3개 중복 없음' },
  { id: 'mission_min_len',  label: '사명 문장 최소 길이 ≥ 60' },
  { id: 'vision_min_len',   label: '비전 문장 최소 길이 ≥ 50' },
  { id: 'four_axis_keywords', label: '4축 카드 키워드 4개 모두 존재' },
  { id: 'tier_applied',     label: '4축 카드 tier 라벨(deep/active 등) 적용' },
  { id: 'auto_notice',      label: '자동 안내 문구 포함' },
  { id: 'no_markdown',      label: '마크다운 ** 미사용' },
  { id: 'tier_axis_comment',label: 'tier × axis 코멘트 적용 (P0-4)' },
  { id: 'tone_resolution',  label: '톤 우선순위 해상도 기록 (P1-1)' },
  { id: 'domain_expansion', label: '도메인 × 보조도메인 확장 (P1-2)' },
  { id: 'diversity_guard',  label: '진로/교육 다양성 가드 (P1-3)' },
  { id: 'full_fingerprint', label: 'fingerprint 56문항 전체 활용 (P2-1)' }
];

// ── 17문항 → 슬롯 매핑표 ──
const QUESTION_SLOT_MAP = [
  { q: 'Q3~Q5',  axis: 'self_understanding', slot: '4축 점수(자기이해)', purpose: '감정·행동·사고 인식' },
  { q: 'Q6',     axis: 'self_understanding', slot: '성향 trait (TRAIT_AXIS_MAP)', purpose: '성향 키워드 정규화' },
  { q: 'Q7',     axis: 'self_understanding', slot: '자기 인식 트리거', purpose: '인식 강화 상황' },
  { q: 'Q9~Q12', axis: 'self_design',        slot: '4축 점수(자기설계)', purpose: '신념·가치 점수' },
  { q: 'Q13',    axis: '①가치 (mission)',     slot: 'values → mission_verbs / vision_identity', purpose: '사명 동사구·비전 정체성' },
  { q: 'Q14',    axis: 'self_understanding', slot: '가치 흔들림 상황', purpose: '가치 적용 맥락' },
  { q: 'Q16~Q18',axis: 'self_expression',    slot: '4축 점수(자기표현)', purpose: '관계·표현 점수' },
  { q: 'Q19',    axis: 'self_understanding', slot: '관계 변화 카드', purpose: '관계 맥락' },
  { q: 'Q21',    axis: 'self_expression',    slot: '감정 정리 방식', purpose: '회복 루틴' },
  { q: 'Q23~Q25',axis: 'self_understanding', slot: '4축 점수(자기이해)', purpose: '성찰 깊이' },
  { q: 'Q26',    axis: 'self_expression',    slot: '표현 채널', purpose: '소통 패턴' },
  { q: 'Q28',    axis: 'self_expression',    slot: '감정 표출 패턴', purpose: '내·외향 신호' },
  { q: 'Q30',    axis: 'self_expression',    slot: '4축 점수(자기표현)', purpose: '대인 활력도' },
  { q: 'Q31',    axis: 'self_expression',    slot: '인식되는 모습', purpose: '외부 인식' },
  { q: 'Q33',    axis: 'self_design',        slot: '관계 가치', purpose: '관계 결' },
  { q: 'Q35~Q38',axis: 'self_execution',     slot: '4축 점수(자기실행)', purpose: '몰입·실행' },
  { q: 'Q39',    axis: 'self_execution',     slot: '활동 선호', purpose: '실행 채널' },
  { q: 'Q41',    axis: '③장면 (mission)',    slot: 'topics → topic_scene', purpose: '사명 장면 라벨 (특히 ~)' },
  { q: 'Q43~Q46',axis: 'self_execution',     slot: '4축 점수(자기실행)', purpose: '환경·계획 점수' },
  { q: 'Q47',    axis: 'self_execution',     slot: '몰입 환경', purpose: '실행 환경 카드' },
  { q: 'Q49',    axis: 'self_execution',     slot: '하루 리듬', purpose: '루틴 설계' },
  { q: 'Q51~Q54',axis: 'self_execution',     slot: '4축 점수(자기실행)', purpose: '동기·지속력' },
  { q: 'Q55',    axis: 'self_execution',     slot: '내적 동기', purpose: '의미 동기' },
  { q: 'Q57',    axis: 'self_execution',     slot: '외적 동기', purpose: '보상·구조 동기' },
  { q: 'Q59~Q62',axis: 'self_design',        slot: '4축 점수(자기설계)', purpose: '원칙·기준' },
  { q: 'Q63',    axis: '④나침반 (compass)',   slot: 'compass_raw → COMPASS_MISSION/VISION', purpose: '사명 나침반 절·비전 정체성' },
  { q: 'Q65',    axis: 'self_design',        slot: '판단 영향 요인', purpose: '의사결정 패턴' },
  { q: 'Q67~Q70',axis: 'self_design',        slot: '4축 점수(자기설계)', purpose: '계획·실행' },
  { q: 'Q71',    axis: 'self_design',        slot: '계획 스타일', purpose: '설계 결' },
  { q: 'Q73',    axis: 'self_design',        slot: '성취 정의', purpose: '결과 의미' },
  { q: 'Q75',    axis: '②도메인 (mission)',  slot: 'domains → primary/secondary domain', purpose: '사명 도메인절' },
  { q: 'Q77',    axis: 'self_design',        slot: '활동 영역', purpose: '진로 매핑' }
];

// ── 5톤 × 9 Compass 매트릭스 (헤드라인 동사 라이브러리에서 추출) ──
const COMPASS_KEYS = [
  '의미 / 보람 / 가치',
  '안정성 / 안전 / 예측 가능성',
  '성장 가능성 / 배움의 기회',
  '자유 / 자율성',
  '관계 / 소속감 / 인정',
  '결과 / 성과 / 효율성',
  '재미 / 흥미 / 몰입감',
  '신념 / 원칙 / 종교적 기준',
  '책임 / 도리 / 역할 충실'
];
const COMPASS_LABELS = ['의미','단단함','배움','자기 호흡','사람','결과','몰입','원칙','책임'];

// ── 사명/비전 3-Tier 골격 정의 ──
const SPEC = {
  tier1_headline: {
    mission: { formula: '[Q75 도메인 주체]이 [Q13 × Q63 → 변화 동사구].',
               example: '일하는 사람이 마음을 잇고 의미를 더한다.' },
    vision:  { formula: '[Q13 × Q63 → 회상 정체성 명사구]으로 기억된다.',
               example: '곁에 있으면 의미가 살아나는 사람으로 기억된다.' }
  },
  tier2_subline: {
    mission: { formula: '[primary]와/과 [secondary]의 자리에서, [Compass 키워드]을(를) 나침반 삼아.',
               example: '경제와 교육의 자리에서, 의미를 나침반 삼아.' },
    vision:  { formula: '10년 뒤, [primary]와/과 [secondary]의 자리에서 [Compass 키워드]을(를) 잃지 않은 사람으로.',
               example: '10년 뒤, 경제와 교육의 자리에서 의미를 잃지 않은 사람으로.' }
  },
  tier3_diary: {
    mission: { formula: '나는 [Q63 why-자연어] 늘 분명히 하면서, [Q75 분야]에서 [곁의 대상] 곁에 (특히 [Q41 장면]), [정체성A]이자 [정체성B]으로 매일을 살아간다.',
               example: '나는 왜 이 일을 하는지 늘 분명히 하면서, 경제 분야에서 일하는 사람들 곁에 (특히 누군가 배우는 길목에서), 마음을 열어주는 따뜻한 사람이자 곁에 있어주는 사람으로 매일을 살아간다.' },
    vision:  { formula: '10년 뒤 사람들은 나를 "[정체성A]", "[정체성B]", "[whyId 정체성]"으로 기억한다.',
               example: '10년 뒤 사람들은 나를 "마음을 열어주는 따뜻한 사람", "곁에 있어주는 사람", "왜 이 일을 하는지 분명한 사람"으로 기억한다.' }
  }
};

// ── 정규화 가드 규칙 ──
const GUARDS = [
  { name: '의문형 명사절 조사 차단',
    pattern: '/(는지|을지|할지|런지|을까|는가|할까)$/',
    rule: '명사절 어미가 의문형으로 끝나면 "을/를" 첨가하지 않음',
    where: '_whyNatural() — report-engine-v4.js' },
  { name: '`특히 특히` 중복 차단',
    pattern: '/(특히\\s+){2,}/g → "특히 "',
    rule: 'topic_scene 라이브러리는 이미 "특히 ~" 시작이므로 외부에서 "특히" 추가 금지',
    where: '_scenePrefix() + 메인 사명 빌더 — report-engine-v4.js' },
  { name: '비전 헤드라인 인용 정리',
    pattern: '/\\s*(?:으로|로)\\s*기억된다\\s*$/',
    rule: '인용("...") 안에서 명사구만 노출되도록 종결부 제거',
    where: '_stripVisionHeadlineTail() — program-engine.js' },
  { name: '도메인 결합 와/과 조사',
    pattern: '_hangulJong(primary) > 0 ? "과 " : "와 "',
    rule: '받침 있으면 "과", 없으면 "와" — 예술과 미디어 / 경제와 교육',
    where: 'domainPhrase 합성부 — program-engine.js' },
  { name: '으로/로 받침 검사',
    pattern: '_hangulJong(word) === 0 || jong === 8 ? "로" : "으로"',
    rule: '받침 없거나 ㄹ받침이면 "로", 그 외 "으로"',
    where: '_josa_eulo() — report-engine-v4.js' },
  { name: '마침표 인용 정리',
    pattern: '/[.。!?！？]+$/',
    rule: '인용 부호 안 들어가는 헤드라인은 끝마침표 자동 제거',
    where: '_stripTrailingPunct() — program-engine.js' }
];

// ── 톤별 nut Routine ──
const TONE_ROUTINES = {
  principled_designer: '철학 언어화 → 깊은 대화 → 실제 역할 경험',
  warm_connector:      '마음 듣기 → 의미 새기기 → 신뢰로 잇기',
  visionary_creator:   '아이디어 캡처 → 프로토타입 발행 → 비전 정련',
  pragmatic_achiever:  '1순위 결정 → 집중 블록 → 분기 회고',
  reflective_explorer: '질문 다듬기 → 작은 실험 → 조용한 회고'
};

// ── 빌드 메타 ──
const meta = {
  title: 'Life Portfolio v4.1 Production Kit',
  subtitle: '인생포트폴리오 v4.1 — 신규 규칙 제작서 · 5톤 샘플 · 매뉴얼',
  version: 'v4.1',
  generatedAt: new Date().toISOString().slice(0, 10),
  audience: 'AI · 사람 (수동 제작 매뉴얼)',
  prRef: 'PR #51 (genspark_ai_developer → main)',
  note: '본 문서는 v4.1 production rule을 사람과 AI 모두가 동일 결과로 재현할 수 있도록 정리한 매뉴얼입니다.'
};

const data = {
  meta: meta,
  spec: SPEC,
  guards: GUARDS,
  questionSlotMap: QUESTION_SLOT_MAP,
  questions76: allQuestions76,
  qaItems: QA_ITEMS,
  compassKeys: COMPASS_KEYS,
  compassLabels: COMPASS_LABELS,
  tones: TONES,
  toneRoutines: TONE_ROUTINES,
  samples: samples
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'kit_data.json'), JSON.stringify(data, null, 2));

console.log('[assemble_data] OK');
console.log('  tones         :', TONES.length);
console.log('  samples       :', samples.length);
console.log('  qaItems       :', QA_ITEMS.length);
console.log('  questionSlotMap:', QUESTION_SLOT_MAP.length);
console.log('  questions76   :', allQuestions76.length);
console.log('  guards        :', GUARDS.length);
console.log('  output        :', path.join(outDir, 'kit_data.json'));
console.log('  size          :', fs.statSync(path.join(outDir, 'kit_data.json')).size, 'bytes');
