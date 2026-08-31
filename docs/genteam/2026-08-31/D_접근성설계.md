# 발주 D — 터치타깃·작은 글씨·KWCAG 2.2 개선 설계

기준일: 2026-08-31  
코드 기준: 확인 가능한 저장소 `origin/main@b03e219`  
실측 기준선: 총괄 제공 2026-08-31 Chrome 148, 12페이지 × PC 1440 / 모바일 390 결과  
범위: CSS/HTML 개선 설계만. 코드·엔진·성역 파일 수정 및 배포 없음.

## 0. 먼저 바로잡을 기준

- 제공 실측상 WCAG 2.2 **2.5.8 AA 24×24 CSS px**는 PC 210/210, 모바일 208/208로 통과했다.
- 44×44는 WCAG 2.2 **2.5.5 AAA** 목표다. 법적 적합성이나 한국 웹접근성 품질인증 통과를 이 수치 하나로 단정할 수 없다.
- 2.5.8 AA에는 `spacing` 예외가 있지만, 2.5.5 AAA에는 **inline과 essential 예외만** 있다. 따라서 간격만 충분한 30px 버튼은 AA에는 적합할 수 있어도 AAA 44px 달성으로 계산하면 안 된다.
- KWCAG 2.2의 6.1.3은 컨트롤 대각선 6.0mm 이상을 “바람직”하다고 설명한다. 24px/44px 통계와 KWCAG 심사 결과는 별도 기록한다.

근거:
- WCAG 2.2 SC 2.5.5: https://www.w3.org/TR/WCAG22/#target-size-enhanced
- WCAG 2.2 SC 2.5.8: https://www.w3.org/TR/WCAG22/#target-size-minimum
- KWCAG 2.2 공개 열람본: https://a11ykr.github.io/kwcag22/

## 1. AAA 44px 개선 우선순위

현재 크기가 개별 제공되지 않은 셀은 `개별 미측정`으로 남겼다. 위반 개수만으로 크기를 추정하지 않는다.

| 우선 | 페이지 / 요소군 | 제공된 현재값 | 목표·처방 | 레이아웃 위험 | 판정 |
|---|---|---:|---|---|---|
| P0 | `report.html` 확대/축소 `.lb-zoombtn` | 최악 30px | 시각 버튼은 유지하고 hit area만 44×44. `.lp-a11y-target` 또는 pseudo hit-area 적용 | **매우 높음**. 툴바는 320~440px에서 이미 줄바꿈·가로 넘침을 피하려고 22~42px로 축소됨(`report.html:359-430`). 전부 44px이면 390px 한 줄 배치 불가 | 모바일에서는 2행 toolbar 또는 zoom group을 별도 행으로 분리한 뒤 44px 적용. report.html은 이번 작업에서 수정 금지이므로 후속 전용 PR |
| P0 | `report.html` 이전/다음 `.lb-pgbtn` | 최악 34px | 44px hit area, 아이콘·라벨 accessible name 유지 | 높음. 현재 `@media <=440/376/336`에서 padding을 계속 줄임(`:400-430`) | 이전/다음/전체화면을 44px 정사각형, 확대군은 다음 행. 단순 min-size 덧씌우기 금지 |
| P0 | `report.html` 브랜드 링크 | 최악 34px | 링크 자체 또는 wrapper hit area 44px | 중간. TOC 폭·높이 증가 | 브랜드 시각 크기는 유지하고 block padding으로 hit area 확대 |
| P0 | `program.html` viewer toolbar | 개별 미측정, 위반 MO10/PC12 | report와 동일 컴포넌트 계보(`program.html:339-370`)를 한 묶음으로 수정 | 매우 높음. 동일 320px 압축 규칙 존재 | report 전용 수정과 동시에 공통 viewer 설계로 맞추되 파일별 검증 |
| P0 | `login.html`, `signup.html` provider/submit/forgot/보조 링크 | 각 9 / 7개 위반 | 주요 인증 버튼·submit은 44px. 비밀번호 찾기·약관 링크는 inline 예외 여부 분리 | 중간. 세로 높이만 증가 | primary controls 먼저; 문장 속 약관 링크는 AAA inline 예외 가능, 독립 링크는 확대 |
| P0 | `b2b.html`, `b2b-quote.html` CTA·폼 control | 각 7 / 2개 위반 | input/button 44px; 독립 CTA 44px | 낮음~중간 | B2B 전환 경로이므로 먼저 수정. 문장 내 링크만 inline 예외 검토 |
| P1 | `index.html` nav/auth/lang/CTA/FAQ | MO10/PC15 | CTA·언어전환·FAQ summary 44px; nav 텍스트 링크는 간격이 아니라 실제 target 확대 우선 | 높음. desktop nav 폭, mobile sticky CTA 밀도 | PC 메뉴는 세로 padding으로, 모바일 auth/nav는 메뉴 구조 재배치 후 44px |
| P1 | `checkin-21(.en).html` CTA·FAQ·폼 | 4/4, 3/3 | 폼·FAQ summary·CTA 44px | 낮음 | KO/EN 동시 변경·동시 회귀 |
| P1 | `mypage.html` action links | 2/2 | 독립 action은 44px | 중간. 카드 metadata와 충돌 가능 | 카드 action 영역만 확대, tag·metadata는 비대상 확인 |
| P1 | `checkin-21-form(.en).html` control | 각 1/1 | 해당 form control 44px | 낮음 | KO/EN 함께 수정 |

