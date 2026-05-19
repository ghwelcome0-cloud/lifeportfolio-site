# Google Business Profile 등록 가이드 (C3)

> 목표: Google 검색 + 지도에서 **"인생포트폴리오"** 브랜드 검색 시
> 오른쪽 사이드(Knowledge Panel)에 공식 비즈니스 카드가 노출되도록 한다.
> Last updated: 2026-05-19

---

## 0. 사전 점검

| 항목 | 값 |
| --- | --- |
| 비즈니스명 | 인생포트폴리오 / Life Portfolio |
| 사업자등록번호 | 656-12-02589 (파이스) |
| 통신판매신고 | 2024-서울중랑-1537 |
| 공식 이메일 | faise@lifeportfolio.co.kr |
| 공식 도메인 | https://lifeportfolio.co.kr |
| 사업장 주소 | (서비스 비공개, 사업자 등록상 주소) |

> 인생포트폴리오는 **순수 온라인 서비스**이므로 매장 주소를 표시하지 않는 "service-area business" 형태로 등록한다.

---

## 1. Google Business Profile 신규 등록

1. 접속: <https://business.google.com/create>
2. 운영자 Google 계정 로그인 (브랜드 운영 계정 권장 — Google Search Console 소유자와 동일 권장)
3. **비즈니스 이름 입력**: `인생포트폴리오`
   - 영문 표기는 등록 후 [정보] 탭에서 alternate name으로 추가 가능
4. **비즈니스 카테고리** 선택:
   - 1차: "교육 컨설턴트" 또는 "진로 상담"
   - 추가 카테고리: "소프트웨어 회사", "심리 상담"
5. **위치 추가 단계**:
   - "고객이 방문할 수 있는 매장이 있나요?" → **아니요**
   - "서비스를 제공하는 지역을 추가하시겠어요?" → 예
   - 서비스 지역: `대한민국` + `전 세계` (해외 PayPal 결제 지원)
6. **연락처**:
   - 전화: (선택) — 카카오톡 채널만 운영 중이면 입력 안 해도 됨
   - 웹사이트: `https://lifeportfolio.co.kr`
7. **소유권 확인**:
   - 방법 선택: **이메일 인증** (`faise@lifeportfolio.co.kr` 권장) 또는 **엽서 우편**
   - 우편 인증은 5~14일 소요. 이메일 인증이 가능하면 그것이 가장 빠름.

---

## 2. 프로필 완성도 100%로 올리기

소유권 확인 후 다음을 모두 입력:

- [ ] **로고 / 커버 사진** (정사각형 720×720 / 가로 1080×608)
  - 로고: `/assets/icon-512.png` 응용
  - 커버: `/assets/og/og-default-ko.png` 잘라서 사용
- [ ] **사진 5장 이상 추가**:
  - 사이트 메인 화면 캡처 (PC)
  - 사이트 메인 화면 캡처 (모바일)
  - 결과 PDF 미리보기 (사명 리포트 1페이지)
  - 결과 PDF 미리보기 (21일 실행 프로그램 1페이지)
  - 4단계 framework 다이어그램 (있으면)
- [ ] **간단 소개 (750자 이내)**:
  ```
  인생포트폴리오는 자기이해 → 자기표현 → 자기설계 → 자기실행
  4단계를 하나의 흐름으로 묶은 맞춤 자기경영 진단 서비스입니다.

  76문항 15분 진단으로 사명·비전·정체성·강점과
  추천 진로·직업, 21일 실행 프로그램까지
  두 권의 PDF로 결제 즉시 자동 생성됩니다.

  성향 유형 분류가 아니라, '검사·해석·실행'을 한 세트로 묶은
  실행 프로그램이라는 점이 다른 자기이해 도구와의 차이입니다.

  국내 9,900원 · 해외 USD 8.99 · 한국어/영어 동시 지원.
  ```
- [ ] **서비스 등록**: [서비스] 탭에서 다음 4개 등록
  - 자기이해 (Self-understanding) — 76문항 15분 진단
  - 자기표현 (Self-expression) — 사명 리포트 PDF
  - 자기설계 (Self-design) — 추천 진로·직업·역할
  - 자기실행 (Self-execution) — 21일 실행 프로그램
- [ ] **속성**: "온라인 상담", "온라인 결제 지원" 토글 ON
- [ ] **운영시간**: 24/7 (자동 발급 서비스이므로)

> 프로필 완성도가 90% 이상이어야 Knowledge Panel 노출 우선순위가 올라간다.

