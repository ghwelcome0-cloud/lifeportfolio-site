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

# ============ PR#41 신규 검증 ============
echo
echo "[5b] PR#41: lang 신뢰원 보정 + REST 폴백 확장 + 인사이트 카드 라우팅"

# (1) suvey.html: 검사 제출 시 responses.lang 기록
if grep -q "PR#41 제출 lang 신뢰원" suvey.html && grep -q "lang: __submitLang" suvey.html; then
  ok "PR#41: suvey.html이 검사 제출 시점 lang을 responses에 기록"
else
  fail "PR#41: suvey.html에 responses.lang 기록 누락"
fi

# (2) report-loading.html: session.lang 우선
if grep -q "PR#41 lang 결정" report-loading.html && grep -q "__sessionLang" report-loading.html; then
  ok "PR#41: report-loading.html이 session.lang을 1순위 신뢰원으로 사용"
else
  fail "PR#41: report-loading.html lang 신뢰원 우선순위 누락"
fi

# (3) mypage.html: 본문 lang 우선 + 인덱스 lang 교차검증
if grep -q "PR#41: 본문 lang을 1순위 신뢰원" "$M" && grep -q "lang 보정" "$M"; then
  ok "PR#41: mypage.html이 본문 lang을 인덱스보다 우선 신뢰"
else
  fail "PR#41: mypage.html lang 교차검증 로직 누락"
fi

# (4) report.html: REST 폴백 모듈 + _safeGet 적용
if grep -q "_restFetchRpt" report.html && grep -q "_safeGet" report.html; then
  ok "PR#41: report.html에 REST 폴백 (_safeGet) 적용"
else
  fail "PR#41: report.html REST 폴백 모듈 누락"
fi
# report.html에 SDK get만 쓰는 경로가 남아있으면 실패 (회귀 차단)
RPT_RAW_GET=$(grep -c "await get(ref(db" report.html || true)
if [ "$RPT_RAW_GET" -eq 0 ]; then
  ok "PR#41: report.html에 SDK get(ref(db,...)) 잔재 없음 (모두 _safeGet 경유)"
else
  fail "PR#41: report.html에 SDK get(ref(db,...)) $RPT_RAW_GET건 잔존"
fi

# (5) program.html: REST 폴백 모듈 + _safeGet 적용
if grep -q "_restFetchPrg" program.html && grep -q "_safeGet" program.html; then
  ok "PR#41: program.html에 REST 폴백 (_safeGet) 적용"
else
  fail "PR#41: program.html REST 폴백 모듈 누락"
fi
PRG_RAW_GET=$(grep -c "await get(ref(db" program.html || true)
if [ "$PRG_RAW_GET" -eq 0 ]; then
  ok "PR#41: program.html에 SDK get(ref(db,...)) 잔재 없음"
else
  fail "PR#41: program.html에 SDK get(ref(db,...)) $PRG_RAW_GET건 잔존"
fi

# (6) index.html: 인사이트 카드 3개에 data-blog-en 부착 + applyLang에 카드 처리
INSIGHT_EN_CNT=$(grep -c "insights-card[^>]*data-blog-en\|data-blog-en=\"/blog/en/\"" index.html || true)
if [ "$INSIGHT_EN_CNT" -ge 3 ]; then
  ok "PR#41: index.html 인사이트 카드 EN 라우팅 부착 ($INSIGHT_EN_CNT건)"
else
  fail "PR#41: index.html 인사이트 카드 data-blog-en 부착 부족 ($INSIGHT_EN_CNT/3)"
fi
if grep -q "본문 인사이트 카드 3개도 동일 라우팅" index.html; then
  ok "PR#41: index.html applyLang이 인사이트 카드까지 처리"
