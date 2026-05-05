#!/usr/bin/env bash
# PR#37 정적 검증 스크립트
# - 토글 마크업 제거, 헤더 링크 헬퍼 로드, 마이페이지 신규 UI/i18n 키 적용,
#   JSON 파싱, 회원 탈퇴 핸들러 존재 여부 등을 일괄 점검한다.
set -u
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "PR#37 정적 검증 시작"
echo "============================================================"

echo
echo "[1] KO/EN 토글 마크업 제거 (report*, program*, privacy, terms)"
for f in report.html report-loading.html program.html program-loading.html privacy.html terms.html; do
  if grep -q "data-i18n-toggle" "$f" 2>/dev/null; then
    fail "$f 에 data-i18n-toggle 잔존"
  else
    ok "$f 토글 제거 확인"
  fi
done

echo
echo "[2] header-link-fix.js 16개 페이지 모두 로드 확인"
TARGET_PAGES="auth-fail.html index.html login.html mypage.html payment-fail.html payment-success.html privacy.html product.html program-loading.html program.html report-loading.html report.html signup.html success.html suvey.html terms.html"
for f in $TARGET_PAGES; do
  if grep -q "header-link-fix.js" "$f" 2>/dev/null; then
    ok "$f 헤더 링크 헬퍼 로드"
  else
    fail "$f 헤더 링크 헬퍼 누락"
  fi
done

echo
echo "[3] header-link-fix.js 핵심 함수 존재"
HF=assets/i18n/header-link-fix.js
[ -f "$HF" ] && ok "파일 존재" || fail "$HF 파일 없음"
for tok in "_surfaceLang" "_withLangParam" "MutationObserver" "lp:langchange"; do
  if grep -q "$tok" "$HF" 2>/dev/null; then
    ok "$tok 포함"
  else
    fail "$tok 누락"
  fi
done

echo
echo "[4] mypage.html 핵심 신규 UI/로직"
M=mypage.html
for tok in \
  "id=\"deleteReportModal\"" \
  "id=\"withdrawModal\"" \
  "id=\"withdrawBtn\"" \
  "id=\"withdrawConfirmInput\"" \
  "report-delete-btn" \
  "deleteUser" \
  "reauthenticateWithCredential" \
  "reauthenticateWithPopup" \
  "payments_anonymized" \
  "_IS_MOBILE" \
  "sync_pending_title"; do
  if grep -q "$tok" "$M" 2>/dev/null; then
    ok "mypage.html에 '$tok'"
  else
    fail "mypage.html에 '$tok' 누락"
  fi
done

echo
echo "[5] 모바일/PC 차등 타임아웃"
if grep -qE "_IS_MOBILE \? (30000|40000) : 20000" "$M"; then
  ok "리포트 조회: 모바일 30~40s / PC 20s (PR#38: 모바일 40s)"
else
  fail "리포트 조회 차등 타임아웃 누락"
fi
if grep -qE "_IS_MOBILE \? (22000|25000) : 15000" "$M"; then
  ok "auth guard: 모바일 22~25s / PC 15s (PR#38: 모바일 25s)"
else
  fail "auth guard 차등 타임아웃 누락"
fi
# PR#38 추가 검증
if grep -q "_getWithRetry" "$M"; then
  ok "PR#38: 모바일 RTDB 자동 재시도(_getWithRetry) 존재"
else
  fail "PR#38: _getWithRetry 누락"
fi
if grep -q "withdrawn_logs" "$M"; then
  ok "PR#38: 탈퇴 감사 기록(withdrawn_logs) 존재"
else
  fail "PR#38: withdrawn_logs 누락"
fi
if grep -q "purgeExpiredWithdrawnData" functions/index.js 2>/dev/null; then
  ok "PR#38: 30일 자동 파기 스케줄러(purgeExpiredWithdrawnData) 존재"
else
  fail "PR#38: 자동 파기 스케줄러 누락"
fi
# PR#39 추가 검증
if grep -q "_onValueOnce" "$M"; then
  ok "PR#39: onValue 1회 폴백(_onValueOnce) 존재 — 모바일 RTDB 안정성"
else
  fail "PR#39: _onValueOnce 누락"
fi
if grep -q "__LP_APPCHECK_STATE" "$M"; then
  ok "PR#39: AppCheck 상태 추적(__LP_APPCHECK_STATE) 존재"
else
  fail "PR#39: __LP_APPCHECK_STATE 누락"
fi
if grep -q "__LP_LAST_FETCH_ERR" "$M"; then
  ok "PR#39: RTDB 조회 에러 추적(__LP_LAST_FETCH_ERR) 존재"
else
  fail "PR#39: __LP_LAST_FETCH_ERR 누락"
fi
if grep -q "sync_diag_summary" "$M"; then
  ok "PR#39: 화면 진단 패널(sync_diag_summary) 존재"
else
  fail "PR#39: sync_diag_summary 누락"
fi
# PR#40 추가 검증: REST 엔드포인트 직접 폴백
if grep -q "_restFetch" "$M"; then
  ok "PR#40: RTDB REST 엔드포인트 폴백(_restFetch) 존재"
