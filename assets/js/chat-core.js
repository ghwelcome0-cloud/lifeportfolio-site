/**
 * chat-core.js — Life Portfolio '말씀 아래, 함께 묻는 코칭 엔진' (규칙 기반, LLM 0원)
 * =============================================================================
 * SSOT: "인생포트폴리오 E그룹 P1.5 AX 동행 챗봇 사양서 v1.0 (최종 잠금본)".
 *   E그룹 P1.5 규칙 기반을 '4층 함께 묻는 코칭 엔진'으로 확장(P1.6).
 *   LLM 미사용. 지식은 빌드타임 정적 JSON. 서버 비용 0.
 *
 * 4층 구조:
 *   [0층] 말씀 최상위 원칙   — scripture-knowledge.json(개역한글판 공개도메인, 원문·출처 보존)
 *   [1층] 안전·헌법 가드레일 — 위기신호·이단어(heresy)·미출시어·never_expose → 규칙 즉시 차단
 *   [2층] 신호 이해 + 되물음 — coaching-knowledge.json 신호감지 → 국면별 되물음(코치는 정답을
 *          주지 않고 되묻는다). 매칭 실패해도 graceful_fail로 떨어지지 않고 신호로 이어감(핵심).
 *   [3층] 곁의 자산 큐레이션 + 착지 — 블로그(curation.pickByAxis) 1편 + (신앙 병행 신호 시) 말씀
 *          1구절[출처 보존]. 발견/살아냄/남김 여정 단계로 착지.
 *
 * 설계 원칙(사양서 정합, 무손상 유지):
 *   - §4 4박자: 짧게 · 공감 한 번 · 지금 자리 · 자연스러운 이어감.
 *   - §5 회원 3분기, §6 미출시 가드레일, §8 6실무질의, §10 안전선 — 문장 그대로 유지.
 *   - 코칭 헌법: 코치 30%/고객 70%, 진단X·교정X·정답강요X·추궁X·압박판매X.
 *   - never_expose 후처리, 로깅 #tone_off/#future_leak/#graceful_fail + #heresy_block/#signal_hit.
 *
 * 노출: window.LP_CHAT = {
 *   greeting(memberState) -> {lines:[], cta:{...}}
 *   respond(text, ctx)    -> {kind, lines:[], ctas:[], reask, safety, phase, signal}
 *   heroReflect(text, ctx)-> {reflect, lines:[], ctas:[]}
 *   memberState()         -> Promise<'guest'|'member_todo'|'member_done'>
 *   sanitize(str)         -> str
 *   loadKnowledge()       -> Promise (coaching + scripture JSON)
 * }
 *
 * 의존(모두 선택적, 없으면 폴백): firebase(auth+db), LP_VISITOR, LP_CURATION, LP.track.
 */
