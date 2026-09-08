# 자산화(accumulation) 플랫폼 벤치마크 정본 조사

- 조사일: 2026-08-31
- 목적: 활동·기록·성과가 시간에 따라 쌓이는 모습을 사용자가 즉시 이해하도록 만드는 제품 설계 비교
- 적용 대상: `lifeportfolio.co.kr` 첫 화면
- 자료 등급: **A = 공식 제품 화면·공식 도움말·공식 디자인/뉴스룸 자료**, **B = 학술·업계 표준 문헌**, **C = 제3자 자료**. 본 정본에는 A급만 사용했다.

## 판정 원칙과 한계

1. 여기서 **자산화**는 사용자의 행동·기록·성과가 시간에 따라 누적되고, 현재 총량·기간·구성·변화를 다시 볼 수 있는 상태를 뜻한다.
2. **“3초 O/X”는 사용자 실험 결과가 아니라 보수적 화면 감사 판정**이다. 첫 화면 자체가 `무엇이`, `얼마나`, `어느 기간에` 쌓였는지 명시하면 O, 상징 해독·사전지식·클릭이 필요하면 X로 판정했다.
3. 로그인·구독 뒤 개인화 화면은 공식 설명과 공식 화면으로만 확인했다. 실제 계정에서 확인하지 못한 요소는 그 한계를 적었다.
4. 시각 모티프만 베끼지 않는다. 잔디·링·불꽃이 효과의 본체가 아니라 **명시적 단위 + 기간/목표 + 안정된 표식 + 근거 기록으로의 드릴다운**이 핵심이다.

## 요약 결론

정본으로 삼기 가장 좋은 조합은 다음과 같다.

- **일상 누적:** GitHub contribution graph — 총량·기간·일별 흔적·근거 기록 연결.
- **목표 누적:** Apple Activity — 이름 붙은 수치가 닫히는 목표형 진행 장치.
- **기간 회고:** Spotify Wrapped / Goodreads Year in Books — 한두 개의 큰 누적 수치와 실제 기록의 연결.
- **축적 구조 설명:** Robinhood Strategies — 현재 자산, 투입량, 변화분, 구성요소를 분리.
- **보조 상호작용:** Strava Progress — 기간·지표 선택과 주간 합계→원기록 드릴다운.

Notion은 강력한 기록 플랫폼이지만 기본 Timeline은 ‘축적량’보다 ‘일정’을 보여주므로 정본이 아니라 보조 레이아웃 참고다. Duolingo는 습관 누적에는 강하지만 불꽃+숫자만으로는 신규 사용자가 ‘연속 학습일’을 즉시 이해하지 못할 수 있다고 Duolingo 자체 연구가 인정한다.

## 1. GitHub contribution graph

### (a) 제품 / URL

- GitHub Contributions
- 공식 개념·화면: https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile
- 공식 사용법: https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/viewing-contributions-on-your-profile
- 집계 규칙: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference
- 출처 등급: **A**

### (b) 축적 시각 장치

프로필에 최근 1년을 일 단위 칸으로 나눈 달력형 격자를 둔다. 상단에는 `NUMBER contributions in the last year` 형식으로 총량과 기간을 적고, 날짜 칸을 선택하면 해당 일의 기여 내역을 보여준다. 아래에는 기여 활동을 역시간순으로 풀어 놓는다. 집계 대상은 커밋만이 아니라 공식 규칙을 충족한 저장소 생성·포크·이슈·PR·리뷰·토론·커밋 등이다.

### (c) 왜 효과적인가 — 설계 원리

- **총량과 기간을 먼저 명명한다.** 사용자가 격자 색의 의미를 추측하기 전에 무엇을 얼마나 쌓았는지 읽는다.
- **시간 단위가 고정돼 있다.** 한 칸이 하루이므로 꾸준함·공백·밀집 구간을 같은 문법으로 비교한다.
- **개요에서 증거로 내려간다.** 연간 패턴을 훼손하지 않고 특정 날짜와 실제 기여를 확인할 수 있어 누적 수치가 블랙박스가 되지 않는다.
- **집계 모집단을 문서화한다.** 무엇이 기여로 계산되는지 공식 규칙이 있어 숫자의 의미를 감사할 수 있다.

