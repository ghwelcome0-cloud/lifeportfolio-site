# Q — Living Book 2행 toolbar 실장 설계

**결론 1.** `report.html`과 `program.html` 모두 같은 DOM 계약으로 바꾼다. 1행은 `이전 — 페이지 위치 — 다음`, 2행은 `축소 — 100% — 확대 — 한 화면 — 전체화면`이며, 모든 조작 버튼의 border-box를 최소 44×44px로 고정한다.  
**결론 2.** 34→27→22px 축소 분기는 **재정의가 아니라 제거**한다. 320px에서도 실제 내부 폭 264px에 대해 2행 최소 필요 폭이 234px이므로 30px 여유가 생기며, 버튼 축소가 필요 없다.  
**결론 3.** toolbar는 최초 페인트 전에 desktop 121px·mobile 117px의 높이를 예약한다. 다만 이 수치는 CSS 산술값이며 **[추정]** 이다. 실제 CLS 0 및 CWV 기준선 비열화는 동일 HEAD에서 게이트 5회 반복으로 확인되기 전에는 배포 판정을 내리지 않는다.

## 1. 확인 범위와 설계 원칙

### 저장소에서 직접 확인한 사실

- 확인 기준 checkout: `lifeportfolio-site`, HEAD `ac533ba` (detached HEAD). 이 문서는 코드를 변경하지 않았다.
- `report.html`과 `program.html`의 Living Book DOM은 동일한 ID 계약을 쓴다: `#lbPrev`, `#lbNext`, `#lbZoomOut`, `#lbZoomReset`, `#lbZoomIn`, `#lbZoomFit`, `#lbFull`.
- 두 파일 모두 현재 `.lb-stage__nav`가 `flex-wrap:wrap`이고, 440px 이하에서 위치 표시를 별도 줄로 내린다.
- 두 파일 모두 376px 이하에서 zoom 최소폭을 27px, 336px 이하에서 22px로 줄인다.
- 모바일 Living Book의 바깥 폭은 `body.living-book-on .container` 좌우 padding 14px, toolbar 좌우 padding 14px의 영향을 받는다.
- 현재 checkout에는 발주문에 적힌 `scripts/gates/touch_target_gate.mjs`와 `npm run test:cwv`가 없다. 따라서 아래 게이트 판정 절차는 발주문이 확정 사실로 제공한 후속 저장소 상태를 전제로 한 실행 설계이며, 이 checkout에서 실행한 결과가 아니다.

### 1행/2행 분배와 근거

| 행 | 요소 | 근거 |
|---|---|---|
| 1행: 페이지 이동 | `#lbPrev` · `#lbPos` · `#lbNext` | 현재 페이지 맥락과 이전/다음을 하나의 기능군으로 묶는다. 가운데 위치 표시를 유연폭으로 두면 양 끝의 44px 버튼을 침범하지 않는다. |
| 2행: 보기 조절 | `#lbZoomOut` · `#lbZoomReset` · `#lbZoomIn` · `#lbZoomFit` · `#lbFull` | 배율·맞춤·전체화면은 모두 현재 지면의 표시 방식 변경이다. 확대/축소 네 개는 기존 `role="group"`을 보존하고, 전체화면은 같은 행의 독립 조작으로 둔다. |

이 순서는 기능 군집과 키보드 탭 순서를 일치시킨다. 엔진은 ID 조회 방식이므로 ID를 보존하면 이벤트 연결 계약도 보존된다. 단, 실제 이벤트 회귀는 검증 절차에서 확인해야 한다.

## 2. 제안 마크업 diff

두 파일은 번역 키 prefix만 다르므로 구조를 반드시 대칭으로 유지한다.

### `report.html`

