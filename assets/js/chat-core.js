/**
 * chat-core.js — Life Portfolio E그룹 P1.5 AX 동행 챗봇 코어 (규칙 기반 완성형)
 * =============================================================================
 * SSOT: "인생포트폴리오 E그룹 P1.5 AX 동행 챗봇 사양서 v1.0 (최종 잠금본)".
 *   본 파일은 그 사양서의 §4~§10 문장을 상수화한 순수 규칙 기반 응답 엔진이다.
 *   LLM 미사용(P2.0 유보). 서버 비용 0, 문구 임의 변경 방지, never_expose 후처리 차단 포함.
 *
 * 설계 원칙(사양서 정합):
 *   - §4 응답 톤 4박자: 짧게 · 공감 한 번 · 지금 자리 · 자연스러운 이어감.
 *   - §5 회원 상태 3분기: 톤은 하나, 반경만 다르게. 첫 인사에서 이름 미호명.
 *   - §6 미출시 가드레일: 절대금지 단어 + 로드맵 질문 → SSOT 착지 문장.
 *   - §8 6개 실무 질의: 리포트 구조 / 소요시간·문항 / 가격·결제·환불 / 재생성·해설 /
 *        데이터 보관 / 신앙 병행.
 *   - §10 안전선: 위기 신호 → 상담 최우선(리포트 CTA 뒤에 안 붙임) / 자문성 / 미성년.
 *   - never_expose: 출력 문자열 후처리 블랙리스트로 내부 용어 차단.
 *   - 로깅 태그: #tone_off / #future_leak / #graceful_fail.
 *
 * 노출: window.LP_CHAT = {
 *   greeting(memberState) -> {lines:[], cta:{...}}       // §5 첫 인사(3분기)
 *   respond(text, ctx)    -> {kind, lines:[], ctas:[], reask, safety, log}  // 위젯용
 *   heroReflect(text, ctx)-> {reflect, lines:[], ctas:[]}                   // 히어로 입력창용
 *   memberState()         -> Promise<'guest'|'member_todo'|'member_done'>   // §5 3분기 판정
 *   sanitize(str)         -> str                          // never_expose 후처리
 * }
 *
 * 의존(모두 선택적, 없으면 폴백): window.firebase(auth+db), window.LP_VISITOR, window.LP.track.
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
   * [8] 로깅 태그 (#tone_off / #future_leak / #graceful_fail)
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
  w.LP_CHAT._const = { GREETING: GREETING, GUARDRAIL: GUARDRAIL, FAQ: FAQ, REFLECT: REFLECT, SAFETY: SAFETY };
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

    // (1) 안전선 — 최우선 (§10)
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

    // (6) 우아한 실패 (§4.4) — 지어내지 않기
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

})(window, document);