공식 설명은 contribution calendar를 “a visual overview of your contribution activity”라고 부른다.

### (d) 첫 방문 3초 판정

**O.** 제목에 총 기여 수와 `last year`가 함께 있어 축적 대상·총량·기간이 즉시 드러난다. 단, 각 이벤트의 포함 규칙까지 3초 안에 이해된다는 뜻은 아니다.

### (e) 차용 가능한 요소

1. 첫 화면에 **`지난 21일, [N]개의 살아낸 기록`**처럼 총량·단위·기간을 한 줄로 고정한다.
2. 21일을 **하루 한 칸의 격자**로 표시하고, 칸을 누르면 그날의 행동·메모·결과물을 펼친다. 빈 칸도 숨기지 않는다.

### (f) 출처

- GitHub Docs: “a graph of your repository contributions over the past year.”
- GitHub Docs: “NUMBER contributions in the last year”; “click the square corresponding to that day.”
- 위 공식 URL 3건.

## 2. Strava Progress Summary

### (a) 제품 / URL

- Strava Progress Summary
- 공식 도움말: https://support.strava.com/en-us/articles/15401618-progress-summary-chart
- Training Log 보조 참고: https://support.strava.com/en-us/articles/15402077-training-log
- Year in Sport 보조 참고: https://support.strava.com/en-us/articles/15401959-your-year-in-sport
- 출처 등급: **A**

### (b) 축적 시각 장치

선택한 스포츠와 기간에 대해 거리·시간·고도·활동 수 중 하나의 총량을 차트로 표시한다. 특정 주를 누르면 그 합계를 만든 개별 활동으로 내려가며, `Compare Date Range`로 현재 기간과 과거 기간을 비교한다. Training Log는 주별 화면에 활동 하나당 원 하나를 배치하고, Year in Sport는 개인화된 연간 통계를 장면 단위로 보여 준다.

### (c) 왜 효과적인가 — 설계 원리

- **범주 × 지표 × 기간을 사용자가 고른다.** ‘성장’ 같은 모호한 말 대신 무엇의 총량인지 고정한다.
- **합계와 원기록이 연결된다.** 주간 수치를 누르면 실제 운동 기록을 확인할 수 있다.
- **동일 화면에서 기간을 비교한다.** 현재 수치만 보는 것보다 변화 방향을 해석하기 쉽다.
- Training Log의 원은 사건 단위, Progress Summary의 차트는 합계 단위로 역할이 다르다. 사건 흔적과 누적량을 혼동하지 않는다.

공식 설명은 차트가 “totals for distance, time, elevation, or activity count data”를 표시한다고 명시한다.

### (d) 첫 방문 3초 판정

**O — Progress Summary에 한정.** 지표명·총량·기간이 표시된 화면에서는 무엇이 쌓이는지 즉시 알 수 있다. Training Log의 색 원만으로는 어떤 수치가 축적되는지 알 수 없어 그 화면은 X다.

### (e) 차용 가능한 요소

1. **`기록 종류 × 지표 × 기간` 선택기**를 둔다. 예: `행동 | 완료 수 | 최근 21일`, `결과물 | 남긴 수 | 올해`.
2. 주간 합계를 누르면 그 숫자를 만든 **개별 살아낸 기록 목록**이 열리게 하고, 옆에 `이전 21일과 비교`를 둔다.

### (f) 출처

- Strava Help: “displays your totals for distance, time, elevation, or activity count data.”
- Strava Help: “Select Compare Date Range to compare your current data against historical date ranges.”
- 위 공식 URL 3건.

## 3. Apple Activity rings

### (a) 제품 / URL

- Apple Activity / Fitness Trends
- 공식 가이드: https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos
- 공식 Health 안내: https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios
- 공식 Newsroom: https://www.apple.com/newsroom/2021/06/apple-advances-personal-health-by-introducing-secure-sharing-and-new-insights/
- 출처 등급: **A**

### (b) 축적 시각 장치

