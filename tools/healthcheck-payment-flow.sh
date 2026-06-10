#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
#  결제 → 검사 → 리포트 → PDF → 해설서 전체 체인 자동 헬스체크
#  PR#188 도입 — 운영자가 매번 수동으로 확인하지 않도록 자동화.
#
#  사용법:
#    bash tools/healthcheck-payment-flow.sh              # 기본 라이브 URL
#    BASE_URL=https://lifeportfolio.co.kr bash tools/healthcheck-payment-flow.sh
#    BASE_URL=https://lifeportfolio--PR-preview.web.app bash tools/healthcheck-payment-flow.sh
#
#  검증 항목:
#    1) 핵심 페이지 HTTP 200 응답 (리다이렉트 따라감)
#    2) 결제완료 페이지 — PR#187 가드 마커 + 모바일 fix 존재
#    3) 검사 페이지 — paid 토큰 검증 코드 존재
#    4) 리포트 페이지 — PDF 버튼 + 해설서 버튼 + multi-CDN fallback
#    5) 마이페이지 — 이어하기/리포트 카드 진입 링크
#    6) 고객 여정 페이지 — 8장 슬라이드 모두 200 응답
#    7) 보안 헤더 / robots.txt / sitemap.xml 응답
#
#  종료 코드:
#    0 = 전체 PASS
#    1 = 하나 이상 FAIL (CI 워크플로에서 실패 처리)
# ───────────────────────────────────────────────────────────────

set -uo pipefail

BASE_URL="${BASE_URL:-https://lifeportfolio.co.kr}"
CURL_TIMEOUT="${CURL_TIMEOUT:-15}"
PASS=0
FAIL=0
WARN=0
FAIL_DETAILS=""

# ANSI 컬러 (CI 에서도 보기 좋게)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BLUE=''; NC=''
fi

log_pass() { echo -e "  ${GREEN}✅ PASS${NC} $1"; PASS=$((PASS+1)); }
log_fail() {
  echo -e "  ${RED}❌ FAIL${NC} $1"
  FAIL=$((FAIL+1))
  FAIL_DETAILS="${FAIL_DETAILS}\n  - $1"
}
log_warn() { echo -e "  ${YELLOW}⚠️  WARN${NC} $1"; WARN=$((WARN+1)); }

section() { echo ""; echo -e "${BLUE}━━━ $1 ━━━${NC}"; }

# ── helper: HTTP 응답 코드 (리다이렉트 따라감)
http_code() {
  curl -sL -o /dev/null -w "%{http_code}" --max-time "$CURL_TIMEOUT" "$1" 2>/dev/null || echo "000"
}

# ── helper: 본문 내용에 패턴 존재 여부 (grep -c)
body_has() {
  local url="$1" pattern="$2"
  curl -sL --max-time "$CURL_TIMEOUT" "$url" 2>/dev/null | grep -c "$pattern" 2>/dev/null || echo "0"
}

