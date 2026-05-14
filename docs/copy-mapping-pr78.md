# 📋 카피 변경 매핑표 v2 — PR #78 사전 자료

> **버전**: v2 (2026-05-14) — 가격 정책 거짓 할인 표시 제거, 사용자 4가지 결정 반영
> **목적**: Week 2 PR #78 (Value Bridge — JTBD 리프레이밍) 착수 전, 홈/상품 페이지의 모든 카피 변경 사항을 사용자가 한눈에 검토할 수 있도록 제출하는 사전 매핑 문서.

## ✅ 사용자 확정 사항 (v2 반영)

| 항목 | 결정 |
|---|---|
| ① Hero H1 헤드라인 톤 | (a) 그대로 OK — "방황은 정보 부족이 아닙니다. 당신만의 실행 OS가 아직 없을 뿐." |
| ② D2 카피 게재 위치 | **4곳 모두** (Hero sub + OG meta + Final CTA + Product purchase_sub) |
| ③ "당신의 여정" 섹션 위치 | (a) Final CTA 직전 |
| ④ JTBD 단어 선택 | (a) "첫 3주 실행 설계도" — O. 컨설팅 원안 |
| **⚠️ 가격 정책** | **거짓 할인 표시 제거** — 정가 19,900원 미적용 사실 확인됨 → `hero.price_strike` 삭제, `hero.price_badge` "−50% 오픈가" → "오픈 특가" |
>
> **검토 방법**: 각 행마다 Before → After를 비교하시고, 동의/수정/제외 의견을 표시해 주시면 됩니다. 모든 변경은 사용자 최종 승인 후에만 PR #78에 반영됩니다.
>
> **변경 안 됨**: 가격(₩9,900 / $8.99), 결제 흐름, 기능, 디자인 — **카피(문구)만** 변경 대상입니다.
>
> **기준 문서**:
> - O. 인생포트폴리오 구매전환 컨설팅 제안서 (JTBD 리프레이밍)
> - C. 브랜드 선언문 (Desire → Insight → Action 3단 구조)
> - A. MaaS 이론 선언서 (의미-as-a-Service 포지셔닝)
> - B. 의미 경제의 부상 (사회적 증거)
> - D2 확정 카피: **"리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다."**

---

## 📑 정책 코드 (변경 근거)

| 코드 | 정책 |
|---|---|
| **P2** | JTBD 리프레이밍 — "검사" → "첫 3주 실행 설계도" |
| **P3** | D2 한 줄 메시지 = 모든 표면의 북극성 |
| **P4** | 사다리 오퍼 — "당신의 여정" 표시(준비중 배지, 가격/CTA 없음) |

---

## 🎯 변경 원칙 (윤리·기독교 가치관 가드레일)

이 매핑표의 모든 변경은 다음 가드레일을 통과한 것만 포함했습니다:

- ✅ 다크 패턴 없음 (강제·기만·거짓 희소성 없음)
- ✅ 두려움/수치심/자존감 공격 카피 없음
- ✅ 거짓 후기·간증 없음
- ✅ 부의 복음(Prosperity Gospel) 변질 없음 — "사면 부자 됩니다" 류 ❌
- ✅ 진리·정직·청지기·이웃 사랑 톤 (마 22:39, 24:45)

---

# 1️⃣ index.html (홈페이지)

