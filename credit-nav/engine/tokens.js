// 1단계: 하려는 일 → 토큰. 순수 함수.
export function srcTokens(chars, lang, models) {
  const d = models.densityPerChar[lang];
  if (d == null) throw new Error(`밀도 없음: ${lang}`);
  return chars * d;
}
// 묶음 작업(번역 등): 호출 수 × 고정분 + 원문 토큰 × 배율
export function recipeTokens({ chars, items, lang = "ko", targets = 1, calls }, recipe, models, outPer = recipe.outPerSrcToken.mean) {
  const src = srcTokens(chars, lang, models) * targets;
  const n = calls ?? targets * Math.max(1, Math.ceil((items ?? 1) / recipe.batchSize));
  return {
    input: n * recipe.overheadIn + src * recipe.inPerSrcToken,
    output: n * (recipe.overheadOut || 0) + src * outPer,
    calls: n,
  };
}
// 대화 누적: n번 주고받으면 매번 앞 대화를 다시 읽음 → 입력 ≈ 한 번 분량 × n(n+1)/2
export function conversationInput(perTurnTokens, turns, baseContext = 0) {
  return baseContext * turns + perTurnTokens * turns * (turns + 1) / 2;
}