Move·Exercise·Stand/Roll 세 지표를 서로 다른 색의 동심원 진행 링으로 표시한다. 각 링은 하루 목표에 가까워질수록 닫히고 목표를 넘으면 겹쳐 돌아간다. Trends는 최근 90일 평균을 최근 365일 기록과 비교해 지표별 상승·하락 화살표를 보여준다.

### (c) 왜 효과적인가 — 설계 원리

- **끝점이 있는 기하학:** 닫힌 원이 목표 완료를 나타내므로 진행과 완료를 같은 형태로 읽는다.
- **이름·값·단위와 색을 고정 결합:** 색만이 아니라 Move 칼로리, Exercise 분, Stand 시간이라는 뜻을 붙인다.
- **100% 이후도 보존:** 초과 달성을 잘라내지 않고 링의 겹침으로 표현한다.
- **개인 기준선 비교:** Trends는 최근 90일과 365일을 비교해 단순 전일 등락보다 긴 시간축을 제공한다.

Apple은 “Three rings in different colors summarize your progress”, “An overlapping ring means you exceeded your goal”이라고 설명한다.

### (d) 첫 방문 3초 판정

**O — 이름·값·단위가 함께 보일 때.** 링만 떼어 놓으면 X다. `오늘의 남긴 기록 2/3`처럼 단위와 목표가 보여야 닫힘의 뜻이 즉시 전달된다.

### (e) 차용 가능한 요소

1. 첫 화면에 **발견·살아냄·남김 3개 목표 링**을 두되 각 링 안에 `현재값/목표값`과 단위를 표기한다.
2. 목표를 넘은 기록은 100%에서 잘라내지 말고 **두 번째 회전 또는 `+N`**으로 초과 축적을 보존한다.

### (f) 출처

- Apple Support: “Three rings in different colors summarize your progress.”
- Apple Support: “Trends compares your last 90 days of activity to the last 365.”
- 위 공식 URL 3건.

## 4. Duolingo Streak

### (a) 제품 / URL

- Duolingo Streak
- 공식 제품 설명: https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- 공식 습관 연구: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- 공식 마일스톤 디자인: https://blog.duolingo.com/streak-milestone-design-animation/
- 공식 위젯 디자인: https://blog.duolingo.com/widget-feature/
- 출처 등급: **A**

### (b) 축적 시각 장치

화염 아이콘 옆 숫자로 연속 학습일을 항상 보여 주고, 수업 완료 뒤 숫자가 하루 늘어나는 장면을 표시한다. 1주·1개월·100일·1년 같은 이정표에서는 일반 상태와 다른 애니메이션과 공유 카드를 제공한다. 위젯은 현재 스트릭과 오늘 완료 여부/위험 상태를 앱 밖에서도 보여 준다.

### (c) 왜 효과적인가 — 설계 원리

- **복잡한 활동 이력을 단일 연속일 수로 압축**해 다음 행동과 직접 연결한다.
- **행동 직후 상태 변화를 보여 줘** 사용자가 방금 한 행동이 누적값을 바꿨음을 확인한다.
- **평상시 수치와 마일스톤 축하를 분리**한다. 측정 문법은 유지하고 특정 구간에서만 정서적 강조를 더한다.
- **위험 상태를 주변 화면으로 확장**해 오늘의 미완료가 누적에 미치는 영향을 알린다.

Duolingo는 새 스트릭 애니메이션이 신규 학습자의 7일차 사용 가능성을 `+1.7%` 높였다고 보고하지만, 이는 해당 실험의 결과이지 모든 서비스에 대한 일반 법칙은 아니다.

### (d) 첫 방문 3초 판정

**X — 상단의 불꽃+숫자만 기준.** Duolingo 자체 글도 일부 신규 사용자가 스트릭을 이해하지 못했고 불꽃 은유가 모든 문화권에서 통하지 않았다고 밝힌다. `200 day streak`처럼 단위가 붙은 위젯·마일스톤은 O다.

### (e) 차용 가능한 요소

