# E1 r4 — 국내(KR) 접속에서 재측정 지침서

결박: G21 §24 (lifeportfolio-site `9557e46`). 이 문서를 그대로 따라 실행하고, **결과를 보고 조건을 바꾸지 않습니다.**

## 누가, 무엇을

- 실행자: 대표 PC의 로컬 에이전트 "파이스 컴퓨터"(또는 대표 본인). 국내 인터넷(한국 출구 IP)이면 됩니다.
- 재는 행: 13행 — r3에서 해외 접속 시간 초과였던 9행(K01·K01a·K03·K08·K09·K10·K11·K12·K17) + 겹침(다리) 4행(K02·K05·K13·K18; K13은 r3에서 404라 A7만 비교 가능 → K18 추가, §24-a). 명부 부분집합 파일 `roster/roster-v2.r4-subset.json`에 들어 있습니다. (시간이 되면 `roster/roster-v2.json` 전체 40행도 가능 — 그 경우 `run-meta.json`의 `rows_requested`를 40으로 적습니다.)
- 소요: 13행 약 3~5분(행당 최대 45초).

## 준비물

1. Node.js 20 이상 (`node -v`).
2. 저장소 받기(공개): `git clone https://github.com/ghwelcome0-cloud/lifeportfolio-site.git` 가 아니라 **rq 저장소**의 `docs/q90-public` 폴더. 받은 뒤 `cd docs/q90-public`.
3. `npm i puppeteer@24` (폴더 어디서든; 크롬 headless-shell이 같이 내려옵니다). 또는 이미 설치된 Chrome/Chromium 경로를 `LP_BROWSER_PATH`로 지정.
4. **도구 sha 확인(필수):**
   ```bash
   sha256sum tools/measure-e1.cjs   # c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b 이어야 함
   sha256sum roster/roster-v2.r4-subset.json   # c90a9c4fc20afed61727849b0aa41850c608bd17fb30fd170709e65ee917316f
   ```
   다르면 **실행하지 말고** 알려 주세요.

## 실행

```bash
RUN=runs/$(date -u +%F)-r4 && mkdir -p $RUN
# puppeteer를 npm으로 설치했으면:
PPTR_CORE=puppeteer LP_BROWSER_PATH="$(node -e "console.log(require('puppeteer').executablePath())")" \
  node tools/measure-e1.cjs roster/roster-v2.r4-subset.json $RUN 2>&1 | tee $RUN/measure.log
node tools/score-e1.cjs $RUN | tee $RUN/score.log
```

## 환경 기록 — `$RUN/run-meta.json` 를 손으로 만들어 넣습니다

```json
{
  "bound_commit": "9557e46",
  "run": "r4",
  "egress_country": "KR",
  "machine_kind": "owner-local-agent",
  "network_kind": "office-wired",
  "browser": "chrome-headless-shell 148.0.7778.97",
  "profile": "fresh (no cookies/cache, not logged in)",
  "rows_requested": 13,
  "bridge_rows": ["K02", "K05", "K13", "K18"],
  "started_utc": "2026-10-13T00:00:00Z",
  "ended_utc": "2026-10-13T00:05:00Z",
  "browser_lang_flag": "en-US",
  "os_kind": "Windows 11",
  "os_timezone": "Asia/Seoul",
  "accept_language_sent": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "tool_sha_before_run": "c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b",
  "roster_subset_sha256": "c90a9c4fc20afed61727849b0aa41850c608bd17fb30fd170709e65ee917316f"
}
```

- `egress_country`는 **국가 코드 두 글자만**. IP 주소·기계 이름·사용자명·회사 내부 주소는 **절대 넣지 않습니다**(Peer 결박). 그런 값은 대표 PC 메모에만.
- `browser`는 실제 버전으로. 148.0.7778.97과 다르면 다른 대로 적습니다(숨기지 않음).
- `network_kind`는 종류만(`home-wifi` / `office-wired` / `mobile-tether`).
- `os_kind`는 OS 종류·버전(기본 글꼴이 달라 글자 크기·가로 넘침 지표가 달라질 수 있어 비교 해석에 필요 — Peer). `os_timezone`은 OS 시간대 이름.
- `accept_language_sent`: 측정 **직전** 같은 headless 브라우저로 헤더 확인 페이지를 1회 열어 실제 보낸 `Accept-Language` 값을 적습니다(TL). 명령:
  ```bash
  PPTR_CORE=puppeteer node -e "const p=require('puppeteer');(async()=>{const b=await p.launch({headless:'shell',args:['--lang=en-US']});const pg=await b.newPage();await pg.goto('https://httpbin.org/headers');console.log(await pg.evaluate(()=>document.body.innerText));await b.close()})()"
  ```
  (도구는 브라우저를 `--lang=en-US`로 띄웁니다 — 국내 PC에서도 "영어 사용자"로 접속합니다. 이것은 r3·r4 공통 한계로 공개합니다. 한국어 설정 측정은 도구가 바뀌므로 r5.)
- `tool_sha_before_run`: 실행 **직전** `sha256sum tools/measure-e1.cjs` 출력을 그대로 붙입니다(도구가 스스로 적는 sha와 별개 — 실행자 증명, Peer).

## 보내는 것

`$RUN/` 폴더 전체를 압축해 GenTeam DM 또는 저장소 브랜치 `q90-public/e1-r4`로:
- `e1-results.json`, `e1-scored.json`, `run-meta.json`, `measure.log`, `score.log`, `*-390.png`(12장)

## 하지 말 것

- `tools/measure-e1.cjs`를 **수정하지 않기**(글자 하나라도). 타임아웃을 늘리고 싶어도 안 됩니다 — r3와 같은 조건이어야 비교가 성립합니다.
- 로그인한 브라우저 프로필 쓰지 않기. VPN·프록시 쓰지 않기(국내 출구가 아니게 됨).
- **r4는 1회 실행만 채택**합니다(Peer). 실패한 행을 다시 돌리거나 "성공한 것만" 보내지 않기. 한 번 돌린 결과 그대로 보냅니다. 다시 재야 하면 `r4b`가 아니라 **r5**(새 결박)로 넘깁니다.
- 결과 파일을 손으로 고치지 않기(run-meta.json만 손으로 작성).

## 총괄이 받은 뒤 하는 일(순서 고정)

1. `tools/measure-e1.cjs` sha가 `c276bb21…`와 같은지 → 2. 부분집합 sha → 3. `run-meta.json`에 IP·기계 이름 패턴이 없는지(`tools/verify-run-meta.cjs`) → 4. `score-e1.cjs` 재실행해 받은 `e1-scored.json`과 일치하는지 → 5. `assemble-latest.cjs runs/latest runs/2026-10-12-r3 runs/<날짜>-r4` → 6. 겹침 3행 `diff-runs.cjs` → G21 §25 기록 → 7. 표 재생성·PR.
어느 단계든 불일치면 r4를 채택하지 않고 사유를 적습니다.