```diff
 <div class="lb-stage__bar">
-  <span class="lb-stage__pos" id="lbPos">페이지 —</span>
-  <span class="lb-stage__nav">
+  <div class="lb-toolbar" role="group" aria-label="리포트 페이지 및 보기 조작">
+    <div class="lb-toolbar__row lb-toolbar__row--page" role="group" aria-label="페이지 이동">
       <button type="button" class="lb-pgbtn" id="lbPrev" ...>...</button>
       <span class="lb-stage__pos" id="lbPos" aria-live="polite">페이지 —</span>
       <button type="button" class="lb-pgbtn" id="lbNext" ...>...</button>
+    </div>
+    <div class="lb-toolbar__row lb-toolbar__row--view" role="group" aria-label="보기 조절">
       <span class="lb-zoomgrp" role="group" aria-label="확대·축소">
         <button type="button" class="lb-zoombtn" id="lbZoomOut" ...>−</button>
         <button type="button" class="lb-zoombtn lb-zoombtn--lvl" id="lbZoomReset" ...>100%</button>
         <button type="button" class="lb-zoombtn" id="lbZoomIn" ...>+</button>
         <button type="button" class="lb-zoombtn lb-zoombtn--fit" id="lbZoomFit" ...>...</button>
       </span>
       <button type="button" class="lb-pgbtn lb-pgbtn--fs" id="lbFull" ...>...</button>
-  </span>
+    </div>
+  </div>
 </div>
```

### `program.html`

```diff
 <div class="lb-stage__bar">
-  <span class="lb-stage__pos" id="lbPos">페이지 —</span>
-  <span class="lb-stage__nav">
+  <div class="lb-toolbar" role="group" aria-label="실행 프로그램 페이지 및 보기 조작">
+    <div class="lb-toolbar__row lb-toolbar__row--page" role="group" aria-label="페이지 이동">
       <button type="button" class="lb-pgbtn" id="lbPrev" ...>...</button>
       <span class="lb-stage__pos" id="lbPos" aria-live="polite">페이지 —</span>
       <button type="button" class="lb-pgbtn" id="lbNext" ...>...</button>
+    </div>
+    <div class="lb-toolbar__row lb-toolbar__row--view" role="group" aria-label="보기 조절">
       <span class="lb-zoomgrp" role="group" aria-label="확대·축소">
         <button type="button" class="lb-zoombtn" id="lbZoomOut" ...>−</button>
         <button type="button" class="lb-zoombtn lb-zoombtn--lvl" id="lbZoomReset" ...>100%</button>
         <button type="button" class="lb-zoombtn" id="lbZoomIn" ...>+</button>
         <button type="button" class="lb-zoombtn lb-zoombtn--fit" id="lbZoomFit" ...>...</button>
       </span>
       <button type="button" class="lb-pgbtn lb-pgbtn--fs" id="lbFull" ...>...</button>
-  </span>
+    </div>
+  </div>
 </div>
```

`aria-live="polite"`는 페이지 위치만 알리며 toolbar 전체를 live region으로 만들지 않는다. 중첩 `role="group"`의 실제 스크린리더 발화가 과도하면 바깥 행의 `role/aria-label`만 제거하는 것을 후속 AT 실측으로 결정한다.

## 3. 공통 CSS diff 안

다음 블록을 **두 HTML의 현재 Living Book CSS에 동일하게** 적용한다. 공용 CSS 전환은 두 지면에서 검증된 뒤 별도 리팩터링으로 한다.

