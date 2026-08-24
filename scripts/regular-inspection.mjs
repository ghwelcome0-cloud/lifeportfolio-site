#!/usr/bin/env node
// 정기 점검 러너 (Regular Inspection Runner)
//
// 목적
//   웹사이트 정기 점검을 "매번 사람이 기억해서 하는 일"에서
//   "실행하면 결과가 남는 일"로 바꾼다.
//
// 측정 원칙 (배포헌법 v1.0 / 측정 원칙)
//   이 스크립트는 절대로 "통과"를 추정하지 않는다.
//   자동으로 판정할 수 있는 항목만 PASS/FAIL 을 내고,
//   자동 판정이 불가능한 항목은 반드시 MANUAL(미측정) 로 출력한다.
//   MANUAL 항목이 남아 있으면 종료 코드는 2 이며, 이는 "점검 미완료"를 뜻한다.
//   0 = 전 항목 측정 완료 + 결함 없음
//   1 = 결함 발견
//   2 = 자동 항목은 통과했으나 수동 항목이 미측정 상태
//
// 사용법
//   node scripts/regular-inspection.mjs                 # 자동 항목만 측정
//   node scripts/regular-inspection.mjs --manual-log F  # 수동 결과 파일 반영
//   node scripts/regular-inspection.mjs --json          # 기계 판독용 출력

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ORIGIN = process.env.INSPECT_ORIGIN || "https://lifeportfolio.co.kr";
const ADMIN_ORIGIN = process.env.INSPECT_ADMIN_ORIGIN || "";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const manualLogPath = (() => {
  const i = args.indexOf("--manual-log");
  return i >= 0 ? args[i + 1] : null;
})();

const UA_PC =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const results = [];
function record(id, category, name, status, detail) {
  results.push({ id, category, name, status, detail });
}

// ---------------------------------------------------------------------------
// A. 자동 측정 가능 항목
// ---------------------------------------------------------------------------

const CUSTOMER_PATHS = [
  "/", "/product", "/login", "/signup", "/mypage", "/suvey",
  "/report", "/program", "/privacy", "/terms",
  "/b2b", "/b2b-checkout", "/b2b-join", "/b2b-quote", "/checkin-21",
];

// 배포헌법: 민감 경로는 공개 표면에서 404 여야 한다.
const MUST_BE_404 = [
  "/admin", "/b2b-admin", "/checkin-admin", "/review-admin",
  "/lead", "/pdf-sign", "/pdf-sign-share", "/lease-esign",
  "/auth-debug", "/checkin-21-demo",
  "/marketing/achievements", "/assets/signature/seal_kimyoungsik.png",
];

const REQUIRED_HEADERS = [
  "x-frame-options", "x-content-type-options", "referrer-policy",
  "permissions-policy", "strict-transport-security",
  "content-security-policy", "content-security-policy-report-only",
  "reporting-endpoints", "cache-control",
];

async function probe(url, ua) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": ua },
    });
    return { ok: true, status: res.status, headers: res.headers };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkReachability() {
  for (const [label, ua] of [["PC", UA_PC], ["MOBILE", UA_MOBILE]]) {
    const bad = [];
    for (const p of CUSTOMER_PATHS) {
      const r = await probe(`${PUBLIC_ORIGIN}${p}`, ua);
      if (!r.ok || r.status !== 200) bad.push(`${p}=${r.ok ? r.status : r.error}`);
    }
    record(
      `A1-${label}`, "가용성", `고객 경로 ${CUSTOMER_PATHS.length}건 (${label})`,
      bad.length === 0 ? "PASS" : "FAIL",
      bad.length === 0 ? `${CUSTOMER_PATHS.length}/${CUSTOMER_PATHS.length} 200` : bad.join(", "),
    );
  }
}

async function checkSurfaceMinimization() {
  const leaked = [];
  for (const p of MUST_BE_404) {
    const r = await probe(`${PUBLIC_ORIGIN}${p}`, UA_PC);
    if (!r.ok) { leaked.push(`${p}=err`); continue; }
    if (r.status !== 404) leaked.push(`${p}=${r.status}`);
  }
  record(
    "A2", "보안", `민감 경로 ${MUST_BE_404.length}건 공개 차단`,
    leaked.length === 0 ? "PASS" : "FAIL",
    leaked.length === 0 ? "전건 404" : `노출: ${leaked.join(", ")}`,
  );
}

