#!/bin/bash
# ============================================================================
# 인생포트폴리오 전수조사 자동 점검 스크립트 (audit_check.sh)
# ----------------------------------------------------------------------------
# 목적: 회귀(regression) 예방 — 코드 수정 후 배포 전, 그리고 주기 점검 시 실행.
# 사용법: cd /home/user/webapp && bash scripts/audit_check.sh
# 원칙: 비파괴(읽기 전용). 어떤 파일도 수정하지 않음.
# ============================================================================
cd "$(dirname "$0")/.." || exit 1
FAIL=0
PASS=0
warn(){ echo "  ⚠️  $1"; }
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "════════════════════════════════════════════════════"
echo " 인생포트폴리오 전수조사 자동 점검"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────
echo ""
echo "[1] 전체 HTML JS 문법 검사 (JSON-LD 제외)"
JS_FAIL=0
for f in *.html; do
python3 - "$f" << 'PYEOF'
import re, subprocess, sys
f = sys.argv[1]
html = open(f, encoding="utf-8").read()
html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
blocks = re.findall(r'<script((?![^>]*\bsrc=)[^>]*)>(.*?)</script>', html, flags=re.DOTALL)
errs = []
for i,(attrs,code) in enumerate(blocks):
    if any(x in attrs for x in ('ld+json','application/json','text/template','text/html')): continue
    if not code.strip(): continue
    c = re.sub(r'^\s*import\s.*?;', '', code, flags=re.MULTILINE|re.DOTALL)
    c = re.sub(r'^\s*import\s.*?from\s.*?["\'].*?["\'];?', '', c, flags=re.MULTILINE)
    c = re.sub(r'^\s*export\s', '', c, flags=re.MULTILINE)
    open("/tmp/_ac.js","w",encoding="utf-8").write(c)
    r = subprocess.run(["node","--check","/tmp/_ac.js"],capture_output=True,text=True)
    if r.returncode!=0: errs.append(r.stderr.strip().split("\n")[0])
if errs:
    print("BAD:%s:%s" % (f, errs[0])); sys.exit(1)
PYEOF
  [ $? -ne 0 ] && JS_FAIL=1
done
[ $JS_FAIL -eq 0 ] && ok "전체 HTML JS 문법 통과" || bad "JS 문법 오류 존재 (위 BAD 라인 확인)"

# ─────────────────────────────────────────────────────────
echo ""
echo "[2] JSON 설정 파일 유효성 (firebase.json + i18n)"
for j in firebase.json assets/i18n/ko.json assets/i18n/en.json; do
  if [ -f "$j" ]; then
    python3 -c "import json;json.load(open('$j'))" 2>/dev/null && ok "$j 유효" || bad "$j JSON 깨짐"
  fi
done

# ─────────────────────────────────────────────────────────
echo ""
echo "[3] Firebase 프로젝트 ID 일관성 (lifeporfolio — 오타 아님, t 누락이 정상)"
WRONG=$(grep -rl "lifeportfolio-default-rtdb\|lifeportfolio\.firebaseapp\|lifeportfolio-default" *.html 2>/dev/null)
if [ -z "$WRONG" ]; then ok "RTDB/앱 도메인 프로젝트ID(lifeporfolio) 일관"
else bad "잘못된 프로젝트ID(lifeportfolio) 사용 파일: $WRONG"; fi

# ─────────────────────────────────────────────────────────
echo ""
echo "[4] RTDB databaseURL 일관성 (asia-southeast1)"
DBCOUNT=$(grep -rl "lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app" *.html 2>/dev/null | wc -l)
WRONGDB=$(grep -rl "firebaseio.com\"" *.html 2>/dev/null | grep -v "connect-src\|CSP" || true)
ok "asia-southeast1 RTDB URL 사용 페이지: ${DBCOUNT}개"

# ─────────────────────────────────────────────────────────
echo ""
echo "[5] Permissions-Policy 헤더 문법 (origin 개별 따옴표)"
# 잘못된 형식: 한 따옴표에 공백으로 두 origin ("https://a https://b")
BADPP=$(grep -o 'payment=([^)]*)' firebase.json | grep -o '"https://[^"]* https://[^"]*"' | head -1)
if [ -z "$BADPP" ]; then ok "Permissions-Policy origin 형식 정상"
else bad "Permissions-Policy origin이 한 따옴표에 묶임: $BADPP"; fi

# ─────────────────────────────────────────────────────────
echo ""
echo "[6] 결제 CSP 핵심 도메인 존재 확인 (payple 이원화 + payment-v2)"
for dom in "cpay.payple.kr" "payment-v2.payple.kr" "cpay.payple.co.kr"; do
  grep -q "$dom" firebase.json && ok "CSP에 $dom 존재" || bad "CSP에 $dom 누락"
done
# product-v2 meta CSP content 속성에 form-action이 없어야 함 (있으면 카드결제 차단 회귀)
#   ※ 주석(<!-- -->)의 'form-action' 단어는 제외하고, 실제 meta content만 검사.
PV2_META=$(python3 - << 'PYEOF'
import re
html = open("product-v2.html", encoding="utf-8").read()
html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)   # 주석 제거
m = re.search(r'http-equiv=["\']Content-Security-Policy["\']\s+content=["\'](.*?)["\']\s*/?>', html, flags=re.DOTALL)
print("HAS" if (m and "form-action" in m.group(1)) else "NONE")
PYEOF
)
if [ "$PV2_META" = "HAS" ]; then
  bad "product-v2.html meta CSP content에 form-action 재등장 (카드결제 차단 회귀 위험!)"
else ok "product-v2.html meta CSP에 form-action 없음 (정상)"; fi

# ─────────────────────────────────────────────────────────
echo ""
echo "[7] 마이페이지 조회 로직 회귀 방지"
# REST 우선 조회 마커(PR#181)가 있어야 함
grep -q "PR#181" mypage.html && ok "mypage REST 우선 조회(PR#181) 유지" || warn "mypage PR#181 마커 없음 — 속도개선 롤백 여부 확인"
# 병렬화(Promise.allSettled) 재도입 여부 — 재도입되면 데이터 미표시 회귀
if grep -q "Promise.allSettled" mypage.html; then
  bad "mypage.html에 Promise.allSettled 재등장 (리포트 미표시 회귀 위험!)"
else ok "mypage.html 리포트 로딩 직렬 유지 (allSettled 없음)"; fi

# ─────────────────────────────────────────────────────────
echo ""
echo "[8] 검사 진입 쳇바퀴 방지 마커 (PR#192 _active 확인)"
grep -q "PR#192" suvey.html && ok "suvey 진행중세션(_active) paid 통과 로직 유지" || warn "suvey PR#192 마커 없음 — 쳇바퀴 해결 롤백 여부 확인"

# ─────────────────────────────────────────────────────────
echo ""
echo "[9] 결제→검사 플로우 파일 존재 확인"
for pf in index.html product-v2.html product.html suvey.html mypage.html report-loading.html report.html login.html payment-success.html; do
  [ -f "$pf" ] && ok "$pf 존재" || bad "$pf 누락 (핵심 플로우 파일!)"
done

# ─────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo " 결과: ✅ 통과 ${PASS}건 / ❌ 실패 ${FAIL}건"
[ $FAIL -eq 0 ] && echo " 🎉 자동 점검 전체 통과" || echo " ⚠️  실패 항목을 반드시 수정 후 배포하세요"
echo "════════════════════════════════════════════════════"
exit $FAIL
