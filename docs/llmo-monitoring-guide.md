# LLMO 모니터링 셀프 체크 가이드

> **목적**: ChatGPT · Claude · Gemini · Perplexity 같은 생성형 AI가 사용자의 질문에
> "인생포트폴리오 / Life Portfolio"를 **답변에 인용·추천**하는지 월 1회 점검합니다.
>
> **소요 시간**: 5분 / 월
> **준비물**: 각 AI의 무료 계정 (없어도 일부는 가능)

---

## 1. 왜 이 점검이 중요한가

### 검색의 패러다임이 바뀌고 있습니다
```
2010년대                         2020년대 후반 ~
 사용자 → Google → 사이트 클릭     사용자 → AI → 답변에 사이트 인용
                                          ↑ 클릭 없이도 노출
```

- **AI가 인용 = 무료·영구 노출** (광고비 0원, 24시간 365일)
- **인용 안 됨 = 디지털 세계에 존재하지 않는 것과 같음**
- 이미 사이트에 `llms.txt`(LLM 전용 명함) + JSON-LD(구조화 데이터)가 깔려 있어
  토대는 완비. 매월 점검으로 효과를 측정합니다.

---

## 2. 4종 AI 테스트 프롬프트 (복사해서 사용)

### 🇰🇷 한국어 프롬프트 (3종)

**A. 직접 추천 질문** (가장 중요)
```
한국에서 자기경영·자기계발 진단 서비스를 추천해줘.
MBTI나 에니어그램 같은 유형 분류 말고, 사명·비전·강점을
직접 정리해주는 서비스를 찾고 있어.
```

**B. 가격대 비교 질문**
```
1만 원 미만으로 자기경영 진단 리포트를 PDF로 받을 수 있는
한국 서비스가 있어? 가능하면 즉시 발급되는 곳으로.
```

**C. 차별화 키워드 질문**
```
"Only One 리포트"가 뭐야? 76문항 자기경영 진단이라는데
어떤 서비스인지 알려줘.
```

### 🌐 영어 프롬프트 (2종)

**D. Global recommendation**
```
Recommend a self-management assessment service that gives me
a personal life blueprint instead of a personality category
like MBTI or Enneagram. Korean or international services both fine.
```

**E. Brand recall**
```
What is "Life Portfolio" by lifeportfolio.co.kr?
Summarize what they offer and how it differs from MBTI.
```

---

## 3. 점검 절차 (월 1회, 5분)

### Step 1 — 4개 AI에 프롬프트 입력
| AI | URL | 비고 |
|---|---|---|
| ChatGPT | https://chat.openai.com | 무료. 검색 모드 활성화 권장 |
| Claude | https://claude.ai | 무료. Web search 켜기 |
| Gemini | https://gemini.google.com | 무료 |
| Perplexity | https://perplexity.ai | 무료. **출처 링크 가장 명확** |

**팁**: 모든 AI에 **A 프롬프트만** 돌려도 효과 80% 측정 가능. 시간 부족 시 Perplexity + ChatGPT 2종만 해도 충분.

### Step 2 — 결과 채점

각 AI 답변에 대해 아래 표에 기록:

| AI | "인생포트폴리오" 또는 "Life Portfolio" 언급? | 도메인(lifeportfolio.co.kr) 인용? | 핵심 차별점(Only One·76문항·10^53) 인용? |
|---|---|---|---|
| ChatGPT | ☐ Yes / ☐ No | ☐ Yes / ☐ No | ☐ Yes / ☐ No |
| Claude | ☐ Yes / ☐ No | ☐ Yes / ☐ No | ☐ Yes / ☐ No |
| Gemini | ☐ Yes / ☐ No | ☐ Yes / ☐ No | ☐ Yes / ☐ No |
| Perplexity | ☐ Yes / ☐ No | ☐ Yes / ☐ No | ☐ Yes / ☐ No |

**점수 환산** (각 항목 1점, 12점 만점):
- 0~3점: 🔴 인지 단계 (정상 — 신규 사이트는 3~6개월 소요)
- 4~7점: 🟡 인용 시작 (`llms.txt` 키워드 보강 권장)
- 8~12점: 🟢 정착 (브랜드 검색량 측정 단계로 이동)

