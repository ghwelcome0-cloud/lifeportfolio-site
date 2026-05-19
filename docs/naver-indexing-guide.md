# 네이버 검색노출 등록 가이드 (C1)

> 목표: 네이버에서 **"인생포트폴리오"** 검색 시 첨부 스크린샷처럼
> 사이트 제목 + URL + 설명이 깔끔한 브랜드 SERP로 노출되도록 한다.
> Last updated: 2026-05-19

---

## 0. 사전 점검 (모두 ✅인지 확인)

| 항목 | 상태 | 위치 |
| --- | --- | --- |
| `naver-site-verification` 메타태그 삽입 | ✅ | `/index.html`, 전체 블로그 포스트 |
| `robots.txt` Yeti 허용 | ✅ | `/robots.txt` |
| `sitemap.xml` 최신화 | ✅ | `/sitemap.xml` (2026-05-19 기준 47개 URL) |
| OG/Twitter Card 1200×630 | ✅ | `og-default-ko.png`, `og-default-en.png` |
| JSON-LD Organization 등록 | ✅ | `/index.html` 148-178번 라인 |

검증 토큰: `d8784cb0e7d5de6f464cefa3a89b886d3a733733`

---

## 1. 네이버 서치어드바이저 사이트 등록

1. 접속: <https://searchadvisor.naver.com/>
2. 네이버 아이디 로그인 (브랜드 운영 계정 권장: `faise@lifeportfolio.co.kr` 연결된 아이디)
3. 상단 메뉴 **[웹마스터 도구] > [사이트 관리] > [+ 사이트 추가]**
4. 입력: `https://lifeportfolio.co.kr` (https 필수, 끝에 슬래시 없이)
5. 사이트 소유 확인 단계:
   - **HTML 태그** 방식 선택 → 토큰 값이 이미 사이트 `<head>`에 포함되어 있음
   - 자동 인증되며 1~3분 내 [소유확인] 완료

> 인증 실패 시: `index.html`에서 `<meta name="naver-site-verification"` 라인이 `<head>` 안에 있고,
> 캐시되지 않고 즉시 노출되는지 시크릿 모드로 직접 확인.

---

## 2. 사이트맵 제출

1. **[요청] > [사이트맵 제출]**
2. 입력: `sitemap.xml`
3. 제출 클릭 → 1~3일 내 "수집됨" 상태로 변경됨
4. **[요청] > [RSS 제출]**
5. 입력: `blog/rss.xml`
6. 제출 클릭

> 사이트맵에 등록된 47개 URL이 순차적으로 색인 대기열에 들어간다.

---

## 3. 페이지 수집 요청 (Indexing API 대체)

네이버는 구글의 Indexing API 같은 자동화 도구가 없으므로 **수동 요청**이 정답이다.
우선순위 페이지 5개를 즉시 요청한다.

1. **[요청] > [웹 페이지 수집]**
2. 다음 URL을 한 줄씩 입력 후 [확인]
   - `https://lifeportfolio.co.kr/`
   - `https://lifeportfolio.co.kr/product.html`
   - `https://lifeportfolio.co.kr/blog/`
   - `https://lifeportfolio.co.kr/blog/posts/2026-05-19-30s-career-shaking-first-check.html`
   - `https://lifeportfolio.co.kr/blog/posts/2026-05-19-report-interpret-execute-one-set.html`
3. 일일 한도: 50건 (사이트별). 나머지 신규 글은 매일 5~10건씩 누적 요청.

> 수집 요청 후 보통 24~72시간 이내 색인된다.

---

## 4. Yeti 크롤러 방문 확인

1. **[리포트] > [사이트 진단] > [수집 현황]**
2. 그래프에서 Yeti 방문 카운트가 0이 아닌지 확인 (1주 내 최소 1회 이상이어야 정상)
3. 0이라면:
   - `robots.txt`에 `User-agent: Yeti / Allow: /` 한 줄이 있는지 확인
   - 호스팅(Cloudflare Pages) 방화벽에서 Yeti UA가 차단되지 않는지 확인

> `robots.txt`에는 이미 Yeti 명시적 허용이 포함되어 있다.

---

## 5. 검색 결과 노출까지의 타임라인 (현실 기준)

| 시점 | 기대 결과 |
| --- | --- |
| 등록 즉시 | 소유확인 완료 |
| 1~3일 | 사이트맵 "수집됨" 표시, Yeti 방문 시작 |
| 3~14일 | 메인 페이지 색인 → `site:lifeportfolio.co.kr` 검색 시 결과 노출 |
| 2~6주 | "인생포트폴리오" 브랜드 검색에서 공식 사이트가 1~3위 진입 (초기엔 광고 영역 아래) |
| 6주~ | 본격 노출. 블로그 포스트가 일반 키워드(예: "30대 진로", "원포인트업")로 노출 시작 |

> 네이버는 구글과 달리 **C-Rank + DIA + AiRSearch** 복합 알고리즘이라
> 첫 노출에 시간이 더 걸린다. 인내 필요.

---

## 6. 노출 가속화 부가 작업 (선택)

1. **네이버 비즈니스 (구 마이비즈니스)**: <https://smartplace.naver.com/>
   - 1인 사업자라도 등록 가능. "파이스" / 656-12-02589 정보로 진행.
   - 등록 시 브랜드 검색 결과의 상단 "공식 정보" 카드로 노출됨.
2. **네이버 블로그 / 카페 게시**: 같은 4단계 framework 콘텐츠를 다른 표현으로 1편 발행.
   - 백링크는 1개만, 본문 최하단에 자연스럽게.
3. **네이버 지식iN 답변**: "인생 진로 검사", "자기경영 검사" 류 질문 5건 답변.
   - 답변 끝에 `lifeportfolio.co.kr` 1회만 언급. 과도하면 스팸 처리.

---

## 7. 트러블슈팅 체크리스트

- [ ] `site:lifeportfolio.co.kr` 검색 시 결과가 0건이면 → 사이트맵 재제출 + 메인 페이지 수집 요청.
- [ ] "인생포트폴리오" 검색 시 광고만 보이고 공식 사이트 안 보이면 → 6주는 더 기다림. 동시에 위 §6 부가 작업 진행.
- [ ] 제목/설명이 의도와 다르게 노출되면 → `<title>`과 `<meta name="description">`을 다시 확인하고 수집 요청.
- [ ] 모바일 검색에서만 안 보이면 → Mobile Yeti 대응 (`max-image-preview:large` 메타가 들어있어야 함, 현재 포함).

---

## 8. 운영 담당자 메모

- 신규 블로그 글이 발행될 때마다:
  1. `sitemap.xml`에 추가
  2. 서치어드바이저 [요청] > [웹 페이지 수집]에 해당 URL 입력
- 매주 월요일: **[리포트] > [검색 노출] > [사이트별 노출]** 확인 후 클릭률 낮은 페이지 제목/설명 개선.

— end —
