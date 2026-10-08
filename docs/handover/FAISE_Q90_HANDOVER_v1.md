# 파이스 · 인생포트폴리오 종합 인수인계서 v1.0

업무 ID: FAISE-20260908-Q90-01

문서 성격: 내부 경영·개발·평가 인수인계. 고객 공개용 성능표나 인증서가 아니다.

작성 기준: 이번 인수인계 요청 시 확인한 로컬 파일과 GenTeam 메시지 4535406까지. 최종 실행·검수 메시지의 서버 기록은 2026-09-21이다. 과거 문서의 작성일·가격·완료 주장을 현재 실측으로 바꾸지 않는다.

## 0. 다음 담당자가 먼저 읽을 한 페이지

### 현재 결론

- 대표의 중지 지시 4535367이 유효하다. 이번 요청은 인수인계서 작성 승인이지 평가·개발 재개 승인이 아니다.
- **G13은 완료됐다.** 최종 baseline validation-only 1회 성공 보고 4535344, Method 독립 수락 4535390, Peer 독립 수락 4535406이 도착했다. 진행 대장에 반영했다.
- **고정 완료조건 12/20 = 60%. ALT 총점 null. 90점 달성 미판정.** 60%는 품질 점수·남은 시간·성공 확률이 아니다.
- 다음 작업은 **G07·G14 기존판·개선판의 실제 7축 평가**다. G13의 환경 복원·진단·최종 검증을 이유 없이 다시 하지 않는다.
- 명시 재개 및 생성 승인 후에만 동결 두 버전 결과 생성 → 봉인 → 실제 출력 해시·블라인드 배정·stage2 승인 잠금 → 지정 두 판정자 각 2회 평가를 진행한다.
- 실제 스택은 Static HTML/JavaScript + Firebase RTDB + Cloud Functions + Firebase Hosting이다. Hono/Cloudflare 템플릿으로 덮어쓰거나 이전하지 않는다.
- 고객 데이터·결제권·저장 결과·고유코드·리포트/프로그램/PDF 참조는 보존한다. 이번 작업에서 운영 배포는 하지 않았다.
- 별도 고객 리포트 표시 수정 3파일은 미커밋·미검증 후보로 남아 있다. b03/e910 동결 평가에 섞지 않는다.
- executor의 새 환경과 로컬 압축본은 존재 보고가 있으나 **원격 영속 백업·완전 복구는 미확인**이다. 이 문서와 첨부 ZIP은 서비스나 private 실행환경 전체 백업이 아니다.

### 다음 담당자의 최초 행동

1. 본 0장과 5~7장의 동결값·실행 순서만 먼저 읽는다.
2. `.git/q90-control/progress.json`의 `latest_handoff`, 메타 `q90_pause_directive`를 확인한다. 오래된 `control.json.latest_resume32`는 최신 상태로 사용하지 않는다.
3. GenTeam TL 스레드에서 **4535406 이후 새 메시지만** 읽는다. 새 결과가 없다면 전체 이력을 다시 읽지 않는다.
4. 대표가 아직 재개를 승인하지 않았다면 실행하지 않는다. 문서 열람만으로 동결 입력·private 본문을 LLM에 가져오지 않는다.
5. 재개 승인 시 현재 잔액과 실행환경 접근 가능 여부만 확인한다. 필요한 것은 현재 실물의 가벼운 동일성 확인이지 전체 복원이 아니다.
6. 지정 executor TL에게 기존 G07/G14 생성·봉인 계약의 정확 범위로 한 번에 발주한다. 두 judge/adjudicator의 실제 배정은 기존 roles 원본에서 확인하며 담당자를 추측하지 않는다.
7. 결과가 나오기 전에는 공개 성능표·우위 주장·대규모 제품확장을 시작하지 않는다.

### 후임에게 그대로 전달할 시작 지시문

> 당신은 파이스 인생포트폴리오의 경영·개발 총괄이다. 이 인수인계서를 우선 기준으로 사용한다. G13은 4535390/4535406으로 수락되어 12/20=60%이며 ALT 점수는 없다. 중지4535367을 유지하고 대표의 명시 재개 전에는 실행하지 않는다. 재개되면 전체 이력 재독 없이 G07/G14의 기존 계약상 생성·봉인·블라인드 평가부터 진행한다. b03/e910·원입력·7축·역할 분리를 바꾸지 않는다. Firebase 운영과 평가환경을 구분하고 고객 자산을 보존한다. 미검증 표시 수정은 별도 후보이며 동결평가에 섞지 않는다. 작은 ACK·보고서·준비 반복 대신 실제 완료조건과 증거로 관리한다.

## 1. 문서의 권한·최신성·읽는 방법

### 사실의 수준

- **직접 확인:** 총괄이 이번 대화에서 읽은 로컬 파일, 도구로 받은 메시지, 실행한 빌드/검사 결과.
- **독립 검수:** Peer/Method가 정확 공개 결과·소스·계약을 확인했다고 명시한 수락. 총괄의 직접 재실행과 혼동하지 않는다.
- **실행자 보고:** private 파일·snapshot·namespace·실제 실행상태. 허용된 공개 metadata로만 전달됐다.
- **역사적 기록:** 이전 문서의 가격·사업가설·기능 완료·테스트 기록. 현재 운영 실측이 아니다.
- **미확인:** 현재 매출·활성 고객 수·환불률·운영 secret/IAM/provider 상태·실제 서비스 청구액·영속 백업 등. 아는 것처럼 쓰지 않는다.

### 충돌 처리

현재 대표 지시·수정금지 범위 → 현재 유효한 고정 평가계약/승인 → 최신 수락 증거와 진행 대장 → 현재 코드/빌드 → 역사적 사업 문서 순서로 대조한다. 이 문서도 새 증거와 대표 지시보다 우선하지 않는다. 문서의 제목이 '최종본'이라는 이유로 낡은 수치까지 현재로 적용하지 않는다.

읽기 예산을 아껴라. 운영 재개는 0장·5~7장으로 충분하다. 사업 의사결정 시 2~4장, 코드 수정 시 8~10장, 장애 발생 시 11~13장을 해당 부분만 읽는다.

## 2. 인생포트폴리오 비즈니스의 전체 지도

### 2.1 정체성과 사명

- 사업자: **파이스**. 서비스: **인생포트폴리오 / LifePortfolio**. 문서상 대표·설립자: 김영식.
- 사명: **발견 → 살아냄 → 남김**, 이를 인생 자산화로 연결한다.
- 사람을 유형이나 직업 하나로 단정하는 도구가 아니라, 자기 답변에서 의미·강점·방향을 발견하고 행동·기록으로 이어가도록 돕는 서비스다.
- 여기서 자산화는 삶의 경험·실천·결과물을 축적하고 다른 사람의 유익으로 연결한다는 뜻이다. 금융 수익·자산가치 상승·취업을 보장하는 말이 아니다.
- 규칙 기반 합성 엔진이 진단 리포트와 실행프로그램을 만든다. 평가에 AI를 사용하는 것과 제품 엔진이 LLM이라는 주장은 다르다.
- 'Only One'은 고유성을 살리려는 제품 지향이다. 전 인류의 코드 충돌 없음·100% 정확성·인간 타당도 확보를 뜻하지 않는다.

### 2.2 제품과 고객 여정

