// functions/data/checkin-chat-script.js
// Week 3 · PR #91 — 사전 진단 (Pre-call 코치 1:1 통화 전 정리 자리)
//
// 제품 재포지셔닝 (PR #90 → PR #91):
//   이전: "30분 거울 자리 · 동행자가 일방적으로 비춰주는 자동 채팅"
//   변경: "코치 1:1 통화 전 5~7분 사전 진단 · 통화를 위한 정리 자리"
//
// 가장 중요한 원칙 (사용자 lock-in):
//   "인간의 감정과 스토리를 담아가는 호흡이 중요. 그게 자동화를 넘어서는 차별화."
//   "사전 검사를 했고, 채팅을 통해서 사전 검사를 통화 토대로 만들고,
//    상담사가 스크립트를 가지고 통화가 가능할 수 있도록 맞춤화된 답변을 받고,
//    이제 예약 일정을 정해서 기다리는 플로우."
//
// 39,900원의 정당성 (사용자 framing — 은행/고객센터 패턴):
//   사람 코치 1:1 통화 30분 + 그 통화를 정확히 설계하기 위한 AI 사전 정리
//   (ChatGPT 무료 대화와의 차별점 = 사람 코치 보장 + 코치 손에 들어가는 사전 진단지)
//
// 4가지 변화 (PR #90 → PR #91):
//   1) 전 텍스트 톤 재작성: "30분 거울" → "사전 진단" / "동행자" → "코치 통화 전 준비"
//   2) 4개의 free 입력 노드 추가 (축 A/B/C/D 마다 1개 — 코치 사전 통화 자료)
//   3) 일부 choose 노드 옵션 2 → 3개 (중간/유보 선택지)
//   4) 호흡 페이싱: "잠시 머물러볼까요" 마커, 사용자 인용 직후 한 박자 더
//   5) CLOSING 재작성: 코치 1:1 통화 예약 안내가 분명히 들어감
//
// 분기 트리 구조 (PR #90 호환):
//   nodes = [{ id, kind, text(ko/en), branches?, options?, next? }, ...]
//
//   kind: "say"      — 사전 진단 시스템이 정리한 말 (사용자는 [다음 ▸] 만)
//         "branch"   — 폼 응답 기준 자동 분기 (사용자 입력 X)
//         "choose"   — 사용자가 객관식 옵션 선택 (2~3 옵션)
//         "free"     — 사용자가 자유서술 입력 (코치 사전 자료) ⭐ PR #91 신규
//         "end"      — 마지막 노드 (코치 1:1 통화 예약 버튼 표시)
//
// branches 평가:
//   - "q1 >= 4" / "q11 == 'yes'" / "q3_nonempty" / "A && B" / "default"
//
// 사용자 응답 흐름:
//   say   → 다음 노드로
//   branch → 자동 평가 → 매칭된 branch 의 next 로 이동
//   choose → 사용자 선택값을 chat_logs.user_input 에 저장 + 옵션의 next 로 이동
//   free  → 사용자 입력값 저장 (500자 제한) + 노드의 next 로 이동
//   end   → 코치 1:1 통화 예약 버튼 노출 (requestEscalation 콜)

const CHAT_SCRIPT_VERSION = "2.0.0"; // PR #91 — 사전 진단 재포지셔닝 (Major)

