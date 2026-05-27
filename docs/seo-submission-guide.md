# SEO Submission Guide — Pillar & Quarterly Posts

작성일: 2026-05-28
대상: 2026-05-28 AI 시대 자기 이해 Pillar(KO/EN) + 이후 분기별 보조 글
적용 범위: Google Search Console / Naver Search Advisor / Bing Webmaster Tools / IndexNow / LLM 인용 모니터링

본 문서는 새 글 배포 후 **30분 이내**에 수행해야 하는 색인 제출 절차와, 배포 후 **D+7 / D+30** 시점의 효과 측정 체크리스트를 정리한 운영 매뉴얼입니다.

---

## 0. 사전 조건 체크 (배포 직전)

- [ ] 새 글의 `<link rel="canonical">` 가 https + 정확한 경로로 들어가 있음
- [ ] KO/EN 양쪽 글에 `<link rel="alternate" hreflang="ko" ... />` `hreflang="en"` `hreflang="x-default"` 모두 들어감
- [ ] `sitemap.xml` 에 새 글이 `priority` 와 `lastmod` 포함하여 추가됨
- [ ] `blog/rss.xml` 과 `blog/rss-en.xml` 에 `<item>` 추가됨
- [ ] `llms.txt` 의 우선 토픽/URL 목록이 갱신됨
- [ ] JSON-LD 3종 블록(BlogPosting / BreadcrumbList / FAQPage) 이 모두 `json.loads` 통과

---

## 1. Google Search Console (GSC)

1. https://search.google.com/search-console 접속 → 속성: `https://lifeportfolio.co.kr/`
2. 좌측 **Sitemaps** → `sitemap.xml` 의 마지막 읽기 시각이 24시간 이내인지 확인. 갱신이 안 되어 있으면 **"제출"** 다시 클릭.
3. 좌측 **URL 검사** → 새 글의 전체 URL 붙여 넣기:
   - 예: `https://lifeportfolio.co.kr/blog/posts/2026-05-28-ai-era-self-understanding`
   - "라이브 URL 테스트" → 통과 시 **"색인 생성 요청"**
   - KO/EN 각각 따로 제출
4. (선택) **개선사항 → FAQ 결과** 에서 새 글의 FAQPage 스키마 인식 여부 확인. 보통 D+3~D+7 사이 반영.

> 주의: 24시간 내 "색인 생성 요청"은 동일 URL 기준 1회만 의미가 있습니다. 같은 URL을 반복 제출해도 우선순위가 더 올라가지 않습니다.

---

## 2. Naver Search Advisor

1. https://searchadvisor.naver.com 접속 → 사이트: `lifeportfolio.co.kr`
2. **요청 → 웹페이지 수집** → 새 글 URL 입력 → "확인"
   - KO 글은 필수, EN 글은 선택(네이버는 EN 페이지를 일반 한국 검색 결과에 잘 노출하지 않음)
3. **요청 → 사이트맵 제출** → `sitemap.xml` 의 "다시 읽기"
4. (D+1) **진단 → 사이트 진단** 에서 새 글의 노출 가능 여부 확인. 빨간 깃발이 뜨면 robots.txt / canonical / 404 점검.

> 네이버는 GSC보다 색인이 늦습니다(보통 D+3~D+14). 조급해하지 말 것.

---

## 3. Bing Webmaster Tools

1. https://www.bing.com/webmasters → 속성: `lifeportfolio.co.kr`
2. **URL 제출** → 새 글 URL 붙여 넣기 (1일 한도 10건)
3. **사이트맵** → `sitemap.xml` 의 "지금 가져오기"
4. Bing은 IndexNow 와 자동 연동되어 있어, 아래 IndexNow 핑을 보내면 별도 제출이 거의 필요 없음 — 단, 사이트맵 가져오기는 한 번 눌러주는 것이 안전.

---

## 4. IndexNow (Bing + Yandex + 파트너)

스크립트: `scripts/indexnow-ping.sh`

```bash
# 사전: 키 파일이 https://lifeportfolio.co.kr/${KEY}.txt 에 존재해야 함
export INDEXNOW_KEY="여기에-32~64자-hex-키"
bash scripts/indexnow-ping.sh
```