| 단계 | 고객에게 주려는 것 | 서비스/산출물 | 운영 판단 시 주의 |
|---|---|---|---|
| 발견 | 내 답변에서 사명·강점·방향 이해 | 진단, 리포트, PDF | 임상 진단이나 고정된 인격 판정 아님 |
| 살아낼 설계 | 그래서 무엇을 할지 | 맞춤 실행프로그램, 첫 3주 계획 | 리포트와 동일 원천·톤·행동 흐름 연결 |
| 살아냄 | 실제 실행 지속 | 코칭, 점검, 다이어리 | 실제 제공 가능한 운영량·상품 상태 확인 |
| 남김 | 한 경험을 다음 행동의 근거로 | 기록, 다음 3주의 지도 | 기록 차이를 성장 증명으로 단정하지 않음 |
| 연결·자산화 | 경험을 타인의 유익과 연결 | 방향별 커뮤니티, 동행 등 확장 | Q90 품질 검증 후 확장; 로드맵을 출시 사실로 쓰지 않음 |

웹 경로는 홈 → 상품/결제 → 인증·검사 → 저장 리포트 → 실행프로그램·PDF → 마이페이지·점검/후속 상품으로 이해한다. 정확한 권한·리다이렉트·결제 순서는 해당 코드와 현재 운영 설정으로 확인한다.

### 2.3 고객·시장·채널

2026-05-26 사업모델 문서는 이직·번아웃·전환기에 있는 30대 직장인을 핵심 고객으로 두고, 블로그 SEO·유튜브·카카오 채널·오프라인·입소문 중심의 집중 전략을 기록했다. 20대 구직자·40대 관리자·조직/그룹은 보조 영역으로 정리돼 있다.

이는 **역사적 전략 선택**이다. 문서의 '시장 40%'·전환율·CAC·LTV·매출 목표는 현재 실증으로 재사용하지 않는다. B2B 페이지와 구매 흐름도 존재하므로 30대 개인 전략만으로 기업 사업을 삭제하지 않는다. 최신 대표 승인 없이 유료 광고 확대·신규 채널·상품 재배치를 실행하지 않는다.

고객 약속은 기능 나열보다 '무엇을 얻고, 오늘 무엇을 하고, 무엇이 남는지'로 설명한다. 고객의 현재 삶을 깎아내리는 부재·열등 프레임, 경쟁자를 비방하는 카피, 근거 없는 1위·정확도 주장을 피한다.

### 2.4 가격·수익 구조: 현재로 단정하지 않을 것

| 출처 | 기록된 내용 | 인수자의 적용 방식 |
|---|---|---|
| README의 2026-06-26 정상화 기록 | 개인 19,900원 / $14.99, B2B 18,000~10,000원, 21일 패키지 39,900원 | 현재 계약·UI·서버 금액 일치 확인 전 '라이브 검증 가격'이라고 하지 않음 |
| 5월 사업모델/제작규칙서 일부 | 진단 9,900원, 다이어리 49,000원, 3개월 코칭 149,000원 등 | 과거 가격/계획; 최신 판매가나 제공 가능 상품으로 복원 금지 |
| README 내부의 과거 카피 기록 | B2B 9,000원부터 등 이전 값도 혼재 | 같은 문서 내부에서도 시점별 기록 분리 |
| 사업모델 LTV·마진·월매출·확장 기준 | 가설과 목표 | 실매출·효과·현 재무건전성으로 주장 금지 |

새 가격을 결정하는 작업은 현재 Q90에 포함하지 않는다. 가격 변경이 필요해지면 상품 HTML·KO/EN·Functions 금액·결제 provider 설정·영수증/환불 문구를 함께 검토해야 한다. 문자열 전체 치환으로 9,900을 119,900으로 만드는 과거 오류를 반복하지 않는다.

### 2.5 21일 점검·코칭·다이어리

`docs/checkin21-value-definition.md`는 21일 점검을 단순 점수표가 아니라 사람이 고객 기록을 읽고 앞으로 살아갈 **'다음 3주의 지도' 한 장**을 건네는 서비스로 정의한다. 고객 고유 응답을 읽은 코치의 기여, 다음 행동 중심 결과, 강매 아닌 후속 초대가 핵심이다.

다이어리·코칭·커뮤니티는 사업 전체 지도에서 중요하지만 제작 완료·출시·운영 여력을 확인하지 않고 약속하지 않는다. 이 문서 작성에서 상품별 라이브 판매/이행 상태를 재검증하지 않았다. '코칭은 사람이 한다'와 규칙 기반 대화 위젯·보조 자동화의 존재를 구분한다. 24시간 상담·무제한 세션·자동 AI 전문코칭을 약속하지 않는다.

### 2.6 신앙 기반 철학과 고객·평가 표현의 경계

제작규칙서는 성경적 청지기·발견·실천·타인의 유익을 내적 설계 기반으로 설명한다. 이 철학을 숙지하되 진단 점수를 하나님의 뜻·구원·영적 성숙·신앙의 우열로 해석하지 않는다. 성경 인용을 자사 제품 효과의 실증 근거로 바꾸거나 세속적 성공 보장으로 사용하지 않는다.

일반 고객 리포트의 쉬운 표현, 원분야 노출 제한, 코칭 지식의 층위는 각 제품 규칙을 따른다. 철학 보존과 민감한 정보의 무분별한 공개는 별개다. Q90-ALT 점수는 영적 평가도 기관 인증도 아니다.

### 2.7 경영 총괄이 함께 알아야 할 영역

| 영역 | 핵심 판단 | 현재 확인 범위 / 추가 확인할 때의 출처 |
|---|---|---|
| 전략·제품 | 실천·기록까지 이어지는 실제 가치 | 제작규칙서, 사업모델, 현재 대표 지시 |
| 영업·마케팅 | 검증된 약속만, 전체 비교군 공정성 | promise-and-limits, G17~G20, marketing/SEO 문서 |
| 고객지원·코칭 | 제공 가능 범위·개인정보·책임 | 약속과 한계, 21일 가치 정의, 현재 약관 |
| 결제·권리 | 결제 멱등성·권리 보존·환불 신선도 | Functions, RTDB rules, provider 실제 상태는 미확인 |
| 개인정보·법률 | 수집 목적·최소 공개·보유·동의·광고 | privacy/terms, legal 문서; 법률 검수 미완을 숨기지 않음 |
| 분석·측정 | 유입→결제→리포트 사용, 동의와 민감정보 차단 | analytics.js, README, UTM/Looker/Clarity 기록 |
| 보안·배포 | 운영과 평가 격리, 변경 승인, 복구 | firebase.json, rules, SECURITY, G10~G12 수락 기록 |
| 재무·조직 | 귀속 가능한 비용, 실제 운영능력 | 최신 장부·계약은 이번 확인 범위 밖 |
| 지식·협업 | SSOT, 역할분리, 최신 인계, 낭비 억제 | 협업 매뉴얼 v0.1, 본 문서, 비공개 진행 대장 |

'비즈니스 전반 숙지'란 모든 현재 수치를 안다는 뜻이 아니라, 위 영역의 관계·원칙·실제 근거·미확인 영역을 구분하고 필요한 때 정확한 담당 자료로 연결하는 것이다.

## 3. 제품을 바꿀 때의 불변 원칙

1. **고유성 종합 × 직관적 단일표현:** 헤드라인은 쉽게 하나로, 디테일은 응답 조합의 고유성을 살린다. 긴 항목 나열을 개인화로 포장하지 않는다.
2. **축적·비파괴:** 기존 결과·고유코드·PDF·권리와 폴백을 보존한다. 최신 엔진으로 조용히 재계산해 저장본을 덮지 않는다.
3. **융합 표현:** 원응답은 보존하고 사람 말로 의미를 합성한다. 표시층 순화가 원자료 삭제로 이어지면 안 된다.
4. **긍정형 정체성 카피:** 발견→살아냄→남김을 연결하되, 무조건적인 삶의 변화·취업·의료 효과를 약속하지 않는다.
5. **데이터와 표현 분리:** 고객에게 필요한 근거·한계·행동은 남기고, 운영 실험/버전/실행오류는 적절한 운영 경계로 분리한다. CSS 숨김·noindex는 접근통제가 아니다.
6. **언어·화면·PDF 일치:** KO/EN fallback, 실제 Living Book, 소장판, legacy/manual override, 모바일·인쇄를 함께 확인한다.
7. **고정 평가 보호:** 새 제품 후보는 새 버전으로 관리한다. 동결 b03/e910을 몰래 교체하거나 점수 결과를 보고 입력·기준을 조정하지 않는다.
8. **원문에 적힌 절대 표현도 검증:** '같은 응답이면 언제나 같다'는 버전·clock·설정·수동수정 조건을 고려해야 한다. 코드 차이 자체는 삶의 성장 증명이 아니다.

