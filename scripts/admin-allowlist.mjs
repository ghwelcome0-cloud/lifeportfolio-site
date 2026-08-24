// Gate -1 Admin Hosting publication contract (separate Hosting target: "admin").
//
// Why this file exists separately from hosting-allowlist.mjs
// ---------------------------------------------------------
// 배포헌법 v1.0 은 공개 표면 최소화를 요구한다. 운영 콘솔(admin 계열 4종)은
// 공개 사이트(lifeportfolio.co.kr)에 절대 게시되지 않아야 하며, 이 원칙은
// scripts/hosting-allowlist.mjs / verify-hosting-build.mjs / smoke-hosting-output.mjs
// 3중 방어로 이미 구현되어 있다. 그 3중 방어를 완화하지 않기 위해,
// 운영 콘솔은 별도 Hosting target 으로 완전히 분리 배포한다.
//
// 따라서:
//   - 공개 사이트 계약(hosting-allowlist.mjs)은 변경하지 않는다.
//   - admin 계열은 이 파일에서만 허용된다.
//   - 두 계약의 교집합은 반드시 공집합이어야 한다(scripts/verify-admin-build.mjs 가 검증).
//
// 접근 통제는 정적 파일 분리에 의존하지 않는다. 실제 관문은 다음 2단이다.
//   1) Firebase Auth Google 로그인
//   2) custom claim `admin` 검사 (각 admin HTML 내 getIdTokenResult)
// 이 파일은 "무엇이 admin 사이트에 올라가는가"만 정의한다.

export const ADMIN_ROOT_FILES = [
  "admin.html",
  "b2b-admin.html",
  "checkin-admin.html",
  "review-admin.html",
];

// admin 화면이 실제로 참조하는 자산만 최소 범위로 동반 게시한다.
//
// ★ 2026-08-24 정정 — 초판 주석은 "favicon + Pretendard 3파일 이외의 로컬 자산 참조 없음"
//   이라고 적었으나 이는 오류였다. 제작규칙서 v2.1 부록 「기법④ 산출물 역방향 참조 검사」
//   (결함 CP)를 admin 산출물에 적용해 실측한 결과, 지면이 실행 중에 fetch 하는
//   데이터 파일 2건이 계약에서 빠져 있었다(admin.html:474, checkin-admin.html:578).
//   결함 CP 의 정의 그대로 — "허용 목록은 지면을 담고 그 지면이 먹는 데이터를 빠뜨린다."
//   진술을 정정하고, 같은 부류를 사람이 아니라 게이트가 잡도록
//   verify-admin-build.mjs 에 역방향 참조 검사(검사 7)를 신설했다.
export const ADMIN_ASSET_FILES = [
  "assets/favicon.svg",
  "assets/fonts/pretendard/pretendard.css",
  "assets/fonts/pretendard/Pretendard-Regular.woff2",
  "assets/fonts/pretendard/Pretendard-Bold.woff2",
];

// admin 지면이 런타임에 fetch 하는 데이터 파일.
// 두 파일 모두 공개 사이트(hosting-allowlist.mjs)에 이미 게시 중이므로,
// admin 사이트에 동반 게시해도 새로운 정보 노출은 0건이다.
//   - data/answer-kit.json          ← admin.html:474  fetch("/data/answer-kit.json")
//   - assets/checkin/questions.json ← checkin-admin.html:578 fetch("/assets/checkin/questions.json")
// 절대경로로 호출되므로 admin 호스트에 없으면 그 화면 기능이 404 로 죽는다.
export const ADMIN_DATA_FILES = [
  "data/answer-kit.json",
  "assets/checkin/questions.json",
];

// admin 사이트에는 어떤 트리도 통째로 게시하지 않는다.
// 개별 파일 열거만 허용하여 우발적 확산을 원천 차단한다.
export const ADMIN_TREES = [];

// 공개 사이트 계약에 존재하면 안 되는 admin 표면(교차 검증용 정본 목록).
export const ADMIN_FORBIDDEN_ON_PUBLIC = [
  "admin.html",
  "b2b-admin.html",
  "checkin-admin.html",
  "review-admin.html",
];

export const ADMIN_ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".svg", ".woff2", ".json",
]);