```diff
 .lb-stage__bar{
-  display:flex; align-items:center; justify-content:space-between; gap:10px;
+  display:block;
   padding:12px 20px; border-bottom:1px solid rgba(0,0,0,.07);
   background:rgba(255,255,255,.55); backdrop-filter:blur(4px);
   border-radius:0 22px 0 0; position:sticky; top:0; z-index:5;
+  min-height:121px;
 }
-.lb-stage__nav{ display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; min-width:0; }
+.lb-toolbar{display:grid;grid-template-rows:44px 44px;gap:8px;width:100%;min-width:0;}
+.lb-toolbar__row{width:100%;min-width:0;align-items:stretch;}
+.lb-toolbar__row--page{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:8px;}
+.lb-toolbar__row--view{display:grid;grid-template-columns:minmax(186px,1fr) 44px;gap:6px;}
+.lb-stage__pos{display:flex;align-items:center;justify-content:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 .lb-pgbtn{
   ...
+  min-width:44px;min-height:44px;justify-content:center;
 }
-.lb-pgbtn--fs{...margin-left:4px;}
+.lb-pgbtn--fs{...margin-left:0;padding-inline:0;}
-.lb-zoomgrp{display:inline-flex;align-items:stretch;margin-left:8px;...}
+.lb-zoomgrp{display:grid;grid-template-columns:44px 52px 44px minmax(44px,1fr);align-items:stretch;margin-left:0;min-width:186px;...}
 .lb-zoombtn{
   ...
-  min-width:34px;
+  width:100%;min-width:44px;min-height:44px;padding:6px 8px;
 }
-.lb-zoombtn--lvl{font-size:11.5px;...min-width:52px;...}
+.lb-zoombtn--lvl{font-size:12px;...min-width:52px;...}
-.lb-zoombtn--fit{gap:4px;font-size:11px;...padding:6px 10px 6px 9px;}
+.lb-zoombtn--fit{gap:4px;font-size:12px;min-width:44px;padding:6px 8px;overflow:hidden;white-space:nowrap;}

 @media (max-width:640px){
-  .lb-zoomgrp{margin-left:0}.lb-zoombtn{padding:6px 9px;min-width:30px}.lb-zoombtn--lvl{min-width:46px}.lb-zoombtn--fit{display:inline-flex}
+  .lb-zoombtn--fit{display:inline-flex}
 }
 @media (max-width:440px){
-  .lb-stage__bar{row-gap:8px}
-  .lb-stage__pos{flex:0 0 100%}
-  .lb-stage__nav{flex:0 0 100%;justify-content:space-between}
+  .lb-stage__bar{padding:10px 14px;min-height:117px}
   .lb-pgbtn--fs span,
   .lb-pgbtn#lbPrev span,
   .lb-pgbtn#lbNext span{display:none}
-  .lb-pgbtn{padding:7px 10px}
-  .lb-zoombtn--lvl{min-width:42px;font-size:11px}
-  .lb-zoombtn--fit{padding:6px 8px}
+  .lb-pgbtn{padding:0}
 }
+.lb-stage:fullscreen .lb-pgbtn,
+.lb-stage:fullscreen .lb-zoombtn,
+.lb-stage:-webkit-full-screen .lb-pgbtn,
+.lb-stage:-webkit-full-screen .lb-zoombtn{min-height:44px;}
-@media (max-width:376px){
-  .lb-pgbtn{padding:7px 9px}
-  .lb-zoombtn{padding:6px 7px;min-width:27px}
-  .lb-zoombtn--lvl{min-width:38px;font-size:10.5px}
-  .lb-zoombtn--fit{padding:6px 7px;font-size:10.5px}
-}
-@media (max-width:336px){
-  .lb-stage__nav{gap:5px}
-  .lb-pgbtn{padding:7px 6px}
-  .lb-zoombtn{padding:6px 4px;min-width:22px}
-  .lb-zoombtn--lvl{min-width:34px;font-size:10px;letter-spacing:-.02em}
-  .lb-zoombtn--fit{padding:6px 6px;font-size:10px}
-}
```

### 축소 분기를 제거하는 이유

1. 44px 목표와 27/22px 규칙은 직접 충돌한다.
2. 새 구조는 폭이 모자라면 버튼을 줄이는 대신 행별 grid가 남는 폭을 배분한다.
3. utility 글씨는 12px 안전선을 지킨다. 기존 11.5/11/10.5/10px로의 축소를 답습하지 않는다.
4. `minmax(0,1fr)`와 `min-width:0`으로 긴 위치 텍스트가 버튼을 밀어내지 못하게 한다.

## 4. 390/360/320px 폭 보장 계산

모바일에서 확인된 CSS를 그대로 대입한다.

`toolbar 내부 폭 = viewport − container 좌우 14×2 − toolbar 좌우 14×2 = viewport − 56px`

| viewport | toolbar 내부 폭 | 1행 고정폭 | 1행 위치표시 가용폭 | 2행 zoom 가용폭 | 2행 최소 필요폭 | 잔여폭 |
|---:|---:|---:|---:|---:|---:|---:|
| 390 | 334 | 44+8+8+44 = 104 | 230 | 334−6−44 = 284 | 186+6+44 = 236 | 98 |
| 360 | 304 | 104 | 200 | 254 | 236 | 68 |
| 320 | 264 | 104 | 160 | 214 | 236 | 28 |

zoom group 내부 column 최소폭 184px의 산식은 `44(−)+52(100%)+44(+)+44(한 화면)=184`이다. 여기에 group 좌우 border 2px를 더해 outer 최소폭을 186px로 잡는다. group 내부는 별도 gap이 없고 기존 인접 버튼 border로 구분한다. 320px에서도 실제 배정 zoom outer 폭 214px가 최소 186px보다 28px 크다. 따라서 **CSS 산술상** 겹침과 가로 넘침이 발생하지 않는다.