## 4. Q90의 목표·진행 상태·남은 작업

### 목표와 범위

실제 진단·리포트 품질 개선 → 승인된 7축 공정 평가 → 독립 검수 → 90점 이상과 필수조건 → 검증된 고객 웹사이트·공개 성능표·고객 마케팅·기업 영업자료. 대규모 자산화 확장은 이후다.

현재 트랙은 **Q90-ALT-v1: AI / 합성 사례 / 기술 검증 기반 대체 평가**다. 인간 모집·동의·실증 타당도는 후속 단계이며 현재 G13에 새 선행조건으로 넣지 않는다. 과거 78점은 5축 점수이므로 7축과 단순 증감 비교 금지.

| 축 | 항목 | 배점 | 고객 관점 질문 |
|---|---|---:|---|
| A1 | 첫인상 직관성 | 15 | 처음 봐도 무엇을 해주는지 알 수 있는가 |
| A2 | 자기인식 정확도·공감 | 15 | 나를 이해하는 데 도움이 되는가 |
| A3 | 바로 실행가능성 | 15 | 읽고 무엇을 할지 알 수 있는가 |
| A4 | 자산화·축적 연결성 | 15 | 발견을 실천·기록으로 쌓을 수 있는가 |
| A5 | 전문성·신뢰감 | 15 | 설명과 근거를 믿을 수 있는가 |
| A6 | 홈페이지 이용 편의성·시각품질 | 15 | 사용하기 쉽고 이해하기 편한가 |
| A7 | 보안 취약성 | 10 | 정보·권한이 안전하게 보호되는가 |

### 고정 20개 완료조건의 현황

완료: G01 G02 G03 G04 G05 G06 G08 G09 G10 G11 G12 **G13**.

미완료: G07 G14 G15 G16 G17 G18 G19 G20.

G01~G06: 기준·출처·절차·비교명 대응·오프라인 재현성 기반. G08: 전체 비교대상 선정 및 검증불가 사유 검수. G09~G12: 우선 결함·보존 계약·제품/회귀 관련 기존 수락. 각 항목의 정확 범위와 한계는 progress.json의 criterion/limit/evidence를 따른다. 과거 수락을 현재 라이브 전체 안전성 인증으로 확대하지 않는다.

| 순서 | 남은 작업 | 완료 인정 기준 |
|---|---|---|
| 1 · G07 | 기존판 실제 7축 평가 | 축별 점수·직접기술/AI판단/미측정 원증거 검수 |
| 2 · G14 | 개선판 평가·전후 비교 | 같은 조건·같은 근거 수준으로 차이 설명, 기존판 결과 재사용 |
| 3 · G15 | 독립 검수 | 계산·반복·반례·선택편향·보안 검수 |
| 4 · G16 | 90점·필수조건 판정 | 총점90 이상 + 필수조건 + 판정 승인; 미달 시 개선·동일기준 재평가 |
| 5 · G17 | 공개 성능표 | 점수·방법·한계·근거 일치 |
| 6 · G18 | 전체 비교대상 정합 | 누락 없이 동일 접근 수준, 미측정·접근차이 명시 |
| 7 · G19 | 권리·개인정보·표현 검수 | 출처·사용권·개인정보·광고 표현 검수 |
| 8 · G20 | 최종 고객·기업 자료 | 검증결과와 일치하는 자료 및 후속 운영 절차 인도 |

비교명 원문은 47/47 대응, 49 비중복행+2 교차참조의 역사적 수락이 있다. 일부 대상 미특정·측정 불가를 임의 삭제하지 않는다. 현행 SKU·유료 접근·전수 점수가 모두 검증됐다는 뜻이 아니다. 기존 comparison-register와 G08 수락 자료를 재사용한다.

## 5. 동결 자료와 무결성 기준

아래 값은 식별·검증용이며 비밀키가 아니다. 문자열 일부가 같은 것으로 동일 파일을 추정하지 말고 전체 값을 사용한다.

| 대상 | 정확 고정값 |
|---|---|
| baseline commit | b03e21901e0c1449a14ce092d0c4676d7ccf5401 |
| candidate commit | e910680387ffb2badea7c877b94bc5987c440238 |
| 원14b 실행기 SHA256 | 14bfe0a143cefa49d9449d4fe42a67dfca4c2e1eab02e54c6aaf820bf70f9741 |
| input rev2 SHA256 | dad447048e5aaaadc15faa7b561bdff0f07c62b9c105a21d90fc5859435e2958 |
| 원 census SHA256 | e35f8b32aed5d227165d43517fd4dda58f75f11e39b6d16d134c8044e66025d6 |
| contract SHA256 | c25fff3a6414ec958016019e1168b95d90a74618dbcfdc88354efd4401ac7279 |
| supplement SHA256 | 84e35a4e9d71aad202081fbeed80a7364c90c6080e7663e4782a5190ac54c98f |
| scorer SHA256 | aa64b1d33389ad6d8ef707a9c4905287a8a00c81001ef6a153849ffdd35be3a1 |
| baseline 전체20키 manifest object hash | f7239bff7df182cd06a5d80f24e7d9cd248f0172ab02dc338e56af975bca9fc5 |
| candidate 전체20키 manifest object hash | c67af69bdfe11c1d554614edcf7bc98f4f3036c0f58aa6b166b4c6fc5160caa8 |

최종 합성사례: **12 valid + 3 negative**. 역할: author, executor, reviewer, judge1, judge2, adjudicator. 두 버전 동일 input/clock/profile/dependency policy, `previous_artifacts='none'`, 실행별 fresh process/snapshot/sink. 봉인·블라인드 잠금 전 judge 열람 금지. 반복수는 **2판정자 × 각2회** 계약을 따른다. 기존 roles의 실제 배정값을 이 문서가 임의 대체하지 않는다.

### 파일 SHA와 객체 digest의 차이

원 파일 SHA256과 JS canonical object digest는 다르다. 다음 방식의 재귀 키 정렬과 JSON 직렬화를 지켜야 한다.

```javascript
const canonical = x => JSON.stringify(x, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    : v
);
const digest = x => hash(canonical(x));
```

정확 승인 11필드:

```text
status
contract_sha256
supplement_sha256
scorer_sha256
pre_manifest_sha256
input_rev2_sha256
release_sha
frozen_at
roles_sha256
execution_plan_sha256
owner_approval_ref
```

`ready=false`, null 승인 필드, `preregistration=null`은 준비완료가 아니다. 실제 승인ref·서버 UTC시각 → 계획 → 계획 object hash → 11필드 → 외부 digest → package/launch/snapshot/binding 순서로 연결한다. 자기 해시 포함으로 순환을 만들지 않는다. 1초 다른 승인시각도 임의 정당화하지 않는다. 원14b UTC 검사와 정확히 같은 밀리초3자리·재직렬화 조건을 사용한다.

## 6. G13 종결의 정확한 근거

### 6.1 최종 체인