## 1.1 🌐 Meta 태그 (검색 노출 + SNS 공유)

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| M1 | `<title>` (line 46) | `meta.title` | KO | 인생포트폴리오 \| 9,900원 · 발견하고, 살아내고, 남기는 한 권의 인생 설계도 | 인생포트폴리오 \| ₩9,900 — 방황을 끝내는 첫 3주 실행 설계도 | P2 |
| M1 | `<title>` (line 46) | `meta.title` | EN | Life Portfolio \| $8.99 USD · Discover, Live, and Leave a Form — Your One-Volume Life Blueprint | Life Portfolio \| $8.99 — Your First 3-Week Blueprint to End the Drift | P2 |
| M2 | `<meta description>` | `meta.description` | KO | 76문항 15분 진단으로 사명·비전·강점이 한 줄로 정리되고, 이번 주 첫 행동 3가지·3주 살아내는 루틴까지. 9,900원, 결제 즉시 자동 생성. | 방향은 있는데 실행이 안 되시나요? 76문항 15분으로 사명·강점이 한 줄로 정리되고, 이번 주 첫 행동 3가지와 3주 실행 설계도가 ₩9,900에 한 권으로 도착합니다. | P2+P3 (Desire) |
| M2 | `<meta description>` | `meta.description` | EN | A 76-question, 15-minute diagnostic that distills your mission, vision, and strengths into a single line… | Have direction but can't start? In 76 questions / 15 minutes, your mission and strengths land in one line — with 3 first actions and a 3-week blueprint, delivered for $8.99. | P2+P3 |
| M3 | `<meta og:title>` | `meta.og_title` | KO | 당신 안에 이미 답이 있습니다 — 9,900원 인생 설계도 | 리포트대로 살면, 당신의 삶이 자산이 됩니다 — ₩9,900 첫 3주 실행 설계도 | **D2 카피** |
| M3 | `<meta og:title>` | `meta.og_title` | EN | The answer is already within you — Your Life Blueprint for $8.99 USD | Live by the report — your life becomes an asset. $8.99 First 3-Week Blueprint | **D2 카피** |
| M4 | `<meta og:description>` | `meta.og_description` | KO | 발견하고, 살아내고, 남기는 한 권의 인생 설계도. 사명을 살아내는 첫 3주 패키지. | 그 자산은 누군가의 양식이 됩니다. 발견·살아냄·양식을 한 권에 잇는 첫 3주 실행 설계도. | **D2 카피** |
| M4 | `<meta og:description>` | `meta.og_description` | EN | Discover, live, and leave a form. A one-volume life blueprint and a 3-week starter package… | And that asset becomes food for someone else. A 3-week blueprint that links discovery, living, and form into one volume. | **D2 카피** |

---

## 1.2 🚀 Top Navigation CTA (line 1069)

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| N1 | 상단 우측 CTA 버튼 | `common.cta_start` | KO | 9,900원 시작하기 → | 첫 실행 설계도 받기 → | **P2 (O. 컨설팅 핵심)** |
| N1 | 상단 우측 CTA 버튼 | `common.cta_start` | EN | Start for $8.99 USD → | Get my First Blueprint → | **P2** |

> ⚠️ **주의**: `common.cta_start`는 여러 페이지에서 재사용되는 공용 키입니다. 변경 시 모든 페이지에 동시 적용됩니다(헤더 CTA 일관성). 영향 범위는 grep 결과 6개 파일.

---

## 1.3 💰 가격 표시 영역 (⚠️ 거짓 할인 표시 제거 — 윤리 가드레일)

> **법적 근거**: 「전자상거래 등에서의 소비자보호에 관한 법률」 제21조 (금지행위) — 실제 판매 이력이 없는 가격을 정가로 표시하면 거짓·과장 광고에 해당. 사용자 확인: **정가 19,900원에 실제 판매한 이력 없음** → 거짓 할인 표시 즉시 제거.

| # | 위치(line) | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| **PR1** | 1106 | `hero.price_strike` | KO | 정가 19,900원 | **(빈 문자열)** | 전자상거래법 §21 — 거짓 할인 |
| **PR1** | | `hero.price_strike` | EN | List $17.99 USD | **(빈 문자열)** | Consumer protection |
| **PR2** | 1108 | `hero.price_badge` | KO | −50% 오픈가 | **오픈 특가** | 거짓 할인율 제거, 신규 출시는 명시 가능 |
| **PR2** | | `hero.price_badge` | EN | −50% Launch | **Launch Price** | 거짓 할인율 제거 |
| **PR3** | 1107 | `hero.price_now` | KO | ₩9,900 | **(유지)** | ✅ 실제 가격 |
| **PR3** | | `hero.price_now` | EN | $8.99 USD | **(유지)** | ✅ |
| **PR4** | 1106 DOM | `<span class="price-strike">` | — | (취소선 가격 노출) | **요소 자체 제거 또는 CSS `display:none`** | i18n 빈 문자열만으로는 DOM 잔존 — 추가 처리 필요 |

