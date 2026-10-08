"use strict";
// 인생포트폴리오 디지털 다이어리 — owner-only storage callable `diary`.
// STATUS: exported from functions/index.js as `diary` (asia-northeast3).
// Storage: RTDB diary/{uid}/{meta|pages/<pageKey>|logs/<logId>}. Clients cannot read or write it
// (root `$other` rule denies all); only this module does, with uid taken from Auth only.
// Each node stores its content as one JSON string so RTDB never drops empty values or reorders.
// Report/program data are read (owner's own path), never written. Internal provenance
// (evidence question ids, axis rules) is never sent to the browser.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const S = require("./_diary_schema.js");

const MAX_LOGS = 500, OPS_KEPT = 30;
const ID = /^[A-Za-z0-9_-]{6,64}$/;
const SID = /^s_[A-Za-z0-9_]{1,78}$/;
const fail = (code, msg) => { throw new HttpsError(code, msg); };
const base = uid => admin.database().ref(`diary/${uid}`);
const now = () => admin.database.ServerValue.TIMESTAMP;
const parse = node => { if (!node || typeof node.doc !== "string") return null; try { return JSON.parse(node.doc); } catch (_) { return null; } };

// ---- customer-safe seed from the owner's own report + program --------------------------
const str = v => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const strs = (a, n) => (Array.isArray(a) ? a.map(str).filter(Boolean).slice(0, n) : []);
const INTERNAL = /\b(?:Q\d{1,3}|self_(?:understanding|expression|design|execution))\b|evidenceRefs|axisRule|_strategy/;
const safe = s => (INTERNAL.test(s) ? "" : s);
function seedFrom(stored, programNode) {
  const r = stored && stored.report; if (!r || !r.sections) return null;
  const list = Array.isArray(r.sections) ? r.sections : Object.keys(r.sections).map(k => r.sections[k]);
  const sec = k => { const x = list.find(v => v && v.id === k); return (x && x.content) || {}; };
  const mv = sec("mission_vision"), ep = sec("execution_profile"), gm = sec("growth_map"), ce = sec("career_education");
  const proj = r._axisProjection && r._axisProjection.axes || {};
  const pct = (r.scores && r.scores.axisPct) || {};
  // Ordered list (자기이해·자기표현·자기설계·자기실행) with display names only — no internal keys.
  const axes = S.AXES.map(a => {
    const c = sec(a.key), p = proj[a.key] || {};
    const n = Number(c.pct != null ? c.pct : pct[a.key]);
    return { name: a.name, pct: Number.isFinite(n) ? Math.round(n) : null, question: safe(str(p.question)), core: safe(str(p.core || c.core)),
      keywords: strs(c.keywords, 4).map(safe).filter(Boolean), action: safe(str(p.action)), reflection: safe(str(p.reflection)) };
  });
  const seed = {
    name: str(r.profile && r.profile.name).slice(0, 40), lang: r.lang === "en" ? "en" : "ko",
    mission: safe(str(mv.mission)), vision: safe(str(mv.vision)), axes,
    strengths: strs(gm.strengths, 3).map(safe), growth: strs(gm.growth, 2).map(safe),
    profile: ["type", "style", "drivers", "environment", "activities", "tools"].map(k => ({ key: k, text: safe(str(ep[k])) })),
    careers: strs(ce.careers, 3).map(safe), education: strs(ce.education, 3).map(safe), directions: strs(ce.directions, 3).map(safe),
    careerNote: safe(str(ce.careerGuideNote)), program: null
  };
  const p = programNode && programNode.program;
  if (p) {
    const weeks = (p.program && Array.isArray(p.program.weeks) ? p.program.weeks : []).slice(0, 4).map(w => ({ title: safe(str(w.title)),
      action: safe(str((w.actions && w.actions[0]) || w.guide)), doneWhen: safe(str(w.effects && w.effects[0])) })).filter(w => w.title && w.action);
    const ax = p._axisProgram && Array.isArray(p._axisProgram.items) ? p._axisProgram.items[0] : null;
    seed.program = { theme: safe(str(p.quarter && p.quarter.heading)), weeks,
      focus: ax ? { action: safe(str(ax.action)), doneWhen: safe(str(ax.doneWhen)), artifact: safe(str(ax.artifact)), reuse: safe(str(ax.reuse)) } : null,
      month3: (p.program && p.program.month3 && Array.isArray(p.program.month3.goals) ? p.program.month3.goals : []).slice(0, 5).map(g => safe(str(g.title))).filter(Boolean),
      year1: safe(str(p.program && p.program.year1 && p.program.year1.vision && p.program.year1.vision[0])) };
  }
  if (INTERNAL.test(JSON.stringify(seed))) fail("internal", "리포트 내용을 다이어리로 옮기지 못했습니다.");
  return seed;
}

