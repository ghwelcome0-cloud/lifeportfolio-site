/**
 * 서비스 통계 · 방문 통계 동의 (2026-10-15 대표 승인, 최종 기획안 v3 10장)
 * ---------------------------------------------------------------------
 *   recordConsentChoice (공개)   : 동의·거부 버튼을 누를 때만 호출. consent_stats/{YYYY-MM-DD} 의 개수만 +1.
 *                                  로그인 회원이면 consent_choices/{uid} 에 본인 선택을 저장(다른 기기에서 다시 묻지 않기 위함).
 *                                  누가 무엇을 골랐는지는 운영 화면에 보이지 않는다(개수만).
 *   getMyConsent (회원 본인)     : 본인 선택 불러오기 (1년 지난 선택은 돌려주지 않음 → 다시 물음)
 *   adminServiceStats (운영자)   : A. 동의 현황(날짜별 개수) + B. 서비스 흐름(가입·결제·리포트·다이어리 숫자)
 *   B 는 우리 서버 기록을 숫자로만 센다. 개인을 알 수 있는 값은 돌려주지 않는다.
 */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { checkCallableRateLimit } = require("./_rate_limit");

const REGION = "asia-northeast3";
const YEAR_MS = 365 * 86400000;
const kstDay = (t) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);
const ms = (t) => (t && t.toMillis ? t.toMillis() : typeof t === "number" ? t : Date.parse(t) || null);

async function recordConsent(req, deps) {
  const d = req.data || {}; const choice = d.choice === "granted" ? "granted" : d.choice === "denied" ? "denied" : null;
  if (!choice) throw new HttpsError("invalid-argument", "choice");
  await deps.rateLimit(req, "recordConsentChoice", { perMinute: 6, perHour: 40 });
  const now = deps.now(); const db = admin.firestore(); const FV = admin.firestore.FieldValue;
  const changed = d.prev === "granted" || d.prev === "denied";
  const uid0 = req.auth && req.auth.uid;
  if (d.sync === true) { // 이미 고른 선택을 계정에 옮겨 적기만 함(개수는 세지 않음)
    if (!uid0) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const at = Math.min(Number(d.at) || now, now);
    await db.collection("consent_choices").doc(uid0).set({ choice, at: new Date(at) });
    return { ok: true, synced: true };
  }
  await db.collection("consent_stats").doc(kstDay(now)).set({ day: kstDay(now), [choice]: FV.increment(1), ...(changed ? { changed: FV.increment(1) } : {}), updatedAt: FV.serverTimestamp() }, { merge: true });
  const uid = req.auth && req.auth.uid;
  if (uid) await db.collection("consent_choices").doc(uid).set({ choice, at: new Date(now) });
  return { ok: true };
}
async function getMine(req, deps) {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const s = await admin.firestore().collection("consent_choices").doc(uid).get();
  if (!s.exists) return { ok: true, choice: null };
  const at = ms(s.get("at")); if (!at || deps.now() - at > YEAR_MS) return { ok: true, choice: null };
  return { ok: true, choice: s.get("choice"), at };
}

async function shallowCount(path) {
  // RTDB 큰 가지(reports·diary)는 전체를 내려받지 않고 키 개수만 센다(REST shallow).
  const cred = admin.app().options.credential || admin.credential.applicationDefault();
  const tok = (await cred.getAccessToken()).access_token;
  const base = admin.app().options.databaseURL || process.env.LP_RTDB_URL || "https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app";
  const r = await fetch(`${base}/${path}.json?shallow=true`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null; const j = await r.json(); return j ? Object.keys(j).length : 0;
}

async function adminStats(req, deps) {
  if (!(req.auth && req.auth.token && req.auth.token.admin === true)) throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  const days = Math.min(Math.max(parseInt((req.data || {}).days, 10) || 30, 7), 180);
  const now = deps.now(); const from = now - days * 86400000;
  const list = []; for (let t = from + 86400000; t <= now + 1; t += 86400000) list.push(kstDay(t));
  const row = () => ({ granted: 0, denied: 0, signups: 0, paidKrw: 0, paidUsd: 0, paidPartner: 0, paidRegular: 0 });
  const byDay = Object.fromEntries(list.map((k) => [k, row()]));
  // A. 동의 현황
  const cs = await admin.firestore().collection("consent_stats").where("day", ">=", list[0]).get();
  let totGranted = 0, totDenied = 0;
  cs.forEach((x) => { const v = x.data(); if (byDay[v.day]) { byDay[v.day].granted = v.granted || 0; byDay[v.day].denied = v.denied || 0; } totGranted += v.granted || 0; totDenied += v.denied || 0; });
  // B. 서비스 흐름
  const members = await deps.listUserTimes();
  members.forEach((t) => { const k = kstDay(t); if (byDay[k]) byDay[k].signups++; });
  const pay = (await admin.database().ref("payments").once("value")).val() || {};
  let paidTotal = 0, paidPartner = 0;
  Object.values(pay).forEach((p) => { if (!p || p.paid !== true) return; paidTotal++; const partner = /^partner-/.test(p.source || ""); if (partner) paidPartner++;
    const k = p.createdAt ? kstDay(ms(p.createdAt)) : null; if (k && byDay[k]) { byDay[k][partner ? "paidPartner" : "paidRegular"]++; if (p.currency === "USD") byDay[k].paidUsd++; else byDay[k].paidKrw++; } });
  const [reportsUsers, diaryUsers, responsesUsers] = await Promise.all([deps.shallowCount("reports"), deps.shallowCount("diary"), deps.shallowCount("responses")]);
  const totals = { members: members.length, paid: paidTotal, paidPartner, responsesUsers, reportsUsers, diaryUsers };
  const rate = (a, b) => (a != null && b ? Math.round((1000 * a) / b) / 10 : null);
  return {
    ok: true, days, rows: list.map((k) => Object.assign({ day: k }, byDay[k])),
    consent: { granted: totGranted, denied: totDenied, rate: rate(totGranted, totGranted + totDenied) },
    totals, funnel: [
      { step: "회원 가입", n: totals.members, rate: null },
      { step: "결제", n: totals.paid, rate: rate(totals.paid, totals.members) },
      { step: "검사 응답", n: responsesUsers, rate: rate(responsesUsers, totals.paid) },
      { step: "리포트", n: reportsUsers, rate: rate(reportsUsers, totals.paid) },
      { step: "다이어리 사용", n: diaryUsers, rate: rate(diaryUsers, reportsUsers) },
    ],
    note: "A·B는 우리 서버 기록의 숫자입니다. 방문·유입 경로(C)는 구글 애널리틱스 연결 후 추가됩니다.",
  };
}

const realDeps = () => ({
  now: () => Date.now(), rateLimit: checkCallableRateLimit, shallowCount,
  listUserTimes: async () => { const out = []; let t; do { const r = await admin.auth().listUsers(1000, t); r.users.forEach((u) => out.push(Date.parse(u.metadata.creationTime))); t = r.pageToken; } while (t); return out; },
});
const OPTS = { region: REGION, cors: true, memory: "256MiB", timeoutSeconds: 60 };
module.exports = {
  recordConsentChoice: onCall(OPTS, (r) => recordConsent(r, realDeps())),
  getMyConsent: onCall(OPTS, (r) => getMine(r, realDeps())),
  adminServiceStats: onCall(Object.assign({}, OPTS, { memory: "512MiB", timeoutSeconds: 120 }), (r) => adminStats(r, realDeps())),
  _internals: { recordConsent, getMine, adminStats, kstDay, YEAR_MS },
};