응답 코드 의미:
- `200` / `202` = 수락
- `400` = JSON 형식 오류
- `403` = 키 위치(`keyLocation`) 가 host와 불일치하거나 키 파일이 없음
- `422` = URL 형식 오류 (host 불일치 / 절대 URL 아님)

키 파일 발급 절차(최초 1회):
1. 무작위 hex 32~64자 생성 (예: `python -c "import secrets; print(secrets.token_hex(32))"`)
2. 그 값을 사이트 루트에 `${KEY}.txt` 파일로 배치 (Cloudflare Pages 의 `public/` 또는 `static/` 에 추가)
3. `https://lifeportfolio.co.kr/${KEY}.txt` 로 접속해 평문 키만 보이는지 확인
4. 같은 키를 환경변수로 export 하여 스크립트 실행

---

## 5. LLM/AEO 인용 모니터링 (NP1 — 40% 인용 점유 KPI)

NP1 (4단계 보고서) 의 핵심 지표는 **"AI 검색/LLM 답변에서 우리 콘텐츠가 인용될 확률"** 입니다. 직접 측정 도구가 부족하므로 아래 5개 채널을 **D+7 / D+30 / D+90** 시점에 수동 점검합니다.

| 채널 | 점검 쿼리 (KO) | 점검 쿼리 (EN) |
| --- | --- | --- |
| ChatGPT (web 검색 켠 상태) | "AI 시대 자기 이해 어떻게 해야 하나" | "self-understanding in the AI era" |
| Perplexity | "한국 AI 시대 정체성 위기 대처 도구" | "Korean knowledge workers AI identity assessment" |
| Google AI Overviews | "76문항 자기경영 검사" | (EN 쿼리는 노출 빈도 낮음) |
| 네이버 Cue: | "AI 시대 사명 발견" | n/a |
| Bing Copilot | "MBTI 대안 측정 기반 자기 이해" | "InBody-style self-understanding measurement" |

각 점검에서 확인할 3가지:
1. **인용 여부**: 우리 도메인이 출처/링크에 등장하는가
2. **인용 형식**: BlogPosting 의 어느 문단/문장이 발췌되는가
3. **잘못 인용된 사실**: 표 수치/명칭이 변형되어 인용되면 즉시 본문 표기 개선

기록 양식(예시):
```
2026-06-04 / Perplexity / "self-understanding in the AI era"
- 우리 EN pillar 인용됨? YES (3번째 출처)
- 어떤 문장? "AI knows the answer; it does not know your mission."
- 변형/오인용? 없음
```

---

## 6. 분기별 보조 글 배포 시 추가 점검

- 분기 시즌 트리거(1월 새해 결심, 4~5월 번아웃, 8월 휴가 복귀, 11~12월 연말 회고) 도래 **D-7** 시점에 글의 lastmod 를 한 번 갱신해 사이트맵 재제출
- IndexNow 핑은 게시일 + 시즌 진입 D-7 의 **두 번**만 보낼 것 (과다 핑은 무시당함)
- GSC 의 "성과 → 쿼리" 에서 시즌 키워드(예: `직장인 번아웃`, `연말 회고`) 노출 클릭 곡선 확인

---

## 7. 트러블슈팅 자주 나오는 문제

| 증상 | 원인 | 조치 |
| --- | --- | --- |
| GSC 에 "발견되었으나 색인이 생성되지 않음" | 본문 길이/유사 페이지 판정 | 본문 1,500자 이상 + 고유 H1/타이틀 + canonical 점검 |
| Naver 가 EN 글을 KO 결과에 섞어 보여줌 | hreflang 누락 | `hreflang="en"` `x-default` 모두 명시 |
| Bing 이 sitemap 을 캐시한 옛 버전을 들고 있음 | TTL | Webmaster Tools 에서 "지금 가져오기" 강제 |
| LLM 인용 시 표 수치가 살짝 다르게 나옴 | LLM 의 round-off | 본문에서 그 수치를 두 번 이상, 정확한 형태로 반복 노출 |

---

본 문서는 새 pillar / 분기별 글 배포 직후마다 다시 열어 체크리스트로 사용합니다.