// ---- actions ---------------------------------------------------------------------------
async function open(uid, data) {
  const snap = (await base(uid).get()).val() || {};
  const meta = parse(snap.meta);
  const sid = (data.reportSid && SID.test(data.reportSid)) ? data.reportSid : (meta && meta.reportSid) || null;
  let seed = null;
  if (sid) {
    const [rep, prog] = await Promise.all([admin.database().ref(`reports/${uid}/${sid}`).get(), admin.database().ref(`programs/${uid}/${sid}`).get()]);
    seed = seedFrom(rep.val(), prog.val());
  }
  const pages = {};
  Object.keys(snap.pages || {}).forEach(k => { const d = parse(snap.pages[k]); if (d && S.BY_KEY[k]) pages[k] = { fields: d, rev: snap.pages[k].rev || 0 }; });
  return { ok: true, schema: S.VERSION, meta: meta ? { startDate: meta.startDate || null, reportSid: meta.reportSid || null } : null,
    reportFound: !!seed, seed, pages, logs: listLogs(snap.logs) };
}
function listLogs(node) {
  return Object.keys(node || {}).map(id => { const d = parse(node[id]); return d && { id, date: d.date, text: d.text, kept: d.kept || null, stage: node[id].stage || 0, createdAt: node[id].createdAt || 0 }; })
    .filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt - a.createdAt) || a.id.localeCompare(b.id)));
}
async function start(uid, data) {
  if (!S.isDate(data.startDate || "")) fail("invalid-argument", "시작한 날을 확인해 주세요.");
  if (data.reportSid != null && !SID.test(data.reportSid)) fail("invalid-argument", "리포트 정보가 올바르지 않습니다.");
  if (data.reportSid && !(await admin.database().ref(`reports/${uid}/${data.reportSid}`).get()).exists()) fail("failed-precondition", "내 리포트를 찾지 못했습니다.");
  const meta = { startDate: data.startDate, reportSid: data.reportSid || null };
  await base(uid).child("meta").set({ doc: JSON.stringify(meta), updatedAt: now() });
  return { ok: true, meta };
}
async function savePage(uid, data) {
  if (!ID.test(data.opId || "")) fail("invalid-argument", "저장 요청이 올바르지 않습니다.");
  const v = S.validatePatch(data.pageKey, data.patch);
  if (!v.ok) fail("invalid-argument", v.error === "too-long" ? "글이 너무 길어요. 조금 줄여 주세요." : "저장할 내용을 확인해 주세요.");
  let applied = false;
  const saved = await base(uid).child("pages").child(data.pageKey).transaction(cur => {
    applied = false;
    const ops = (cur && Array.isArray(cur.ops)) ? cur.ops : [];
    if (ops.indexOf(data.opId) >= 0) return; // idempotent retry: nothing to change
    const fields = (cur && parse(cur)) || {};
    Object.keys(v.clean).forEach(k => { if (v.clean[k] === null) delete fields[k]; else fields[k] = v.clean[k]; });
    applied = true;
    return { doc: JSON.stringify(fields), rev: ((cur && cur.rev) || 0) + 1, ops: ops.concat(data.opId).slice(-OPS_KEPT), updatedAt: now() };
  }, undefined, false);
  const node = saved.snapshot.val();
  if (!node) fail("internal", "저장을 확인하지 못했습니다.");
  return { ok: true, applied: saved.committed && applied, page: { fields: parse(node) || {}, rev: node.rev } };
}
async function addLog(uid, data) {
  if (!ID.test(data.logId || "")) fail("invalid-argument", "기록 정보가 올바르지 않습니다.");
  const v = S.validateLog(data.log);
  if (!v.ok) fail("invalid-argument", "오늘 해 본 일을 한 줄로 적어 주세요.");
  const logs = base(uid).child("logs");
  const count = Object.keys((await logs.get()).val() || {}).length;
  const doc = JSON.stringify(v.clean), stage = v.clean.kept ? 1 : 0;
  const saved = await logs.child(data.logId).transaction(cur => {
    if (cur === null) { if (count >= MAX_LOGS) return; return { doc, stage, createdAt: now() }; }
    return; // never overwrite
  }, undefined, false);
  const node = saved.snapshot.val();
  if (!node) fail("resource-exhausted", "기록은 최대 " + MAX_LOGS + "개까지 남길 수 있어요.");
  if (!saved.committed && node.doc !== doc) fail("already-exists", "같은 번호의 다른 기록이 있습니다.");
  return { ok: true, created: saved.committed, log: Object.assign({ id: data.logId, stage: node.stage || 0 }, parse(node)) };
}
// Stages 0–1 are self-recorded. 2–5 open only through services that are not launched yet.
async function keepLog(uid, data) {
  if (!ID.test(data.logId || "")) fail("invalid-argument", "기록 정보가 올바르지 않습니다.");
  if (typeof data.kept !== "string" || !data.kept.trim() || data.kept.length > 300) fail("invalid-argument", "남긴 것을 한 줄로 적어 주세요.");
  const kept = data.kept.replace(/\s+/g, " ").trim();
  const saved = await base(uid).child("logs").child(data.logId).transaction(cur => {
    if (cur === null) return null;
    const d = parse(cur); if (!d) return;
    if (d.kept === kept) return;
    d.kept = kept;
    return Object.assign({}, cur, { doc: JSON.stringify(d), stage: Math.max(cur.stage || 0, 1), updatedAt: now() });
  }, undefined, false);
  const node = saved.snapshot.val();
  if (!node) fail("not-found", "기록을 찾지 못했습니다.");
  return { ok: true, log: Object.assign({ id: data.logId, stage: node.stage || 0 }, parse(node)) };
}
async function deleteLog(uid, data) {
  if (!ID.test(data.logId || "")) fail("invalid-argument", "기록 정보가 올바르지 않습니다.");
  if (data.confirm !== true) fail("failed-precondition", "삭제를 확인해 주세요.");
  await base(uid).child("logs").child(data.logId).remove();
  return { ok: true, deleted: true };
}
async function reset(uid, data) {
  if (data.confirm !== "다이어리 비우기") fail("failed-precondition", "비우기를 확인해 주세요.");
  await base(uid).remove();
  return { ok: true, reset: true };
}
async function handle(request) {
  const uid = request && request.auth && request.auth.uid;
  if (!uid) fail("unauthenticated", "로그인하면 다이어리에 보관됩니다.");
  const data = (request && request.data) || {};
  switch (data.action) {
    case "open": return open(uid, data);
    case "start": return start(uid, data);
    case "savePage": return savePage(uid, data);
    case "addLog": return addLog(uid, data);
    case "keepLog": return keepLog(uid, data);
    case "deleteLog": return deleteLog(uid, data);
    case "reset": return reset(uid, data);
    default: fail("invalid-argument", "지원하지 않는 요청입니다.");
  }
}
// 회원 탈퇴(Auth 계정 삭제) 시 다이어리도 지운다. 계정 삭제가 실제로 끝난 뒤에만 실행되므로
// 탈퇴가 중간에 실패해도 기록이 먼저 사라지지 않는다. diary/{uid} 외에는 건드리지 않는다.
const functionsV1 = require("firebase-functions/v1");
async function purgeOnUserDelete(user) {
  const uid = user && user.uid;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { ok: false };
  await base(uid).remove();
  return { ok: true };
}
const diaryPurgeOnUserDelete = functionsV1.region("asia-northeast3").auth.user().onDelete(purgeOnUserDelete);
const diary = onCall({ region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 }, handle);
module.exports = { diary, diaryPurgeOnUserDelete, purgeOnUserDelete, handle, seedFrom, MAX_LOGS };
