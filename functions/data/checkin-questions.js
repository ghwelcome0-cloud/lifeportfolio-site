/**
 * 21일 점검 동행 — 12문항 자가 점검 단일 소스 (Single Source of Truth)
 * ===========================================================================
 *
 * 사용처 (3곳에서 import — 변경 시 1곳만 수정하면 모두 동기화됨):
 *   1) functions/index.js — submitCheckinResponse Callable 의 검증 화이트리스트
 *   2) checkin-21-form.html (KO) — 클라이언트 렌더링 (fetch 로 가져오기)
 *   3) checkin-21-form-en.html (EN) — 클라이언트 렌더링
 *
 * 데이터 구조:
 *   - axes[]: 4개 축 (A, B, C, D)
 *   - 각 축에 questions[3]: q1(객관식), q2(객관식), q3(자유서술, 선택)
 *
 * 변경 정책:
 *   - 문항 추가/삭제 시 ALLOWED_QUESTION_IDS 동시 갱신
 *   - 객관식 선택지 수정 시 ALLOWED_CHOICES_BY_QID 동시 갱신
 *   - 이미 응답된 데이터와의 호환을 위해 q1~q12 ID 는 변경 금지 (영구)
 */

'use strict';

const QUESTIONS = {
  axes: [
    {
      id: 'A',
      title: { ko: '축 A · 사명 일치도', en: 'Mirror A · Mission alignment' },
      questions: [
        {
          qid: 'q1',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '지난 21일 중, "내가 이 길에 있다"고 느낀 순간이 있었나요?',
            en: 'During the past 21 days, did you ever feel "I am on this path"?',
          },
          choices: [
            { value: '1', label: { ko: '거의 없었어요', en: 'Almost never' } },
            { value: '2', label: { ko: '한두 번 있었어요', en: 'Once or twice' } },
            { value: '3', label: { ko: '일주일에 한 번쯤', en: 'About once a week' } },
            { value: '4', label: { ko: '며칠에 한 번', en: 'Every few days' } },
            { value: '5', label: { ko: '거의 매일', en: 'Almost every day' } },
          ],
        },
        {
          qid: 'q2',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '리포트에서 받은 사명 한 줄을 21일 동안 떠올린 빈도는?',
            en: 'How often did you recall your one-line mission from the report?',
          },
          choices: [
            { value: '0', label: { ko: '한 번도', en: 'Never' } },
            { value: '1-2', label: { ko: '1~2회', en: '1–2 times' } },
            { value: '3-5', label: { ko: '3~5회', en: '3–5 times' } },
            { value: '6-10', label: { ko: '6~10회', en: '6–10 times' } },
            { value: '11+', label: { ko: '11회 이상', en: '11+ times' } },
          ],
        },
        {
          qid: 'q3',
          type: 'free_text',
          required: false,
          maxLength: 200,
          prompt: {
            ko: '21일 중 사명과 가장 가까웠던 한 순간을 한 문장으로 적어보신다면? (선택)',
            en: 'If you could capture in one sentence the moment closest to your mission during the 21 days? (optional)',
          },
        },
      ],
    },
    {
      id: 'B',
      title: { ko: '축 B · 첫 행동 3개 실행률', en: 'Mirror B · First-three execution rate' },
      questions: [
        {
          qid: 'q4',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '리포트가 제안한 첫 행동 3개 중 몇 개를 시작하셨나요?',
            en: 'Of the three first actions the report suggested, how many did you start?',
          },
          choices: [
            { value: '0', label: { ko: '0개', en: 'None' } },
            { value: '1', label: { ko: '1개', en: 'One' } },
            { value: '2', label: { ko: '2개', en: 'Two' } },
            { value: '3', label: { ko: '3개 모두', en: 'All three' } },
          ],
        },
        {
          qid: 'q5',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '시작한 행동 중, 지금도 이어지고 있는 것은 몇 개인가요?',
            en: 'Of the actions you started, how many are still ongoing today?',
          },
          choices: [
            { value: 'na', label: { ko: '해당 없음', en: 'Not applicable' } },
            { value: '0', label: { ko: '0개', en: 'None' } },
            { value: '1', label: { ko: '1개', en: 'One' } },
            { value: '2', label: { ko: '2개', en: 'Two' } },
            { value: '3', label: { ko: '3개 모두', en: 'All three' } },
          ],
        },
        {
          qid: 'q6',
          type: 'free_text',
          required: false,
          maxLength: 200,
          prompt: {
            ko: '가장 어려웠던 행동, 또는 의외로 잘 된 행동 하나를 적어주세요. (선택)',
            en: 'Share one action that was hardest, or one that unexpectedly worked. (optional)',
          },
        },
      ],
    },
    {
      id: 'C',
      title: { ko: '축 C · 다음 3주 명확도', en: 'Mirror C · Clarity for the next 3 weeks' },
      questions: [
        {
          qid: 'q7',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '다음 3주 동안 무엇을 할지 머릿속에 그려지시나요?',
            en: 'Can you picture what you will do over the next 3 weeks?',
          },
          choices: [
            { value: '1', label: { ko: '전혀 안 그려져요', en: 'Not at all' } },
            { value: '2', label: { ko: '흐릿해요', en: 'Hazy' } },
            { value: '3', label: { ko: '절반 정도', en: 'About half' } },
            { value: '4', label: { ko: '대체로 명확해요', en: 'Mostly clear' } },
            { value: '5', label: { ko: '매우 명확해요', en: 'Very clear' } },
          ],
        },
        {
          qid: 'q8',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '다음 3주의 첫 번째 행동을 지금 한 문장으로 말할 수 있나요?',
            en: 'Can you state the first action for the next 3 weeks in one sentence right now?',
          },
          choices: [
            { value: 'no', label: { ko: '아니요', en: 'No' } },
            { value: 'vague', label: { ko: '어렴풋이', en: 'Vaguely' } },
            { value: 'yes', label: { ko: '네, 말할 수 있어요', en: 'Yes, I can' } },
          ],
        },
        {
          qid: 'q9',
          type: 'free_text',
          required: false,
          maxLength: 200,
          prompt: {
            ko: '다음 3주에 가장 집중하고 싶은 한 가지를 적어주세요. (선택)',
            en: 'Write down one thing you most want to focus on in the next 3 weeks. (optional)',
          },
        },
      ],
    },
    {
      id: 'D',
      title: { ko: '축 D ⭐ · 자산화 수준', en: 'Mirror D ⭐ · Inheritance level' },
      questions: [
        {
          qid: 'q10',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '21일이 끝난 지금, 삶에 어떤 흔적이 남았다고 느끼시나요?',
            en: 'Now that the 21 days have ended, what trace do you feel they left on your life?',
          },
          choices: [
            { value: '1', label: { ko: '거의 흔적 없음', en: 'Almost no trace' } },
            { value: '2', label: { ko: '희미한 느낌', en: 'A faint feeling' } },
            { value: '3', label: { ko: '한두 가지 분명한 변화', en: 'One or two clear changes' } },
            { value: '4', label: { ko: '여러 변화가 자리잡음', en: 'Several changes have taken root' } },
            { value: '5', label: { ko: '삶의 방향이 바뀜', en: 'My life direction has changed' } },
          ],
        },
        {
          qid: 'q11',
          type: 'single_choice',
          required: true,
          prompt: {
            ko: '이 21일을 다른 사람에게 한 문장으로 설명해야 한다면, 가능하신가요?',
            en: 'If you had to explain these 21 days to someone else in one sentence, could you?',
          },
          choices: [
            { value: 'no', label: { ko: '아니요', en: 'No' } },
            { value: 'vague', label: { ko: '어렴풋이', en: 'Vaguely' } },
            { value: 'yes', label: { ko: '네, 가능해요', en: 'Yes, I can' } },
          ],
        },
        {
          qid: 'q12',
          type: 'free_text',
          required: false,
          maxLength: 300,
          prompt: {
            ko: '그 한 문장을 적어주세요. (다른 사람에게 21일을 어떻게 설명하시겠어요? · 선택)',
            en: 'Write that sentence. (How would you explain the 21 days to someone else? · optional)',
          },
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 서버측 검증 헬퍼 — submitCheckinResponse Callable 에서 사용
// ─────────────────────────────────────────────────────────────────────

/** 모든 객관식 문항 QID — keys().hasOnly() 화이트리스트용 */
const ALLOWED_QUESTION_IDS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6',
  'q7', 'q8', 'q9', 'q10', 'q11', 'q12',
];

/** 객관식 문항별 허용 value 집합 — 위변조 차단 */
const ALLOWED_CHOICES_BY_QID = (() => {
  const map = {};
  for (const axis of QUESTIONS.axes) {
    for (const q of axis.questions) {
      if (q.type === 'single_choice') {
        map[q.qid] = new Set(q.choices.map((c) => c.value));
      }
    }
  }
  return map;
})();

/** 자유서술 문항별 최대 길이 */
const FREE_TEXT_MAX_LENGTH = (() => {
  const map = {};
  for (const axis of QUESTIONS.axes) {
    for (const q of axis.questions) {
      if (q.type === 'free_text') {
        map[q.qid] = q.maxLength || 200;
      }
    }
  }
  return map;
})();

/** 필수 문항 QID 목록 */
const REQUIRED_QUESTION_IDS = (() => {
  const list = [];
  for (const axis of QUESTIONS.axes) {
    for (const q of axis.questions) {
      if (q.required) list.push(q.qid);
    }
  }
  return list;
})();

/**
 * 응답 객체 검증 — submitCheckinResponse 의 입력 검증에서 사용
 * @param {Object} answers - 클라이언트가 보낸 응답 { q1: "value", q2: "value", ... }
 * @returns {{ok: boolean, error?: string}}
 */
function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, error: 'answers 는 객체여야 합니다' };
  }
  // 1) 알 수 없는 키 거부 (whitelist)
  for (const key of Object.keys(answers)) {
    if (!ALLOWED_QUESTION_IDS.includes(key)) {
      return { ok: false, error: `허용되지 않은 응답 키: ${key}` };
    }
  }
  // 2) 필수 문항 누락 거부
  for (const qid of REQUIRED_QUESTION_IDS) {
    const v = answers[qid];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      return { ok: false, error: `필수 응답 누락: ${qid}` };
    }
  }
  // 3) 객관식 값 화이트리스트 검증
  for (const [qid, allowedSet] of Object.entries(ALLOWED_CHOICES_BY_QID)) {
    if (qid in answers) {
      const v = answers[qid];
      if (typeof v !== 'string' || !allowedSet.has(v)) {
        return { ok: false, error: `${qid} 의 허용되지 않은 값: ${String(v).slice(0, 30)}` };
      }
    }
  }
  // 4) 자유서술 길이 제한
  for (const [qid, maxLen] of Object.entries(FREE_TEXT_MAX_LENGTH)) {
    if (qid in answers && answers[qid] !== null && answers[qid] !== undefined) {
      const v = answers[qid];
      if (typeof v !== 'string') {
        return { ok: false, error: `${qid} 는 문자열이어야 합니다` };
      }
      if (v.length > maxLen) {
        return { ok: false, error: `${qid} 가 최대 ${maxLen}자 초과` };
      }
    }
  }
  return { ok: true };
}

module.exports = {
  QUESTIONS,
  ALLOWED_QUESTION_IDS,
  ALLOWED_CHOICES_BY_QID,
  FREE_TEXT_MAX_LENGTH,
  REQUIRED_QUESTION_IDS,
  validateAnswers,
};