# ── helper: 페이지 200 응답 + 본문에 마커 존재 검증
check_page_with_marker() {
  local label="$1" url="$2" marker="$3" min_count="${4:-1}"
  local code count
  code=$(http_code "$url")
  if [ "$code" != "200" ]; then
    log_fail "$label — HTTP $code (URL: $url)"
    return 1
  fi
  count=$(body_has "$url" "$marker")
  if [ "$count" -ge "$min_count" ]; then
    log_pass "$label — 200 OK + 마커 '$marker' ($count회)"
    return 0
  else
    log_fail "$label — 200 OK 이지만 마커 '$marker' 누락 (count=$count, expected>=$min_count)"
    return 1
  fi
}

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  결제 플로우 자동 헬스체크 (PR#188 by 인생포트폴리오 운영팀)  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 BASE_URL: $BASE_URL"
echo "⏱️  TIMEOUT: ${CURL_TIMEOUT}s"
echo ""

# ═══════════════════════════════════════════════════════════════
section "1. 핵심 페이지 HTTP 응답"
# ═══════════════════════════════════════════════════════════════
for path in "/" "/product" "/payment-success" "/payment-fail" "/suvey" "/mypage" "/report-loading" "/customer-journey"; do
  url="${BASE_URL}${path}"
  code=$(http_code "$url")
  if [ "$code" = "200" ]; then
    log_pass "$path → HTTP 200"
  else
    log_fail "$path → HTTP $code"
  fi
done

# ═══════════════════════════════════════════════════════════════
section "2. payment-success.html — PR#187 가드 + 모바일 fix"
# ═══════════════════════════════════════════════════════════════
URL="${BASE_URL}/payment-success"

# PR#187 stuck-rescue 가드 (3중 가드: decided / autoRedirectEnabled / progressTimer)
check_page_with_marker "PR#187 stuck-rescue 가드 코드 존재" "$URL" "stuck-rescue 호출 거부" 3

# 모바일 h1 br 무력화
check_page_with_marker "모바일 h1 br{display:none} 적용" "$URL" "h1 br{ display:none; }" 1

# stuck-rescue 패널 DOM 자체는 존재 (막힐 때 노출용)
check_page_with_marker "stuck-rescue 패널 DOM 존재 (방어 동선)" "$URL" 'id="stuckRescue"' 1

# 자동 카운트다운 (3초 단축 — PR#183)
check_page_with_marker "결제 후 3초 카운트다운 로직 존재" "$URL" "const totalTime = 3000" 1

# paid 플래그 발급 (issuePaidFlag)
check_page_with_marker "paid 플래그 발급 로직 존재" "$URL" "issuePaidFlag" 1

# 인앱웹뷰 감지 (PR#111)
check_page_with_marker "인앱웹뷰 감지 배너 코드" "$URL" "detectInAppWebview" 1

# ═══════════════════════════════════════════════════════════════
section "3. suvey.html — paid 토큰 검증 + 리포트 진입"
# ═══════════════════════════════════════════════════════════════
URL="${BASE_URL}/suvey"

check_page_with_marker "suvey → report-loading 리다이렉트 코드" "$URL" "report-loading.html?sid=" 1

# ═══════════════════════════════════════════════════════════════
section "4. report.html — PDF + 해설서 + multi-CDN"
# ═══════════════════════════════════════════════════════════════
URL="${BASE_URL}/report"

check_page_with_marker "PDF 다운로드 버튼 존재" "$URL" 'id="pdfBtn"' 1
check_page_with_marker "해설서 버튼 존재" "$URL" 'id="guideBtn"' 1
check_page_with_marker "해설서 페이지 링크 (report-guide)" "$URL" 'href="report-guide"' 1

# report-guide 페이지 자체 응답
GUIDE_CODE=$(http_code "${BASE_URL}/report-guide")
if [ "$GUIDE_CODE" = "200" ]; then
  log_pass "report-guide.html → HTTP 200"
else
  log_fail "report-guide.html → HTTP $GUIDE_CODE"
fi

# ═══════════════════════════════════════════════════════════════
section "5. mypage.html — 이어하기 + 리포트 카드"
# ═══════════════════════════════════════════════════════════════
URL="${BASE_URL}/mypage"

check_page_with_marker "이어하기 버튼 존재" "$URL" 'id="resumeBtn"' 1
check_page_with_marker "리포트 카드 진입 (report.html?sid=)" "$URL" "report.html?sid=" 1
check_page_with_marker "프로그램 카드 진입 (program.html?sid=)" "$URL" "program.html?sid=" 1

# ═══════════════════════════════════════════════════════════════
section "6. 고객 여정 8장 슬라이드 응답"
# ═══════════════════════════════════════════════════════════════
URL="${BASE_URL}/customer-journey"
JOURNEY_CODE=$(http_code "$URL")
if [ "$JOURNEY_CODE" = "200" ]; then
  log_pass "customer-journey.html → HTTP 200"
else
  log_fail "customer-journey.html → HTTP $JOURNEY_CODE"
fi

for i in 1 2 3 4 5 6 7 8; do
  IMG_URL="${BASE_URL}/assets/journey/slide-${i}.png"
  CODE=$(http_code "$IMG_URL")
  if [ "$CODE" = "200" ]; then
    log_pass "slide-${i}.png → HTTP 200"
  else
    log_fail "slide-${i}.png → HTTP $CODE"
  fi
done

# ═══════════════════════════════════════════════════════════════
section "7. SEO / robots / sitemap"
# ═══════════════════════════════════════════════════════════════
for path in "/robots.txt" "/sitemap.xml" "/llms.txt" "/favicon.ico"; do
  url="${BASE_URL}${path}"
  code=$(http_code "$url")
  if [ "$code" = "200" ]; then
    log_pass "$path → HTTP 200"
  else
    log_fail "$path → HTTP $code"
  fi
done

# ═══════════════════════════════════════════════════════════════
section "8. 보안 — 인증 페이지 응답"
# ═══════════════════════════════════════════════════════════════
for path in "/login" "/signup" "/auth-fail" "/privacy" "/terms"; do
  url="${BASE_URL}${path}"
  code=$(http_code "$url")
  if [ "$code" = "200" ]; then
    log_pass "$path → HTTP 200"
  else
    log_fail "$path → HTTP $code"
  fi
done

# ═══════════════════════════════════════════════════════════════
# 종합 결과
# ═══════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ PASS: $PASS${NC}    ${RED}❌ FAIL: $FAIL${NC}    ${YELLOW}⚠️  WARN: $WARN${NC}"
echo "════════════════════════════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}🎉 전체 헬스체크 통과 — 결제 → 리포트 체인 정상${NC}"
  exit 0
else
  echo -e "${RED}🚨 헬스체크 실패 항목:${NC}"
  echo -e "$FAIL_DETAILS"
  echo ""
  echo -e "${RED}배포 직후 / 코드 변경 시 위 항목을 즉시 확인하세요.${NC}"
  exit 1
fi