1. 불꽃 같은 은유만 쓰지 말고 **`7일 연속 살아냄`**처럼 숫자 옆에 단위를 쓴다.
2. 매일은 동일한 카운터를 갱신하고, **7·21·100번째 기록에서만 별도 마일스톤 카드**와 공유 가능한 한 장을 만든다.

### (f) 출처

- Duolingo: “Your streak is the number of days in a row you’ve studied.”
- Duolingo: “some learners new to Duolingo don’t understand the streak.”
- 위 공식 URL 4건.

## 5. Spotify Wrapped

### (a) 제품 / URL

- Spotify Wrapped
- 공식 2024 경험·화면: https://newsroom.spotify.com/2024-12-04/wrapped-user-experience-2024/
- 공식 데이터·제작 설명: https://newsroom.spotify.com/2024-12-04/the-art-and-science-behind-spotify-wrapped/
- 공식 디자인 역사: https://newsroom.spotify.com/2024-12-04/10-years-spotify-wrapped/
- 출처 등급: **A**

### (b) 축적 시각 장치

한 해의 청취 기록을 전체 대시보드가 아니라 개인화된 `data stories` 순서로 보여 준다. `Minutes Listened`, Top Artist, Top Song, Music Evolution처럼 한 장면에 한 통계군을 두고, 마지막에는 공유 가능한 결과물을 만든다. Music Evolution은 연중 취향 변화를 최대 세 단계로 이름 붙인다.

### (c) 왜 효과적인가 — 설계 원리

- **연간 경계를 먼저 선언**해 모든 수치의 기간을 하나로 통일한다.
- **한 화면 한 통계**로 경쟁하는 숫자를 줄이고 큰 수치가 주인공이 되게 한다.
- **동일 기록을 총량·순위·단계로 재해석**한다. 축적량뿐 아니라 무엇이 축적의 성격을 만들었는지 보여 준다.
- **공유물을 별도 산출물로 만든다.** 긴 기록을 휴대 가능한 한 장으로 변환한다.

공식 자료는 Wrapped를 “a personalized recap of their year in listening”이라 정의하며 `top song`, `total minutes listened`, `favorite artist`를 명시한다. 공식 자료는 화려한 색·애니메이션이 이해도나 참여를 일으켰다는 인과까지 증명하지 않으므로 그 주장은 하지 않는다.

### (d) 첫 방문 3초 판정

**O — `Minutes Listened` 같은 명시적 통계 카드에 한정.** 지표명·단위·연도가 한 화면에 있어 해독이 필요 없다. 모든 장식적 전환과 Music Evolution 표현까지 즉시 이해된다는 뜻은 아니다.

### (e) 차용 가능한 요소

1. 첫 화면 또는 마이페이지 진입 시 **`올해 남긴 결과물 N개`**처럼 제목·큰 숫자·연도를 담은 단일 통계 카드를 먼저 보여 준다.
2. 21일 여정을 **발견 → 살아냄 → 남김의 최대 3개 단계 카드**로 압축하고 마지막에 공유용 `나의 이번 회차 한 장`을 생성한다.

### (f) 출처

- Spotify Newsroom: “a personalized recap of their year in listening.”
- Spotify Newsroom: “Whether it’s your top song, total minutes listened, or favorite artist.”
- 위 공식 URL 3건.

## 6. Goodreads Year in Books

### (a) 제품 / URL

- Goodreads Year in Books
- 공식 도움말: https://help.goodreads.com/s/article/000001520
- 공식 공개 제품 화면 예시: https://www.goodreads.com/user/year_in_books/2023/21194817
- Reading Challenge 보조 참고: https://help.goodreads.com/s/article/What-are-Reading-Challenges
- 출처 등급: **A**

### (b) 축적 시각 장치

공개 Year in Books 화면은 연도 아래에 `pages read`와 `books read` 두 개의 큰 누적값을 배치한다. 이어서 가장 짧은 책·가장 긴 책, 평균 길이, 평점, 실제 책 표지 이력을 보여 준다. 이전·다음 연도로 이동할 수 있다. 공식 Reading Challenge는 연간 완독 목표 수와 진행 확인 기능을 설명하지만, 이번 조사에서는 로그인 후 진행 컴포넌트의 정확한 형태를 확인하지 못했다.