async function checkSecurityHeaders() {
  const r = await probe(`${PUBLIC_ORIGIN}/`, UA_PC);
  if (!r.ok) { record("A3", "보안", "보안 헤더 9종", "FAIL", r.error); return; }
  const missing = REQUIRED_HEADERS.filter((h) => !r.headers.get(h));
  record(
    "A3", "보안", `보안 헤더 ${REQUIRED_HEADERS.length}종`,
    missing.length === 0 ? "PASS" : "FAIL",
    missing.length === 0 ? "전건 존재" : `누락: ${missing.join(", ")}`,
  );
}

function checkBuildContracts() {
  // 공개/운영 게시 계약이 서로 침범하지 않는지 소스 수준에서 확인
  const checks = [
    ["scripts/hosting-allowlist.mjs", "공개 게시 계약 존재"],
    ["scripts/verify-hosting-build.mjs", "공개 검증기 존재"],
    ["scripts/admin-allowlist.mjs", "운영 게시 계약 존재"],
    ["scripts/verify-admin-build.mjs", "운영 검증기 존재"],
  ];
  const missing = checks.filter(([f]) => !fs.existsSync(path.join(ROOT, f)));
  record(
    "A4", "무결성", "게시 계약 4종 파일 존재",
    missing.length === 0 ? "PASS" : "FAIL",
    missing.length === 0 ? "전건 존재" : missing.map(([f]) => f).join(", "),
  );

  // 추적 소스 변경 0건 (배포헌법 제4조)
  let dirty = null;
  try {
    dirty = execFileSync("git", ["status", "--untracked-files=no", "--porcelain"], { cwd: ROOT })
      .toString("utf8").trim();
  } catch { dirty = null; }
  if (dirty !== null) {
    record(
      "A5", "무결성", "추적 소스 변경 0건 (헌법 제4조)",
      dirty === "" ? "PASS" : "FAIL",
      dirty === "" ? "clean" : dirty.split("\n").length + "개 파일 수정됨",
    );
  }
}

// ---------------------------------------------------------------------------
// B. 대표 승인 4항목 — 자동 판정 불가, 반드시 MANUAL 로 남는다
//    (2026-08-24 대표 지시로 정기 점검 항목에 편입)
// ---------------------------------------------------------------------------

const MANUAL_ITEMS = [
  {
    id: "M1",
    category: "결제",
    name: "결제 완주 (Payple KRW / PayPal USD)",
    why: "실제 결제 승인은 실 계좌·실 카드가 필요하며 HTTP 프로브로 대체 불가",
    how: [
      "1) 테스트 계정으로 /product 진입 → 19,900원 상품 1종만 노출되는지 확인",
      "2) Payple(KRW) 결제 완주 → /payment-success 도달 확인",
      "3) RTDB payments/{uid}/paid === true 확인",
      "4) 동일 주문 재시도 → 중복 청구 없이 멱등 처리되는지 확인",
      "5) PayPal(USD) 동일 절차 반복",
      "6) 결제 직후 검사 진입이 무한 루프에 빠지지 않는지 확인 (사고사례 ①)",
    ],
    evidence: "결제사 승인번호 + RTDB paid 스크린샷 + 재시도 결과",
  },
  {
    id: "M2",
    category: "인증",
    name: "로그인 2트랙 대등성 (Google / 이메일)",
    why: "IndexedDB 주 세션 + localStorage 보조 세션 동작은 실제 브라우저에서만 검증됨",
    how: [
      "1) Google 로그인 → 새로고침 후 세션 유지 확인",
      "2) 이메일 로그인 → 새로고침 후 세션 유지 확인",
      "3) 두 트랙 모두 /mypage 접근 가능 여부가 동일한지 확인",
      "4) 시크릿창(IndexedDB 제한) 에서 두 트랙 모두 로그인되는지 확인",
      "5) 로그아웃 후 보호 경로 접근 차단 확인",
      "6) CSP report-only 위반 로그를 로그인 실패로 오인하지 말 것 (사고사례 ③)",
    ],
    evidence: "트랙별 로그인 성공 스크린샷 + 세션 유지 결과 + DevTools 콘솔",
  },
  {
    id: "M3",
    category: "모바일",
    name: "모바일 실기기 (iOS Safari / Android Chrome)",
    why: "User-Agent 문자열 교체는 렌더링·터치·뷰포트·재생성 대기를 재현하지 못함",
    how: [
      "1) iOS Safari 실기기로 /suvey 완주 → 리포트 생성 확인",
      "2) Android Chrome 동일 절차 반복",
      "3) 리포트 재생성이 무한 대기에 빠지지 않는지 확인 (사고사례 ②, PR #73)",
      "4) safe-area(노치) 침범·横스크롤 발생 여부 확인",
      "5) 결제 팝업/리다이렉트가 모바일에서 정상 복귀하는지 확인",
    ],
    evidence: "기기명·OS 버전 + 각 단계 스크린샷",
  },
  {
    id: "M4",
    category: "리포트",
    name: "리포트 결정론 (동일 입력 → 동일 지문)",
    why: "동일 응답에 대한 64bit fingerprint 재현성은 실제 생성 2회 실행으로만 확인 가능",
    how: [
      "1) 동일 응답셋으로 리포트 생성 2회 실행",
      "2) 64bit fingerprint(PR #159) 동일성 확인",
      "3) 10단 구조가 유지되는지 확인 (임의 변경 금지)",
      "4) 유형 라벨·부정형 프레임이 출력에 없는지 확인 (절대금지 Top5)",
      "5) KO/EN 양쪽 생성 후 leaf 대칭 유지 확인",
    ],
    evidence: "2회 생성 fingerprint 값 + 10단 목차 캡처",
  },
];

