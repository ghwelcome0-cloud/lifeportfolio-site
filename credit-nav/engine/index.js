import fs from "node:fs";
import path from "node:path";
export * from "./tokens.js";
export * from "./cost.js";
export * from "./convert.js";
export * from "./montecarlo.js";
export * from "./budget.js";
const DATA = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
export function loadData(dir = DATA) {
  const r = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  return { models: r("models.json"), services: r("services.json"), recipes: r("recipes.json"), calib: r("calib.json") };
}