### (c) 왜 효과적인가 — 설계 원리

- **서로 다른 두 총량을 같은 연도에 묶는다.** 책 수는 빈도, 페이지 수는 볼륨을 보완한다.
- **합계에서 실제 항목으로 내려간다.** 가장 짧고 긴 책, 평균, 표지 목록이 큰 숫자를 실제 독서 기록과 연결한다.
- **연도 간 비교 가능한 틀을 유지**한다. 이전·다음 연도 이동이 누적을 단발 이벤트가 아닌 연속 기록으로 만든다.
- 사용자 사진을 두 수치 사이에 둬 누구의 기록인지 명확하게 한다. 이는 화면 구조에 대한 관찰이지 효과의 인과 주장은 아니다.

### (d) 첫 방문 3초 판정

**O — Year in Books.** 연도와 함께 큰 숫자에 `pages read`, `books read`가 직접 붙어 있다. Reading Challenge의 로그인 후 실제 진행 UI는 **미확인**이므로 별도로 O 판정하지 않는다.

### (e) 차용 가능한 요소

1. **이중 누적 헤더:** `살아낸 날 N일`과 `남긴 결과물 M개`를 사용자 이름/고유코드 양옆에 둔다.
2. 합계 아래에 **첫 기록·가장 오래 이어진 기록·대표 결과물**을 실제 제목/날짜와 함께 보여 준다.

### (f) 출처

- Goodreads 공식 공개 화면의 `pages read`, `books read`, `Shortest Book`, `Longest Book`, `Average book length in 2023` 레이블.
- 위 공식 URL 3건.

## 7. Robinhood Strategies portfolio

### (a) 제품 / URL

- Robinhood Strategies managed portfolio
- 공식 차트 설명·제품 화면: https://robinhood.com/us/en/support/articles/strategies-charts/
- 일반 차트 도움말: https://robinhood.com/us/en/support/articles/using-charts/
- 출처 등급: **A**

### (b) 축적 시각 장치

화면 최상단에 현재 포트폴리오 잔액, 기간 수익 금액·비율, 순입금액을 둔다. `ALL` 구간에서는 투자 성과선과 순입금 기준선을 함께 그린다. 별도 모드에서 도넛 차트로 현재 구성 비율을, 막대 차트로 평가손익·수입·수수료를 분해한다. 기간 선택은 1W·1M·3M·YTD·1Y·ALL을 제공한다.

### (c) 왜 효과적인가 — 설계 원리

- **현재 보유량(stock)과 변화(flow)를 한 위계에 둔다.** 현재 얼마가 쌓였는지와 어떻게 변했는지를 분리한다.
- **투입과 성과를 분리한다.** 회색 순입금선과 녹색 성과선이 ‘더 넣어서 늘어난 것’과 ‘운용으로 변한 것’을 구분한다.
- **성장·구성·변화 원인의 세 관점**을 전환한다. 하나의 총액만으로 설명하지 않는다.
- 비교 수익률의 계산 기준과 차트 한계를 공식 문서에 밝힌다. 누적 그래프를 과장된 성공 서사로 만들지 않는다.

공식 설명은 회색선을 “net funded amount (total funding less total withdrawals)”라고 정의하고, 도넛을 자산 배분의 “at-a-glance summary”라고 설명한다.

### (d) 첫 방문 3초 판정

**O.** `Managed investing`, 큰 금액, `All time`, `Net funding`으로 투자 포트폴리오의 현재 축적량이 즉시 보인다. 다만 시간가중수익률 계산법까지 3초 안에 이해되는 것은 아니다.

### (e) 차용 가능한 요소

1. **두 선을 분리한다:** `내가 입력한 기록 수`와 `그 기록에서 남은 결과물 수`를 동일 시간축에 그려 투입과 자산화를 구분한다.
2. 같은 헤더 총량 아래에서 **성장 추이 / 현재 구성 / 변화 원인** 3개 모드를 전환한다. 예: 주차별 기록선 / 경험·지식·관계·콘텐츠 구성 / 새로 생성·갱신·공유된 결과.