### 가격 영역 변경 후 최종 표시 모습
**KO**: `₩9,900` [오픈 특가]  (취소선 정가 없음)
**EN**: `$8.99 USD` [Launch Price]  (no strike-through list price)

> 💡 **안정성 메모**: 가격 영역 DOM 변경은 i18n 키만 비우면 빈 `<span>`이 남습니다. PR #78 코드 작업 시 `<span class="price-strike">` 요소 자체를 HTML에서 제거하거나, CSS에 `.price-strike { display:none }` 한 줄 추가하는 방식 중 안전한 쪽으로 처리합니다(기존 레이아웃 깨짐 방지). **기능·결제·인증에 영향 없음.**

---

## 1.4 🎯 Hero 영역 (메인 헤드라인 — 가장 중요)

| # | 위치(line) | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| H1 | 1079 (eyebrow) | `hero.eyebrow` | KO | ★ Only One Report · 사람마다 단 하나의 결과 | ★ Only One Report · 방향은 있는데 실행이 안 될 때 | P3 (Desire) |
| H1 | | `hero.eyebrow` | EN | ★ Only One Report · One-of-a-kind result for every person | ★ Only One Report · When you have direction but can't start | P3 |
| H2 | 1081 (`<h1>`) | `hero.title` | KO | `<span class="accent">당신 안에 이미 답이 있습니다.</span> <br> 그 답을 <span class="highlight">당신의 길</span>로…` | `<span class="accent">방황은 정보 부족이 아닙니다.</span> <br> 당신만의 <span class="highlight">실행 OS</span>가 아직 없을 뿐. <br> ₩9,900으로 첫 3주 실행 설계도를 받으세요. | P2+P3 (A. MaaS Human OS) |
| H2 | | `hero.title` | EN | `<span class="accent">The answer is already within you.</span> <br> We turn that answer into <span class="highlight">your path</span>…` | `<span class="accent">Drifting isn't a lack of information.</span> <br> It's a missing <span class="highlight">execution OS</span> of your own. <br> Get your First 3-Week Blueprint for $8.99. | P2+P3 |
| H3 | 1086 (sub) | `hero.h1_sub` | KO | — 발견하고, 살아내고, 남기는 한 권의 인생 설계도 | — **리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다.** | **D2 카피 (북극성)** |
| H3 | | `hero.h1_sub` | EN | — A one-volume life blueprint to discover, live, and leave a form | — **Live by the report — your life becomes an asset; that asset becomes food for someone else.** | **D2 카피** |
| H4 | 1088 (lead) | `hero.lead` | KO | 15분, 76문항. 당신의 답변이 그대로 결과가 되어, <br> **사명·비전·강점**, 그리고 이번 주 첫 행동 3가지가 한 권에 담깁니다. | 15분, 76문항. <br> 검사가 아니라 **첫 3주 실행 설계도**입니다. 사명·강점이 한 줄로 정리되고, <br> 이번 주 첫 행동 3가지가 손에 잡힙니다. | P2 (Insight) |
| H4 | | `hero.lead` | EN | 15 minutes, 76 questions. Your answers become the result… | 15 minutes, 76 questions. <br> Not a test — your **First 3-Week Blueprint**. Mission and strengths in one line, <br> 3 first actions you can hold this week. | P2 |
| H5 | 1119 (primary CTA) | `hero.cta_primary` | KO | 9,900원으로 첫 인생 설계도 받기 → | **₩9,900으로 첫 3주 실행 설계도 받기** → | P2 |
| H5 | | `hero.cta_primary` | EN | Get my Life Blueprint for $8.99 USD → | **Get my First 3-Week Blueprint for $8.99** → | P2 |
| H6 | 1147 (card3 헤드) | `hero.card3_h` | KO | 살아낸 당신의 삶이, 누군가의 양식이 됩니다 | **(유지)** 살아낸 당신의 삶이, 누군가의 양식이 됩니다 | D2와 정렬 — 변경 없음 ✅ |

