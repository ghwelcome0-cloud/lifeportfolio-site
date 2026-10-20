// 2단계: 토큰 → 원가(USD)
export function apiCostUSD({ input, output }, modelName, models) {
  const m = models.models[modelName];
  if (!m) throw new Error(`모델 없음: ${modelName}`);
  return (input * m.input + output * m.output) / 1e6;
}