else
  fail "PR#41: applyLang에 인사이트 카드 처리 추가 누락"
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
echo "[11] PR#44 잔여 항목 — 캐시 충돌 방어 / 인사이트 카드 EN 클릭 라우팅 / 30일 파기 안내"
M=mypage.html
I=index.html
if grep -q "_purgeFirebaseClientCaches" "$M"; then ok "PR#44: 로그아웃/탈퇴 시 Firebase IDB 청소 함수"; else fail "PR#44: _purgeFirebaseClientCaches 누락"; fi
if grep -q "firebaseLocalStorageDb" "$M"; then ok "PR#44: 알려진 Firebase IDB 명단 청소"; else fail "PR#44: firebaseLocalStorageDb 청소 누락"; fi
if grep -q "_lastChanceRoute" "$I"; then ok "PR#44: 인사이트 카드 클릭 시점 마지막 방어선"; else fail "PR#44: _lastChanceRoute 누락"; fi
if grep -q "30일 이내" "$M" && grep -q "_purgeStr" "$M"; then ok "PR#44: 탈퇴 완료 시 30일 파기 일정 명시"; else fail "PR#44: 30일 파기 안내 누락"; fi
if grep -q "purgeExpiredWithdrawnData" functions/index.js; then ok "PR#44: 30일 자동 파기 스케줄러 (functions)"; else fail "PR#44: 자동 파기 스케줄러 누락"; fi

echo
echo "[10b] PR#43 RTDB rules — responses lang 허용 (PERMISSION_DENIED 근본 원인)"
RJ=database.rules.json
if [ -f "$RJ" ]; then
  # responses 블록 안의 lang 검증 존재 확인 (awk로 responses ~ 다음 최상위 키 사이만 추출)
  RESPONSES_BLOCK=$(awk '/"responses"[[:space:]]*:[[:space:]]*\{/{f=1} f{print} /^    "reports"[[:space:]]*:/{if(f){f=0}}' "$RJ")
  if echo "$RESPONSES_BLOCK" | grep -q '"lang"'; then
    ok "PR#43: responses 노드에 lang 검증 존재"
  else
    fail "PR#43: responses 노드에 lang 검증 누락 → PERMISSION_DENIED 재발 위험"
  fi
  if python3 -c "import json; json.load(open('$RJ'))" 2>/dev/null; then
    ok "PR#43: database.rules.json 파싱 OK"
  else
    fail "PR#43: database.rules.json 파싱 실패"
  fi
else
  fail "PR#43: database.rules.json 없음"
fi

echo
echo "[10] PR#42 시크릿 모드 / 제출 안정화"
S=suvey.html
if grep -q "_LP_ENV" "$S"; then ok "PR#42: 환경 진단 플래그(_LP_ENV) 존재"; else fail "PR#42: _LP_ENV 누락"; fi
if grep -q "maybePrivate" "$S"; then ok "PR#42: 시크릿 모드 휴리스틱(maybePrivate)"; else fail "PR#42: maybePrivate 누락"; fi
if grep -q "AppCheck token" "$S"; then ok "PR#42: AppCheck 토큰 능동 점검"; else fail "PR#42: AppCheck 토큰 점검 누락"; fi
if grep -q "REST PATCH 폴백" "$S"; then ok "PR#42: 제출 REST PATCH 폴백"; else fail "PR#42: REST PATCH 폴백 누락"; fi
if grep -q "SDK update timeout" "$S"; then ok "PR#42: SDK update 12s 타임아웃"; else fail "PR#42: SDK 타임아웃 누락"; fi
if grep -q "시크릿/사생활 보호 모드" "$S"; then ok "PR#42: 시크릿 모드 사용자 안내"; else fail "PR#42: 시크릿 안내 누락"; fi
if grep -q "보안 토큰(AppCheck) 발급에 실패" "$S"; then ok "PR#42: AppCheck 실패 안내"; else fail "PR#42: AppCheck 안내 누락"; fi

echo
echo "[11] PR#45 신규 블로그 포스트 (KO+EN 2편)"
NEW_KO_A="blog/posts/2026-05-06-week1-checklist-living-mission.html"
NEW_EN_A="blog/posts-en/2026-05-06-week1-checklist-living-your-mission.html"
NEW_KO_C="blog/posts/2026-05-06-only-one-report-what-you-receive.html"
NEW_EN_C="blog/posts-en/2026-05-06-only-one-report-what-you-receive.html"
for F in "$NEW_KO_A" "$NEW_EN_A" "$NEW_KO_C" "$NEW_EN_C"; do
  if [ -f "$F" ]; then ok "PR#45: 신규 포스트 존재 → $F"; else fail "PR#45: 신규 포스트 누락 → $F"; fi