`한 화면` 텍스트의 실제 글꼴별 advance width는 이 checkout에서 렌더 실측하지 않았다. 셀에는 74px(320px에서 `214−44−52−44`)가 배정되므로 **[추정]** 상 한국어 12px 라벨+14px SVG+gap 4px+좌우 padding 16px가 들어간다. 통과 조건은 추정이 아니라 검증 시 `scrollWidth <= clientWidth`와 텍스트 클리핑 0으로 확정한다. 실패하면 12px 미만 축소 대신 336px 이하에서 시각 텍스트를 숨기고 기존 `aria-label`을 유지한다.

## 5. CLS 예약값과 회귀 위험

### 예약 높이

- desktop: `12px 상단 padding + 44px 1행 + 8px gap + 44px 2행 + 12px 하단 padding + 1px border = 121px`
- mobile(≤440): `10 + 44 + 8 + 44 + 10 + 1 = 117px`

따라서 `.lb-stage__bar{min-height:121px}`와 모바일 `.lb-stage__bar{min-height:117px}`를 **초기 CSS에** 둔다. 이 값은 선언된 박스모델 계산에 따른 **[추정]** 이고 실브라우저 측정값은 아니다.

중요한 판정 한계: `min-height`는 toolbar 내부의 폰트·아이콘 로딩으로 인한 추가 재배치를 막을 수 있지만, `#livingBook[hidden]` 자체가 JS 실행 뒤 처음 나타나는 구조라면 숨김→표시 전환 전체의 CLS를 혼자 0으로 만들 수 없다. Living Book 활성 상태는 첫 페인트 전에 동기적으로 결정하거나, 교체되는 자리의 컨테이너에도 동일 높이를 예약해야 한다. 이 조건 없이 “CLS 0 보장”이라고 쓰면 거짓이다.

### 회귀 위험 목록

1. **초기 상태 전환:** `hidden` 제거가 첫 페인트 뒤라면 toolbar 예약 여부와 무관하게 아래 콘텐츠가 이동할 수 있다.
2. **전체화면 overlay:** toolbar가 117/121px가 되면서 지면 상단을 더 가릴 수 있다. report의 bar 높이 전달/fit 재계산과 program의 대응 여부를 각각 실측해야 한다.
3. **고정 stage 높이:** desktop `height:calc(100vh - ...)` 안에서 toolbar가 커지면 iframe 가용 높이가 감소해 지면 배율이 바뀔 수 있다.
4. **모바일 iframe bridge:** iframe 동적 높이 통지 시점과 toolbar 표시 시점이 엇갈리면 2차 이동이 생길 수 있다.
5. **폰트/번역:** KO/EN 라벨 폭, fallback font, 200% zoom에서 높이가 44px 두 행을 초과할 수 있다.
6. **sticky/focus:** 두 행 sticky 영역이 커져 본문을 더 가리거나, 포커스된 요소가 sticky bar 뒤에 놓일 수 있다.
7. **스크린리더 verbosity:** toolbar→row group→zoom group의 중첩 이름이 과도하게 발화될 수 있다.
8. **PDF/capture:** Living Book toolbar가 PDF 캡처 경로에 포함되는지 확인하지 않으면 페이지 시작점·클리핑이 달라질 수 있다.
9. **브라우저 fullscreen 차이:** 표준 `:fullscreen`과 `:-webkit-full-screen` 양쪽에서 2행 높이와 pointer 접근성을 확인해야 한다.

CLS 판정은 “새 toolbar 자체의 LayoutShift entry 기여값 0”과 “페이지 전체 CLS”를 분리한다. 전체 CLS 통과 상한은 새 임의값이 아니라 기존 보수 기준 `0.0501`을 비열화 기준으로 삼는다.

## 6. 검증 순서와 통과 판정

### 0단계 — 증거 결박

1. exact HEAD, lockfile digest, Chrome 버전, OS, viewport/deviceScaleFactor, locale, 실행 시각을 기록한다.
2. synthetic fixture/격리 preview만 사용하고 실제 고객·결제 데이터에는 쓰지 않는다.
3. baseline과 candidate는 같은 HEAD에서 patch 유무만 다르게 만든다.

### 1단계 — 정적 계약 검사