> 💡 **참고**: Hero 카드 3개(H6 영역)는 이미 D2 메시지와 잘 정렬되어 있어 **변경 없음**으로 제안합니다.

---

## 1.4 ✅ 30초 자가진단 (Self-Check) — line 1190~1212

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| S1 | item1 | `selfcheck.item1` | KO | "방향은 있는데, 한 줄로 정리되지 않았습니다" | **(유지)** | ✅ JTBD 부합 |
| S2 | item2 | `selfcheck.item2` | KO | "성향 검사는 여러 번 해봤지만, 살아냄으로 이어지지 않았습니다" | **(유지)** | ✅ |
| S3 | item3 | `selfcheck.item3` | KO | "계획은 잘 세우는데, 나에게 맞는 흐름은 찾지 못했습니다" | **(유지)** | ✅ |
| S4 | item4 | `selfcheck.item4` | KO | "중요한 결정 앞에서 기준 한 줄이 있으면 좋겠습니다" | **(유지)** | ✅ |
| S5 | item5 | `selfcheck.item5` | KO | "이해에서 멈추지 않고, 이번 주 살아내는 첫 걸음을 손에 잡고 싶습니다" | **(유지)** | ✅ |

> ✅ **자가진단 영역은 이미 JTBD를 정확히 짚고 있어 변경 제안 없음.** (O. 컨설팅 제안서의 페르소나 정의와 일치)

---

## 1.5 ⚡ Final CTA 영역 (line 1700~1711)

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| F1 | 1700 (`<h2>`) | `final_cta.h2` | KO | 당신 안의 사명을 <br> **살아낸 삶으로 남기는 자리** | **리포트대로 살면, <br> 당신의 삶이 자산이 됩니다** | **D2 카피** |
| F1 | | `final_cta.h2` | EN | A place to leave the mission within you <br> **as a lived life** | **Live by the report — <br> your life becomes an asset** | **D2 카피** |
| F2 | 1701 (`<p>`) | `final_cta.p` | KO | 인생포트폴리오는 **당신 안의 사명과 비전을 발견하시도록 돕고**, 살아낸 하루하루가 **누군가의 든든한 양식으로 남는 흐름**을 함께 그려갑니다. | **그 자산은 누군가의 양식이 됩니다.** 인생포트폴리오는 발견 → 살아냄 → 양식의 흐름을 한 권으로 잇습니다. | **D2 카피** |
| F2 | | `final_cta.p` | EN | Life Portfolio helps you discover the mission and vision already within you… | **And that asset becomes food for someone else.** Life Portfolio links discovery → living → form into one volume. | **D2 카피** |
| F3 | 1709 (CTA) | `final_cta.cta` | KO | 9,900원으로 첫 인생 설계도 받기 → | **₩9,900으로 첫 3주 실행 설계도 받기** → | P2 |
| F3 | | `final_cta.cta` | EN | Get my Life Blueprint for $8.99 USD → | **Get my First 3-Week Blueprint for $8.99** → | P2 |
| F4 | 1711 (live note) | `final_cta.live_note` | KO | 지금 이 순간에도 자동 생성 시스템이 작동 중입니다 · 평균 응답 시간 15분 | **(유지)** | ✅ (거짓 희소성 없음) |

---

## 1.6 🪜 "당신의 여정" 신규 섹션 (G3 결정사항)

> **위치**: `index.html` Final CTA 직전 (line ~1695 근처에 새 섹션 삽입)
> **표시 정책**: 준비중 배지 ⭕, 가격 표시 ❌, 결제 CTA ❌, 출시 알림 이메일 ❌

### 신규 i18n 키 추가 제안:

