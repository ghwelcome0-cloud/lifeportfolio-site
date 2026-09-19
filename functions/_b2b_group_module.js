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
 *   10명+   ₩18,000 / 30명+   ₩16,000 / 50명+   ₩14,000
 *   100명+  ₩12,000 / 200명+  ₩11,000 / 500명+  ₩10,000
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
const crypto = require("node:crypto");
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
const B2B_PUBLIC_URL = "https://lifeportfolio.co.kr";
const B2B_ADMIN_URL = "https://lifeporfolio-admin.web.app/admin";
const B2B_SCOPE_TEXT = "현재 단체 PoC의 기본 제공 범위는 조직 ID·인원별 참여 코드, 핵심 56문항과 응답 조건에 따른 최대 20개 추가 입력, 개인별 진단 1회와 리포트 1부(본인 열람)입니다.";
const B2B_BOUNDARY_TEXT = "팀 종합 리포트, 담당자의 개인 결과 열람, 워크숍·코칭·연간 운영과 준비 중인 AI·확장 서비스는 이번 기본 제공 범위에 포함되지 않습니다.";
const B2B_TERMS_TEXT = "단체 이용약관 제5조에 따른 참여 코드 유효기간은 발급일로부터 12개월이며, 환불은 제9조의 조건을 따릅니다. 재발송으로 유효기간이 연장되지는 않습니다.";
const B2B_PARTICIPATION_TEXT = "참여자가 직접 가입·동의한 후 자율적으로 참여하도록 안내해주세요. 참여 여부나 결과 공유 여부를 인사평가 등 불이익과 연결하지 마세요.";
const B2B_VALUES_TEXT = "사람을 고정된 유형이나 순위에 맞추기보다, 각자의 응답을 바탕으로 자신을 이해하도록 돕습니다. 결과는 자기이해·자기경영을 위한 참고 자료이며 채용·인사평가나 의학적 판단의 단독 근거로 사용하지 마세요.";

function b2bMailLayout(title, content) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f3ed;color:#193c35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fffef9;border:1px solid #d9dcd2;border-radius:10px;overflow-wrap:anywhere">
<tr><td style="padding:24px;background:#193c35;color:#fffef9"><p style="margin:0 0 8px;font-size:13px">파이스 · 인생포트폴리오</p><h1 style="margin:0;font-size:23px;line-height:1.5">${escHtml(title)}</h1></td></tr>
<tr><td style="padding:24px;font-size:15px">${content}</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #d9dcd2;font-size:13px;color:#526457"><p style="margin:0">당신의 고유함이,<br>서로의 양식이 되도록</p><p style="margin:12px 0 0">문의는 이 메일에 답장하거나 <a href="mailto:${REPLY_TO}" style="color:#193c35">${REPLY_TO}</a>로 보내주세요.<br><a href="${B2B_PUBLIC_URL}/b2b-terms" style="color:#193c35">단체 이용약관</a> · <a href="${B2B_PUBLIC_URL}/b2b-privacy" style="color:#193c35">단체 개인정보 안내</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

function b2bMailScopeHtml() {
  return `<section style="margin:24px 0 0;padding:18px;background:#f1f4eb;border-radius:8px"><h2 style="margin:0 0 10px;font-size:17px">함께 지킬 이용 원칙</h2><p>${escHtml(B2B_SCOPE_TEXT)}</p><p>${escHtml(B2B_BOUNDARY_TEXT)}</p><p>${escHtml(B2B_VALUES_TEXT)}</p><p>${escHtml(B2B_PARTICIPATION_TEXT)}</p><p>${escHtml(B2B_TERMS_TEXT)}</p><p>개인 리포트는 참여자 본인이 열람합니다. 결과를 공유할지와 어느 범위까지 공유할지는 본인이 결정합니다. 담당자에게 제공되는 진행 현황에는 개인 응답·결과·점수를 포함하지 않습니다.</p><p style="margin-bottom:0">통계적 신뢰도·타당도 검증은 완료되지 않았습니다. 자세한 제공 범위와 한계는 계약 전 안내를 확인해주세요.</p></section>`;
}


