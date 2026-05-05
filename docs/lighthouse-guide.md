# Lighthouse & Core Web Vitals 가이드 (PR #19)

> **목표**: "만족한 고객이 최선의 광고" — 빠르고 매끄럽게 작동하는 사이트가 입소문의 토대.
> 광고 없이 자연 유입·재방문·공유로 매출을 만드는 전략의 첫 단추.

---

## 1. 측정 방법 3가지

### A. 실사용자 데이터 (RUM, Real User Monitoring) — 자동 수집 중
- 모든 페이지에 `assets/js/web-vitals.js` 주입 완료
- LCP / INP / CLS / FCP / TTFB 5개 지표를 GA4 `web_vitals` 이벤트로 자동 전송
- **GA4에서 보는 법**: 보고서 → 참여도 → 이벤트 → `web_vitals` 클릭
- **권장 설정**: GA4 → 관리 → 맞춤 정의에서 다음 4개 매개변수를 등록
  - `metric_name` (텍스트) — LCP / INP / CLS / FCP / TTFB
  - `metric_value` (숫자) — ms 단위 (CLS만 ×1000)
  - `metric_rating` (텍스트) — good / needs-improvement / poor
  - `metric_id` (텍스트) — 페이지뷰별 고유 ID

### B. Lighthouse (개발자 도구)
1. Chrome에서 `https://lifeportfolio.co.kr/` 열기
2. F12 → Lighthouse 탭 → Mobile / Performance 체크 → Analyze page load
3. 결과 4개 지표 확인 (Performance / Accessibility / Best Practices / SEO)

### C. PageSpeed Insights (Google 공식 외부 검사)
- URL: <https://pagespeed.web.dev/?url=https%3A%2F%2Flifeportfolio.co.kr%2F>
- 모바일·데스크톱 점수와 실사용자(CrUX) 데이터를 함께 보여줌
- 28일 누적 데이터가 있으면 "이 URL의 실사용자 데이터" 섹션 표시 (배포 4주 후부터)

---

## 2. Core Web Vitals 기준 (Google 2024 표준)

| 지표 | 의미 | 좋음 | 개선 필요 | 나쁨 |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | 가장 큰 콘텐츠 표시까지 걸린 시간 | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s |
| **INP** (Interaction to Next Paint) | 사용자 입력 후 화면 반응까지의 최대 지연 (FID 후속) | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | 페이지 로드 중 레이아웃 흔들림 누적값 | ≤ 0.1 | 0.1–0.25 | > 0.25 |
| FCP (First Contentful Paint) | 첫 콘텐츠가 그려지는 시점 | ≤ 1.8 s | 1.8–3.0 s | > 3.0 s |
| TTFB (Time to First Byte) | 서버 첫 응답 시간 | ≤ 0.8 s | 0.8–1.8 s | > 1.8 s |

**Google SEO 영향**: LCP / INP / CLS 3개 모두 "좋음" 등급일 때 모바일 검색 순위에서 약 5–8% 우대 (2024 기준).

---

## 3. PR #19 적용 효과 (예상)

| 항목 | Before | After | 근거 |
|---|---|---|---|
| index.html LCP | ~2.8 s | ~1.8–2.2 s | Firebase SDK 3개 → defer (렌더링 차단 제거) |
| report.html / program.html LCP | ~3.0 s | ~1.8–2.2 s | jsPDF + html2canvas → 다운로드 클릭 시 동적 로드 (240 KB 절감) |
| 첫 연결 시간 | 100–300 ms 손실 | 0 ms (사전 연결) | 17개 페이지 preconnect / dns-prefetch |
| 재방문 LCP | ~2.0 s | ~1.0 s | 이미지·폰트 캐시 30일 ~ 1년 immutable |
| GA4 측정 | 미지원 | 자동 수집 | `web-vitals.js` (RUM) |

---

## 4. 자주 묻는 개선 항목 체크리스트

### 🟢 PR #19에서 처리 완료
- [x] 렌더링 차단 스크립트 제거 (Firebase, jsPDF, html2canvas)
- [x] 정적 자산 캐시 강화 (이미지 30일, 폰트 1년 immutable)
- [x] preconnect / dns-prefetch 17 페이지 일괄 적용
- [x] 이미지 lazy-load 검증 스크립트 (`scripts/validate_lazyload.py`)
- [x] Web Vitals RUM (GA4 연동)

### 🟡 향후 개선 후보 (필요 시 PR #21 이후)
- [ ] Pretendard 서브셋 폰트 자체 호스팅 (지금은 CDN, 1년 캐시로 대응 중)
- [ ] inline `<style>` 블록 → 외부 CSS 파일 분리 (현재 페이지당 1,000~2,000줄 인라인)
- [ ] Critical CSS 추출 + 나머지는 `<link rel="preload" as="style">`
- [ ] 블로그 글 이미지 추가 시 WebP/AVIF + `loading="lazy"` (검증 스크립트가 가드)
- [ ] Service Worker 도입 (오프라인·재방문 즉시 응답)

### 🔴 의도적으로 안 한 것
- 이미지 lazy-load 일괄 적용 → 현재 사이트에 `<img>` 태그 0개. CSS/SVG/이모지 사용. 베이스라인 완벽.
- bundler 도입 → 페이지가 16개로 단순. 빌드 인프라 추가 비용 > 이득.

---

## 5. 자가 점검 절차 (배포 후 1주일)

1. 배포 완료 6시간 후 PageSpeed Insights 실행 (모바일 기준 90+ 목표)
2. 24시간 후 GA4 → 보고서 → 참여도 → 이벤트 → `web_vitals` 데이터 확인
3. 1주일 후 GSC → 환경 → 핵심 성능 보고서 → 모바일 URL 그룹별 LCP/INP/CLS 통과율 확인
4. 통과율 90% 미만인 URL이 있으면 위 §4 🟡 후보 항목 검토

---

## 6. 검증 명령어

```bash
# 이미지 lazy-load / CLS / a11y 검증
python3 scripts/validate_lazyload.py

# Analytics(GA4/GTM) 주입 검증
python3 scripts/validate_analytics.py

# JSON-LD 구조화 데이터 검증
python3 scripts/validate_jsonld.py
```

---

**기록 일자**: 2026-05-05 (PR #19)
**다음 PR**: #20 — 블로그 시드 콘텐츠(KO 3 + EN 2) + RSS 자동화