- 두 파일에 7개 ID가 각각 정확히 1개인지 확인.
- DOM 탭 순서가 `Prev → Next → ZoomOut → ZoomReset → ZoomIn → ZoomFit → Full`인지 확인.
- 27px/22px 및 12px 미만 toolbar 글꼴 선언이 제거됐는지 확인.
- JS가 참조하는 ID와 기존 title/aria-label/data-i18n 키가 보존됐는지 확인.

### 2단계 — toolbar 전용 브라우저 검사

각 파일 × 390/360/320/1440 × KO/EN(지원되는 실제 locale 경로)에서 다음을 수집한다.

- 7개 버튼의 `getBoundingClientRect()`; 보이는 버튼은 width≥44, height≥44.
- `.lb-stage__bar`: `scrollWidth <= clientWidth`.
- 각 버튼: viewport 좌우/상하 경계 안, pairwise rectangle intersection 0.
- 각 라벨: `scrollWidth <= clientWidth`, 잘림 0.
- 실제 toolbar 높이: mobile≤117px, desktop≤121px. 초과하면 예약값 실패로 중단한다.
- 키보드 Tab/Shift+Tab, Enter/Space, 방향키 페이지 이동, zoom/reset/fit/fullscreen 동작.
- 200% zoom과 coarse pointer 모드에서 focus ring, sticky 가림, fullscreen 탈출 확인.
- console error 및 실패 network 요청 0(사전에 허용한 비결정적 외부 요청은 별도 분류).

이 단계가 실패하면 CWV를 돌리지 않는다. 구조 결함이 있는 후보의 120회 측정은 낭비다.

### 3단계 — 터치타깃 게이트

`scripts/gates/touch_target_gate.mjs`를 먼저 실행한다.

통과 근거:

1. 내장 음성 통제군 PASS: 43×44 또는 44×43 결함 삽입본은 `AAA_MIN=44`에서 실패하고, 44×44 청정본은 통과해야 한다.
2. `report.html`·`program.html`의 위 7개 가시 조작 각각 44×44 이상.
3. `AA_MIN=24`는 기존 mobile 208/208, desktop 210/210에서 1건도 회귀하지 않는다.
4. `scoreItem4()`의 page/view별 원자료와 집계식이 보존되고, 전체 AAA 비율이 baseline보다 상승한다. 특정 목표 점수는 현재 게이트의 구간식을 이 checkout에서 확인하지 못했으므로 **미확인**이다.
5. 전체 평균 상승만으로 통과시키지 않는다. Living Book ID별 실패 0을 별도 hard assertion으로 둔다.

### 4단계 — CWV 게이트

터치타깃 통과 뒤 `npm run test:cwv`를 실행한다: 12지면 × 2 viewport × 5회.

통과 근거:

- 각 URL/viewport의 5회 원자료를 보존한다.
- 저장소 게이트가 정한 보수 집계값으로 candidate 최악 CLS가 `0.0501` 이하이며 baseline보다 악화되지 않아야 한다.
- candidate 최악 LCP가 기존 `1,112ms`보다 악화되지 않아야 한다. 측정 잡음 허용치가 게이트에 명시돼 있지 않다면 임의 허용치를 만들지 않고, 한 번이라도 초과하면 재현·원인분리 전 배포 보류한다.
- LayoutShift entry에서 `.lb-stage__bar`, `.lb-frame`, toolbar 아래 첫 콘텐츠를 source별로 기록한다. toolbar 기여 CLS는 0이어야 한다.
- LCP element가 baseline과 candidate에서 같은지 확인한다. 대상이 바뀌면 숫자만 비교하지 않고 회귀로 조사한다.

### 5단계 — 교차기능 최종 확인

- report/program 각각 첫 페이지·중간 페이지·마지막 페이지에서 disabled 상태와 페이지 위치 갱신.
- zoom min/max, reset, fit, fullscreen 진입/종료.
- 320/360/390/430/1440px, KO/EN, Chrome 및 가능한 실제 WebKit/Safari 경로.
- PDF 빈 페이지·클리핑, toolbar 혼입 여부.

최종 통과는 `전용 구조 검사 PASS ∧ touch target 음성 통제군 PASS ∧ Living Book 44px 실패 0 ∧ AA 회귀 0 ∧ CWV 비열화 0 ∧ 핵심 조작 회귀 0`일 때만 선언한다.

