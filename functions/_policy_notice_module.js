"use strict";
// 약관·개인정보처리방침 개정 고지 — 운영 대시보드(admin.html) 전용 callable 3종.
//   getPolicyNoticeStatus  : 캠페인 목록 + 발송 현황(전체/성공/실패/미발송) + 메일 미리보기
//   sendPolicyNotice       : 미리보기(dryRun) / 실제 발송 / 실패분만 재발송 / 본인에게 시험 발송
//   (팝업 게시 기간은 캠페인 파일의 날짜가 정하며, 홈페이지 팝업 스크립트가 같은 날짜를 쓴다.)
//
// 원칙
//   - 운영자(custom claim admin === true)만 호출. 그 외 permission-denied.
//   - 멱등: Firestore policy_notice_log/{campaign}__{uid} 에 status=sent 가 있으면 다시 보내지 않는다.
//   - 한 번 호출에 최대 maxSend 명만 보낸다(기본 300). 9분 제한 안에서 끊고, 남은 인원은 다시 누르면 이어 보낸다.
//   - 실행 기록: policy_notice_runs/{autoId} 에 누가·언제·무엇을·몇 명 보냈는지 남긴다(법정 고지 이행 증빙).
//   - 이메일 본문은 캠페인 파일(functions/emails/policy-update-*.js)이 단일 출처.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const FROM = "Life Portfolio <faise@lifeportfolio.co.kr>";
const REPLY_TO = "faise@lifeportfolio.co.kr";

// 등록된 캠페인. 새 개정 때는 템플릿 파일을 만들고 여기에 한 줄 추가한다.
const CAMPAIGNS = {
  "policy-update-2026-10-17": () => require("./emails/policy-update-2026-10-17.js"),
};
const LATEST = "policy-update-2026-10-17";

function assertAdmin(request) {
  if (!(request.auth && request.auth.token && request.auth.token.admin === true)) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
}
function loadCampaign(id) {
  const key = id || LATEST;
  if (!Object.prototype.hasOwnProperty.call(CAMPAIGNS, key)) throw new HttpsError("invalid-argument", "알 수 없는 캠페인입니다.");
  const c = CAMPAIGNS[key]();
  if (c.CAMPAIGN !== key) throw new HttpsError("internal", "캠페인 정의가 일치하지 않습니다.");
  return c;
}
const isEmail = (s) => typeof s === "string" && /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s);
const maskEmail = (e) => { const [u, d] = String(e).split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d; };

function campaignMeta(c) {
  const { subject } = c.buildPolicyUpdateEmail();
  return {
    id: c.CAMPAIGN, subject,
    noticeStartKst: c.NOTICE_START_KST, effectiveKst: c.EFFECTIVE_KST, popupEndKst: c.POPUP_END_KST,
    effectiveKo: c.EFFECTIVE_KO, summary: c.SUMMARY_KO, changes: c.CHANGES,
  };
}

