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
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

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
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
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
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [2] reportB2BPayment — 고객사가 "입금 완료 신고" 클릭
// ─────────────────────────────────────────────────────────────────────────────
const reportB2BPayment = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
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
    return { ok: true, orderNumber: order.orderNumber };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [3] approveB2BOrder — 관리자(사용자님)가 입금 확인 후 코드 발급
// ─────────────────────────────────────────────────────────────────────────────
const approveB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120 },
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

    return {
      ok: true,
      orgCode,
      codesIssued: writtenCount,
      codes, // 운영자 이메일/CSV 발송용으로 클라이언트에 반환
      orderNumber: order.orderNumber,
      contactEmail: order.contactEmail,
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
  // 내부 헬퍼 (테스트용)
  _internals: {
    calcUnitPrice,
    calcOrderAmount,
    generateOrderNumber,
    generateOrgCode,
    generateAccessCode,
  },
};