## 7. 음성 통제군(반대 실험)

### 실험 설계

동일 HEAD·동일 fixture·동일 브라우저에서 다음 두 빌드를 번갈아 측정한다.

- **A(candidate):** 제안한 2행 grid + 44px + 117/121px 예약.
- **B(negative control):** DOM/JS/데이터는 그대로 두고 CSS만 기존 한 줄 wrap 및 34→27→22px 규칙으로 되돌린다. 즉 결함 원인만 재삽입한다.

실행 순서는 캐시/열화 편향을 줄이기 위해 `A-B-B-A-A-B`처럼 교차하고, 각 run 전 동일한 storage/cache 조건을 적용한다. 결과에는 run 순서와 원자료를 남긴다.

### 통제군이 반드시 나빠져야 하는 지표

1. 320px B에서 `#lbZoomOut/#lbZoomReset/#lbZoomIn/#lbZoomFit` 중 하나 이상이 44px 미만이어야 한다. 그렇지 않으면 결함 삽입 실패이므로 실험 무효다.
2. B의 Living Book ID별 AAA 실패 수가 A(목표 0)보다 커야 한다.
3. B의 `scoreItem4()` 원점수가 A보다 낮아야 한다. 같다면 집계식이 개선을 감지하지 못하는 것이므로 게이트 보강 전 통과 금지다.
4. 과거 한 줄 구조의 overflow를 별도 재현 fixture로 삽입했다면 B에서 `scrollWidth > clientWidth` 또는 버튼 경계 이탈을 검출하고 A에서는 검출하지 않아야 한다.

CWV는 이 변경의 효능 지표가 아니라 안전성 지표다. B의 CLS가 A보다 반드시 나빠야 한다고 요구하면 안 된다. 기존 작은 toolbar가 오히려 CLS 수치만 낮출 수도 있기 때문이다. 효능의 음성 통제는 44px/overflow 지표로, 부작용의 음성 통제는 toolbar 예약을 제거한 별도 C군으로 나눈다.

- **C(CLS negative control):** A와 같지만 `min-height` 예약만 제거하고, 테스트 fixture에서 toolbar 내부 내용을 첫 페인트 뒤 삽입한다.
- C에서 toolbar 관련 LayoutShift entry > 0, A에서 0이어야 예약 검사가 살아 있다고 판정한다.

## 8. 구현 후 남겨야 할 증거

- exact HEAD/manifest 및 diff
- 각 viewport의 toolbar 내부 폭·각 버튼 rect·scrollWidth/clientWidth JSON
- KO/EN·200% zoom·fullscreen 스크린샷(개인정보/token 제거)
- touch target 음성 통제군 및 실페이지 결과
- CWV 120개 조건의 5회 원자료, 보수 집계값, LCP element, LayoutShift sources
- A/B 및 A/C 통제군 결과

## 내가 확인하지 못한 것

1. 후속 저장소에 존재한다는 `scripts/gates/touch_target_gate.mjs`, `AA_MIN`, `AAA_MIN`, `scoreItem4()`의 실제 구현과 점수 구간은 현재 checkout에 없어 확인하지 못했다.
2. `npm run test:cwv`의 실제 script, 12개 URL 목록, 두 viewport 정의, 5회 보수 집계 방식은 현재 checkout에서 확인하지 못했다.
3. 117/121px는 CSS 산술에 따른 **[추정]** 이며 Chrome 실측값이 아니다. 실제 폰트·border·fullscreen 환경에서 측정해야 한다.
4. 390/360/320px에서 `한 화면` 라벨의 실제 렌더 폭과 클리핑 여부는 미측정이다.
5. Living Book 활성화 시 `hidden` 제거가 first paint 전인지 후인지, 그 전환이 현재 CLS에 얼마를 기여하는지 미측정이다.
6. 2행 toolbar 적용 뒤 CLS 0, 최악 CLS≤0.0501, LCP≤1,112ms는 아직 실측하지 않았으므로 보장하지 않는다.
7. program 전체화면에서 report와 동일한 bar 높이 전달·fit 보정이 존재하는지는 이번 정적 범위에서 끝까지 추적하지 못했다.
8. 실제 Safari/iOS VoiceOver 및 Android TalkBack의 중첩 group 발화는 미측정이다.
