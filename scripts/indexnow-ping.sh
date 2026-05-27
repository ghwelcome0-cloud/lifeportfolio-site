#!/usr/bin/env bash
# IndexNow ping — push new/updated URLs to Bing & Yandex.
#
# Usage:
#   export INDEXNOW_KEY="<32-64자 hex key, 사이트 루트의 ${KEY}.txt 와 동일해야 함>"
#   bash scripts/indexnow-ping.sh
#
# Sanity:
#   - 키 파일은 https://lifeportfolio.co.kr/${INDEXNOW_KEY}.txt 에 평문 키만 포함되어 있어야 함.
#   - 본 스크립트는 같은 host 의 URL 만 일괄 제출.
#   - 응답 200/202 = 수락, 400 = bad request, 403 = 키 불일치, 422 = URL 형식 오류.
#
# 참고: Bing/Yandex 외 다른 IndexNow 파트너도 동일 엔드포인트로 자동 전달됩니다.

set -euo pipefail

HOST="lifeportfolio.co.kr"
KEY="${INDEXNOW_KEY:-}"

if [[ -z "${KEY}" ]]; then
  echo "[error] INDEXNOW_KEY 환경변수가 비어 있습니다." >&2
  echo "        예: export INDEXNOW_KEY=\"abc123...\"  (사이트 루트의 \${KEY}.txt 와 동일해야 합니다)" >&2
  exit 2
fi

KEY_LOCATION="https://${HOST}/${KEY}.txt"

# 제출할 URL 목록 (한 줄에 하나)
read -r -d '' URLS <<'EOF' || true
https://lifeportfolio.co.kr/blog/posts/2026-05-28-ai-era-self-understanding
https://lifeportfolio.co.kr/blog/posts-en/2026-05-28-ai-era-self-understanding
https://lifeportfolio.co.kr/blog/
https://lifeportfolio.co.kr/blog/en/
https://lifeportfolio.co.kr/sitemap.xml
EOF

# JSON 배열로 변환
URL_JSON=$(printf '%s\n' "${URLS}" | grep -v '^$' | awk 'BEGIN{ORS=""; print "["} NR>1{print ","} {printf "\"%s\"", $0} END{print "]"}')

PAYLOAD=$(cat <<JSON
{
  "host": "${HOST}",
  "key": "${KEY}",
  "keyLocation": "${KEY_LOCATION}",
  "urlList": ${URL_JSON}
}
JSON
)

echo "[indexnow] payload:"
echo "${PAYLOAD}"
echo

for endpoint in \
  "https://api.indexnow.org/IndexNow" \
  "https://www.bing.com/IndexNow" \
  "https://yandex.com/indexnow"
do
  echo "[indexnow] POST ${endpoint}"
  http_code=$(curl -s -o /tmp/indexnow_resp.$$ -w "%{http_code}" \
    -X POST "${endpoint}" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "${PAYLOAD}" || echo "000")
  echo "  -> HTTP ${http_code}"
  if [[ -s /tmp/indexnow_resp.$$ ]]; then
    head -c 500 /tmp/indexnow_resp.$$ ; echo
  fi
  rm -f /tmp/indexnow_resp.$$
done

echo "[indexnow] done."
