/**
 * B2B 그룹 계약 모듈 (2026-05-28 신규)
 * =====================================
 *
 * 흐름:
 *   submitB2BQuote   → b2b_orders create (status='quote_requested')
 *   reportB2BPayment → b2b_orders update (status='payment_reported')
 *   approveB2BOrder  → b2b_orders update (status='active') + b2b_codes create N개
 *   verifyB2BCode    → b2b_codes update (used) + b2b_user_links create
 *   getB2BAdminData  → 운영자(admin claim) 전용 종합 조회
 *
 * 가격표 (부가세 별도):
 *   10명+   ₩9,000 / 30명+   ₩8,000 / 50명+   ₩7,000
 *   100명+  ₩6,000 / 200명+  ₩5,500 / 500명+  ₩5,000
 *   다이어리 옵션: ₩45,000 / 인
 *
 * 결제 수단: 카카오뱅크 무통장 입금 (3333-31-6566369, 예금주: 파이스)
 * 입금자명: 주문번호 (LP-YYYYMM-XXXX)
 *
 * 이 파일은 functions/index.js 끝에서 require + 마운트됨.
 */

"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { checkCallableRateLimit } = require("./_rate_limit");

// ─────────────────────────────────────────────────────────────────────────────
// 이메일 발송 (Resend) — 기존 functions/index.js의 sendViaResend 패턴과 동일
// RESEND_API_KEY는 functions/index.js에서 이미 정의됐지만,
// 모듈 분리 빌드를 위해 여기서도 동일한 Secret을 참조한다.
// (Firebase는 동일 이름의 defineSecret을 여러 곳에서 호출해도 안전)
// ─────────────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const FROM_EMAIL = "Life Portfolio <faise@lifeportfolio.co.kr>";
const ADMIN_EMAIL = "faise@lifeportfolio.co.kr";
const REPLY_TO = "faise@lifeportfolio.co.kr";

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sendResendEmail({ apiKey, to, replyTo, subject, html, text, tag }) {
  if (!apiKey) {
    logger.warn("[b2b-group] RESEND_API_KEY 미설정 — 메일 발송 스킵", { subject });
    return { ok: false, reason: "missing_resend_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: replyTo || REPLY_TO,
        subject, html, text,
        tags: tag ? [{ name: "campaign", value: tag }] : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("[b2b-group] Resend API 실패", { status: res.status, body: body.slice(0, 300), subject, to });
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (e) {
    logger.error("[b2b-group] sendResendEmail 예외", { err: String(e), subject, to });
    return { ok: false, err: String(e) };
  }
}

function getResendApiKey() {
  try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
}

function formatWon(n) {
  if (typeof n !== "number") return String(n);
  return "₩" + n.toLocaleString("ko-KR");
}

// ─────────────────────────────────────────────────────────────────────────────
// 가격 계산 (서버 사이드 — 클라이언트가 가격 조작 불가)
// ─────────────────────────────────────────────────────────────────────────────
function calcUnitPrice(seats) {
  if (seats >= 500) return 5000;
  if (seats >= 200) return 5500;
  if (seats >= 100) return 6000;
  if (seats >= 50)  return 7000;
  if (seats >= 30)  return 8000;
  if (seats >= 10)  return 9000;
  return 0; // 10명 미만 거부
}
const DIARY_UNIT_PRICE = 45000;

function calcOrderAmount(seats, diaryCount) {
  const unit = calcUnitPrice(seats);
  if (unit === 0) return null;
  const dCount = Math.max(0, Math.min(seats, parseInt(diaryCount || 0, 10) || 0));
  const supply = (seats * unit) + (dCount * DIARY_UNIT_PRICE);
  const vat = Math.round(supply * 0.1);
  return {
    unitPrice: unit,
    diaryUnitPrice: DIARY_UNIT_PRICE,
    diaryCount: dCount,
    supplyAmount: supply,
    vatAmount: vat,
    totalAmount: supply + vat,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 권장 금액 계산 (약관 제9조 기준, VAT 포함)
// ─────────────────────────────────────────────────────────────────────────────
//   · 코드 발급 후 미사용(0%): 결제 금액 × 90% (운영 수수료 10% 공제)
//   · 일부 사용: 미사용 코드수 × 인당 단가 × 1.1(VAT) × 80%
//     (다이어리는 인쇄 착수 후 환불 불가 — 기본 권장에서 제외, 운영자 재량 가산)
// 반환값은 모두 VAT 포함 금액(원)이며, 운영자가 prompt에서 조정 가능.
// ─────────────────────────────────────────────────────────────────────────────
function calcRefundSuggestion(order) {
  const totalAmount = parseInt(order && order.totalAmount, 10) || 0;
  const seats = parseInt(order && order.seats, 10) || 0;
  const unitPrice = parseInt(order && order.unitPrice, 10) || 0;
  const codesUsed = parseInt(order && order.codesUsed, 10) || 0;
  const codesIssued = parseInt(order && order.codesIssued, 10) || seats;

  // 코드 미발급(입금신고만): 100% 환불 권장 (서비스 미제공)
  if (order && order.status === "payment_reported") {
    return {
      suggested: totalAmount,
      rate: 1.0,
      basis: "코드 미발급 상태 — 전액 환불",
      unusedCodes: 0,
    };
  }

  // active 상태: 사용 여부에 따라 분기
  const unusedCodes = Math.max(0, codesIssued - codesUsed);

  if (codesUsed === 0) {
    // 발급 후 0% 사용: 결제 금액 × 90%
    return {
      suggested: Math.round(totalAmount * 0.9),
      rate: 0.9,
      basis: `코드 발급 후 미사용 — 결제 금액 × 90% (운영 수수료 10% 공제)`,
      unusedCodes,
    };
  }

  // 일부 사용: 미사용 코드수 × 인당 단가 × 1.1 × 80%
  const unusedSupply = unusedCodes * unitPrice;
  const unusedWithVat = Math.round(unusedSupply * 1.1);
  const suggested = Math.round(unusedWithVat * 0.8);
  return {
    suggested,
    rate: 0.8,
    basis: `미사용 ${unusedCodes}/${codesIssued}코드 × ₩${unitPrice.toLocaleString("ko-KR")} × 1.1(VAT) × 80%`,
    unusedCodes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 주문번호 / 조직 ID / Access Code 생성
// ─────────────────────────────────────────────────────────────────────────────
function generateOrderNumber() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7).replace("-", ""); // 202605
  const rand = Math.floor(1000 + Math.random() * 9000); // 4자리
  return `LP-${ym}-${rand}`;
}

function generateOrgCode(orgName) {
  // 영문/숫자만 추출 + 대문자, 그 뒤에 연도 4자리 + 3자리 난수
  const cleaned = String(orgName || "ORG")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "ORG";
  const year = new Date().getFullYear();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${cleaned}-${year}-${rand}`;
}

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/1/I/O 제외
function generateAccessCode() {
  // XXXX-XXXX (8자리)
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)];
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 입력 검증 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeStr(v, maxLen) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.slice(0, maxLen);
}

function isAdmin(request) {
  return !!(request.auth && request.auth.token && request.auth.token.admin === true);
}

// ─────────────────────────────────────────────────────────────────────────────
// [1] submitB2BQuote — 견적 요청 폼 제출
// ─────────────────────────────────────────────────────────────────────────────
const submitB2BQuote = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30, secrets: [RESEND_API_KEY] },
  async (request) => {
    // 0) Rate limit — 봇/스팸 방어 (B2B 견적 요청은 분당 1회 미만이 정상)
    await checkCallableRateLimit(request, "submitB2BQuote", {
      perMinute: 2,
      perHour: 8,
    });

    const data = request.data || {};

    // 1) 입력 검증
    const orgType = sanitizeStr(data.orgType, 20); // "company" | "group"
    const orgName = sanitizeStr(data.orgName, 80);
    const bizNumber = sanitizeStr(data.bizNumber, 20); // 사업자번호 (단체는 빈 값 허용)
    const contactName = sanitizeStr(data.contactName, 40);
    const contactRole = sanitizeStr(data.contactRole, 60);
    const contactEmail = sanitizeStr(data.contactEmail, 254).toLowerCase();
    const contactPhone = sanitizeStr(data.contactPhone, 40);
    const seats = parseInt(data.seats, 10) || 0;
    const diaryCount = parseInt(data.diaryCount, 10) || 0;
    const agreedContract = data.agreedContract === true;
    const agreedPrivacy = data.agreedPrivacy === true;
    const agreedMarketing = data.agreedMarketing === true;
    const memo = sanitizeStr(data.memo, 1000);

    if (!["company", "group"].includes(orgType)) {
      throw new HttpsError("invalid-argument", "조직 유형(기업/단체)을 선택해주세요.");
    }
    if (!orgName) {
      throw new HttpsError("invalid-argument", "회사명 또는 단체명을 입력해주세요.");
    }
    if (orgType === "company" && bizNumber && !/^\d{3}-?\d{2}-?\d{5}$/.test(bizNumber)) {
      throw new HttpsError("invalid-argument", "사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)");
    }
    if (!contactName) {
      throw new HttpsError("invalid-argument", "담당자명을 입력해주세요.");
    }
    if (!contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
      throw new HttpsError("invalid-argument", "올바른 이메일 형식이 아닙니다.");
    }
    if (seats < 10 || seats > 10000) {
      throw new HttpsError("invalid-argument", "인원은 10명 이상 10,000명 이하로 입력해주세요.");
    }
    if (diaryCount < 0 || diaryCount > seats) {
      throw new HttpsError("invalid-argument", "다이어리 수량은 0~인원수 사이여야 합니다.");
    }
    if (!agreedContract || !agreedPrivacy) {
      throw new HttpsError("invalid-argument", "필수 동의 항목에 모두 동의해주세요.");
    }

    // 2) 가격 계산 (서버 사이드)
    const price = calcOrderAmount(seats, diaryCount);
    if (!price) {
      throw new HttpsError("invalid-argument", "가격 계산에 실패했습니다.");
    }

    // 3) 주문번호 발번
    const orderNumber = generateOrderNumber();
    const db = admin.firestore();

    // 4) 중복 검증: 24시간 내 동일 이메일 견적 1회 제한
    try {
      const since = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const dupSnap = await db.collection("b2b_orders")
        .where("contactEmail", "==", contactEmail)
        .where("createdAt", ">=", since)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        throw new HttpsError(
          "already-exists",
          "최근 24시간 내 동일한 이메일로 견적 요청이 접수되었습니다. faise@lifeportfolio.co.kr 로 직접 문의해주세요."
        );
      }
    } catch (e) {
      if (e && e.code === "already-exists") throw e;
      logger.warn("[b2b-group] 중복 검사 실패 (무시하고 진행)", { contactEmail, err: e && e.message });
    }

    // 5) Firestore write
    const docRef = db.collection("b2b_orders").doc();
    await docRef.set({
      orderNumber,
      orgType,
      orgName,
      bizNumber,
      contactName,
      contactRole,
      contactEmail,
      contactPhone,
      contactUid: request.auth ? request.auth.uid : null,
      seats,
      diaryCount: price.diaryCount,
      unitPrice: price.unitPrice,
      diaryUnitPrice: DIARY_UNIT_PRICE,
      supplyAmount: price.supplyAmount,
      vatAmount: price.vatAmount,
      totalAmount: price.totalAmount,
      agreedContract,
      agreedPrivacy,
      agreedMarketing,
      memo,
      status: "quote_requested", // quote_requested → payment_reported → active | cancelled
      orgCode: null,             // approve 시 발번
      codesIssued: 0,
      codesUsed: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentReportedAt: null,
      approvedAt: null,
    });

    logger.info("[b2b-group] 견적 요청 접수", {
      orderId: docRef.id, orderNumber, orgName, seats, totalAmount: price.totalAmount,
    });

    // 6) 이메일 발송 (운영자 + 고객사 담당자) — 실패해도 주문은 정상 처리
    const apiKey = getResendApiKey();
    const orgTypeLabel = orgType === "company" ? "기업(사업자)" : "단체";
    const diaryLine = price.diaryCount > 0
      ? `<tr><td style="padding:4px 0;color:#64748B">다이어리</td><td style="padding:4px 0;text-align:right">${price.diaryCount}권 × ${formatWon(DIARY_UNIT_PRICE)}</td></tr>`
      : "";

    // 6-1) 운영자 알림 메일
    const adminSubject = `[B2B 견적] ${orgName} · ${orderNumber} · ${seats}명 · ${formatWon(price.totalAmount)}`;
    const adminHtml = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.65">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#1a2b4a;padding:20px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:1px;margin-bottom:4px">B2B GROUP QUOTE · NEW</div>
        <h2 style="margin:0;font-size:18px;font-weight:800">${escHtml(orgName)} · ${escHtml(contactName)}님</h2>
        <div style="margin-top:6px;font-size:12px;opacity:.85">주문번호: <strong style="color:#fde68a">${escHtml(orderNumber)}</strong></div>
      </td></tr>
      <tr><td style="padding:22px 28px">
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px">
          <tr><td style="padding:5px 0;color:#64748B;width:110px">조직 유형</td><td style="padding:5px 0;font-weight:600">${escHtml(orgTypeLabel)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">${orgType === "company" ? "회사명" : "단체명"}</td><td style="padding:5px 0;font-weight:600">${escHtml(orgName)}</td></tr>
          ${bizNumber ? `<tr><td style="padding:5px 0;color:#64748B">사업자번호</td><td style="padding:5px 0">${escHtml(bizNumber)}</td></tr>` : ""}
          <tr><td style="padding:5px 0;color:#64748B">담당자</td><td style="padding:5px 0;font-weight:600">${escHtml(contactName)}${contactRole ? ` (${escHtml(contactRole)})` : ""}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">이메일</td><td style="padding:5px 0"><a href="mailto:${escHtml(contactEmail)}" style="color:#2563EB;text-decoration:none;font-weight:600">${escHtml(contactEmail)}</a></td></tr>
          ${contactPhone ? `<tr><td style="padding:5px 0;color:#64748B">연락처</td><td style="padding:5px 0">${escHtml(contactPhone)}</td></tr>` : ""}
        </table>

        <div style="margin-top:18px;padding:16px 18px;background:#1a2b4a;border-radius:8px;color:#fff">
          <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:.5px;margin-bottom:10px">견적 내역</div>
          <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:13.5px;color:#e2e8f0">
            <tr><td style="padding:4px 0;color:#94a3b8">진단</td><td style="padding:4px 0;text-align:right">${seats}명 × ${formatWon(price.unitPrice)}</td></tr>
            ${diaryLine}
            <tr><td style="padding:8px 0 4px;color:#94a3b8;border-top:1px solid rgba(255,255,255,.15)">공급가액</td><td style="padding:8px 0 4px;text-align:right;border-top:1px solid rgba(255,255,255,.15)">${formatWon(price.supplyAmount)}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8">VAT (10%)</td><td style="padding:4px 0;text-align:right">${formatWon(price.vatAmount)}</td></tr>
            <tr><td style="padding:8px 0 0;color:#fde68a;font-weight:700;border-top:2px solid #c9a961">합계</td><td style="padding:8px 0 0;text-align:right;color:#fde68a;font-weight:800;font-size:16px;border-top:2px solid #c9a961">${formatWon(price.totalAmount)}</td></tr>
          </table>
        </div>

        ${memo ? `<div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #c9a961;border-radius:0 6px 6px 0">
          <div style="font-size:11px;color:#64748B;font-weight:700;margin-bottom:5px">추가 요청 사항</div>
          <div style="font-size:13.5px;color:#334155;white-space:pre-wrap;line-height:1.7">${escHtml(memo)}</div>
        </div>` : ""}

        <div style="margin-top:16px;font-size:12px;color:#64748B">
          동의: 계약조건 ${agreedContract ? "✓" : "✗"} · 개인정보 ${agreedPrivacy ? "✓" : "✗"} · 마케팅 ${agreedMarketing ? "✓" : "✗"}<br>
          Firestore Doc ID: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px">${escHtml(docRef.id)}</code>
        </div>

        <p style="margin:18px 0 0;padding:12px 14px;background:#fef9c3;border-radius:8px;font-size:13px;color:#713f12;line-height:1.65">
          <strong style="color:#92400e">[다음 단계]</strong> 입금 확인 후 <a href="https://lifeporfolio.web.app/b2b-admin" style="color:#1a2b4a;font-weight:700">/b2b-admin</a> 에서 승인 + 코드 발급을 진행하세요.<br>
          이 메일에 답장하면 <strong>${escHtml(contactEmail)}</strong> 로 직접 회신됩니다.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    const adminText = [
      `신규 B2B 그룹 견적이 접수되었습니다.`,
      ``,
      `주문번호: ${orderNumber}`,
      `조직: ${orgName} (${orgTypeLabel})`,
      bizNumber ? `사업자번호: ${bizNumber}` : null,
      `담당자: ${contactName}${contactRole ? ` (${contactRole})` : ""}`,
      `이메일: ${contactEmail}`,
      contactPhone ? `연락처: ${contactPhone}` : null,
      ``,
      `진단: ${seats}명 × ${formatWon(price.unitPrice)}`,
      price.diaryCount > 0 ? `다이어리: ${price.diaryCount}권 × ${formatWon(DIARY_UNIT_PRICE)}` : null,
      `공급가액: ${formatWon(price.supplyAmount)}`,
      `VAT(10%): ${formatWon(price.vatAmount)}`,
      `합계: ${formatWon(price.totalAmount)}`,
      ``,
      memo ? `추가 요청:\n${memo}\n` : null,
      `Doc ID: ${docRef.id}`,
      `대시보드: https://lifeporfolio.web.app/b2b-admin`,
    ].filter(Boolean).join("\n");

    const adminResult = await sendResendEmail({
      apiKey,
      to: ADMIN_EMAIL,
      replyTo: contactEmail, // 답장 시 담당자에게 바로 회신
      subject: adminSubject,
      html: adminHtml,
      text: adminText,
      tag: "b2b-group-quote-admin",
    });

    // 6-2) 고객사 담당자 접수 확인 메일
    const userSubject = `[인생포트폴리오] 견적 요청 접수 안내 · ${orderNumber}`;
    const userHtml = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#1a2b4a;padding:24px 28px;color:#fff;text-align:center">
        <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:1.5px;margin-bottom:6px">QUOTE RECEIVED</div>
        <h2 style="margin:0;font-size:20px;font-weight:800">견적 요청이 접수되었습니다</h2>
        <div style="margin-top:8px;font-size:13px;opacity:.85">주문번호 <strong style="color:#fde68a;font-size:14px">${escHtml(orderNumber)}</strong></div>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">안녕하세요, <strong>${escHtml(contactName)}</strong>님.<br>
        ${escHtml(orgName)}의 그룹 진단 견적 요청을 정상 접수했습니다.</p>

        <div style="margin:18px 0;padding:18px 20px;background:#1a2b4a;border-radius:10px;color:#fff">
          <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:.5px;margin-bottom:10px">견적 내역</div>
          <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;color:#e2e8f0">
            <tr><td style="padding:5px 0;color:#94a3b8">진단</td><td style="padding:5px 0;text-align:right">${seats}명 × ${formatWon(price.unitPrice)}</td></tr>
            ${diaryLine}
            <tr><td style="padding:8px 0 4px;color:#94a3b8;border-top:1px solid rgba(255,255,255,.15)">공급가액</td><td style="padding:8px 0 4px;text-align:right;border-top:1px solid rgba(255,255,255,.15)">${formatWon(price.supplyAmount)}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8">VAT (10%)</td><td style="padding:4px 0;text-align:right">${formatWon(price.vatAmount)}</td></tr>
            <tr><td style="padding:10px 0 0;color:#fde68a;font-weight:700;border-top:2px solid #c9a961">합계 (부가세 포함)</td><td style="padding:10px 0 0;text-align:right;color:#fde68a;font-weight:800;font-size:18px;border-top:2px solid #c9a961">${formatWon(price.totalAmount)}</td></tr>
          </table>
        </div>

        <div style="margin:18px 0;padding:16px 18px;background:#fef9c3;border-left:4px solid #c9a961;border-radius:0 8px 8px 0">
          <div style="font-size:13px;font-weight:700;color:#713f12;margin-bottom:8px">📌 입금 안내</div>
          <table cellspacing="0" cellpadding="0" border="0" style="font-size:13.5px;color:#78350f">
            <tr><td style="padding:3px 0;width:80px">은행</td><td style="padding:3px 0;font-weight:600">카카오뱅크</td></tr>
            <tr><td style="padding:3px 0">계좌번호</td><td style="padding:3px 0;font-weight:700;font-family:ui-monospace,Menlo,monospace">3333-31-6566369</td></tr>
            <tr><td style="padding:3px 0">예금주</td><td style="padding:3px 0;font-weight:600">파이스</td></tr>
            <tr><td style="padding:3px 0">입금자명</td><td style="padding:3px 0;font-weight:700;color:#dc2626">${escHtml(orderNumber)} 포함 필수</td></tr>
            <tr><td style="padding:3px 0">금액</td><td style="padding:3px 0;font-weight:700">${formatWon(price.totalAmount)}</td></tr>
          </table>
        </div>

        <ol style="margin:18px 0;padding-left:22px;font-size:13.5px;color:#404040;line-height:1.85">
          <li>입금 시 입금자명에 주문번호 <strong style="color:#1a2b4a">${escHtml(orderNumber)}</strong> 를 꼭 포함해 주세요. (예: "삼성전자 ${escHtml(orderNumber)}")</li>
          <li>입금 완료 후 결제 페이지에서 <strong>[입금 완료 신고]</strong> 버튼을 눌러주시면 처리가 빨라집니다.</li>
          <li>입금 확인은 영업일 기준 1일 이내 처리됩니다.</li>
          <li>승인 완료 시 본 이메일로 <strong>조직 ID + Access Code</strong> 가 발송됩니다.</li>
          <li>전자세금계산서가 필요하시면 회신으로 사업자등록증 사본을 보내주세요.</li>
        </ol>

        <div style="text-align:center;margin:24px 0 8px">
          <a href="https://lifeporfolio.web.app/b2b-checkout?order=${escHtml(docRef.id)}&no=${escHtml(orderNumber)}" style="display:inline-block;padding:14px 28px;background:#1a2b4a;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14.5px">결제 안내 페이지 열기 →</a>
        </div>

        <p style="margin:20px 0 0;font-size:12.5px;color:#737373;line-height:1.65;text-align:center;border-top:1px solid #e5e5e5;padding-top:16px">
          문의: <a href="mailto:faise@lifeportfolio.co.kr" style="color:#737373">faise@lifeportfolio.co.kr</a><br>
          파이스 · 인생포트폴리오
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    const userText = [
      `안녕하세요, ${contactName}님.`,
      `${orgName}의 그룹 진단 견적 요청을 정상 접수했습니다.`,
      ``,
      `■ 주문번호: ${orderNumber}`,
      `■ 진단: ${seats}명 × ${formatWon(price.unitPrice)}`,
      price.diaryCount > 0 ? `■ 다이어리: ${price.diaryCount}권 × ${formatWon(DIARY_UNIT_PRICE)}` : null,
      `■ 공급가액: ${formatWon(price.supplyAmount)}`,
      `■ VAT(10%): ${formatWon(price.vatAmount)}`,
      `■ 합계: ${formatWon(price.totalAmount)} (부가세 포함)`,
      ``,
      `[입금 안내]`,
      `· 은행: 카카오뱅크`,
      `· 계좌: 3333-31-6566369`,
      `· 예금주: 파이스`,
      `· 입금자명: ${orderNumber} 를 꼭 포함해주세요 (예: "삼성전자 ${orderNumber}")`,
      ``,
      `결제 안내: https://lifeporfolio.web.app/b2b-checkout?order=${docRef.id}&no=${orderNumber}`,
      ``,
      `문의: faise@lifeportfolio.co.kr`,
    ].filter(Boolean).join("\n");

    const userResult = await sendResendEmail({
      apiKey,
      to: contactEmail,
      replyTo: REPLY_TO,
      subject: userSubject,
      html: userHtml,
      text: userText,
      tag: "b2b-group-quote-customer",
    });

    // 6-3) 메일 발송 결과를 Firestore에 기록 (감사 추적)
    try {
      await docRef.update({
        adminEmailSent: !!adminResult.ok,
        userEmailSent: !!userResult.ok,
        emailedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      logger.warn("[b2b-group] 메일 발송 결과 기록 실패 (무시)", { err: String(e) });
    }

    return {
      ok: true,
      orderId: docRef.id,
      orderNumber,
      price,
      bankInfo: {
        bank: "카카오뱅크",
        accountNumber: "3333-31-6566369",
        accountHolder: "파이스",
        memo: orderNumber, // 입금자명
      },
      emailSent: {
        admin: !!adminResult.ok,
        customer: !!userResult.ok,
      },
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [2] reportB2BPayment — 고객사가 "입금 완료 신고" 클릭
// ─────────────────────────────────────────────────────────────────────────────
const reportB2BPayment = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30, secrets: [RESEND_API_KEY] },
  async (request) => {
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const depositorName = sanitizeStr(request.data && request.data.depositorName, 40);
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");

    const db = admin.firestore();
    const docRef = db.collection("b2b_orders").doc(orderId);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");

    const order = snap.data();
    if (order.status !== "quote_requested") {
      throw new HttpsError("failed-precondition", `이미 처리된 주문입니다. (현재 상태: ${order.status})`);
    }

    await docRef.update({
      status: "payment_reported",
      depositorName,
      paymentReportedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[b2b-group] 입금 신고 접수", { orderId, orderNumber: order.orderNumber, depositorName });

    // 운영자 알림 메일 발송 (실패해도 신고는 정상 처리)
    const apiKey = getResendApiKey();
    const subject = `[B2B 입금 신고] ${order.orgName} · ${order.orderNumber} · ${formatWon(order.totalAmount)}`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#dc2626;padding:20px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;color:#fef3c7;letter-spacing:1.5px;margin-bottom:4px">⚠ PAYMENT REPORTED · ACTION REQUIRED</div>
        <h2 style="margin:0;font-size:18px;font-weight:800">${escHtml(order.orgName)} · ${escHtml(order.orderNumber)}</h2>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">고객사가 <strong>입금 완료</strong>를 신고했습니다. 카카오뱅크 입출금 내역을 확인 후 승인해주세요.</p>
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;margin-top:14px">
          <tr><td style="padding:5px 0;color:#64748B;width:110px">주문번호</td><td style="padding:5px 0;font-weight:700;font-family:ui-monospace,Menlo,monospace">${escHtml(order.orderNumber)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">조직</td><td style="padding:5px 0;font-weight:600">${escHtml(order.orgName)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">담당자</td><td style="padding:5px 0">${escHtml(order.contactName)} · <a href="mailto:${escHtml(order.contactEmail)}" style="color:#2563EB;text-decoration:none">${escHtml(order.contactEmail)}</a></td></tr>
          <tr><td style="padding:5px 0;color:#64748B">인원</td><td style="padding:5px 0;font-weight:600">${order.seats}명 ${order.diaryCount > 0 ? ` + 다이어리 ${order.diaryCount}권` : ""}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">결제 금액</td><td style="padding:5px 0;font-weight:700;color:#dc2626;font-size:16px">${formatWon(order.totalAmount)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">입금자명</td><td style="padding:5px 0;font-weight:700;background:#fef9c3;padding:6px 10px;border-radius:4px">${escHtml(depositorName || "(미입력)")}</td></tr>
        </table>

        <div style="text-align:center;margin:24px 0 8px">
          <a href="https://lifeporfolio.web.app/b2b-admin" style="display:inline-block;padding:14px 28px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14.5px">✓ 운영자 대시보드에서 처리하기 →</a>
        </div>

        <p style="margin:18px 0 0;font-size:12.5px;color:#737373;line-height:1.65">
          1) 카카오뱅크 입금내역에서 "<strong>${escHtml(depositorName || "")}</strong>" 또는 "<strong>${escHtml(order.orderNumber)}</strong>" 검색<br>
          2) 금액 ${formatWon(order.totalAmount)} 확인<br>
          3) 일치 시 대시보드에서 <strong style="color:#16a34a">[입금 확인 + 코드 발급]</strong> 클릭
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const text = [
      `고객사가 입금 완료를 신고했습니다.`,
      ``,
      `주문번호: ${order.orderNumber}`,
      `조직: ${order.orgName}`,
      `담당자: ${order.contactName} (${order.contactEmail})`,
      `인원: ${order.seats}명${order.diaryCount > 0 ? ` + 다이어리 ${order.diaryCount}권` : ""}`,
      `결제 금액: ${formatWon(order.totalAmount)}`,
      `입금자명: ${depositorName || "(미입력)"}`,
      ``,
      `대시보드: https://lifeporfolio.web.app/b2b-admin`,
    ].join("\n");

    await sendResendEmail({
      apiKey,
      to: ADMIN_EMAIL,
      replyTo: order.contactEmail,
      subject,
      html,
      text,
      tag: "b2b-group-payment-reported",
    });

    return { ok: true, orderNumber: order.orderNumber };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [3] approveB2BOrder — 관리자(사용자님)가 입금 확인 후 코드 발급
// ─────────────────────────────────────────────────────────────────────────────
const approveB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!isAdmin(request)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");

    const db = admin.firestore();
    const orderRef = db.collection("b2b_orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
    const order = snap.data();
    if (order.status === "active") {
      throw new HttpsError("failed-precondition", "이미 승인된 주문입니다.");
    }
    if (order.status === "cancelled") {
      throw new HttpsError("failed-precondition", "취소된 주문입니다.");
    }

    // 1) 조직 코드 생성 (중복 검증)
    let orgCode = generateOrgCode(order.orgName);
    for (let i = 0; i < 5; i++) {
      const dup = await db.collection("b2b_orders").where("orgCode", "==", orgCode).limit(1).get();
      if (dup.empty) break;
      orgCode = generateOrgCode(order.orgName);
    }

    // 2) Access Code N개 생성 (중복 회피)
    const seats = order.seats || 0;
    const codes = [];
    const codeSet = new Set();
    while (codes.length < seats) {
      const c = generateAccessCode();
      if (codeSet.has(c)) continue;
      codeSet.add(c);
      codes.push(c);
    }

    // 3) Firestore batched write (500개 단위로 자르기)
    const batchSize = 400;
    let writtenCount = 0;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = db.batch();
      const slice = codes.slice(i, i + batchSize);
      for (const code of slice) {
        const codeRef = db.collection("b2b_codes").doc();
        batch.set(codeRef, {
          code,
          orgCode,
          orderId,
          orgName: order.orgName,
          status: "unused", // unused | used | revoked
          usedByUid: null,
          usedByEmail: null,
          usedAt: null,
          hasDiary: codes.indexOf(code) < (order.diaryCount || 0),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      writtenCount += slice.length;
    }

    // 4) 주문 상태 업데이트
    await orderRef.update({
      status: "active",
      orgCode,
      codesIssued: writtenCount,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedByUid: request.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[b2b-group] 주문 승인 + 코드 발급 완료", {
      orderId, orgCode, seats, codesIssued: writtenCount,
    });

    // 5) 고객사 담당자에게 조직 ID + Access Code 발송 메일
    const apiKey = getResendApiKey();
    const codesPreview = codes.slice(0, 5).map(c => `• ${c}`).join("<br>");
    const allCodesList = codes.map((c, i) => `${String(i+1).padStart(4, " ")}. ${c}${(order.diaryCount || 0) > i ? "  (+다이어리)" : ""}`).join("\n");

    const subject = `[인생포트폴리오] 조직 ID 및 Access Code 발급 안내 · ${escHtml(order.orderNumber)}`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#16a34a;padding:24px 28px;color:#fff;text-align:center">
        <div style="font-size:11px;font-weight:700;color:#dcfce7;letter-spacing:1.5px;margin-bottom:6px">✓ APPROVED · CODES ISSUED</div>
        <h2 style="margin:0;font-size:20px;font-weight:800">${escHtml(order.orgName)} 진단 시작 준비 완료</h2>
        <div style="margin-top:8px;font-size:13px;opacity:.95">주문번호 <strong>${escHtml(order.orderNumber)}</strong> · 총 <strong>${writtenCount}개</strong> 코드 발급</div>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">안녕하세요, <strong>${escHtml(order.contactName)}</strong>님.<br>
        입금 확인이 완료되어 조직 ID와 Access Code를 발급해드립니다.</p>

        <div style="margin:18px 0;padding:20px;background:#1a2b4a;border-radius:10px;color:#fff;text-align:center">
          <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:1.5px;margin-bottom:8px">조직 ID (모든 임직원 공통)</div>
          <div style="font-size:24px;font-weight:800;font-family:ui-monospace,Menlo,monospace;color:#fde68a;letter-spacing:2px;padding:10px 0">${escHtml(orgCode)}</div>
        </div>

        <div style="margin:18px 0;padding:16px 18px;background:#fef9c3;border-left:4px solid #c9a961;border-radius:0 8px 8px 0">
          <div style="font-size:13px;font-weight:700;color:#713f12;margin-bottom:8px">📌 임직원 안내 방법</div>
          <ol style="margin:0;padding-left:20px;font-size:13.5px;color:#78350f;line-height:1.8">
            <li>각 임직원에게 <strong>Access Code 1개씩</strong> 1:1로 배포해주세요 (CSV 첨부 또는 별도 메일).</li>
            <li>임직원은 <a href="https://lifeporfolio.web.app/b2b-join" style="color:#1a2b4a;font-weight:700">https://lifeporfolio.web.app/b2b-join</a> 에서 조직 ID + 본인 Access Code를 입력합니다.</li>
            <li>가입 후 76문항 진단을 진행하면 개인별 리포트가 즉시 생성됩니다.</li>
            <li>각 코드는 <strong>1인 1회</strong>만 사용 가능합니다.</li>
          </ol>
        </div>

        <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
          <div style="font-size:11px;color:#64748B;font-weight:700;letter-spacing:.5px;margin-bottom:10px">ACCESS CODE 미리보기 (전체 ${writtenCount}개 중 5개)</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:13.5px;color:#1a2b4a;line-height:1.8">${codesPreview}</div>
          <p style="margin:10px 0 0;font-size:12px;color:#64748B">전체 코드 목록은 본 메일의 첨부(.txt)를 확인하거나, 운영자에게 별도 CSV 발송을 요청하실 수 있습니다.</p>
        </div>

        ${(order.diaryCount || 0) > 0 ? `<div style="margin:18px 0;padding:14px 16px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          📓 <strong>다이어리 옵션</strong>: 총 ${order.diaryCount}권이 포함됩니다. 배송지 정보는 별도 안내 메일로 회신드리겠습니다.
        </div>` : ""}

        <div style="margin:24px 0 8px;padding:14px 16px;background:#dbeafe;border-radius:8px;font-size:13px;color:#1e40af">
          💼 <strong>세금계산서</strong>가 필요하시면 본 메일에 답장으로 사업자등록증 사본을 첨부해주세요. 영업일 1~3일 내 홈택스로 발행해드립니다.
        </div>

        <p style="margin:24px 0 0;font-size:12.5px;color:#737373;line-height:1.65;text-align:center;border-top:1px solid #e5e5e5;padding-top:16px">
          문의: <a href="mailto:faise@lifeportfolio.co.kr" style="color:#737373">faise@lifeportfolio.co.kr</a><br>
          파이스 · 인생포트폴리오
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    const text = [
      `안녕하세요, ${order.contactName}님.`,
      `입금 확인이 완료되어 조직 ID와 Access Code를 발급해드립니다.`,
      ``,
      `■ 주문번호: ${order.orderNumber}`,
      `■ 조직 ID: ${orgCode}`,
      `■ 발급 코드 수: ${writtenCount}개`,
      ``,
      `[임직원 안내 방법]`,
      `1) 각 임직원에게 Access Code를 1:1로 배포`,
      `2) https://lifeporfolio.web.app/b2b-join 에서 조직 ID + Access Code 입력`,
      `3) 가입 후 76문항 진단 진행`,
      `4) 각 코드는 1인 1회만 사용 가능`,
      ``,
      `[Access Code 전체 목록]`,
      allCodesList,
      ``,
      `문의: faise@lifeportfolio.co.kr`,
    ].join("\n");

    // 사용자에게 전체 코드 첨부는 인라인 텍스트로 (Resend의 attachment 기능은 별도 작업 필요)
    const userResult = await sendResendEmail({
      apiKey,
      to: order.contactEmail,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
      tag: "b2b-group-codes-issued",
    });

    // 운영자에게도 발송 결과 알림 (간단)
    try {
      await sendResendEmail({
        apiKey,
        to: ADMIN_EMAIL,
        subject: `[B2B 처리 완료] ${order.orgName} · ${order.orderNumber} · 코드 ${writtenCount}개 발급`,
        text: `${order.orgName} (${order.contactEmail}) 의 ${order.orderNumber} 주문이 승인되었습니다.\n조직 ID: ${orgCode}\n발급 코드: ${writtenCount}개\n메일 발송: ${userResult.ok ? "성공" : "실패"}`,
        html: `<p>${escHtml(order.orgName)} (${escHtml(order.contactEmail)}) 의 <strong>${escHtml(order.orderNumber)}</strong> 주문이 승인되었습니다.</p><ul><li>조직 ID: <strong>${escHtml(orgCode)}</strong></li><li>발급 코드: ${writtenCount}개</li><li>고객사 메일 발송: <strong>${userResult.ok ? "✓ 성공" : "✗ 실패 (수동 발송 필요)"}</strong></li></ul>`,
        tag: "b2b-group-approval-admin-notify",
      });
    } catch (e) {
      logger.warn("[b2b-group] 운영자 승인 알림 메일 실패 (무시)", { err: String(e) });
    }

    return {
      ok: true,
      orgCode,
      codesIssued: writtenCount,
      codes, // 운영자 이메일/CSV 발송용으로 클라이언트에 반환
      orderNumber: order.orderNumber,
      contactEmail: order.contactEmail,
      emailSent: !!userResult.ok,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [4] verifyB2BCode — 임직원 가입 시 코드 검증 (가입 직후 호출)
// ─────────────────────────────────────────────────────────────────────────────
const verifyB2BCode = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    // Access Code brute-force 방어 — 분당 5회면 무차별 대입 사실상 불가
    await checkCallableRateLimit(request, "verifyB2BCode", {
      perMinute: 5,
      perHour: 20,
    });

    const orgCode = sanitizeStr(request.data && request.data.orgCode, 50).toUpperCase();
    const accessCode = sanitizeStr(request.data && request.data.accessCode, 20).toUpperCase();
    if (!orgCode || !accessCode) {
      throw new HttpsError("invalid-argument", "조직 ID와 Access Code를 모두 입력해주세요.");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;

    // 0) 이미 다른 조직에 연결된 사용자인지 확인
    const linkSnap = await db.collection("b2b_user_links").doc(uid).get();
    if (linkSnap.exists) {
      throw new HttpsError(
        "already-exists",
        "이 계정은 이미 다른 조직 코드를 사용했습니다. 한 계정에는 1개 조직만 연결 가능합니다."
      );
    }

    // 1) 코드 조회 (orgCode + accessCode 둘 다 일치 + unused)
    const codeSnap = await db.collection("b2b_codes")
      .where("orgCode", "==", orgCode)
      .where("code", "==", accessCode)
      .where("status", "==", "unused")
      .limit(1)
      .get();

    if (codeSnap.empty) {
      throw new HttpsError(
        "not-found",
        "유효하지 않은 코드입니다. 조직 ID와 Access Code를 다시 확인해주세요."
      );
    }

    const codeDoc = codeSnap.docs[0];
    const codeData = codeDoc.data();

    // 2) 코드 사용 처리 + 사용자 연결 (트랜잭션)
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(codeDoc.ref);
      if (!fresh.exists || fresh.data().status !== "unused") {
        throw new HttpsError("aborted", "코드가 방금 사용되었습니다. 다른 코드를 사용해주세요.");
      }
      tx.update(codeDoc.ref, {
        status: "used",
        usedByUid: uid,
        usedByEmail: request.auth.token.email || null,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("b2b_user_links").doc(uid), {
        orgCode,
        accessCode,
        codeId: codeDoc.id,
        orderId: codeData.orderId,
        orgName: codeData.orgName,
        hasDiary: !!codeData.hasDiary,
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // 주문 카운터 +1
      tx.update(db.collection("b2b_orders").doc(codeData.orderId), {
        codesUsed: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // 3) RTDB b2b_access/{uid} 노드 생성 (서버 권한으로 — 클라이언트 PERMISSION_DENIED 회피)
    //    suvey.html에서 ?b2b=1 진입 시 이 노드 존재 여부로 게이팅 가능.
    try {
      await admin.database().ref(`b2b_access/${uid}`).set({
        orgCode,
        orderId: codeData.orderId,
        orgName: codeData.orgName,
        hasDiary: !!codeData.hasDiary,
        linkedAt: admin.database.ServerValue.TIMESTAMP,
      });
    } catch (e) {
      // RTDB 실패는 치명적이지 않음 — Firestore b2b_user_links가 SoT
      logger.warn("[b2b-group] RTDB b2b_access write 실패(무시 가능)", { uid, err: String(e) });
    }

    logger.info("[b2b-group] Access Code 사용 완료", {
      uid, orgCode, codeId: codeDoc.id, orderId: codeData.orderId,
    });

    return {
      ok: true,
      orgName: codeData.orgName,
      hasDiary: !!codeData.hasDiary,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [5] getB2BAdminData — 운영자 대시보드 데이터 조회 (관리자 전용)
// ─────────────────────────────────────────────────────────────────────────────
const getB2BAdminData = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    if (!isAdmin(request)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    const db = admin.firestore();

    // 최근 50건 주문 (생성일 역순)
    const ordersSnap = await db.collection("b2b_orders")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const orders = ordersSnap.docs.map((d) => {
      const o = d.data();
      return {
        id: d.id,
        orderNumber: o.orderNumber,
        orgType: o.orgType,
        orgName: o.orgName,
        contactName: o.contactName,
        contactEmail: o.contactEmail,
        contactPhone: o.contactPhone,
        seats: o.seats,
        diaryCount: o.diaryCount,
        totalAmount: o.totalAmount,
        status: o.status,
        orgCode: o.orgCode || null,
        codesIssued: o.codesIssued || 0,
        codesUsed: o.codesUsed || 0,
        depositorName: o.depositorName || null,
        createdAt: o.createdAt ? o.createdAt.toMillis() : null,
        paymentReportedAt: o.paymentReportedAt ? o.paymentReportedAt.toMillis() : null,
        approvedAt: o.approvedAt ? o.approvedAt.toMillis() : null,
        memo: o.memo || "",
      };
    });

    // 요약 KPI
    const summary = {
      totalOrders: orders.length,
      pendingQuote: orders.filter((o) => o.status === "quote_requested").length,
      pendingPayment: orders.filter((o) => o.status === "payment_reported").length,
      activeOrgs: orders.filter((o) => o.status === "active").length,
      totalRevenueSupply: orders
        .filter((o) => o.status === "active")
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    };

    return { ok: true, summary, orders };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [6] getB2BOrderCodes — 관리자가 특정 주문의 코드 목록 조회 (재전송용)
// ─────────────────────────────────────────────────────────────────────────────
const getB2BOrderCodes = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 60 },
  async (request) => {
    if (!isAdmin(request)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");

    const db = admin.firestore();
    const codesSnap = await db.collection("b2b_codes")
      .where("orderId", "==", orderId)
      .get();

    const codes = codesSnap.docs.map((d) => {
      const c = d.data();
      return {
        code: c.code,
        status: c.status,
        usedByEmail: c.usedByEmail || null,
        hasDiary: !!c.hasDiary,
      };
    });

    const orderSnap = await db.collection("b2b_orders").doc(orderId).get();
    const order = orderSnap.exists ? orderSnap.data() : null;

    return {
      ok: true,
      orgCode: order ? order.orgCode : null,
      orgName: order ? order.orgName : null,
      orderNumber: order ? order.orderNumber : null,
      codes,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 가격표 조회 (클라이언트 미리보기용 — 인증 불필요)
// ─────────────────────────────────────────────────────────────────────────────
const getB2BPriceQuote = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 10 },
  async (request) => {
    // 가격 조회는 사용자가 슬라이더 조작하며 여러 번 호출 → 한도 여유 있게
    await checkCallableRateLimit(request, "getB2BPriceQuote", {
      perMinute: 30,
      perHour: 200,
    });

    const seats = parseInt(request.data && request.data.seats, 10) || 0;
    const diaryCount = parseInt(request.data && request.data.diaryCount, 10) || 0;
    if (seats < 10 || seats > 10000) {
      return { ok: false, error: "인원은 10명 이상 10,000명 이하로 입력해주세요." };
    }
    const price = calcOrderAmount(seats, diaryCount);
    return { ok: true, price };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [lookupB2BOrder] 고객사 담당자가 본인 주문 진행 현황 조회 (공개, 이메일+주문번호 매칭)
// ─────────────────────────────────────────────────────────────────────────────
const lookupB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 15 },
  async (request) => {
    // 주문번호+이메일 brute-force 방어 (공개 엔드포인트)
    await checkCallableRateLimit(request, "lookupB2BOrder", {
      perMinute: 5,
      perHour: 30,
    });

    const orderNumber = sanitizeStr(request.data && request.data.orderNumber, 32).toUpperCase();
    const contactEmail = sanitizeStr(request.data && request.data.contactEmail, 120).toLowerCase();

    if (!orderNumber || !/^LP-\d{6}-\d{4}$/.test(orderNumber)) {
      throw new HttpsError("invalid-argument", "주문번호 형식이 올바르지 않습니다.");
    }
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new HttpsError("invalid-argument", "올바른 이메일 주소를 입력해주세요.");
    }

    const db = admin.firestore();
    const snap = await db.collection("b2b_orders")
      .where("orderNumber", "==", orderNumber)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError("not-found", "해당 주문을 찾을 수 없습니다.");
    }

    const doc = snap.docs[0];
    const order = doc.data();

    // 이메일 일치 검증 (대소문자 무시)
    if (String(order.contactEmail || "").toLowerCase() !== contactEmail) {
      logger.warn("[b2b-group] 주문 조회 이메일 불일치", { orderNumber, attemptedEmail: contactEmail });
      throw new HttpsError("not-found", "주문번호와 이메일이 일치하지 않습니다.");
    }

    // 응답에 민감 데이터 제외 (Access Code 자체는 제외, 발급 여부만)
    return {
      orderNumber: order.orderNumber,
      orgName: order.orgName,
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      seats: order.seats,
      diaryCount: order.diaryCount || 0,
      totalAmount: order.totalAmount,
      supplyAmount: order.supplyAmount,
      vatAmount: order.vatAmount,
      status: order.status,
      codesIssued: order.codesIssued || 0,
      codesUsed: order.codesUsed || 0,
      depositorName: order.depositorName || null,
      createdAt: order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toISOString() : null,
      updatedAt: order.updatedAt && order.updatedAt.toDate ? order.updatedAt.toDate().toISOString() : null,
      cancelledAt: order.cancelledAt && order.cancelledAt.toDate ? order.cancelledAt.toDate().toISOString() : null,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [cancelB2BOrder] 운영자 — 주문 취소 (active 이전 단계만 가능)
// ─────────────────────────────────────────────────────────────────────────────
const cancelB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const reason = sanitizeStr(request.data && request.data.reason, 200) || "(사유 미기재)";
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");

    const db = admin.firestore();
    const docRef = db.collection("b2b_orders").doc(orderId);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");

    const order = snap.data();
    if (order.status === "active") {
      throw new HttpsError("failed-precondition", "이미 코드가 발급된 주문은 [환불 처리]를 사용하세요.");
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      throw new HttpsError("failed-precondition", `이미 ${order.status} 상태인 주문입니다.`);
    }

    await docRef.update({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: request.auth.token.email || request.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[b2b-group] 주문 취소", { orderId, orderNumber: order.orderNumber, reason });

    // 고객에게 취소 안내 메일
    const apiKey = getResendApiKey();
    const subject = `[인생포트폴리오] ${order.orderNumber} 주문이 취소되었습니다`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#737373;padding:20px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;color:#e5e5e5;letter-spacing:1.5px;margin-bottom:4px">ORDER CANCELLED</div>
        <h2 style="margin:0;font-size:18px;font-weight:800">${escHtml(order.orderNumber)} · 주문 취소 안내</h2>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">${escHtml(order.contactName)} 담당자님, 안녕하세요.</p>
        <p style="margin:0 0 14px;font-size:14.5px"><strong>${escHtml(order.orgName)}</strong>의 견적 주문(<strong>${escHtml(order.orderNumber)}</strong>)이 운영자에 의해 취소 처리되었습니다.</p>
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;margin-top:14px;background:#fafaf7;padding:14px;border-radius:8px">
          <tr><td style="padding:5px 0;color:#64748B;width:100px">취소 사유</td><td style="padding:5px 0">${escHtml(reason)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">결제 금액</td><td style="padding:5px 0;font-weight:700">${formatWon(order.totalAmount)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">입금 여부</td><td style="padding:5px 0">${order.status === "payment_reported" ? "<strong style='color:#dc2626'>입금 신고됨 — 환불 진행 예정</strong>" : "미입금"}</td></tr>
        </table>
        ${order.status === "payment_reported" ? `
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">입금이 확인된 경우 영업일 기준 3일 이내에 입금 계좌로 환불해 드립니다. 환불 계좌가 다를 경우 회신 부탁드립니다.</p>
        ` : ""}
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">재신청이 필요하시면 <a href="https://lifeporfolio.web.app/b2b-quote" style="color:#2563EB">새 견적 신청</a>을 부탁드립니다.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    try {
      await sendResendEmail({
        apiKey,
        to: order.contactEmail,
        replyTo: ADMIN_EMAIL,
        subject,
        html,
        text: `${order.orderNumber} 주문이 취소되었습니다.\n사유: ${reason}\n금액: ${formatWon(order.totalAmount)}\n\n재신청: https://lifeporfolio.web.app/b2b-quote`,
        tag: "b2b-group-cancelled",
      });
    } catch (e) {
      logger.warn("[b2b-group] 취소 메일 발송 실패", { err: String(e) });
    }

    return { ok: true, orderNumber: order.orderNumber, status: "cancelled" };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [refundB2BOrder] 운영자 — 환불 처리 (active 상태도 가능)
// ─────────────────────────────────────────────────────────────────────────────
const refundB2BOrder = onCall(
  // PR#138-fix: timeout 30→120s for large orders (e.g. 2,000 codes), memory 256→512 for batched writes
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const reason = sanitizeStr(request.data && request.data.reason, 200) || "(사유 미기재)";
    const refundAmount = parseInt(request.data && request.data.refundAmount, 10) || 0;
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");
    if (refundAmount < 0) throw new HttpsError("invalid-argument", "환불 금액은 0 이상이어야 합니다.");

    const db = admin.firestore();
    const docRef = db.collection("b2b_orders").doc(orderId);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");

    const order = snap.data();
    if (order.status === "refunded" || order.status === "cancelled") {
      throw new HttpsError("failed-precondition", `이미 ${order.status} 상태인 주문입니다.`);
    }

    // active 상태인 경우, 사용되지 않은 코드들을 무효화
    // PR#138-fix Bug #1: approveB2BOrder는 루트 컬렉션 "b2b_codes"에 발급하므로 동일 컬렉션 사용 (서브컬렉션 access_codes가 아님)
    // PR#138-fix Bug #2: Firestore batch 한도(500) 초과 방지 — 400개 단위로 청킹
    let revokedCount = 0;
    if (order.status === "active") {
      const codesSnap = await db.collection("b2b_codes")
        .where("orderId", "==", orderId)
        .where("status", "==", "unused")
        .get();
      const docs = codesSnap.docs;
      const batchSize = 400;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const slice = docs.slice(i, i + batchSize);
        for (const d of slice) {
          batch.update(d.ref, {
            status: "revoked",
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            revokedReason: "refund",
          });
        }
        await batch.commit();
        revokedCount += slice.length;
      }
    }

    // 환불 금액 산정 (서버 권위): 운영자 입력이 있으면 그대로, 없으면 약관 제9조 기준 권장값
    const suggestion = calcRefundSuggestion(order);
    const finalRefund = refundAmount > 0 ? refundAmount : suggestion.suggested;
    const refundBasis = refundAmount > 0
      ? `운영자 직접 입력 (₩${finalRefund.toLocaleString("ko-KR")})`
      : suggestion.basis;

    await docRef.update({
      status: "refunded",
      refundReason: reason,
      refundAmount: finalRefund,
      refundBasis,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      refundedBy: request.auth.token.email || request.auth.uid,
      codesRevoked: revokedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[b2b-group] 주문 환불", { orderId, orderNumber: order.orderNumber, refundAmount: finalRefund, refundBasis, revokedCount });

    // 고객에게 환불 안내 메일
    const apiKey = getResendApiKey();
    const subject = `[인생포트폴리오] ${order.orderNumber} 환불 처리 완료`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#1a2b4a;padding:20px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:1.5px;margin-bottom:4px">REFUND PROCESSED</div>
        <h2 style="margin:0;font-size:18px;font-weight:800">${escHtml(order.orderNumber)} · 환불 처리 완료</h2>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">${escHtml(order.contactName)} 담당자님, 안녕하세요.</p>
        <p style="margin:0 0 14px;font-size:14.5px"><strong>${escHtml(order.orgName)}</strong>의 주문(<strong>${escHtml(order.orderNumber)}</strong>) 환불 처리가 완료되었습니다.</p>
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;margin-top:14px;background:#fafaf7;padding:14px;border-radius:8px">
          <tr><td style="padding:5px 0;color:#64748B;width:120px">원 결제 금액</td><td style="padding:5px 0">${formatWon(order.totalAmount)} <span style="color:#94a3b8;font-size:12px">(부가세 포함)</span></td></tr>
          <tr><td style="padding:5px 0;color:#64748B">환불 금액</td><td style="padding:5px 0;font-weight:700;color:#16a34a;font-size:16px">${formatWon(finalRefund)} <span style="color:#94a3b8;font-size:12px;font-weight:400">(부가세 포함)</span></td></tr>
          <tr><td style="padding:5px 0;color:#64748B;vertical-align:top">산정 기준</td><td style="padding:5px 0;color:#525252;font-size:13px;line-height:1.6">${escHtml(refundBasis)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">환불 사유</td><td style="padding:5px 0">${escHtml(reason)}</td></tr>
          ${revokedCount > 0 ? `<tr><td style="padding:5px 0;color:#64748B">무효화된 코드</td><td style="padding:5px 0;color:#dc2626">${revokedCount}개 (이미 사용된 코드는 유지됨)</td></tr>` : ""}
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">환불 금액은 입금하신 계좌로 영업일 기준 3일 이내에 송금됩니다. 환불 계좌가 다를 경우 본 메일에 회신 부탁드립니다.</p>
        <p style="margin:14px 0 0;font-size:12.5px;color:#a3a3a3;line-height:1.7">B2B 그룹 계약 표준 조건 제9조(환불 및 계약 해지)에 따른 처리입니다.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    try {
      await sendResendEmail({
        apiKey,
        to: order.contactEmail,
        replyTo: ADMIN_EMAIL,
        subject,
        html,
        text: `${order.orderNumber} 환불 처리 완료\n환불 금액: ${formatWon(finalRefund)} (부가세 포함)\n산정 기준: ${refundBasis}\n사유: ${reason}\n\n환불 금액은 입금 계좌로 영업일 기준 3일 이내 송금됩니다.\nB2B 그룹 계약 표준 조건 제9조에 따른 처리입니다.`,
        tag: "b2b-group-refunded",
      });
    } catch (e) {
      logger.warn("[b2b-group] 환불 메일 발송 실패", { err: String(e) });
    }

    return { ok: true, orderNumber: order.orderNumber, status: "refunded", refundAmount: finalRefund, codesRevoked: revokedCount };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [regenerateB2BAccessCode] 운영자 — 사용되지 않은 특정 Access Code 1개 재발급
// ─────────────────────────────────────────────────────────────────────────────
const regenerateB2BAccessCode = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const oldCode = sanitizeStr(request.data && request.data.oldCode, 20).toUpperCase();
    if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");
    if (!oldCode) throw new HttpsError("invalid-argument", "재발급할 기존 코드가 필요합니다.");

    const db = admin.firestore();
    const orderRef = db.collection("b2b_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
    const order = orderSnap.data();
    if (order.status !== "active") {
      throw new HttpsError("failed-precondition", "코드가 발급된(active) 주문에서만 재발급 가능합니다.");
    }

    // PR#138-fix Bug #3: approveB2BOrder는 루트 컬렉션 "b2b_codes"에 auto-ID 문서로 발급하므로,
    // 서브컬렉션 access_codes/doc(code)가 아니라 b2b_codes를 (orderId, code)로 쿼리해야 함
    const codesSnap = await db.collection("b2b_codes")
      .where("orderId", "==", orderId)
      .where("code", "==", oldCode)
      .limit(1)
      .get();
    if (codesSnap.empty) {
      throw new HttpsError("not-found", `Access Code ${oldCode}을(를) 찾을 수 없습니다.`);
    }
    const codeDoc = codesSnap.docs[0];
    const codeRef = codeDoc.ref;
    const codeData = codeDoc.data();
    if (codeData.status === "used") {
      throw new HttpsError("failed-precondition", "이미 사용된 코드는 재발급할 수 없습니다. 사용된 사람이 따로 가입했습니다.");
    }
    if (codeData.status === "revoked") {
      throw new HttpsError("failed-precondition", "이미 무효화된 코드입니다.");
    }

    // 새 코드 생성 (중복 회피) — orderId 범위 내 b2b_codes에서 code 충돌 검사
    let newCode;
    for (let i = 0; i < 5; i++) {
      const candidate = generateAccessCode();
      const dupSnap = await db.collection("b2b_codes")
        .where("orderId", "==", orderId)
        .where("code", "==", candidate)
        .limit(1)
        .get();
      if (dupSnap.empty) { newCode = candidate; break; }
    }
    if (!newCode) throw new HttpsError("internal", "새 코드 생성 실패 (5회 시도). 다시 시도해주세요.");

    // 트랜잭션: 기존 코드 revoke + 새 코드 발급 (둘 다 루트 b2b_codes 컬렉션, auto-ID)
    const batch = db.batch();
    batch.update(codeRef, {
      status: "revoked",
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedReason: "regenerated",
      regeneratedAs: newCode,
    });
    const newCodeRef = db.collection("b2b_codes").doc();
    batch.set(newCodeRef, {
      code: newCode,
      orgCode: order.orgCode,
      orderId,
      orgName: order.orgName,
      status: "unused",
      usedByUid: null,
      usedByEmail: null,
      usedAt: null,
      hasDiary: !!codeData.hasDiary, // 기존 코드의 다이어리 여부 승계
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      regeneratedFrom: oldCode,
    });
    await batch.commit();

    logger.info("[b2b-group] 코드 재발급", { orderId, oldCode, newCode, by: request.auth.token.email });

    return { ok: true, oldCode, newCode, orgCode: order.orgCode };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [bootstrapAdmin] 최초 1회 운영자 권한 부여 (이메일 화이트리스트 기반)
// ─────────────────────────────────────────────────────────────────────────────
//
// 사용 방법:
//   1) 사용자님 계정으로 https://lifeporfolio.web.app/login 에서 로그인
//   2) 브라우저 F12 콘솔에서 아래 1줄 실행:
//        firebase.functions("asia-northeast3").httpsCallable("bootstrapAdmin")()
//      또는 modular SDK 환경:
//        (await import("https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js"))
//          .httpsCallable(window._functions || getFunctions(getApp(), "asia-northeast3"), "bootstrapAdmin")()
//      → 가장 쉬운 방법: /b2b-admin 페이지에서 자동으로 호출되도록 만들었음 (아래 별도 안내)
//   3) 호출 후 한 번 로그아웃 → 다시 로그인 (claim은 새 토큰에서만 적용)
//
// 보안:
//   - 허용된 이메일(ALLOWED_BOOTSTRAP_EMAILS)만 admin 될 수 있음
//   - 이미 admin custom claim이 있는 사용자가 1명이라도 존재하면 거부됨 (= 1회용)
//   - 이메일 verified 필수
//
const ALLOWED_BOOTSTRAP_EMAILS = [
  "faise@lifeportfolio.co.kr",
  "ghwelcome0@gmail.com", // 백업 (GitHub 계정 — 필요 시 사용)
];

const bootstrapAdmin = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const email = (request.auth.token.email || "").toLowerCase();
    const emailVerified = !!request.auth.token.email_verified;
    const uid = request.auth.uid;

    if (!email) {
      throw new HttpsError("permission-denied", "이메일이 등록되지 않은 계정입니다.");
    }
    if (!ALLOWED_BOOTSTRAP_EMAILS.map((s) => s.toLowerCase()).includes(email)) {
      logger.warn("[bootstrapAdmin] 화이트리스트에 없는 이메일", { email, uid });
      throw new HttpsError("permission-denied", `이 계정(${email})은 부트스트랩 대상이 아닙니다.`);
    }
    if (!emailVerified) {
      throw new HttpsError("failed-precondition", "이메일 인증이 완료된 계정만 가능합니다. (Google 로그인 권장)");
    }

    // 이미 admin claim 가진 사용자가 있는지 확인 (1회용 — 이미 누가 받았으면 거부)
    // listUsers는 무겁지만 1회 호출용이므로 OK
    try {
      let alreadyHasAdmin = false;
      let nextPageToken = undefined;
      do {
        const result = await admin.auth().listUsers(1000, nextPageToken);
        for (const u of result.users) {
          if (u.customClaims && u.customClaims.admin === true && u.uid !== uid) {
            alreadyHasAdmin = true;
            break;
          }
        }
        if (alreadyHasAdmin) break;
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      if (alreadyHasAdmin) {
        throw new HttpsError(
          "already-exists",
          "이미 다른 사용자에게 admin 권한이 부여되어 있습니다. 추가 부여는 기존 admin이 직접 진행해주세요."
        );
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error("[bootstrapAdmin] listUsers 실패", { err: String(e) });
      throw new HttpsError("internal", "권한 확인 중 오류가 발생했습니다: " + String(e.message || e));
    }

    // claim 부여
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    logger.info("[bootstrapAdmin] ✅ admin 권한 부여 완료", { uid, email });

    return {
      ok: true,
      uid,
      email,
      message: "admin 권한이 부여되었습니다. 로그아웃 후 다시 로그인하면 적용됩니다.",
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  submitB2BQuote,
  reportB2BPayment,
  approveB2BOrder,
  verifyB2BCode,
  getB2BAdminData,
  getB2BOrderCodes,
  getB2BPriceQuote,
  lookupB2BOrder,
  cancelB2BOrder,
  refundB2BOrder,
  regenerateB2BAccessCode,
  bootstrapAdmin,
  // 내부 헬퍼 (테스트용)
  _internals: {
    calcUnitPrice,
    calcOrderAmount,
    generateOrderNumber,
    generateOrgCode,
    generateAccessCode,
  },
};
