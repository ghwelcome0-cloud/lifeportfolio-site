"use strict";
// Minimal in-memory stand-in for the parts of the Admin RTDB API the module uses.
// It is NOT a fidelity model of RTDB atomicity; it only records the write sequence so tests can
// assert ordering ("nothing reached the public nodes before the fence committed") and can inject
// failures / interleavings (hooks) to reproduce the reviewer's race counterexamples.
//
// Hooks: db.hooks.beforeWrite(path, op) may be async and may throw (simulates a failed write or lets a
// test run a concurrent actor at an exact point). db.failOn.paths short-circuits a write with an error.

function createFakeDb(initial) {
  let root = JSON.parse(JSON.stringify(initial || {}));
  const writes = []; // { op, path, value }
  const failOn = { paths: new Set() };
  const hooks = { beforeWrite: null, beforeTransaction: null };

  const split = (p) => (p || "").split("/").filter(Boolean);
  const get = (p) => split(p).reduce((n, k) => (n && typeof n === "object" && k in n ? n[k] : undefined), root);
  const prune = (parts) => {
    while (parts.length) {
      const node = parts.reduce((n, k) => (n && typeof n === "object" ? n[k] : undefined), root);
      if (node && typeof node === "object" && Object.keys(node).length === 0) {
        const parent = parts.slice(0, -1).reduce((n, k) => n[k], root);
        delete parent[parts[parts.length - 1]];
        parts = parts.slice(0, -1);
      } else break;
    }
  };
  const set = (p, v) => {
    const parts = split(p);
    if (parts.length === 0) { root = v == null ? {} : JSON.parse(JSON.stringify(v)); return; }
    let n = root;
    for (const k of parts.slice(0, -1)) { if (!n[k] || typeof n[k] !== "object") n[k] = {}; n = n[k]; }
    const last = parts[parts.length - 1];
    if (v === null || v === undefined) { delete n[last]; prune(parts.slice(0, -1)); } else n[last] = JSON.parse(JSON.stringify(v));
  };
  const pre = async (path, op) => {
    if (failOn.paths.has(path)) throw new Error("fake write failure " + path);
    if (hooks.beforeWrite) await hooks.beforeWrite(path, op);
  };

  function ref(path) {
    path = path || "";
    return {
      path,
      async once() { const v = get(path); return { exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; },
      async set(v) { await pre(path, "set"); writes.push({ op: "set", path, value: v }); set(path, v); },
      async update(obj) {
        for (const k of Object.keys(obj)) await pre(path ? `${path}/${k}` : k, "update");
        writes.push({ op: "update", path, value: obj });
        for (const [k, v] of Object.entries(obj)) set(path ? `${path}/${k}` : k, v);
      },
      async transaction(fn) {
        if (hooks.beforeTransaction) await hooks.beforeTransaction(path);
        const before = get(path);
        const next = fn(before === undefined ? null : JSON.parse(JSON.stringify(before)));
        if (next === undefined) return { committed: false, snapshot: { exists: () => before != null, val: () => (before == null ? null : JSON.parse(JSON.stringify(before))) } };
        writes.push({ op: "transaction", path, value: next });
        set(path, next);
        return { committed: true, snapshot: { exists: () => true, val: () => JSON.parse(JSON.stringify(next)) } };
      },
    };
  }
  return { ref, get, writes, failOn, hooks, snapshot: () => JSON.parse(JSON.stringify(root)) };
}

module.exports = { createFakeDb };
