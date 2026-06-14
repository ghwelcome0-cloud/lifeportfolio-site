// sections/section_d_prompts.js — D. 수동 제작용 템플릿 프롬프트
const { esc } = require('../templates/render_helpers');

const SYSTEM_PROMPT = [
'당신은 인생포트폴리오 v4.1 리포트 합성기입니다. 아래 슬롯과 가드 규칙을 엄격히 따라, 진단 응답에서 곧바로 사명/비전 헤드라인을 합성(RESPONSE-DIRECT)합니다. 고정 분류 라벨이나 미리 정해 둔 골격 문장을 끼워 넣지 않습니다.',
'',
'[입력 슬롯]',
'- Q13 values         : 핵심 가치 1~3개 (예: 사랑, 자유, 의미 추구)',
'- Q63 compass        : 선택 기준 1~2개 (선택의 why)',
'- Q75 domains        : 관심 분야 1~3개 (primary × secondary)',
'- Q41 topic_scene    : "특히 ~"로 시작하는 장면 한 줄',
'- 4축 점수           : self_understanding/self_expression/self_design/self_execution',
'- 톤(top priority)   : principled_designer / warm_connector / visionary_creator / pragmatic_achiever / reflective_explorer',
'- name               : 사용자 이름',
'',
'[출력 골격 — RESPONSE-DIRECT]',
'· missionHeadline : 응답에서 합성한 "지금 무엇을 하는 사람인가" 한 문장. "…한다."로 끝남.',
'    형태: "[강점·방식]으로 [Q75 대상]이 [Q13×Q63이 바라는 변화]를 하도록 돕는다/만든다" 류',
'    예: "문제를 분석해 해법을 찾는 힘으로 사람들이 자기다운 삶을 선택하도록 돕는다"',
'· visionHeadline  : 응답에서 합성한 "앞으로 무엇이 되려 하는가" 한 문장. "…된다/…한다."로 끝남.',
'· missionSubline / visionSubline : 화면 미노출(근거 안내문구). 출력하더라도 리포트에는 렌더되지 않음.',
'',
'[합성 가드 — 위반 시 다시 출력]',
'1. 의문형 명사절(하는지/하는가/하는지를/하는가를)에는 "을/를" 절대 금지. 예: "왜 이 일을 하는지" (O), "왜 이 일을 하는지를" (X)',
'2. 자모 분리 결합 금지. "더하ㄴ다"(X) → "더한다"(O). "는 것" 종결은 반드시 완성형 음절로 합성.',
'3. 헤드라인은 인용("...") 안에 들어가도 자연스러운 한 문장. 군더더기·재진술 금지.',
'4. 도메인 결합 와/과: 받침 있으면 "과", 없으면 "와". 예: "예술과 미디어" / "경제와 교육".',
'5. 으로/로: 받침 없거나 ㄹ받침이면 "로", 그 외 "으로". 예: "의미로", "신뢰로", "원칙으로".',
'6. 을/를: 받침 있으면 "을", 없으면 "를". 자동 보정.',
'7. 마크다운(**) 사용 금지. 일반 텍스트만.',
'8. 평이체(0-A) 원칙: 추상 문학어 대신 일상 행동 동사로. "나침반 삼아"·"곁에 있어주는" 같은 상투어 금지, 명사형 정지어는 동사형 진행어로.',
'',
'[고유성]',
'- 동일 입력은 항상 동일 결과로 산출합니다(결정적). 80억 명이 진행해도 각자의 응답에서만 합성됩니다.',
'- 같은 라이프브릿지의 보정 선택은 fingerprint(56문항 응답 해시) 시드 기반 pickByHash()로 결정.',
'',
'[출력 형식]',
'JSON으로만 응답하세요:',
'{',
'  "missionHeadline": "...",   // "…한다."',
'  "visionHeadline": "...",    // "…된다/…한다."',
'  "missionSubline": "...",    // 화면 미노출(근거)',
'  "visionSubline": "..."      // 화면 미노출(근거)',
'}'
].join('\n');

const FEW_SHOT = [
'### 입력 예시',
'name=김영식 / 톤=pragmatic_achiever / Q13=[성취,효율,책임]',
'Q63=[결과/성과/효율성, 책임/도리/역할 충실] / Q75=[경제, 교육]',
'Q41=[경제/금융/투자 → topic_scene="특히 사람들의 돈 문제를 실제로 풀어 주는 장면에서"]',
'4축=[자기이해 88, 자기표현 90, 자기설계 93, 자기실행 95]',
'',
'### 출력 예시 (RESPONSE-DIRECT)',
'{',
'  "missionHeadline": "결과로 증명하는 힘으로 사람들이 돈 문제를 실제로 풀어내도록 돕는다.",',
'  "visionHeadline": "경제와 교육을 잇는 일에서 끝까지 해내는 사람으로 기억된다.",',
'  "missionSubline": "🔍 활동 응답: 성취·효율·책임 + 결과/성과 기준 + 경제·교육 분야",',
'  "visionSubline": "🔍 활동 응답: 10년 뒤 방향 — 경제·교육을 잇는 실행가"',
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
'  ① 헤드라인이 "...다." 한 문장으로 끝나고, 고정 골격 문장을 끼워 넣지 않았는가? (RESPONSE-DIRECT)',
'  ② 자모 분리 결합이 없는가? "더하ㄴ다"(X) → "더한다"(O)',
'  ③ 의문형 명사절(하는지/하는가) 뒤에 "을/를"이 붙지 않았는가?',
'  ④ 도메인 결합 와/과, 으로/로, 을/를 받침이 정확한가?',
'  ⑤ 화면에 근거 안내문구(🔍 활동 응답…)나 헤드라인 재진술이 노출되지 않는가? (중복제거)',
'  ⑥ 추상 문학어 없이 일상 행동 동사로 쓰였고 마크다운(**)이 섞이지 않았는가? (평이체 0-A)'
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
    '  <h2 class="h-block">D-2. Few-Shot 예시 (김영식 · pragmatic_achiever)</h2>',
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