### (f) 출처

- Robinhood Help: “The gray line represents the net funded amount (total funding less total withdrawals).”
- Robinhood Help: “an at-a-glance summary of how the assets are distributed within your portfolio.”
- 위 공식 URL 2건.

## 8. Notion database + Timeline

### (a) 제품 / URL

- Notion Databases / Timeline
- 공식 도움말: https://www.notion.com/help/timelines
- 공식 database views 가이드: https://www.notion.com/help/guides/using-database-views
- 공식 Timeline 설계 가이드: https://www.notion.com/help/guides/timeline-view-unlocks-high-output-planning-for-your-team
- 출처 등급: **A**

### (b) 축적 시각 장치

동일 데이터베이스의 페이지를 표·목록·보드·갤러리·캘린더·타임라인 등으로 다시 표현한다. Timeline에서는 각 기록이 시간축 위의 이름 붙은 막대가 되고, 시작·종료일이 길이를 정한다. 왼쪽 표를 함께 두어 이름·속성을 유지할 수 있고, 표 계산으로 개수·합계·최초/최종일·기간을 표시할 수 있다.

### (c) 왜 효과적인가 — 설계 원리

- **한 기록을 여러 관점으로 투영**해 복제 없이 시간·상태·범주를 바꿔 본다.
- **위치와 길이가 시간을 부호화**하고 겹친 막대가 동시 진행을 보여 준다.
- **시간 표식 옆에 의미 레일을 유지**해 막대가 무엇인지 잃지 않는다.
- 다만 집계는 Timeline의 본체가 아니라 표의 보조 계산이다. 공식 설명도 Timeline을 프로젝트 기간·출시 일정 확인 도구로 제시한다.

### (d) 첫 방문 3초 판정

**X.** 공식 화면은 프로젝트·과업의 시간 배치를 즉시 보여 주지만 ‘지식이 얼마나 쌓였는지’는 보여 주지 않는다. 총량·누적 궤적·`notes captured` 같은 축적 단위가 기본 화면에 없다.

### (e) 차용 가능한 요소

1. 왼쪽에 **기록명 + 자산 유형**을 고정하고 오른쪽에 21일 시간 막대를 정렬한다.
2. 현재 기간 밖으로 이어지는 기록에는 **연속 화살표**를 표시하고 누르면 이전/다음 회차로 이동한다.

### (f) 출처

- Notion: database views are “each displaying the same data differently.”
- Notion: Timeline “shows you the overlapping nature of your projects or tasks.”
- 위 공식 URL 3건.

**정본 적합성 판정:** Notion은 기록 구조와 시간 배치의 강한 보조 참고다. 기본 Timeline이 축적량을 직접 말하지 않으므로 **자산화 시각화의 대표 정본으로 단독 채택하면 안 된다.**

## 진단형 vs 자산화형 설계 차이

| 대조축 | 진단형 | 자산화형 | 인생포트폴리오에 필요한 전환 |
|---|---|---|---|
| 핵심 질문 | “나는 어떤 사람인가?” | “무엇이 얼마나 남았고 어떻게 변했는가?” | 정체성 문장 옆에 누적 대상·총량·기간을 동시에 표시 |
| 시간 구조 | 한 시점의 응답과 결과 | 일·주·월·회차가 연결된 연속 기록 | 76문항 완료를 끝이 아니라 21일 축적의 시작점으로 표현 |
| 첫 화면 주인공 | 유형명·점수·캐릭터 | 총량·진행·시간 패턴·실제 결과물 | `Live Your Portfolio` 아래에 실제 축적 프리뷰 배치 |
| 데이터 단위 | 문항 응답·척도 점수 | 행동·기록·결과물·완료일 | 무엇이 ‘자산’으로 계산되는지 규칙 공개 |
| 시각 문법 | 프로필 카드·레이더·백분위 | 달력 격자·진행 링·누적선·기간 회고 | 격자+총량을 기본, 링·회고 카드는 보조로 사용 |
| 갱신 주기 | 재검사 때 갱신 | 행동마다 또는 정기적으로 갱신 | 하루 기록과 21일 체크인이 누적 화면을 실제 갱신 |
| 피드백 | 결과 해석 | 즉시 증가·목표 도달·기간 비교 | 기록 저장 직후 `N→N+1` 변화 표시 |
| 근거 추적 | 결과 근거 문항 | 합계를 만든 원기록 | 숫자 클릭 시 날짜·행동·결과물 표시 |
| 재방문 이유 | 결과 재열람·재검사 | 오늘 추가·진행 확인·이전 기간 비교 | `오늘 한 칸 남기기`, `이전 21일과 비교` 제공 |
| 공유 산출물 | 유형 카드·결과 PDF | 연간/회차 회고 카드·포트폴리오 | PDF 외에 `이번 21일 한 장` 생성 |
| 실패/공백 처리 | 보통 숨김 또는 무관 | 공백 자체가 시간 패턴 | 빈 날짜를 삭제하지 말고 회복 행동으로 연결 |
| 가치 증명 | 진단 설명의 정확성 | 남은 결과물과 변화의 감사 가능성 | ‘자산화’ 주장을 실제 누적 화면과 기록 목록으로 검증 |

