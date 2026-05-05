// sections/section_d_prompts.js — D. 수동 제작용 템플릿 프롬프트
const { esc } = require('../templates/render_helpers');

const SYSTEM_PROMPT = [
'당신은 인생포트폴리오 v4.1 리포트 합성기입니다. 아래 슬롯과 가드 규칙을 엄격히 따라 한국어 사명/비전 3-Tier를 출력합니다.',
'',
'[입력 슬롯]',
'- Q13 values         : 핵심 가치 1~3개 (예: 사랑, 자유, 의미 추구)',
'- Q63 compass        : 선택 기준 1~2개 (9 카테고리 중)',
'- Q75 domains        : 관심 분야 1~3개 (primary × secondary)',
'- Q41 topic_scene    : "특히 ~"로 시작하는 장면 라벨',
'- 4축 점수           : self_understanding/self_expression/self_design/self_execution',
'- 톤(top priority)   : principled_designer / warm_connector / visionary_creator / pragmatic_achiever / reflective_explorer',
'- name               : 사용자 이름',
'',
'[출력 골격]',
'Tier ① 헤드라인',
'  Mission: "[Q75 도메인 주체]이 [Q13 × Q63 → 변화 동사구]."',
'  Vision : "[Q13 × Q63 → 회상 정체성 명사구]으로 기억된다."',
'Tier ② 한 줄 설명',
'  Mission: "[primary]와/과 [secondary]의 자리에서, [Compass 키워드]을(를) 나침반 삼아."',
'  Vision : "10년 뒤, [primary]와/과 [secondary]의 자리에서 [Compass 키워드]을(를) 잃지 않은 사람으로."',
'Tier ③ 다이어리 본문',
'  Mission: "나는 [Q63 why-자연어] 늘 분명히 하면서, [Q75 분야]에서 [곁의 대상] 곁에 (특히 [Q41 장면]), [정체성A]이자 [정체성B]으로 매일을 살아간다."',
'  Vision : "10년 뒤 사람들은 나를 \"[정체성A]\", \"[정체성B]\", \"[whyId 정체성]\"으로 기억한다."',
'',
'[필수 가드 — 위반 시 출력 금지]',
'1. 의문형 명사절(는지/는가/을지/할지/할까/을까)에는 "을/를" 첨가 금지. 예: "왜 이 일을 하는지" (O), "왜 이 일을 하는지를" (X)',
'2. topic_scene 라이브러리는 이미 "특히 ~"로 시작 — 외부에서 "특히"를 추가 금지. "특히 특히" 발생 시 1회로 축약.',
'3. 비전 헤드라인이 인용("...") 안에 들어갈 때는 "(으)로 기억된다" 종결 자동 제거 — 명사구만 노출.',
'4. 도메인 결합 와/과: 받침 있으면 "과", 없으면 "와". 예: "예술과 미디어" / "경제와 교육".',
'5. 으로/로: 받침 없거나 ㄹ받침이면 "로", 그 외 "으로". 예: "의미로", "신뢰로", "원칙으로".',
'6. 을/를: 받침 있으면 "을", 없으면 "를". 자동 보정.',
'7. 마크다운(**) 사용 금지. 일반 텍스트만.',
'',
'[결정성]',
'- 동일 입력은 항상 동일 결과를 산출합니다.',
'- 각 라이브러리의 변형 선택은 fingerprint(56문항 응답 해시) 시드 기반 pickByHash()로 결정.',
'',
'[출력 형식]',
'JSON으로만 응답하세요:',
'{',
'  "headline": "...",          // Mission Tier ①',
'  "subline": "...",           // Mission Tier ②',
'  "diaryMission": "...",      // Mission Tier ③',
'  "visionHeadline": "...",    // Vision Tier ①',
'  "visionSubline": "...",     // Vision Tier ②',
'  "diaryVision": "..."        // Vision Tier ③',
'}'
].join('\n');

const FEW_SHOT = [
'### 입력 예시',
'name=김영식 / 톤=warm_connector / Q13=[사랑,자유,의미 추구]',
'Q63=[의미/보람/가치, 신념/원칙/종교적 기준] / Q75=[경제, 교육]',
'Q41=[교육과 학습 방식 → topic_scene="특히 누군가 배우는 길목에서"]',
'4축=[자기이해 90, 자기표현 87, 자기설계 93, 자기실행 93]',
'',
'### 출력 예시',
'{',
'  "headline": "일하는 사람이 마음을 잇고 의미를 더한다.",',
'  "subline": "경제와 교육의 자리에서, 의미를 나침반 삼아.",',
'  "diaryMission": "나는 왜 이 일을 하는지 늘 분명히 하면서, 경제 분야에서 일하는 사람들 곁에 (특히 누군가 배우는 길목에서), 마음을 열어주는 따뜻한 사람이자 곁에 있어주는 사람으로 매일을 살아간다.",',
'  "visionHeadline": "곁에 있으면 의미가 살아나는 사람으로 기억된다.",',
'  "visionSubline": "10년 뒤, 경제와 교육의 자리에서 의미를 잃지 않은 사람으로.",',
'  "diaryVision": "10년 뒤 사람들은 나를 \"마음을 열어주는 따뜻한 사람\", \"곁에 있어주는 사람\", \"왜 이 일을 하는지 분명한 사람\"으로 기억한다."',
'}'
].join('\n');