else
  fail "PR#40: _restFetch 누락"
fi
if grep -q "_wrapAsSnapshot" "$M"; then
  ok "PR#40: snapshot 호환 래퍼(_wrapAsSnapshot) 존재"
else
  fail "PR#40: _wrapAsSnapshot 누락"
fi
if grep -q "if (_IS_MOBILE) {" "$M" && grep -q "REST 폴백을 1차로" "$M"; then
  ok "PR#40: 모바일 REST 우선 경로 활성"
else
  fail "PR#40: 모바일 REST 우선 경로 누락"
fi
if grep -q "_RTDB_BASE = firebaseConfig.databaseURL" "$M"; then
  ok "PR#40: RTDB base URL 캐시(_RTDB_BASE) 존재"
else
  fail "PR#40: _RTDB_BASE 누락"
fi
# PR#39 정책: 언어별 필터링 제거 검증
if grep -q "PR#39 \[정책 변경\]" "$M" && grep -q "언어별 필터링 제거" "$M"; then
  ok "PR#39: 언어 무관 통합 표시 정책 적용"
else
  fail "PR#39: 통합 표시 정책 주석 누락"
fi
if grep -q "it.lang === 'en' ? 'en' : 'ko'" "$M" || grep -q "cardLang = (it.lang === 'en') ? 'en' : 'ko'" "$M"; then
  ok "PR#39/40: 액션 버튼이 리포트 자체 언어로 열림 (it.lang/cardLang 기반)"
else
  fail "PR#39/40: it.lang/cardLang 기반 액션 링크 누락"
fi
# PR#40: 카드별 라벨이 그 리포트의 저장 언어(cardLang)로 직접 렌더링되는지 검증
if grep -q "_CARD_LABELS" "$M" && grep -q "data-card-lang" "$M"; then
  ok "PR#40: 카드별 라벨이 저장 언어로 렌더링 (_CARD_LABELS + data-card-lang)"
else
  fail "PR#40: 카드별 라벨 분리 렌더링 누락 (_CARD_LABELS / data-card-lang)"
fi
# PR#40: report.html / program.html 의 마이페이지 링크가 리포트 언어를 유지하는지
if grep -q "topMypageLink" report.html && grep -q "topMypageLink" program.html; then
  ok "PR#40: report/program 상단 마이페이지 링크에 언어 유지 적용"
else
  fail "PR#40: report/program 상단 마이페이지 링크 언어 유지 누락"
fi

echo
echo "[6] 신규 i18n 키 (ko + en 양쪽 동시 존재)"
for key in \
  "retention_title" "retention_desc" \
  "sync_pending_title" "sync_pending_desc" \
  "delete_btn" "delete_confirm_title" "delete_confirm_yes" \
  "withdraw_section_title" "withdraw_btn" "withdraw_modal_title" \
  "withdraw_modal_confirm_word" "withdraw_modal_yes" \
  "withdraw_in_progress" "withdraw_success" "withdraw_failed" \
  "withdraw_reauth_required"; do
  ko=$(grep -c "\"$key\"" assets/i18n/ko.json)
  en=$(grep -c "\"$key\"" assets/i18n/en.json)
  if [ "$ko" -ge 1 ] && [ "$en" -ge 1 ]; then
    ok "i18n 키 '$key' (ko/en 모두 존재)"
  else
    fail "i18n 키 '$key' 누락 (ko=$ko, en=$en)"
  fi
done

echo
echo "[7] JSON 파싱 (ko.json / en.json)"
for f in assets/i18n/ko.json assets/i18n/en.json; do
  if python3 -c "import json,sys; json.load(open('$f',encoding='utf-8'))" 2>/dev/null; then
    ok "$f JSON 파싱 OK"
  else
    fail "$f JSON 파싱 실패"
  fi
done

echo
echo "[8] privacy.html / terms.html 탈퇴·삭제 절차 문구"
if grep -q "회원 탈퇴 시 모든 데이터" privacy.html; then ok "privacy 탈퇴 30일 파기 문구"; else fail "privacy 탈퇴 문구 누락"; fi
if grep -q "마이페이지에서.*개별" privacy.html; then ok "privacy 셀프서비스 문구"; else fail "privacy 셀프서비스 문구 누락"; fi
if grep -q "art12" terms.html; then ok "terms 12조(이용자 데이터 권리)"; else fail "terms art12 누락"; fi

echo
echo "[9] 마이그레이션 스크립트"
MG=scripts/migrate_report_lang.js
[ -f "$MG" ] && ok "$MG 존재" || fail "$MG 없음"
if grep -q "buildUpdates" "$MG" 2>/dev/null; then ok "swap/set-lang 로직 포함"; else fail "swap/set-lang 로직 누락"; fi
if grep -q "backupSnapshot" "$MG" 2>/dev/null; then ok "백업 함수 포함"; else fail "백업 함수 누락"; fi
if grep -q "serviceAccount" .gitignore; then ok ".gitignore에 serviceAccount 보호"; else fail ".gitignore 보호 누락"; fi

echo
echo "============================================================"
echo "결과:  통과 ${PASS} / 실패 ${FAIL}"
echo "============================================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
