"use strict";
// Minimal in-memory stand-in for the parts of the Admin RTDB API the module uses.
// It is NOT a fidelity model of RTDB atomicity; it only records the write sequence so
// tests can assert "nothing reached the public nodes before the single publish update".

function createFakeDb(initial) {
  let root = JSON.parse(JSON.stringify(initial || {}));
  const writes = []; // { op, path, value }
  const failOn = { paths: new Set() };

  const split = (p) => (p || "").split("/").filter(Boolean);
  const get = (p) => split(p).reduce((n, k) => (n && typeof n === "object" && k in n ? n[k] : undefined), root);
  const set = (p, v) => {
    const parts = split(p);
    if (parts.length === 0) { root = v == null ? {} : v; return; }
    let n = root;
    for (const k of parts.slice(0, -1)) { if (!n[k] || typeof n[k] !== "object") n[k] = {}; n = n[k]; }
    const last = parts[parts.length - 1];
    if (v === null || v === undefined) { delete n[last]; prune(parts.slice(0, -1)); } else n[last] = JSON.parse(JSON.stringify(v));
  };
  // RTDB has no empty objects: a parent whose last child was removed disappears too.
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

  function ref(path) {
    path = path || "";
    return {
      path,
      async once() { const v = get(path); return { exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; },
      async set(v) { if (failOn.paths.has(path)) throw new Error("fake write failure " + path); writes.push({ op: "set", path, value: v }); set(path, v); },
      async update(obj) {
        // multi-location: all keys are absolute when called on root, relative otherwise
        for (const k of Object.keys(obj)) { const full = path ? `${path}/${k}` : k; if (failOn.paths.has(full)) throw new Error("fake write failure " + full); }
        writes.push({ op: "update", path, value: obj });
        for (const [k, v] of Object.entries(obj)) set(path ? `${path}/${k}` : k, v);
      },
      async transaction(fn) {
        const before = get(path);
        const next = fn(before === undefined ? null : JSON.parse(JSON.stringify(before)));
        if (next === undefined) return { committed: false, snapshot: { exists: () => before != null, val: () => before } };
        writes.push({ op: "transaction", path, value: next });
        set(path, next);
        return { committed: true, snapshot: { exists: () => true, val: () => JSON.parse(JSON.stringify(next)) } };
      },
    };
  }
  return { ref, get, writes, failOn, snapshot: () => JSON.parse(JSON.stringify(root)) };
}

module.exports = { createFakeDb };
