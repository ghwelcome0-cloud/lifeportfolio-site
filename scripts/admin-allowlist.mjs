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
// (grep 결과: favicon.svg + Pretendard 3파일 이외의 로컬 자산 참조 없음)
export const ADMIN_ASSET_FILES = [
  "assets/favicon.svg",
  "assets/fonts/pretendard/pretendard.css",
  "assets/fonts/pretendard/Pretendard-Regular.woff2",
  "assets/fonts/pretendard/Pretendard-Bold.woff2",
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
  ".html", ".css", ".svg", ".woff2",
]);