---

## 3. Google Search Console과 연결

1. 접속: <https://search.google.com/search-console>
2. 속성 추가: `https://lifeportfolio.co.kr` (URL 접두어 방식)
3. 소유 확인: HTML 태그 방식
   - 토큰: `uoSIxdhBhBDILkJkhTCuIf_IDymqoYZKkWfO8bmnbK4` (이미 사이트에 삽입됨)
4. 자동 인증
5. **[Sitemaps]** > 추가: `sitemap.xml`
6. **[URL 검사]**에서 우선순위 페이지 5개 입력 후 [색인 요청]:
   - `https://lifeportfolio.co.kr/`
   - `https://lifeportfolio.co.kr/product`
   - `https://lifeportfolio.co.kr/blog/`
   - `https://lifeportfolio.co.kr/blog/posts/2026-05-19-30s-career-shaking-first-check`
   - `https://lifeportfolio.co.kr/blog/posts/2026-05-19-report-interpret-execute-one-set`

> Business Profile과 Search Console이 같은 Google 계정에 묶이면
> Knowledge Panel에 공식 사이트 링크가 빠르게 연결된다.

---

## 4. 첫 후기 5개 확보 (Knowledge Panel 활성화의 핵심)

Google Business Profile은 **후기 5개 이상**부터 별점 표시가 노출되고 검색 시 카드 신뢰도가 크게 올라간다.

1. 등록 직후 첫 1~2주 동안 사용해 본 5명에게 후기 요청
2. 후기 요청 링크: Business Profile 관리 화면 우측 상단 [후기 받기] > 단축 URL 복사
3. 카카오톡/이메일로 요청 시 다음 문구 사용:
   ```
   안녕하세요, 인생포트폴리오 운영자입니다.
   서비스를 사용해 주셔서 감사합니다.
   Google 검색 결과의 신뢰도를 높이는 데
   짧은 한 줄 후기가 큰 도움이 됩니다.
   아래 링크에서 별점 + 한 줄 후기 부탁드립니다.

   👉 [후기 링크]
   ```

> 무리하지 말 것. 거짓·자작 후기는 즉시 패널티(Google 정책 위반).

---

## 5. 노출 타임라인 (현실 기준)

| 시점 | 기대 결과 |
| --- | --- |
| 등록 즉시 | 비즈니스 프로필 작성 단계 진입 |
| 1~14일 | 소유권 인증 완료 |
| 2~4주 | Google 검색에서 "인생포트폴리오"로 기본 Knowledge Panel 노출 |
| 후기 5개+ 후 | 별점·후기 요약 표시 + SERP 클릭률 증가 |
| 6~12주 | "자기경영 진단", "30대 진로" 등 일반 키워드 검색에서도 자연 노출 |

---

## 6. 운영 메모

- **주 1회**: Business Profile [통계] 확인 — 검색 노출 수, 검색어, 행동(웹사이트 클릭/길찾기)
- **월 1회**: 새 포스트(Google Business Profile Posts 기능)로 신규 블로그 글 또는 4단계 소식 발행 → 검색 신선도 유지
- **분기 1회**: 사진 1~2장 추가 — Google은 사진 업데이트가 잦은 비즈니스를 선호

---

## 7. 트러블슈팅

- [ ] 소유권 인증 이메일이 안 오면 → 스팸함 확인, 인증 방법을 "엽서"로 변경 후 재시도.
- [ ] 등록 후 4주가 지나도 Knowledge Panel 안 보이면 → Search Console 색인 상태 확인 + 사진/서비스/속성 완성도 재점검.
- [ ] 잘못된 정보로 노출되면 → [정보 수정] 후 1~3일 대기. 동시에 Search Console에서 메인 페이지 재크롤 요청.
- [ ] 비즈니스 카테고리 변경 후 노출이 안정될 때까지 보통 7일 소요.

---

## 8. (선택) Google Search Console 추가 작업

- **[색인 > 사이트맵]**에서 `sitemap.xml` 외 `blog/rss.xml`도 별도 제출
- **[향상 > 빵 부스러기(Breadcrumbs)]** 보고서에서 오류 없는지 분기 1회 확인 (현재 모든 블로그 포스트에 BreadcrumbList JSON-LD 적용됨)
- **[성능]**에서 "인생포트폴리오" 키워드의 평균 게재순위 모니터링. 5위 안으로 진입할 때까지 §1~§4 작업 반복.

— end —