| 단계 | 참조 | 사실 |
|---|---|---|
| 최종 실행 조건부 승인 | 4535150 / 2026-09-21 19:31:25 UTC | 기존판 최종 validation-only 1회; 생성·평가·배포는 미포함 |
| 정확 전환 묶음 | 4535234:0 | 6,394bytes, 비관측 후보·원본보존·예약·명령 코드 |
| Peer 실행 전 수락 | 4535300 | 정확 소스·공간·결박·반례 검수 |
| Method 실행 전 수락 | 4535327 | 정확 승인값·11필드·명령 연결 수락 |
| 최종 실제 실행 | 4535344:0 | 결과849bytes, 외부/내부/수집기 exit0, 정상 종료 |
| 사용자 후속 중지 | 4535367 | 기착수 결과검수만 마감; 후속 전부 보류 |
| Method G13 종결 | 4535390 | 기존 5항목 준비조건을 기존 수락+최종 실행으로 수락 |
| Peer G13 종결 | 4535406 | 동일 결론, 공개 결과바이트 직접 확인 |

최종 결과 표시: `YES_FINAL_ADAPTER_SUCCESS`, adapter `validate_only`, `generation_authorized=false`, `inner_exit=0`.

```text
결과 SHA256:
6013b463712114d4d807c6aa7090d380d20a18d8c9f9b301fba86978d0dc6984
새 binding SHA256:
751f4864d857a2b37f3bb492f42fc4e26941458a9c2ec976e87e56a65678635f
최종 계획 SHA256:
f83af8fa5c7bcdacb78eab648ae2c8b7c902ffbe7ce9d82c46a053ccc523fe54
외부 승인 객체 digest:
9943714ed7795f064a44efc38445afb18c45504d1c63992ad8b7277b59fb4f52
전환 archive SHA256:
1d19a0a8f9032452fa1d92bc0e228fa842920695e650d767a383cc1df396a8df
전환 manifest SHA256:
59853b0e1050f2bdc2ecff2965ec55470ad3a74c53e47d082fddc3bcba14f896
전환 code SHA256:
688263753a90454e7a7645234b7a9ec3a2a2b629c4d87676c134fa3cd9f9be37
```

최종 adapter/entry는 `bcc95952… / 4254aad9…`로 보고된 비관측 후보다. 이 문서에 전체 SHA가 없는 값은 **정확 manifest 원본에서 확인**한다. 임의로 뒤를 채우지 않는다. 관측 파생 `af1b86… / 1385a8…`를 최종 대상으로 혼동하지 않는다.

### 6.2 수락의 한계

- 원14b `--validate`는 승인·연결 검사다. `engine_executions=0` 경로이며 제품 생성이나 7축 점수는 없다.
- 현재 성공은 새 환경의 결과다. 과거 adapter144 실패의 원인이 규명됐다고 말하지 않는다.
- 공개 결과849bytes의 SHA 직접 검수는 Peer/Method가 수행했다. 총괄은 수신된 독립 판정과 실행 체인을 대조했다. 총괄 로컬 다운로드는 CLI 옵션 오류로 완료되지 않았으므로 직접 바이트 검증했다고 주장하지 않는다.
- 실행 후 private 파일·snapshot·식별정보 일치는 executor 보고다. Peer/Method가 원자료 본문을 열람한 것으로 표시하지 않는다.
- candidate를 동시에 물리 설치하거나 미래 출력 해시를 미리 제출하거나 인간을 모집해야 한다는 새 G13 조건은 없다.
- 전체 G13 수락 이후에도 환경이 실제로 달라지면 새 실물의 경량 동일성·필요한 결박을 확인한다. 역사적 성공을 새 inode/runtime 증거로 복사하지 않는다.

## 7. 재개 후 G07·G14 실행 절차

현재는 중지 상태다. 아래는 **재개 시 실행할 순서**이며 지금의 실행 권한이 아니다.

1. 대표 명시 재개 확인. 잔액을 1회 조회하고 유한한 운영예산·경고선·최종 관측하한을 고정한다. 이전 예산을 자동 초기화하지 않는다.
2. TL의 현재 sandbox에 원입력·동결 source·최종 검수물·private 저장영역이 접근 가능한지 확인한다. 접근 불가이면 없어진 것으로 단정하지 않고 보존/복원 경로만 확인한다.
3. 기존 계약·roles·두 release·12+3 사례·동일 설정을 유지한다. 생성은 별도 승인으로 정확 command·대상·횟수·sink·출력보존·자원 범위를 결박한다. `--validate` 승인을 생성 승인으로 재사용하지 않는다.
4. 지정 executor TL만 원자료를 기계 처리한다. release별 fresh process·별도 계획·독립 저장위치로 지정 결과와 필수 negative 증거를 생성한다. 필요 시 순차 전환; 두 환경 동시 설치를 강요하지 않는다.
5. 두 결과를 봉인한 뒤 **실제 출력 hash**를 산출한다. 블라인드 배정·stage2 외부 승인값을 잠근다. 미래 hash를 추측하거나 잠금 전에 judge가 결과를 보게 하지 않는다.
6. 기존 두 judge에게 분리 인계하여 각2회 판정한다. author/executor/reviewer/adjudicator 역할을 임의 병합하지 않는다. 불일치는 별도 조정자와 고정 계약으로 처리한다.
7. 7축 각각 직접기술·AI판단·미측정·비적용의 출처를 구분한다. Node 생성 성공을 브라우저·PDF·UX·보안 전체 증거로 확대하지 않는다. 해당 축에 필요한 기존 증거를 재사용하거나 계약에 맞게 별도 측정한다.
8. 기존판 점수를 확정하고 재사용하여 개선판과 공정 비교한다. 부족항목은 숨기지 않는다.
9. G15 독립 검수 → G16 90+필수조건 판단. 미달이면 **근거가 보여주는 부족항목**부터 실제 개선하고 동일 기준으로 재평가한다. 별도 표시 후보도 이때 검토할 수 있으나 새 version 동결이 먼저다.
10. 판정 이후 G17~G20으로 연결한다. 공개 문구는 ALT의 범위·한계·평가대상을 명시한다.

중지조건: 대표 중지, 승인 경계 미충족, 보존/보안 위반 위험, 한도 도달, 원인·수정 근거 없는 반복 실패. 작은 보고서 제출·경고선만으로 자동 중지하지 않는다. 반대로 실행실패를 outer exit0으로 감추지 않는다.

## 8. 실제 코드·배포·데이터 지도

### 8.1 저장소와 환경

- Project ID: `611de316-1341-4330-adf1-78d2c91f546a`
- 총괄 작업경로: `/home/user/webapp/`
- 현재 branch: `main`
- 인수인계 작성 전 HEAD: `a17377afd0fd5c200466b765c7a0d59dc53240d1`
- 해당 커밋: `docs: add outcome-driven agent collaboration manual pilot`
- 그 전 HEAD: `9319d8f1c80eab57b18a9ec0edbbaa331fc73c74`
- 문서상 운영 URL: https://lifeportfolio.co.kr/ — 이번 인계에서 라이브 전체 동작을 재검증하지 않았다.
- TL의 별도 sandbox로 마지막 보고된 ID: `sbx-c2c454585ac2827c29860cd61a082e95`. 총괄의 같은 이름 경로와 동일 환경으로 취급하지 않는다. 현재 연결 가능성은 재개 때 확인한다.
- 문서 커밋과 제품 수정 커밋은 분리한다. 제품 3파일은 미커밋 상태로 보존한다.

### 8.2 주요 파일