const NODES = [
  // ═════════════════════════════════════════════════════════════
  // OPENING (3 노드, ~40초) — "사전 진단" 자리 명확히 선언
  // ═════════════════════════════════════════════════════════════
  {
    id: "opening_1",
    kind: "say",
    next: "opening_2",
    text: {
      ko: "안녕하세요. 21일을 살아내신 것, 진심으로 축하드립니다.\n\n이 자리는 30분짜리 대화가 아니라, 곧 진행될 코치와의 1:1 통화 전 5~7분의 사전 진단 자리예요.",
      en: "Hello. Heartfelt congratulations on living through these 21 days.\n\nThis isn't a 30-minute conversation — it's a 5-7 minute pre-diagnosis before your upcoming 1:1 coaching call.",
    },
  },
  {
    id: "opening_2",
    kind: "say",
    next: "opening_3",
    text: {
      ko: "여기서 정리하시는 모든 답변은 곧 코치(faise@lifeportfolio.co.kr)에게 직접 전달됩니다.\n\n그래서 코치는 통화 시작 전 이미 당신의 결을 알고 있는 상태로 만나뵐 수 있어요. ChatGPT와 달리, 이 자리의 의미는 '사람 코치를 위한 손편지'에 가까워요.",
      en: "Everything you write here will be delivered directly to your coach (faise@lifeportfolio.co.kr).\n\nSo when your coach meets you on the call, they will already know your grain. Unlike a generic AI chat, this place is closer to 'a handwritten letter to a human coach.'",
    },
  },
  {
    id: "opening_3",
    kind: "choose",
    next_default: "axis_A_branch",
    text: {
      ko: "준비되셨나요? 12문항으로 흐릿하게 적었던 것 중 가장 중요한 것들만, 코치가 통화에서 정확히 짚을 수 있도록 한 번 더 정리하는 자리예요.",
      en: "Are you ready? This is a place to clarify the most important things from your 12 answers — so your coach can name them precisely on the call.",
    },
    options: [
      { id: "ready_yes",   text: { ko: "네, 시작할게요",            en: "Yes, let's begin" },           next: "axis_A_branch" },
      { id: "ready_wait",  text: { ko: "잠깐, 마음 좀 가다듬을게요",  en: "Wait, let me settle first" },   next: "opening_wait"  },
      { id: "ready_curious", text: { ko: "이게 통화 전 어떻게 쓰이나요?", en: "How will this be used before the call?" }, next: "opening_explain" },
    ],
  },
  {
    id: "opening_wait",
    kind: "say",
    next: "axis_A_branch",
    text: {
      ko: "천천히 하세요. 21일을 살아내신 분이니까, 5분도 당신의 속도로 가시면 됩니다. 호흡 한 번 길게 들이쉬고 시작할게요.",
      en: "Take your time. You've lived through 21 days — even five minutes can run at your pace. Take one slow breath, and we'll begin.",
    },
  },
  {
    id: "opening_explain",
    kind: "say",
    next: "axis_A_branch",
    text: {
      ko: "좋은 질문이에요. 이 자리의 모든 답변 + 자유 메모 4개가 코치에게 메일로 전달됩니다. 코치는 통화 전 그 메일을 읽고, 당신 한 분만을 위한 통화 흐름을 미리 그려둡니다. \"안녕하세요\"부터 다를 거예요.",
      en: "Good question. All your answers + 4 free notes here will be emailed to your coach. Before the call, your coach reads that email and sketches a flow for you alone. Even the \"hello\" will feel different.",
    },
  },

  // ═════════════════════════════════════════════════════════════
  // AXIS A · 사명 일치도 (q1, q2, q3) — ~1.5분
  // ═════════════════════════════════════════════════════════════
  {
    id: "axis_A_branch",
    kind: "branch",
    branches: [
      { condition: "q1 >= 4", next: "axis_A_high" },
      { condition: "q1 == 3", next: "axis_A_mid"  },
      { condition: "default", next: "axis_A_low"  },
    ],
  },
  {
    id: "axis_A_high",
    kind: "say",
    next: "axis_A_q3_reflect",
    text: {
      ko: "[축 A · 사명 일치도]\n\n사명을 '거의 매일' 또는 '며칠에 한 번' 의식하셨다고 답하셨네요. 21일 동안 그렇게 자주 자기 안으로 들어가셨다는 것은, 사명이 이미 일상의 호흡이 되었다는 신호예요.",
      en: "[Axis A · Mission alignment]\n\nYou answered that you were aware of your mission 'almost daily' or 'every few days.' Returning inward that often over 21 days means your mission has already become part of your daily breath.",
    },
  },
  {
    id: "axis_A_mid",
    kind: "say",
    next: "axis_A_q3_reflect",
    text: {
      ko: "[축 A · 사명 일치도]\n\n일주일에 한 번꼴로 사명을 의식하셨군요. 이 빈도는 부족한 게 아니라, '21일을 시작하기 전의 당신' 보다 분명히 안으로 들어가는 횟수가 늘어났다는 증거예요. 시작점을 기억해주세요.",
      en: "[Axis A · Mission alignment]\n\nAbout once a week, you said. That's not too few — it's measurably more than the version of you before these 21 days. Remember where the starting line was.",
    },
  },
  {
    id: "axis_A_low",
    kind: "say",
    next: "axis_A_q3_reflect",
    text: {
      ko: "[축 A · 사명 일치도]\n\n사명을 거의 떠올리지 않으셨다고 답하셨어요. 솔직한 답변에 감사드립니다. 21일은 '의식의 변화' 보다 '시작했다는 사실' 그 자체에 의미가 있는 시기예요. 자책할 필요 없어요.",
      en: "[Axis A · Mission alignment]\n\nYou said you rarely thought of your mission. Thank you for your honesty. These 21 days aren't about awareness shifts — they're about the fact that you began at all. No need for self-blame.",
    },
  },
  {
    id: "axis_A_q3_reflect",
    kind: "branch",
    branches: [
      { condition: "q3_nonempty", next: "axis_A_q3_quote" },
      { condition: "default",     next: "axis_A_pause"    },
    ],
  },
  {
    id: "axis_A_q3_quote",
    kind: "say",
    next: "axis_A_pause",
    text: {
      ko: "당신이 '사명이 가장 또렷했던 한 가지' 로 적으신 한 문장 ─\n\n  「{{q3}}」\n\n잠시 이 문장에 머물러볼까요. 21일 전체에서 가장 단단한 지점일 수 있어요. 코치는 이 한 문장에서 통화를 시작하게 될 거예요.",
      en: "Your one sentence for 'the moment your mission felt clearest':\n\n  \"{{q3}}\"\n\nLet's pause here for a moment. This may be the firmest ground of the entire 21 days. Your coach will likely begin the call from this very sentence.",
    },
  },
  {
    id: "axis_A_pause",
    kind: "choose",
    next_default: "axis_A_free",
    text: {
      ko: "사명 일치도, 어떤 느낌으로 들으셨어요?",
      en: "How did that land?",
    },
    options: [
      { id: "A_resp_yes",     text: { ko: "맞아요, 그대로예요",        en: "Yes, exactly" },             next: "axis_A_free"  },
      { id: "A_resp_partial", text: { ko: "절반은 맞고, 절반은 다른 느낌이에요", en: "Half right, half different" }, next: "axis_A_partial" },
      { id: "A_resp_doubt",   text: { ko: "조금 다르게 느껴져요",       en: "It feels a bit different" }, next: "axis_A_doubt" },
    ],
  },
  {
    id: "axis_A_partial",
    kind: "say",
    next: "axis_A_free",
    text: {
      ko: "'절반은 다르다' 라는 감각이 가장 정확한 답일 때가 많아요. 다 맞는다고 답하면 자기 검열일 가능성이 높고, 다 틀리다고 답하면 자기 부정일 가능성이 높거든요. 코치가 통화에서 그 절반의 결을 따라가도록 적어두겠습니다.",
      en: "'Half is different' is often the most honest answer. 'All correct' often signals self-censorship; 'all wrong' often signals self-denial. I'll note this half-difference so your coach can follow it on the call.",
    },
  },
  {
    id: "axis_A_doubt",
    kind: "say",
    next: "axis_A_free",
    text: {
      ko: "그 다른 느낌도 정확한 데이터예요. 진단 결과가 어색하게 느껴지는 건 보통 진단이 틀린 게 아니라, 답변을 적을 때의 당신과 지금의 당신 사이에 며칠의 변화가 끼어든 거예요. 코치에게 '이 부분 다시 보고 싶다' 고 전해드릴게요.",
      en: "That different feeling is also accurate data. Usually the diagnosis isn't wrong — a few days of change have slipped in between the version of you who answered and the version of you now. I'll let your coach know you want to revisit this.",
    },
  },
  {
    id: "axis_A_free",
    kind: "free",
    next: "axis_B_branch",
    text: {
      ko: "⬛ 코치에게 직접 전하고 싶은 한 줄 — [축 A · 사명]\n\n21일 동안 사명에 대해 떠올렸던 것 중, 코치가 통화에서 꼭 한 번 짚어줬으면 하는 것 한 가지만 적어주세요. 한 문장이어도, 한 단어여도, 빈 칸이어도 괜찮습니다. (선택, ~500자)",
      en: "⬛ One line for your coach — [Axis A · Mission]\n\nAmong what you thought about regarding your mission over the 21 days, write the one thing you most want your coach to name on the call. One sentence, one word, or blank — all are okay. (Optional, ~500 chars)",
    },
  },

  // ═════════════════════════════════════════════════════════════
  // AXIS B · 첫 행동 3개 실행률 (q4, q5, q6) — ~1.5분
  // ═════════════════════════════════════════════════════════════
  {
    id: "axis_B_branch",
    kind: "branch",
    branches: [
      { condition: "q4 >= 4", next: "axis_B_high" },
      { condition: "q4 == 3", next: "axis_B_mid"  },
      { condition: "default", next: "axis_B_low"  },
    ],
  },
  {
    id: "axis_B_high",
    kind: "say",
    next: "axis_B_q6_reflect",
    text: {
      ko: "[축 B · 첫 행동 실행률]\n\n첫 행동 3개 중 2~3개를 실행하셨네요. 이건 굉장한 일이에요. 시작한 사람의 90%는 첫 1주에서 멈추거든요. 당신은 그 통계 밖에 계세요.",
      en: "[Axis B · Execution of first actions]\n\nYou executed 2-3 of your first 3 actions. That's remarkable — 90% of starters stop in week one. You're outside that statistic.",
    },
  },
  {
    id: "axis_B_mid",
    kind: "say",
    next: "axis_B_q6_reflect",
    text: {
      ko: "[축 B · 첫 행동 실행률]\n\n첫 행동 3개 중 한두 개를 실행하셨군요. 이건 '부족' 이 아니라 '진짜 시도' 의 흔적이에요. 시도해본 사람만이 마찰을 알게 됩니다.",
      en: "[Axis B · Execution of first actions]\n\nOne or two of your first three. That's not 'less' — it's the footprint of genuine attempt. Only those who try can feel the friction.",
    },
  },
  {
    id: "axis_B_low",
    kind: "say",
    next: "axis_B_q6_reflect",
    text: {
      ko: "[축 B · 첫 행동 실행률]\n\n거의 실행하지 못하셨다고 답하셨어요. 솔직한 답변 감사해요. 코치 통화에서는 '왜 못 했나' 가 아니라 '무엇이 가장 무거웠나' 로 함께 풀어볼 거예요. 시간, 우선순위, 아니면 마음의 저항?",
      en: "[Axis B · Execution of first actions]\n\nYou said you barely executed any. Thank you for your honesty. On the coaching call, we won't ask 'why didn't you' — we'll explore 'what felt heaviest.' Time, priorities, or inner resistance?",
    },
  },
  {
    id: "axis_B_q6_reflect",
    kind: "branch",
    branches: [
      { condition: "q6_nonempty", next: "axis_B_q6_quote" },
      { condition: "default",     next: "axis_B_pause"    },
    ],
  },
  {
    id: "axis_B_q6_quote",
    kind: "say",
    next: "axis_B_pause",
    text: {
      ko: "당신이 '가장 어려웠던 순간' 으로 적으신 ─\n\n  「{{q6}}」\n\n잠시 이 문장 안에 머물러볼까요. 어쩌면 다음 3주의 첫 과제가 이 문장 안에 들어있을 수 있어요. 코치가 통화에서 이 어려움의 결을 같이 따라갈 거예요.",
      en: "Your note on 'the hardest moment':\n\n  \"{{q6}}\"\n\nLet's stay with this sentence for a moment. The first task of the next 3 weeks may live inside it. Your coach will follow this difficulty's grain with you on the call.",
    },
  },
  {
    id: "axis_B_pause",
    kind: "choose",
    next_default: "axis_B_free",
    text: {
      ko: "21일 안의 행동을 돌아보면, 지금 어떤 감정이 가장 가까운가요?",
      en: "Looking back at your 21 days of action, what feeling feels closest right now?",
    },
    options: [
      { id: "B_feel_satisfied",  text: { ko: "충분히 했다, 후련하다",  en: "I did enough, I feel relieved" }, next: "axis_B_free" },
      { id: "B_feel_unfinished", text: { ko: "더 할 수 있었다는 아쉬움",  en: "Some unfinishedness, could've done more" }, next: "axis_B_unfinished" },
      { id: "B_feel_heavy",      text: { ko: "여전히 무겁다",            en: "It still feels heavy" },         next: "axis_B_heavy" },
    ],
  },
  {
    id: "axis_B_unfinished",
    kind: "say",
    next: "axis_B_free",
    text: {
      ko: "'아쉬움' 은 다음 3주의 가장 강한 연료예요. 만족했다면 더 갈 곳이 없거든요. 코치에게 이 아쉬움의 결을 정확히 전달해두겠습니다.",
      en: "'Unfinishedness' is the strongest fuel for the next 3 weeks. If you were fully satisfied, there'd be nowhere to go. I'll pass this grain of unfinishedness to your coach precisely.",
    },
  },
  {
    id: "axis_B_heavy",
    kind: "say",
    next: "axis_B_free",
    text: {
      ko: "여전히 무겁다고 느끼시는 것 — 이건 21일이 부족했다는 신호가 아니라, '한 사람의 도움이 필요한 자리' 라는 신호일 때가 많아요. 코치가 통화에서 가장 먼저 묻는 자리가 여기가 될 거예요.",
      en: "Still feeling heavy — this is usually not a sign that 21 days were insufficient, but a sign that 'a single person's help is needed here.' This will likely be the first place your coach asks about on the call.",
    },
  },
  {
    id: "axis_B_free",
    kind: "free",
    next: "axis_C_branch",
    text: {
      ko: "⬛ 코치에게 직접 전하고 싶은 한 줄 — [축 B · 행동]\n\n21일 동안의 실행을 한 문장으로 적는다면? 코치가 통화에서 '이 행동의 어떤 부분'을 다뤘으면 좋겠는지 자유롭게 적어주세요. (선택, ~500자)",
      en: "⬛ One line for your coach — [Axis B · Action]\n\nIf you described your 21 days of execution in one sentence — what would it be? Tell your coach which part of this action you'd like to address on the call. (Optional, ~500 chars)",
    },
  },

  // ═════════════════════════════════════════════════════════════
  // AXIS C · 다음 3주 명확도 (q7, q8, q9) — ~1.5분
  // ═════════════════════════════════════════════════════════════
  {
    id: "axis_C_branch",
    kind: "branch",
    branches: [
      { condition: "q7 >= 4 && q8 == 'yes'", next: "axis_C_clear"   },
      { condition: "q7 >= 4",                 next: "axis_C_picture" },
      { condition: "q8 == 'yes'",             next: "axis_C_words"   },
      { condition: "default",                  next: "axis_C_fog"     },
    ],
  },
  {
    id: "axis_C_clear",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "[축 C · 다음 3주 명확도]\n\n다음 3주의 그림이 머릿속에 분명하고, 한 문장으로 설명도 가능하시군요. 이건 21일이 만든 가장 큰 자산이에요. 흩어져 있던 의도가 한 줄로 모인 거니까요.",
      en: "[Axis C · Clarity of the next 3 weeks]\n\nYour picture for the next 3 weeks is clear, and you can put it in one sentence. This is the greatest asset of these 21 days — scattered intentions converged into a single line.",
    },
  },
  {
    id: "axis_C_picture",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "[축 C · 다음 3주 명확도]\n\n그림은 또렷한데 한 문장으로 묶는 건 아직 어려우시군요. 괜찮습니다. 그림이 먼저, 말은 그 뒤예요. 코치 통화에서 그 한 문장을 같이 빚어볼 수 있어요.",
      en: "[Axis C · Clarity of the next 3 weeks]\n\nThe picture is clear, but compressing it into one sentence is still hard. That's fine — image first, words second. We can shape that one sentence together on the coaching call.",
    },
  },
  {
    id: "axis_C_words",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "[축 C · 다음 3주 명확도]\n\n한 문장으로는 설명 가능한데, 머릿속 그림은 아직 흐릿하시군요. 흥미로워요. 보통은 반대거든요. 말이 그림을 끌어당기는 분이세요. 코치 통화에서 그 한 문장을 그림으로 확장해보겠습니다.",
      en: "[Axis C · Clarity of the next 3 weeks]\n\nYou can put it in one sentence, yet the image is still misty. Interesting — usually it's the opposite. You're someone whose words pull the picture forward. On the call we'll expand that sentence into a picture.",
    },
  },
  {
    id: "axis_C_fog",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "[축 C · 다음 3주 명확도]\n\n다음 3주의 그림이 아직 흐릿하시군요. 솔직한 답변이에요. 21일은 '계획을 만드는 시기' 가 아니라 '재료를 모으는 시기' 예요. 안개가 걷히는 데는 시간이 걸리는 게 정상이고, 코치 통화는 그 안개를 같이 들여다보는 자리가 됩니다.",
      en: "[Axis C · Clarity of the next 3 weeks]\n\nThe picture for your next 3 weeks is still hazy. That's an honest answer. These 21 days aren't a 'planning phase' but a 'gathering phase.' Fog takes time to lift — and the coaching call is a place to look at that fog together.",
    },
  },
  {
    id: "axis_C_q9_reflect",
    kind: "branch",
    branches: [
      { condition: "q9_nonempty", next: "axis_C_q9_quote" },
      { condition: "default",     next: "axis_C_pause"    },
    ],
  },
  {
    id: "axis_C_q9_quote",
    kind: "say",
    next: "axis_C_pause",
    text: {
      ko: "당신이 다음 3주를 한 문장으로 적으신 ─\n\n  「{{q9}}」\n\n잠시 이 문장에 머물러주세요. 21일 차의 당신이 적었다는 사실을 기억하세요. 28일 차의 당신은 이 문장보다 더 명료해질 거고, 코치 통화는 그 명료함을 앞당기는 자리예요.",
      en: "Your one sentence for the next 3 weeks:\n\n  \"{{q9}}\"\n\nPlease stay with this sentence for a moment. Remember — the version of you on day 21 wrote this. The version on day 28 will be clearer, and the coaching call is the place that brings that clarity sooner.",
    },
  },
  {
    id: "axis_C_pause",
    kind: "choose",
    next_default: "axis_C_free",
    text: {
      ko: "다음 3주, 지금 가장 떠오르는 한 가지가 있나요?",
      en: "For the next 3 weeks — does one thing come to mind right now?",
    },
    options: [
      { id: "C_next_clear",    text: { ko: "또렷한 한 가지가 있어요",       en: "Yes, one clear thing" },         next: "axis_C_free" },
      { id: "C_next_few",      text: { ko: "두세 개가 떠올라요, 정리가 필요해요", en: "Two or three — I need to sort them" }, next: "axis_C_few" },
      { id: "C_next_none",     text: { ko: "아직 모르겠어요",               en: "Not yet" },                       next: "axis_C_none" },
    ],
  },
  {
    id: "axis_C_few",
    kind: "say",
    next: "axis_C_free",
    text: {
      ko: "두세 개가 떠오른다는 건 좋은 신호예요. '정리가 필요하다' 는 감각은 곧 '선택이 필요하다' 는 뜻이고, 코치 통화의 가장 잘 쓰이는 시간이 그 선택을 같이 줄여나가는 30분이에요.",
      en: "Two or three options is a good sign. 'I need to sort them' really means 'I need to choose' — and the coaching call's best 30 minutes are usually spent narrowing those choices together.",
    },
  },
  {
    id: "axis_C_none",
    kind: "say",
    next: "axis_C_free",
    text: {
      ko: "'아직 모른다' 도 정확한 답이에요. 다음 3주는 '한 가지 찾기' 가 아니라 '한 가지 떠오를 자리를 비워두기' 로 가도 충분합니다. 코치는 그 빈 자리를 같이 지켜드릴 거예요.",
      en: "'Not yet' is also an accurate answer. The next 3 weeks can be about 'keeping a space open for the one thing to arise,' not 'finding the one thing.' Your coach will guard that empty space with you.",
    },
  },
  {
    id: "axis_C_free",
    kind: "free",
    next: "axis_D_branch",
    text: {
      ko: "⬛ 코치에게 직접 전하고 싶은 한 줄 — [축 C · 다음 3주]\n\n다음 3주를 그려볼 때, 코치와의 통화에서 가장 함께 풀어가고 싶은 한 가지를 적어주세요. (선택, ~500자)",
      en: "⬛ One line for your coach — [Axis C · Next 3 weeks]\n\nWhen you imagine the next 3 weeks, write the one thing you most want to unpack with your coach on the call. (Optional, ~500 chars)",
    },
  },

  // ═════════════════════════════════════════════════════════════
  // AXIS D ⭐ · 자산화 수준 (q10, q11, q12) — ~2분 (가장 깊은 자리)
  // ═════════════════════════════════════════════════════════════
  {
    id: "axis_D_branch",
    kind: "branch",
    branches: [
      { condition: "q10 >= 4", next: "axis_D_high"  },
      { condition: "q10 == 3", next: "axis_D_mid"   },
      { condition: "q10 == 2", next: "axis_D_faint" },
      { condition: "default",  next: "axis_D_low"   },
    ],
  },
  {
    id: "axis_D_high",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "[축 D · 자산화 수준 ⭐]\n\n21일이 끝난 지금, '여러 변화가 자리잡았다' 또는 '삶의 방향이 바뀌었다' 고 답하셨네요. 이건 21일짜리 리포트가 한 사람의 인생에 만들어내는 가장 깊은 결과예요. 변화가 자리잡으면 다시 흩어지지 않습니다.",
      en: "[Axis D · Assetization ⭐]\n\nYou said 'multiple changes have settled in' or 'the direction of life has shifted.' This is the deepest outcome a 21-day report can produce. Once changes settle, they don't scatter again.",
    },
  },
  {
    id: "axis_D_mid",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "[축 D · 자산화 수준 ⭐]\n\n'한두 가지 분명한 변화' 가 남으셨다고 답하셨어요. 한두 가지면 충분합니다. 21일이 평생을 다 바꾸는 건 아니에요. 한두 개의 닻이 단단히 박힌 게 더 중요합니다.",
      en: "[Axis D · Assetization ⭐]\n\nYou said 'one or two clear changes remain.' One or two is enough. 21 days don't rewrite a lifetime — what matters is that one or two anchors are firmly set.",
    },
  },
  {
    id: "axis_D_faint",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "[축 D · 자산화 수준 ⭐]\n\n'희미한 느낌' 정도가 남으셨다고 답하셨어요. 희미한 느낌은 사라지지 않아요. 시간이 지나면 그 느낌이 어떤 형태로든 다시 돌아옵니다. 21일이 만든 가장 작은 씨앗이에요.",
      en: "[Axis D · Assetization ⭐]\n\nYou said a 'faint sense' remains. A faint sense doesn't disappear — over time, it returns in some form. The smallest seed these 21 days planted.",
    },
  },
  {
    id: "axis_D_low",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "[축 D · 자산화 수준 ⭐]\n\n'거의 흔적이 없다' 고 답하셨네요. 정직한 답변에 깊이 감사드립니다. 그런데도 21일을 다 살아내시고 이 자리까지 오셨다는 사실은, 흔적이 0이 아니라는 명백한 증거예요. 흔적은 행동 안에 있어요, 의식 안이 아니라. 코치 통화는 그 행동의 흔적을 찾는 자리입니다.",
      en: "[Axis D · Assetization ⭐]\n\nYou said 'almost no trace remains.' Thank you for your deep honesty. And yet — the fact that you walked all 21 days and arrived here is unmistakable evidence the trace is not zero. Traces live in actions, not in awareness. The coaching call is a place to find those action-traces.",
    },
  },
  {
    id: "axis_D_q11_check",
    kind: "branch",
    branches: [
      { condition: "q11 == 'yes'",     next: "axis_D_q11_yes" },
      { condition: "q11 == 'maybe'",   next: "axis_D_q11_maybe" },
      { condition: "default",          next: "axis_D_q11_no" },
    ],
  },
  {
    id: "axis_D_q11_yes",
    kind: "say",
    next: "axis_D_q12_branch",
    text: {
      ko: "그리고 '한 문장으로 설명할 수 있다' 고 답하셨어요. 다른 사람에게 설명할 수 있다는 건 자기 안에서 정리가 끝났다는 뜻이에요. 이 한 문장이 코치 통화의 출발선이 됩니다.",
      en: "And you said you can 'explain it in one sentence.' Being able to explain it to others means it has settled within you. This sentence will be the starting line of the coaching call.",
    },
  },
  {
    id: "axis_D_q11_maybe",
    kind: "say",
    next: "axis_D_q12_branch",
    text: {
      ko: "'어렴풋이' 설명할 수 있다고 답하셨어요. 어렴풋함은 부정적이지 않아요. 어렴풋한 상태에서만 다음 깊이로 들어갈 수 있거든요. 코치 통화는 그 어렴풋함을 또렷함으로 옮기는 자리예요.",
      en: "You said you can describe it 'vaguely.' Vagueness isn't negative — it's the only state that lets you go deeper. The coaching call is a place to move that vagueness into clarity.",
    },
  },
  {
    id: "axis_D_q11_no",
    kind: "say",
    next: "axis_D_q12_branch",
    text: {
      ko: "'아직 설명하기 어렵다' 고 답하셨어요. 21일짜리 경험을 한 문장으로 압축하는 건 사실 무리한 요구이기도 해요. 코치 통화에서 그 문장을 처음부터 같이 만들어볼게요.",
      en: "You said it's 'still hard to explain.' Compressing a 21-day experience into one sentence is itself a tall ask. We'll craft that sentence together from scratch on the coaching call.",
    },
  },
  {
    id: "axis_D_q12_branch",
    kind: "branch",
    branches: [
      { condition: "q12_nonempty", next: "axis_D_q12_quote" },
      { condition: "default",      next: "axis_D_free"      },
    ],
  },
  {
    id: "axis_D_q12_quote",
    kind: "say",
    next: "axis_D_q12_after",
    text: {
      ko: "당신이 그 한 문장으로 적어주신 ─\n\n  「{{q12}}」\n\n잠시 이 문장에 깊이 머물러주세요. 12문항 중 가장 깊은 자리예요. 다른 누구도 적을 수 없는 당신만의 문장입니다.",
      en: "Your one sentence:\n\n  \"{{q12}}\"\n\nPlease stay deeply with this sentence for a moment. This is the deepest place among the 12 questions. No one else could write this — it is uniquely yours.",
    },
  },
  {
    id: "axis_D_q12_after",
    kind: "say",
    next: "axis_D_free",
    text: {
      ko: "이 문장을 한 달 뒤, 세 달 뒤, 일 년 뒤에도 다시 읽어보세요. 그때마다 같은 문장이 다르게 읽힐 거예요. 그게 자산화의 증거입니다. 코치는 통화에서 이 문장의 가장 깊은 결을 같이 따라갈 거예요.",
      en: "Read this sentence again in a month, three months, a year. Each time, the same words will read differently. That's the proof of assetization. Your coach will follow this sentence's deepest grain with you on the call.",
    },
  },
  {
    id: "axis_D_free",
    kind: "free",
    next: "closing_1",
    text: {
      ko: "⬛ 코치에게 직접 전하고 싶은 한 줄 — [축 D · 자산화 ⭐]\n\n21일이 당신에게 남긴 가장 깊은 한 가지를, 그게 무엇이든 자유롭게 적어주세요. 단어여도, 문장이어도, 이미지여도 좋습니다. 이게 코치가 가장 먼저 읽을 한 줄이에요. (선택, ~500자)",
      en: "⬛ One line for your coach — [Axis D · Assetization ⭐]\n\nWrite the deepest one thing these 21 days left with you — in any form. A word, a sentence, an image. This will be the first line your coach reads. (Optional, ~500 chars)",
    },
  },

  // ═════════════════════════════════════════════════════════════
  // CLOSING — 코치 1:1 통화 예약 안내 (3 노드)
  // ═════════════════════════════════════════════════════════════
  {
    id: "closing_1",
    kind: "say",
    next: "closing_2",
    text: {
      ko: "네 개의 축을 다 정리하셨어요. 사명, 행동, 다음 3주, 자산화. 5~7분 짧은 자리였지만, 21일을 압축한 사전 진단지 한 장이 만들어졌습니다.",
      en: "You've now organized all four axes — Mission, Action, Next 3 Weeks, and Assetization. A short 5-7 minutes, yet a one-page pre-diagnosis that compresses your 21 days has been created.",
    },
  },
  {
    id: "closing_2",
    kind: "say",
    next: "closing_3",
    text: {
      ko: "이제 이 사전 진단지가 코치(faise@lifeportfolio.co.kr)에게 자동으로 전달됩니다.\n\n코치는 이걸 읽고 당신 한 분만을 위한 1:1 통화 흐름을 미리 그려둡니다. 그래서 통화 시작 5분 안에 ChatGPT 30분 분량의 깊이가 가능해져요. 이게 39,900원의 진짜 의미예요.",
      en: "This pre-diagnosis will now be sent directly to your coach (faise@lifeportfolio.co.kr).\n\nYour coach will read it and sketch a 1:1 call flow for you alone. That's how 5 minutes into the call can already carry the depth of 30 minutes with a generic AI. This is the real meaning of ₩39,900.",
    },
  },
  {
    id: "closing_3",
    kind: "end",
    text: {
      ko: "이제 마지막 한 단계만 남았어요 ─ 코치 1:1 통화 예약입니다.\n\n아래 [📞 1:1 코칭 예약하기] 버튼을 눌러주세요. 추가로 코치에게 전하고 싶은 메모가 있다면 한 줄로 남겨주시면, 그것도 함께 메일로 전달됩니다.\n\n21일을 살아내신 것, 그리고 이 자리까지 와 주신 것 ─ 진심으로 감사드립니다.",
      en: "Just one final step remains — booking your 1:1 coaching call.\n\nPlease press the [📞 Book 1:1 Coaching] button below. If you have an extra note for your coach, leave a single line — it will be emailed along with everything else.\n\nThank you, sincerely, for living through these 21 days, and for coming this far.",
    },
  },
];