function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sendResendEmail({ apiKey, to, replyTo, subject, html, text, tag, attachments, idempotencyKey }) {
  if (!apiKey) {
    logger.warn("[b2b-group] RESEND_API_KEY 미설정 — 메일 발송 스킵", { subject });
    return { ok: false, deliveryStatus: "not_accepted", reason: "missing_resend_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: replyTo || REPLY_TO,
        subject, html, text,
        // [FIX] .txt 등 첨부 지원 — Resend attachments: [{ filename, content(base64) }]
        attachments: (Array.isArray(attachments) && attachments.length) ? attachments : undefined,
        tags: tag ? [{ name: "campaign", value: tag }] : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("[b2b-group] Resend API 실패", { status: res.status, body: body.slice(0, 300), subject, to });
      return { ok: false, deliveryStatus: res.status >= 500 ? "unknown" : "not_accepted", status: res.status };
    }
    const accepted = await res.json().catch(() => ({}));
    if (typeof accepted.id !== "string" || !accepted.id.trim()) {
      return { ok: false, deliveryStatus: "unknown", reason: "missing_message_id" };
    }
    return { ok: true, deliveryStatus: "provider_accepted", messageId: accepted.id };
  } catch (e) {
    logger.error("[b2b-group] sendResendEmail 예외", { err: String(e), subject, to });
    // Timeout/network loss does not prove that the provider rejected the mail.
    return { ok: false, deliveryStatus: "unknown", err: String(e) };
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
// [NEW 2026-06] Access Code 엑셀 대시보드 생성 (.xlsx)
// ─────────────────────────────────────────────────────────────────────────────
// 조직 관리자에게 .txt 대신 "한 눈에 보는 엑셀 대시보드"를 첨부한다.
//   - 상단: 조직 ID / 주문번호 / 발급일 / 총 코드 수 / 다이어리 포함 수 요약
//   - 표: No · Access Code · 다이어리 · 상태 · 배포 대상(관리자 기입) · 비고
//   - autoFilter / 헤더 색 / 열 너비로 바로 분배·관리 가능
// 반환: { filename, content(base64) }  → Resend attachments 형식 그대로 사용
//
// codes: string[]  (Access Code 문자열 배열)
// opts : { orgCode, orderNumber, orgName, diaryCount, statusByCode? }
//   statusByCode: { [code]: "미사용"|"사용" }  (재전송 시 현재 상태 반영, 선택)
async function buildCodesXlsx(codes, opts = {}) {
  const ExcelJS = require("exceljs");
  const {
    orgCode = "", orderNumber = "", orgName = "",
    diaryCount = 0, statusByCode = null, diaryByCode = null,
  } = opts;
  const issuedAt = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "인생포트폴리오 (Life Portfolio)";
  wb.created = new Date();
  const ws = wb.addWorksheet("Access Codes", {
    views: [{ state: "frozen", ySplit: 8 }], // 헤더 행 고정
  });

  // 열 너비
  ws.columns = [
    { width: 6 },   // A: No
    { width: 22 },  // B: Access Code
    { width: 10 },  // C: 다이어리
    { width: 12 },  // D: 상태
    { width: 24 },  // E: 배포 대상(관리자 기입)
    { width: 20 },  // F: 비고
  ];

  const NAVY = "FF1A2B4A";
  const GOLD = "FFC9A961";
  const LIGHT = "FFF8FAFC";

  // ── 타이틀
  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = `인생포트폴리오 단체 참여 코드 관리표`;
  title.font = { name: "맑은 고딕", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getRow(1).height = 30;

  // ── 요약 영역 (2~6행: 라벨 / 값)
  const summary = [
    ["조직 ID (모든 참여자 공통)", orgCode],
    ["주문번호", orderNumber],
    ["조직명", orgName],
    ["발급일", issuedAt],
    ["총 코드 수", `${codes.length}개` + (diaryCount > 0 ? `  (다이어리 포함 ${diaryCount}권)` : "")],
  ];
  summary.forEach((row, i) => {
    const r = i + 2;
    ws.mergeCells(`A${r}:B${r}`);
    ws.mergeCells(`C${r}:F${r}`);
    const labelCell = ws.getCell(`A${r}`);
    const valueCell = ws.getCell(`C${r}`);
    labelCell.value = row[0];
    valueCell.value = row[1];
    labelCell.font = { name: "맑은 고딕", size: 11, bold: true, color: { argb: "FF475569" } };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    valueCell.font = { name: "맑은 고딕", size: 12, bold: true, color: { argb: NAVY } };
    valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(r).height = 22;
  });

  // ── 안내 한 줄 (7행)
  ws.mergeCells("A7:F7");
  const guide = ws.getCell("A7");
  guide.value = "참여자별 코드 1개씩 개별 전달 · https://lifeportfolio.co.kr/b2b-join · 전체 파일 공개 금지";
  guide.font = { name: "맑은 고딕", size: 10, italic: true, color: { argb: "FF92400E" } };
  guide.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  guide.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(7).height = 22;

  // ── 표 헤더 (8행)
  const headerRow = ws.getRow(8);
  const headers = ["No", "Access Code", "다이어리", "상태", "배포 대상 (관리자 기입)", "비고"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "맑은 고딕", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  headerRow.height = 26;

  // ── 코드 행
  codes.forEach((code, i) => {
    const r = 9 + i;
    const row = ws.getRow(r);
    const hasDiary = diaryByCode && typeof diaryByCode[code] === "boolean" ? diaryByCode[code] : diaryCount > i;
    const status = (statusByCode && statusByCode[code]) ? statusByCode[code] : "미사용";
    const vals = [
      i + 1,
      code,
      hasDiary ? "포함" : "-",
      status,
      "", // 배포 대상 (관리자가 채움)
      "", // 비고
    ];
    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.alignment = {
        vertical: "middle",
        horizontal: (ci === 1) ? "left" : "center",
        indent: (ci === 1) ? 1 : 0,
      };
      cell.font = (ci === 1)
        ? { name: "Consolas", size: 11, bold: true, color: { argb: NAVY } }
        : { name: "맑은 고딕", size: 10.5, color: { argb: "FF334155" } };
      // 줄무늬 배경
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      }
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
    row.height = 20;
  });

  // ── 자동 필터 (표 영역)
  const lastRow = 8 + codes.length;
  ws.autoFilter = { from: "A8", to: `F${lastRow}` };

  const buf = await wb.xlsx.writeBuffer();
  const filename = `AccessCode_${(orderNumber || "order")}_${codes.length}codes.xlsx`;
  return {
    filename,
    content: Buffer.from(buf).toString("base64"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// [공통] B2B 코드 안내 메일 본문 빌더
//   - 자동 발송(resendB2BCodesEmail)·수동 발송 준비(getB2BCodesEmailDraft)가
//     모두 이 함수를 사용하여 양식/멘트/첨부가 100% 동일하도록 보장.
//   - 반환: { subject, html, text, attachments, to, replyTo, from, xlsxFileName }
// ─────────────────────────────────────────────────────────────────────────────
async function buildB2BCodesEmail(order, codes, statusByCode) {
  const orgCode = order.orgCode || "";
  const diaryCount = order.diaryCount || 0;
  const orgName = order.orgName || "단체";
  const orderNumber = order.orderNumber || "";
  const contactName = order.contactName || "담당자";
  const contactEmail = order.contactEmail || "";
  const attachment = await buildCodesXlsx(codes, { orgCode, orderNumber, orgName, diaryCount,
    statusByCode: statusByCode || null, diaryByCode: order.diaryByCode || null });
  const joinUrl = `${B2B_PUBLIC_URL}/b2b-join`;
  const subject = `[인생포트폴리오] 단체 참여 코드 안내 · ${orderNumber}`;
  const html = b2bMailLayout("단체 참여 코드가 준비되었습니다", `
<p>${escHtml(contactName)} 담당자님, ${escHtml(orgName)}의 참여 준비를 안내드립니다.</p>
<p><strong>주문번호:</strong> ${escHtml(orderNumber)}<br><strong>조직 ID:</strong> <span style="font-family:monospace;word-break:break-all">${escHtml(orgCode)}</span><br><strong>첨부된 유효 코드:</strong> ${codes.length}개</p>
<p>전체 참여 코드와 현재 사용 상태는 첨부 엑셀 <strong>${escHtml(attachment.filename)}</strong>에서 확인해주세요. 첨부가 차단되거나 열리지 않으면 이 메일에 답장해주세요.</p>
<h2 style="font-size:18px">담당자가 할 일</h2><ol style="padding-left:22px"><li>참여자 한 명에게 코드 한 개씩 개별 전달해주세요. 전체 코드 파일을 공용 게시판이나 단체 대화방에 올리지 마세요.</li><li>이미 사용된 코드는 다시 배포하지 마세요. 코드가 맞지 않거나 준비가 지연되면 같은 계정으로 다시 시도하고, 새 코드 사용·재결제 전 고객지원에 문의해주세요.</li></ol>
<h2 style="font-size:18px">참여자가 할 일</h2><ol style="padding-left:22px"><li>아래 페이지에서 조직 ID와 본인 참여 코드를 입력합니다.</li><li>본인 계정으로 가입 또는 로그인하고 이용 안내·개인정보 내용을 확인합니다.</li><li>핵심 56문항과 응답 조건에 따른 추가 입력을 완료합니다. 응답 저장과 리포트 생성이 끝나면 본인 리포트를 열람할 수 있습니다.</li><li>다시 열람할 때도 같은 계정으로 로그인해주세요. PC와 모바일 사이에서 계정이 달라지지 않도록 확인해주세요.</li></ol>
<p><a href="${joinUrl}" style="display:inline-block;min-height:44px;box-sizing:border-box;padding:12px 20px;border-radius:6px;background:#244b37;color:#fff;text-decoration:none;font-weight:bold">단체 참여 시작하기</a></p><p style="font-size:13px;word-break:break-all">버튼이 열리지 않으면 주소를 복사해 일반 브라우저에서 열어주세요.<br><a href="${joinUrl}" style="color:#193c35">${joinUrl}</a></p>
${diaryCount > 0 ? `<p>기존 주문의 다이어리 옵션 ${diaryCount}권은 별도 확인한 주문 조건을 따릅니다.</p>` : ""}
${b2bMailScopeHtml()}`);
  const text = [
    `${contactName} 담당자님, ${orgName}의 단체 참여 코드가 준비되었습니다.`,
    `주문번호: ${orderNumber}`, `조직 ID: ${orgCode}`, `첨부 유효 코드: ${codes.length}개`,
    `첨부 파일: ${attachment.filename} — 열리지 않으면 이 메일에 답장해주세요.`,
    ...(diaryCount > 0 ? [`기존 주문의 다이어리 옵션 ${diaryCount}권은 별도 확인한 주문 조건을 따릅니다.`] : []),
    "참여자 한 명에게 코드 한 개씩 개별 전달해주세요. 전체 코드 파일을 공용 게시판이나 단체 대화방에 올리지 마세요.",
    "이미 사용된 코드는 다시 배포하지 마세요. 오류가 나면 같은 계정·코드로 재시도하고 새 코드 사용·재결제 전에 고객지원에 문의해주세요.",
    `참여 시작: ${joinUrl}`, "본인 계정으로 가입/로그인 → 이용 안내·개인정보 확인 → 핵심 56문항과 조건부 추가 입력 → 응답 저장·리포트 생성 후 본인 열람",
    "PC·모바일에서 같은 계정을 사용해주세요. 메일앱에서 열리지 않으면 주소를 복사해 일반 브라우저에서 열어주세요.",
    B2B_SCOPE_TEXT, B2B_BOUNDARY_TEXT, B2B_VALUES_TEXT, B2B_PARTICIPATION_TEXT, B2B_TERMS_TEXT,
    "개인 리포트는 참여자 본인이 열람하며 공유 여부와 범위는 본인이 결정합니다. 담당자의 진행 현황에는 개인 응답·결과·점수를 포함하지 않습니다.",
    "통계적 신뢰도·타당도 검증은 완료되지 않았습니다.",
    `문의: ${REPLY_TO}`, `단체 이용약관: ${B2B_PUBLIC_URL}/b2b-terms`, `개인정보 안내: ${B2B_PUBLIC_URL}/b2b-privacy`,
    "당신의 고유함이,", "서로의 양식이 되도록",
  ].join("\n\n");
  return { subject, html, text, attachments: [attachment], to: contactEmail,
    replyTo: REPLY_TO, from: FROM_EMAIL, xlsxFileName: attachment.filename, xlsxBase64: attachment.content };
}

// ─────────────────────────────────────────────────────────────────────────────
// 가격 계산 (서버 사이드 — 클라이언트가 가격 조작 불가)
// ─────────────────────────────────────────────────────────────────────────────
function calcUnitPrice(seats) {
  if (seats >= 500) return 10000;
  if (seats >= 200) return 11000;
  if (seats >= 100) return 12000;
  if (seats >= 50)  return 14000;
  if (seats >= 30)  return 16000;
  if (seats >= 10)  return 18000;
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
  if (order && (order.status === "payment_reported" || (order.status === "cancelled" && order.cancelPreviousStatus === "payment_reported"))) {
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
  const rand = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `LP-${ym}-${rand}`;
}

function generateOrgCode(orgName) {
  // 영문/숫자만 추출 + 대문자, 그 뒤에 연도 4자리 + 3자리 난수
  const cleaned = String(orgName || "ORG")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "ORG";
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${cleaned}-${year}-${rand}`;
}

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/1/I/O 제외
function generateAccessCode() {
  // XXXX-XXXX (8자리)
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ACCESS_CODE_ALPHABET[crypto.randomInt(ACCESS_CODE_ALPHABET.length)];
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
    const seats = Number(data.seats);
    const diaryCount = Number(data.diaryCount || 0);
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
    if (!Number.isSafeInteger(seats) || seats < 10 || seats > 29) {
      throw new HttpsError("invalid-argument", "현재 신규 단체 신청은 10~29명만 가능합니다. 더 큰 규모는 고객지원에 문의해주세요.");
    }
    if (diaryCount !== 0) {
      throw new HttpsError("invalid-argument", "현재 신규 견적에서는 다이어리 옵션을 판매하지 않습니다. 기존 계약의 옵션은 그대로 유지됩니다.");
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
      ? `<tr><td style="padding:4px 0;color:#94a3b8">다이어리</td><td style="padding:4px 0;text-align:right;color:#e2e8f0">${price.diaryCount}권 × ${formatWon(DIARY_UNIT_PRICE)}</td></tr>`
      : "";

    // 6-1) 운영자 알림 메일
    const adminSubject = `[B2B 견적] ${orgName} · ${orderNumber} · ${seats}명 · ${formatWon(price.totalAmount)}`;
    const adminHtml = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.65">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;overflow-wrap:anywhere;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
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
            <tr><td style="padding:4px 0;color:#94a3b8">진단</td><td style="padding:4px 0;text-align:right;color:#e2e8f0">${seats}명 × ${formatWon(price.unitPrice)}</td></tr>
            ${diaryLine}
            <tr><td style="padding:8px 0 4px;color:#94a3b8;border-top:1px solid rgba(255,255,255,.15)">공급가액</td><td style="padding:8px 0 4px;text-align:right;color:#e2e8f0;border-top:1px solid rgba(255,255,255,.15)">${formatWon(price.supplyAmount)}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8">VAT (10%)</td><td style="padding:4px 0;text-align:right;color:#e2e8f0">${formatWon(price.vatAmount)}</td></tr>
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
          <strong style="color:#92400e">[다음 단계]</strong> 입금 확인 후 <a href="${B2B_ADMIN_URL}" style="color:#1a2b4a;font-weight:700">운영자 대시보드</a>의 단체 관리 화면에서 승인 + 코드 발급을 진행하세요.<br>
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
      `대시보드: ${B2B_ADMIN_URL}`,
    ].filter(Boolean).join("\n");

    const adminResult = await sendResendEmail({
      apiKey,
      to: ADMIN_EMAIL,
      replyTo: contactEmail, // 답장 시 담당자에게 바로 회신
      subject: adminSubject,
      html: adminHtml,
      text: adminText,
      tag: "b2b-group-quote-admin",
      idempotencyKey: `b2b-quote-admin-${docRef.id}`,
    });

    // 6-2) 고객사 담당자 접수 확인 메일
    const userSubject = `[인생포트폴리오] 단체 견적 접수·다음 단계 안내 · ${orderNumber}`;
    const checkoutParams = new URLSearchParams({ order: docRef.id, no: orderNumber,
      seats: String(seats), unit: String(price.unitPrice), supply: String(price.supplyAmount),
      vat: String(price.vatAmount), total: String(price.totalAmount),
      diary: String(price.diaryCount), diaryUnit: String(price.diaryUnitPrice) });
    const checkoutUrl = `${B2B_PUBLIC_URL}/b2b-checkout?${checkoutParams}`;
    const userHtml = b2bMailLayout("단체 견적 요청을 접수했습니다", `
<p>${escHtml(contactName)} 담당자님, ${escHtml(orgName)}의 견적 요청을 접수했습니다.</p>
<p><strong>현재 단계: 견적 접수</strong><br>아직 입금 확인이나 참여 코드 발급이 완료된 상태는 아닙니다.</p>
<p><strong>주문번호:</strong> ${escHtml(orderNumber)}<br><strong>진단 인원:</strong> ${seats}명<br><strong>1인 단가:</strong> ${formatWon(price.unitPrice)} (VAT 별도)</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background:#f1f4eb;border-radius:8px"><tr><td>공급가액</td><td align="right">${formatWon(price.supplyAmount)}</td></tr><tr><td>부가세 (10%)</td><td align="right">${formatWon(price.vatAmount)}</td></tr><tr><td><strong>입금하실 총액</strong></td><td align="right"><strong>${formatWon(price.totalAmount)}</strong></td></tr></table>
<p>총액에는 부가세가 포함되어 있습니다. 부가세를 별도로 한 번 더 입금하지 마세요.</p>
<h2 style="font-size:18px">다음 단계</h2><ol style="padding-left:22px"><li>신청 인원·금액·제공 범위를 확인해주세요. 수정이 필요하면 다시 견적을 반복 신청하지 말고 주문번호를 적어 이 메일에 답장해주세요.</li><li>진행을 결정하셨다면 아래 계좌에 총액을 입금하고, 입금자명에 주문번호를 포함해주세요.</li><li>결제 안내 페이지에서 입금 완료를 신고해주세요. 입금 신고만으로 코드가 자동 발급되지는 않습니다.</li><li>운영자가 입금을 확인한 뒤 조직 ID와 인원별 참여 코드를 이 이메일로 안내합니다. 입금 확인은 기존 안내대로 영업일 기준 1일 이내 처리합니다.</li></ol>
<p><strong>카카오뱅크 3333-31-6566369</strong><br>예금주: 파이스<br>입금자명에 포함할 주문번호: <strong>${escHtml(orderNumber)}</strong><br>입금 총액: <strong>${formatWon(price.totalAmount)}</strong></p>
<p><a href="${escHtml(checkoutUrl)}" style="display:inline-block;min-height:44px;box-sizing:border-box;padding:12px 20px;background:#244b37;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">결제 안내·입금 신고 열기</a></p>
<p style="font-size:13px">메일앱에서 버튼이 열리지 않으면 링크를 복사해 일반 브라우저에서 열어주세요. 세금계산서가 필요하거나 메일 안내가 누락되면 주문번호를 적어 답장해주세요.</p>
${b2bMailScopeHtml()}`);
    const userText = [
      `${contactName} 담당자님, ${orgName}의 단체 견적 요청을 접수했습니다.`,
      "현재 단계: 견적 접수. 입금 확인·참여 코드 발급은 아직 완료되지 않았습니다.",
      `주문번호: ${orderNumber}`, `진단 인원: ${seats}명 / 1인 단가: ${formatWon(price.unitPrice)} (VAT 별도)`,
      `공급가액: ${formatWon(price.supplyAmount)}`, `부가세(10%): ${formatWon(price.vatAmount)}`,
      `입금 총액: ${formatWon(price.totalAmount)} (부가세 포함; 부가세를 한 번 더 입금하지 마세요.)`,
      "신청 인원·금액·제공 범위를 확인해주세요. 수정은 주문번호를 적어 이 메일에 답장해주세요. 반복 견적 신청이나 중복 입금은 하지 마세요.",
      `진행 결정 후 카카오뱅크 3333-31-6566369 / 예금주 파이스 / 입금자명에 ${orderNumber} 포함`,
      `결제 안내·입금 신고: ${checkoutUrl}`,
      "입금 신고는 입금 확인 완료가 아닙니다. 운영자 확인 뒤 조직 ID와 참여 코드를 별도 발송합니다. 입금 확인은 영업일 기준 1일 이내 처리합니다.",
      B2B_SCOPE_TEXT, B2B_BOUNDARY_TEXT, B2B_VALUES_TEXT, B2B_PARTICIPATION_TEXT, B2B_TERMS_TEXT,
      "개인 리포트는 본인이 열람하며 공유 여부와 범위는 참여자가 직접 결정합니다. 담당자의 진행 현황에 개인 응답·결과·점수는 포함하지 않습니다.",
      "통계적 신뢰도·타당도 검증은 완료되지 않았습니다.",
      `문의·세금계산서 요청: ${REPLY_TO} (주문번호를 함께 보내주세요.)`,
      `단체 이용약관: ${B2B_PUBLIC_URL}/b2b-terms`, `개인정보 안내: ${B2B_PUBLIC_URL}/b2b-privacy`,
      "당신의 고유함이,", "서로의 양식이 되도록",
    ].join("\n\n");

    const userResult = await sendResendEmail({
      apiKey,
      to: contactEmail,
      replyTo: REPLY_TO,
      subject: userSubject,
      html: userHtml,
      text: userText,
      tag: "b2b-group-quote-customer",
      idempotencyKey: `b2b-quote-customer-${docRef.id}`,
    });

    // 6-3) 메일 발송 결과를 Firestore에 기록 (감사 추적)
    try {
      await docRef.update({
        adminEmailSent: !!adminResult.ok,
        userEmailSent: !!userResult.ok,
        adminEmailMessageId: adminResult.messageId || null,
        userEmailMessageId: userResult.messageId || null,
        adminEmailStatus: adminResult.deliveryStatus,
        userEmailStatus: userResult.deliveryStatus,
        emailDeliveryNote: "provider_accepted_is_not_inbox_delivery",
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
      // Keep legacy flags for compatibility; neither means inbox delivery.
      emailSent: {
        admin: !!adminResult.ok,
        customer: !!userResult.ok,
      },
      emailStatus: {
        admin: adminResult.deliveryStatus,
        customer: userResult.deliveryStatus,
      },
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [2] reportB2BPayment — 고객사가 "입금 완료 신고" 클릭
// ─────────────────────────────────────────────────────────────────────────────
function requireOrderOwner(request, order) {
  if (!request.auth) throw new HttpsError("unauthenticated", "견적을 신청한 계정으로 로그인해주세요.");
  if (isAdmin(request)) return;
  if (order.contactUid) {
    if (order.contactUid === request.auth.uid) return;
  } else {
    // Legacy guest orders may be recovered only by a Firebase-verified mailbox owner.
    const token = request.auth.token || {};
    if (token.email_verified === true && typeof token.email === "string" &&
        token.email.trim().toLowerCase() === String(order.contactEmail || "").trim().toLowerCase()) return;
  }
  throw new HttpsError("permission-denied", "주문 담당자 확인이 필요합니다. 견적을 신청한 계정 또는 인증된 담당자 이메일로 로그인해주세요.");
}
function checkoutOrderId(request) {
  const id = request.data && request.data.orderId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new HttpsError("invalid-argument", "올바른 주문 ID가 필요합니다.");
  return id;
}
const getB2BCheckoutOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "견적을 신청한 계정으로 로그인해주세요.");
    await checkCallableRateLimit(request, "getB2BCheckoutOrder", { perMinute: 10, perHour: 60 });
    const snap = await admin.firestore().collection("b2b_orders").doc(checkoutOrderId(request)).get();
    if (!snap.exists) throw new HttpsError("not-found", "주문을 확인할 수 없습니다.");
    const order = snap.data(); requireOrderOwner(request, order);
    const fields = ["orderNumber", "orgName", "seats", "diaryCount", "unitPrice", "diaryUnitPrice", "supplyAmount", "vatAmount", "totalAmount", "status"];
    const safe = {};
    for (const field of fields) if (order[field] !== undefined) safe[field] = order[field];
    return { ok: true, order: safe };
  }
);

const reportB2BPayment = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "견적을 신청한 계정으로 로그인해주세요.");
    await checkCallableRateLimit(request, "reportB2BPayment", { perMinute: 5, perHour: 20 });
    const orderId = checkoutOrderId(request);
    const depositorName = sanitizeStr(request.data && request.data.depositorName, 40);
    if (!depositorName) throw new HttpsError("invalid-argument", "실제 송금 시 사용한 입금자명을 입력해주세요.");
    const db = admin.firestore();
    const docRef = db.collection("b2b_orders").doc(orderId);
    const transition = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new HttpsError("not-found", "주문을 확인할 수 없습니다.");
      const order = snap.data(); requireOrderOwner(request, order);
      if (["payment_reported", "active"].includes(order.status)) return { order, duplicate: true };
      if (order.status !== "quote_requested") throw new HttpsError("failed-precondition", "현재 상태에서는 입금 신고할 수 없습니다. 고객지원에 확인해주세요.");
      const update = {
        status: "payment_reported", depositorName,
        paymentReportedBy: request.auth.uid,
        paymentNoticeStatus: "pending",
        paymentReportedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (!order.contactUid && !isAdmin(request)) update.contactUid = request.auth.uid;
      tx.update(docRef, update);
      return { order, duplicate: false };
    });
    const order = transition.order;
    if (transition.duplicate) return { ok: true, orderNumber: order.orderNumber, status: order.status, alreadyReported: true, emailStatus: order.paymentNoticeStatus || "unknown" };

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
          <a href="${B2B_ADMIN_URL}" style="display:inline-block;padding:14px 28px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14.5px">✓ 운영자 대시보드에서 처리하기 →</a>
        </div>

        <p style="margin:18px 0 0;font-size:12.5px;color:#737373;line-height:1.65">
          1) 카카오뱅크 입금내역에서 "<strong>${escHtml(depositorName || "")}</strong>" 또는 "<strong>${escHtml(order.orderNumber)}</strong>" 검색<br>
          2) 금액 ${formatWon(order.totalAmount)} 확인<br>
          3) 일치 시 운영자 대시보드의 단체 관리 화면에서 <strong style="color:#16a34a">[입금 확인 + 코드 발급]</strong> 클릭
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
      `대시보드: ${B2B_ADMIN_URL}`,
    ].join("\n");

    const notice = await sendResendEmail({
      apiKey,
      to: ADMIN_EMAIL,
      replyTo: order.contactEmail,
      subject,
      html,
      text,
      tag: "b2b-group-payment-reported",
      idempotencyKey: "b2b-payment-report-" + orderId,
    });
    await docRef.update({ paymentNoticeStatus: notice.deliveryStatus, paymentNoticeMessageId: notice.messageId || null });
    return { ok: true, orderNumber: order.orderNumber, status: "payment_reported", emailStatus: notice.deliveryStatus };
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
    // Unmatched Firestore collections are denied to all client SDKs by default.
    // Never put the plaintext plan on the customer-readable order document.
    const jobRef = db.collection("b2b_issuance_jobs").doc(orderId);
    const leaseId = crypto.randomBytes(16).toString("hex");
    const leaseMs = 180000; // Longer than the function timeout; every chunk checks ownership.
    const claimed = await db.runTransaction(async (tx) => {
      const [snap, jobSnap] = await Promise.all([tx.get(orderRef), tx.get(jobRef)]);
      if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
      const value = snap.data(), job = jobSnap.exists ? jobSnap.data() : {};
      if (value.status === "active") return { alreadyActive: true, order: value };
      if (!["quote_requested", "payment_reported"].includes(value.status)) {
        throw new HttpsError("failed-precondition", "취소·환불되었거나 승인할 수 없는 주문입니다.");
      }
      if (job.lease && job.lease.expiresAt > Date.now()) {
        throw new HttpsError("aborted", "코드를 발급 중입니다. 잠시 후 주문 상태를 확인해주세요.");
      }
      const seats = value.seats;
      if (!Number.isSafeInteger(seats) || seats < 10 || seats > 10000) {
        throw new HttpsError("failed-precondition", "주문 인원을 확인해주세요.");
      }
      if (value.issuancePlan) throw new HttpsError("failed-precondition", "공개 주문에 이전 발급 계획이 남아 있어 운영자 보안 확인이 필요합니다.");
      let plan = job.plan;
      let orgCode = job.orgCode || value.orgCode;
      if (!Array.isArray(plan)) {
        const legacy = await tx.get(db.collection("b2b_codes").where("orderId", "==", orderId).limit(1));
        if (!legacy.empty) {
          throw new HttpsError("failed-precondition", "이전 발급 기록이 남아 있습니다. 추가 발급 전에 운영자 확인이 필요합니다.");
        }
        const unique = new Set();
        while (unique.size < seats) unique.add(generateAccessCode());
        plan = [...unique];
        orgCode = generateOrgCode(value.orgName);
      }
      if (plan.length !== seats || new Set(plan).size !== seats || !orgCode) {
        throw new HttpsError("failed-precondition", "발급 계획이 주문 인원과 일치하지 않습니다. 운영자 확인이 필요합니다.");
      }
      const issued = Number.isSafeInteger(value.codesIssued) ? value.codesIssued : 0;
      if (issued < 0 || issued > seats) throw new HttpsError("failed-precondition", "발급 진행 기록을 확인해주세요.");
      tx.set(jobRef, { plan, orgCode, lease: { id: leaseId, expiresAt: Date.now() + leaseMs },
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.update(orderRef, {
        issuanceJobId: orderId, orgCode, codesIssued: issued, issuanceStatus: "running",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { order: { ...value, orgCode, issuancePlan: plan, codesIssued: issued } };
    });
    const order = claimed.order;
    if (claimed.alreadyActive) {
      const existing = await db.collection("b2b_codes").where("orderId", "==", orderId).get();
      return { ok: true, replayed: true, orgCode: order.orgCode, codesIssued: order.codesIssued,
        codes: existing.docs.map(d => d.data()).filter(c => c.status !== "revoked").map(c => c.code),
        orderNumber: order.orderNumber, contactEmail: order.contactEmail,
        emailSent: order.codesEmailAccepted === true };
    }
    const orgCode = order.orgCode;
    const seats = order.seats;
    const codes = order.issuancePlan;
    const batchSize = 400;
    let writtenCount = order.codesIssued;
    try {
      for (let i = writtenCount; i < seats; i += batchSize) {
        const stop = Math.min(i + batchSize, seats);
        await db.runTransaction(async (tx) => {
          const [current, job] = await Promise.all([tx.get(orderRef), tx.get(jobRef)]);
          const value = current.data();
          if (!current.exists || !["quote_requested", "payment_reported"].includes(value.status) || job.data()?.lease?.id !== leaseId) {
            throw new HttpsError("aborted", "주문 처리 상태가 변경되었습니다. 주문 상태를 다시 확인해주세요.");
          }
          if (value.codesIssued >= stop) return;
          if (value.codesIssued !== i) throw new HttpsError("aborted", "발급 진행 상태를 다시 확인해주세요.");
          for (let index = i; index < stop; index++) {
            const codeRef = db.collection("b2b_codes").doc(`${orderId}_${String(index).padStart(5, "0")}`);
            tx.create(codeRef, {
              code: codes[index], orgCode, orderId, orgName: order.orgName,
              status: "unused", usedByUid: null, usedByEmail: null, usedAt: null,
              hasDiary: index < (order.diaryCount || 0), issuanceIndex: index,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          tx.update(jobRef, { lease: { id: leaseId, expiresAt: Date.now() + leaseMs } });
          tx.update(orderRef, { codesIssued: stop,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        writtenCount = stop;
      }
      await db.runTransaction(async (tx) => {
        const [current, job] = await Promise.all([tx.get(orderRef), tx.get(jobRef)]);
        const value = current.data();
        if (!current.exists || !["quote_requested", "payment_reported"].includes(value.status) || job.data()?.lease?.id !== leaseId || value.codesIssued !== seats) {
          throw new HttpsError("aborted", "발급 완료 상태를 확인할 수 없습니다. 다시 시도해주세요.");
        }
        tx.update(jobRef, { lease: null });
        tx.update(orderRef, { status: "active", issuanceStatus: "complete",
          approvedAt: admin.firestore.FieldValue.serverTimestamp(), approvedByUid: request.auth.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
    } catch (error) {
      try {
        await db.runTransaction(async (tx) => {
          const job = await tx.get(jobRef);
          if (job.exists && job.data().lease?.id === leaseId) {
            tx.update(jobRef, { lease: null });
            tx.update(orderRef, { issuanceStatus: "retry_required",
              updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          }
        });
      } catch (_) { /* Expiring lease permits recovery even if cleanup fails. */ }
      throw error;
    }

    logger.info("[b2b-group] 주문 승인 + 코드 발급 완료", {
      orderId, orgCode, seats, codesIssued: writtenCount,
    });

    // Initial delivery and resend use the same contract-aligned template.
    const apiKey = getResendApiKey();
    const mail = await buildB2BCodesEmail(order, codes, null);
    const userResult = await sendResendEmail({ apiKey, to: mail.to, replyTo: mail.replyTo,
      subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments,
      tag: "b2b-group-codes-issued", idempotencyKey: `b2b-code-issue-${orderId}` });

    try {
      await orderRef.update({ codesEmailAccepted: !!userResult.ok,
        codesEmailMessageId: userResult.messageId || null,
        codesEmailAttemptedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      logger.warn("[b2b-group] 코드 메일 발송 결과 기록 실패", { orderId, error: String(error) });
    }

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

// One code owns one result reservation. These helpers only operate on the
// authenticated participant's pinned SID. Never scan or clean customer history.
function b2bReportReady(value) {
  const sections = value && ((value.report && value.report.sections) || value.sections);
  return !!(value && ((typeof value.manualOverrideHtml === "string" && value.manualOverrideHtml.trim()) ||
    (sections && typeof sections === "object" && !Array.isArray(sections) && Object.keys(sections).length)));
}

async function finalizeB2BReport(uid, linked, codeRef, body) {
  const sid = linked.surveySid;
  const rtdb = admin.database();
  const reportRef = rtdb.ref(`reports/${uid}/${sid}`);
  // Reserve BEFORE writing RTDB. A partial failure never releases or moves it.
  const state = await admin.firestore().runTransaction(async tx => {
    const snap = await tx.get(codeRef);
    const code = snap.data();
    if (!snap.exists || code.status !== "used" || code.usedByUid !== uid || code.surveySid !== sid ||
        (code.resultSid && code.resultSid !== sid)) {
      throw new HttpsError("failed-precondition", "단체 결과 연결 확인이 필요합니다.");
    }
    if (!code.resultSid) tx.update(codeRef, { resultSid: sid, resultState: "reserved" });
    return code.resultState;
  });
  let stored = (await reportRef.get()).val();
  if (!b2bReportReady(stored)) {
    if (stored !== null || state === "complete") {
      throw new HttpsError("failed-precondition", "기존 단체 결과를 보존했습니다. 결과 확인이 필요하며 새 진단은 만들지 않습니다.");
    }
    const session = (await rtdb.ref(`responses/${uid}/${sid}`).get()).val();
    if (!session || !["submitted", "completed"].includes(session.status) ||
        session.meta?.source !== "b2b" || session.meta?.b2bOrderId !== linked.orderId) {
      throw new HttpsError("failed-precondition", "연결된 단체 진단의 제출 완료를 확인해주세요.");
    }
    if (!body || !body.report || typeof body.report !== "object" || Array.isArray(body.report) ||
        !body.report.sections || typeof body.report.sections !== "object" || Array.isArray(body.report.sections) ||
        !Object.keys(body.report.sections).length || Buffer.byteLength(JSON.stringify(body), "utf8") > 750000) {
      throw new HttpsError("invalid-argument", "저장할 단체 리포트가 올바르지 않습니다.");
    }
    // Only known result fields, never client paths/UIDs or manual overrides.
    const next = { sid, generatedAt: admin.database.ServerValue.TIMESTAMP,
      lastEditedAt: admin.database.ServerValue.TIMESTAMP, editCount: 0, manualReportStatus: "auto" };
    for (const key of ["engineVersion", "rulesVersion", "toneKey", "pdfFilename", "lang", "_v4Applied", "_v4ApplyError"]) {
      if (body[key] !== undefined && body[key] !== null) next[key] = body[key];
    }
    next.report = { ...body.report, _participation: { source: "b2b", orderId: linked.orderId } };
    const saved = await reportRef.transaction(current => current === null ? next : undefined);
    stored = saved.snapshot.val();
    if (!b2bReportReady(stored)) throw new HttpsError("failed-precondition", "기존 결과 확인이 필요합니다. 덮어쓰지 않았습니다.");
  }
  const report = stored.report || stored, profile = report.profile || {};
  await rtdb.ref(`users/${uid}/reports/${sid}`).transaction(current => ({
    ...(current || {}), sid,
    generatedAt: current?.generatedAt || stored.generatedAt || report.generatedAt || Date.now(),
    toneKey: stored.toneKey || report.tone?.key || current?.toneKey || null,
    name: profile.name || current?.name || "", submittedAt: profile.submittedAt || current?.submittedAt || stored.generatedAt || Date.now(),
    lang: stored.lang || report.lang || current?.lang || "ko"
  }));
  await admin.firestore().runTransaction(async tx => {
    const snap = await tx.get(codeRef), code = snap.data();
    if (!snap.exists || code.usedByUid !== uid || code.surveySid !== sid || code.resultSid !== sid) {
      throw new HttpsError("failed-precondition", "단체 결과 연결이 변경되었습니다.");
    }
    if (code.resultState !== "complete") tx.update(codeRef, {
      resultState: "complete", resultCompletedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  // Merge only: a reconnect must not erase this completion marker.
  await rtdb.ref(`b2b_access/${uid}`).update({ surveySid: sid, reportSid: sid });
  return { sid, stored };
}

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

    let orgCode = sanitizeStr(request.data && request.data.orgCode, 50).toUpperCase();
    let accessCode = sanitizeStr(request.data && request.data.accessCode, 20).toUpperCase();
    const reportAction = request.data && request.data.reportAction;
    if (reportAction && !["read", "finalize"].includes(reportAction)) {
      throw new HttpsError("invalid-argument", "지원하지 않는 단체 결과 요청입니다.");
    }
    const resumeSurvey = !!reportAction || (request.data && request.data.resumeSurvey === true);
    if (resumeSurvey) {
      // Server-owned link only: never accept a client-provided UID/order/session.
      const existingLink = await admin.firestore().collection("b2b_user_links").doc(request.auth.uid).get();
      if (!existingLink.exists) throw new HttpsError("failed-precondition", "이 계정에 연결된 단체 참여 코드가 없습니다.");
      orgCode = existingLink.data().orgCode;
      accessCode = existingLink.data().accessCode;
    }
    if (!orgCode || !accessCode) {
      throw new HttpsError("invalid-argument", "조직 ID와 Access Code를 모두 입력해주세요.");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;

    const linkRef = db.collection("b2b_user_links").doc(uid);
    // Include a previously used code so its owner can safely retry after a lost response.
    const codeSnap = await db.collection("b2b_codes")
      .where("orgCode", "==", orgCode)
      .where("code", "==", accessCode)
      .limit(2)
      .get();

    if (codeSnap.empty) {
      throw new HttpsError(
        "not-found",
        "유효하지 않은 코드입니다. 조직 ID와 Access Code를 다시 확인해주세요."
      );
    }

    if (codeSnap.size !== 1) {
      throw new HttpsError("failed-precondition", "코드 기록을 확인해야 합니다. 단체 담당자에게 문의해주세요.");
    }
    const codeDoc = codeSnap.docs[0];
    const codeData = codeDoc.data();
    const orderRef = db.collection("b2b_orders").doc(codeData.orderId);
    // User link, code and order are read in the same transaction. Concurrent
    // requests by one UID cannot consume two seats or overwrite a prior link.
    const linked = await db.runTransaction(async (tx) => {
      const [fresh, previous, orderSnap] = await Promise.all([
        tx.get(codeDoc.ref), tx.get(linkRef), tx.get(orderRef),
      ]);
      if (!fresh.exists || !orderSnap.exists) throw new HttpsError("not-found", "코드 또는 주문을 찾을 수 없습니다.");
      const code = fresh.data(), order = orderSnap.data();
      if (code.orgCode !== orgCode || code.code !== accessCode || code.orderId !== codeData.orderId) {
        throw new HttpsError("failed-precondition", "코드 정보가 변경되었습니다. 다시 확인해주세요.");
      }
      if (previous.exists) {
        const link = previous.data();
        if (link.codeId !== codeDoc.id || link.orgCode !== orgCode || link.accessCode !== accessCode || code.status !== "used" || code.usedByUid !== uid) {
          throw new HttpsError("already-exists", "이 계정에는 다른 참여 코드가 연결되어 있습니다. 기존 계정의 진단 또는 단체 담당자를 확인해주세요.");
        }
        // A partial refund revokes only unused codes. Preserve existing used seats.
        if (!["active", "refunded"].includes(order.status) && !(order.status === "cancelled" && order.cancelPreserveUsedSeats === true)) {
          throw new HttpsError("failed-precondition", "이용 가능한 주문 상태가 아닙니다. 담당자에게 문의해주세요.");
        }
        if (resumeSurvey && !link.surveySid) {
          // Historical links without an attributable SID need review, not a new diagnosis.
          throw new HttpsError("failed-precondition", "과거 단체 진단 연결 확인이 필요합니다. 새 진단이나 추가 결제를 진행하지 마세요.");
        }
        if (link.surveySid) {
          if ((code.surveySid && code.surveySid !== link.surveySid) ||
              (code.resultSid && code.resultSid !== link.surveySid)) {
            throw new HttpsError("failed-precondition", "코드의 기존 진단 연결을 확인해야 합니다.");
          }
          if (!code.surveySid) tx.update(codeDoc.ref, { surveySid: link.surveySid });
        }
        return { ...link, resultState: code.resultState || null, sessionInitialized: code.sessionInitialized === true };
      }
      if (order.status !== "active" || (order.orgCode && order.orgCode !== orgCode)) {
        throw new HttpsError("failed-precondition", "아직 이용 가능한 주문이 아닙니다. 단체 담당자에게 확인해주세요.");
      }
      if (code.status !== "unused") throw new HttpsError("already-exists", "이미 사용되었거나 무효화된 코드입니다.");
      const link = { orgCode, accessCode, codeId: codeDoc.id, orderId: code.orderId,
        orgName: code.orgName, hasDiary: !!code.hasDiary,
        surveySid: `s_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
        linkedAt: admin.firestore.FieldValue.serverTimestamp() };
      tx.update(codeDoc.ref, { status: "used", usedByUid: uid, surveySid: link.surveySid,
        usedByEmail: request.auth.token.email || null,
        usedAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.create(linkRef, link);
      tx.update(orderRef, { codesUsed: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return link;
    });

    // Firestore is authoritative, but survey entry requires the RTDB mirror.
    // Do not report success until that mirror exists; a retry repairs the same seat.
    try {
      await admin.database().ref(`b2b_access/${uid}`).update({
        orgCode: linked.orgCode, orderId: linked.orderId, orgName: linked.orgName,
        hasDiary: !!linked.hasDiary, linkedAt: admin.database.ServerValue.TIMESTAMP,
        ...(linked.surveySid ? { surveySid: linked.surveySid } : {}),
      });
    } catch (e) {
      logger.warn("[b2b-group] 진단 권리 동기화 재시도 필요", { uid, err: String(e) });
      throw new HttpsError("unavailable", "참여 코드는 계정에 안전하게 연결됐지만 진단 준비가 지연되고 있습니다. 같은 계정과 코드로 다시 시도해주세요. 다른 코드를 사용하거나 재결제하지 마세요.");
    }

    let survey = null;
    if (resumeSurvey) {
      if (!/^s_[0-9]+_[a-z0-9]+$/i.test(linked.surveySid || "")) {
        throw new HttpsError("failed-precondition", "단체 진단 연결 기록을 확인해야 합니다.");
      }
      if (reportAction && request.data.sid !== linked.surveySid) {
        throw new HttpsError("permission-denied", "이 코드는 연결된 진단의 리포트 한 부만 제공합니다.");
      }
      const existingReport = (await admin.database().ref(`reports/${uid}/${linked.surveySid}`).get()).val();
      if (b2bReportReady(existingReport) || reportAction === "finalize") {
        const result = await finalizeB2BReport(uid, linked, codeDoc.ref, request.data.body);
        return { ok: true, reportSid: result.sid, stored: result.stored,
          survey: { sid: result.sid, data: { status: "completed", meta: { source: "b2b", b2bOrderId: linked.orderId } } } };
      }
      if (linked.resultState === "complete" || existingReport !== null) {
        throw new HttpsError("failed-precondition", "기존 단체 결과 확인이 필요합니다. 새 결과는 만들지 않습니다.");
      }
      if (reportAction === "read") return { ok: true, reportSid: null, surveySid: linked.surveySid };
      try {
        const sessionRef = admin.database().ref(`responses/${uid}/${linked.surveySid}`);
        // An initialized session is read-only here. RTDB transaction callbacks
        // can first see a cold-cache null, so do not infer deletion inside one.
        const snapshot = linked.sessionInitialized ? await sessionRef.get() :
          (await sessionRef.transaction(current => current || { status: "in_progress",
            startedAt: admin.database.ServerValue.TIMESTAMP, meta: { step: 0, source: "b2b", b2bOrderId: linked.orderId } })).snapshot;
        const session = snapshot.val();
        if (!session || session.meta?.source !== "b2b" || session.meta?.b2bOrderId !== linked.orderId) {
          throw new HttpsError("failed-precondition", "단체 진단의 주문 연결이 일치하지 않습니다. 기존 응답은 변경하지 않았습니다.");
        }
        await codeDoc.ref.update({ sessionInitialized: true });
        survey = { sid: linked.surveySid, data: session };
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("unavailable", "단체 진단 준비가 지연되고 있습니다. 같은 계정에서 다시 시도해주세요. 새 결제는 필요하지 않습니다.");
      }
    }

    logger.info("[b2b-group] Access Code 사용 완료", {
      uid, orgCode, codeId: codeDoc.id, orderId: codeData.orderId,
    });

    return {
      ok: true,
      orgName: codeData.orgName,
      hasDiary: !!codeData.hasDiary,
      ...(survey ? { survey } : {}),
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
        unitPrice: o.unitPrice || 0,
        cancelPreviousStatus: o.cancelPreviousStatus || null,
        cancelCleanupStatus: o.cancelCleanupStatus || null,
        refundCleanupStatus: o.refundCleanupStatus || null,
        refundAmount: o.refundAmount ?? null,
        cancelNoticeStatus: o.cancelNoticeStatus || null,
        refundNoticeStatus: o.refundNoticeStatus || null,
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

    // [진행현황 강화 · 관리자 전용] 가입자별 "검사 완료 여부"를 함께 산출.
    // ⚠️ 완료 여부(true/false)만 — 리포트 내용/점수는 일절 조회하지 않음.
    //    이 정보는 운영자(관리자) 화면 전용이며, 고객사 담당자에게 개인별로 노출하지 않는다.
    const usedDocs = codesSnap.docs.filter((d) => d.data() && d.data().usedByUid);
    const completedMap = {};
    await Promise.all(usedDocs.map(async (d) => {
      const uid = d.data().usedByUid;
      try {
        const snap = await admin.database().ref(`users/${uid}/reports`).get();
        completedMap[uid] = snap.exists() && snap.hasChildren();
      } catch (e) {
        completedMap[uid] = false;
      }
    }));

    const codes = codesSnap.docs.map((d) => {
      const c = d.data();
      return {
        code: c.code,
        status: c.status,
        usedByEmail: c.usedByEmail || null,
        hasDiary: !!c.hasDiary,
        // 개인별 검사 완료 여부 (관리자 전용). 미사용 코드는 null.
        completed: c.usedByUid ? !!completedMap[c.usedByUid] : null,
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
// [7] resendB2BCodesEmail — 관리자가 담당자에게 코드 메일을 "다시 발송"
// ─────────────────────────────────────────────────────────────────────────────
// b2b-admin.html "고객에게 코드 메일 발송" 버튼이 호출.
//   - 발급 시점의 메일을 그대로 재발송 (엑셀 .xlsx 첨부 = 현재 코드 상태 반영)
//   - 클립보드 복사가 아니라 실제 Resend 메일 발송
//   - 관리자 전용. 개인별 리포트 내용은 일절 포함하지 않음.
// 주문 + 코드 + 상태를 함께 로드 (자동/수동 발송 공통)
async function loadB2BOrderAndCodes(request) {
  if (!isAdmin(request)) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
  const orderId = sanitizeStr(request.data && request.data.orderId, 100);
  if (!orderId) throw new HttpsError("invalid-argument", "주문 ID가 필요합니다.");

  const db = admin.firestore();
  const orderSnap = await db.collection("b2b_orders").doc(orderId).get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
  const order = orderSnap.data();
  if (order.status !== "active") {
    throw new HttpsError("failed-precondition", "승인(코드 발급)된 주문만 발송할 수 있습니다.");
  }

  const codesSnap = await db.collection("b2b_codes")
    .where("orderId", "==", orderId)
    .get();
  if (codesSnap.empty) {
    throw new HttpsError("not-found", "발급된 코드가 없습니다.");
  }

  const codeDocs = codesSnap.docs.map((d) => d.data())
    .filter((c) => ["unused", "used"].includes(c.status) && typeof c.code === "string" && c.code)
    .sort((a, b) => (a.issuanceIndex ?? 0) - (b.issuanceIndex ?? 0) || a.code.localeCompare(b.code));
  const codes = codeDocs.map((c) => c.code);
  if (!codes.length) throw new HttpsError("not-found", "유효한 코드가 없습니다.");
  const statusByCode = {};
  codeDocs.forEach((c) => {
    if (c.code) statusByCode[c.code] = (c.status === "used") ? "사용" : "미사용";
  });
  const diaryByCode = Object.fromEntries(codeDocs.map((c) => [c.code, !!c.hasDiary]));
  return { orderId, order: { ...order, diaryByCode }, codes, statusByCode };
}

const resendB2BCodesEmail = onCall(
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 60, secrets: [RESEND_API_KEY] },
  async (request) => {
    let stage = "init";
    let orderId = "";
    try {
      stage = "load-order";
      const loaded = await loadB2BOrderAndCodes(request);
      orderId = loaded.orderId;
      const { order, codes, statusByCode } = loaded;

      stage = "check-resend-key";
      const apiKey = getResendApiKey();
      if (!apiKey) {
        logger.error("[b2b-group] RESEND_API_KEY 미설정 — 자동 발송 불가", { orderId });
        throw new HttpsError("failed-precondition",
          "RESEND_API_KEY가 설정되지 않아 자동 발송이 불가합니다. '수동 발송 준비'로 직접 발송해주세요.");
      }

      stage = "build-email";
      const mail = await buildB2BCodesEmail(order, codes, statusByCode);

      stage = "send";
      const result = await sendResendEmail({
        apiKey,
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
        tag: "b2b-group-codes-resent",
      });

      try {
        await admin.firestore().collection("b2b_orders").doc(orderId).update({
          codesEmailLastResendStatus: result.deliveryStatus,
          codesEmailLastResendMessageId: result.messageId || null,
          codesEmailLastResendAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        logger.warn("[b2b-group] 코드 재발송 결과 기록 실패", { orderId, err: String(e) });
      }
      if (result.deliveryStatus === "unknown") {
        throw new HttpsError("unavailable", "메일 발송 결과를 확인하지 못했습니다. 실제 발송됐을 수 있으므로 메일 서비스 기록과 수신함을 확인한 뒤 재발송 여부를 결정해주세요.");
      }
      if (!result.ok) {
        logger.error("[b2b-group] 코드 발송 메일 실패", { orderId, reason: result });
        // 실패 사유를 클라이언트에 노출 (수동 발송 안내용)
        const why = result.reason === "missing_resend_key"
          ? "RESEND_API_KEY 미설정"
          : (result.status ? `Resend 응답 코드 ${result.status}` : (result.err || "알 수 없는 오류"));
        throw new HttpsError("internal",
          `메일 발송 실패 (${why}). '수동 발송 준비' 버튼으로 직접 발송해주세요.`);
      }

      logger.info("[b2b-group] 코드 메일 API 접수", { orderId, messageId: result.messageId, codes: codes.length });
      return {
        ok: true,
        emailStatus: result.deliveryStatus,
        messageId: result.messageId,
        sentTo: mail.to,
        codesIssued: codes.length,
        orderNumber: order.orderNumber,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      // 예상치 못한 예외 → 정확한 단계/메시지를 노출 (raw 'internal' 방지)
      logger.error("[b2b-group] resendB2BCodesEmail 예외", { orderId, stage, err: String(e), stack: e && e.stack });
      throw new HttpsError("internal", `메일 발송 처리 중 오류 (단계: ${stage}). '수동 발송 준비'로 직접 발송해주세요.`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [7-2] getB2BCodesEmailDraft — 수동 발송용 "초안" 생성 (발송하지 않음)
//   - 자동 발송과 100% 동일한 제목/HTML/텍스트/엑셀(.xlsx) 첨부를 생성해 반환
//   - 운영자가 직접 자신의 메일 클라이언트로 발송할 수 있도록 지원
//   - RESEND_API_KEY 없이도 동작 (메일을 보내지 않으므로)
// ─────────────────────────────────────────────────────────────────────────────
const getB2BCodesEmailDraft = onCall(
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    let stage = "init";
    let orderId = "";
    try {
      stage = "load-order";
      const loaded = await loadB2BOrderAndCodes(request);
      orderId = loaded.orderId;
      const { order, codes, statusByCode } = loaded;

      stage = "build-email";
      const mail = await buildB2BCodesEmail(order, codes, statusByCode);

      logger.info("[b2b-group] 코드 메일 초안 생성(수동 발송용)", { orderId, codes: codes.length });
      return {
        ok: true,
        to: mail.to,
        replyTo: mail.replyTo,
        from: mail.from,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        xlsxFileName: mail.xlsxFileName,
        xlsxBase64: mail.xlsxBase64,
        codesIssued: codes.length,
        orderNumber: order.orderNumber,
        orgName: order.orgName,
        contactName: order.contactName || "",
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error("[b2b-group] getB2BCodesEmailDraft 예외", { orderId, stage, err: String(e), stack: e && e.stack });
      throw new HttpsError("internal", `초안 생성 중 오류 (단계: ${stage}).`);
    }
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
// [헬퍼] computeB2BProgress — 특정 주문의 진행 단계 집계
//   반환: { codesIssued, joined, completed, notStarted, joinedNotDone }
//   ⚠️ 개인 식별정보·리포트 내용은 일절 반환하지 않음. 순수 "단계별 인원수"만.
//   - joined    = 코드 사용(가입) 수 = b2b_codes status==='used' 개수
//   - completed = 가입자 중 검사 리포트를 1건 이상 생성한 인원수
//                 (리포트 "존재 여부"만 카운트, 내용은 열람하지 않음 → 본인만 확인 원칙 유지)
//   완료 판정은 RTDB users/{uid}/reports 인덱스(경량 노드) 존재 여부로 확인.
//   소규모(수십~수백명) 조직 기준으로 설계. 매우 큰 조직은 추후 캐싱으로 확장 가능.
// ─────────────────────────────────────────────────────────────────────────────
async function computeB2BProgress(orderId, codesIssuedHint) {
  const db = admin.firestore();
  // 가입(사용)된 코드만 조회 — usedByUid 수집
  const usedSnap = await db.collection("b2b_codes")
    .where("orderId", "==", orderId)
    .where("status", "==", "used")
    .get();

  const uids = [];
  usedSnap.forEach((d) => {
    const u = d.data() && d.data().usedByUid;
    if (u) uids.push(u);
  });

  const joined = usedSnap.size;

  // 완료 카운트: 각 가입자 uid의 reports 인덱스 존재 여부 (병렬, 실패는 미완료 취급)
  let completed = 0;
  if (uids.length) {
    const checks = await Promise.all(uids.map(async (uid) => {
      try {
        const snap = await admin.database().ref(`users/${uid}/reports`).get();
        return snap.exists() && snap.hasChildren();
      } catch (e) {
        logger.warn("[b2b-group] 완료여부 조회 실패(미완료 처리)", { uid, err: String(e) });
        return false;
      }
    }));
    completed = checks.filter(Boolean).length;
  }

  const codesIssued = typeof codesIssuedHint === "number" ? codesIssuedHint : 0;
  const notStarted = Math.max(0, codesIssued - joined);   // 코드 받았으나 가입 안 함
  const joinedNotDone = Math.max(0, joined - completed);  // 가입했으나 검사 미완료

  return { codesIssued, joined, completed, notStarted, joinedNotDone };
}

// ─────────────────────────────────────────────────────────────────────────────
// [lookupB2BOrder] 고객사 담당자가 본인 주문 진행 현황 조회 (공개, 이메일+주문번호 매칭)
// ─────────────────────────────────────────────────────────────────────────────
const lookupB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    // 주문번호+이메일 brute-force 방어 (공개 엔드포인트)
    await checkCallableRateLimit(request, "lookupB2BOrder", {
      perMinute: 5,
      perHour: 30,
    });

    const orderNumber = sanitizeStr(request.data && request.data.orderNumber, 32).toUpperCase();
    const contactEmail = sanitizeStr(request.data && request.data.contactEmail, 120).toLowerCase();

    if (!orderNumber || !/^LP-\d{6}-(?:\d{4}|[A-F0-9]{12})$/.test(orderNumber)) {
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

    // 진행 단계 집계 (active 주문 = 코드 발급 완료된 경우에만 계산).
    // ⚠️ 개인 식별정보·리포트 내용 없이 "단계별 인원수"만 산출 → 본인만 확인 원칙 유지.
    let progress = null;
    if (order.status === "active") {
      try {
        progress = await computeB2BProgress(doc.id, order.codesIssued || 0);
      } catch (e) {
        logger.warn("[b2b-group] 진행현황 집계 실패(생략)", { orderId: doc.id, err: String(e) });
        progress = null;
      }
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
      // [진행현황 강화] 단계별 인원수 집계 (개인정보 없음). active가 아니면 null.
      progress: progress,
      depositorName: order.depositorName || null,
      createdAt: order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toISOString() : null,
      updatedAt: order.updatedAt && order.updatedAt.toDate ? order.updatedAt.toDate().toISOString() : null,
      cancelledAt: order.cancelledAt && order.cancelledAt.toDate ? order.cancelledAt.toDate().toISOString() : null,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [cancelB2BOrder] 운영자 — 신규 사용 중단; 기존 사용 좌석/고객 자료 보존
// ─────────────────────────────────────────────────────────────────────────────
// Close the order first: approval, redemption and regeneration transactions all
// read this same document. No new seat can be claimed after the close commits.
// Cleanup is bounded and resumable; never mutate used codes, links or RTDB data.
async function finishOrderClosure(docRef, kind, status) {
  const db = admin.firestore();
  const stateKey = `${kind}CleanupStatus`, countKey = `${kind}CodesRevoked`;
  for (;;) {
    const done = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      const order = snap.data();
      if (!snap.exists || order.status !== status) {
        throw new HttpsError("failed-precondition", "주문 상태가 변경되었습니다. 새로고침해주세요.");
      }
      if (order[stateKey] !== "pending") return true;
      const codes = await tx.get(db.collection("b2b_codes")
        .where("orderId", "==", docRef.id).where("status", "==", "unused").limit(400));
      for (const code of codes.docs) tx.update(code.ref, {
        status: "revoked", revokedReason: kind,
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(docRef, {
        [countKey]: (order[countKey] || 0) + codes.size,
        [stateKey]: codes.empty ? "complete" : "pending",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return codes.empty;
    });
    if (done) return;
  }
}

// Claim once before the external side effect. A crash/unknown provider response
// is NOT retried automatically (also safe beyond provider idempotency expiry).
async function sendClosureNotice(docRef, kind, mail) {
  const db = admin.firestore(), key = `${kind}NoticeStatus`;
  const claimed = await db.runTransaction(async tx => {
    const order = (await tx.get(docRef)).data();
    if (order[key] !== "pending") return false;
    tx.update(docRef, { [key]: "unknown" });
    return true;
  });
  if (!claimed) return;
  const result = await sendResendEmail({ ...mail, idempotencyKey: `b2b-${kind}-${docRef.id}` });
  try {
    await docRef.update({ [key]: result.deliveryStatus,
      [`${kind}NoticeMessageId`]: result.messageId || null });
  } catch (e) {
    logger.warn("[b2b-group] 종료 안내 접수 결과 기록 실패", { orderId: docRef.id, kind });
  }
}

const cancelB2BOrder = onCall(
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!isAdmin(request)) throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const requestedReason = sanitizeStr(request.data && request.data.reason, 200);
    if (!orderId || orderId.includes("/") || !requestedReason) {
      throw new HttpsError("invalid-argument", "주문 ID와 취소 사유가 필요합니다.");
    }
    const db = admin.firestore(), docRef = db.collection("b2b_orders").doc(orderId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
      const value = snap.data();
      if (value.status === "cancelled") return; // Do not rewrite historical cancellations.
      if (!["quote_requested", "payment_reported", "active"].includes(value.status)) {
        throw new HttpsError("failed-precondition", "취소할 수 없는 주문 상태입니다.");
      }
      tx.update(docRef, {
        status: "cancelled", cancelPreviousStatus: value.status,
        cancelPreserveUsedSeats: true, cancelCleanupStatus: "pending", cancelCodesRevoked: 0,
        cancelNoticeStatus: "pending", cancelReason: requestedReason,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: request.auth.token.email || request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await finishOrderClosure(docRef, "cancel", "cancelled");
    const order = (await docRef.get()).data();
    const reason = order.cancelReason || requestedReason;

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
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">미사용 코드의 신규 사용은 중단됩니다. 이미 연결된 참여자의 이용권·응답·리포트는 보존됩니다. 이 취소 처리는 환불 또는 실제 송금이 아닙니다. 입금 내역과 환불은 운영자가 별도로 확인합니다.</p>
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">재신청이 필요하시면 <a href="https://lifeportfolio.co.kr/b2b-quote" style="color:#2563EB">새 견적 신청</a>을 부탁드립니다.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    await sendClosureNotice(docRef, "cancel", {
      apiKey, to: order.contactEmail, replyTo: ADMIN_EMAIL, subject, html,
      text: `${order.orderNumber} 주문이 취소되었습니다.\n사유: ${reason}\n금액: ${formatWon(order.totalAmount)}\n미사용 코드 신규 사용 중단. 기존 참여자 이용권·응답·리포트 보존. 환불 또는 실제 송금은 별도 확인이 필요합니다.\n재신청: https://lifeportfolio.co.kr/b2b-quote`,
      tag: "b2b-group-cancelled",
    });
    const latest = (await docRef.get()).data();
    return { ok: true, orderNumber: order.orderNumber, status: latest.status,
      codesRevoked: latest.cancelCodesRevoked || 0,
      emailStatus: latest.cancelNoticeStatus || "unknown" };

  }
);

// ─────────────────────────────────────────────────────────────────────────────
// [refundB2BOrder] 운영자 — 환불 처리 (active 상태도 가능)
// ─────────────────────────────────────────────────────────────────────────────
const refundB2BOrder = onCall(
  // PR#138-fix: timeout 30→120s for large orders (e.g. 2,000 codes), memory 256→512 for batched writes
  { region: "asia-northeast3", cors: true, memory: "512MiB", timeoutSeconds: 120, secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!isAdmin(request)) throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    const orderId = sanitizeStr(request.data && request.data.orderId, 100);
    const requestedReason = sanitizeStr(request.data && request.data.reason, 200);
    const amount = request.data && request.data.refundAmount;
    const refundAmount = amount == null ? 0 : amount;
    if (!orderId || orderId.includes("/") || !requestedReason || !Number.isSafeInteger(refundAmount) || refundAmount < 0) {
      throw new HttpsError("invalid-argument", "주문 ID, 사유와 올바른 환불 금액이 필요합니다.");
    }
    const db = admin.firestore(), docRef = db.collection("b2b_orders").doc(orderId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new HttpsError("not-found", "주문을 찾을 수 없습니다.");
      const value = snap.data();
      if (value.status === "refunded") return;
      const cancelledPaid = value.status === "cancelled" && value.cancelCleanupStatus === "complete" &&
        ["payment_reported", "active"].includes(value.cancelPreviousStatus);
      if (!["payment_reported", "active"].includes(value.status) && !cancelledPaid) {
        throw new HttpsError("failed-precondition", "입금 신고·승인 주문만 환불 기록할 수 있습니다. 취소 정리 중이면 먼저 취소를 재시도해주세요.");
      }
      const suggestion = calcRefundSuggestion(value);
      const finalAmount = refundAmount > 0 ? refundAmount : suggestion.suggested;
      if (!Number.isSafeInteger(finalAmount) || finalAmount < 0 || finalAmount > value.totalAmount) {
        throw new HttpsError("invalid-argument", "환불 금액은 원 결제 금액을 넘을 수 없습니다.");
      }
      tx.update(docRef, {
        status: "refunded", refundReason: requestedReason, refundAmount: finalAmount,
        refundBasis: refundAmount > 0 ? `운영자 직접 입력 (${formatWon(finalAmount)})` : suggestion.basis,
        refundCleanupStatus: "pending", refundCodesRevoked: 0, refundNoticeStatus: "pending",
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedBy: request.auth.token.email || request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await finishOrderClosure(docRef, "refund", "refunded");
    const order = (await docRef.get()).data();
    const reason = order.refundReason, finalRefund = order.refundAmount, refundBasis = order.refundBasis;
    const revokedCount = (order.cancelCodesRevoked || 0) + (order.refundCodesRevoked || 0);

    // 고객에게 환불 안내 메일
    const apiKey = getResendApiKey();
    const subject = `[인생포트폴리오] ${order.orderNumber} 환불 기록 안내`;
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:'Pretendard',-apple-system,sans-serif;color:#1a2b4a;line-height:1.7">
<table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf7;padding:28px 12px">
  <tr><td align="center">
    <table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.16)">
      <tr><td style="background:#1a2b4a;padding:20px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;color:#c9a961;letter-spacing:1.5px;margin-bottom:4px">REFUND PROCESSED</div>
        <h2 style="margin:0;font-size:18px;font-weight:800">${escHtml(order.orderNumber)} · 환불 기록 안내</h2>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 14px;font-size:14.5px">${escHtml(order.contactName)} 담당자님, 안녕하세요.</p>
        <p style="margin:0 0 14px;font-size:14.5px"><strong>${escHtml(order.orgName)}</strong>의 주문(<strong>${escHtml(order.orderNumber)}</strong>) 환불 금액이 운영자에 의해 기록되었습니다. 실제 송금 완료를 의미하지 않습니다.</p>
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;margin-top:14px;background:#fafaf7;padding:14px;border-radius:8px">
          <tr><td style="padding:5px 0;color:#64748B;width:120px">원 결제 금액</td><td style="padding:5px 0">${formatWon(order.totalAmount)} <span style="color:#94a3b8;font-size:12px">(부가세 포함)</span></td></tr>
          <tr><td style="padding:5px 0;color:#64748B">환불 금액</td><td style="padding:5px 0;font-weight:700;color:#16a34a;font-size:16px">${formatWon(finalRefund)} <span style="color:#94a3b8;font-size:12px;font-weight:400">(부가세 포함)</span></td></tr>
          <tr><td style="padding:5px 0;color:#64748B;vertical-align:top">산정 기준</td><td style="padding:5px 0;color:#525252;font-size:13px;line-height:1.6">${escHtml(refundBasis)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748B">환불 사유</td><td style="padding:5px 0">${escHtml(reason)}</td></tr>
          ${revokedCount > 0 ? `<tr><td style="padding:5px 0;color:#64748B">무효화된 코드</td><td style="padding:5px 0;color:#dc2626">${revokedCount}개 (이미 사용된 코드는 유지됨)</td></tr>` : ""}
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:#737373;line-height:1.7">실제 송금 여부와 일정은 운영자에게 별도로 확인해주세요. 이 알림은 송금 완료 확인서가 아닙니다.</p>
        <p style="margin:14px 0 0;font-size:12.5px;color:#a3a3a3;line-height:1.7">B2B 그룹 계약 표준 조건 제9조(환불 및 계약 해지)에 따른 처리입니다.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    await sendClosureNotice(docRef, "refund", {
        apiKey,
        to: order.contactEmail,
        replyTo: ADMIN_EMAIL,
        subject,
        html,
        text: `${order.orderNumber} 환불 기록 안내\n환불 금액: ${formatWon(finalRefund)} (부가세 포함)\n산정 기준: ${refundBasis}\n사유: ${reason}\n\n실제 송금 여부와 일정은 운영자에게 별도로 확인해주세요. 이 알림은 송금 완료 확인서가 아닙니다.\nB2B 그룹 계약 표준 조건 제9조에 따른 처리입니다.`,
        tag: "b2b-group-refunded",
    });
    const latest = (await docRef.get()).data();
    return { ok: true, orderNumber: order.orderNumber, status: "refunded", refundAmount: finalRefund,
      codesRevoked: revokedCount, emailStatus: latest.refundNoticeStatus || "unknown" };

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
    await db.runTransaction(async tx => {
    const [freshOrder, freshCode] = await Promise.all([tx.get(orderRef), tx.get(codeRef)]);
    if (freshOrder.data()?.status !== "active" || freshCode.data()?.status !== "unused" || freshCode.data()?.code !== oldCode) {
      throw new HttpsError("failed-precondition", "주문 또는 코드 상태가 변경되었습니다. 새로고침해주세요.");
    }
    tx.update(codeRef, {
      status: "revoked",
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedReason: "regenerated",
      regeneratedAs: newCode,
    });
    const newCodeRef = db.collection("b2b_codes").doc();
    tx.create(newCodeRef, {
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
    });

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
  getB2BCheckoutOrder,
  approveB2BOrder,
  verifyB2BCode,
  getB2BAdminData,
  getB2BOrderCodes,
  resendB2BCodesEmail,
  getB2BCodesEmailDraft,
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
    buildCodesXlsx,
    buildB2BCodesEmail,
  },
};