| 파일 | 역할 / 변경 시 주의 |
|---|---|
| `index.html` | 홈·가치·고객 여정·CTA |
| `product.html`, `product-v2.html` | 상품·가격·결제 진입 |
| `suvey.html` | 실제 Hosting 허용목록의 검사 페이지. `survey` 오타를 자동 정리하지 말고 라우팅 확인 |
| `report-loading.html`, `report.html` | 리포트 준비·저장본 로딩·실제 화면·PDF |
| `program-loading.html`, `program.html` | 실행프로그램, 리포트와 동일 행동 흐름 |
| `mypage.html`, `login.html`, `signup.html` | 고객 저장자료 진입·인증·언어 |
| `b2b*.html` | 기업 설명·견적·결제·가입·개인정보/약관 |
| `checkin-21*.html` | 21일 점검·폼·채팅 흐름 |
| `privacy.html`, `terms.html` | 고객 고지; 초안 문서와 현재 적용본 구분 |
| `assets/js/report-engine.js` | 레거시 원엔진; 임의 수정 금지 |
| `assets/js/report-engine-v4.js` | 개선 엔진·합성·고유코드 |
| `assets/js/program-engine.js`, `career-engine.js` | 실행프로그램·진로 연결 |
| `data/questions.json`, `mapping.json` | 문항·매핑 |
| `data/report-rules.json`, `program-rules.json`, `career-rules.json` | 각 엔진 규칙 |
| `assets/i18n/ko.json`, `en.json` | 언어 사전; HTML fallback과 함께 수정 |
| `assets/js/chat-core.js`, `ask-widget.js` | 대화 위젯·규칙 기반 보조 흐름; LLM/코치 역할과 혼동 금지 |
| `functions/index.js` | 결제·메일·권리·관리 기능. 운영 호출 금지 상태 |
| `database.rules.json`, `firestore.rules`, `firebase.json` | 데이터 권한·Hosting 설정 |
| `scripts/hosting-allowlist.mjs`, `build-hosting.mjs` | 추적된 파일 허용목록 기반 공개 빌드 |
| `scripts/build-admin.mjs`, `verify-admin-build.mjs` | 관리자 빌드/검사; 이번 재실행 아님 |

Firebase Hosting은 `dist/hosting`, cleanUrls true, 공개 허용목록 기반이다. docs/ops/functions/scripts/숨김 파일 등을 공개하지 않는 구성이 있다. README의 과거 'Cloudflare _headers' 설명을 현재 배포 지침으로 쓰지 않는다. 실제 헤더는 firebase.json에서 대조하며 CSP와 CSP-Report-Only를 구분한다. 후자의 광범위한 정책은 강제 차단과 같지 않다.

### 8.3 고객 데이터 경계에서 확인된 점

`report.html`은 `_safeGet(reports/{uid}/{sid})`로 payload를 읽는다. `database.rules.json`의 `reports/$uid/.read`는 본인 인증 uid 일치를 조건으로 부모 노드 읽기를 허용한다. 그 아래에 engineVersion, rulesVersion, manualReportStatus, manualOverrideHtml, `_v4ApplyError`, report 등이 공존한다.

따라서 표시용 whitelist에서 필드를 뺐다고 원 응답의 운영정보 전달이 완전히 차단되는 것은 아니다. 부모 읽기 권한을 둔 채 자식 규칙만으로 비공개 분리가 된다고 주장하지 않는다. 필요한 경우 호환성을 보존하는 별도 운영 경로·서버 projection·마이그레이션을 설계해야 하지만 **아직 구현·승인하지 않았다**. 결제권·기존 저장본·수동검토본의 접근을 깨뜨리지 않는 것이 우선이다.

## 9. 미완성 고객 리포트 후보 — 그대로 배포 금지

대표의 '리포트를 직관적으로, 고객정보와 운영정보를 구분' 요구를 받아 별도 표시 수정에 착수했으나, 이후 원래 평가순서 우선 지시에 따라 중지했다. 이 후보는 G07/G14 동결 대상이 아니다.

### 9.1 실제 표시 경로

```text
loadAndRender(user, sid)
  → _safeGet(reports/{uid}/{sid})
  → currentReport = payload.report
  → renderReport(currentReport)           # fallback
  → __renderLivingBook(currentReport)
      → buildBookData(report)
      → buildBookHTML(data, {theme:'screen', embed:true})
      → iframe.srcdoc
PDF/소장판 → buildBookData → buildBookHTML(theme)
```

`body.living-book-on`이면 fallback `#reportRoot`, TOC, 상단 배너·상태 등이 숨겨진다. fallback만 고쳐 실제 화면이 남는 실수를 피한다. 함수명으로 탐색하라. 아래 행번호는 수정 전 대략치이며 고정 좌표가 아니다: loadAndRender 2470대, renderReport 3778, buildBookData 5185, bookRenderScript 6231, buildBookHTML 6924, Living Book 7219 부근.

### 9.2 현재 실제 수정한 내용

| 파일 | 미커밋 수정 |
|---|---|
| `report.html` | load 오류에 raw e.message를 덧붙이지 않음; manual 상태를 고객용 문구로 변경; 손상 단정/재검사 유도 문구 완화; 배너의 고정76문항 제거 |
| `report.html` | buildBookData의 profile/meta engineVersion과 하드코딩 discriminant(38/38,200/200,10^58 등)를 고객 책 데이터에서 제외 |
| `report.html` | readerLang/readerText 추가; 실제 I장 일부 라벨 직관화; IX장 근거·해석·한계, X장 발견→실천→기록 안내로 변경; 목차 제목 조정 |
| `report.html` | window.DATA 직렬화에서 `<`, U+2028/U+2029 escape 추가; 아직 실제 브라우저 보안 검증 아님 |
| `assets/i18n/ko.json`, `en.json` | manual/손상 안내·배너 문구·새 IX/X 목차키 동기화 |

개인화 값·고유코드·답변 근거 표시를 보존하려는 표시계층 수정이다. 서버/RTDB 데이터는 변경하지 않았다. 전체 UI 영문화가 완료된 것은 아니며 기존 다른 장의 한글 하드코딩도 남아 있다.

### 9.3 반드시 알아야 할 미완료

- **실제 화면·소장판·PDF·KO/EN·legacy/manualOverride 회귀검사는 하지 않았다.** build 통과를 렌더 성공으로 해석하지 않는다.
- 큰 inline JS의 문자열 배열을 수정했으므로 출력 JS 구문과 I/IX/X장 DOM, 페이지 잘림·목차·인쇄를 먼저 검증해야 한다. 테스트가 통과하기 전 기능완료라고 쓰지 않는다.
- fallback 첫 요약의 일부 예전 문구, 다른 장의 언어, 문항수 관련 전체 일관성은 미완이다.
- `window._lpReportPayload`, `window._lpReportUser`는 아직 남아 있다. 후기 흐름이 payload.toneKey에 의존하므로 소비처 확인 없이 삭제하지 않는다.
- manualOverride 우선 표시 기능은 유지했다. 수동본 화면과 PDF의 실제 일치 여부는 따로 검증해야 한다.
- RTDB 서버 응답 수준의 운영정보 분리는 미구현이다.
- 표시 후보의 고유성·직관성 개선 효과는 7축 점수로 검증되지 않았다.

### 9.4 보존·복원

패치: `.git/q90-control/paused-customer-display-4535367.patch`

SHA256: `0c5d07c49914bbd153de291233cd50424aeee194b1a4bd8b546e90a4a2da4016`

적용 기준: 문서 작성 전 HEAD `a17377afd0fd5c200466b765c7a0d59dc53240d1`. 현재 작업트리에는 이미 적용돼 있으므로 **중복 apply 금지**. 새 작업공간에서만 정확 base와 파일 해시를 확인하고 `git apply --check`로 사전 검증한다. 파일이 없다고 원본을 추정 재생성하지 않는다.

인수인계 ZIP의 패치는 이 3파일 후보만 복원한다. 전체 repo·고객DB·TL private 환경은 복원하지 않는다.

