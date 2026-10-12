# KB-03 공개 비교표 플레이북 — 순위 없이, 근거 등급별로, 분모를 정직하게

실전: 공개 비교표 v2(명부 41행, 축 A1~A8, 2026-10-08~12). 설계 전문은 `docs/q90/G21_공개비교표_v2_설계_2026-10-12.md`(§1~§21), 데이터는 `docs/q90-public/`.

## ① 확인된 것
**구조**
- 순위 열 없음. 셀마다 **근거 등급**: E1 실측(굵게) · E2 공개 샘플 리포트 채점("(샘플)") · E3 공개 문서("(문서)") · E4 공개 반응. **미측정 ≠ 0점**. 고정 축 A2·A3·A4(★)는 어떤 개정에서도 안 빠짐.
- 자사 행은 Q90 scorer 전사만, 비교 대상은 E2 블라인드 judge → 같은 열이라도 **직접 비교 금지**를 표 머리에 명시.
- 명부·루브릭은 **결과 보기 전 고정**(`frozen_before_results:true`), 개정 시 version 올림.

**E3(공개 문서) 수집 규칙**
- 값은 `{value, source_url, collected_at, note}` 묶음. **source_url 없는 값은 표에 올리지 않는다.** 명부 값이 시트 값과 다르면 시트(출처 있음)가 우선(빌더 2판 결함에서 배움).
- 핵심 7칸(provider·access·price_band·price_transparency·appeal·limits·korean_support)으로 진척을 센다.
- 가격이 JS로만 렌더되는 사이트는 서버 크롤·JS 렌더 크롤 모두 본문에 숫자가 안 나올 수 있다 → **로컬 headless chrome으로 직접 렌더**(`tools/render-price.cjs <targets.json> <out.json>`, puppeteer-core + 저장소 node_modules에서 실행)하면 Strengths Profile(£15/£40/£70)·15Five($4/$11/$16)·BestSelf($36)는 잡힌다. mbtionline·Full Focus·SDS·인싸이트·가이던스는 렌더해도 본문에 가격 없음(결제 단계/로그인 뒤). 공식 PDF 가격표(어세스타)는 `summarize_large_document`로 원문 전사. 제3자(Truity 등) 인용가는 **미채택**.
- **"비공개" 표기 규약(2026-10-12):** A8.1이 "문의/숨김"으로 공식 출처에서 확인된 행은 price_band에 "비공개"(출처=A8.1 근거 URL). "미측정"(근거 없음)과 구분. 점수 아님(A8.2 display_only). 표 범례에 명시.
- **E1 측정의 egress 한계:** 샌드박스(해외 IP)에서 고용24(work24.go.kr)·어세스타(career4u.net)는 연결 시간 초과 → 국내 egress(로컬 에이전트)로 별도 run. 재현성 위해 같은 run에 append하지 않고 run 번호를 나눈다(팀 확인 중).
- 효율: `gsk batch_crawl_url_and_answer`에 행당 2~3 URL × 7문항(원문 인용 요구) → 38 URL을 25초에 처리. 결과 파싱은 `## [url]` 블록 + `### Question:` 단위.

**E2 분모(결박 §21)**
- "해당 없음"은 **제품 구조상 개인 리포트가 없음이 공식 문서로 확인된 경우만**(근거 URL+원문+UTC). 리포트는 있는데 공개 샘플이 없으면 "미확보(비공개 포함)" — 분모에 남김. 제3자 호스팅만 있으면 "미채택". 애매하면 남김.
- 두 분모를 함께 공개: "E2 측정 9 / 대상 37(해당 없음 3 제외) / 명부 40". 진행률 보고에서 **분모 정정 효과(+1%p)를 작업 진척과 분리**.
- 실측: 엄격 적용하면 27행 중 3행만 후보(플래너 2·문항 저장소 1). 코칭 플랫폼은 "리포트 없음" 문장이 없어 남김. **대조에서 TL·Peer 판정이 갈린 2행(E06·E07)은 "애매하면 남김"으로 미확인 처리 → 최종 해당 없음 1행**(Method 6082272 경로). 행 단위는 **명부 URL의 제품**(회사가 아님) — 다음 명부 개정 결박 항목.

**진행률 보고 방식**
- `tools/progress.cjs --md`: 전체 가중 %(E1 25·E3 25·E2확보 15·E2채점 25·자사 10)를 **첫 줄**에, 단계별 표 다음. 숫자가 안 움직인 이유도 적는다(E2채점은 judged를 완료로 세고 있어 제3자 단계가 %를 안 올렸음).

**공개 전 자료 보관**
- 이 저장소는 **공개**다(`gh repo view` visibility PUBLIC). 검토(G19) 전 레벨 값은 저장소 밖(AI Drive)에 두고 확정본만 push(⑭에서 배움). 이미 올라간 것은 되돌리지 말고 "확정본 아님"으로 표기.

## ② 아직 모르는 것
- E1 r3(새 측정기 `measure-e1.cjs`)의 r2 대비 차이 — r1/r2는 구 도구 이관분(`imported:true`).
- E4(공개 반응, 표본 ≥20) 수집 방법 미착수.
- D7 카드 선택 페이지 데이터 형식(표 확정 뒤).

## ③ 도구·파일
- `tools/build-table.cjs roster rubric runDir e3.json e2.json [own.json]` → `table-v2.{md,html,json}`; ‡ 표시 = 제3자 선택 칸, 각주 자동.
- `tools/gen-e3-sheet.cjs`, `tools/gen-e2-sheet.cjs`(salt 기반 blind_id: `S-`+sha256(salt|id|version)[0:6], salt는 채점 뒤 공개 — `salt_revealed`), `tools/progress.cjs`
- 크롤 배치 예: `/home/user/work/e3/jobs.json`(7문항 템플릿), `answers.md`(원문 보관)

## ④ 실수 장부(이 영역)
빌더 2판: 명부 값이 시트를 덮어씀(K08 80→90) · ⑭ 공개 저장소 push · 수치 전사(41/41→40/40).

## ⑤ 바로 시작하는 명령
```bash
cd docs/q90-public
node tools/progress.cjs --md                      # 현재 위치
# E3 한 배치: targets → gsk batch_crawl_url_and_answer → 시트에 {value,source_url,…}로 기입(출처 없으면 비움)
node tools/build-table.cjs roster/roster-v2.json rubric/rubric-v2.json runs/<latest> sheets/e3-docs.json sheets/e2-samples.json
```
