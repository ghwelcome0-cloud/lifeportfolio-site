# Google · Naver Search Console 색인 요청 가이드

> **목적**: 등록된 Search Console에서 사이트맵을 제출하고, 핵심 페이지의 색인을
> 빠르게 요청합니다. 자동 발견을 기다리는 대신 **즉시 크롤링 요청**으로 색인 속도를
> 1~3일 단위로 단축합니다.
>
> **소요 시간**: 10분 (1회만 진행, 이후 자동)

---

## 1. Google Search Console — Sitemap 제출 (3분)

### Step 1
https://search.google.com/search-console 접속 → 좌측 상단 속성 선택
`https://lifeportfolio.co.kr/`

### Step 2
좌측 메뉴 → **색인생성 > Sitemaps**

### Step 3
"새 사이트맵 추가" 입력란에 다음 입력 후 **제출**:
```
sitemap.xml
```

### Step 4 — 결과 확인
24시간 후 다시 방문 → "성공" 상태 + 발견된 URL 수 확인 (현재 사이트맵 기준 약 13~16개 예상)

---

## 2. Google — 핵심 페이지 즉시 색인 요청 (3분)

좌측 메뉴 → **URL 검사**

다음 5개 URL을 하나씩 입력 → "색인 생성 요청" 클릭:

| 우선순위 | URL | 이유 |
|---|---|---|
| 1 | `https://lifeportfolio.co.kr/` | 메인 (FAQPage 14개 노출) |
| 2 | `https://lifeportfolio.co.kr/blog/` | 블로그 허브 |
| 3 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-self-management-vs-personality-test.html` | MBTI 비교 (검색량 높음) |
| 4 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-only-one-report-200-percent-guide.html` | Only One 리포트 |
| 5 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-first-three-weeks-mission-routine.html` | 21일 루틴 |

**팁**: Google은 일일 색인 요청 한도가 있으므로 5개씩 배치로 처리. 영어 포스트 2개도 다음 날 같은 방식으로 추가.

---

## 3. Naver Search Advisor — 사이트맵 제출 (2분)

### Step 1
https://searchadvisor.naver.com 접속 → 등록된 `https://lifeportfolio.co.kr` 클릭

### Step 2
좌측 메뉴 → **요청 > 사이트맵 제출**

### Step 3
입력란에 다음 입력 후 **확인**:
```
sitemap.xml
```

### Step 4 — RSS 피드도 등록 (블로그 색인 가속)
좌측 메뉴 → **요청 > RSS 제출**
다음 2개를 각각 등록:
```
blog/rss.xml
blog/rss-en.xml
```

---

## 4. Naver — 웹페이지 수집 요청 (2분)

좌측 메뉴 → **요청 > 웹페이지 수집**

다음 5개 URL을 하나씩 입력 → 확인:

| 우선순위 | URL |
|---|---|
| 1 | `https://lifeportfolio.co.kr/` |
| 2 | `https://lifeportfolio.co.kr/blog/` |
| 3 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-self-management-vs-personality-test.html` |
| 4 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-only-one-report-200-percent-guide.html` |
| 5 | `https://lifeportfolio.co.kr/blog/posts/2026-05-05-first-three-weeks-mission-routine.html` |

**Naver 색인 속도**: 빠르면 1~3일, 평균 1~2주.

---

## 5. 추가 (선택) — Bing Webmaster Tools

Bing은 ChatGPT(검색 모드)·Copilot의 검색 백엔드입니다. **LLMO 효과 동반 상승**.

### 등록 방법
1. https://www.bing.com/webmasters 접속
2. **Google Search Console에서 가져오기** 버튼 클릭 (가장 쉬움)
3. lifeportfolio.co.kr 선택 → 자동 동기화
4. 같은 방식으로 sitemap.xml 제출

소요 시간: 3분 (Google Search Console 등록되어 있으므로 자동 동기화)

---

## 6. 색인 결과 추적 (1주 뒤 확인)

### Google
- Search Console > **색인생성 > 페이지** → 색인된 페이지 수 확인
- Google에서 직접 검색: `site:lifeportfolio.co.kr` → 노출되는 페이지 확인

### Naver
- Search Advisor > **현황 > 인덱스 현황** → 수집된 페이지 수 확인
- Naver에서 직접 검색: `site:lifeportfolio.co.kr` → 노출되는 페이지 확인

### 정상 진행 신호
| 시점 | Google 색인 페이지 | Naver 색인 페이지 |
|---|---|---|
| 1주 | 5~10개 | 1~3개 |
| 1개월 | 13~16개 (전체) | 5~10개 |
| 3개월 | 13~16개 + 키워드 노출 | 13~16개 |

색인이 안 되면: `robots.txt` Disallow 확인, `<meta robots>` noindex 확인,
canonical URL 충돌 확인.

---

## 7. 자주 묻는 질문

**Q. 매번 새 글 올릴 때마다 색인 요청해야 하나요?**
A. 아닙니다. 사이트맵에 자동 반영되며, 일주일 내 Google이 자동 발견합니다.
   다만 **빨리 노출되길 원하는 핵심 글**만 1회 요청하는 것을 권장합니다.

**Q. 색인 요청을 했는데 안 뜹니다.**
A. 정상입니다. Google은 평균 1~3일, Naver는 1~14일 소요됩니다.
   1개월 후에도 안 뜨면 `robots.txt`와 페이지 자체의 `noindex` 메타태그를 확인하세요.

**Q. Bing은 정말 등록할 가치가 있나요?**
A. 한국 사용자 점유율은 낮지만, **ChatGPT 검색 + Microsoft Copilot의 백엔드**입니다.
   3분 투자로 LLMO 효과 함께 얻으니 ROI 높습니다.

---

**작성일**: 2026-05-05 (PR #26)
**다음 점검**: 1주일 뒤 색인 페이지 수 확인 → 1개월 뒤 키워드 노출 시작 점검
