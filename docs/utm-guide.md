# UTM 표준화 가이드 (PR #18)

**목적**: GA4·GTM에서 채널·캠페인별 ROAS를 정확히 측정하기 위해
모든 외부 유입 링크에 동일한 UTM 규칙을 적용합니다.

## UTM 5 파라미터 표준값

| 파라미터 | 의미 | 표준값 (snake_case 고정) |
|---|---|---|
| `utm_source`   | 매체/플랫폼 | `instagram`, `facebook`, `kakao`, `naver`, `google`, `tiktok`, `youtube`, `email`, `brunch` |
| `utm_medium`   | 트래픽 종류 | `cpc`, `cpm`, `social`, `organic_social`, `email`, `referral`, `affiliate` |
| `utm_campaign` | 캠페인 코드 | `2026q2_launch`, `mothers_day`, `payday_promo`, `en_global_launch` |
| `utm_content`  | 광고 소재 식별 | `hook_a_body`, `hook_b_question`, `image_v3`, `video_15s` |
| `utm_term`     | 키워드 (검색광고만) | `인생설계`, `진로검사`, `life_mission_test` |

## 채널별 표준 템플릿

### 1) Instagram 피드/스토리 (organic)
```
https://lifeportfolio.co.kr/?utm_source=instagram&utm_medium=organic_social&utm_campaign=2026q2_launch&utm_content=story_a
```

### 2) 페이스북/메타 광고
```
https://lifeportfolio.co.kr/product.html?utm_source=facebook&utm_medium=cpc&utm_campaign=2026q2_launch&utm_content=hook_a_body
```

### 3) 카카오 모먼트/채널 메시지
```
https://lifeportfolio.co.kr/?utm_source=kakao&utm_medium=cpm&utm_campaign=payday_promo&utm_content=msg_v1
```

### 4) 네이버 검색광고
```
https://lifeportfolio.co.kr/?utm_source=naver&utm_medium=cpc&utm_campaign=2026q2_launch&utm_content=ad_a&utm_term=인생설계
```

### 5) 구글 광고 (자동 태깅 GCLID 사용 권장 + 백업 UTM)
```
https://lifeportfolio.co.kr/?utm_source=google&utm_medium=cpc&utm_campaign=en_global_launch&utm_content=hook_eng_a&utm_term=life_mission_test
```

### 6) 이메일 뉴스레터
```
https://lifeportfolio.co.kr/blog/?utm_source=email&utm_medium=email&utm_campaign=weekly_insight&utm_content=cta_button
```

### 7) 브런치/미디엄 글 하단 링크
```
https://lifeportfolio.co.kr/?utm_source=brunch&utm_medium=referral&utm_campaign=2026q2_launch&utm_content=article_001
```

## GA4·GTM 측정 매핑

본 PR(#18)에서 자동 트래킹되는 표준 이벤트:

| 이벤트 | 트리거 | 핵심 파라미터 |
|---|---|---|
| `page_view` | GTM 자동 | `page_location`, `page_title` |
| `view_item` | `/product.html` 진입 | `value=9900`, `currency=KRW`, `items` |
| `begin_checkout` | 페이플/PayPal 버튼 클릭 | `method`, `currency`, `value` |
| `purchase` | `/payment-success.html` 도달 | `transaction_id`, `method`, `value` |
| `assessment_start` | `/suvey.html` 진입 | `item_id=LP-ASSESSMENT-76Q` |
| `assessment_complete` | 응답 제출 클릭 | `duration_ms` |
| `report_view` | `/report.html` 도달 | `lang=ko/en` |
| `sign_up` / `generate_lead` | `/signup.html` 신규 가입 완료 | `method=google` |
| `login` | `/login.html` 로그인 완료 | `method=google` |

## GA4 전환(Key Event) 설정 권장

GA4 > 관리자 > 이벤트 > "주요 이벤트로 표시" 토글:
- ✅ `purchase` (필수)
- ✅ `begin_checkout`
- ✅ `assessment_complete`
- ✅ `sign_up` / `generate_lead`

## ROAS 계산 가능 채널 매핑

```
Channel grouping (GA4 default):
  Paid Social  ← utm_medium=cpc & utm_source=(facebook|instagram|tiktok)
  Paid Search  ← utm_medium=cpc & utm_source=(google|naver|bing)
  Organic Social ← utm_medium=organic_social
  Email        ← utm_medium=email
  Referral     ← utm_medium=referral
```

## 자주 하는 실수

- ❌ `utm_source=Instagram` (대문자) → ✅ `instagram` (전부 소문자)
- ❌ `utm_campaign=2026 Q2 런칭` (공백·한글) → ✅ `2026q2_launch`
- ❌ `utm_medium=sns` (비표준) → ✅ `organic_social` 또는 `cpc`
- ❌ UTM 없이 단축 URL만 사용 → ✅ 단축 후에도 원본에 UTM 유지

---
_Last updated: 2026-05-05 (PR #18)_
