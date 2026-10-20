// node --test credit-nav/test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadData, apiCostUSD, toCredits, srcTokens, recipeTokens, conversationInput, simulate, rng, estimate, creditsFromTokens } from "../engine/index.js";

const data = loadData();
const ledger = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../ledger/ledger.json"), "utf8"));
const err = (est, act) => (est - act) / act;

test("2단계 원가: 공식 예 (A-2) 3,678/12,424 토큰 = $0.0258", () => {
  assert.ok(Math.abs(apiCostUSD({ input: 3678, output: 12424 }, "gpt-5-mini", data.models) - 0.02577) < 1e-4);
});

test("3단계 환산: 표시가 기준 크레딧 1개 $0.0020", () => {
  assert.equal(toCredits(0.002, "genspark", data.services, null), 1);
});

test("단계 0 기준: 번역 실측 13.2 크레딧을 실제 토큰에서 ±15% 안으로 재현", () => {
  const e = ledger.entries.find((x) => x.actualCredits === 13.2);
  const c = creditsFromTokens(e.tokens, e.model, data);
  assert.ok(Math.abs(err(c, 13.2)) <= 0.15, `재현 ${c.toFixed(2)} (오차 ${(err(c, 13.2) * 100).toFixed(1)}%)`);
});

test("장부 전체: 토큰→크레딧 오차 ±15% 이내", () => {
  for (const e of ledger.entries.filter((x) => x.tokens)) {
    const c = creditsFromTokens(e.tokens, e.model, data);
    assert.ok(Math.abs(err(c, e.actualCredits)) <= 0.15, `${e.id}: ${c.toFixed(2)} vs ${e.actualCredits}`);
  }
});

test("글자 수만으로 예상 (1~3단계 전체): 장부 평균 절대 오차 ±25% 이내 (검증 1 기준)", () => {
  const errs = ledger.entries.filter((x) => x.recipe === "translate").map((e) => {
    const r = estimate({ recipe: "translate", chars: e.chars, items: e.items, targets: e.targets, calls: e.calls }, data);
    return Math.abs(err(r.credits, e.actualCredits));
  });
  const mae = errs.reduce((a, b) => a + b, 0) / errs.length;
  assert.ok(mae <= 0.25, `평균 절대 오차 ${(mae * 100).toFixed(1)}% (각 ${errs.map((x) => (x * 100).toFixed(0) + "%").join(", ")})`);
});

test("범위: 넉넉히 ≥ 보통, 같은 seed 같은 결과", () => {
  const job = { recipe: "translate", chars: 32464, items: 1761, targets: 3 };
  const a = estimate(job, data), b = estimate(job, data);
  assert.ok(a.generous >= a.normal && a.normal > 0);
  assert.deepEqual(a, b);
});

test("대화 누적: 대화 길이 2배 → 입력 약 4배", () => {
  const r = conversationInput(1000, 40) / conversationInput(1000, 20);
  assert.ok(r > 3.8 && r < 4.1, String(r));
});

test("보조 함수", () => {
  assert.equal(srcTokens(100, "ko", data.models), 53);
  assert.throws(() => srcTokens(1, "xx", data.models));
  assert.throws(() => apiCostUSD({ input: 1, output: 1 }, "none", data.models));
  const r = rng(7); const x = r(); assert.ok(x > 0 && x < 1);
  assert.equal(simulate(() => 5, { runs: 10 }).p90, 5);
  assert.equal(recipeTokens({ chars: 100, items: 120, targets: 2 }, data.recipes.recipes.translate, data.models).calls, 6);
});