done
# hreflang KO ↔ EN 상호 링크
if grep -q "2026-05-06-week1-checklist-living-your-mission.html" "$NEW_KO_A" 2>/dev/null; then ok "PR#45: KO(A) → EN(A) hreflang 링크"; else fail "PR#45: KO(A) hreflang 누락"; fi
if grep -q "2026-05-06-week1-checklist-living-mission.html" "$NEW_EN_A" 2>/dev/null; then ok "PR#45: EN(A) → KO(A) hreflang 링크"; else fail "PR#45: EN(A) hreflang 누락"; fi
if grep -q "2026-05-06-only-one-report-what-you-receive.html" "$NEW_EN_C" 2>/dev/null; then ok "PR#45: EN(C) self-canonical/hreflang"; else fail "PR#45: EN(C) hreflang 누락"; fi
# sitemap 4건 추가
SM="sitemap.xml"
if grep -q "2026-05-06-week1-checklist-living-mission.html" "$SM" && grep -q "2026-05-06-week1-checklist-living-your-mission.html" "$SM"; then ok "PR#45: sitemap 후보 A KO/EN 등재"; else fail "PR#45: sitemap A 누락"; fi
if grep -q "2026-05-06-only-one-report-what-you-receive.html" "$SM"; then ok "PR#45: sitemap 후보 C 등재"; else fail "PR#45: sitemap C 누락"; fi
# RSS KO/EN 갱신
if grep -q "2026-05-06-only-one-report-what-you-receive.html" blog/rss.xml; then ok "PR#45: rss.xml 신규 글 포함"; else fail "PR#45: rss.xml 누락"; fi
if grep -q "2026-05-06-only-one-report-what-you-receive.html" blog/rss-en.xml; then ok "PR#45: rss-en.xml 신규 글 포함"; else fail "PR#45: rss-en.xml 누락"; fi
# blog 인덱스 카드 추가
if grep -q "2026-05-06-only-one-report-what-you-receive.html" blog/index.html; then ok "PR#45: blog/index.html 카드 추가"; else fail "PR#45: blog/index.html 누락"; fi
if grep -q "2026-05-06-only-one-report-what-you-receive.html" blog/en/index.html; then ok "PR#45: blog/en/index.html 카드 추가"; else fail "PR#45: blog/en/index.html 누락"; fi
# index.html 인사이트 카드 교체 (가장 오래된 → 신규)
if grep -q "2026-05-06-only-one-report-what-you-receive.html" index.html; then ok "PR#45: index.html 인사이트 카드 교체"; else fail "PR#45: index.html 인사이트 카드 미교체"; fi
# i18n 카드1 갱신
if grep -q "결제 후 받는 것" assets/i18n/ko.json; then ok "PR#45: ko.json insights.card1 갱신"; else fail "PR#45: ko.json card1 미갱신"; fi
if grep -q "What you receive" assets/i18n/en.json; then ok "PR#45: en.json insights.card1 갱신"; else fail "PR#45: en.json card1 미갱신"; fi
# 가명 처리 (J 창업가 / Founder J) 사용 확인 — 본인 실명이 노출되지 않는지
if grep -q "김영식" "$NEW_KO_C" 2>/dev/null; then fail "PR#45: KO(C)에 실명 노출 (가명 처리 실패)"; else ok "PR#45: KO(C) 실명 미노출 (가명 처리 OK)"; fi
if grep -q "J 창업가" "$NEW_KO_C" 2>/dev/null; then ok "PR#45: KO(C) 가명 'J 창업가' 사용"; else fail "PR#45: KO(C) 가명 표기 누락"; fi
if grep -q "Founder J" "$NEW_EN_C" 2>/dev/null; then ok "PR#45: EN(C) alias 'Founder J' 사용"; else fail "PR#45: EN(C) alias 누락"; fi

echo
echo "============================================================"
echo "결과:  통과 ${PASS} / 실패 ${FAIL}"
echo "============================================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