## 10. 실행했던 검사와 아직 남은 검사

| 명령/검사 | 관측 결과 | 한계 |
|---|---|---|
| `npm run build:hosting` | 성공, 당시265 tracked files | Firebase 공개 빌드; 고객 실제 동작/렌더 검증 아님 |
| `npm run test:hosting` | 허용목록/민감 fixture 스캔, 내부 링크0 broken 통과 | 전체 보안·라이브 검증 아님 |
| `test:hosting:contract` 하위 실행 | deterministic build와 Hosting 검사 통과 | 고정 두 평가버전의 결과 채점 아님 |
| 아이콘 legacy safety | 52 checks, 0 failed | 렌더의 모든 문제 검증 아님 |
| 실행전략 확장 계약 | PASS26 / FAIL0 / PENDING0 | 해당 계약 범위 |
| `npm test` 종합 | **exit1, 실패2개** | 전체 통과로 기록하지 않음 |
| 고객 표시 후보의 브라우저/PDF | 미실행 | 배포 금지 |
| Firebase/Cloudflare deploy | 미실행 | 운영 변경 없음 |

종합검사 실패:

1. Steady current-head integration: `PR_HEAD_SHA must be 40hex`. 스크립트는 event/PR_HEAD_SHA/GITHUB_SHA와 exact current head를 요구한다. 임의 SHA로 우회하지 않는다.
2. Exact PR head subprocess: `git checkout --detach FETCH_HEAD`, exit128. remote branch·정확 commit 접근/checkout 맥락을 조사해야 하며 원인 확정 전 '단순 환경 문제이니 무시'하지 않는다.

재개 후 해당 후보를 검증할 때 사용 가능한 명령은 package.json의 실제 스크립트다. **일반 `npm run build`는 없다.**

```bash
cd /home/user/webapp
npm run build:hosting
npm run test:hosting
npm run test:hosting:links
npm run test:hosting:contract
npm test
```

명령을 실행한다고 평가 점수가 생기지 않는다. 종합검사의 exact-head/원격 조건은 실제 권한·Git 맥락으로 해결하고, 보호된 검사 코드를 고쳐 통과시키지 않는다. 중지 중에는 위 명령도 새로 실행하지 않는다.

## 11. 시행착오·완료 이력 — 반복하지 않을 것

| 시점/묶음 | 진행과 장애 | 남길 교훈 |
|---|---|---|
| 초기 G01~G12 | 7축·ALT 계약·비교목록·결함/보존/회귀 수락 축적 | 정확 범위/한계를 유지하며 재사용 |
| 재개4116275 | 보드6개 in_progress·발주, 작은 산출물 단위로 대기 재발 | 보드상태·발신receipt는 실행성공이 아님 |
| 완료단위4117150 | G13 묶음, 6000한도/2000경고선 운영 승인 | 경고선과 중지선 분리, 자동 무한예산 금지 |
| 협업 매뉴얼 | v0.1 작성·README/제작규칙서 연결·a17377a 커밋 | 문서로 Q90 점수/진행률 올리지 않음; 효율은 미검증 |
| R35/R36 | 조립·JS·마감 성공 | manifest전체20키, census 설명객체 예외, 권한·timeout·exit전파 해결을 재사용 |
| 9/14 4121000~4121910 | 최종 호출 실패, adapter144 안쪽 실패→145 ORIGINAL_FINAL_VALIDATE_REJECTED | private출력 미보존을 수정; inner 원인 미확정. supervisor오류는 후속전달 |
| 중지4122241 | 추가2000 범위 진단 후 미완 보류 | 계정차감과 작업귀속 구분 |
| 9/21 재개4532230 | 이전 실행영역 접근 불가, 현재 환경 다름 | 삭제라고 단정하지 않음; 오래된 backup을 R41 실물로 오인 금지 |
| 4532527~4532703 | input/census/manifest 재인증, 정확 Git18객체·source 복원 | 전체clone 아닌 필요한 exact 객체; private 본문 비공개 |
| 4532757~4533600 | 새 native compile·복원 코드4결함 보정 | setpriv source/target, 선예약, 정확manifest, 자식exit전파 |
| 4533646~4533782 | 복원 exit0이나 entry.id/config_path null | 프로세스 exit0만으로 준비성공 아님; 실제 필수값 확인 |
| 4533905~4534850 | entry 보정·시각1초·UTC 엄격성·실패권한복구 수정·검수 | 원14b와 같은 조건, finally복구, 가상실패 반례 |
| 4534890 | 관측진단 성공, 원14b 연결검사 도달 | 새환경 성공이지 과거원인 확정 아님 |
| 4534958~4534997 | 전체사본 방식의 하위 공간한도 부족 | 작은 인위적 제한으로 새 알고리즘 만들지 말고 총괄이 자원결정 |
| 4535150~4535344 | 유한 자원증액, 비관측 전환 검수, 최종validation1회 성공 | 실제 승인시각·11필드·exact묶음 유지 |
| 4535367~4535406 | 대표 중지, 기착수 검수 마감, G13 전체 수락 | 다음은 점수평가. 새개발/재진단으로 돌아가지 않음 |

기술적으로 이미 해결한 세부사항: 35초 관측과600초 전체timeout 분리, namespace 빈 route 허용표현, 마감기의 preflight.sources.census `{sha256,bytes}` 설명객체에만 좁은 예외, 시스템 Python0755와 보호source readonly 구분, source `/usr/bin/setpriv`와 target `/bin/setpriv` 구분. 이 해결을 전역금지 삭제·권한완화로 바꾸지 않는다.

## 12. 평가환경 자원·개인정보·복구

### 12.1 최종 자원 상태(실행자 보고)

승인4535150 후 한도: package64MiB, restore384MiB, metadata4MiB, followup1.5MiB, 전체608MiB 중8MiB 안전여유. 각 하위 한도는 별도이며 더해서 사용할 수 없다.

4535344 기준 실제 장부 대상 할당474,873,856bytes. 잔여 metadata1,024,000bytes, followup536,576bytes, package20,111,360bytes. restore의 최신 잔여 수치는 해당 최종 보고에 없으므로 추정하지 않는다. 디스크 여유의 이전 보고값은20,519,821,312bytes이며 현재 값으로 간주하지 않는다. 이 한도는 다음 생성 평가의 충분한 용량을 보장하지 않는다.

코드·보존본·새 사본·임시·디렉터리·결과·로그 모두 쓰기 전 ledger 예약. 원본/성공물/실패흔적을 삭제하거나 장부 예약을 임의 회수하지 않는다. 전체 프로세스 이름 기반 kill·무차별 삭제 금지.

### 12.2 개인정보 경계

원입력·census·private package 본문은 지정 executor의 기계 처리만 허용한다. 총괄·Peer·Method·LLM에 원답안이나 registry 문자열을 공유하지 않는다. 공개 가능 범위는 키명·타입·길이·hash·동일성 boolean·고정 오류코드다.

private 로그는0700 디렉터리·배타적0400 파일. O_NOFOLLOW/O_EXCL/O_CLOEXEC, nlink1, root 소유·쓰기 제한·전후 identity 등 기존 검수조건을 보존한다. 새환경은 새runtime/inode/snapshot/승인 결박이 필요하다. 이 조건은 운영 고객DB에 임의 적용할 명령이 아니다.

### 12.3 원자료·복원 artifact

