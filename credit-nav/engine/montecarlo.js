// 보통/넉넉히 범위. 같은 seed면 같은 결과 (결정적).
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function normal(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
export function simulate(fn, { runs = 1000, seed = 42 } = {}) {
  const r = rng(seed);
  const xs = Array.from({ length: runs }, () => fn(r)).sort((a, b) => a - b);
  const q = (p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  return { p50: q(0.5), p90: q(0.9), min: xs[0], max: xs.at(-1) };
}