### 1.1 올리지 않아도 되는 것 / 예외 판정

1. **문장 흐름 안의 링크**: WCAG 2.5.5 AAA의 inline 예외에 해당할 수 있다. 약관 문장 속 링크처럼 line-height에 묶인 target은 44px 강제 시 문단 리듬이 깨지므로 제외 가능하다. 단, 독립 nav/CTA를 CSS상 inline으로 만든 것만으로 예외 처리하면 안 된다.
2. **동일 기능의 44px 대체 control이 같은 페이지에 존재**하면 equivalent 예외는 2.5.8 AA에 적용 가능하나, AAA 2.5.5의 일반 예외는 아니다. AAA 목표 통계에서는 제외하지 않는다.
3. **충분한 spacing**은 2.5.8 AA 판정에는 쓸 수 있으나 AAA 44px에는 쓸 수 없다. 이번 64.8~67.3% AAA 분모에서 spacing 예외로 통과 처리하면 지표 조작이다.
4. **user-agent control**은 2.5.8 AA 예외일 수 있다. 브라우저 기본 date picker 내부 버튼처럼 작성자가 크기를 바꾸지 않은 control은 별도 N/A로 분리한다.
5. disabled·hidden·`display:none` 요소는 현재 상호작용 모집단에서 제외하되, 활성 상태가 되는 시나리오에서는 다시 측정한다.

### 1.2 `.lp-a11y-target` 적용 규칙

