// functions/data/checkin-chat-script.js
// Week 3 · PR #90 — 채팅 30분 스크립트 (동행자 톤, 분기 트리)
//
// 설계 원칙 (Q6 = A안 동행자 톤):
//   - "함께 21일을 보낸 친구" 톤. 따뜻하고 인격적, 짧은 호흡.
//   - 분석이나 판단보다 "들여다보기" 가 우선.
//   - 사용자의 폼 응답(q1~q12)을 재료로 분기.
//   - 자유서술(q3, q6, q9, q12)이 있으면 직접 인용 → 거울처럼 비춰주기.
//   - 정답이나 처방은 절대 X. "당신이 이미 답을 가지고 있다" 가 베이스.
//
// 분기 트리 구조:
//   nodes = [{ id, kind, text(ko/en), branches?, options?, next? }, ...]
//
//   kind: "say"      — 동행자가 일방적으로 말함 (사용자는 [다음] 만)
//         "branch"   — 폼 응답 기준 자동 분기 (사용자 입력 X)
//         "choose"   — 사용자가 객관식 옵션 선택
//         "free"     — 사용자가 자유서술 입력 (선택)
//         "end"      — 마지막 노드 (운영진 연결 버튼 표시)
//
// branches 평가:
//   - "q1 >= 4" 같은 단순 조건 (DSL 최소화). evalBranch() 가 처리.
//   - "q11 == 'yes'" — 객관식 값 비교.
//   - "default" — 매칭 없을 때 fallback.
//
// 사용자 응답 흐름:
//   say   → 다음 노드로
//   branch → 자동 평가 → branch 의 next 로 이동
//   choose → 사용자 선택값을 chat_logs.user_input 에 저장 + next 로 이동
//   free  → 사용자 입력값 저장 (300자 제한) + next 로 이동
//   end   → 운영진 연결 버튼 노출 (escalate 옵션)

const CHAT_SCRIPT_VERSION = "1.0.0"; // 스크립트 버전 — 로그에 기록