| 키 | KO | EN |
|---|---|---|
| `journey.eyebrow` | 당신의 여정 (Your Journey) | Your Journey |
| `journey.h2` | ₩9,900은 시작입니다 — <br> 다음 단계를 정성껏 준비하고 있습니다 | $8.99 is the start — <br> we're carefully preparing the next steps |
| `journey.step1_label` | 지금 (Today) | Today |
| `journey.step1_title` | 첫 3주 실행 설계도 | First 3-Week Blueprint |
| `journey.step1_badge` | 구매 가능 | Available |
| `journey.step2_label` | 3주 후 | After 3 weeks |
| `journey.step2_title` | 21일 실행 점검 패키지 | 21-Day Execution Check-in |
| `journey.step2_badge` | 준비 중 | Coming Soon |
| `journey.step3_label` | 3개월 후 | After 3 months |
| `journey.step3_title` | 프로그램 | Program |
| `journey.step3_badge` | 준비 중 | Coming Soon |
| `journey.step4_label` | 6개월 후 | After 6 months |
| `journey.step4_title` | 1:1 코칭 | 1:1 Coaching |
| `journey.step4_badge` | 준비 중 | Coming Soon |
| `journey.step5_label` | 1년 후 | After 1 year |
| `journey.step5_title` | IP화 / 제자도 동행 | IP-formation / Discipleship journey |
| `journey.step5_badge` | 준비 중 | Coming Soon |
| `journey.note` | * 가격 및 출시일은 준비 완료 후 안내드립니다. 압박 없이, 정성껏. | * Pricing and launch dates will be announced when ready. No pressure, only care. |

---

# 2️⃣ product.html (결제 페이지)

## 2.1 🌐 Meta 태그

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| PM1 | `<title>` (line 47) | `product.meta_title` | KO | 인생포트폴리오 시작하기 \| 인생포트폴리오 | 첫 3주 실행 설계도 받기 \| 인생포트폴리오 | P2 |
| PM1 | | `product.meta_title` | EN | Get Started \| Life Portfolio | Get My First 3-Week Blueprint \| Life Portfolio | P2 |
| PM2 | meta desc (line 286) | `product.meta_description` | KO | 사명·비전·강점을 76문항으로 발견하고, 이번 주 첫 행동 3가지와 3주 살아내는 루틴을 한 권으로 잇는 인생포트폴리오 결제 페이지입니다. | 방향은 있는데 실행이 안 될 때, 첫 3주 실행 설계도를 ₩9,900에 받습니다. 76문항 15분, 결제 즉시 자동 생성. | P2+P3 |
| PM2 | | `product.meta_description` | EN | Discover your mission, vision, and strengths through 76 questions… | When you have direction but can't start — get your First 3-Week Blueprint for $8.99. 76 questions / 15 min, auto-generated on payment. | P2+P3 |

---

## 2.2 🎯 Product Hero / Purchase 영역

| # | 위치(line) | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| P1 | 1198 brand_strong | `product.brand_strong` | KO/EN | 인생포트폴리오 / Life Portfolio | **(유지)** | ✅ 브랜드명 |
| P2 | 1199 brand_sub | `product.brand_sub` | KO | 발견·살아냄·양식 — Only One Report로 잇는 첫 시작 | **(유지)** | ✅ D2와 정렬 |
| P3 | 1221 hero_eyebrow | `product.hero_eyebrow` | KO | 발견 · 살아냄 · 양식 · Only One Report · 15~20분 | **(유지)** | ✅ |
| P4 | 1229 hero_desc | `product.hero_desc` | KO | 단순히 "나는 어떤 사람인가"를 알려주는 데서 끝나지 않습니다. 왜 계속 흔들리는지, 왜 실행이 안 되는지, 무엇을 기준으로 살아야 하는지를 구조적으로 정리하고, 이번 주에 무엇부터 시작해야 하는지까지 연결합니다. | **방황은 정보 부족이 아닙니다.** 당신만의 실행 OS가 아직 없을 뿐. 76문항 15분으로 당신만의 실행 구조를 정리하고, 이번 주 첫 행동 3가지가 손에 잡히게 만듭니다. | P2+P3 (A. MaaS) |
| P4 | | `product.hero_desc` | EN | It doesn't stop at telling you "who you are." … | **Drifting isn't a lack of information.** It's a missing execution OS of your own. In 76 questions / 15 minutes, your own execution structure is clarified — and 3 first actions for this week land in your hands. | P2+P3 |
| P5 | 1269 purchase_title | `product.purchase_title` | KO | 인생포트폴리오 시작하기 | 첫 3주 실행 설계도 받기 | **P2 (O. 컨설팅)** |
| P5 | | `product.purchase_title` | EN | Get started with Life Portfolio | Get My First 3-Week Blueprint | **P2** |
| P6 | 1270 purchase_sub | `product.purchase_sub` | KO | 76문항 기반 맞춤 진단으로 사명·비전·강점을 한 줄로 정리하고, 이번 주 첫 행동과 3주 살아내는 루틴까지 한 권에 담아드립니다. | **리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다.** 76문항 15분, 결제 즉시 한 권으로 도착합니다. | **D2 카피** |
| P6 | | `product.purchase_sub` | EN | A 76-question personalized diagnostic that distills your mission, vision, and strengths… | **Live by the report — your life becomes an asset; that asset becomes food for someone else.** 76 questions / 15 min, delivered as one volume on payment. | **D2 카피** |