```css
.lp-a11y-target {
  min-inline-size: 44px;
  min-block-size: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- 시각 아이콘을 44px로 키우는 것이 아니라 **hit area**를 키운다.
- flex/grid 안에서는 `flex:0 0 auto`와 wrapping을 설계하고, 320/390/430/1440에서 overflow와 겹침을 재검사한다.
- inline 본문 링크에는 적용하지 않는다.
- 현재 확인 가능한 `main@b03e219`에는 `assets/css/a11y-core.css`가 없어, 실제 적용 전 해당 파일이 존재하는 exact HEAD 확인이 필요하다.

## 2. 작은 글씨 212건 개선 방침

212건은 총괄이 제공한 “고객 노출 선언” 수치이며, 개별 computed style·역할 분류 원자료는 이번 발주에 제공되지 않았다. 따라서 212건 전부를 본문 결함으로 판정하지 않는다.

### 2.1 역할별 안전 최소값

| 역할 | 권장 최소 | 처리 |
|---|---:|---|
| 본문·설명·도움말·오류·사용 지시 | 16px (`--fs-base`) | 12px 미만이면 P0. 모바일에서 16px 미만으로 축소 금지 |
| 보조 본문·카드 설명·nav | 14px (`--fs-sm`) | 12px 미만이면 P1 |
| caption·figcaption·metadata·날짜 | 12px (`--fs-xs`) | 10~11.5px를 12px로 올리고 line-height ≥1.5 |
| badge·eyebrow·순번·장식 label | 11~12px (`--fs-2xs`) | 의미가 중복 제공되고 대비가 충분할 때만 11px 허용; 핵심 정보면 12px 이상 |
| 입력값·label·button text | 14px 이상, text input은 16px | iOS 자동 확대 방지와 오류 인지를 위해 축소 금지 |

토큰 자체는 `--fs-2xs:11px`, `--fs-xs:13px`, `--fs-sm:15px`처럼 페이지별 정의가 확인됐다(`index.html:594-596`). 전역 토큰 값을 일괄 변경하면 카드·toolbar·PDF pagination이 연쇄 파손될 수 있으므로 **역할 selector를 토큰으로 이관한 뒤 단계별 변경**한다.

### 2.2 페이지별 방침

- `program.html` 63건 / `report.html` 46건: viewer toolbar, TOC 번호·종류, badge·timeline, PDF 지면을 분리한다. toolbar의 10~11.5px는 12px 이상으로 올리되 44px control 재배치와 함께 처리. PDF 지면은 pagefit/blankpage 회귀가 필수다. report.html은 현재 수정 금지.
- `b2b.html` 10건: section eyebrow·badge는 12px, 설명/문의/법적 고지는 14~16px. inline style 생성부도 렌더 후 computed style로 확인한다.
- `checkin-21(.en).html` 8/9건: day label·stage·flag는 12px, field hint/footer는 12~14px. KO/EN 줄바꿈을 각각 320/390/430에서 확인한다.
- `product.html` 7건: 가격·환불·동의·법적 고지는 최소 14px, 장식 badge만 12px 허용.
- `mypage.html`: 11px tag는 12px; 동적 `<details>` 안내는 14px, latest badge는 12px.
- `checkin-21-form(.en).html`: brand subtitle/count는 12px. 입력·label 본문은 16/14px 유지.

### 2.3 반려할 일괄 변경

- `font-size:10px → 12px` 전역 치환
- `--fs-2xs` 하나를 13px로 올려 전체 페이지를 간접 변경
- PDF/리포트 지면을 pagefit 없이 상향
- line-height·container width·wrap 결과를 보지 않은 폰트만 상향

검증은 320/390/430/1440, KO/EN, 200% zoom에서 overflow·clipping·CTA overlap·PDF page count를 함께 본다.

## 3. 아직 낮은 3영역을 5점으로 올리는 조건

### 키보드·보조기술 2→5

- 모든 핵심 흐름을 Tab/Shift+Tab/Enter/Space/Escape로 완주, keyboard trap 0.
- focus order가 DOM 의미 순서와 일치하고 sticky/header/modal에 가려진 focus 0.
- 공통 `:focus-visible` 2px 이상 고대비 indicator를 모든 interactive role에 적용. outline 제거 시 동등한 대체가 반드시 존재.
- modal: 진입 focus, trap, Escape, 닫은 뒤 trigger 복귀, 배경 inert.
- NVDA+Chrome(Windows), VoiceOver+Safari(iOS/macOS), TalkBack+Chrome(Android)에서 name/role/value/status 읽기.
- 결과 생성·오류·결제 상태는 `aria-live`/status로 알리고, 색·toast만으로 전달하지 않음.
- 12개 핵심 페이지와 실제 상태 변형에 대한 수동 증빙이 있어야 5점. axe 통과만으로는 불충분.

### 텍스트 가독성 3→5

- 본문/도움/오류 16px, 보조 14px, caption 12px 역할 기준 충족.
- 일반 텍스트 4.5:1, 큰 텍스트 3:1, UI/그래픽 3:1을 실제 배경 합성 후 검사.
- 200% text zoom과 400%/320CSS px reflow에서 내용·기능 손실, 양방향 스크롤, clipping 0.
- WCAG text-spacing override(줄 1.5, 문단 2, 글자 .12em, 단어 .16em)에서 손실 0.
- KO/EN 모두 긴 단어·주소·숫자·오류문구 fixture로 검증.

### 핵심 경로 무결성 2→5

- 공개 read-only: 홈→가입/로그인→상품/약관/문의, 비로그인 report gate를 반복 실행.
- write 경로: 격리 preview + synthetic account + sandbox payment에서 가입→결제→76문항→리포트→PDF→21일 체크인을 E2E.
- PC 1440, 모바일 320/375/390/430, KO/EN 전 조합 expected/observed exact; filtered/empty/skip 우회 금지.
- console/pageerror/4xx·5xx, dead link, focus, 44px, overflow를 동일 실행에 결박.
- production fingerprint 또는 격리 미증명 시 green/skip이 아니라 `FAILED_BLOCKED` non-zero.

## 4. KWCAG 2.2 33개 체크리스트

`통과`는 제공 실측이 해당 항목 전체를 직접 뒷받침할 때만 사용했다. `미통과`는 명시 결함, 나머지는 `미측정`이다.

| # | 검사항목 | 현재 판정 | 필요한 증빙/조치 |
|---:|---|---|---|
| 1 | 적절한 대체 텍스트 제공 | 미통과 | alt 누락 2건 수정 후 의미/장식 적절성 수동 검토 |
| 2 | 자막 제공 | 미측정 | 모든 영상·음성의 동등 자막/대본·화면해설 표본 |
| 3 | 표의 구성 | 미측정 | caption, th/scope, 복합 header 관계 검사 |
| 4 | 콘텐츠의 선형구조 | 미측정 | CSS 제거·스크린리더 reading order 검증 |
| 5 | 명확한 지시사항 제공 | 미측정 | 색·위치·모양·소리만 의존한 지시 전수검사 |
| 6 | 색에 무관한 콘텐츠 인식 | 미측정 | chart/state를 색 외 text/pattern으로 구분 |
| 7 | 자동 재생 금지 | 미측정 | 3초 초과 자동 음원 및 제어 확인 |
| 8 | 텍스트 콘텐츠 명도 대비 | 미측정 | 전 상태·실제 배경 기준 4.5:1/3:1 검사 |
| 9 | 콘텐츠 간의 구분 | 미측정 | 인접 control·card·focus UI의 3:1/경계 수동검사 |
| 10 | 키보드 사용 보장 | 미측정 | 핵심 흐름 keyboard-only 완주 |
| 11 | 초점 이동과 표시 | 미측정 | 순서·trap·가림·visible focus 검사 |
| 12 | 조작 가능 | 부분 확인 | 24×24는 100%; KWCAG 6mm 권고·간격·실기기 오조작은 별도 |
| 13 | 문자 단축키 | 미측정 | 단일 문자 shortcut 존재·off/remap/focus-only 확인 |
| 14 | 응답시간 조절 | 미측정 | auth/session/survey timeout 경고·연장·데이터 보존 |
| 15 | 정지 기능 제공 | 미측정 | carousel/animation/auto-update pause-stop-hide |
| 16 | 깜빡임과 번쩍임 제한 | 미측정 | 3~50Hz 및 면적 분석 |
| 17 | 반복 영역 건너뛰기 | 미통과 | 제공 기준 skip link 2/170. 반복 nav 페이지에 첫 focus skip link |
| 18 | 제목 제공 | 부분 확인 | page title 170/170이나 frame/content-block title 미측정 |
| 19 | 적절한 링크 텍스트 | 미측정 | 단독 “더보기/여기”와 중복 목적 링크 검사 |
| 20 | 고정된 참조 위치 정보 | 미측정 | report/program 전자출판 page/TOC 위치 일관성 |
| 21 | 단일 포인터 입력 지원 | 미측정 | drag/pinch 기능의 click 대안 |
| 22 | 포인터 입력 취소 | 미측정 | down-event 즉시 실행 금지, up/cancel/undo 확인 |
| 23 | 레이블과 네임 | 미측정 | visible label이 accessible name에 포함되는지 검사 |
| 24 | 동작기반 작동 | 미측정 | device motion 기능의 UI 대안·비활성화 |
| 25 | 기본 언어 표시 | 통과(정적) | html lang 170/170 제공 실측; 동적 언어변경은 별도 |
| 26 | 사용자 요구에 따른 실행 | 미측정 | focus/input만으로 예기치 않은 이동·새창 없음 |
| 27 | 찾기 쉬운 도움 정보 | 미측정 | 도움/문의 위치·순서의 페이지 간 일관성 |
| 28 | 오류 정정 | 미측정 | 오류 식별·위치·수정 제안·focus 이동 |
| 29 | 레이블 제공 | 미측정 | input label/instruction/필수·형식 안내 |
| 30 | 접근 가능한 인증 | 미측정 | 인지기능검사 의존 없음, password manager/paste 허용 |
| 31 | 반복 입력 정보 | 미측정 | 같은 과정 재입력 자동채움/선택 제공 |
| 32 | 마크업 오류 방지 | 미측정 | 중복 ID, 열린 요소, 속성·관계 validator 결과 |
| 33 | 웹 애플리케이션 접근성 준수 | 미측정 | custom widget name/role/value/state와 status message |

### 인증 준비 3단계

1. **사전 점검**: 대표 페이지가 아니라 서비스 전체 범위·complete process·동적 상태를 정하고 33항목 증빙을 만든다.
2. **전문가 심사**: 자동도구 결과와 전문가 수동 검사를 함께 수행한다. 자동 0건은 합격 근거가 아니다.
3. **사용자 심사**: 장애인 사용자가 실제 핵심 과업을 수행한다. 로그인·결제·설문·리포트·PDF·체크인 완료 여부를 관찰한다.

현재는 인증 심사를 수행하지 않았으므로 인증 통과/미통과는 **미측정**이다.

## 5. 시각적 품질 대리지표와 잔여 미측정

### 측정 가능한 것

- **색 대비**: text 4.5:1, large 3:1, UI/graphic 3:1. default/hover/focus/disabled/error 모두 측정.
- **타이포 스케일 일관성**: computed font-size를 역할별로 군집화하고 승인 토큰 매칭률 = `토큰 일치 text node / 전체 text node ×100`. inline 임의값과 breakpoint 역전 기록.
- **간격 토큰 준수율**: visible layout의 margin/padding/gap을 승인 spacing set과 비교. 허용 오차를 사전 고정하고 `일치 속성 / 측정 속성 ×100`.
- **정렬·overflow**: baseline grid 오차, viewport overflow, clipping, overlap, CTA hit-test.
- **반응형 안정성**: 320/375/390/430/1440과 200% zoom에서 component 이동·loss·CLS.

### 끝까지 미측정으로 남는 것

- 브랜드 적합성, 감성적 아름다움, 사진/일러스트의 문화적 적절성
- 정보 위계가 목적 사용자에게 실제로 이해되는지
- 인지부하·신뢰감·선호도

이는 독립 사용자 평가와 블라인드 디자인 리뷰가 필요하며 token 준수율로 대체할 수 없다.

## 6. 자기 반박

1. 페이지별 위반 수만 제공돼 개별 target의 exact selector·크기는 report 최악 사례 외에는 미측정이다. 구현 전 원시 JSON과 exact HEAD 결박이 필요하다.
2. 44px 전면 달성은 AAA 목표이지만 작은 화면 toolbar의 정보 밀도·가시 영역을 악화시킬 수 있다. target 확대와 구조 재배치를 같이 검증해야 한다.
3. font-size만 키워도 읽기 쉬워진다고 단정할 수 없다. 대비·행길이·줄간격·문구 난이도·200% reflow가 함께 충족돼야 한다.
4. KWCAG 체크리스트의 대부분은 현재 증빙이 없어 미측정이다. 정적 HTML 카운트와 자동검사만으로 인증 가능성을 예측할 수 없다.
5. `origin/main@b03e219`에는 발주가 언급한 `assets/css/a11y-core.css`가 없어 실제 적용 지점은 최신 구현 HEAD에서 재확인해야 한다.

## 7. 실행 순서

1. 원시 target 결과(exact selector·rect·viewport·HEAD)를 정본화.
2. report/program viewer를 별도 구조 PR로 2행 toolbar화; report.html 동시작업 종료 후 진행.
3. 인증·B2B·checkin form의 primary controls부터 44px.
4. 역할 기반 폰트 migration: body/instruction → metadata → decorative 순.
5. 공통 a11y CSS의 실제 배포 계보를 확인한 뒤 focus/target utility 도입.
6. 320/375/390/430/1440, KO/EN, 200% zoom, PDF pagefit 회귀.
7. KWCAG 전문가·사용자 심사 전 33항목 evidence matrix를 완성.