## `lifeportfolio.co.kr` 첫 화면 즉시 적용 제안 3개

현행 화면은 2026-08-31 공개 페이지를 기준으로 확인했다. Hero는 `Live Your Portfolio`, `삶으로 살아내는, 당신만의 한 권`, `발견하고, 살아내고, 남기는 — 삶이 자산이 되는 한 권`을 제시한다. 그러나 첫 화면에는 **누적 단위·기간·목표·실제 축적 화면이 없다.** 자산화는 문장으로 선언되지만 화면으로 증명되지 않는다.

| # | 현재 상태 | 제안 | 근거 제품 | 예상 효과 |
|---|---|---|---|---|
| 1 | Hero가 추상적 브랜드 문장과 CTA 중심이다. 무엇이 쌓이는지 수치·기간·실물로 보이지 않는다. | Hero 오른쪽/아래에 **실제형 축적 프리뷰**를 배치한다: `지난 21일 · 살아낸 기록 14개 · 남긴 결과물 3개`, 21칸 격자, 오늘 칸 강조. 데모임을 명시하고 각 칸 클릭 시 행동/결과물 예시를 노출한다. | GitHub의 총량+기간+일별 격자, Goodreads의 큰 수치+명시 단위 | ‘한 권짜리 진단’이 아니라 ‘시간에 따라 쌓이는 포트폴리오’임을 첫 화면에서 증명. ①첫인상 약점과 ④자산화 강점의 단절을 직접 해소. |
| 2 | `발견·살아내고·남김`은 설명 카드로만 존재하며 현재 진행과 완료점이 없다. | 세 단계 각각에 **이름 붙은 진행 링**을 둔다: `발견 76/76문항`, `살아냄 9/21일`, `남김 3개 결과물`. 첫 방문 샘플에는 `예시` 표기, 사용자 로그인 후 실제값으로 교체한다. 100% 초과는 `+N`으로 남긴다. | Apple Activity의 이름·값·단위가 있는 목표 링; Duolingo의 명시 단위 스트릭 | 세 동사가 장식적 카피가 아니라 측정 가능한 여정으로 바뀐다. 진단→행동→자산의 전환 구조가 3초 안에 읽힌다. |
| 3 | PDF 리포트와 21일 점검은 소개되지만, 투입한 기록이 어떤 자산으로 남는지 분해되지 않는다. | Hero 바로 아래에 **`기록 → 결과물 → 자산` 두 선/세 모드 미니 차트**를 둔다. 기본은 21일간 `입력 기록`과 `남은 결과물` 두 선, 탭은 `성장 추이 / 자산 구성(경험·지식·관계·콘텐츠) / 변화 근거`. 숫자 클릭 시 예시 원기록을 보여 준다. | Robinhood의 순투입 vs 성과선 및 성장/구성/원인 분해, Strava의 합계→원활동 드릴다운 | 자산화를 단순 활동량과 구분하고 ‘무엇이 남았는가’를 설명한다. 축적 수치의 감사 가능성을 높여 과장 인상을 줄인다. |