---

## 2.3 💎 What You Get (무엇을 받는가) — line 1368~

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| W1 | 1370 what_desc | `product.what_desc` | KO | 많은 사람은 자기이해에서 멈춥니다. 인생포트폴리오는 자기이해를 넘어서, 발견된 사명을 살아낼 수 있도록 결과를 한 권의 양식(Only One Report)으로 구조화합니다. | **(유지)** | ✅ |
| W2 | 1379~1395 카드 4개 | `product.what_card{1-4}_*` | KO/EN | (4개 카드: 핵심 한 줄 / 강점·성장 / 첫 행동 / 3주 루틴) | **(유지)** | ✅ 이미 정확 |

---

## 2.4 🚫 Why This Product (왜 이 상품인가) — line 1404~

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| Y1 | 1413 compare_bad_title | `product.compare_bad_title` | KO | 보통의 검사 | **(유지)** | ✅ |
| Y2 | 1423 compare_good_title | `product.compare_good_title` | KO | 인생포트폴리오 | **(유지)** | ✅ |

> ✅ **비교표 영역은 이미 JTBD 톤이 정확.** 변경 없음.

---

## 2.5 👤 For Whom (이런 분께 추천) — line 1473~

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| R1 | 1483 for_card1_title | `product.for_card1_title` | KO | 합리적으로 시작하고 싶은 분 | **(유지)** | ✅ |
| R2 | 1488 for_card2_title | `product.for_card2_title` | KO | 계속 같은 문제를 반복하고 싶지 않은 분 | **(유지)** | ✅ |
| R3 | 1493 for_card3_title | `product.for_card3_title` | KO | 이해를 실제 행동으로 옮기고 싶은 분 | **(유지)** | ✅ |

---

## 2.6 ❓ FAQ — line 1503~

| # | 위치 | i18n 키 | 언어 | Before | After | 근거 |
|---|---|---|---|---|---|---|
| Q1 | 1504 faq_title | `product.faq_title` | KO | 구매 전 가장 많이 묻는 질문 | **(유지)** | ✅ |
| Q2 | 1511 faq_a1 | `product.faq_a1` | KO | A. 76문항 검사 진행은 평균 15~20분 정도 소요됩니다. | **(유지)** | ✅ |
| Q3 | 1515 faq_a2 | `product.faq_a2` | KO | A. 핵심 한 줄 정의, 강점 TOP3, 이번 주 첫 행동 3가지(if-then), 3주 살아내는 루틴이 한 권의 Only One Report로 제공됩니다. | **(유지)** | ✅ |

> ✅ **FAQ 영역은 사실 기반·정직 톤으로 이미 잘 작성됨.** 변경 없음.

---

# 3️⃣ 공통 키 (Cross-Page Impact)

`common.cta_start` 변경(N1)은 다음 페이지에 자동 적용됩니다:

