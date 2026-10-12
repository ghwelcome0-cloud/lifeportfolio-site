# E1 r4 원클릭 실행 (Windows PowerShell). 키트 폴더 안에서: powershell -ExecutionPolicy Bypass -File runs\run-r4.ps1
$ErrorActionPreference = "Stop"; Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "== 1/6 Node 확인"; try { node -v } catch { Write-Host "Node가 없습니다. https://nodejs.org 에서 LTS 설치 후 다시 실행"; exit 1 }
Write-Host "== 2/6 측정기 sha 확인(실행 직전)"
$SHA = (Get-FileHash tools\measure-e1.cjs -Algorithm SHA256).Hash.ToLower(); Write-Host $SHA
if ($SHA -ne "c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b") { Write-Host "측정기 sha가 다릅니다. 실행 중단 — 총괄에게 알려 주세요"; exit 2 }
Write-Host "== 3/6 브라우저(puppeteer) 설치 — 1~3분"; if (-not (Test-Path node_modules\puppeteer)) { npm i --silent puppeteer@24 }
$env:PPTR_CORE = "puppeteer"; $env:LP_BROWSER_PATH = (node -e "console.log(require('puppeteer').executablePath())")
$RUN = "runs\" + (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd") + "-r4"; New-Item -ItemType Directory -Force $RUN | Out-Null
Write-Host "== 4/6 Accept-Language 확인(측정 직전 1회)"
$AL = node -e "const p=require('puppeteer');(async()=>{const b=await p.launch({headless:'shell',args:['--lang=en-US']});const pg=await b.newPage();await pg.goto('https://httpbin.org/headers',{timeout:30000});const t=await pg.evaluate(()=>document.body.innerText);const m=t.match(/\x22Accept-Language\x22:\s*\x22([^\x22]*)\x22/);console.log(m?m[1]:'unknown');await b.close()})().catch(()=>console.log('unknown'))"
$START = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Host "== 5/6 측정 13행(약 3~10분, 그대로 두세요)"
node tools\measure-e1.cjs roster\roster-v2.r4-subset.json $RUN 2>&1 | Tee-Object "$RUN\measure.log"
node tools\score-e1.cjs $RUN | Tee-Object "$RUN\score.log"
$END = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$OS = (Get-CimInstance Win32_OperatingSystem).Caption; $TZN = node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"
$BV = "puppeteer " + (node -e "console.log(require('puppeteer/package.json').version)") + " bundled chrome-headless-shell"
$NET = Read-Host "네트워크 종류(home-wifi / office-wired / mobile-tether)"
$RS = (Get-FileHash roster\roster-v2.r4-subset.json -Algorithm SHA256).Hash.ToLower()
$meta = [ordered]@{bound_commit="9557e46";run="r4";egress_country="KR";machine_kind="owner-local-pc";network_kind=$NET;browser=$BV;profile="fresh (puppeteer new page, no cookies/cache, not logged in)";rows_requested=13;bridge_rows=@("K02","K05","K13","K18");started_utc=$START;ended_utc=$END;browser_lang_flag="en-US";os_kind=$OS;os_timezone=$TZN;accept_language_sent=$AL;tool_sha_before_run=$SHA;roster_subset_sha256=$RS}
$meta | ConvertTo-Json | Set-Content -Encoding UTF8 "$RUN\run-meta.json"
Write-Host "== 6/6 묶기"; tar -czf r4-result.tar.gz $RUN; Write-Host "결과 tar sha256:"; (Get-FileHash r4-result.tar.gz -Algorithm SHA256).Hash.ToLower()
Write-Host "`n끝. 'r4-result.tar.gz' 파일 하나를 파이스 컴퓨터 DM(또는 총괄)에 올려 주세요. 위에 찍힌 측정기 sha와 tar sha도 함께."
