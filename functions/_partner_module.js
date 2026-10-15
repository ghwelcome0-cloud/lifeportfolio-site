/**
 * 제휴 기업 전용 결제 (2026-10-15 대표 승인, docs/partner/00_제휴결제_최종기획안_v3.md)
 * =====================================================================
 * 화면: lifeportfolio.co.kr/partner?p=<기업주소>&k=<링크키>
 *
 * 저장 (Firestore, 모두 서버 전용. 클라이언트 규칙은 기본 거부)
 *   partners/{slug}                 제휴 설정 (이름·로고·제휴가·해외가·기간·최대 인원·확인 방식·링크키 지문·코드 지문 …)
 *   partners/{slug}/seats/{uid}     자리 (hold 30분 → used). 한 회원에 한 자리
 *   partner_codes/{sha256(slug|code)}  1인 1코드 (unused → held → used / void). 원문은 저장하지 않음
 *   partner_quotes/{quoteId}        30분 확인표 (uid·slug·금액·만료·상태)
 *   partner_payments/{uid}          제휴 결제 기록 (5년 보관 대상)
 *   partner_audit/{autoId}          운영 변경 기록
 *   partner_fails/{autoId}          국내 결제 실패 기록 (대시보드 「확인 필요」)
 *   partner_refunds/{autoId}        계좌 환불 대기 (송금 후 계좌 정보 삭제)
 *   payments/{uid}  (RTDB)          기존 잠금 해제 기록. 기존 허용 항목만 쓴다(paid, createdAt, source, provider, env, amount, currency …)
 *
 * 원칙
 *   - 금액은 서버만 정한다. 화면·주소 값은 믿지 않는다.
 *   - 등록되지 않은 주소, 링크키가 틀린 주소는 "찾을 수 없음"과 똑같이 응답한다(무엇이 틀렸는지 알려 주지 않음).
 *   - 자리 잡기·코드 잡기는 트랜잭션으로 한 번에. 동시에 눌러도 최대 인원을 넘지 않는다.
 *   - 결제 승인 전에 확인표를 다시 검사한다. 틀리면 승인 요청 자체를 하지 않아 돈이 빠지지 않는다.
 *   - 공통 코드는 시간당·하루 상한을 넘으면 스스로 "멈춤"이 된다(5.4장).
 */
"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("node:crypto");

const REGION = "asia-northeast3";
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // 헷갈리는 0·O·1·I·L·U 제외 (30종)
const CODE_LEN = 10;
const QUOTE_MS = 30 * 60 * 1000;
const MAX_SEATS = 100000;
const VERIFY = ["link", "common", "personal"];
const STATUS = ["draft", "active", "paused", "ended"];
const REGULAR_KRW = 19900;
const REGULAR_USD = "14.99";

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const fs = () => admin.firestore();
const FV = () => admin.firestore.FieldValue;
const ms = (t) => (t && t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : typeof t === "number" ? t : null);
const fail = (code, msg) => { throw new HttpsError(code, msg); };