| 파일 | 사용 위치 |
|---|---|
| `index.html` | 상단 nav CTA |
| `product.html` | (참조 시 적용) |
| `signup.html` | (참조 시 적용) |
| `login.html` | (참조 시 적용) |
| `mypage.html` | (참조 시 적용) |
| `report.html` / `program.html` 등 | (참조 시 적용) |

→ 한 번 변경으로 6+ 페이지 동시 일관성 확보.

---

# 📊 변경 요약 통계 (v2)

| 항목 | 수량 |
|---|---|
| **변경 제안 (Change)** | **22건** (기존 17 + 가격 정책 PR1·PR2·PR4 = 5건 추가) |
| **유지 제안 (Keep)** | 18건 (이미 JTBD/D2와 정렬된 카피) |
| **신규 추가 (New — Journey 섹션)** | 19개 키 |
| **삭제 (Delete)** | 2개 키 (`hero.price_strike` KO/EN — 빈 문자열로 처리) |
| **DOM 변경** | 1건 (`<span class="price-strike">` 요소 제거 또는 hide) |
| **영향 받는 페이지** | 2 (직접) + 6 (공용 키 경유) |
| **영향 받는 i18n 키 총 개수** | 44 (KO 22 + EN 22) — 1:1 페어 |

---

# ✅ v2 확정 사항 요약 (사용자 답변 반영 완료)

| 질문 | 사용자 결정 | 매핑표 반영 |
|---|---|---|
| ① Hero H1 헤드라인 톤 | (a) 그대로 OK | H2 행 변경 없이 채택 |
| ② D2 카피 게재 위치 | **4곳 모두** | H3 + M3/M4 + F1/F2 + P6 모두 반영 |
| ③ "당신의 여정" 섹션 위치 | (a) Final CTA 직전 | 1.7 섹션에 명시 (구매 결심 직전 신뢰 형성) |
| ④ JTBD 단어 | (a) "첫 3주 실행 설계도" | N1, H5, F3, P5, PM1, PM2 등 모든 곳에 통일 |
| 가격 정책 | **거짓 할인 표시 제거** | 1.3 섹션 신설 (PR1·PR2·PR4) |

---

# 🛡️ 윤리 가드레일 자체 검증 (v2 — 통과 확정)

- ✅ "방황" 단어 = 사용자가 자가진단 item에서 이미 인정한 상태 미러링 (수치심 공격 아님)
- ✅ "리포트만 사면 부자 됩니다" 류 부의 복음 변질 없음 — "자산" = *살아낸 삶 자체*
- ✅ 거짓 희소성("3명 남음" 류) 없음
- ✅ **거짓 할인 표시 제거 완료** — 정가 19,900원 실제 미적용 사실 확인, 표기 삭제 결정 (1.3 섹션)
- ✅ 강제·기만·다크 패턴 없음
- ✅ 미성년자 표적·취약계층 표적 마케팅 없음
- ✅ 타 종교·신념 비하 없음

---

# 🔒 안정성·보안 가드레일 (PR #78 작업 시 준수)

이 매핑표를 PR #78에서 구현할 때 다음 원칙을 반드시 지킵니다:

| 영역 | 원칙 |
|---|---|
| 결제 흐름 | ❌ PayPal/카드/Firebase Functions 무변경 — 카피만 변경 |
| 인증 흐름 | ❌ 로그인/회원가입/세션 무변경 |
| i18n SSOT | ❌ `?lang=en` URL SSOT, `_withLang()`, `nav-lang-guard.js` 무변경 |
| RTDB/Firestore rules | ❌ 무변경 |
| 기존 결제 완료자 | ❌ 마이페이지/리포트 접근 무영향 |
| i18n JSON 구조 | ✅ 기존 키 보존(삭제 대신 빈 문자열), 신규 키만 추가 |
| 검증 의무 | ✅ JSON 파싱·JS 구문·HTML 균형 모두 통과 후 커밋 |

---

> **다음 단계**: 매핑표 v2 확정 완료. 이어서 산출물 B (법률 벤치마킹 + 체크리스트 + 처리방침/약관 개정 초안) 작성으로 진행합니다. PR #77/#78 코드 작업은 모든 산출물 검토 완료 후 착수합니다.