const NODES = [
  // ─────────────────────────────────────────────────────────
  // OPENING (1분)
  // ─────────────────────────────────────────────────────────
  {
    id: "opening_1",
    kind: "say",
    next: "opening_2",
    text: {
      ko: "안녕하세요. 21일을 함께 보낸 사람으로서, 이 자리에서 다시 만나뵐 수 있어 진심으로 반갑습니다.",
      en: "Hello. As someone who walked with you through these 21 days, it's truly a privilege to meet you again here.",
    },
  },
  {
    id: "opening_2",
    kind: "say",
    next: "opening_3",
    text: {
      ko: "앞으로 30분 동안, 당신의 12문항 답변을 함께 천천히 들여다볼 거예요. 평가하거나 처방하지 않습니다. 그저 거울처럼 비춰드리는 자리예요.",
      en: "Over the next 30 minutes, we'll quietly look together at your 12 answers. No evaluation, no prescription. Just a mirror.",
    },
  },
  {
    id: "opening_3",
    kind: "choose",
    next_default: "axis_A_branch",
    text: {
      ko: "준비되셨나요?",
      en: "Are you ready?",
    },
    options: [
      { id: "ready_yes",   text: { ko: "네, 시작해요", en: "Yes, let's begin" }, next: "axis_A_branch" },
      { id: "ready_wait",  text: { ko: "잠깐, 마음 좀 가다듬을게요", en: "Wait, let me settle first" }, next: "opening_wait" },
    ],
  },
  {
    id: "opening_wait",
    kind: "say",
    next: "axis_A_branch",
    text: {
      ko: "천천히 하세요. 21일을 살아내신 분이니까, 30분은 당신의 속도로 가도 충분합니다.",
      en: "Take your time. You've lived through 21 days — these 30 minutes can run at your pace.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // AXIS A · 사명 일치도 (q1, q2) — 5분
  // ─────────────────────────────────────────────────────────
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
      ko: "사명을 '거의 매일' 또는 '며칠에 한 번' 의식하셨다고 답하셨네요. 21일 동안 그렇게 자주 자기 안으로 들어가셨다는 것은, 사명이 책꽂이의 단어가 아니라 일상의 호흡이 되었다는 신호예요.",
      en: "You answered that you were aware of your mission 'almost daily' or 'every few days.' Returning inward that often over 21 days means your mission is no longer a word on a shelf — it has become part of your daily breath.",
    },
  },
  {
    id: "axis_A_mid",
    kind: "say",
    next: "axis_A_q3_reflect",
    text: {
      ko: "일주일에 한 번꼴로 사명을 의식하셨군요. 이 빈도는 부족한 게 아니라, '21일을 시작하기 전의 당신' 보다 분명히 안으로 들어가는 횟수가 늘어났다는 증거예요. 시작점이 어디였는지를 기억해주세요.",
      en: "About once a week, you said. That's not too few — it's measurably more than the version of you before these 21 days. Remember where the starting line was.",
    },
  },
  {
    id: "axis_A_low",
    kind: "say",
    next: "axis_A_q3_reflect",
    text: {
      ko: "사명을 거의 떠올리지 않으셨다고 답하셨어요. 솔직한 답변에 감사드립니다. 21일은 의식의 변화보다 '시작했다는 사실' 그 자체에 의미가 있는 시기예요. 자책할 필요 없어요.",
      en: "You said you rarely thought of your mission. Thank you for your honesty. These 21 days aren't about awareness shifts — they're about the fact that you began at all. No need for self-blame.",
    },
  },
  {
    id: "axis_A_q3_reflect",
    kind: "branch",
    branches: [
      { condition: "q3_nonempty", next: "axis_A_q3_quote" },
      { condition: "default",     next: "axis_A_close"    },
    ],
  },
  {
    id: "axis_A_q3_quote",
    kind: "say",
    next: "axis_A_close",
    text: {
      ko: "당신이 '사명이 가장 또렷했던 한 가지'로 적으신 한 문장 ─\n\n  「{{q3}}」\n\n이 한 문장은 21일 전체에서 가장 단단한 지점일 수 있어요. 잘 적어두세요.",
      en: "You wrote, as the moment your mission felt clearest:\n\n  \"{{q3}}\"\n\nThis single sentence may be the firmest ground of the entire 21 days. Keep it written down.",
    },
  },
  {
    id: "axis_A_close",
    kind: "choose",
    next_default: "axis_B_branch",
    text: {
      ko: "사명 일치도, 어떤 느낌으로 들으셨어요?",
      en: "How did that land?",
    },
    options: [
      { id: "A_resp_continue", text: { ko: "맞아요, 그래요", en: "Yes, that's right" }, next: "axis_B_branch" },
      { id: "A_resp_doubt",    text: { ko: "조금 다르게 느껴져요", en: "It feels a bit different" }, next: "axis_A_doubt" },
    ],
  },
  {
    id: "axis_A_doubt",
    kind: "say",
    next: "axis_B_branch",
    text: {
      ko: "그 다른 느낌도 정확한 데이터예요. 거울이 비추는 모습이 어색할 수 있죠. 다음 거울로 같이 가보겠습니다.",
      en: "That different feeling is also accurate data. A mirror's reflection can feel unfamiliar. Let's move to the next mirror together.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // AXIS B · 첫 행동 3개 실행률 (q4, q5) — 5분
  // ─────────────────────────────────────────────────────────
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
      ko: "첫 행동 3개 중 2~3개를 실행하셨네요. 이건 굉장한 일이에요. 시작한 사람의 90%는 첫 1주에서 멈추거든요. 당신은 그 통계 밖에 계세요.",
      en: "You executed 2-3 of your first 3 actions. That's remarkable. 90% of starters stop in week one — you're outside that statistic.",
    },
  },
  {
    id: "axis_B_mid",
    kind: "say",
    next: "axis_B_q6_reflect",
    text: {
      ko: "첫 행동 3개 중 한두 개를 실행하셨군요. 이건 '부족'이 아니라 '진짜 시도'의 흔적이에요. 시도해본 사람만이 마찰을 알게 됩니다.",
      en: "One or two of your first three. That's not 'less' — it's the footprint of genuine attempt. Only those who try can feel the friction.",
    },
  },
  {
    id: "axis_B_low",
    kind: "say",
    next: "axis_B_q6_reflect",
    text: {
      ko: "거의 실행하지 못하셨다고 답하셨어요. 솔직한 답변 감사해요. 한 가지만 물어봐도 될까요? 무엇이 가장 무거웠나요? 시간, 우선순위, 아니면 마음의 저항?",
      en: "You said you barely executed any. Thank you for your honesty. May I ask one thing — what felt heaviest? Time, priorities, or inner resistance?",
    },
  },
  {
    id: "axis_B_q6_reflect",
    kind: "branch",
    branches: [
      { condition: "q6_nonempty", next: "axis_B_q6_quote" },
      { condition: "default",     next: "axis_B_close"    },
    ],
  },
  {
    id: "axis_B_q6_quote",
    kind: "say",
    next: "axis_B_close",
    text: {
      ko: "당신이 '가장 어려웠던 순간'으로 적으신 ─\n\n  「{{q6}}」\n\n이 문장 안에 다음 3주의 첫 과제가 들어있을 수 있어요. 그 어려움이 어디서 왔는지를 알면, 다음에는 그 지점부터 시작할 수 있거든요.",
      en: "Your note on 'the hardest moment':\n\n  \"{{q6}}\"\n\nThe first task of the next 3 weeks may live inside this sentence. Knowing where the difficulty came from lets you start there next time.",
    },
  },
  {
    id: "axis_B_close",
    kind: "say",
    next: "axis_C_branch",
    text: {
      ko: "다음 거울로 갈게요. 다음 3주의 명확도예요.",
      en: "On to the next mirror — the clarity of your next 3 weeks.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // AXIS C · 다음 3주 명확도 (q7, q8) — 5분
  // ─────────────────────────────────────────────────────────
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
      ko: "다음 3주의 그림이 머릿속에 분명하고, 한 문장으로 설명도 가능하시군요. 이건 21일이 만든 가장 큰 자산이에요. 흩어져 있던 의도가 한 줄로 모인 거니까요.",
      en: "Your picture for the next 3 weeks is clear, and you can put it in one sentence. This is the greatest asset of these 21 days — scattered intentions converged into a single line.",
    },
  },
  {
    id: "axis_C_picture",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "그림은 또렷한데 한 문장으로 묶는 건 아직 어려우시군요. 괜찮습니다. 그림이 먼저, 말은 그 뒤예요. 21일이 그림을 만들었으니, 다음 3주가 말을 만들 차례예요.",
      en: "The picture is clear, but compressing it into one sentence is still hard. That's fine. Image first, words second. These 21 days made the image — the next 3 weeks can make the words.",
    },
  },
  {
    id: "axis_C_words",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "한 문장으로는 설명 가능한데, 머릿속 그림은 아직 흐릿하시군요. 흥미로워요. 보통은 반대거든요. 말이 그림을 끌어당기는 분이세요. 그 한 문장이 다음 3주의 등대가 될 수 있어요.",
      en: "You can put it in one sentence, yet the image is still misty. Interesting — usually it's the opposite. You're someone whose words pull the picture forward. That sentence can be the lighthouse of your next 3 weeks.",
    },
  },
  {
    id: "axis_C_fog",
    kind: "say",
    next: "axis_C_q9_reflect",
    text: {
      ko: "다음 3주의 그림이 아직 흐릿하시군요. 솔직한 답변이에요. 21일은 '계획을 만드는 시기' 가 아니라 '재료를 모으는 시기' 예요. 안개가 걷히는 데는 시간이 걸리는 게 정상입니다.",
      en: "The picture for your next 3 weeks is still hazy. That's an honest answer. These 21 days aren't a 'planning phase' but a 'gathering phase.' Fog takes time to lift — that's normal.",
    },
  },
  {
    id: "axis_C_q9_reflect",
    kind: "branch",
    branches: [
      { condition: "q9_nonempty", next: "axis_C_q9_quote" },
      { condition: "default",     next: "axis_C_close"    },
    ],
  },
  {
    id: "axis_C_q9_quote",
    kind: "say",
    next: "axis_C_close",
    text: {
      ko: "당신이 다음 3주를 한 문장으로 적으신 ─\n\n  「{{q9}}」\n\n이 문장을 21일 차의 당신이 적었다는 사실을 기억하세요. 28일 차의 당신은 이 문장보다 더 명료해질 거예요.",
      en: "Your one sentence for the next 3 weeks:\n\n  \"{{q9}}\"\n\nRemember: the version of you on day 21 wrote this. The version on day 28 will be clearer than this.",
    },
  },
  {
    id: "axis_C_close",
    kind: "say",
    next: "axis_D_branch",
    text: {
      ko: "이제 가장 깊은 거울로 갈게요. 자산화 ─ 21일이 삶의 자산으로 남았는지를 보는 자리예요.",
      en: "Now to the deepest mirror — assetization. Whether these 21 days have settled as an asset of your life.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // AXIS D ⭐ · 자산화 수준 (q10, q11, q12) — 8분 (가장 깊은 자리)
  // ─────────────────────────────────────────────────────────
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
      ko: "21일이 끝난 지금, '여러 변화가 자리잡았다' 또는 '삶의 방향이 바뀌었다' 고 답하셨네요. 이건 21일짜리 리포트가 한 사람의 인생에 만들어내는 가장 깊은 결과예요. 변화가 자리잡으면 다시 흩어지지 않습니다.",
      en: "You said 'multiple changes have settled in' or 'the direction of life has shifted.' This is the deepest outcome a 21-day report can produce. Once changes settle, they don't scatter again.",
    },
  },
  {
    id: "axis_D_mid",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "'한두 가지 분명한 변화' 가 남으셨다고 답하셨어요. 한두 가지면 충분합니다. 21일이 평생을 다 바꾸는 건 아니에요. 한두 개의 닻이 단단히 박힌 게 더 중요합니다.",
      en: "You said 'one or two clear changes remain.' One or two is enough. 21 days don't rewrite a lifetime — what matters is that one or two anchors are firmly set.",
    },
  },
  {
    id: "axis_D_faint",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "'희미한 느낌' 정도가 남으셨다고 답하셨어요. 희미한 느낌은 사라지지 않아요. 시간이 지나면 그 느낌이 어떤 형태로든 다시 돌아옵니다. 21일이 만든 가장 작은 씨앗이에요.",
      en: "You said a 'faint sense' remains. A faint sense doesn't disappear — over time, it returns in some form. The smallest seed these 21 days planted.",
    },
  },
  {
    id: "axis_D_low",
    kind: "say",
    next: "axis_D_q11_check",
    text: {
      ko: "'거의 흔적이 없다' 고 답하셨네요. 정직한 답변에 깊이 감사드립니다. 그런데도 21일을 다 살아내시고 이 자리까지 오셨다는 사실은, 흔적이 0이 아니라는 명백한 증거예요. 흔적은 행동 안에 있어요, 의식 안이 아니라.",
      en: "You said 'almost no trace remains.' Thank you for your deep honesty. And yet — the fact that you walked all 21 days and arrived here is unmistakable evidence the trace is not zero. Traces live in actions, not in awareness.",
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
      ko: "그리고 '한 문장으로 설명할 수 있다' 고 답하셨어요. 다른 사람에게 설명할 수 있다는 건, 자기 안에서 정리가 끝났다는 뜻이에요. 이 한 문장이 당신의 21일 리포트의 표지 같은 거예요.",
      en: "And you said you can 'explain it in one sentence.' Being able to explain it to others means it has settled within you. This sentence is like the cover page of your 21-day report.",
    },
  },
  {
    id: "axis_D_q11_maybe",
    kind: "say",
    next: "axis_D_q12_branch",
    text: {
      ko: "'어렴풋이' 설명할 수 있다고 답하셨어요. 어렴풋함은 부정적이지 않아요. 어렴풋한 상태에서만 다음 깊이로 들어갈 수 있거든요. 너무 또렷하면 더 갈 곳이 없어져요.",
      en: "You said you can describe it 'vaguely.' Vagueness isn't negative — it's the only state that lets you go deeper. Too sharp, and there's nowhere left to go.",
    },
  },
  {
    id: "axis_D_q11_no",
    kind: "say",
    next: "axis_D_q12_branch",
    text: {
      ko: "'아직 설명하기 어렵다' 고 답하셨어요. 21일짜리 경험을 한 문장으로 압축하는 건 사실 무리한 요구이기도 해요. 다음 3주, 다음 3개월이 지나면서 천천히 문장이 만들어질 거예요.",
      en: "You said it's 'still hard to explain.' Compressing a 21-day experience into one sentence is itself a tall ask. As the next 3 weeks and 3 months pass, the sentence will slowly form.",
    },
  },
  {
    id: "axis_D_q12_branch",
    kind: "branch",
    branches: [
      { condition: "q12_nonempty", next: "axis_D_q12_quote" },
      { condition: "default",      next: "axis_D_close"     },
    ],
  },
  {
    id: "axis_D_q12_quote",
    kind: "say",
    next: "axis_D_q12_after",
    text: {
      ko: "당신이 그 한 문장으로 적어주신 ─\n\n  「{{q12}}」\n\n이 문장은 12문항 중 가장 깊은 자리예요. 다른 누구도 적을 수 없는 당신만의 문장입니다.",
      en: "Your one sentence:\n\n  \"{{q12}}\"\n\nThis is the deepest place among the 12 questions. No one else could write this — it is uniquely yours.",
    },
  },
  {
    id: "axis_D_q12_after",
    kind: "say",
    next: "axis_D_close",
    text: {
      ko: "이 문장을 한 달 뒤, 세 달 뒤, 일 년 뒤에도 다시 읽어보세요. 그때마다 같은 문장이 다르게 읽힐 거예요. 그게 자산화의 증거입니다.",
      en: "Read this sentence again in a month, in three months, in a year. Each time, the same words will read differently. That's the proof of assetization.",
    },
  },
  {
    id: "axis_D_close",
    kind: "say",
    next: "closing_1",
    text: {
      ko: "네 개의 거울을 다 들여다봤어요. 이제 마지막 자리 ─ 다음 한 걸음을 같이 정리할게요.",
      en: "We've looked into all four mirrors. Now, the final place — let's name your next single step.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // CLOSING (5분)
  // ─────────────────────────────────────────────────────────
  {
    id: "closing_1",
    kind: "choose",
    next_default: "closing_3",
    text: {
      ko: "다음 3주, 가장 먼저 손대고 싶은 한 가지가 떠오르나요?",
      en: "For the next 3 weeks — does one first thing come to mind?",
    },
    options: [
      { id: "next_clear",   text: { ko: "네, 또렷해요",         en: "Yes, it's clear" },           next: "closing_2_clear" },
      { id: "next_vague",   text: { ko: "어렴풋이 있어요",       en: "Sort of, in fragments" },     next: "closing_2_vague" },
      { id: "next_none",    text: { ko: "아직 모르겠어요",       en: "Not yet" },                   next: "closing_2_none"  },
    ],
  },
  {
    id: "closing_2_clear",
    kind: "say",
    next: "closing_3",
    text: {
      ko: "또렷한 한 가지가 있다면, 오늘 메모장에 한 줄로 적어주세요. 한 달 뒤에 그 줄을 다시 읽으면, 21일과 그다음 3주가 어떻게 이어졌는지가 한눈에 보입니다.",
      en: "If you have one clear thing, write it down in a single line today. Reading that line a month from now will show you how these 21 days and the next 3 weeks connected at a glance.",
    },
  },
  {
    id: "closing_2_vague",
    kind: "say",
    next: "closing_3",
    text: {
      ko: "어렴풋한 단서가 있다는 건 이미 충분해요. 그 어렴풋함을 그대로 메모장에 옮겨두세요. 또렷해질 때를 기다리지 마시고, 흐릿한 채로 적어두는 게 다음 3주의 시작이에요.",
      en: "A faint clue is already enough. Move that faintness onto a memo as-is — don't wait for clarity. Writing the blur down is the start of the next 3 weeks.",
    },
  },
  {
    id: "closing_2_none",
    kind: "say",
    next: "closing_3",
    text: {
      ko: "괜찮습니다. '아직 모른다' 도 정확한 답이에요. 다음 3주는 '한 가지 찾기' 가 아니라 '한 가지 떠오를 자리를 비워두기' 로 가셔도 충분합니다.",
      en: "That's okay. 'Not yet' is also an accurate answer. The next 3 weeks can be about 'keeping a space open for the one thing to arise,' not 'finding the one thing.'",
    },
  },
  {
    id: "closing_3",
    kind: "say",
    next: "closing_4",
    text: {
      ko: "30분이 거의 다 됐어요. 마지막으로 한 가지만 더 말씀드릴게요.",
      en: "Our 30 minutes are almost up. One last thing.",
    },
  },
  {
    id: "closing_4",
    kind: "say",
    next: "closing_5",
    text: {
      ko: "21일을 살아내신 것 자체가, 다른 누군가에게는 시작점이 됩니다. 당신의 이야기는 당신만의 자산이지만, 동시에 다음 사람의 디딤돌이기도 해요.",
      en: "The fact that you lived through these 21 days will itself become a starting point for someone else. Your story is uniquely yours, and at the same time, a stepping stone for the next person.",
    },
  },
  {
    id: "closing_5",
    kind: "end",
    text: {
      ko: "이 자리에서 우리가 같이 들여다본 거울이, 다음 3주에도 당신 안에 살아있기를 진심으로 바랍니다.\n\n혹시 더 깊은 1:1 대화가 필요하시면, 아래 [운영진에게 연결] 버튼을 눌러주세요. 정식 출시 후 가장 먼저 1:1 시간을 마련해드릴게요.",
      en: "May the mirrors we looked into together stay alive within you through the next 3 weeks.\n\nIf you need a deeper 1:1 conversation, press the [Connect with us] button below. After official launch, we will arrange a 1:1 time for you first.",
    },
  },
];

/**
 * 분기 조건 평가 — 단순 DSL (q1 >= 4, q11 == 'yes', q3_nonempty, default)
 * @param {string} condition
 * @param {Object} answers - 폼 응답 객체 (12문항)
 * @returns {boolean}
 */
function evalBranch(condition, answers) {
  if (condition === "default") return true;
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
  // 복합 조건: A && B (단순 AND 만 지원, 한 단계)
  if (condition.includes("&&")) {
    return condition.split("&&").every((c) => evalBranch(c.trim(), answers));
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

module.exports = {
  CHAT_SCRIPT_VERSION,
  NODES,
  NODE_MAP,
  ENTRY_NODE_ID,
  ALLOWED_OPTION_IDS,
  ALLOWED_NODE_IDS,
  evalBranch,
  renderText,
  getNextNodeId,
};