const SLOT_FORM = [
'[슬롯 입력 양식 — 사람용]',
'',
'■ 기본 정보',
'  이름: __________________',
'',
'■ 가치 (Q13, 1~3개)',
'  □ 사랑   □ 자유   □ 의미 추구   □ 정의   □ 진실   □ 책임',
'  □ 성취   □ 성장   □ 창조        □ 도전   □ 진리 탐구   □ 효율',
'  □ 관계   □ 기타: ___________',
'',
'■ 선택 기준 (Q63, 1~2개)',
'  □ 의미/보람/가치     □ 안정성/안전/예측 가능성',
'  □ 성장 가능성/배움   □ 자유/자율성',
'  □ 관계/소속감/인정   □ 결과/성과/효율성',
'  □ 재미/흥미/몰입감   □ 신념/원칙/종교적 기준',
'  □ 책임/도리/역할 충실',
'',
'■ 분야 (Q75, 1~3개 / 첫 번째 = primary)',
'  primary  : __________________',
'  secondary: __________________ (선택)',
'  tertiary : __________________ (선택)',
'',
'■ 관심 주제 (Q41 → topic_scene)',
'  □ 사회 문제나 정의 이슈     □ 인공지능/기술/혁신',
'  □ 교육과 학습 방식           □ 환경과 생태',
'  □ 심리와 감정 탐구           □ 예술/창작/문화 콘텐츠',
'  □ 경제/금융/투자             □ 스포츠/건강/자기관리',
'  □ 리더십/공동체/관계         □ 철학/종교/영성',
'',
'■ 4축 점수 (0~100 / 검사 결과 그대로)',
'  자기이해(SU): ___   자기표현(SE): ___   자기설계(SD): ___   자기실행(SX): ___',
'',
'■ 톤 우선순위 (자동 결정 — 수동 지정 가능)',
'  □ principled_designer   □ warm_connector   □ visionary_creator',
'  □ pragmatic_achiever    □ reflective_explorer'
].join('\n');

const QUICK_CHECKLIST = [
'[제출 직전 6점 체크 (사람·AI 공용)]',
'  ① 헤드라인이 "...다." 한 문장으로 끝나는가?',
'  ② "특히 특히"가 노출되지 않는가?',
'  ③ "하는가를 / 하는지를" 같은 의문형 + 조사 결합이 없는가?',
'  ④ 도메인 결합 와/과 받침이 정확한가? (예술과/경제와)',
'  ⑤ 비전 헤드라인이 인용 안에 들어갈 때 "(으)로 기억된다"가 자동 제거되어 있는가?',
'  ⑥ Tier ②/③ 본문에 마크다운(**)이 섞여 있지 않은가?'
].join('\n');

module.exports = function renderSectionD(data){
  return [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION D · MANUAL TEMPLATE PROMPT</div>',
    '  <h1 class="section-title">수동 제작용 템플릿 프롬프트</h1>',
    '  <p class="section-lede">사람도 AI도 동일 결과를 만들 수 있도록 정리한 단일 프롬프트 + 슬롯 입력 양식 + few-shot. LLM에게는 그대로 system message로, 사람에게는 작성 매뉴얼로 사용합니다.</p>',
    '  <div class="section-divider"></div>',

    '  <h2 class="h-block">D-1. System Prompt (LLM 전용)</h2>',
    '  <p>아래 텍스트를 LLM의 system 메시지에 그대로 붙여 넣으세요. 가드 위반 시 출력을 거부하도록 설계되어 있습니다.</p>',
    '  <pre class="code">' + esc(SYSTEM_PROMPT) + '</pre>',

    '</section>',

    '<section class="page section">',
    '  <h2 class="h-block">D-2. Few-Shot 예시 (KYS · warm_connector)</h2>',
    '  <p>실제 v4.1 엔진이 합성한 결과를 그대로 정답으로 제시합니다.</p>',
    '  <pre class="code">' + esc(FEW_SHOT) + '</pre>',

    '  <h2 class="h-block">D-3. 슬롯 입력 양식 (사람 전용)</h2>',
    '  <p>인쇄 후 손으로 채우거나, AI 채팅에 붙여 넣어도 작동하도록 평문으로 구성했습니다.</p>',
    '  <pre class="code">' + esc(SLOT_FORM) + '</pre>',

    '</section>',

    '<section class="page section">',
    '  <h2 class="h-block">D-4. 빠른 체크리스트 (제출 직전 6점)</h2>',
    '  <p>출력물을 발송하기 전 사람·AI 모두에게 동일하게 적용되는 마지막 검수 항목입니다. 6점 모두 통과하면 v4.1 production rule을 준수한 결과입니다.</p>',
    '  <pre class="code">' + esc(QUICK_CHECKLIST) + '</pre>',

    '  <div class="callout"><div class="callout-title">사용 패턴</div>',
    '    · <strong>AI 자동 합성</strong>: D-1 + D-2를 system message에 결합 → D-3 양식을 user message로 전달.<br>' +
    '    · <strong>사람 수동 합성</strong>: D-3로 슬롯 채움 → A 섹션의 골격 표 따라 직접 작성 → D-4로 검수.' +
    '  </div>',

    '  <div class="section-footer"><span>D. 템플릿 프롬프트</span><span>사람·AI 공용</span></div>',
    '</section>'
  ].join('\n');
};