async function sendViaResend({ apiKey, to, subject, html, text, tag }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text, tags: [{ name: "campaign", value: tag }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Resend ${res.status}: ${body.slice(0, 300)}`); err.status = res.status; throw err;
  }
  return res.json().catch(() => ({}));
}

// 발송 대상: Firebase Auth 회원 중 이메일 보유 + 비활성(disabled) 아님.
async function listRecipients() {
  const out = []; let token;
  do {
    const r = await admin.auth().listUsers(1000, token);
    r.users.forEach((u) => { const e = (u.email || "").trim().toLowerCase(); if (e && !u.disabled && isEmail(e)) out.push({ uid: u.uid, email: e }); });
    token = r.pageToken;
  } while (token);
  return out;
}
async function logMap(campaign) {
  const snap = await admin.firestore().collection("policy_notice_log").where("campaign", "==", campaign).get();
  const m = new Map(); snap.forEach((d) => m.set(d.get("uid"), d.data())); return m;
}

async function status(request, deps) {
  assertAdmin(request);
  const c = loadCampaign(request.data && request.data.campaign);
  const [recipients, logs] = await Promise.all([deps.listRecipients(), deps.logMap(c.CAMPAIGN)]);
  let sent = 0, failed = 0; const failures = [];
  recipients.forEach((r) => { const l = logs.get(r.uid); if (l && l.status === "sent") sent++; else if (l && l.status === "failed") { failed++; if (failures.length < 30) failures.push({ email: maskEmail(r.email), error: String(l.error || "").slice(0, 160) }); } });
  const runsSnap = await admin.firestore().collection("policy_notice_runs").where("campaign", "==", c.CAMPAIGN).get();
  const runs = runsSnap.docs.map((d) => { const x = d.data(); return { at: x.at && x.at.toMillis ? x.at.toMillis() : null, by: x.by || "", mode: x.mode, attempted: x.attempted || 0, sent: x.sent || 0, failed: x.failed || 0, remaining: x.remaining || 0 }; })
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 20);
  const mail = c.buildPolicyUpdateEmail();
  return {
    ok: true, campaigns: Object.keys(CAMPAIGNS), campaign: campaignMeta(c),
    counts: { recipients: recipients.length, sent, failed, pending: recipients.length - sent - failed },
    failures, runs, preview: { from: FROM, replyTo: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text },
  };
}

async function send(request, deps) {
  assertAdmin(request);
  const d = request.data || {};
  const c = loadCampaign(d.campaign);
  const mode = ["dryRun", "send", "retryFailed", "test"].includes(d.mode) ? d.mode : "dryRun";
  const maxSend = Math.min(Math.max(parseInt(d.maxSend, 10) || 300, 1), 500);
  const interval = Math.min(Math.max(parseInt(d.intervalMs, 10) || 650, 300), 3000);
  const mail = c.buildPolicyUpdateEmail();
  const by = (request.auth.token.email || request.auth.uid || "").toString();
  const apiKey = deps.apiKey();
  if (mode !== "dryRun" && !apiKey) throw new HttpsError("failed-precondition", "RESEND_API_KEY가 설정되지 않았습니다.");

  if (mode === "test") {
    const to = (request.auth.token.email || "").toLowerCase();
    if (!isEmail(to)) throw new HttpsError("failed-precondition", "운영자 계정에 이메일이 없습니다.");
    await deps.sendMail({ apiKey, to, subject: "[시험 발송] " + mail.subject, html: mail.html, text: mail.text, tag: c.CAMPAIGN + "-test" });
    await admin.firestore().collection("policy_notice_runs").add({ campaign: c.CAMPAIGN, mode, by, at: admin.firestore.FieldValue.serverTimestamp(), attempted: 1, sent: 1, failed: 0, remaining: null });
    return { ok: true, mode, to: maskEmail(to) };
  }

  const [recipients, logs] = await Promise.all([deps.listRecipients(), deps.logMap(c.CAMPAIGN)]);
  // send: 한 번도 시도하지 않은 회원만 / retryFailed: 실패한 회원만 (같은 잘못된 주소를 매번 다시 두드리지 않는다)
  const todo = recipients.filter((r) => { const l = logs.get(r.uid); if (l && l.status === "sent") return false; const f = !!(l && l.status === "failed"); return mode === "retryFailed" ? f : !f; });
  if (mode === "dryRun") {
    return { ok: true, mode, counts: { recipients: recipients.length, alreadySent: recipients.filter((r) => { const l = logs.get(r.uid); return !!(l && l.status === "sent"); }).length, willSend: todo.length }, samples: todo.slice(0, 20).map((r) => maskEmail(r.email)) };
  }
  const started = Date.now(), budgetMs = 480000; // 9분 제한 전에 끊는다
  let sent = 0, failed = 0, attempted = 0;
  for (const r of todo.slice(0, maxSend)) {
    if (Date.now() - started > budgetMs) break;
    attempted++;
    const ref = admin.firestore().collection("policy_notice_log").doc(`${c.CAMPAIGN}__${r.uid}`);
    try {
      let tries = 0;
      for (;;) {
        try { await deps.sendMail({ apiKey, to: r.email, subject: mail.subject, html: mail.html, text: mail.text, tag: c.CAMPAIGN }); break; }
        catch (e) { if (e && e.status === 429 && ++tries < 3) { await deps.sleep(interval * (tries + 1)); continue; } throw e; }
      }
      sent++;
      await ref.set({ campaign: c.CAMPAIGN, uid: r.uid, email: r.email, status: "sent", sent_at: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      failed++;
      await ref.set({ campaign: c.CAMPAIGN, uid: r.uid, email: r.email, status: "failed", error: String((e && e.message) || e).slice(0, 400), failed_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    await deps.sleep(interval);
  }
  const remaining = todo.length - attempted; // 이번 호출에서 손대지 못한 인원(시간·한도로 끊긴 경우)
  await admin.firestore().collection("policy_notice_runs").add({ campaign: c.CAMPAIGN, mode, by, at: admin.firestore.FieldValue.serverTimestamp(), attempted, sent, failed, remaining });
  logger.info("[policy-notice]", { campaign: c.CAMPAIGN, mode, attempted, sent, failed, remaining });
  return { ok: true, mode, attempted, sent, failed, remaining };
}

const realDeps = {
  listRecipients, logMap,
  sendMail: sendViaResend,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  apiKey: () => process.env.RESEND_API_KEY || RESEND_API_KEY.value(),
};
const OPTS = { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 540, secrets: [RESEND_API_KEY] };
const getPolicyNoticeStatus = onCall(OPTS, (req) => status(req, realDeps));
const sendPolicyNotice = onCall(OPTS, (req) => send(req, realDeps));

module.exports = { getPolicyNoticeStatus, sendPolicyNotice, status, send, CAMPAIGNS, LATEST, maskEmail };
