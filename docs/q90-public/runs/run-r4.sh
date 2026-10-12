#!/bin/bash
# E1 r4 원클릭 실행 (Mac / Linux). 사용: bash runs/run-r4.sh   — 키트 폴더 안에서 실행
set -e
cd "$(dirname "$0")/.."
echo "== 1/6 Node 확인"; node -v || { echo "Node가 없습니다. https://nodejs.org 에서 LTS 설치 후 다시 실행"; exit 1; }
echo "== 2/6 측정기 sha 확인(실행 직전)"
SHA=$(shasum -a 256 tools/measure-e1.cjs 2>/dev/null | cut -d' ' -f1 || sha256sum tools/measure-e1.cjs | cut -d' ' -f1)
echo "$SHA"; [ "$SHA" = "c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b" ] || { echo "측정기 sha가 다릅니다. 실행 중단 — 총괄에게 알려 주세요"; exit 2; }
echo "== 3/6 브라우저(puppeteer) 설치 — 1~3분"; [ -d node_modules/puppeteer ] || npm i --silent puppeteer@24
export PPTR_CORE=puppeteer LP_BROWSER_PATH="$(node -e "console.log(require('puppeteer').executablePath())")"
RUN=runs/$(date -u +%F)-r4; mkdir -p "$RUN"
echo "== 4/6 Accept-Language 확인(측정 직전 1회)"
AL=$(node -e "const p=require('puppeteer');(async()=>{const b=await p.launch({headless:'shell',args:['--lang=en-US','--no-sandbox']});const pg=await b.newPage();await pg.goto('https://httpbin.org/headers',{timeout:30000});const t=await pg.evaluate(()=>document.body.innerText);const m=t.match(/\"Accept-Language\":\s*\"([^\"]*)\"/);console.log(m?m[1]:'unknown');await b.close()})().catch(()=>console.log('unknown'))")
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "== 5/6 측정 13행(약 3~10분, 그대로 두세요)"
node tools/measure-e1.cjs roster/roster-v2.r4-subset.json "$RUN" 2>&1 | tee "$RUN/measure.log"
node tools/score-e1.cjs "$RUN" | tee "$RUN/score.log"
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OS="$(uname -s) $(uname -r)"; TZ_NAME=$(node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)")
BV=$(node -e "const p=require('puppeteer');console.log('chrome-headless-shell '+p.default?.defaultBrowserRevision||require('puppeteer/package.json').version)" 2>/dev/null || echo "puppeteer 24 bundled")
read -p "네트워크 종류(home-wifi / office-wired / mobile-tether): " NET
cat > "$RUN/run-meta.json" <<JSON
{"bound_commit":"9557e46","run":"r4","egress_country":"KR","machine_kind":"owner-local-pc","network_kind":"${NET:-unknown}","browser":"${BV}","profile":"fresh (puppeteer new page, no cookies/cache, not logged in)","rows_requested":13,"bridge_rows":["K02","K05","K13","K18"],"started_utc":"$START","ended_utc":"$END","browser_lang_flag":"en-US","os_kind":"$OS","os_timezone":"$TZ_NAME","accept_language_sent":"$AL","tool_sha_before_run":"$SHA","roster_subset_sha256":"$(shasum -a 256 roster/roster-v2.r4-subset.json 2>/dev/null | cut -d' ' -f1 || sha256sum roster/roster-v2.r4-subset.json | cut -d' ' -f1)"}
JSON
echo "== 6/6 묶기"; tar -czf r4-result.tar.gz "$RUN"; echo "결과 tar sha256:"; shasum -a 256 r4-result.tar.gz 2>/dev/null || sha256sum r4-result.tar.gz
echo; echo "끝. 'r4-result.tar.gz' 파일 하나를 파이스 컴퓨터 DM(또는 총괄)에 올려 주세요. 위에 찍힌 측정기 sha와 tar sha도 함께."