(function (w, d) {
  'use strict';

  /* =========================================================================
   * [0] 링크/앵커 상수 (public 착지점)
   * ========================================================================= */
  var LINK = {
    reportPreview: '#ax-sample',   // 리포트 미리 보기 (홈 샘플 섹션 앵커)
    surveyStart:   'suvey.html',   // 검사 시작 (사이트 전역 정규 경로 · 파일명 컨벤션 suvey.html)
    faq:           '#faq',         // FAQ 앵커
    mypage:        'mypage.html'   // 마이페이지
  };

  function withLang(href) {
    // 앵커(#...)는 그대로. 페이지 이동만 _withLang 적용(EN 컨텍스트 lang 보존).
    if (!href || href.charAt(0) === '#') return href;
    try { if (typeof w._withLang === 'function') return w._withLang(href); } catch (e) {}
    return href;
  }

  /* =========================================================================
   * [1] §5 회원 상태 3분기 — 첫 인사 문장 (사양서 문자 그대로 · 임의 변경 금지)
   * ========================================================================= */
  var GREETING = {
    // 비회원 · 검사 미완료 → 첫 CTA: 리포트 미리 보기
    guest: {
      lines: [
        '오늘 여기까지 오신 것도 이미 오늘의 결 하나예요.',
        '리포트가 어떤 한 권인지 먼저 살짝 보실 수도 있고,',
        '지금 마음에 걸리는 한 가지가 있다면 그것부터 함께 읽어봐도 좋아요.'
      ],
      cta: { label: '리포트 미리 보기', href: LINK.reportPreview, event: 'chat_cta_report_preview' }
    },
    // 회원 · 검사 미완료 → 첫 CTA: 검사 시작 또는 FAQ
    member_todo: {
      lines: [
        '준비되신 만큼만 함께 걸을게요.',
        '검사에 대해 궁금한 게 있다면 그것도 좋고,',
        '요즘 마음에 걸리는 한 가지가 있다면 그것부터 나눠주셔도 괜찮아요.'
      ],
      cta: { label: '검사 시작하기', href: LINK.surveyStart, event: 'chat_cta_survey_start' }
    },
    // 회원 · 검사 완료 → 첫 CTA: 마이페이지 · 지난 리포트 이어 읽기
    member_done: {
      lines: [
        '다시 오셨네요, 곁에 있어 반갑습니다.',
        '지난 한 권에서 이어서 읽어봐도 좋고,',
        '오늘 새로 걸리는 한 문장이 있다면 그것부터 나눠주셔도 돼요.'
      ],
      cta: { label: '마이페이지 · 지난 리포트 이어 읽기', href: LINK.mypage, event: 'chat_cta_mypage_resume' }
    }
  };

  /* =========================================================================
   * [2] §6 미출시 상품 가드레일 (최종 잠금 문장)
   * ========================================================================= */
  var GUARDRAIL = {
    // 6.1 기본 채택(2문장 원형)
    lines: [
      '그 질문을 꺼내주신 것 자체가 이미 다음 걸음의 결이에요.',
      '오늘은 먼저 이 한 권부터 곁에 두시면, 다음 이야기는 저희가 곁에서 이어드릴게요.'
    ],
    // 극압축(1문장) — 문맥이 매우 짧을 때만 예비
    lineShort: '그 질문의 결까지 함께 걸어가고 싶어요. 오늘은 이 한 권부터 곁에 두실래요?'
  };

  // §6.4 절대 언급 금지 단어(미출시 상품·로드맵)
  var FUTURE_WORDS = [
    '전자 다이어리', '다이어리', '1:1 코칭', '1대1 코칭', '코칭',
    '팀 프로젝트', '팀 요금제', '기업 요금제', '자비스', 'jarvis',
    'p2.0', 'p2', '에이전틱', 'agentic', '실시간 에이전트', '에이전트'
  ];
  // 로드맵성 질문 트리거
  var ROADMAP_TRIGGERS = ['언제 나와', '곧 나와', '곧 나오', '출시', '다음 상품', '새 상품', '신제품', '로드맵', '예정'];

  /* =========================================================================
   * [3] §10 안전선 (Safety Rail) — 최우선 감지
   * ========================================================================= */
  var SAFETY = {
    // 위기 신호(자해·자살·심각한 정서 위기)
    crisis: {
      triggers: ['자살', '죽고 싶', '죽고싶', '자해', '살기 싫', '살기싫', '없어지고 싶', '사라지고 싶', '목숨', '끝내고 싶'],
      lines: [
        '지금 그 마음을 여기에 꺼내주셔서 고마워요. 혼자 견디지 않으셨으면 해요.',
        '지금 많이 힘드시다면, 24시간 언제든 도움을 받을 수 있는 곳이 있어요.',
        '자살예방 상담전화 ☎ 109 (24시간) · 정신건강 상담 ☎ 1577-0199.',
        '급히 위험하다고 느껴지면 즉시 112 또는 119로 연락해 주세요.'
      ]
      // 안전선 원칙: 리포트 CTA를 뒤에 붙이지 않는다.
    },
    // 의료·법률·재무 자문성
    advisory: {
      triggers: ['진단해', '처방', '약을', '복용', '치료법', '법적으로', '소송', '고소', '위자료', '투자해', '주식', '코인', '세금 신고', '대출'],
      line: '그 결은 전문 상담 자리에서 함께 읽는 것이 좋겠어요. 여기서는 의료·법률·재무 판단을 대신해 드리진 않아요.'
    },
    // 미성년 감지
    minor: {
      triggers: ['중학생', '고등학생', '초등학생', '미성년', '17살', '16살', '15살', '14살', '13살', '만 15', '만 16', '만 17', '청소년인데'],
      line: '함께 읽어보기 전에, 보호자와 곁에서 같이 보시면 더 좋아요. 그렇게 함께라면 언제든 환영이에요.'
    }
  };

  /* =========================================================================
   * [4] §8 여섯 개 실무 질의 응답 반경 (위젯 전용) — FAQ 원문 재표현(public_quote_ok)
   * ========================================================================= */
  var FAQ = {
    report_structure: {
      triggers: ['리포트 구조', '리포트가 어떤', '몇 단계', '10단', '4축', '무엇을 받', '뭘 받', '뭐가 나와', '어떤 내용', '구성이'],
      lines: [
        '이 한 권은 핵심 한 줄 정의에서 시작해, 강점 TOP3 · 이번 주 첫 행동 3가지(if-then) · 3주 살아내는 루틴까지 하나의 흐름으로 이어져요.',
        '유형으로 나누지 않고, 당신의 응답 조합 그대로를 한 권으로 읽어 드려요.'
      ],
      cta: { label: '리포트 미리 보기', href: LINK.reportPreview, event: 'chat_cta_report_preview' }
    },
    time_count: {
      triggers: ['얼마나 걸', '몇 분', '시간', '몇 문항', '문항 수', '76문항', '76개', '분량', '오래 걸'],
      lines: [
        '평균 15분이면 76문항 응답이 끝나요. 짧지만 이번 주 첫 살아냄까지 정리될 만큼의 결을 담아요.',
        '중간 저장이 되니 한 번에 끝내지 않으셔도 괜찮아요.'
      ],
      cta: { label: '검사 시작하기', href: LINK.surveyStart, event: 'chat_cta_survey_start' }
    },
    price_pay_refund: {
      triggers: ['얼마', '가격', '비용', '결제', '카드', '카카오페이', '페이팔', 'paypal', '환불', '취소', '청약철회', '19900', '19,900'],
      lines: [
        '국내는 19,900원, 세금 포함 단일 가격이에요(추가 비용 없어요).',
        '검사를 시작하시기 전이라면 100% 전액 환불해 드려요. 검사를 시작하신 이후에는 디지털 콘텐츠 특성상 청약철회가 제한될 수 있어요.'
      ],
      cta: { label: '환불 정책 자세히 (FAQ)', href: LINK.faq, event: 'chat_cta_faq_refund' }
    },
    regen_explain: {
      triggers: ['재생성', '다시 만들', '다시 생성', '해설', '설명해', '다시 받', '수정', '재발급'],
      lines: [
        '리포트는 응답 제출 즉시 자동으로 한 권이 만들어지고, 마이페이지에서 언제든 다시 열어 읽으실 수 있어요.',
        '더 자세한 해설·재생성 관련해서는 마이페이지 안에서 이어서 함께 볼 수 있어요.'
      ],
      cta: { label: '마이페이지', href: LINK.mypage, event: 'chat_cta_mypage' }
    },
    data_privacy: {
      triggers: ['개인정보', '데이터', '안전한', '보관', '저장되', '공개되', '유출', '비공개', '내 답변', '제 답변'],
      lines: [
        '응답 데이터는 리포트 생성 외 어떤 용도로도 쓰지 않아요.',
        '본인만 마이페이지에서 확인하실 수 있고, 외부 공개·판매·공유는 일체 없어요.'
      ],
      cta: null
    },
    faith_parallel: {
      triggers: ['기도', '묵상', '말씀', '큐티', '신앙', '종교', '교회', '성경', '대체', '묵상 노트'],
      lines: [
        '아니에요, 대체하지 않아요.',
        '이 한 권은 이미 사용 중인 기도·묵상·말씀 노트 옆에 놓이는 자리예요.',
        '그 위에서 이번 주에 무엇을 살아낼지 한 줄만 더해 드리는 흐름이에요.'
      ],
      cta: null
    }
  };

  /* =========================================================================
   * [5] §7 결 있는 응답 원형 — 4축 감정/의미 질문 (되비춤 + 이한권 재표현 + 되물음)
   *      회사 정보/내부 원칙 노출 유도 대응 포함.
   * ========================================================================= */
  var REFLECT = {
    // 방향
    direction: {
      triggers: ['방향', '길이 안', '어디로', '뭘 해야 할지', '막막', '갈피'],
      reflect: '방향이 흐릿하다는 그 문장, 이미 오늘의 결 하나예요.',
      body: '이 한 권은 방향을 새로 정해 주지 않고, 이미 당신 안에 있는 방향을 한 줄로 또렷하게 읽어 드려요.',
      reask: '어떤 결이 나오는지 먼저 살펴보실래요, 아니면 지금 걸리는 한 문장부터 나눠주실래요?',
      dualCta: true
    },
    // 사명
    mission: {
      triggers: ['사명', '소명', '부르심', '왜 사는', '존재 이유', '사는 이유'],
      reflect: '그 물음을 꺼내신 것 자체가 이미 사명의 자리를 찾고 있다는 뜻이에요.',
      body: '이 한 권은 사명을 만들어 주지 않고, 이미 당신 안에 흐르는 사명의 결을 한 줄로 읽어 드려요.',
      reask: '어떤 문장으로 정리되는지 함께 살펴보실래요?',
      dualCta: false
    },
    // 강점
    strength: {
      triggers: ['강점', '잘하는', '잘 하는', '재능', '장점', '뭘 잘'],
      reflect: '잘하는 것을 자기 입으로 말하기 어렵다는 건, 이미 그 안에 자기 결에 대한 정직함이 있다는 뜻이에요.',
      body: '이 한 권은 76개의 응답을 지나며 당신만의 강점 세 가지를 결로 정리해 드려요.',
      reask: '어떤 결이 나올지 먼저 살짝 보고 싶으시면 리포트 미리 보기도 열어드릴게요.',
      dualCta: false,
      cta: { label: '리포트 미리 보기', href: LINK.reportPreview, event: 'chat_cta_report_preview' }
    },
    // 관계
    relation: {
      triggers: ['관계', '사람들', '인간관계', '동료', '가족', '친구', '외로', '갈등'],
      reflect: '그 문장을 이 자리에서 꺼내신 것만으로도 오늘 하루의 결이 이미 조금 정돈된 셈이에요.',
      body: '이 한 권 안에는 관계 안에서 당신의 강점이 어떻게 드러나는지 읽어드리는 자리도 있어요.',
      reask: '지금 마음에 가장 먼저 걸리는 사람 한 명을 떠올려 보실 수 있을까요?',
      dualCta: false
    },
    // 실행 (이번 주 첫 걸음)
    action: {
      triggers: ['시작이 안', '실행', '미루', '첫 걸음', '못 하겠', '움직이', '행동', '작심삼일'],
      reflect: '시작이 안 된다는 그 자리에서, 이미 첫 걸음의 방향은 정해져 있는 경우가 많아요.',
      body: '이 한 권은 이번 주 첫 걸음 3가지를 if-then 구조로 정리해 드려요.',
      reask: '오늘 하루 안에 붙잡을 수 있는 아주 작은 한 가지부터 함께 골라볼까요?',
      dualCta: false
    }
  };

  // §7 회사 정보·내부 원칙 노출 유도 → principle_only(정신만) 착지
  var COMPANY_PROBE = {
    triggers: ['원칙이 뭐', '무슨 문서', '어떤 문서', '기반이', '내부 규칙', 'ssot', '청사진', '백서', '헌법', '무슨 근거', '어떤 근거'],
    lines: [
      '저희는 \u2018이미 당신 안에 있는 것을 함께 읽는다\u2019는 결 하나를 지켜요.',
      '그 결이 리포트 열 개 자리로 정리되어 곁에 놓여요.'
    ],
    reask: '어떤 자리부터 함께 열어볼까요?'
  };

  /* =========================================================================
   * [6] §4.4 우아한 실패 (graceful failure) — 지어내지 않기
   * ========================================================================= */
  var GRACEFUL_FAIL = '지금은 이 부분까지 곁에서 함께 볼 수 있어요.';

  /* =========================================================================
   * [7] never_expose — 출력 문자열 후처리 블랙리스트 (§2.3)
   *   답변 근거로만 쓰고 출력에서는 차단. 유출 시 로깅(#future_leak 아님 → 별도 처리).
   * ========================================================================= */
  var NEVER_EXPOSE = [
    'SSOT', 'Track 3', 'Track3', '배포헌법', '청사진 카탈로그', '청사진', '정체성 백서', '백서',
    '4원칙', 'Zero-to-One', 'Zero to One', 'App Check', 'AppCheck', 'LP_APPCHECK_ENABLED',
    '--lp-', '--lpx-', 'PR#', 'pull request', 'GitHub', 'git ', 'repository', '리포지토리',
    'firebase', 'RTDB', 'wrangler', 'cloudflare'
  ];

  /**
   * sanitize — 출력 문자열에서 never_expose 항목을 제거/무해화.
   * 사양서 문장(GREETING/FAQ/REFLECT 등)에는 이 단어들이 없으므로 정상 응답은 무손상.
   * 방어적 후처리: 만약 어떤 경로로든 내부 용어가 섞이면 통째로 우아한 실패로 대체.
   */
  function sanitize(str) {
    if (!str) return str;
    var hit = false;
    var low = String(str).toLowerCase();
    for (var i = 0; i < NEVER_EXPOSE.length; i++) {
      if (low.indexOf(String(NEVER_EXPOSE[i]).toLowerCase()) >= 0) { hit = true; break; }
    }
    if (hit) {
      logTag('future_leak', { where: 'sanitize', sample: String(str).slice(0, 40) });
      return GRACEFUL_FAIL;  // 내부 용어가 감지되면 우아한 실패로 착지
    }
    return str;
  }

  /* =========================================================================
   * [7-A] 1층 — 이단(heresy) 필터 (헌법 가드레일)
   *   초원 벤치마크: 목회 자문 기반 이단 필터. 우리는 교리 논쟁·특정 단체
   *   교리 유도에 끌려가지 않고, '말씀이 최상위'라는 겸손한 한 줄로 되돌린다.
   *   → 특정 단체를 정죄·비방하지 않되(명예훼손 금지), 그 방향의 상담을
   *     우리가 대신하지 않고 신뢰할 수 있는 자리로 안내한다.
   * ========================================================================= */
  var HERESY = {
    // 교리 논쟁·이단 단체 유도·재림/교주/구원파류 키워드(감지용, 정죄용 아님)
    triggers: [
      '신천지', '하나님의교회', '안상홍', '통일교', '재림주', '보혜사',
      '교주', '이단', '구원파', '전능신교', '몰몬', '여호와의증인',
      '십사만사천', '144000', '영생교', '만민중앙', '지옥 갈', '구원 확신 없',
      '너희만 구원', '이 단체', '이 교회 다니면'
    ],
    lines: [
      '이 부분은 저희가 함부로 판단하거나 대신 답할 자리가 아니에요.',
      '저희는 특정 교리를 가르치거나 논쟁하지 않아요. 다만 말씀 자체가 무엇보다 높은 자리라는 것만은 분명히 지켜요.',
      '믿음에 관한 깊은 물음은, 신뢰할 수 있는 교회 공동체나 목회자와 함께 나누시길 권해 드려요.'
    ],
    reask: '대신, 지금 당신의 삶에서 함께 풀어보고 싶은 한 가지가 있다면 무엇인가요?'
  };

  /* =========================================================================
   * [7-B] 지식 로더 — 빌드타임 정적 JSON(코칭·말씀) 지연 로드(fetch 1회, 캐시)
   *   실패해도 앱은 규칙만으로 정상 동작(폴백). LLM/서버 비용 0.
   * ========================================================================= */
  var KNOW = { coaching: null, scripture: null };
  var _knowPromise = null;
  var KNOW_URL = { coaching: '/assets/data/coaching-knowledge.json', scripture: '/assets/data/scripture-knowledge.json' };

  function loadKnowledge() {
    if (_knowPromise) return _knowPromise;
    if (typeof w.fetch !== 'function') { _knowPromise = Promise.resolve(KNOW); return _knowPromise; }
    var getJSON = function (url) {
      return w.fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .catch(function () { return null; });
    };
    _knowPromise = Promise.all([getJSON(KNOW_URL.coaching), getJSON(KNOW_URL.scripture)])
      .then(function (res) {
        KNOW.coaching = res[0];
        KNOW.scripture = res[1];
        return KNOW;
      })
      .catch(function () { return KNOW; });
    return _knowPromise;
  }
  // 자동 프리로드(백그라운드) — 첫 신호 감지 시 즉시 사용 가능하도록.
  try { loadKnowledge(); } catch (e) {}

  /* =========================================================================
   * [7-C] 2층 — 신호 감지 + 국면(LP-GROW) 되물음 엔진
   *   설계: 매칭 실패해도 graceful_fail로 떨어지지 않고, 코칭 신호로 이어감(핵심).
   *   코치는 정답을 주지 않고 되묻는다. 코치 30% / 고객 70%.
   * ========================================================================= */
  // 국면 순서(다중 턴 진행): open → reflect → goal → will → map
  var PHASE_ORDER = ['open', 'reflect', 'goal', 'will', 'map'];

  // 신호 감지: coaching.signals[].keywords 중 최다 매칭 신호를 고른다(없으면 null).
  function detectSignal(low) {
    var c = KNOW.coaching;
    if (!c || !c.signals) return null;
    var best = null, bestHits = 0;
    for (var i = 0; i < c.signals.length; i++) {
      var s = c.signals[i], hits = 0;
      var kws = s.keywords || [];
      for (var j = 0; j < kws.length; j++) {
        if (low.indexOf(String(kws[j]).toLowerCase()) >= 0) hits++;
      }
      if (hits > bestHits) { bestHits = hits; best = s; }
    }
    return best; // {id,label,journey,axis,keywords}
  }

  // 곤란 상황 플레이북(짧은/회의적/정답요구/감정) 감지.
  //   ⚠ 부분문자열 오탐 방지: silent_or_short(몰라/그냥/음/...)는 '짧은 단독 입력'
  //     (원문 12자 이하)일 때만 발동. 긴 문장의 부분문자열로는 잡지 않는다.
  function detectPlaybook(low, rawLen) {
    var c = KNOW.coaching;
    if (!c || !c.playbook) return null;
    var keys = Object.keys(c.playbook);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'note') continue;
      var p = c.playbook[k];
      if (!p || !p.triggers) continue;
      if (k === 'silent_or_short' && rawLen > 12) continue; // 짧은 입력에만
      if (hasAny(low, p.triggers)) return p; // {triggers,line,reask}
    }
    return null;
  }

  // 반론(objection) 감지 — MBTI 차이/값어치/바쁨. 압박 없이 '먼저 도와주기'.
  function detectObjection(low) {
    var c = KNOW.coaching;
    if (!c || !c.objections) return null;
    var keys = Object.keys(c.objections);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === 'note') continue;
      var o = c.objections[keys[i]];
      if (o && o.triggers && hasAny(low, o.triggers)) return o; // {triggers,line}
    }
    return null;
  }

  // 다음 국면 결정: ctx.thread(대화 히스토리)의 봇 응답 수로 진행도 근사.
  function nextPhaseKey(ctx) {
    var turns = 0;
    try {
      var th = ctx && ctx.thread;
      if (th && th.length) {
        for (var i = 0; i < th.length; i++) {
          var m = th[i];
          if (m && (m.role === 'bot' || m.who === 'bot')) turns++;
        }
      } else if (ctx && typeof ctx.botTurns === 'number') {
        turns = ctx.botTurns;
      }
    } catch (e) {}
    var idx = turns; // 0번째 봇응답=open, 그 다음=reflect ...
    if (idx >= PHASE_ORDER.length) idx = PHASE_ORDER.length - 1; // map에서 고정
    return PHASE_ORDER[idx];
  }

  // 국면 되물음 1개 선택(회전) — 같은 국면 내에서 다양성 확보.
  function pickReask(phaseKey, ctx) {
    var c = KNOW.coaching;
    if (!c || !c.phases || !c.phases[phaseKey]) return null;
    var arr = c.phases[phaseKey].reasks || [];
    if (!arr.length) return null;
    var seed = 0;
    try { seed = (ctx && ctx.thread && ctx.thread.length) ? ctx.thread.length : 0; } catch (e) {}
    return arr[seed % arr.length];
  }

  // 코칭 대화가 이미 열려 있는지: 직전 신호가 있거나, 봇 응답이 1회 이상 오갔는지.
  function isConversing(ctx) {
    try {
      if (ctx && ctx.lastSignal) return true;
      var th = ctx && ctx.thread;
      if (th && th.length) {
        for (var i = 0; i < th.length; i++) {
          var m = th[i];
          if (m && (m.role === 'bot' || m.who === 'bot')) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // 신호 id로 여정(발견/살아냄/남김) 되찾기.
  function journeyOfSignal(signalId) {
    var c = KNOW.coaching;
    if (!c || !c.signals || !signalId) return null;
    for (var i = 0; i < c.signals.length; i++) {
      if (c.signals[i].id === signalId) return c.signals[i].journey;
    }
    return null;
  }

  // 목격 한 줄(신호별 공감) — 평가 아닌 '보았다'.
  function witnessFor(signalId) {
    var c = KNOW.coaching;
    if (!c || !c.witness_lines) return null;
    return c.witness_lines[signalId] || null;
  }

  // 재구성(reframe) — 특정 신호에서 '실패→살아냄' / '회피→접근' 전환 예시.
  function reframeFor(signalId) {
    var c = KNOW.coaching;
    if (!c || !c.reframes) return null;
    for (var i = 0; i < c.reframes.length; i++) {
      var r = c.reframes[i];
      if (r.trigger_signals && r.trigger_signals.indexOf(signalId) >= 0) return r; // {pattern,example}
    }
    return null;
  }

  /* =========================================================================
   * [7-D] 3층 — 곁의 자산 큐레이션(블로그) + 말씀 착지
   * ========================================================================= */
  // 신앙 병행(faith_parallel) 신호: 명시적 신앙 언급이 있을 때만 말씀을 곁들인다.
  var FAITH_WORDS = [
    '하나님', '하느님', '예수', '주님', '성경', '말씀', '기도', '신앙', '믿음',
    '교회', '성령', '은혜', '주께', '그리스도', '하나님의', '축복'
  ];
  function isFaithParallel(low) { return hasAny(low, FAITH_WORDS); }

  // 감지 신호의 axis로 말씀 1구절 선택(신호 id 일치 우선, 없으면 axis 일치).
  function pickVerse(signal, low) {
    var s = KNOW.scripture;
    if (!s || !s.verses || !signal) return null;
    var byAxis = null;
    for (var i = 0; i < s.verses.length; i++) {
      var v = s.verses[i];
      // 신호 키워드가 구절 signals에 포함되면 최우선
      if (v.signals) {
        for (var j = 0; j < v.signals.length; j++) {
          if (low.indexOf(String(v.signals[j]).toLowerCase()) >= 0) return v;
        }
      }
      if (!byAxis && v.axis === signal.axis) byAxis = v;
    }
    return byAxis;
  }

  // 블로그 큐레이션 카드 1장(LP_CURATION.pickByAxis). 비동기 → Promise 반환.
  function pickBlog(axis, lng) {
    try {
      if (w.LP_CURATION && typeof w.LP_CURATION.pickByAxis === 'function') {
        var out = w.LP_CURATION.pickByAxis(axis, { lang: lng || 'ko' });
        // pickByAxis가 Promise일 수도, 즉시값일 수도 있음 → 통일
        return Promise.resolve(out);
      }
    } catch (e) {}
    return Promise.resolve(null);
  }

  // 여정 단계(발견/살아냄/남김)별 착지 CTA 라벨 매핑.
  function landingCtasFor(journey) {
    // 공통: 검사 시작 / 리포트 미리 보기. 여정에 따라 순서·강조만 다르게.
    var report = { label: '리포트 미리 보기', href: withLang(LINK.reportPreview), event: 'chat_cta_report_preview' };
    var survey = { label: '검사 시작하기', href: withLang(LINK.surveyStart), event: 'chat_cta_survey_start' };
    if (journey === '남김') return [report, survey];
    if (journey === '살아냄') return [survey, report];
    return [report, survey]; // 발견(기본)
  }

  /* =========================================================================
   * [8] 로깅 태그 (#tone_off / #future_leak / #graceful_fail / #heresy_block / #signal_hit)
   * ========================================================================= */
  function track(event, params) {
    try { if (w.LP && typeof w.LP.track === 'function') w.LP.track(event, params || {}); } catch (e) {}
  }
  function logTag(tag, params) {
    // 사양서 §11: 세 태그만 우선 수집.
    track('chat_' + tag, params || {});
    try { (w.__LP_CHAT_LOG = w.__LP_CHAT_LOG || []).push({ tag: tag, at: Date.now(), p: params || {} }); } catch (e) {}
  }

  // 여기까지 SSOT 상수/후처리/로깅. 응답 라우팅 로직은 아래 이어서 정의.
  w.LP_CHAT = w.LP_CHAT || {};
  w.LP_CHAT._const = { GREETING: GREETING, GUARDRAIL: GUARDRAIL, FAQ: FAQ, REFLECT: REFLECT, SAFETY: SAFETY, HERESY: HERESY };
  w.LP_CHAT._know = KNOW;
  w.LP_CHAT.sanitize = sanitize;
  w.LP_CHAT._link = LINK;
  w.LP_CHAT._withLang = withLang;
  w.LP_CHAT._logTag = logTag;
  w.LP_CHAT._graceful = GRACEFUL_FAIL;

  // ─────────────────────────────────────────────────────────────────────────
  // 이하 [9] 판정/라우팅 로직 — 별도 IIFE 없이 같은 스코프에서 이어짐.
  // ─────────────────────────────────────────────────────────────────────────

  function hasAny(low, arr) {
    for (var i = 0; i < arr.length; i++) {
      if (low.indexOf(String(arr[i]).toLowerCase()) >= 0) return true;
    }
    return false;
  }

  /* [9-1] §5 회원 상태 3분기 판정 (Firebase 실시간 → 폴백 visitor-context)
   *   guest        : 비로그인
   *   member_todo  : 로그인 O + submitted 세션 0 (결제 전/후 미시작 모두 포함)
   *   member_done  : 로그인 O + submitted 세션 ≥ 1
   */
  function memberState() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(s) { if (!done) { done = true; resolve(s); } }
      // 안전 타임아웃: 판정 지연 시 폴백
      var to = setTimeout(function () { finish(fallbackState()); }, 2500);

      try {
        if (!(w.firebase && w.firebase.auth)) { clearTimeout(to); return finish(fallbackState()); }
        var auth = w.firebase.auth();
        var user = auth.currentUser;

        var evaluate = function (u) {
          if (!u) { clearTimeout(to); return finish('guest'); }
          // 로그인됨 → responses/{uid} submitted 세션 수로 완료 여부 판정
          try {
            if (!(w.firebase.database)) { clearTimeout(to); return finish('member_todo'); }
            var db = w.firebase.database();
            db.ref('responses/' + u.uid).get().then(function (snap) {
              clearTimeout(to);
              var used = 0;
              if (snap && snap.exists()) {
                var val = snap.val() || {};
                Object.keys(val).forEach(function (k) {
                  if (k === '_active') return;           // 포인터 노드 제외
                  var s = val[k];
                  if (s && s.status === 'submitted') used++;
                });
              }
              finish(used > 0 ? 'member_done' : 'member_todo');
            }).catch(function () { clearTimeout(to); finish('member_todo'); });
          } catch (e) { clearTimeout(to); finish('member_todo'); }
        };

        if (user) { evaluate(user); }
        else {
          // currentUser 아직 미확정 → onAuthStateChanged 1회 대기
          var unsub = auth.onAuthStateChanged(function (u) {
            try { if (typeof unsub === 'function') unsub(); } catch (e) {}
            evaluate(u);
          });
        }
      } catch (e) { clearTimeout(to); finish(fallbackState()); }
    });
  }

  // 폴백: visitor-context 로컬 신호로 3분기 근사 (Firebase 미가용 시)
  function fallbackState() {
    try {
      if (w.LP_VISITOR && typeof w.LP_VISITOR.context === 'function') {
        var c = w.LP_VISITOR.context();
        if (c && c.hasReport) return 'member_done';
        // 로컬로는 로그인 여부를 확신 못 하므로 보수적으로 guest 처리
        return 'guest';
      }
    } catch (e) {}
    return 'guest';
  }

  /* [9-2] §5 첫 인사 */
  function greeting(state) {
    var g = GREETING[state] || GREETING.guest;
    return {
      lines: g.lines.slice(),
      cta: { label: g.cta.label, href: withLang(g.cta.href), event: g.cta.event }
    };
  }

  /* [9-3] 위젯 응답 라우팅 (대화 지속형)
   *   우선순위: 안전선 > 미출시 가드레일 > 회사정보 유도 > 6실무질의 > 4축 되비춤 > 우아한 실패
   *   반환: { kind, lines:[], ctas:[{label,href,event}], reask, safety:bool }
   */
  function respond(text, ctx) {
    var q = String(text || '').trim();
    var low = q.toLowerCase();
    ctx = ctx || {};

    if (!q) {
      return { kind: 'empty', lines: ['한 줄만 적어주셔도 괜찮아요.'], ctas: [], reask: null, safety: false };
    }

    // (1) 안전선 — 최우선 (§10, 1층)
    if (hasAny(low, SAFETY.crisis.triggers)) {
      logTag('graceful_fail', { reason: 'safety_crisis' });
      return { kind: 'safety_crisis', lines: SAFETY.crisis.lines.slice(), ctas: [], reask: null, safety: true };
    }
    if (hasAny(low, SAFETY.advisory.triggers)) {
      return { kind: 'safety_advisory', lines: [SAFETY.advisory.line], ctas: [], reask: null, safety: true };
    }
    if (hasAny(low, SAFETY.minor.triggers)) {
      return { kind: 'safety_minor', lines: [SAFETY.minor.line], ctas: [], reask: null, safety: true };
    }

    // (1.5) 이단 필터 — 헌법 가드레일 (1층). 교리 논쟁·이단 유도 → 겸손한 되돌림.
    if (hasAny(low, HERESY.triggers)) {
      logTag('heresy_block', { reason: 'doctrine_or_cult' });
      return {
        kind: 'heresy_block',
        lines: HERESY.lines.slice(),
        ctas: [],
        reask: HERESY.reask,
        safety: true
      };
    }

    // (2) 미출시 가드레일 (§6) — 금지 단어 또는 로드맵 질문
    if (hasAny(low, FUTURE_WORDS) || hasAny(low, ROADMAP_TRIGGERS)) {
      logTag('future_leak', { reason: 'roadmap_or_future_word' });
      var short = q.length <= 8;
      return {
        kind: 'guardrail',
        lines: short ? [GUARDRAIL.lineShort] : GUARDRAIL.lines.slice(),
        ctas: [], reask: null, safety: false
      };
    }

    // (3) 회사 정보·내부 원칙 노출 유도 (§7)
    if (hasAny(low, COMPANY_PROBE.triggers)) {
      return {
        kind: 'company_probe',
        lines: COMPANY_PROBE.lines.slice(),
        ctas: [{ label: '리포트 미리 보기', href: withLang(LINK.reportPreview), event: 'chat_cta_report_preview' }],
        reask: COMPANY_PROBE.reask, safety: false
      };
    }

    // (4) 6개 실무 질의 (§8)
    var faqKey = matchKey(low, FAQ);
    if (faqKey) {
      var f = FAQ[faqKey];
      var ctas = [];
      if (f.cta) ctas.push({ label: f.cta.label, href: withLang(f.cta.href), event: f.cta.event });
      return { kind: 'faq:' + faqKey, lines: f.lines.slice(), ctas: ctas, reask: null, safety: false };
    }

    // (5) 4축 되비춤 (§7 결 있는 응답)
    var rKey = matchKey(low, REFLECT);
    if (rKey) {
      var r = REFLECT[rKey];
      var rCtas = [];
      if (r.dualCta) {
        rCtas.push({ label: '리포트 미리 보기', href: withLang(LINK.reportPreview), event: 'chat_cta_report_preview' });
        rCtas.push({ label: '검사 시작하기', href: withLang(LINK.surveyStart), event: 'chat_cta_survey_start' });
      } else if (r.cta) {
        rCtas.push({ label: r.cta.label, href: withLang(r.cta.href), event: r.cta.event });
      }
      return {
        kind: 'reflect:' + rKey,
        lines: [r.reflect, r.body],
        ctas: rCtas,
        reask: r.reask,      // 위젯: 매 응답 끝 '결 있는 되물음' 우선
        safety: false
      };
    }

    // (5.5) 반론(objection) — MBTI 차이/값어치/바쁨. 압박 없이 먼저 도와주기(2층).
    //   반론은 명시적 표현이라 신호보다 앞: 판매 오해를 먼저 풀어준다.
    var obj = detectObjection(low);
    if (obj) {
      logTag('signal_hit', { kind: 'objection' });
      return {
        kind: 'objection',
        lines: [obj.line],
        ctas: [{ label: '리포트 미리 보기', href: withLang(LINK.reportPreview), event: 'chat_cta_report_preview' }],
        reask: '더 궁금하신 게 있으면 편하게 물어보셔도 좋아요.',
        safety: false
      };
    }

    // (6) 2층 — 신호 감지 되물음 (매칭 실패해도 graceful_fail로 떨어지지 않음: 핵심)
    //   신호가 명확하면 응급 플레이북보다 신호 코칭을 우선한다.
    var sig = detectSignal(low);
    if (sig) {
      logTag('signal_hit', { signal: sig.id, journey: sig.journey, axis: sig.axis });

      var phaseKey = nextPhaseKey(ctx);
      var lines = [];

      // ② 목격 한 줄(평가 아닌 '보았다') — 첫 감지 때만(대화 중 반복 방지).
      //   같은 신호가 이미 오간 대화면 목격 반복 대신 바로 다음 국면으로.
      var repeating = isConversing(ctx) && (ctx && ctx.lastSignal === sig.id);
      var witness = witnessFor(sig.id);
      if (witness && !repeating) lines.push(witness);

      // 재구성(reframe): 해당 신호에 있으면 되물음형 예시로 곁들임.
      var rf = reframeFor(sig.id);
      if (rf && rf.example && (phaseKey === 'reflect' || phaseKey === 'goal')) {
        lines.push(rf.example);
      }

      // 되물음: 국면별 질문은행에서 선택(코치는 되묻는다).
      var reask = pickReask(phaseKey, ctx) || '지금 마음에 가장 먼저 떠오르는 한 가지는 무엇인가요?';

      // 3층 착지 CTA(여정별). 블로그 카드·말씀은 비동기로 onEnrich 통해 보강.
      var ctas = landingCtasFor(sig.journey);

      var result = {
        kind: 'signal:' + sig.id,
        lines: lines.length ? lines : ['지금 그 마음을, 여기서 같이 한 걸음씩 따라가 볼게요.'],
        ctas: ctas,
        reask: reask,
        safety: false,
        signal: sig.id,
        journey: sig.journey,
        axis: sig.axis,
        phase: phaseKey
      };

      // 3층 비동기 보강(블로그 1편 + 신앙 병행 시 말씀 1구절).
      var faith = isFaithParallel(low);
      if (typeof (ctx && ctx.onEnrich) === 'function') {
        pickBlog(sig.axis, ctx.lang).then(function (pick) {
          var enrich = { blog: null, verse: null };
          if (pick && pick.asset) {
            var a = pick.asset;
            var url = (w.LP_CURATION && w.LP_CURATION.assetUrl) ? w.LP_CURATION.assetUrl(a, ctx.lang || 'ko') : (a.url_ko || '');
            var title = (w.LP_CURATION && w.LP_CURATION.assetTitle) ? w.LP_CURATION.assetTitle(a, ctx.lang || 'ko') : (a.title_ko || '');
            enrich.blog = { title: title, url: url, quote: a.core_quote || '', reason: pick.reason || '' };
          }
          if (faith) {
            var v = pickVerse(sig, low);
            if (v) {
              // 말씀 헌법: 일상어(everyday) 먼저, 원문·출처 함께. 원문 없이 단독 노출 금지.
              enrich.verse = {
                everyday: v.everyday || '',
                source_text: v.source_text_krv || '',
                reference: v.reference || '',
                translation: (KNOW.scripture && KNOW.scripture.meta && KNOW.scripture.meta.translation)
                  ? KNOW.scripture.meta.translation.name : '개역한글판'
              };
            }
          }
          try { ctx.onEnrich(enrich, result); } catch (e) {}
        });
      }

      return result;
    }

    // (6.5) 곤란 상황 플레이북 — 신호가 없을 때만 응급 대사(짧은/회의적/정답요구/감정).
    //   silent_or_short는 짧은 단독 입력(≤12자)에만 발동(부분문자열 오탐 방지).
    var pb = detectPlaybook(low, q.length);
    if (pb) {
      logTag('signal_hit', { kind: 'playbook' });
      return {
        kind: 'playbook',
        lines: [pb.line],
        ctas: [],
        reask: pb.reask || null,
        safety: false
      };
    }

    // (6.7) 대화 지속 fallback — 이미 코칭 대화가 열려 있으면(직전 신호/봇 응답 존재),
    //   신호를 못 잡아도 graceful_fail로 끊지 않고 직전 여정의 국면을 이어간다.
    //   (자비스처럼 곁에서 함께 걷기 — 대화 중간의 짧은 응답도 받아 안는다.)
    if (isConversing(ctx)) {
      logTag('signal_hit', { kind: 'continue', last: (ctx && ctx.lastSignal) || null });
      var contPhase = nextPhaseKey(ctx);
      var contReask = pickReask(contPhase, ctx) || '지금 떠오르는 대로, 한 가지만 더 들려주실 수 있을까요?';
      var contJourney = journeyOfSignal(ctx && ctx.lastSignal) || '발견';
      return {
        kind: 'continue',
        lines: ['네, 그 마음 잘 듣고 있어요. 조금 더 함께 따라가 볼게요.'],
        ctas: landingCtasFor(contJourney),
        reask: contReask,
        safety: false,
        phase: contPhase,
        signal: (ctx && ctx.lastSignal) || null,
        journey: contJourney
      };
    }

    // (7) 우아한 실패 (§4.4) — 대화가 열려있지도, 어떤 신호도 없을 때만. 지어내지 않기.
    logTag('graceful_fail', { reason: 'out_of_scope', len: q.length });
    return {
      kind: 'graceful_fail',
      lines: [GRACEFUL_FAIL],
      ctas: [{ label: '검사 시작하기', href: withLang(LINK.surveyStart), event: 'chat_cta_survey_start' }],
      reask: '지금 마음에 가장 먼저 걸리는 한 문장은 무엇인가요?',
      safety: false
    };
  }

  // triggers 배열을 가진 사전에서 가장 먼저 매칭되는 key 반환(정의 순서 = 우선순위)
  function matchKey(low, dict) {
    var keys = Object.keys(dict);
    for (var i = 0; i < keys.length; i++) {
      var e = dict[keys[i]];
      if (e && e.triggers && hasAny(low, e.triggers)) return keys[i];
    }
    return null;
  }

  /* [9-4] 히어로 입력창 응답 원형 (§9)
   *   3~4행: 되비춤 1문장 + 이 한 권 재표현 1문장 + 이중 CTA.
   *   히어로는 '대화 지속'이 목적 아님 → 되물음 없이 이중 CTA로 착지.
   *   단, 안전선/가드레일 신호는 히어로에서도 우선 적용(안전 최우선).
   */
  function heroReflect(text, ctx) {
    var q = String(text || '').trim();
    var low = q.toLowerCase();

    // 안전선 우선
    if (hasAny(low, SAFETY.crisis.triggers)) {
      logTag('graceful_fail', { reason: 'safety_crisis', where: 'hero' });
      return { kind: 'safety_crisis', reflect: SAFETY.crisis.lines[0], lines: SAFETY.crisis.lines.slice(1), ctas: [], safety: true };
    }
    // 미출시 가드레일
    if (hasAny(low, FUTURE_WORDS) || hasAny(low, ROADMAP_TRIGGERS)) {
      logTag('future_leak', { reason: 'roadmap_or_future_word', where: 'hero' });
      return { kind: 'guardrail', reflect: GUARDRAIL.lines[0], lines: [GUARDRAIL.lines[1]], ctas: [], safety: false };
    }

    // 4축 되비춤이 잡히면 그 되비춤 문장 사용, 아니면 범용 되비춤
    var rKey = matchKey(low, REFLECT);
    var reflect, body;
    if (rKey) {
      reflect = REFLECT[rKey].reflect;
      body = REFLECT[rKey].body;
    } else if (q) {
      reflect = '그 한 문장을 지금 여기에 꺼내신 것만으로도, 이미 오늘의 결 하나가 시작됐어요.';
      body = '이 한 권은 답을 새로 정해 주지 않고, 이미 당신 안에 있는 것을 한 줄로 또렷하게 읽어 드려요.';
    } else {
      reflect = '지금 마음에 걸리는 한 가지를 편하게 적어 보세요.';
      body = '이 한 권은 이미 당신 안에 있는 것을 한 줄로 또렷하게 읽어 드려요.';
    }

    return {
      kind: rKey ? ('reflect:' + rKey) : 'reflect:generic',
      reflect: reflect,
      lines: [body],
      ctas: [
        { label: '리포트 미리 보기', href: withLang(LINK.reportPreview), event: 'chat_hero_report_preview' },
        { label: '검사 시작하기', href: withLang(LINK.surveyStart), event: 'chat_hero_survey_start' }
      ],
      safety: false
    };
  }

  // 공개 API 확정
  w.LP_CHAT.greeting = greeting;
  w.LP_CHAT.respond = respond;
  w.LP_CHAT.heroReflect = heroReflect;
  w.LP_CHAT.memberState = memberState;
  w.LP_CHAT.loadKnowledge = loadKnowledge;

})(window, document);
