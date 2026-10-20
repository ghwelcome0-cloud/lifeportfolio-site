// 레시피 하나를 크레딧 범위로. 엔진 진입점.
import { recipeTokens } from "./tokens.js";
import { apiCostUSD } from "./cost.js";
import { toCredits, toKRW } from "./convert.js";
import { simulate, normal } from "./montecarlo.js";

export function estimate(job, data, { service = "genspark", runs = 1000, seed = 42 } = {}) {
  const recipe = data.recipes.recipes[job.recipe];
  if (!recipe) throw new Error(`레시피 없음: ${job.recipe}`);
  const point = (outPer) => {
    const t = recipeTokens(job, recipe, data.models, outPer);
    return toCredits(apiCostUSD(t, recipe.model, data.models), service, data.services, data.calib);
  };
  const { mean, sd } = recipe.outPerSrcToken;
  const tokens = recipeTokens(job, recipe, data.models);
  const sim = simulate((r) => point(Math.max(0.2 * mean, mean + sd * normal(r))), { runs, seed });
  const usd = apiCostUSD(tokens, recipe.model, data.models);
  return { tokens, usd, krw: toKRW(usd, data.services), credits: point(mean), normal: sim.p50, generous: sim.p90 };
}
// 실제 토큰을 알 때 (2·3단계만)
export function creditsFromTokens(tokens, model, data, service = "genspark") {
  return toCredits(apiCostUSD(tokens, model, data.models), service, data.services, data.calib);
}