function requireUid(req) { const u = req && req.auth && req.auth.uid; if (!u) fail("unauthenticated", "로그인이 필요합니다."); return u; }
function assertAdmin(req) { if (!(req && req.auth && req.auth.token && req.auth.token.admin === true)) fail("permission-denied", "관리자 권한이 필요합니다."); return (req.auth.token.email || req.auth.uid || "").toString(); }
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function randKey(bytes) { return crypto.randomBytes(bytes).toString("base64url"); }
function randCode() { let s = ""; const buf = crypto.randomBytes(CODE_LEN * 2); for (let i = 0; s.length < CODE_LEN; i++) { const v = buf[i % buf.length]; if (v < 240) s += CODE_ALPHABET[v % 30]; else if (i > CODE_LEN * 4) s += CODE_ALPHABET[crypto.randomInt(30)]; } return s; }
function normCode(s) { return String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 40); }
function fmtCode(c) { return c.slice(0, 5) + "-" + c.slice(5); }
const codeId = (slug, code) => sha(slug + "|" + normCode(code));
function cleanText(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function usdOk(s) { return /^\d{1,4}\.\d{2}$/.test(String(s)) && Number(s) >= 1; }

/** 공개 화면이 읽어도 되는 값만 */
function publicView(p, seatsLeft) {
  return {
    slug: p.slug, name: p.name, logoUrl: p.logoUrl || "", priceKrw: p.priceKrw, priceUsd: p.priceUsd,
    regularKrw: REGULAR_KRW, regularUsd: REGULAR_USD, startAt: ms(p.startAt), endAt: ms(p.endAt),
    seatsLeft, maxSeats: p.maxSeats, verify: p.verify, note: p.note || "", domesticPaused: p.domesticPaused === true,
  };
}

/** 링크키 검사 + 상태 확인. 실패 이유를 바깥에 알리지 않는다. */
async function loadPartner(slug, key) {
  if (!SLUG_RE.test(String(slug || "")) || !key || String(key).length > 80) return null;
  const snap = await fs().collection("partners").doc(slug).get();
  if (!snap.exists) return null;
  const p = snap.data();
  if (!p.linkKeyHash || !safeEq(p.linkKeyHash, sha(slug + "|" + key))) return null;
  return p;
}
function windowState(p, now) {
  if (p.status !== "active") return p.status === "paused" ? "paused" : p.status === "ended" ? "ended" : "notfound";
  if (now < ms(p.startAt)) return "notstarted";
  if (now > ms(p.endAt)) return "ended";
  return "open";
}
function seatsTaken(p, now) { return ((p.seatCount || {}).used || 0) + (p.holds || []).filter((h) => h.until > now).length; }

// ── 공개: 제휴 페이지 정보 ──────────────────────────────────────────
async function getPartnerPage(req, deps) {
  const d = req.data || {}; const now = deps.now();
  const p = await loadPartner(d.slug, d.k);
  if (!p) return { ok: true, state: "notfound" };
  const st = windowState(p, now);
  if (st === "notfound") return { ok: true, state: "notfound" };
  const used = seatsTaken(p, now);
  const left = Math.max(0, p.maxSeats - used);
  const view = publicView(p, left);
  let mine = null;
  const uid = req.auth && req.auth.uid;
  if (uid) {
    const [paid, seat] = await Promise.all([admin.database().ref(`payments/${uid}/paid`).once("value"), fs().collection("partners").doc(p.slug).collection("seats").doc(uid).get()]);
    mine = { paid: paid.val() === true, seat: seat.exists ? seat.get("status") : null };
  }
  return { ok: true, state: st === "open" && left <= 0 ? "soldout" : st, partner: view, mine };
}

// ── 회원: 확인 → 확인표(30분) + 자리·코드 잡기 ──────────────────────
async function startPartnerCheckout(req, deps) {
  const uid = requireUid(req); const d = req.data || {}; const now = deps.now();
  await deps.rateLimit(req, "startPartnerCheckout", { perMinute: 6, perHour: 30 });
  const p = await loadPartner(d.slug, d.k);
  if (!p) fail("not-found", "찾을 수 없는 페이지입니다.");
  const st = windowState(p, now);
  if (st !== "open") fail("failed-precondition", st === "notstarted" ? "아직 혜택 기간이 아니에요." : st === "paused" ? "잠시 혜택 접수를 멈췄어요." : "혜택 기간이 끝났어요.");
  const method = d.method === "paypal" ? "paypal" : "payple";
  if (method === "payple" && p.domesticPaused === true) fail("failed-precondition", "지금은 국내 결제를 잠시 쉬고 있어요. PayPal로 이어서 결제해 주세요.");
  if ((await admin.database().ref(`payments/${uid}/paid`).once("value")).val() === true) fail("already-exists", "이미 결제한 계정이에요. 마이페이지에서 이어서 이용해 주세요.");

  // 공통 코드 / 1인 1코드 확인 (틀린 입력 횟수 제한: 계정당 1시간 5회)
  const code = normCode(d.code);
  if (p.verify === "common" || p.verify === "personal") {
    if (!code) fail("invalid-argument", "제휴 코드를 입력해 주세요.");
    const bad = fs().collection("partner_badcode").doc(sha(uid + "|" + Math.floor(now / 3600000)));
    const badN = ((await bad.get()).get("n")) || 0;
    if (badN >= 5) fail("resource-exhausted", "코드를 여러 번 틀렸어요. 1시간 뒤 다시 시도해 주세요.");
    let good = false;
    if (p.verify === "common") good = !!p.commonCodeHash && safeEq(p.commonCodeHash, sha(p.slug + "|" + code));
    else { const c = await fs().collection("partner_codes").doc(codeId(p.slug, code)).get(); good = c.exists && c.get("slug") === p.slug; }
    if (!good) { await bad.set({ n: FV().increment(1), expireAt: new Date(now + 2 * 3600000) }, { merge: true }); fail("permission-denied", "제휴 코드를 다시 확인해 주세요."); }
  }

  // 공통 코드 자동 멈춤 (시간당·하루 상한)
  if (p.verify === "common" && (p.velocityHour || p.velocityDay)) {
    const hourAgo = now - 3600000, dayAgo = now - 86400000;
    const q = await fs().collection("partners").doc(p.slug).collection("seats").where("heldAt", ">=", new Date(dayAgo)).get();
    let h = 0, dd = 0; q.forEach((x) => { const t = ms(x.get("heldAt")); if (t >= dayAgo) dd++; if (t >= hourAgo) h++; });
    if ((p.velocityHour && h >= p.velocityHour) || (p.velocityDay && dd >= p.velocityDay)) {
      await fs().collection("partners").doc(p.slug).update({ status: "paused", pausedReason: "auto-velocity", pausedAt: FV().serverTimestamp() });
      await fs().collection("partner_audit").add({ slug: p.slug, at: FV().serverTimestamp(), by: "system", action: "auto-pause", detail: { lastHour: h, lastDay: dd, limitHour: p.velocityHour, limitDay: p.velocityDay } });
      await deps.alert({ slug: p.slug, name: p.name, lastHour: h, lastDay: dd }).catch(() => {});
      fail("failed-precondition", "잠시 혜택 접수를 멈췄어요.");
    }
  }

  const quoteId = randKey(18);
  const pRef = fs().collection("partners").doc(p.slug);
  const seatRef = pRef.collection("seats").doc(uid);
  const codeRef = p.verify === "personal" ? fs().collection("partner_codes").doc(codeId(p.slug, code)) : null;
  const exp = now + QUOTE_MS;
  await fs().runTransaction(async (tx) => {
    const fresh = (await tx.get(pRef)).data();
    if (!fresh || fresh.status !== "active") fail("failed-precondition", "잠시 혜택 접수를 멈췄어요.");
    const seat = await tx.get(seatRef);
    const cdoc = codeRef ? await tx.get(codeRef) : null;
    if (seat.exists && seat.get("status") === "used") fail("already-exists", "이미 이 제휴 혜택으로 결제했어요.");
    if (cdoc) {
      const c = cdoc.data();
      if (c.status === "void") fail("permission-denied", "사용할 수 없는 코드예요. 제휴사에 문의해 주세요.");
      if (c.status === "used") fail("permission-denied", "이미 사용된 코드예요. 제휴사에 문의해 주세요.");
      if (c.boundUid && c.boundUid !== uid) fail("permission-denied", "다른 계정에서 이미 쓰고 있는 코드예요.");
      if (c.status === "held" && c.heldUid !== uid && ms(c.heldUntil) > now) fail("permission-denied", "다른 계정에서 이미 쓰고 있는 코드예요.");
    }
    const already = seat.exists && seat.get("status") === "held" && ms(seat.get("expiresAt")) > now;
    if (!already) {
      // 자리 수는 트랜잭션 안의 카운터로 센다 (used + 유효한 held)
      const cnt = fresh.seatCount || { used: 0 };
      const liveHolds = (fresh.holds || []).filter((h) => h.until > now && h.uid !== uid);
      if ((cnt.used || 0) + liveHolds.length >= fresh.maxSeats) fail("resource-exhausted", "준비된 혜택이 모두 소진되었어요.");
      tx.update(pRef, { holds: liveHolds.concat([{ uid, until: exp }]).slice(-fresh.maxSeats) });
    } else {
      tx.update(pRef, { holds: (fresh.holds || []).filter((h) => h.until > now && h.uid !== uid).concat([{ uid, until: exp }]) });
    }
    tx.set(seatRef, { uid, status: "held", heldAt: new Date(now), expiresAt: new Date(exp), quoteId, method }, { merge: true });
    if (codeRef) tx.update(codeRef, { status: "held", heldUid: uid, heldUntil: new Date(exp), boundUid: uid });
    tx.set(fs().collection("partner_quotes").doc(quoteId), {
      uid, slug: p.slug, name: p.name, method, priceKrw: fresh.priceKrw, priceUsd: fresh.priceUsd, verify: fresh.verify,
      codeId: codeRef ? codeRef.id : null, commonCodeHash: fresh.verify === "common" ? sha(p.slug + "|" + code) : null,
      status: "open", createdAt: new Date(now), expiresAt: new Date(exp),
    });
  });
  return { ok: true, quoteId, expiresAt: exp, priceKrw: p.priceKrw, priceUsd: p.priceUsd, name: p.name };
}

/** 결제 승인 직전 확인표 재검사 */
async function checkQuote(uid, quoteId, method, now) {
  if (!quoteId || String(quoteId).length > 40) fail("invalid-argument", "확인표가 필요합니다.");
  const qs = await fs().collection("partner_quotes").doc(String(quoteId)).get();
  if (!qs.exists) fail("not-found", "확인표를 찾지 못했어요. 처음부터 다시 진행해 주세요.");
  const q = qs.data();
  if (q.uid !== uid) fail("permission-denied", "다른 계정의 확인표예요.");
  if (q.status !== "open") fail("failed-precondition", "이미 처리된 확인표예요.");
  if (ms(q.expiresAt) < now) fail("deadline-exceeded", "확인 시간(30분)이 지났어요. 다시 진행해 주세요.");
  if (q.method !== method) fail("failed-precondition", "결제 방법이 바뀌었어요. 다시 진행해 주세요.");
  const p = (await fs().collection("partners").doc(q.slug).get()).data();
  if (!p || windowState(p, now) !== "open") fail("failed-precondition", "잠시 혜택 접수를 멈췄어요. 결제는 되지 않았어요.");
  if (p.priceKrw !== q.priceKrw || p.priceUsd !== q.priceUsd) fail("failed-precondition", "혜택가가 바뀌었어요. 다시 진행해 주세요.");
  if (q.verify === "common" && (!p.commonCodeHash || !safeEq(p.commonCodeHash, q.commonCodeHash || ""))) fail("failed-precondition", "제휴 코드가 바뀌었어요. 새 코드로 다시 진행해 주세요.");
  if (q.codeId) { const c = (await fs().collection("partner_codes").doc(q.codeId).get()).data(); if (!c || c.status !== "held" || c.heldUid !== uid) fail("failed-precondition", "코드 확인이 풀렸어요. 다시 진행해 주세요."); }
  return { q, p };
}

/** 결제 확정 기록 (트랜잭션: 확인표 used, 자리 used, 코드 used, 카운터 +1) */
async function settle(uid, quoteId, rec, now) {
  const qRef = fs().collection("partner_quotes").doc(quoteId);
  await fs().runTransaction(async (tx) => {
    const q = (await tx.get(qRef)).data();
    const pRef = fs().collection("partners").doc(q.slug);
    const p = (await tx.get(pRef)).data();
    const cRef = q.codeId ? fs().collection("partner_codes").doc(q.codeId) : null;
    if (cRef) await tx.get(cRef);
    tx.update(qRef, { status: "used", usedAt: new Date(now), provider: rec.provider, ref: rec.ref });
    tx.set(pRef.collection("seats").doc(uid), { status: "used", usedAt: new Date(now) }, { merge: true });
    const cnt = p.seatCount || { used: 0, krw: 0, usd: 0, payple: 0, paypal: 0 };
    cnt.used = (cnt.used || 0) + 1; cnt[rec.provider] = (cnt[rec.provider] || 0) + 1;
    if (rec.currency === "KRW") cnt.krw = (cnt.krw || 0) + rec.amountNum; else cnt.usd = Math.round(((cnt.usd || 0) + rec.amountNum) * 100) / 100;
    tx.update(pRef, { seatCount: cnt, holds: (p.holds || []).filter((h) => h.uid !== uid && h.until > now) });
    if (cRef) tx.update(cRef, { status: "used", usedAt: new Date(now), usedUid: uid });
    tx.set(fs().collection("partner_payments").doc(uid), {
      uid, slug: q.slug, partnerName: q.name, quoteId, provider: rec.provider, env: rec.env, amount: rec.amount, currency: rec.currency,
      ref: rec.ref, captureID: rec.captureID || null, oid: rec.oid || null, codeId: q.codeId || null, createdAt: new Date(now), refund: null,
    });
  });
}

async function writePaid(uid, rec, nowIso) {
  await admin.database().ref(`payments/${uid}`).update({
    paid: true, createdAt: nowIso, source: rec.provider === "payple" ? "partner-payple" : "partner-paypal",
    provider: rec.provider, env: rec.env, amount: String(rec.amount), currency: rec.currency,
    ...(rec.provider === "paypal" ? { orderID: rec.ref, captureID: rec.captureID || "" } : {}), _pending: null,
  });
}

// ── 회원: 페이플 제휴 결제 승인 ─────────────────────────────────────
async function confirmPartnerPayple(req, deps) {
  const uid = requireUid(req); const d = req.data || {}; const now = deps.now();
  const auth = d.auth || {};
  const quoteId = String(d.quoteId || "");
  const rst = String(auth.PCD_PAY_RST || "").toLowerCase();
  if (rst && rst !== "success") { await logFail(uid, quoteId, "auth", auth.PCD_PAY_CODE, auth.PCD_PAY_MSG, "payple"); fail("failed-precondition", "국내 결제창이 연결되지 않았어요. 결제는 되지 않았어요."); }
  const payType = String(auth.PCD_PAY_TYPE || "");
  if (payType !== "card" && payType !== "transfer") fail("invalid-argument", "PCD_PAY_TYPE이 필요합니다.");
  if (!auth.PCD_AUTH_KEY) fail("invalid-argument", "PCD_AUTH_KEY가 필요합니다.");
  const injected = String(auth.PCD_USER_DEFINE1 || "");
  if (injected && injected !== uid) fail("permission-denied", "결제자와 로그인 회원이 일치하지 않습니다.");
  if (String(auth.PCD_USER_DEFINE2 || quoteId) !== quoteId) fail("permission-denied", "확인표가 일치하지 않습니다.");
  if ((await admin.database().ref(`payments/${uid}/paid`).once("value")).val() === true) fail("already-exists", "이미 결제가 완료된 계정입니다.");
  const { q } = await checkQuote(uid, quoteId, "payple", now); // ← 승인 전에 검사. 실패하면 승인 요청을 보내지 않는다.
  const claimed = parseInt(String(auth.PCD_PAY_TOTAL || "").replace(/[^0-9]/g, ""), 10);
  if (claimed && claimed !== q.priceKrw) fail("failed-precondition", "결제 금액이 일치하지 않습니다.");
  const r = await deps.paypleConfirm({ auth, payType, isTest: d.isTest === true });
  if (String(r.PCD_PAY_RST || "").toLowerCase() !== "success") { await logFail(uid, quoteId, "confirm", r.PCD_PAY_CODE, r.PCD_PAY_MSG, "payple"); fail("failed-precondition", "국내 결제 승인이 되지 않았어요. 결제는 되지 않았어요."); }
  const total = parseInt(String(r.PCD_PAY_TOTAL || auth.PCD_PAY_TOTAL || "").replace(/[^0-9]/g, ""), 10);
  if (total !== q.priceKrw) { logger.error("[partner] payple amount mismatch", { uid, total, expected: q.priceKrw }); fail("failed-precondition", "결제 금액이 일치하지 않습니다. 고객지원으로 알려 주세요."); }
  const respUid = String(r.PCD_USER_DEFINE1 || injected || "");
  if (respUid && respUid !== uid) fail("permission-denied", "결제자와 회원이 일치하지 않습니다.");
  const rec = { provider: "payple", env: d.isTest === true ? "test" : "live", amount: total, amountNum: total, currency: "KRW", ref: String(auth.PCD_PAY_OID || r.PCD_PAY_OID || ""), oid: String(auth.PCD_PAY_OID || r.PCD_PAY_OID || "") };
  await settle(uid, quoteId, rec, now);
  await writePaid(uid, rec, new Date(now).toISOString());
  return { ok: true, paid: true, amount: total, slug: q.slug };
}

// ── 회원: 페이팔 제휴 주문·캡처 ─────────────────────────────────────
async function createPartnerPaypalOrder(req, deps) {
  const uid = requireUid(req); const d = req.data || {}; const now = deps.now();
  if ((await admin.database().ref(`payments/${uid}/paid`).once("value")).val() === true) fail("already-exists", "Payment already completed for this account.");
  const { q } = await checkQuote(uid, String(d.quoteId || ""), "paypal", now);
  const orderID = await deps.paypalCreate({ uid, amount: q.priceUsd, description: "LifePortfolio - Partner (" + q.slug + ")", customId: uid, referenceId: "lpp_" + q.slug + "_" + String(d.quoteId).slice(0, 12) });
  await fs().collection("partner_quotes").doc(String(d.quoteId)).update({ orderID });
  return { orderID };
}
async function capturePartnerPaypalOrder(req, deps) {
  const uid = requireUid(req); const d = req.data || {}; const now = deps.now();
  const quoteId = String(d.quoteId || ""), orderID = String(d.orderID || "");
  if (!orderID || orderID.length > 80) fail("invalid-argument", "Valid orderID is required.");
  if ((await admin.database().ref(`payments/${uid}/paid`).once("value")).val() === true) fail("already-exists", "Payment already completed.");
  const { q } = await checkQuote(uid, quoteId, "paypal", now);
  const qd = (await fs().collection("partner_quotes").doc(quoteId).get()).data();
  if (qd.orderID !== orderID) fail("permission-denied", "Order does not match this quote.");
  const cap = await deps.paypalCapture({ orderID });
  if (cap.status !== "COMPLETED") fail("failed-precondition", "Payment not completed.");
  if (cap.customId && cap.customId !== uid) fail("permission-denied", "Order owner mismatch.");
  if (cap.currency !== "USD" || cap.amount !== q.priceUsd) { logger.error("[partner] paypal amount mismatch", { uid, cap, expected: q.priceUsd }); fail("failed-precondition", "Payment amount mismatch."); }
  const rec = { provider: "paypal", env: cap.env, amount: cap.amount, amountNum: Number(cap.amount), currency: "USD", ref: orderID, captureID: cap.captureID };
  await settle(uid, quoteId, rec, now);
  await writePaid(uid, rec, new Date(now).toISOString());
  return { ok: true, paid: true, slug: q.slug };
}

async function logFail(uid, quoteId, stage, code, msg, provider) {
  try { await fs().collection("partner_fails").add({ uid, quoteId: quoteId || null, stage, provider, code: cleanText(code, 40), msg: cleanText(msg, 200), at: FV().serverTimestamp(), resolved: false }); } catch (_) {}
}
// 회원·일반 결제 화면 모두에서 "실패했고 돈이 빠지지 않음"을 기록 (대시보드 「국내 결제 실패」)
async function reportDomesticFail(req) {
  const uid = requireUid(req); const d = req.data || {};
  await logFail(uid, String(d.quoteId || "").slice(0, 40), cleanText(d.stage, 20) || "client", d.code, d.msg, d.where === "regular" ? "payple-regular" : "payple");
  return { ok: true };
}

// ── 운영자 ─────────────────────────────────────────────────────────
function readPartnerInput(d, isNew) {
  const out = {};
  if (isNew) { const slug = String(d.slug || "").toLowerCase(); if (!SLUG_RE.test(slug)) fail("invalid-argument", "기업 주소는 영문 소문자·숫자·하이픈 2~40자입니다."); out.slug = slug; }
  if (d.name != null) { out.name = cleanText(d.name, 60); if (!out.name) fail("invalid-argument", "제휴사 이름을 적어 주세요."); }
  if (d.logoUrl != null) { const u = String(d.logoUrl).trim(); if (u && !/^https:\/\/[^\s"'<>]{4,400}$/.test(u)) fail("invalid-argument", "로고 주소는 https:// 로 시작해야 합니다."); out.logoUrl = u; }
  if (d.priceKrw != null) { const n = parseInt(d.priceKrw, 10); if (!(n >= 1000 && n <= REGULAR_KRW)) fail("invalid-argument", "제휴가는 1,000원 ~ 19,900원(부가세 포함)입니다."); out.priceKrw = n; }
  if (d.priceUsd != null) { if (!usdOk(d.priceUsd) || Number(d.priceUsd) > Number(REGULAR_USD)) fail("invalid-argument", "해외가는 1.00 ~ 14.99 달러, 소수 둘째 자리까지입니다."); out.priceUsd = String(d.priceUsd); }
  if (d.fx != null) out.fx = { rate: Number(d.fx.rate) || null, date: cleanText(d.fx.date, 10), source: cleanText(d.fx.source, 40) };
  if (d.startAt != null) out.startAt = new Date(Number(d.startAt));
  if (d.endAt != null) out.endAt = new Date(Number(d.endAt));
  if (out.startAt && isNaN(out.startAt)) fail("invalid-argument", "시작일을 확인해 주세요.");
  if (out.endAt && isNaN(out.endAt)) fail("invalid-argument", "종료일을 확인해 주세요.");
  if (d.maxSeats != null) { const n = parseInt(d.maxSeats, 10); if (!(n >= 1 && n <= MAX_SEATS)) fail("invalid-argument", "최대 인원은 1 ~ 100,000명입니다."); out.maxSeats = n; }
  if (d.verify != null) { if (!VERIFY.includes(d.verify)) fail("invalid-argument", "확인 방식을 골라 주세요."); out.verify = d.verify; }
  if (d.note != null) out.note = cleanText(d.note, 200);
  if (d.velocityHour != null) out.velocityHour = Math.max(0, Math.min(10000, parseInt(d.velocityHour, 10) || 0));
  if (d.velocityDay != null) out.velocityDay = Math.max(0, Math.min(100000, parseInt(d.velocityDay, 10) || 0));
  if (d.domesticPaused != null) out.domesticPaused = d.domesticPaused === true;
  return out;
}
const linkFor = (slug, key) => `https://lifeportfolio.co.kr/partner?p=${slug}&k=${key}`;

async function adminPartnerSave(req) {
  const by = assertAdmin(req); const d = req.data || {};
  const isNew = d.create === true;
  const inp = readPartnerInput(d, isNew);
  const slug = isNew ? inp.slug : String(d.slug || "");
  if (!SLUG_RE.test(slug)) fail("invalid-argument", "기업 주소를 확인해 주세요.");
  const ref = fs().collection("partners").doc(slug);
  let link = null, commonCode = null;
  await fs().runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (isNew && cur.exists) fail("already-exists", "이미 있는 기업 주소입니다.");
    if (!isNew && !cur.exists) fail("not-found", "제휴를 찾지 못했습니다.");
    const base = isNew ? { slug, status: "draft", createdAt: FV().serverTimestamp(), createdBy: by, seatCount: { used: 0, krw: 0, usd: 0, payple: 0, paypal: 0 }, holds: [], velocityHour: 30, velocityDay: 60, domesticPaused: false, verify: "common", note: "" } : {};
    const next = Object.assign({}, isNew ? {} : cur.data(), base, inp);
    for (const k of ["name", "priceKrw", "priceUsd", "startAt", "endAt", "maxSeats", "verify"]) if (next[k] == null) fail("invalid-argument", "빠진 항목이 있습니다: " + k);
    if (ms(next.endAt) <= ms(next.startAt)) fail("invalid-argument", "종료일은 시작일보다 뒤여야 합니다.");
    if (!isNew && next.maxSeats < ((cur.data().seatCount || {}).used || 0)) fail("invalid-argument", "이미 결제한 인원보다 적게 줄일 수 없습니다.");
    if (isNew) { const key = randKey(16); inp.linkKeyHash = sha(slug + "|" + key); link = linkFor(slug, key); }
    if (next.verify === "common" && !next.commonCodeHash && !inp.commonCodeHash) { commonCode = randCode(); inp.commonCodeHash = sha(slug + "|" + commonCode); }
    tx.set(ref, Object.assign(base, inp, { updatedAt: FV().serverTimestamp(), updatedBy: by }), { merge: true });
    tx.set(fs().collection("partner_audit").doc(), { slug, at: FV().serverTimestamp(), by, action: isNew ? "create" : "update", detail: Object.keys(inp).filter((k) => !/Hash$/.test(k)) });
  });
  return { ok: true, slug, link, commonCode: commonCode ? fmtCode(commonCode) : null };
}

async function adminPartnerAction(req) {
  const by = assertAdmin(req); const d = req.data || {}; const slug = String(d.slug || "");
  const ref = fs().collection("partners").doc(slug);
  const snap = await ref.get(); if (!snap.exists) fail("not-found", "제휴를 찾지 못했습니다.");
  const p = snap.data(); const act = String(d.action || "");
  const audit = (detail) => fs().collection("partner_audit").add({ slug, at: FV().serverTimestamp(), by, action: act, detail: detail || null });
  if (act === "setStatus") {
    if (!STATUS.includes(d.status) || d.status === "draft") fail("invalid-argument", "상태를 확인해 주세요.");
    await ref.update({ status: d.status, pausedReason: d.status === "paused" ? "operator" : null }); await audit({ status: d.status }); return { ok: true };
  }
  if (act === "regenLink") { const key = randKey(16); await ref.update({ linkKeyHash: sha(slug + "|" + key) }); await audit(); return { ok: true, link: linkFor(slug, key) }; }
  if (act === "rotateCommon") {
    let code = normCode(d.code); if (code && code.length < 6) fail("invalid-argument", "코드는 6자 이상입니다."); if (!code) code = randCode();
    await ref.update({ commonCodeHash: sha(slug + "|" + code) }); await audit(); return { ok: true, commonCode: code.length === CODE_LEN ? fmtCode(code) : code };
  }
  if (act === "issueCodes") {
    // 1인 1코드: 요청한 수만큼 "정확히" 만든다. 겹치면 다시 뽑고, 최대 인원(미사용+사용)을 넘지 않는다.
    const want = parseInt(d.count, 10);
    const existing = await fs().collection("partner_codes").where("slug", "==", slug).get();
    let live = 0; existing.forEach((x) => { if (x.get("status") !== "void") live++; });
    const room = p.maxSeats - live;
    if (!(want >= 1)) fail("invalid-argument", "만들 개수를 적어 주세요.");
    if (want > room) fail("invalid-argument", "최대 인원(" + p.maxSeats + "명)을 넘습니다. 지금 더 만들 수 있는 수: " + room + "개");
    const batchId = randKey(6), codes = [], seen = new Set();
    while (codes.length < want) {
      const c = randCode(); if (seen.has(c)) continue;
      const id = codeId(slug, c);
      try { await fs().collection("partner_codes").doc(id).create({ slug, batchId, status: "unused", createdAt: FV().serverTimestamp(), createdBy: by, tail: c.slice(-3) }); seen.add(c); codes.push(fmtCode(c)); }
      catch (e) { if (!(e && (e.code === 6 || /already exists/i.test(e.message || "")))) throw e; } // 아주 드문 겹침 → 다시 뽑기
    }
    await audit({ count: codes.length, batchId });
    return { ok: true, batchId, codes, csv: "번호,제휴 코드\n" + codes.map((c, i) => (i + 1) + "," + c).join("\n") };
  }
  if (act === "voidCode") {
    const id = codeId(slug, d.code); const c = await fs().collection("partner_codes").doc(id).get();
    if (!c.exists || c.get("slug") !== slug) fail("not-found", "코드를 찾지 못했습니다.");
    if (c.get("status") === "used") fail("failed-precondition", "이미 결제에 쓰인 코드는 정지할 수 없습니다.");
    await c.ref.update({ status: "void", voidAt: FV().serverTimestamp() }); await audit({ tail: c.get("tail") }); return { ok: true };
  }
  if (act === "voidUnused") {
    const q = await fs().collection("partner_codes").where("slug", "==", slug).get();
    let n = 0; const w = fs().bulkWriter(); q.forEach((x) => { if (x.get("status") === "unused") { w.update(x.ref, { status: "void", voidAt: FV().serverTimestamp() }); n++; } }); await w.close();
    await audit({ count: n }); return { ok: true, count: n };
  }
  if (act === "recordRefund") {
    const uid = String(d.uid || ""); const pay = fs().collection("partner_payments").doc(uid); const ps = await pay.get();
    if (!ps.exists || ps.get("slug") !== slug) fail("not-found", "결제 기록을 찾지 못했습니다.");
    await pay.update({ refund: { at: FV().serverTimestamp(), by, how: cleanText(d.how, 20) || "provider", memo: cleanText(d.memo, 200) } });
    await audit({ uid: uid.slice(0, 6) + "…" }); return { ok: true };
  }
  if (act === "resolveFail") { await fs().collection("partner_fails").doc(String(d.id || "x")).update({ resolved: true, resolvedBy: by }); return { ok: true }; }
  fail("invalid-argument", "알 수 없는 작업입니다.");
}

async function adminPartnerList(req) {
  assertAdmin(req); const now = Date.now();
  const snap = await fs().collection("partners").get();
  const partners = []; snap.forEach((x) => { const p = x.data(); const holds = (p.holds || []).filter((h) => h.until > now).length; partners.push({
    slug: p.slug, name: p.name, logoUrl: p.logoUrl || "", status: p.status, pausedReason: p.pausedReason || null, verify: p.verify, priceKrw: p.priceKrw, priceUsd: p.priceUsd, fx: p.fx || null,
    startAt: ms(p.startAt), endAt: ms(p.endAt), maxSeats: p.maxSeats, used: (p.seatCount || {}).used || 0, holding: holds, sales: p.seatCount || {}, velocityHour: p.velocityHour || 0, velocityDay: p.velocityDay || 0,
    domesticPaused: p.domesticPaused === true, note: p.note || "", hasCommonCode: !!p.commonCodeHash }); });
  const codeStats = {};
  const cs = await fs().collection("partner_codes").get();
  cs.forEach((x) => { const s = x.get("slug"); const st = x.get("status"); codeStats[s] = codeStats[s] || { unused: 0, held: 0, used: 0, void: 0 }; codeStats[s][st] = (codeStats[s][st] || 0) + 1; });
  const fails = []; (await fs().collection("partner_fails").where("resolved", "==", false).get()).forEach((x) => { const f = x.data(); fails.push({ id: x.id, at: ms(f.at), provider: f.provider, stage: f.stage, code: f.code, msg: f.msg }); });
  fails.sort((a, b) => (b.at || 0) - (a.at || 0));
  const pays = []; (await fs().collection("partner_payments").orderBy("createdAt", "desc").limit(200).get()).forEach((x) => { const v = x.data(); pays.push({ uid: v.uid, slug: v.slug, provider: v.provider, amount: v.amount, currency: v.currency, ref: v.ref, captureID: v.captureID, at: ms(v.createdAt), refund: v.refund ? { at: ms(v.refund.at), how: v.refund.how } : null }); });
  const audit = []; (await fs().collection("partner_audit").orderBy("at", "desc").limit(40).get()).forEach((x) => { const a = x.data(); audit.push({ slug: a.slug, at: ms(a.at), by: a.by, action: a.action }); });
  return { ok: true, partners, codeStats, fails: fails.slice(0, 50), payments: pays, audit };
}

// ── 운영 dependencies (테스트에서 바꿔 끼움) ─────────────────────────
function makeExports(realDeps) {
  const OPTS = { region: REGION, cors: true, memory: "256MiB", timeoutSeconds: 60 };
  const withSecrets = (s) => Object.assign({}, OPTS, { secrets: s });
  return {
    getPartnerPage: onCall(OPTS, (r) => getPartnerPage(r, realDeps())),
    startPartnerCheckout: onCall(withSecrets(realDeps.alertSecrets || []), (r) => startPartnerCheckout(r, realDeps())),
    confirmPartnerPayple: onCall(withSecrets(realDeps.paypleSecrets), (r) => confirmPartnerPayple(r, realDeps())),
    createPartnerPaypalOrder: onCall(withSecrets(realDeps.paypalSecrets), (r) => createPartnerPaypalOrder(r, realDeps())),
    capturePartnerPaypalOrder: onCall(withSecrets(realDeps.paypalSecrets), (r) => capturePartnerPaypalOrder(r, realDeps())),
    reportDomesticFail: onCall(OPTS, (r) => reportDomesticFail(r)),
    adminPartnerList: onCall(OPTS, (r) => adminPartnerList(r)),
    adminPartnerSave: onCall(OPTS, (r) => adminPartnerSave(r)),
    adminPartnerAction: onCall(Object.assign({}, OPTS, { timeoutSeconds: 300 }), (r) => adminPartnerAction(r)),
  };
}

module.exports = {
  makeExports,
  _internals: { getPartnerPage, startPartnerCheckout, confirmPartnerPayple, createPartnerPaypalOrder, capturePartnerPaypalOrder, reportDomesticFail, adminPartnerSave, adminPartnerAction, adminPartnerList, randCode, normCode, codeId, sha, CODE_ALPHABET, CODE_LEN, QUOTE_MS },
};