| 자료 | 참조 | 검증값/범위 |
|---|---|---|
| 최종 input rev2 | 4005356:0 | 5,413,395bytes, SHA는5장; 본문비공개 |
| R18 archive | 4005422:0 | 1,058,510bytes, be69c2505fcf63507e60cef947c9338cd99fa31d21ad7a862365c5c769090dea |
| manifest 보관파일 | 4009315:0 | 1,405,739bytes, 02065cd93360931d5ac606816e38f121e5515f556582d2cc16e6c7854ca3adcf |
| archive 내 census | R18 멤버 | 17,038,958bytes, SHA는5장; streaming확인 사용 |
| 공개 exact source/Git 복원 | 4532662:0, Peer4532703 | 아래 archive; private input 제외 |

공개 복원 archive: https://www.genspark.ai/api/files/s/EtDKDkds

크기459,938bytes, SHA256 `359b077d9029ebe7e530b127a8a12ad1e36351560ecf88619d4dce738d645d1d`.

경로 `.git/q90-recovery-20260921/`: export/manifest.json, export/objects/, export/source/, test-repo/, 두 inventory JSON, q90-frozen-source-objects.tar.gz.

정확commit2+원tree7+필요blob9=Git객체18. 원14b의9경로 inventory를 두 release에 대해 exit0 확인했다. 이9blob이 같다고 전체 두commit이 같은 것은 아니다. 부모이력·비선정blob·미디어·고객자료를 포함한 전체clone이 아니다.

복원한 역사적 source:

```text
adapter SHA256:
0a9763e52c7ccf5cd49d44990f6148b6a0dc1e2af4377e8ad74d15c17d88cb74
entry SHA256:
55653a1c7b9647899231bbaa7038b66c59cb7bff72452315b71bb65080bd7f5f
native.c SHA256:
b1fd67246c5a4f00c7fc41cce22479a5a185322b6e1bd557d95034a593853001
새 native binary SHA256:
c4910bf25c559f616d9ea254f6ea36c89e55223f3b0c2ac0da00038aa3116240
```

새native는 GCC13.3.0, Node22.23.2 환경 보고, binary39,192bytes, runtime24경로/루트당138,461,184bytes였다. 역사적 source와 새컴파일 binary의 hash를 혼동하지 않는다.

과거 체크포인트 https://www.genspark.ai/api/files/s/qykglPqZ 는 R41/current 전체 private환경 백업이 아니다. 실행자의 로컬 압축104,494,114bytes도 원격영속·복구완결성 미확인이다. 사용자 인증이 필요한 wrapper 링크는 외부 서비스/다른 계정에서403일 수 있다. 다운로드 실패를 파일소실로 단정하지 않는다.

## 13. 협업 담당자·채널·명령

Workspace: `srv_51e23e89cb054d7c88888401006a0ccc`

Quality group: `ch_79f13c66b832496fbe1ebfbdd4c4cdbd`

TL execution thread: `ch_4a2fbfcc47273beedd780750b6532efe`