/**
 * 분기 조건 평가 — 단순 DSL (q1 >= 4, q11 == 'yes', q3_nonempty, default, A && B)
 * @param {string} condition
 * @param {Object} answers - 폼 응답 객체 (12문항)
 * @returns {boolean}
 */
function evalBranch(condition, answers) {
  if (condition === "default") return true;
  // 복합 조건: A && B (단순 AND 만 지원, 한 단계) — 우선 처리
  if (condition.includes("&&")) {
    return condition.split("&&").every((c) => evalBranch(c.trim(), answers));
  }
  // q3_nonempty, q6_nonempty, q9_nonempty, q12_nonempty
  const nonemptyMatch = /^(q\d+)_nonempty$/.exec(condition);
  if (nonemptyMatch) {
    const v = answers[nonemptyMatch[1]];
    return typeof v === "string" && v.trim().length > 0;
  }
  // q1 >= 4, q1 == 3, q4 >= 4 — 숫자 비교
  const numMatch = /^(q\d+)\s*(>=|==|<=|>|<)\s*(\d+)$/.exec(condition);
  if (numMatch) {
    const qid = numMatch[1];
    const op = numMatch[2];
    const target = parseInt(numMatch[3], 10);
    const raw = answers[qid];
    const v = parseInt(String(raw), 10);
    if (Number.isNaN(v)) return false;
    switch (op) {
      case ">=": return v >= target;
      case "==": return v === target;
      case "<=": return v <= target;
      case ">":  return v >  target;
      case "<":  return v <  target;
    }
  }
  // q11 == 'yes', q8 == 'maybe' — 문자열 비교
  const strMatch = /^(q\d+)\s*==\s*'([^']+)'$/.exec(condition);
  if (strMatch) {
    return String(answers[strMatch[1]] || "").trim() === strMatch[2];
  }
  return false;
}