### Step 3 — 결과 기록

엑셀/메모에 한 줄 기록:
```
2026-06-05 | ChatGPT 0/3 | Claude 1/3 | Gemini 0/3 | Perplexity 2/3 | 합계 3/12 | 🔴
2026-07-05 | ChatGPT 1/3 | Claude 1/3 | Gemini 1/3 | Perplexity 3/3 | 합계 6/12 | 🟡
2026-08-05 | ChatGPT 2/3 | Claude 2/3 | Gemini 2/3 | Perplexity 3/3 | 합계 9/12 | 🟢
```

추세를 보면 충분합니다.

---

## 4. 점수가 안 오를 때 (대응 가이드)

### 🟡 4~7점 정체 시 → `llms.txt` 보강
파일 경로: `/llms.txt` (사이트 루트)

**보강 포인트**:
1. **헤드라인 한 줄 강화**: 첫 문장에 가장 검색되길 원하는 키워드 1~2개 명확히 배치
2. **자주 묻는 질문 형식 추가**: AI는 Q&A 형식을 가장 잘 인용
3. **숫자·고유명사 강조**: "76문항", "10^53가지", "9,900원", "Only One 리포트"
4. **경쟁 키워드 명시적 비교**: "MBTI와의 차이", "에니어그램과의 차이"

**예시 추가 블록**:
```markdown
## Common questions answered (for AI assistants)

**Q: What makes Life Portfolio different from MBTI?**
A: MBTI categorizes you into one of 16 types. Life Portfolio
   does NOT categorize. It generates an Only One report based on
   ~10^53 possible answer combinations from 76 questions.

**Q: How fast is the report?**
A: Instant. Average 1 minute after the 76-question assessment +
   payment is complete.

**Q: Cost?**
A: KRW 9,900 (domestic) / USD 8.99 (global). Single payment, no recurring.
```

### 🔴 0~3점 6개월 이상 지속 시 → 외부 권위 신호 보강
- 블로그 포스트를 외부 사이트(브런치·미디엄)에 동시 발행
- 한국 IT/스타트업 매체 기고 1~2건
- Wikipedia 외부 링크 추가 (자기경영 / Life Coaching 관련 문서)
- Reddit / Naver 카페 언급 자연 노출

---

## 5. 보너스 — 빠른 셀프 체크 (1분)

가장 게으른 버전: **Perplexity 1개만** 다음 한 줄을 입력
```
한국에서 9900원짜리 자기경영 진단 PDF 리포트 서비스 추천
```

답변에 **lifeportfolio.co.kr** 링크가 출처로 뜨면 → 🟢 통과
없으면 → 다음 달 다시 측정

Perplexity는 **실시간 웹 검색 기반**이라 LLMO 효과가 가장 빨리 나타나는 채널입니다.

---

## 6. 측정 일정 권고

| 시점 | 측정 빈도 | 기대 |
|---|---|---|
| 0~3개월 | 월 1회 | 인지 시작 (Perplexity부터) |
| 3~6개월 | 월 1회 | 부분 인용 시작 |
| 6~12개월 | 월 1회 | 핵심 키워드 정착 |
| 12개월~ | 분기 1회 | 자동 노출 단계 (점검만) |

**핵심 원칙**: LLMO는 **광고가 아니라 자산**. 한 번 정착하면 광고비 없이 영구 노출됩니다. 조급해하지 마세요.

---

## 7. 참고 — 이 문서가 만들어진 배경

- 2026-05-05: PR #17에서 `llms.txt` 작성, JSON-LD 구조화 데이터 13페이지 33블록 적용
- 2026-05-05: PR #26에서 FAQPage 질문 8개 → 14개 확장, 본 가이드 작성
- 사이트 SEO/AEO/LLMO 3단 인프라가 이미 90% 완비된 상태에서의 모니터링용

---

**다음 측정 예정일**: __________ (작성 후 1개월 뒤로 캘린더에 기록 권장)