| 역할 | Agent ID | 기존 task ID |
|---|---|---|
| TL / 지정 executor | agent_f6d6hkjm9p5k | task_aeb01cf3e5c1963bd3cbea96c55bca82 (#58) |
| Peer | agent_jnwhjh28tew6 | task_b98e99edeee47c9608bfdf457c2197a1 (#47) |
| Method | agent_8wdz8ehh4z2y | task_d3b215cc43a10bfca22d90e644d2d13e (#56) |
| Research | agent_p1m04ehzgv43 | task_c5a0e728342c87bd793fceefccd3bde5 (#57) |
| Legal | agent_8f71j8qxr0ke | task_ef9dc257b8305ccc8b5de4b9ef2840ec (#48) |
| GTM | agent_q159468ww7j4 | task_175dbda529d17b5aa240be06e4adc003 (#52) |
| X QA | agent_33h34serfg2p | task_112d53047ec95749a7bd7b80f28d2daa (#54) |
| Code Reviewer | agent_aw2p6bjd10z5 | task_e43eb57c7bb5cf32b657b887eb6d7839 (#51) |

Method thread `ch_595e9285471c40a3204e7253f49c7b81`; X QA thread `ch_62825dc39a465be47b42cda4fe629fce`; Code Reviewer thread `ch_6ffce88ceea3c0b4d240563adb98d3ce`.

기존 담당자·task를 재사용한다. 이 관리담당 표가 평가 judge1/judge2 배정표를 대신하지 않는다. 자동 인계 제한이 실제로 있었으므로 수락 후 다음 담당자가 안 움직이면 총괄이 그 정확ref로 직접 mention한다. '이미 실행/완료면 중복하지 말 것'을 넣는다. 중지 상태에서는 mention으로 새 에이전트를 기동하지 않는다.

### 최신만 읽기

```bash
cd /home/user/webapp &&
gsk genteam read \
  --channel_id ch_4a2fbfcc47273beedd780750b6532efe \
  --after_message_id 4535406 --limit 10
```

메시지 본문은 `data.items[i].data` 아래에 있다. 필요한 comet_message_id/sender_display_name/content/attachments만 추출하고 display_text 중복 출력은 버린다.

### 재개 승인 후 발주 형식

```bash
gsk genteam send --args-file -
```

```json
{
  "channel_id": "ch_4a2fbfcc47273beedd780750b6532efe",
  "mentions": ["agent_f6d6hkjm9p5k"],
  "operation_id": "재개승인에-연결된-고유-ID",
  "skip_confirmation": true,
  "content": "정확범위/승인ref/보존/예산/완료조건/다음인계. 이미실행중이면중복금지."
}
```

예시의 skip_confirmation은 실제 pending 승인을 우회하는 권한이 아니다. pending confirmation이 나오면 정식 승인절차를 따른다.

### 첨부·잔액

```bash
gsk genteam download --channel_id CHANNEL --attachment_ref MESSAGE:INDEX
gsk login-info
```

이 세션에서는 download가 URL/hash metadata를 반환했고 `--local_file` 옵션은 도움말에 있으나 실제CLI가 거부했다. 같은 실패명령을 반복하지 말고 현재 `--help`/지원되는 인증다운로드 도구를 확인한다. file-wrapper는 인증도구로 가져온 뒤 length/SHA를 대조한다. 토큰을 하드코딩하거나 로그에 출력하지 않는다. 잔액 출력은 `data.credit_balance`만 남긴다.

## 14. 비용·중지·승인 이력

| 묶음 | 관측·규칙 | 해석 |
|---|---|---|
| 9/14 추가2000 | 시작10161.8, 하한8161.8, 마지막8468.9, 차1692.9 | 실패진단 후 보류; 계정차이이지 작업정밀과금 아님 |
| 9/21 재개4532230 | 시작100000, 최대6000, 하한94000, 경고98000/96000 | 마지막 과거중간조회97785.7 이후 차감귀속 미확인 |
| 재개4534794 | 시작61238.2, 최대2000, 하한59238.2 | 큰 계정차감이 Q90 때문이라고 단정하지 않음 |
| 최종재개4535150 | 시작47631.2, 최대6000, 경고45631.2/43631.2, 하한41631.2 | 최종검증까지의 한정운영묶음 |
| 중지4535367 | 마지막조회44253.1, 위시작대비3378.1 | 지연·타작업포함가능; 작업별비용/하드차단/예산준수보장 아님 |

현재 어떤 예산도 자동 재개권한이 아니다. 인계서 작성에 따른 이후 비용은 위 마지막조회에 포함됐다고 주장하지 않는다. 재개 시 한 담당자만 잔액을 조회하고 실제 큰 실행·예외·마감에서 확인한다.

대표는 GenTeam 90% 할인을 적극 활용하되 결과 중심으로 운영하라고 했다. 모든 도구·모델에 동일 할인율이 적용된다고 가정하지 않는다. 총괄 원문 재독·중복 검수·작은 승인·상태조회·대기 재기동을 줄인다. 독립성이 없는 병렬작업은 하지 않는다.

루멜트 적용: 현재 장애를 진단 → 한 가지 추진방침 → 일관된 실행·검수·인계. 이번 공간한도 조정은 이 원칙의 사례다. 숫자를 낮춰 통과시키는 대신, 판정과 무관한 운영자원 병목을 제거했다. 협업매뉴얼 v0.1의 효과 수치는 여전히 미검증이다.

## 15. 파일·문서 읽기 지도와 패키지 한계

### 먼저 볼 최신 운영 자료

- `.git/q90-control/progress.json`: 고정20개 SSOT, G13 accepted와 최신 중지 인계.
- 메타 `q90_pause_directive`, `active_workstream`: 간결한 최신 재개지점. 오래된 메타/대장 문구는 수락4535390/4535406과 대조한다.
- `.git/q90-control/paused-customer-display-4535367.patch`: 미검증 제품표시후보.
- 원14b: `.git/q90-control/r29-source-review/original/r19-tl-executor-run.cjs`.
- exact source복원: `.git/q90-recovery-20260921/export/manifest.json` 및 archive.
- 과거 보관위치: `.git/q90-control/r29-source-review/`, `r29-delta-review/`, `r30-owner-review/`, `r31-owner-space-review/`, `r32-owner-resource-review/`. **필요 변경부가 아니면 재귀조회·전체재독 금지.**

### 사업·제품 자료: 읽을 이유와 최신성

| 경로 | 읽을 이유 | 주의 |
|---|---|---|
| `README.md` | 전체기능·가격변경·측정·역사 지도 | 현재와 과거 설명 혼재 |
| `docs/제작규칙서_v2.0_최종본.md` | 사명·4원칙·합성·실행프로그램·자산화 구조 | 과거가격·문항수·절대표현 그대로 사용 금지 |
| `docs/제작규칙서_v2.1_개정부록_표현규칙_2026-07-31.md` | 표현조항·결함·게이트 상세 | 변경부 필요할 때만 읽기; 이번 전체재검수 아님 |
| `docs/governance/AGENT_COLLABORATION_MANUAL_v0.1.md` | 완료단위·책임·직접인계·비용운영 | 시범초안, 최신상태/효율인증 아님 |
| `docs/business-model-canvas.md` | 고객·채널·가격사다리·수익가설 | 2026-05-26 역사적 전략 |
| `docs/promise-and-limits.md` | 고객약속·서비스책임한계 | 가격·환불의 현재 법률/운영 적용은 별도 확인 |
| `docs/checkin21-value-definition.md` | 코칭·다음3주의지도 가치 | 기획주장을 자사 실효검증으로 쓰지 않음 |
| `docs/value-evidence-base.md` | 학술·철학 근거 출처 | 일반연구효과를 자사효과로 대체하지 않음 |
| `docs/용어분리지침_재현성_신뢰도_타당도_2026-08-13.md` | 재현성·신뢰도·타당도 구분 | ALT표현에 필수 |
| `docs/legal-compliance-checklist.md`, `legal-benchmark-analysis.md` | 법률/개인정보 검토 지도 | 확정 법률의견/현재준수 인증 아님 |
| `docs/privacy-policy-revision-draft.md`, `terms-revision-draft.md` | 개정 초안 | 고객 적용본과 혼동 금지 |
| `docs/seo-keyword-strategy.md`, `utm-guide.md`, `looker-studio-template.md` | 유입·전환 측정 | 최신 실제 데이터는 별도 |
| `docs/kakao-channel-operations-guide.md` | 고객 채널 운영 | 메시지발송은 별도승인 |
| `docs/handover/2026-06-01_SECURITY_HARDENING_HANDOVER.md` | 보안 역사와 운영참고 | 현재 완전안전 인증 아님 |
| `docs/strategy/diary/`, `docs/strategy/landing/` | 다이어리·랜딩 확장자료 위치 | 이번 깊은탐색 안 함; Q90후 필요시 |

### 역사적 기록의 충돌 주의 목록

- 가격9,900 대19,900 및 B2B구간 차이: 시점별 기록이다. 서버·provider·고객고지의 실제 현재값을 대조해야 한다.
- 문항56 / 최대76 / '76답변으로 완성': 핵심56+조건부최대20 맥락이 있으나 이번 최신schema 실측은 하지 않았다. 무조건 다른 고정수치로 바꾸지 않는다.
- README Cloudflare 헤더 대 실제 Firebase Hosting: 실제 프로젝트는 Firebase다. 레거시 안내로 이전하지 않는다.
- README 'survey' 대 허용목록 `suvey.html`: 주소 호환과 현재리다이렉트를 먼저 확인한다.
- '항상동일' 대 clock·버전·manual override: 조건부 재현성으로 해석한다.
- '원문 그대로 인용' 대 evdsafe 표시순화: 고객근거의 설명과 실제 표시변환 일치 검토가 필요하다.
- 초기60/90/95점 목표성 주석·5축평가 자료: 승인된 Q90 7축 실제점수와 무관하다.
- noindex·CSS숨김·문서비공개 의도: 서버접근통제를 대신하지 못한다.

### 이번 인수인계 패키지 구성

- `FAISE_Q90_HANDOVER_v1.md`: 검색·편집 가능한 정본.
- `FAISE_Q90_HANDOVER_v1.docx`: 일반 문서 열람용 동일 내용.
- `FAISE_Q90_STATE_v1.json`: 최신 상태·정확참조·파일해시·접근한계를 담은 기계판독 요약.
- `paused-customer-display-4535367.patch`: 미검증 3파일 변경 보존본.
- `reference/`: 주요 사업/운영 원문 7개 사본. 모두 역사적 자료이며 이 문서의 최신성 경고와 함께 읽는다.
- `PACKAGE_MANIFEST.json`: ZIP 내 파일의 length/SHA256. 원자료·secret·고객DB·private 로그는 포함하지 않는다.

같은 프로젝트에서 재개하면 위경로와 GenTeam 참조를 바로 사용한다. 다른 프로젝트/계정으로 이전할 때는 코드 저장소 접근과 GenTeam 채널·첨부 권한을 먼저 확보해야 한다. 이 패키지만으로 전체 소스나 private실행환경이 자동복원되는 것은 아니다. 백업을 원하면 별도 접근통제·완결성 검증을 거친 이전작업이 필요하다.

## 16. 인수 완료 확인표

- [ ] 중지4535367이 유효하며 문서작성과 작업재개 승인이 다름을 이해했다.
- [ ] G13 수락4535390/4535406, 진행률12/20=60%, 점수null을 구분했다.
- [ ] 사명·4원칙·고객여정·사업확장 순서와 고객약속 한계를 이해했다.
- [ ] 실제Firebase스택·저장본·결제권·고유코드·PDF 보존범위를 이해했다.
- [ ] 동결b03/e910과 미커밋표시후보를 구분했다.
- [ ] 정확7축·12+3사례·6역할·2judge×2회·봉인/stage2잠금을 이해했다.
- [ ] 다음업무는 G07/G14이며 성공한G13준비 반복이 아님을 확인했다.
- [ ] CLI·채널·담당자·첨부권한을 확인하고 비공개원문은 읽지 않았다.
- [ ] 최신 잔액/실환경은 재개시 확인하며 과거수치를 현재로 쓰지 않는다.
- [ ] 종합검사2실패·화면/PDF미검증·영속백업미확인·운영미배포를 알고 있다.
- [ ] 새 결과가 나오면 상태·ref·다음행동만 짧게 갱신하며 전체보고서를 재작성하지 않는다.

인수자는 '모두 이해했다'라는 선언 대신, **현재 승인 상태 / 다음 정확한 실행 / 완료 증거 / 금지 사항**을 짧게 되짚어 확인하면 된다. 이 확인을 위해 새 유료 에이전트나 대형 보고서를 만들 필요는 없다.