/**
 * 사용자 입력값({{q3}} 등)을 노드 텍스트에 채워넣기
 * @param {string} template
 * @param {Object} answers
 * @returns {string}
 */
function renderText(template, answers) {
  if (!template) return "";
  return template.replace(/\{\{(q\d+)\}\}/g, (_, qid) => {
    const v = answers[qid];
    if (typeof v !== "string") return "";
    return v.replace(/[\r\n]+/g, " ").trim().slice(0, 400);
  });
}

/**
 * 다음 노드 ID 결정 — branch 자동 평가
 * @param {Object} currentNode
 * @param {Object} answers
 * @param {string} chosenOptionId - choose 노드에서 사용자가 선택한 옵션 ID (없으면 null)
 * @returns {string|null} 다음 노드 ID (end 면 null)
 */
function getNextNodeId(currentNode, answers, chosenOptionId) {
  if (!currentNode) return null;
  if (currentNode.kind === "end") return null;
  if (currentNode.kind === "branch") {
    for (const b of currentNode.branches || []) {
      if (evalBranch(b.condition, answers)) return b.next;
    }
    return null;
  }
  if (currentNode.kind === "choose") {
    if (chosenOptionId) {
      const opt = (currentNode.options || []).find((o) => o.id === chosenOptionId);
      if (opt && opt.next) return opt.next;
    }
    return currentNode.next_default || null;
  }
  // say, free → 단순 next
  return currentNode.next || null;
}

const NODE_MAP = NODES.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

const ENTRY_NODE_ID = "opening_1";

const ALLOWED_OPTION_IDS = (() => {
  const set = new Set();
  for (const n of NODES) {
    if (n.kind === "choose" && Array.isArray(n.options)) {
      for (const o of n.options) set.add(o.id);
    }
  }
  return set;
})();

const ALLOWED_NODE_IDS = new Set(NODES.map((n) => n.id));

// PR #91 신규: free 입력 노드 ID 목록 (escalation 시 코치에게 전달할 자료 수집용)
const FREE_INPUT_NODE_IDS = NODES
  .filter((n) => n.kind === "free")
  .map((n) => n.id);

module.exports = {
  CHAT_SCRIPT_VERSION,
  NODES,
  NODE_MAP,
  ENTRY_NODE_ID,
  ALLOWED_OPTION_IDS,
  ALLOWED_NODE_IDS,
  FREE_INPUT_NODE_IDS,
  evalBranch,
  renderText,
  getNextNodeId,
};