## 적용 우선순위

1. **최우선:** 제안 1 — 총량·기간·21일 격자. 가장 적은 설명으로 자산화의 실체를 보여 준다.
2. **다음:** 제안 2 — 세 단계 진행 링. 기존 `발견·살아내고·남김` 카피를 보존하면서 측정 가능한 구조를 더한다.
3. **데이터 준비 후:** 제안 3 — 입력과 남은 자산을 분리하려면 ‘기록’과 ‘결과물’의 집계 규칙을 먼저 확정해야 한다.

## 냉정한 최종 판정

- 현재 첫 화면은 자산화를 **말하지만 보여 주지 않는다.** 첫 3초에는 진단·리포트 브랜드로 읽힐 가능성이 높다.
- ④축 88점의 구조적 강점이 실제 서비스 안쪽에 있더라도, Hero에 총량·기간·진행·원기록이 없으면 첫인상 73점 문제를 해결하지 못한다.
- 90점 도달을 위해 필요한 것은 자산화 관련 문구 추가가 아니라 **작동하는 축적 표면**이다. 특히 `총량 + 기간 + 일별 흔적 + 원기록`, 그리고 `투입 기록과 남은 결과물의 분리`가 핵심이다.
- 벤치마크의 표면 장식만 복제하면 실패한다. GitHub 잔디를 붙이기 전에 무엇이 한 칸으로 계산되는지, Apple 링을 붙이기 전에 목표와 단위를, Robinhood 선을 붙이기 전에 입력과 자산의 정의를 먼저 정해야 한다.

## 출처 목록

모든 출처는 A급 1차 자료이며 2026-08-31 접근했다.

1. GitHub Docs — Contributions on your profile: https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile
2. GitHub Docs — Viewing contributions: https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/viewing-contributions-on-your-profile
3. GitHub Docs — Contributions reference: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference
4. Strava Help — Progress Summary: https://support.strava.com/en-us/articles/15401618-progress-summary-chart
5. Strava Help — Training Log: https://support.strava.com/en-us/articles/15402077-training-log
6. Strava Help — Year in Sport: https://support.strava.com/en-us/articles/15401959-your-year-in-sport
7. Apple Support — Track daily activity: https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos
8. Apple Support — View Health data: https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios
9. Apple Newsroom — Health insights: https://www.apple.com/newsroom/2021/06/apple-advances-personal-health-by-introducing-secure-sharing-and-new-insights/
10. Duolingo Blog — Product tour: https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
11. Duolingo Blog — Streak and habit: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
12. Duolingo Blog — Milestone design: https://blog.duolingo.com/streak-milestone-design-animation/
13. Duolingo Blog — Widget design: https://blog.duolingo.com/widget-feature/
14. Spotify Newsroom — 2024 Wrapped experience: https://newsroom.spotify.com/2024-12-04/wrapped-user-experience-2024/
15. Spotify Newsroom — Art and Science: https://newsroom.spotify.com/2024-12-04/the-art-and-science-behind-spotify-wrapped/
16. Spotify Newsroom — Ten years of Wrapped: https://newsroom.spotify.com/2024-12-04/10-years-spotify-wrapped/
17. Goodreads Help — Year in Books: https://help.goodreads.com/s/article/000001520
18. Goodreads first-party public Year in Books screen: https://www.goodreads.com/user/year_in_books/2023/21194817
19. Goodreads Help — Reading Challenges: https://help.goodreads.com/s/article/What-are-Reading-Challenges
20. Robinhood Help — Strategies charts: https://robinhood.com/us/en/support/articles/strategies-charts/
21. Robinhood Help — Using charts: https://robinhood.com/us/en/support/articles/using-charts/
22. Notion Help — Timelines: https://www.notion.com/help/timelines
23. Notion Help — Using database views: https://www.notion.com/help/guides/using-database-views
24. Notion Help — Timeline guide: https://www.notion.com/help/guides/timeline-view-unlocks-high-output-planning-for-your-team
25. LifePortfolio live home: https://lifeportfolio.co.kr/
