"use strict";

/**
 * Deterministic, entirely synthetic assessment fixture.
 *
 * Values are derived from the public question schema so tests never need a
 * production RTDB export. Do not add names, email addresses, order IDs, or
 * copied customer answers here.
 */
function buildSyntheticAssessment(questions) {
  if (!questions || !Array.isArray(questions.sections)) {
    throw new TypeError("questions.sections is required");
  }

  const answers = {};
  let index = 0;
  for (const section of questions.sections) {
    for (const question of section.questions || []) {
      if (question.type === "likert") {
        answers[question.id] = (index % 5) + 1;
      } else if (question.type === "single_choice") {
        const options = Array.isArray(question.options) ? question.options : [];
        if (!options.length) throw new Error(`No options for ${question.id}`);
        answers[question.id] = options[index % options.length];
      } else if (question.type === "multi_choice") {
        const options = Array.isArray(question.options) ? question.options : [];
        const count = Math.max(1, Math.min(Number(question.max) || 1, options.length));
        const start = options.length ? index % options.length : 0;
        answers[question.id] = Array.from({ length: count }, (_, offset) =>
          options[(start + offset) % options.length]
        );
      } else {
        throw new Error(`Unsupported question type for ${question.id}: ${question.type}`);
      }
      index += 1;
    }
  }

  return {
    status: "submitted",
    submittedAt: "2026-01-01T00:00:00.000Z",
    submittedAtMs: 1767225600000,
    name: "합성 테스트 사용자",
    email: "synthetic@example.invalid",
    recvMethod: "site",
    userAgent: "LifePortfolio synthetic fixture",
    answers,
  };
}

module.exports = { buildSyntheticAssessment };