function applyManualLog() {
  let log = {};
  if (manualLogPath && fs.existsSync(manualLogPath)) {
    log = JSON.parse(fs.readFileSync(manualLogPath, "utf8"));
  }
  for (const it of MANUAL_ITEMS) {
    const entry = log[it.id];
    if (!entry) {
      record(it.id, it.category, it.name, "MANUAL",
        `미측정 — ${it.why} | 절차: ${it.how.length}단계 | 증거: ${it.evidence}`);
      continue;
    }
    const st = entry.result === "pass" ? "PASS" : entry.result === "fail" ? "FAIL" : "MANUAL";
    record(it.id, it.category, it.name, st,
      `${entry.date || "날짜없음"} / ${entry.tester || "측정자없음"} / ${entry.note || ""}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  await checkReachability();
  await checkSurfaceMinimization();
  await checkSecurityHeaders();
  checkBuildContracts();
  if (ADMIN_ORIGIN) {
    const r = await probe(`${ADMIN_ORIGIN}/admin`, UA_PC);
    record("A6", "운영콘솔", "admin 호스트 응답",
      r.ok && r.status === 200 ? "PASS" : "FAIL",
      r.ok ? `status=${r.status}` : r.error);
  } else {
    record("A6", "운영콘솔", "admin 호스트 응답", "MANUAL",
      "미측정 — INSPECT_ADMIN_ORIGIN 미설정 (배포 전)");
  }
  applyManualLog();

  const fail = results.filter((r) => r.status === "FAIL");
  const manual = results.filter((r) => r.status === "MANUAL");

  if (asJson) {
    console.log(JSON.stringify({ origin: PUBLIC_ORIGIN, at: new Date().toISOString(), results }, null, 2));
  } else {
    console.log(`\n정기 점검 — ${PUBLIC_ORIGIN} — ${new Date().toISOString()}\n`);
    for (const r of results) {
      const mark = r.status === "PASS" ? "PASS  " : r.status === "FAIL" ? "FAIL  " : "미측정";
      console.log(`[${mark}] ${r.id} ${r.category} · ${r.name}`);
      console.log(`         ${r.detail}`);
    }
    console.log(`\n결함 ${fail.length}건 / 미측정 ${manual.length}건 / 총 ${results.length}건`);
    if (manual.length) {
      console.log("\n미측정 항목은 통과가 아닙니다. 수동 측정 후 --manual-log 로 결과를 남기십시오.");
    }
  }

  if (fail.length) process.exit(1);
  if (manual.length) process.exit(2);
  process.exit(0);
}

main();
