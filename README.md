# 인생포트폴리오 (Life Portfolio)

## 관계 해석 교정 · 전체 서비스 공통 판단 계약 (2026-09-22)

- PR333의 이전792a905 나열·인용형 문장 후보는 사용자 피드백에 따라 배포하지 않았다. `relations-v2`는 기존 상황형 문장의 호흡을 유지하면서 함께 고른 기준, 표현과 관계, 활동과 완료, 시작과 지속을 연결한다. 사람을 고정 프로필 ID로 분류하지 않는다.
- 직접입력은 원문/출처 구간을 보존한 `semanticEdges`로 다룬다. 명시적 우선순위, 제한된 KO/EN 실행 의미, 조건·부정·타인 발언을 구분한다. 서로 다른 방법은 비교하고, 충돌·미지원 문맥은 확인 질문으로 돌린다. 일반 자연어 이해나80억 명 고유성 검증으로 주장하지 않는다.
- 같은 스포츠 코치라도 초보자의 이해를 돕는 설명은 ‘재설명 확인·고친 설명 기록’, 경기 판단 비교는 ‘선택지/조건 비교·비교표’로 실행과 남길 결과가 달라진다. 단순 인용문의 교체를 성공으로 세지 않는다.
- 공통 원칙: [LP-UNIQUENESS-01 v1.2](docs/고유성_직관성_자산화_개발원칙_v1.0.md) §0와 런타임 `PRINCIPLES`. 성경→사업 적용→설계 가설→검증 결과를 구분하고, 벤치마크/정보 보존/의사결정 가치 원리를 ruleId·evidenceRefs·완료 기준과 반례에 연결한다. 현재 실제 소비자는 네 축·실행프로그램이며 다른 서비스의 전환 완료를 주장하지 않는다.
- 재현: `npm run test:relations`(의미·문장 golden/부정·조건·미지원·같은 뜻·다른 방법), 기존 `test:evidence` 및 `test:evidence:browser`. 모든 검사는 합성 입력이고 고객 DB·실계정·결제·메일·실기기 검사는 아니다.
- 데이터/이용: `meta.inputContractVersion=input-v2`인 신규 제출에만 새 채점과 해석을 적용한다. `/report?sid=<본인SID>`, `/program?sid=<본인SID>` 및 온라인 `응답 근거`에서 확인한다. **버전 없는 기존 저장본은 자동 변경하지 않는다.** 원응답·기존 점수/고유코드·수동본·가격·단체 계약·V8·미디어·Firebase rules는 보존한다.
- 배포 경로: 기존 Firebase `hosting:public`만. 최종 source head·CI artifact·manifest·배포 run·운영 해시 확인은 PR333의 release comment/receipt를 정본으로 한다. 운영 URL https://lifeportfolio.co.kr . 아래 이전 구현 설명은 당시 후보 이력이다.

## 승인된 직접입력·채점·근거 기반 네 축 구현 (2026-09-22, 후보 미배포)

- 사용자 승인: 자유문을 리커트로 처리하지 않는 신규 채점, 기타 해제/원문 보존/활성 상태, 직접입력 문맥과 복수 응답을 해석·실행 제안에 연결하는 생성 규칙. Firebase 플랫폼·승인 V8·가격/계약·문항/매핑은 그대로다.
- 버전: 새 UI의 응답 저장/제출은 `meta/inputContractVersion=input-v2`. `scores-v2-text-excluded`는 조건부20개를 text로 분리해 숫자·공백도 채점하지 않는다. **버전 없는 과거 제출·저장 리포트는 기존 경로를 유지한다. 기존 보고서를 열거나 재생성한다고 새 버전으로 자동 이관하지 않는다.** 일괄 고객 재계산/마이그레이션은 없다.
- 생성: 순위를 묻지 않은 선택은 문항의 정본 보기 순서로 정규화하고 전체 선택을 보존한다. 새 `_responseEvidence`의 `evidence-reader-v1`이 네 축 core/detail/action/reflection을 만들며 `axisReaderView`가 기존 대표 문구로 덮지 않는다. E/V/P의 버전 없는 출력은 이전 엔진과 비교한다.
- 자유문: 명시적인 기타 선택만 활성. 해제하면 입력창은 비활성이고 원문은 남는다. 빈/공백인 선택 입력은 진행률을 낮추지 않는다. 활성 자유문은 부모 질문의 역할에 맞는 실행/확인 질문으로 연결한다. 이는 **문맥 기반 규칙과 직접 표현의 연결**이지 임의 자유문 전체를 의미 분석하거나 숨은 성향·은사·동기를 측정하는 모델이 아니다.
- UI: `/report?sid=<본인SID>`와 `/program?sid=<본인SID>`의 14지면·화면판/소장판 구조 유지. 새 결과에서만 `응답 근거` 버튼을 통해 원문·활성 상태·전체 선택·문맥별 실행 질문을 확인한다. 짧은 지면은 일부 단서/발췌만 사용하며 전체 자유문은 이 온라인 근거 창에서 확인한다. 인쇄본에 모든 원문을 자동으로 추가하지 않는다.
- 프로그램: 새 근거 모델의 계획을 분기 안내·3주 실행·3개 모듈·다음 단계에 연결하고 다른 기존 프로그램 영역은 유지한다. 전체 프로그램의 모든 해석이 새 모델로 대체된 것은 아니다. 고유코드는 원응답의 기존32/64-bit 값을 유지하고, 비활성 글·선택순서의 내용 영향을 차단하는 semanticFingerprint를 별도로 둔다.
- 실패 안전: input-v2의 새 모듈/해석 생성 실패 시 구버전 결과를 대신 저장하지 않는다. 고객 로그인/DB/실제 제출·결제·메일 수신·실기기 검사 및 운영 배포는 이번 구현에서 하지 않았다.
- 재현: `npm run test:evidence`(채점·원문·순서·구버전·20입력 반례), `npm run test:evidence:browser`(실제 DOM 입력·합성 저장/제출·리포트/프로그램·두 인쇄판·XSS). 새 브라우저 검사를 npm test에 연결했다. 문구의 독자 이해도·행동 적합성과 모집단 고유성은 이 검사로 검증됐다고 주장하지 않는다.
- 다음: 동일 후보 전체 회귀/CI 확인, 합성 문안·지면 검토, 승인된 Firebase public 경로의 배포 및 사후 검증. 아래 PR331/332 감사는 이전 기준의 이력이다.

## 고유성 × 직관성 공통 원칙과 후속 검토 (2026-09-21, 개발 중)

- 신규 필독: [LP-UNIQUENESS-01 v1.1](docs/고유성_직관성_자산화_개발원칙_v1.0.md). 성경이 모든 원리·규칙·전략의 최상위 근본 기준이며 수학·과학·철학·벤치마크는 그 아래의 도구다. 본문/문맥·해석/적용·설계 가설·실증 결과를 구분한다. 같은 직업 안의 서로 다른 기여·조건·실행·축적을 보존한다. [벤치마크 학습 기준 v1.4](docs/벤치마크_배울점_고유성기반자산화_2026-09-21.md)와 제작규칙서 부록 제38조에 연결했다.
- 현행 한국어 정상 좌표 경로의 강조 문장 9×9×8×12 상한과, 일부 두 번째 선택 변경이 강조 문장·설명에 드러나지 않는 사례를 확인했다. 이는 전체 리포트/모집단 고유성의 측정치가 아니다. 복수 선택의 저장 순서를 사용자가 정한 우선순위로 단정하지 않는다.
- 감사 자산: `npm run audit:information -- <출력.json>`으로 56문항·20개 조건부 입력의 구조와 세 합성 시드 276회 변화를 추적한다. 첫 선택 유지/두 번째 선택 변경/순서만 변경을 구분한다. 이 기존 스크립트는 조건부 동적 검사를 하지 않는다. 후속 `npm run audit:conditional -- <출력.json>`은 56개 본문항336쌍·조건부20개120쌍과 합성 저장/복원/제출을 검사한다. `npm run audit:conditional:browser -- <출력.json>`은 실제 입력 DOM 및 legacy/화면판/소장판을 비교한다. 결과·한계·별도 승인할 수정 계약은 [56+20 감사](docs/조건부입력_56plus20_감사와_수정계약_2026-09-21.md)를 따른다. 감사 실행 성공은 의미 반영 품질 PASS가 아니다. [감사 결과와 관계 기반 비교안](docs/고유성_정보흐름_감사와_비교안_2026-09-21.md)을 보관했다. 의미 개인화의 타당도나 실제 독자 검증은 자동 검사와 다르다.
- GenTeam: 공통 원칙 첨부4540512, 테크 리드4540543·리서치 사이언티스트4540539·카피라이터4540566의 이해 확인 응답을 수신했다. 3명 응답을 팀 전체 학습 완료로 표시하지 않는다. 새 병렬 구현·재위임·예산/동결 변경은 요청하지 않았다.
- PR331 운영 배포: `/report-guide`의 구형 점수 카드 안내를 현재 VII 구조·한계·실행 역할 해설로 맞추고 `/program-guide`의 연결을 보강했다. 공통 `lp-consent.css`의 레이어 순서를 조정했다. main `92fdc28`·[Firebase public 배포35668305871](https://github.com/ghwelcome0-cloud/lifeportfolio-site/actions/runs/35668305871) 성공. manifest `68522ad4f9f97da7bd2fa5cb2e4935d6780a613c635248bcdb0e76912f2ec829`, 공개 282본문 해시+기존 리디렉션1개 확인. 운영 산출물 Chromium/WebKit 7환경은 최초6개 통과·iPhone SE의1800ms 안정화 대기 타임아웃1개를 기록했다. 해당 버튼 center hit는 버튼 자신이었고, 동일 조건 단독 재검사는 통과했다. 최초 실패를 지우거나 실제 iPhone/Samsung Internet 검사로 표현하지 않는다.
- 최신 원칙 GenTeam 공유4541973, 이해 확인 카피라이터4542002·테크 리드4542006·리서치 사이언티스트4542007. 3명 확인이며 팀 전체 적용 완료가 아니다.
- 중요한 감사 결과: 20개 자유입력은 채점 유형이 `likert`로 폴백해 숫자/공백 문자열이 점수에 들어간다. V4 fingerprint 통제에서 Q40의 내부 source 외 조건부 자유문의 내용 차이가 대부분 소실된다. 본문항 Q14/Q57/Q65/Q77도 테스트한 선택 변화에서 통제 후 내용 차이 미관측. 저장됨/해시 변주/의미 활용을 동일시하지 않는다. 이 결함의 수정은 PR331 배포에 포함되지 않는다.
- 새 질문/채점/개인화 모델의 운영 적용과 실제 고객 자료 검토는 아직 완료하지 않았다. 승인된 리포트 지면과 엔진·문항·매핑·고유코드·저장 데이터는 보존한다.
- GitHub/GenTeam 공유·동료 이해 확인·구현·검증·배포를 분리해서 기록한다. 현재 서비스는 Firebase를 유지하며 새 API나 고객 데이터 모델·마이그레이션은 없다. 제작규칙서 전면 최신화는 별도다.

## VII 네 축 읽기 개선 (2026-09-21, PR330 Firebase public 배포 완료 이력)

- 최신 사용자 승인: 자기이해(나는 어떤 사람인가) → 자기표현(나는 나를 어떻게 전하는가) → 자기설계(나는 삶과 일을 어떻게 설계하는가) → 자기실행(나는 정한 것을 어떻게 실제로 해내는가). “먼저 이 네 축 페이지 개선해서 바로 배포합시다!”라는 이번 대화의 직접 승인에 따른다. 아래 v1.2 문서의 ‘미합의’는 승인 전 이력이다.
- `/report?sid=<본인 리포트 SID>`의 VII 3지면: 숫자·레이더·문항 번호 상자·단계/실행 역할 배너 대신 네 질문, 개념 한 줄, 개인화 핵심 문장·짧은 설명, 기존 키워드, 활용 제안과 열린 성찰 질문을 배치한다. 기존 DOM·Living Book·화면판/소장판이 같은 읽기 전용 `axisReaderView`를 사용한다.
- 개인화는 저장된 의미 좌표만 읽는다. 관심 주제를 표현 능력으로 단정하지 않으며, 실행 활용은 제안으로 쓴다. 구버전/좌표 누락/영문은 기존 해석 원문을 보존한다. 채점·문항 매핑·고유코드·엔진·프로그램·DB/권한·가격·계약·미디어는 변경하지 않는다. VII 외 11개 책 지면 본문은 이전 main과 실제 DOM 비교로 확인한다.
- 수동 검수본 보존: 지연된 언어 사전 준비 이벤트가 수동 본문을 자동본으로 덮어 표시하지 않게 방어한다. 저장된 검수본에는 쓰지 않는다.
- 검증: 합성 응답24종의 키워드 정확 보존·입력 동결·문장 다양성·구버전/영문/기본좌표 폴백, 실제 HTML/엔진/iframe6조건과 수동 검수본, 14지면·두 인쇄판·자식 JS·XSS·쓰기0. `npm test`에 새 네 축 검사를 연결하고 툴바 런타임 지문/변조 음성대조를 유지한다.
- 이용 방법: 본인 저장 리포트를 열고 VII로 이동한다. 재생성/재결제 없이 표시 템플릿이 적용된다. 새 API·저장 모델·마이그레이션은 없다. 운영 URL은 https://lifeportfolio.co.kr/report 이며 본인 로그인/SID가 필요하다.
- 배포 상태: PR330 main `34f361d`·[배포35661494920](https://github.com/ghwelcome0-cloud/lifeportfolio-site/actions/runs/35661494920) 성공. 공개 282개 본문 해시와 기존 리디렉션 1개 확인, 운영 소스 합성 렌더 통과. `hosting:public`만 배포했다. Functions/admin/RTDB·Firestore rules 및 Cloudflare 배포는 하지 않는다. 실제 고객 로그인·결제·메일 수신·실기기 E2E는 미실시다. 제작규칙서 전면 최신화와 그 안의 성경 원칙 반영은 이번 작업 후 별도로 진행한다.

## 벤치마크 공동 제작 기준 보관 (2026-09-21, 문서 전용)

- 사용자 승인: Gallup의 개인화·활용·주의점, Birkman의 작동 조건, InBody의 수치 비교 관계, Hogan의 척도 설명·해석·열린 성찰 질문을 고유성 기반 자산화 목적에 맞춰 결합한다.
- 필독: [벤치마크에서 우리가 배울 점](docs/벤치마크_배울점_고유성기반자산화_2026-09-21.md), `LP-BENCHMARK-ASSET-01` v1.2. 최신 피드백은 고객 가치/AX 시각화 우선, 개념 한 줄과 기존 키워드 보존, 내부 근거·실행 역할의 지면 분리다. 점수/레이더 기본 노출 제외는 제안일 뿐 아직 사용자 합의·제품 반영 전이다. 제작규칙서 v2.1 부록 제38조에 연결했다. 네 축과 11개 영역이 우선이며 발견·살아냄·남김은 네 축 안의 과정이다. 기존 매핑/채점은 보존하고 성경·벤치마크·공통 기준에 따른 직관성만 개선한다. 개인 상품 두 리포트 19,900원은 사용자 확인 정보로 기록하되 단체 계약 및 결제 코드는 변경하지 않는다. 배포 전 문안 검토본을 먼저 제시한다. 사용자 승인 방향과 아직 미합의인 문구·조판 후보를 구분한다.
- 진행: VII 네 영역 심층 진단의 기존 지면을 보존하며 자기이해부터 공동 검토한다. 지수·해석·실행 역할을 분리하고, 페이지별 합의 후 전체 개선을 일괄 구현한다.
- 이번 변경: 문서만. 앱·엔진·DB·고객 PDF·계약·정적 자산 변경 및 운영 배포 없음. GitHub 병합·GenTeam 학습 완료는 별도 증빙 없이 주장하지 않는다. 새로운 사용자 경로/API/저장 서비스는 없다.
- 제품 소스 기준: PR329 main `f846be1b0d59ad0ba0805eba4a1482b9899224bb`. 아래 PR329 수정 후보 표기는 당시 이력이며 현재 운영 배포는 인수인계에서 완료로 확인된 상태다. 이번 학습 문서 보관은 새로운 제품 배포가 아니다.

## 직관성 기준 정교화·해설서 명칭 유지 (2026-09-21, 수정 후보)

- PR328은 main86f398cc로 병합됐고 public 배포35642356555가 성공했다. 이후 대표 보완 지시에 따라 두 페이지의 ‘해설서’ 명칭을 HTML·한국어 사전에서 복원한다. ‘매일 굴리는 도구 → 할 일과 완료 기준’과 PC/전체화면 기능 개선은 유지한다.
- 직관성은 단순한 쉬운 설명이 아니라, 중학생도 이해하는 말 안에 응답에서 나온 정체성·선택 기준·행동 방향이 압축된 통찰이다. 제작규칙 제37조에 이름/핵심문장 역할 구분 및 뜻·고유성·선택 기준의 세 질문을 보강한다. 기능 이름을 무조건 슬로건으로 바꾸지 않는다.
- 이번 변경은 버튼 명칭과 품질 기준에 한정된다. 전체 개인화 본문을 새로 생성하거나 최고 품질 달성/독자 이해도 검증을 완료했다고 주장하지 않는다. 고객 데이터·진단 엔진·스크립트·프로그램 보기 CSS는 변경하지 않는다. public Hosting만 수정 배포한다.

## 프로그램 보기와 쉬운 안내 개선 (2026-09-21, PR328 배포 완료 이력)

- 기준 운영은 PR327 mainbee3305e다. 프로그램에 검증된 리포트 화면 셸 CSS를 공유해 PC 한 화면 버튼·전체화면 도구 상시 표시·목차 가독성·터치/키보드 접근성을 맞춘다. 보기 이벤트·배율 계산·진단/프로그램 엔진·DB/Functions는 변경하지 않는다.
- 리포트/프로그램의 목차·메일 앱 열기·읽는 법/실천하는 법 및 도구 설명을 한국어 사전과 HTML 기본 문구 양쪽에서 맞춘다. 프로그램의 공통 목차 설명과 활동 카드 안내만 쉬운 문장으로 바꾼다. 응답에서 생성된 본문·점수·고유코드·저장값은 바꾸지 않는다.
- /report-guide, /program-guide에 간결한 읽기/실천 순서와 용어 풀이를 추가한다. ‘한 화면’과 ‘전체화면’, 메일 작성과 발송, 본인용 링크와 공개 공유를 구분한다. 내부 제작규칙서 v2.1 부록 제37조는 쉬운 뜻/구체적 행동/확인 기준, 고유성 보존, 실제 독자 검증과 자동 검사 구분을 명시한다. 기존 조항 삭제 및 이해도 실측 주장은 없다.
- 검사: 화면/목차/전체화면40건, 실제 프로그램 HTML/엔진/iframe 맞춤6건(375/1280/1440), 안내 기본값/사전 일치 및 인쇄 소스 확인, 임의 런타임 변경 음성대조. 리포트 JS는 PR327과 동일, 프로그램 JS는 고정 안내4종을 역치환하면 기존 런타임과 바이트 동일.
- 배포는 필수 CI 후 Firebase public Hosting만. 서버/DB rules/admin/다른 Functions 배포 없음. 실제 결제·메일 수신·실기기 및 중학생 독자 이해도 검증은 미수행이다. 전체 개인화 문구 전면 개편을 완료했다고 주장하지 않는다. 아래는 이전 기록이다.

## 개인·단체 추천 진로 동일화 (2026-09-21, PR327 배포 완료 이력)

- 기준 운영 PR326 main85b747d. 최초 생성 report-loading은 career-engine/career-rules를 누락했지만 개인 재생성은 둘을 제공했다. 최초 생성 build와 V4 upgrade에 같은 규칙을 전달하고 진로 엔진/규칙 로드 실패 시 이전 방식으로 저장하지 않는다. 지면 템플릿은 공통 report.html 그대로다.
- 단체 재생성 버튼을 숨기지 않는다. 단체는 같은 엔진으로 계산한 뒤 서버 verifyB2BCode(reportAction=refreshCareer, sid, career)로 기존 한 부의 careers/careerExamples/careerGuideNote 3필드만 갱신한다. 개인의 기존 전체 재생성 동작은 유지한다. 단체의 다른 본문·점수·응답·구매권·인덱스·생성시각·참여표시는 보존한다.
- 기존 단체 자동본에서 참고 직업 줄이 없으면 본인이 해당 리포트를 열 때 동일한 보정을 실행한다. 일괄 고객 스캔/마이그레이션은 없다. 새 정상 생성본은 career-parity-v1로 기록한다. 코드·소유 UID·고정SID·완료 상태·제출응답 확인 및 RTDB transaction으로 첫 보정만 반영하고 재시도는 같은 결과를 반환한다. 이전 진로3필드는 _careerPrevious에 보존한다. 결과 없음/미완료/수동 검수본/다른SID/다른사용자는 거부한다. DB rules를 열지 않는다.
- 사용자 지시에 따라 추가 에이전트 없이 직접 검토한다. 과거 PR의 독립 승인을 재사용하거나 이번 독립 승인으로 표시하지 않는다. UI53(실제 HTML/브라우저엔진/지면 iframe의 PC·모바일 개인/단체4건 포함), 뷰어36, CSP76, 전체 서버183 검사 통과. 계정/응답/Callable 전송은 합성이고 실제 고객 로그인·실기기 검사는 아니다.
- 필요한 배포는 verifyB2BCode 한 함수 먼저, public Hosting 다음이다. admin/DB rules/Firestore/다른 Functions 배포 없음. 교육·프로그램·새 진단·새 구매권·추가 리포트 생성은 범위 밖. 운영 완료는 별도 배포 receipt로 확인하며 아래는 과거 기록이다.

## 리포트 읽기 템플릿 v1 (2026-09-19, PR326 배포 완료 이력)

- 현재 운영 기준은 PR325 main `5b67a9216245b73a38f25771b8b974b7df31956e`다. 아래 PR325의 ‘미배포’ 문구는 당시 이력이며 함수/public/RTDB 규칙 배포와 사후 검증은 완료됐다.
- 저비용 단일 템플릿: 기존 승인 리포트 지면을 유지하고 PC의 좌측 목차+페이지 읽기, 모바일의 접이식 목차+기존 리플로우를 사용한다. 녹색/크림 색상, 현재 장 대비, 목차 14px/46px 및 조작 버튼 최소44px, 키보드 포커스, 모션 감소 설정을 통일한다.
- 기존 `lbZoomFit`을 PC에도 표시하고 전체화면 툴바를 마우스 hover 없이 상시 사용할 수 있게 한다. 새 동작을 만들지 않고 이미 있는 동일 이벤트/메시지 기능을 사용한다. 모바일 접힌 목차의 보이지 않는 링크에 포커스가 가지 않게 하고 펼친 긴 목차는 자체 스크롤한다.
- 표시 변경은 report.html의 `@media screen` CSS 한 블록뿐이다. 모든 런타임 스크립트·생성/저장·인증·단체권·리포트 본문/진로 추천 구조·PDF 지면·program.html은 변경하지 않는다. 외부 벤치마크 조사나 이미지 생성/교체는 하지 않았다.
- 검사: 기존32개(2페이지×8폭×KO/EN) 툴바 검사 + 4개 폭 실제 Chromium 전체화면/목차 토글/기존 보기·페이지 메시지 검사 =36 PASS. 임의 런타임 변경 음성대조 유지. 소스 HTML/CSS와 기존 이벤트 코드를 사용하며 지면은 명시된 합성 예시다. 고객 DB·실제 고객 리포트·실기기 검사 아님.
- 운영 반영은 동일-head 검토·CI·public Hosting 배포 후 확인한다. 이번에는 Functions/admin/DB rules 배포가 필요하지 않다.

## 코드당 단일 단체 리포트 수정 후보 (2026-09-19, 아직 미배포)

- 기준 운영 main: `fcbc93cbe047a0b73f799a25211e0048df5796be` (PR324). 아래 PR323/324의 ‘후보’ 문구는 당시 이력이며 두 PR은 이미 배포됐다. 이번 수정은 별도 승인·배포가 필요하다.
- 신규 연결은 Firestore `b2b_codes/{codeId}.surveySid`와 `b2b_user_links/{uid}.surveySid`를 같은 transaction으로 지정한다. 기존 링크의 SID를 코드에 고정하며 불일치·SID 없는 과거 링크는 자동 추정/새 검사 없이 확인 필요로 중단한다. 기존 고객 자료의 일괄 조회·정리·삭제는 하지 않는다.
- `verifyB2BCode({reportAction:'read'|'finalize',sid,body?})`: 본인 코드·주문·지정 SID 확인 → 코드의 resultSid 예약 → 해당 RTDB 리포트 조건부 최초 저장 → 목록 인덱스 확인 → resultState=complete. 중간 실패는 동일 SID로 재시도하며 예약을 해제하지 않는다. 기존 자동/수동 본문은 보존한다. 완료된 결과가 유실돼도 새 결과를 생성하지 않는다.
- `/suvey?b2b=1` 완료 재진입과 마이페이지 완료 버튼은 기존 리포트로 연결한다. 일반 URL에서 B2B를 개인 결제로 인정하던 분기를 제거한다. `/report-loading?sid=...`의 단체 결과는 Callable만 사용한다. `/report?sid=...` 단체 재생성은 기존 결과 확인으로 보낸다. 추천 영역 템플릿과 프로그램 툴바는 이번 범위가 아니다.
- RTDB 규칙: users/responses/reports UID 상위 광역 쓰기 허용을 제거한다. 프로필 leaf·정당한 개인 paid 경로·지정 단체 세션만 허용한다. 별도 서버전용 `b2b_locks/{uid}`는 코드 소비 전에 생성되고 취소·재연결·UI mirror 복구로 지워지지 않는다. mirror가 유실돼도 paid 위조/기존 단체 결과 변경이 다시 허용되지 않는다. 로그인/가입 프로필 저장은 set 대신 필요한 필드만 update해 기존 리포트 인덱스를 지우지 않는다. 지정 단체 응답은 in_progress에서만 저장·제출할 수 있고, 제출 후 답변/상태/삭제는 차단한다. 제출 후 복구 목록 표시는 `meta/recoveryDismissed` 단일 leaf만 변경한다. 단체 본문·인덱스는 클라이언트 생성/교체/삭제를 막으며 서버만 확정한다. 단체 계정은 client에서 payments.paid를 새로 만들어 우회할 수 없다.
- 별도 개인 payments.paid가 이미 존재하는 계정은 비단체 SID의 개인 흐름을 유지한다. 개인 첫 결제/추가 토큰의 기존 신뢰 모델을 새로 구현하거나 PR313의 개인 결제 보안 과제를 해결했다고 주장하지 않는다. 코드만 가진 계정과 별도 개인 구매권이 있는 계정을 구분해 검사한다.
- 기존 email 정규식의 `\\s` 문자클래스는 에뮬레이터에서 거부됐다. 공백 클래스의 Unicode escape 대체안은 정상 이메일까지 거부하여 폐기했다. 최종 후보는 이메일 형태 정규식과 공백별 문자열 contains 검사를 분리하며, 정상/빈 이메일 허용과 ASCII·Unicode 공백 거부를 실제 Auth/RTDB REST로 검사한다. `prepare-b2b-test.cjs`는 전체 원본 rules를 바이트 그대로 복사하고 이제 전체 컴파일과 권한 검사를 통과한다.
- 필요한 배포 범위: `verifyB2BCode` 함수, public Hosting, RTDB rules. admin Hosting/Firestore rules/결제 함수 배포는 포함하지 않는다. 새 `firebase-database-rules-live.yml`은 current main·병합 PR·동일-head 승인·검토 rules SHA·전체 로컬 에뮬레이터 검사를 통과한 뒤 production-live 환경 신원으로 database만 배포한다. 고객 DB가 아닌 `/.settings/rules`만 사후 확인한다. 이전 ‘rules 미변경’ 승인은 재사용하지 않는다.
- GenTeam 중간 검토에서 실제 엔진 sections가 배열인데 서버가 배열을 거부하는 결함을 발견했다. 객체형 합성 sections만 사용한 시험을 수정하고, 실제 ReportEngine + ReportEngineV4 출력(배열 12섹션)으로 서버 확정을 검사한다. 저장 판정은 배열/이전 객체형을 모두 보존한다.
- read는 기존 결과의 목록/완료 연결만 복구하며 전달된 body를 무시하고 새 본문을 생성할 수 없다. 최초 생성은 finalize만 허용하고 실제 엔진 배열의 id/title/content 구조를 검사한다. 본문 후 인덱스 실패·인덱스 후 complete 실패·complete 후 mirror 실패를 주입해 동일 결과로 복구함을 확인했다.
- 탈퇴 충돌 해결: 상위 일반 쓰기를 다시 열지 않고, 최근 5분 내 본인 인증 + 해당 UID의 users/reports/responses/programs가 한 원자적 요청에서 모두 없어지는 **삭제 전용** 예외를 둔다. 일부 삭제·다른 UID·오래된 인증·생성/교체는 거부한다. 코드/잠금/결제 기록은 지우지 않으며 완료 코드는 다시 생성되지 않는다. UI는 데이터 삭제 전에 재인증을 확인하고 데이터 삭제와 Auth 삭제의 부분 실패를 구분한다. 기존 탈퇴의 자동 처리 경로를 유지하며 새 관리자 삭제 API는 추가하지 않는다.
- 제작·검증 기준 보강(사용자 개선 지시 반영): CSS-only 과거 동결 검사는 승인된 기능 변경 두 조각만 정확히 제외하고 나머지 런타임 바이트와 변조 음성시험을 유지한다. 검사는 실제 엔진 자료형·전체 원본 DB 규칙·영향받는 기존 고객 동선을 포함한다. 범위가 확정된 후보에서 검사를 묶고 최종 동일-head 검토를 요청해 불필요한 재실행을 줄인다. 고객 자료 보존·권한 검증·배포 승인 게이트는 완화하지 않는다.
- 검사 기록: 전체 원본 RTDB 규칙 + 실제 서버 핸들러/로컬 Auth·Firestore·RTDB 172 PASS(탈퇴 예외 8건 추가), 함수 추출/합성 DOM 흐름 42 PASS(삭제 전 본인인증 4건 추가), 개인·단체 복구 DOM/native Fetch 48 PASS, CSP 56 PASS(report-loading 추가), trusted workflow 정책 PASS. 실제 고객 E2E는 아니며 같은 후보의 검토·CI·운영 배포가 남아 있다.
- 실제 고객 로그인·결제·메일 수신·고객 데이터 접근·운영 배포는 수행하지 않았다. 템플릿·‘한 화면에 보기’는 착수하지 않았다. 배포가 확인될 때까지 이 절은 완료 기록이 아니다.

## 단체 CSP·복구 목록 후속 수정 (2026-09-19, 후보 미배포)

- 운영 PR323 main5fd4a70 이후 실제 브라우저에서 suvey의 enforcing meta CSP가 verifyB2BCode 요청을 차단했다. 기존 HTTP/해시 및 핸들러 검사만으로 검출하지 못한 통합 결함이다. suvey의 connect-src에 `https://asia-northeast3-lifeporfolio.cloudfunctions.net` origin 하나만 추가한다. HTTP CSP·Report-Only·다른 지시문·myPage 정책·Firebase DB rules·Functions는 변경하지 않는다.
- 기존 used 코드/동일 UID의 취소 후 재연결·resumeSurvey·mirror 복구를 에뮬레이터에서 재검사한다. 다른 UID/미사용 revoked 코드 허용을 넓히지 않는다. 서버 정책 교정이 아닌 브라우저 요청 차단 교정이다.
- 복구 목록은 기존 report-card/report-title/report-meta/report-actions/아이콘 배경과 12px 간격을 사용한다. 모바일 버튼 44px, 삭제 버튼은 기존 계열의 테두리 버튼, 320/375/768/1280폭 실제 DOM 검사.
- 삭제 버튼의 정확한 범위는 **복구 목록에서 삭제**다. `responses/{uid}/{sid}/meta/recoveryDismissed`만 변경하고 제출 답변/상태/구매권/완성된 리포트는 보존한다. `삭제한 항목 보기`에서 다시 표시 가능하다. 영구 답변 삭제로 표현하지 않으며, 제출 기록 제거로 개인 구매권이 되살아나는 것을 피한다. 현재 상태+ETag 조건부 쓰기, 실패/충돌/응답 유실/계정 변경 시 허위 성공 금지.
- 검사: 실제 HTTP+meta CSP를 적용한 native Fetch 브라우저 36개(구형 정책 차단 음성대조 포함), 실제 Firebase SDK 10.12.3+운영 Callable 무인증 검사에서 구형 정책은 요청0/차단, 수정 정책은 OPTIONS+POST 도달/UNAUTHENTICATED 확인. 무인증 거부 이전까지만 확인했으며 실제 고객 로그인/주문/리포트 조회·수정은 하지 않았다.
- 복구 목록 실제 DOM/CSS/native Fetch 합성 검사24개, 기존 그룹흐름33개 및 서버 회귀 추가. 관련 RTDB 규칙 하위트리로만 검증한다는 기존 한계를 유지한다. 새로운 테스트는 npm test에 연결하며 불변 test-all은 변경하지 않는다.
- 배포는 동일-head 검토·CI·새 승인 후 public Hosting만 필요하다. 기존 PR323은 이미 배포된 이력이고 아래 미반영 문구는 당시 기록이다. 이번 후속 후보에 이전 승인을 재사용하지 않는다.

## PR323 단체 취소·리포트 연결 후속 후보 (2026-09-19, 운영 미반영)

- 견적/입금신고/승인 주문에 취소 버튼. 취소는 신규 코드 사용 중단이며 실제 환불/송금이나 고객 응답·리포트 삭제가 아니다. 기존 연결 참여자의 이용권은 보존한다. 서버 주문 트랜잭션으로 먼저 신규 사용을 막고 미사용 코드만 400개씩 재개 가능하게 정리한다. 취소 후 입금신고/승인 주문만 별도 환불 기록 가능. 취소 이전 상태를 보존해 권장액을 유지한다.
- 취소/환불 중복 요청과 메일 접수는 멱등 처리. 접수 불명은 자동 재발송하지 않으며 수신 완료로 표현하지 않는다. 모바일 주문표는 카드로 표시하고 취소/환불 정리 재시도 버튼을 제공한다. 코드 재발급도 주문/코드를 같은 트랜잭션에서 검사한다.
- 단체 진단 오류 원인: `suvey`의 계정 전체 과거 리포트 존재 판정이 단체 세션 생성 전에 완료 안내를 반환했다. `verifyB2BCode({resumeSurvey:true})`는 인증된 본인의 기존 링크에서만 `surveySid`를 한 번 지정하고 같은 RTDB 세션을 재사용한다. 개인 `_active`/미완성 세션을 채택하거나 지우지 않는다. 단체 메타는 기존 규칙이 허용하는 `responses/.../meta` 하위에 보존한다.
- 제출된 단체 세션 재진입은 같은 SID의 report-loading으로 연결. 리포트 본문 조건부 생성(ETag/If-Match)과 목록 인덱스 저장 확인 전에는 100%/완료 이동하지 않는다. 기존/수동 본문은 덮어쓰지 않고 인덱스만 복구한다. 미생성 제출 진단은 마이페이지 복구 카드로 표시하며 추가 결제나 재응답을 유도하지 않는다. 단체 제출은 개인 구매권 표시 계산에서 제외한다.
- 기존 출처 불명 세션을 단체로 추정 변경하지 않는다. 서버 SID 고정은 정상 단체 흐름의 중복 세션 방지이며, 모든 레거시 클라이언트 쓰기를 막는 1회 소비 보안 규칙 배포를 뜻하지 않는다. PR313/PR320/DB rules 변경은 포함하지 않는다.
- 재현: `npm test`에 그룹 흐름 함수 회귀와 관리자 브라우저 회귀를 연결. `npm ci --prefix functions` 후 `npm run test:b2b:emulator`는 demo 프로젝트/localhost만 허용하며 합성 fixture만 사용한다. 현재 전체 RTDB 원본의 기존 email 정규식이 에뮬레이터 파서에서 거부되므로, 테스트는 responses/reports/b2b_access/users-reports의 원본 규칙 하위트리를 그대로 추출해 수행한다. 전체 운영 규칙 검증으로 표현하지 않는다.
- GenTeam TL의 2780fe0 검토에서 정상 두 탭·지연 자동저장이 제출된 응답을 덮는 P1이 발견되어 배포를 중단했다. 단체 자동저장/제출을 수정번호+ETag 조건부 쓰기로 통일하고, 제출된 응답/제출 시각은 재시도에서도 변경하지 않는다. 한 탭의 저장은 순차 큐로 처리하고 제출 시 예약 자동저장을 취소한다. 개인/단체 의도 구분을 위해 단체 진입은 명시적 b2b=1만 사용한다. 기존 rules는 변경하지 않는다.
- 로컬 검사: 실제 서버 핸들러+Auth/Firestore/RTDB 에뮬레이터 90 PASS(관련 RTDB 규칙 하위트리·조건부 저장 충돌 포함), 그룹 흐름 함수/오프라인 DOM 33 PASS(두 탭·지연 쓰기·동시 제출·응답 유실 9개 추가), 관리자 합성 브라우저 56 PASS, 툴바 32 PASS. public 283파일 및 admin 10파일 빌드·링크·헤더·민감파일 검사 PASS. 이는 실제 운영 고객 E2E가 아니다.
- 새 후속 후보의 동일-head 검토·CI·직접 배포 승인 필요. PR321 승인값을 재사용하지 않는다. 실제 고객 주문/응답/리포트 조회·취소·환불, 실제 로그인/메일 수신/실기기 E2E는 수행하지 않았다.

## 뷰어 툴바·운영자 메일 링크 후속 후보 (운영 미반영)

- program.html/report.html: 배율 그룹의 빈 영역이 화면 폭 전체로 늘어나던 grid를 내용 폭으로 변경하고, 이전/다음/전체 화면 버튼은 라벨을 수용하는 폭으로 배치한다. 모바일은 기존 아이콘-only 전체 화면 정책, 44px 터치 영역, SVG 아이콘 및 기존 동작을 유지한다. 좁은 화면의 영문 Fit page는 줄바꿈으로 잘림을 방지한다.
- 두 파일의 런타임 스크립트는 main e313c52와 바이트 동일. 원본 CSS/툴바 DOM을 이용한 격리 Chromium 32개 레이아웃 검사 PASS(2페이지×8폭×KO/EN). 실제 고객 프로그램·응답을 불러온 검사는 아니다. 검사를 npm test에 추가하며 불변 test-all은 변경하지 않는다.
- 견적 접수·입금 신고 운영자 메일의 HTML 버튼과 텍스트 링크를 공통 B2B_ADMIN_URL=https://lifeporfolio-admin.web.app/admin 으로 통일했다. 운영자 허브의 단체 관리 화면으로 이동하는 안내로 정정했다. 이미 발송된 메일은 변경되지 않는다.
- 합성 메일 생성 링크 검사 포함 로컬 Firebase 에뮬레이터 서버 회귀44개 PASS. 실제 발송은 하지 않았으며 새 메일에 적용하려면 해당 Functions 배포가 필요하다.
- PR321 main 병합 및 관리자 Hosting 배포는 이전 완료. 소유자 IAM 수정 후 getB2BCheckoutOrder의 무인증 요청401/Firebase JSON 확인. public Hosting run35431295139 성공. 승인 manifest 283경로 중 279 직접 HTTP200/SHA 일치, blog 3개 canonical URL SHA 일치, report-landing은 기존 홈301 및 홈 SHA 일치 확인. Functions run35354808028 자체는 기존9개 업데이트+IAM 오류로 전체 FAILURE였다는 기록을 유지한다. PR323은 아직 운영 미반영.

## PR321 출시 전 P1 교정 (2026-09-18)

- 신규 `LP-YYYYMM-12HEX` 주문번호와 기존 4자리 숫자 번호를 서버/진행조회 UI 모두 허용하도록 일치시켰다. 잘못된 길이/문자는 거부한다.
- 발급 계획과 lease를 `b2b_issuance_jobs/{orderId}` 서버 전용 문서로 분리했다. 기존 Firestore 규칙의 미일치 경로 기본 거부를 그대로 사용하며 규칙 변경은 없다. 담당자가 읽는 주문에는 작업ID/조직ID/진행 상태만 기록한다. 계획·코드·발급 수 트랜잭션과 400개 경계 재개를 유지했다.
- 로컬 실제 Auth/Firestore/RTDB 에뮬레이터에서 재검증했다. 담당자 토큰으로 주문 읽기 성공·발급계획 읽기403·비로그인 계획 읽기403, Admin SDK 계획조회, 신규 견적→조회 및 구형 번호 조회를 포함한다. 운영 고객/실메일 접근은 없다. 상세 증빙은 비공개 release-validation/b2b-stability/release-p1-server-results.json.
- 이전 4302e1e 승인은 이 수정 SHA의 승인으로 재사용하지 않는다. 수정된 동일-head 검토·승인 및 CI가 필요하다.

## 운영 대시보드 점검·교정 (2026-09-18, 후보 미배포)

- `https://lifeporfolio-admin.web.app/admin`과 b2b-admin/checkin-admin/review-admin 공개 HTML은 각각 HTTP200, 현재 main 소스와 바이트 일치, X-Frame-Options DENY/CSP 존재를 확인했다. 이는 실제 관리자 로그인이나 운영 고객 주문 조회를 수행한 것이 아니다.
- `admin.html`, `b2b-admin.html`에서 권한조회 실패·시간초과/팝업차단 안내, 실제 boolean admin claim 검사, 계정 전환 중 늦은 응답 무시를 보완했다. b2b 데이터는 현재 승인 UID가 일치할 때만 표시한다.
- b2b-admin 주문명/담당자/입금자명·코드 상세의 HTML/속성 삽입을 escape 처리했다. 모달과 목록은 Auth 변경 시 숨김/초기화한다. 기존 결제 복구·주문 처리 API나 권한 부여 설정은 변경하지 않았다.
- 원본 HTML에서 Firebase SDK import를 합성 SDK로 교체한 Chromium 회귀 28개 PASS(375/1280폭, 비로그인/비관리자/string claim/claim오류/관리자/계정경합/팝업차단, 저장형 HTML 삽입 시도 포함). 테스트를 기존 검사를 모두 유지한 npm test에 추가했다. test-all은 불변 계약 보호 대상이므로 원본을 그대로 유지한다. 실제 실기기·관리자 계정 및 운영 데이터 조작은 검사하지 않았다.
- 관리자 allowlist/claim-gate 빌드 10파일 PASS. admin 대상은 별도 매니페스트와 직접 승인으로만 배포한다. 아직 운영 배포하지 않았다.

## 재개 후 주문 소유권·결제 화면 교정 (2026-09-18, 운영 미반영)

- `getB2BCheckoutOrder`: 인증된 담당자에게만 서버 저장 금액·주문 상태를 반환한다. 기존 contactUid를 우선하며 비회원 과거 주문은 Firebase 토큰의 인증된 담당자 이메일이 일치할 때만 접근한다. 코드·전체 주문 원본은 반환하지 않는다. 신규 Callable이므로 Functions와 화면의 순차 배포 및 직접 승인이 필요하다.
- `reportB2BPayment`: 인증/소유권/호출 제한과 Firestore 트랜잭션을 적용했다. 동시 신고는 한 번만 전이·알림을 시도한다. 취소/환불을 신고로 되살리지 않으며 알림 결과 불명 상태도 보존한다. 신고는 실제 입금 확인이 아니다.
- `/b2b-checkout?order=<id>`: URL 금액 fallback과 주문명 innerHTML을 제거했다. 서버 확인 실패·미인증·취소/환불 시 입금 UI를 숨기고 로그인/인증/재확인 경로를 제공한다. 중복 클릭과 계정 변경을 방어한다. `/login?returnTo=b2b-checkout...`만 기존 내부 복귀 허용목록에 추가했다. 메일 발송·세금계산서 첨부를 미검증 상태에서 단정하던 문구도 정정했다.
- 실제 실행: 로컬 Firestore/RTDB + 합성 Callable/Auth/Resend 35개 PASS(이전 22 + 신규 13), checkout 실제 HTML의 오프라인 Chromium 375/1280폭 10개 PASS, 권리 UI 19개·가입 36개 재검사 PASS, HTML 5개 inline JS 24개 및 Functions 문법 PASS. Hosting 283파일·링크·민감파일·헤더 41경로×4종 PASS. 헤더 환경은 기존 integration-firebase 의존성을 로컬 symlink로 재사용해 복구했고 해당 symlink는 gitignore 처리했다.
- 실제 로그인·Firebase 이메일 인증 수신·입금·운영 DB/E2E는 검사하지 않았다. 단체 진단 1회 서버 소비·취소환불/mirror 경합·개인 paid 권한 문제는 이 수정으로 해결됐다고 주장하지 않는다. 이 최신 수정분의 독립 검토·배포는 아직 하지 않았다.
- 리포트 별도 PR320은 `f08777623ec98486a4502cffe3c486571d2e7fd7`로 갱신했다(106개 Node + 18개 실제 HTML 오프라인 Chromium PASS). 전체 리포트 의미 교정 완료나 출시 승인이 아니다. 시험 메일 PR319의 직접 승인 댓글은 마지막 조회 시 없었으며 실제 발송·이번 운영 배포 0건이다.

## 단체 참여자 UI 후속 검증 (2026-09-18, 출시 보류)

- `/b2b-join`: 기존/신규 계정 구분, 현재 계정 계속, 단일 코드 검증, 동의 확인, Google redirect 복원, 실패 후 동일 코드 재시도. 임시 코드는 sessionStorage에 30분 만료로 보관하며 비밀번호는 저장하지 않는다.
- `/login`, `/mypage`, `/suvey?b2b=1`: RTDB `b2b_access/{uid}` 확인 결과와 확인 불가를 구분한다. 단체 진입에서는 local paid hint로 통과하지 않는다. 개인 결제권과 단체 권리는 별개이며 새 권리를 클라이언트에서 생성하지 않는다.
- 이번 실제 재검사: 추출한 실제 함수+mock SDK/네트워크 19개 통과, 오프라인 Chromium 가입 시나리오 36개 통과, 4개 HTML inline JS 23개 문법 검사 통과. Hosting 283파일 빌드·내부 링크 0개 오류·allowlist/민감파일 검사 통과, `git diff --check` 통과.
- 추가 Hosting 헤더 검사는 로컬 `minimatch` 의존성 부재로 실행 실패했다. 헤더 제품 결함으로 단정하지 않으며 해당 검사 통과로도 기록하지 않는다.
- 현재 PR319 `cc557c2b79eb16d7f8c57fd33e23c074bb499a06`, PR320 `81f4d7227517df2c0cf7b1686ba0d58d0a160f86`의 조회된 실행 CI는 SUCCESS, public-contact-bootstrap은 SKIPPED. 둘 다 Draft/open이며 PR319 직접 승인 댓글은 조회 시 0개. 시험 수신처는 별도 보호 환경 secret에 확보됐지만 실제 발송은 0건이다.
- GenTeam PR320 회신 4372125/4372278 수집: 로더 내용·버전 검증, 과거 Q77 없는 입력의 재생성 안내, 화면/PDF 근거 연결, 첫 직업·절단 편향 및 분야 역할 우선순위가 남아 있다. 이번 후속에서 리포트 소스는 변경하지 않았다.
- 다음 필수 단계: UI 동일-head 독립 검토, 헤더 검사 환경 복구, 실제 Auth/실기기/진단→리포트 E2E, 결제 권한·취소환불·단체 1회 사용 정합성. 이 후보는 미배포이며 운영 고객 DB·구매권·응답·리포트를 조회하거나 변경하지 않았다.

## 단체 메일 안정성 후보 (2026-09-18, 운영 미반영)

- 작업 브랜치: `audit/b2b-customer-stability`, 운영 기준 `211504f64ce19bcb122e87ac99d718a3103f2bc5`. Firebase 유지, 새 PR·운영 배포 없음.
- 현재 신규 계약: 10~29명, 1인 18,000원(VAT 별도), 핵심 56문항+조건부 최대 20개 입력, 진단 1회·본인 리포트 1부. 기존 대량 주문·다이어리 계약은 신규 접수 제한과 분리해 보존.
- 견적·코드 메일: 현재 계약/미포함 범위, 자율 참여, 비서열화, 본인 열람·공유 선택, 코드 개별 전달, 약관상 12개월 유효기간·제9조 환불 안내. 미래 AI·확장 서비스 포함으로 홍보하지 않음.
- `/b2b-quote`: 접수 확인 화면에 주문번호·메일 상태·`/b2b-checkout?order=...&no=...` 이동 링크 표시. 기존 금액 파라미터 호환 유지. 발송 오류에도 재신청하지 않도록 안내, 동일 화면 중복 전송 차단, 필수 입력 브라우저 검사.
- Firestore `b2b_orders`: 기존 `emailSent` 호환 플래그는 메일 서비스 접수 여부일 뿐 수신함 배달 증거가 아님. `adminEmailStatus`/`userEmailStatus` 및 provider message ID 기록. 상태는 `provider_accepted`, `not_accepted`, `unknown`; 네트워크 시간초과·서버 오류·접수 ID 누락은 unknown. 코드 재발송은 마지막 시도 상태/ID/시각 별도 기록.
- 기존 서버 후보: 승인 동시성·부분 발급 재개, 동일 계정/동일 코드 재시도, Firestore→RTDB 권리 복구. `b2b_orders`/`b2b_codes`/`b2b_user_links`와 RTDB `b2b_access` 사용. DB 규칙 변경 없음.
- 로컬 검사: 실제 Firestore/RTDB 에뮬레이터와 mock Resend/Callable의 서버 22개 통과. ExcelJS로 합성 XLSX 읽기·코드 수/상태/다이어리 매핑 검사. 오프라인 Chromium 320/375/768/1280폭에서 접수 UX 24개+메일 레이아웃 12개 통과. Hosting 283파일 빌드, 내부 링크·민감파일 검사 통과.
- GenTeam PM 회신 `4368851` 수집. 약관 8.2(HR 활용)·8.3(고객사명 익명 활용)의 해석상 충돌은 별도 법률 검토 필요, 이번에 약관 변경하지 않음.
- 미검증/다음 단계: 시험 수신처 확정, 안전한 Resend 인증 연결, 실제 발송/배달/받은편지함·Gmail/Outlook·실기기 및 첨부 수신 확인. 현재 실제 발송 0건. 가입→진단→리포트 전체 E2E, 입금신고 인증·기존 결제 권한·취소/환불 경합·재발송 중복 정책·만료 처리·운영 인덱스 점검, 동일-head 독립 검토와 정식 승인 후에만 배포.


> 사명·강점 발견 → 첫 3주 실행 설계 → 살아낸 삶이 누군가의 양식이 되는 자리까지.

**Production**: https://lifeportfolio.co.kr/
**Repo Branch**: `genspark_ai_developer` (개발) · `main` (운영)
**Stack**: Static HTML + Firebase RTDB + Firebase Cloud Functions (PayPal/Payple) + GTM(GTM-WWNXZLZX) + GA4(G-C8XKL4L9MZ)
**정식 가격 (2026-06-26~)**: 개인 **₩19,900 / $14.99** · B2B 단가 **₩18,000~₩10,000**(구간별) · 21일 패키지 ₩39,900 *(오픈 특가 ₩9,900 종료)*

---

## 📂 핵심 파일 가이드

| 파일 | 역할 |
|---|---|
| `index.html` | 홈 (Hero · Journey 사다리 · Final CTA) |
| `product.html` | 상품/결제 페이지 (PayPal · Payple) |
| `payment-success.html` | 결제 성공 + purchase 전환 이벤트 |
| `survey.html` (`suvey.html`) | 76문항 진단 |
| `report.html` | 진단 결과 리포트 |
| `assets/i18n/ko.json` `en.json` | i18n SSOT (Single Source of Truth) |
| `assets/js/analytics.js` | LP.* 이벤트 트래커 (GTM dataLayer 래퍼) |
| `assets/js/chat-core.js` | **E그룹 P1.6 4층 AX 코칭 엔진 코어(SSOT)** — `window.LP_CHAT` (greeting/respond/heroReflect/memberState/sanitize/loadKnowledge). 4층 구조([0층]말씀 최상위·[1층]안전·이단 가드레일·[2층]신호감지+국면 되물음·[3층]곁의 자산 큐레이션). 이용자 맥락별 CTA 착지(guest/member_todo/member_done). LLM 미사용(B안 P2.0 유보) |
| `assets/js/ask-widget.js` | 우하단 '함께 이야기하기' 대화 위젯 — chat-core 연동 대화 지속형 스레드 + 3층 곁의 자산(블로그·말씀) 비동기 카드 렌더 |
| `assets/data/coaching-knowledge.json` | 2층 지식 SSOT — 9개 신호 · 6개 국면 · 재구성(reframe) · 플레이북 · 반론 응대 |
| `assets/data/scripture-knowledge.json` | 3층 말씀 지식 SSOT — 개역한글판 12구절(일상어+원문+출처, 단독 노출 금지) |
| `privacy.html` `terms.html` | 개인정보처리방침 · 이용약관 |
| `utm-builder.html` | UTM 빌더 (내부용, noindex) |
| `docs/` | 마케팅/법률/측정 산출물 |

---

## 📊 측정 인프라 (PR #77)

### GA4 표준 이벤트
- `view_item` (product.html 진입)
- `assessment_start` / `assessment_complete` (76문항)
- `begin_checkout` (결제 버튼 클릭)
- `purchase` (결제 완료 · KGI 핵심 전환)
- `report_view` / `sign_up` / `login` / `generate_lead`

### 이벤트 부가 차원 (PR #77 신설)
모든 GA4 이벤트에 자동 부가:
- `traffic_source` (utm_source, 없으면 `(direct)`)
- `traffic_medium` (utm_medium, 없으면 `(none)`)
- `traffic_campaign` (utm_campaign)
- `traffic_term` (utm_term, 선택)
- `traffic_content` (utm_content, 선택)

세션 진입 시 첫 UTM이 `sessionStorage['lp_utm_v1']`에 저장되어 세션 내 모든 이벤트에 sticky 부착됩니다. 이로써 광고→결제 어트리뷰션이 이벤트 레벨에서 보존됩니다.

### UTM Builder
내부용 캠페인 URL 빌더 — https://lifeportfolio.co.kr/utm-builder
- `<meta robots="noindex,nofollow,noarchive">` + `robots.txt Disallow: /utm-builder.html` (이중 차단)
- 채널별 프리셋 6종 (Instagram organic/ad, 블로그 CTA, Threads, 뉴스레터, 유튜브)
- 영문 소문자/숫자/`_`/`-`만 허용 (한글·공백 자동 치환)

### Looker Studio Dashboard (Template)
`docs/looker-studio-template.md` 참조 — Dashboard 템플릿은 GA4 연결 후 다음 위젯으로 구성:

| 위젯 | 차원 | 측정항목 |
|---|---|---|
| KGI 카드 | (없음) | `purchase` 이벤트 수 (일/주/월) |
| KGI 카드 | (없음) | `purchase` 매출 합 (`value`, currency 분리) |
| 어트리뷰션 표 | `traffic_source` × `traffic_medium` × `traffic_campaign` | `purchase` 수, 전환율 |
| Funnel | view_item → begin_checkout → purchase | drop-off % |
| 매체별 트렌드 | `traffic_source` (시계열) | `purchase` 수 |
| 언어별 분리 | `language` (page_view 매개변수) | `purchase` ratio KO/EN |
| 블로그 → 결제 경로 | `page_path` (블로그 페이지) → `purchase` | 어트리뷰션 |

운영 도입 단계에서 Looker Studio 템플릿 URL을 본 README에 등재합니다 (현 시점 GA4 데이터 축적 필요).

### Microsoft Clarity (Dormant)
세션 리코딩/히트맵 — 현재 **완전 비활성** 상태.
활성 조건 (AND):
1. `localStorage['lp_consent_analytics'] === 'granted'` (사용자 명시 동의)
2. `window.LP_CLARITY_PROJECT_ID` 설정됨 (운영 도입 시 별도 PR로 주입)

기본 상태에서 네트워크 호출·쿠키·데이터 수집 **없음**. 도입 결정 시 `privacy.html §10` 개정 + 동의 UI 추가 PR과 함께 활성화 예정.

---

## 🛡️ 안정성 / 보안 원칙

1. **i18n SSOT**: `?lang=en` 쿼리만이 언어 결정 (`window._withLang()` 헬퍼, `nav-lang-guard.js`).
2. **결제 멱등성**: RTDB `payments/{uid}/paid` 기준, 재로드/재진입 시 중복 결제 차단.
3. **CSP / 헤더**: Cloudflare Pages `_headers`에서 strict-transport-security, X-Frame-Options, Content-Security-Policy 관리.
4. **회귀 차단**: PR #75에서 EN→KO 회귀 차단 로직 적용.
5. **측정 격리**: 모든 analytics 코드는 `try/catch` + silent fail — 결제/인증 흐름을 방해하지 않음.

---

## 🌳 i18n 구조

```
assets/i18n/
├── ko.json   (한국어 SSOT · 39 sections)
└── en.json   (English · 39 sections)
```

HTML 요소에 `data-i18n="<section>.<key>"` 부착, `data-i18n-html="true"`이면 innerHTML 적용. `data-i18n-attr="content"`이면 속성 치환.

---

## 📚 문서

- `docs/copy-mapping-pr78.md` — PR #78 카피 매핑표 (Before/After)
- `docs/value-evidence-base.md` — **가치 근거 베이스** (PR #207). "출발선 자료 → 인생 자산화" 서비스 가치를 뒷받침하는 학술 근거 5건(Matthews 2007 · Gollwitzer&Sheeran 2006 d=0.65 · Calling 메타분석 living-a-calling ρ=.54 · Ibarra HBS 전환기 자기서사 · Turning Points PMC) + 성경 근거 2건(하박국 2:2 · 달란트 비유, **신학검증·오독경계 적용**). 모든 1차 출처 링크 보존(블로그/검증용).
- `docs/legal-benchmark-analysis.md` — K-SaaS / GDPR / CCPA 벤치마크
- `docs/legal-compliance-checklist.md` — RED/YELLOW/GREEN 3-tier
- `docs/privacy-policy-revision-draft.md` — 개인정보처리방침 개정안
- `docs/terms-revision-draft.md` — 이용약관 개정안
- `docs/README-pr77-prep.md` — PR #77 통합 인덱스
- `SECURITY.md` — 보안 정책
- `HANDOFF_PR37.md` — PR 인수인계 가이드

---

## ✍️ 가치 카피 '인생 자산화' 재편성 (PR #207·#208·#209, 2026-06-19)

"출발선 자료가 아니라 **인생 자산화로 가는 길**"이라는 서비스 가치를 카피에 반영. **네거티브 프레임 지양 / 긍정·소명 언어 / 축적(비파괴) / 사탕발림 없는 객관화** 원칙 준수.

### 변경
- **hero.h1_sub** (`ko.json`/`en.json`/`index.html`): `한 권의 인생 설계도` → **`삶이 자산이 되는 인생 포트폴리오`**
  - '설계도'(정적 도면)가 '살아냄·자산화'의 동적 흐름과 미세 충돌 → 해소. 명문화 근거(하박국 2:2 '기록하라', Matthews·Ibarra)와 정합.
- **trust.card4 신규** (`ko.json`/`en.json`/`index.html`): "발견에서 멈추지 않는 이유" — 연구 기반 신뢰 카드. **수치 비노출·절제 표현**, 자사 직접검증 주장 아님. 출처는 `index.html` 주석 + `docs/value-evidence-base.md`에 전부 보존.
- **b2b.html** hero 가격 투명화: `1인당 ₩9,000부터 · 구간별 정가 · VAT 별도` + '가격 먼저 보기 ↓' CTA.
- **JSON-LD slogan** 6개 파일 브랜드 일관성 동기화 (index/login/privacy/product/signup/terms).

### 후속 동기화 — 메타/슬로건 (PR #208, 2026-06-19)
PR #207에서 인덱싱 재평가 리스크로 제외했던 **SEO 메타 문구**를 별도 PR로 일괄 동기화.
- **title**: `9,900원 한 권의 인생 설계도 PDF` → `9,900원, 삶이 자산이 되는 인생 포트폴리오 PDF` (가격·PDF 키워드 보존)
- **description/og/twitter/image:alt** (14개 정적 HTML + 블로그 인덱스 + ko/en i18n): `한 권의 인생 설계도` → `삶이 자산이 되는 인생 포트폴리오`
- en: `Life Blueprint` (메타/리드/onlyone) → `Life Portfolio where your life becomes an asset`
- 푸터(lead.html)·signup 리드 동기화.
- **보존(비파괴)**: 블로그 글 슬러그/제목/캐노니컬(`no-comparison-life-blueprint`) — SEO 링크 파괴 방지.

### 후속 일관성 — 히어로 카드·CTA (PR #209, 2026-06-19)
스크린샷에서 h1_sub는 '인생 포트폴리오'인데 바로 아래 **카드 타이틀·CTA·서브리드가 '설계도'로 남아 충돌** → 해소.
- **[A] 브랜드 자기지칭** → '인생 포트폴리오': `hero.card_title`, `hero.sublead`, `selfcheck.onlyone_title/onlyone_body_html`, `login.meta_title`.
- **[B] 전환 CTA** '첫 인생 설계도 받기' → '첫 인생 포트폴리오 받기': `hero.cta_primary/cta`, `deliverables.cta`, `selfcheck.verdict_3plus_cta`, `sticky.cta` (+ index.html fallback·JS fallback).
- **[C] 보존(의도적)**: '**첫 3주 실행 설계도**'(deliverables.h2·journey.step1·payment 메타·bridge_hint·common.cta_start)와 faq.a7·JSON-LD '자기경영 설계도(Life Portfolio)'는 **'실행계획서'라는 동적 의미**라 유지.

### 신학 적용 원칙 (자의적 오독 경계)
- **하박국 2:2**: "하나님이 주신 비전·소명을 명백히 기록해 다른 이의 유익으로 남긴다"는 청지기 원리로만 인용. (세속적 목표설정·비전보드 오용 금지)
- **달란트 비유(마 25:14-30)**: "맡겨진 것을 살아내어 누군가의 양식으로 남김"(주인의 유익)으로 표현. (번영복음 오독 금지, 소유권은 하나님께)

### 블로그 신규 글 — "정리·구조화하면 뭐가 다른가" (2026-06-19)
새 글 `blog/posts/2026-06-19-does-structuring-your-life-make-a-difference.html` 게시.
- **포커스**: '글로 쓰는 효과'가 아니라 **"사명·강점·실행계획을 정리·구조화해 자산화로 나아가는 것이, 안 한 것과 정말 뭐가 다른가"**에 정직하게 답.
- **표현 원칙**: 미정리 상태를 존중(네거티브/해명조 표현 배제, 고객 언어로 압축) → "흩어지던 하루가 쌓이는 자산이 된다".
- **검증된 비교 근거(1차 자료 직접 확인)**: ⭐**Morisano et al. 2010**(《J. of Applied Psychology》, **무작위 대조 RCT** N=85: 정리군 GPA 2.25→2.91·풀타임 100% vs 대조군 2.26→2.46·80%), **2,928명 준실험**(정리 코호트 +22%), Gollwitzer&Sheeran 2006(if-then d≈0.65), 소명 메타분석(living ρ.54>presence ρ.40). → `docs/value-evidence-base.md` F섹션에 보존.
- **성경 층위 분리(짜맞추기 배제)**: 재검증 결과 **하박국 2:2는 자기계발 효과 근거가 아님**(Enduring Word 명시) → 글에서 효과 근거로 인용하지 않고 '남김의 본'으로만. 달란트=청지기 의미(번영복음 경계).
- **색인**: 블로그 인덱스 카드 추가, `rss.xml` item 추가, `sitemap.xml` 등록(+누락됐던 06-15 글도 보강), 관련글 역링크 2건(if-then·no-comparison).

---

## 💳 가격 정상화 — 오픈 특가 종료 (2026-06-26)

오픈 기념 가격을 마치고 **정식 가격**으로 전환. (가격 '인상'이 아니라 오픈특가 종료에 따른 **정상화**)

### 가격 변경
| 항목 | 오픈 특가(종료) | 정식 가격(현재) |
|---|---|---|
| **개인 (KRW)** | ₩9,900 | **₩19,900** |
| **개인 (USD, PayPal)** | $8.99 | **$14.99** |
| **B2B 단가 (인원 구간별)** | — | **₩18,000 ~ ₩10,000** (`calcUnitPrice`) |

### 적용 범위 (비파괴 일괄 반영)
- **가격 문자열**: `assets/i18n/ko.json`·`en.json`(34개소), `index.html`/`product.html`/`b2b*.html` 본문·JSON-LD·GA4 `value`, `payment` 메타.
- **PayPal 단가**: `functions/index.js` `defineString("PAYPAL_PRICE_USD", {default:"14.99"})` + 실제값은 `functions/.env`의 `PAYPAL_PRICE_USD=14.99` (gitignored, PC 전용). `.env.example`도 14.99로 갱신.
- ⚠️ **sed 함정 주의**: `s/9,900/19,900/g`는 `119,900`으로 오염 → Python 음수 룩비하인드 `(?<![\d,])9,900` 사용해 안전 치환.

### 오픈특가 멘트 제거
"오픈 기념 가격 진행 중 / 오픈 특가 / −50% 오픈가" 등 한시성 문구를 항구적 가치 카피로 교체.
- `ko.json`/`en.json` `announce.text`(상단 띠배너) → 가치 카피("발견하고, 살아내고, 남기는 한 권의 인생포트폴리오").
- `hero.price_badge` → 빈 문자열(`""`), `index.html` 배지 `<span>` 자체 제거(빈 박스 방지).
- `design-preview/preview-live.html` 오픈특가 배지 제거.

### EN 홈링크 무한 리다이렉트(ERR_TOO_MANY_REDIRECTS) 해소
영문 모드(`?lang=en`)에서 홈 버튼 클릭 시 무한 리다이렉트 발생 → 전면 수정.
- **원인**: `firebase.json` `cleanUrls:true` 환경에서 `href="index"` + `?lang=en` → `/index?lang=en`로 이동 시 Firebase가 빈 경로 상대 리다이렉트(`location: ?lang=en`) 반환 → 브라우저 동일 URL 재해석 → 301 루프.
- **수정**: 14개 페이지의 `href="index"`(26개소)를 `href="/"`로 변경, `_withLang("index"/"index.html")` 호출(13개소)을 `_withLang("/")`로 변경. `_withLang` 헬퍼에 **루트 안전 분기** 추가(루트/빈 path/절대경로는 `u.pathname + search + hash` 반환).
- **검증**: 라이브 `/?lang=en` → HTTP 200 (루프 소멸 확인).

---

## 📧 개인정보처리방침 개정 고지 시스템 (2026-06-19)

개인정보 보호법 제30조에 따라, 처리방침 개정 시 **전 회원 이메일 고지 + 홈페이지 팝업**을 운영합니다. (Naver·Kakao 고지 구조 벤치마킹: ①변경사항 전후 비교 ②시행일자 ③이의제기·문의)

### 구성 요소
| 파일 | 역할 |
|---|---|
| `functions/emails/privacy-update-2026-06-19.js` | 개정 고지 이메일 템플릿 (한/영 동시 · before/after 표) — `buildPrivacyUpdateEmail()` |
| `functions/index.js` → `sendPrivacyUpdateNotice` | onCall(asia-northeast3, 관리자 전용) 전 회원 일괄 발송. dryRun 미리보기, **멱등성**(`privacy_notice_log` 컬렉션 중복 차단), `admin.auth().listUsers` 페이지네이션, **Resend rate limit 대응**(건당 700ms 간격 + 429 자동 재시도) |
| `assets/js/privacy-update-popup.js` | 7일 자연소멸 팝업 (2026-06-19~06-25 KST, 한/영 자동감지, `localStorage` 오늘 숨김) — `index/product/mypage/login/checkin-21(-en)` 6개 페이지 주입 |
| `checkin-admin.html` | 관리자 발송 UI (미리보기 dryRun → 실제 발송). **미리보기 크로스체크**: 발신/회신/제목·발송 대상 샘플·실제 본문(HTML iframe + 텍스트 탭) 표시 |

### 발송 대상
- **Firebase Authentication 가입 회원 전원** (lead_captures · checkin21 신청자 모두 Auth에 포함)
- 멱등성: 캠페인 ID `privacy-update-2026-06-19`, 로그 doc `privacy-update-2026-06-19__{uid}` — 재실행해도 중복 발송 안 됨

### 운영 절차
1. (사용자 PC) Functions 배포 — `sendPrivacyUpdateNotice`는 **신규 함수**라, 배포 후 Cloud Run에서 403(CORS preflight) 발생 시 `allUsers → Cloud Run 호출자` IAM 권한 부여 필요 (resendB2BCodesEmail와 동일 이슈)
2. `/checkin-admin` 접속 → **[발송 대상 미리보기]**로 대상 수 + 실제 발송 내용 크로스체크
3. **[실제 발송]** (confirm 후 1회 실행)

### 발송 결과 (2026-06-19 완료)
- ✅ **전 회원(31명) 발송 완료** — 1차 22명 + Resend rate limit 수정 후 잔여 9명 재발송 완료
- 1차 발송 시 9명 `429 rate_limit_exceeded`(초당 2건 제한) → 건당 throttle(700ms) + 429 자동 재시도로 해결, 멱등성으로 실패자만 재발송

### 4개 개정 항목
1. 웹 호스팅: GitHub Pages → Google LLC (Firebase Hosting) 정정
2. 설문 수집(Google Forms): 상시 → 긴급 시 한정
3. 미사용 광고 추적 도메인(Meta 픽셀) 정리
4. [B2B] 미사용 위탁사(OpenAI/Anthropic) 삭제 + 보호책임자(김영식, 파이스 대표) 명시

---

## 🗂️ 21일 실행 점검 패키지 — 운영자 가이드 (₩39,900)

### 현재 운영 단계
- **사전 신청 수집 중** (D22~D28 자동 워크플로우는 아직 비활성).
- 사전 신청자는 `checkin21_preorders` Firestore 컬렉션에 자동 저장됨
  (`payment_status: paid_pre_offer` — 정식 결제 아님, 출시 우선권 + 추가 ₩5,000 할인 대상).

### 운영자 대시보드
- **URL**: `/checkin-admin` (운영자 전용, `noindex,nofollow`)
- **접근**: Google 로그인 → admin 커스텀 클레임 보유 계정만
  (최초 부트스트랩 허용: `faise@lifeportfolio.co.kr`, `ghwelcome0@gmail.com`)
- **기능**:
  - KPI 카드 (총 사전신청 / 최근 7일 / 대기중 / 동행완료)
  - 검색·상태·언어 필터
  - **엑셀(CSV) 내보내기** — UTF-8 BOM 적용 (한글 깨짐 방지)
  - 행별 진행 상태 변경 (드롭다운)
  - **고객 상세뷰 모달** — 코치 워크플로우 통합 화면:
    ① 사전신청 정보 ② 21일 사전 답변(고객의 고백) ③ 비대면 상담 채팅 로그 ④ **운영자 내부 메모(코치 노트)**

### 진행 상태 워크플로우
`pending`(대기) → `invited`(D22 초대) → `self_done`(사전답변 완료) → `chat_done`(채팅상담 완료) → `completed`(동행완료) / `cancelled`(취소)

### 관련 Cloud Functions (asia-northeast3, 관리자 전용)
- `getCheckin21Preorders` — 사전신청 목록 + 요약 조회
- `updateCheckin21Status` — 진행 상태 변경
- `getCheckin21CustomerDetail` — 고객별 통합 상세(사전신청+답변+채팅) 조회
- `updateCheckin21Note` — 운영자 내부 메모 저장

### 데이터 컬렉션 (모두 Admin SDK 전용 — 클라이언트 직접 접근 차단)
- `checkin21_preorders` — 사전신청 (+ `status`, `admin_note`)
- `checkin21_responses` — 12문항 사전 답변 (email + purchase_date 연결)
- `checkin21_chat_logs` — 비대면 상담 채팅 로그
- `checkin21_chat_escalations` — 코치 에스컬레이션

### 배포 방법
- **Hosting**: `main` 브랜치 push 시 GitHub Actions 자동 배포 (`firebase-hosting-deploy.yml`, hosting만).
- **Functions**: GitHub Actions **수동 실행** — Actions 탭 > "Deploy Firebase Functions" > Run workflow
  (`firebase-functions-deploy.yml`, functions만). ⚠️ 새 함수가 라이브되려면 이 워크플로우를 실행해야 함.

---

## 🎨 Track3 · 전 페이지 시각 재탄생 (AX 동행자 플랫폼 전환)

문서 중심 웹사이트를 **AX(Agent Experience) 동행자 플랫폼** 수준으로 시각·구성 재탄생.
`--lpx-*` AX 디자인 시스템(청록 계열 #468D84 + heritage gold #E0A458) 기반.

### Phase 2 진행 현황
- **홈 (`index.html`)** — ✅ 완료·배포. 앱 아이콘 공식 상표 로고 교체, 스플래시 2단계 통일(AX 스플래시 유지 + OS 파란 스플래시 억제), 모바일 UX 안정화.
  - **E그룹 P1.5 AX 동행 챗봇 실동작(2026-07-11)** — ✅ 완료·배포. 지금까지 **시각적으로만 존재하던** 홈 대화 진입점 2곳을
    "인생포트폴리오 E그룹 P1.5 AX 동행 챗봇 사양서 v1.0"(SSOT) 기준 **규칙 기반 완성형(A안)** 으로 실동작화. **LLM 미사용**(P2.0 실시간 자비스 유보).
    - **엔진** `assets/js/chat-core.js`(신규): 사양서 §4~§10 문장을 상수화한 순수 규칙 응답 엔진. `window.LP_CHAT`.
      - §5 회원 3분기 첫 인사(guest/member_todo/member_done, 이름 미호명) — Firebase 실시간 판정(`responses/{uid}` submitted 세션) + `visitor-context` 폴백.
      - §8 6개 실무 질의(리포트 구조·소요시간 15분/76문항·가격 19,900원/환불·재생성·데이터 보관·신앙 병행).
      - §6 미출시 가드레일(다이어리·코칭·자비스·P2.0 등 금지어 + 로드맵 질문 → SSOT 착지 문장, 금지어 무노출).
      - §7 4축 되비춤(방향·사명·강점·관계·실행) + 회사정보 유도 대응(내부 원칙 정신만).
      - §10 안전선(위기신호 → 상담 안내 ☎109/1577-0199/112/119 최우선, **리포트 CTA 미부착**) / 자문성 / 미성년.
      - §2.3 `never_expose` 후처리 블랙리스트(SSOT/청사진/백서/Track 3/App Check/토큰 접두어 등 → 감지 시 우아한 실패로 착지).
      - §4.4 우아한 실패("지금은 이 부분까지 곁에서 함께 볼 수 있어요.") — 지어내지 않음. §11 로깅 태그(#tone_off/#future_leak/#graceful_fail).
    - **위젯**(우하단 '함께 이야기하기', `assets/js/ask-widget.js`): 단일 응답 → **대화 지속형 스레드**(role=log, aria-live). §3대로 매 응답 끝에 CTA가 아닌 **'결 있는 되물음'** 우선. 첫 인사 1회 배선.
    - **히어로 입력창**('지금 마음에 걸리는 한 가지를 적어 보세요', `index.html` heroFlow): 즉시 이동 대신 §9 **되비춤 1문장 + 이 한 권 재표현 + 이중 CTA**([리포트 미리 보기]/[검사 시작하기]) 인라인 착지(3~4행). 위기신호 시 안전선 우선.
    - **도달 판정(§12 7항목) 전수 통과** — 로컬+라이브 Playwright: 회원 3분기 첫 인사·미출시 어휘 무노출·내부 문서 무노출·6실무질의 안정·4박자 되물음·우아한 실패·위기신호 시 안전선 우선. 콘솔 errors 0. 라이브 SHA256 3파일 MATCH.
    - **유보(사용자 결정)**: (B) LLM 연동은 P2.0 실시간 자비스 수준에서. Survey(`suvey.html`)·Report 페이지 AX 재탄생은 이후 단계.
  - **E그룹 P1.6 4층 AX 코칭 엔진(2026-07-11)** — ✅ 완료·배포. P1.5 규칙 챗봇을 **곁에서 함께 걷는 코치**로 심화.
    "말씀 최상위 → 안전 → 신호 되물음 → 곁의 자산" 4층 위계로 재구성. 여전히 **A안(규칙 기반), LLM 미사용**.
    - **[0층] 말씀 최상위**: 신앙 병행 발화 감지 시 `scripture-knowledge.json`(개역한글판)의 말씀을
      **일상어 먼저 → 원문·출처 함께** 제시. 원문 없이 단독 노출 금지(말씀 헌법). 3층 카드로 비동기 렌더.
    - **[1층] 안전·이단 가드레일**: 위기신호(자살·자해) → 상담 안내(☎109/1577-0199/112/119) **최우선, CTA 미부착**.
      운세·사주 등 이단성 발화 → 판단·정죄 없이 우아하게 착지(§4.4). 미출시 로드맵 어휘 무노출(§6).
    - **[2층] 신호감지 + 국면 되물음**: `coaching-knowledge.json` 9개 신호 매칭 → 정답 대신 **국면별 되물음**.
      다중턴 대화 지속(스레드 컨텍스트)으로 신호 미매칭이어도 graceful_fail로 끊지 않고 직전 여정을 이어감.
    - **[3층] 곁의 자산 큐레이션**: 신호 축에 맞는 블로그 1편 + (신앙 병행 시)말씀 1구절을 `onEnrich` 비동기 카드로.
    - **이용자 맥락별 CTA 착지(2026-07-11)** — ✅ 완료·배포. 히어로 검색창·위젯의 **모든 CTA를 이용자 상태에 맞춰** 착지:
      - **비회원(guest)** → [리포트 미리 보기]·[검사 시작하기]  ·  **회원·미검사(member_todo)** → [검사 시작하기]·[리포트 미리 보기]
      - **검사완료(member_done)** → **[마이페이지·지난 리포트 이어 읽기]**·[리포트 미리 보기]
      - 핵심 규칙: member_done에게 '검사 시작하기'를 **절대 노출 안 함**(이미 검사 완료 → 진단 페이지에서 튕겨
        마이페이지로 되돌려지던 dead-end 방지). 애초에 마이페이지로 보내 기존 리포트 확인/재생성하게 함.
      - **히어로 빈 입력 결제 튕김 버그 제거**: '함께 보기'가 빈 입력 시 결제(goFlow)로 넘어가던 것을,
        부드러운 대화 초대 문장 + 입력창 포커스로 착지(헌법: 결제 강권 금지). 검색창은 결제 창구가 아닌 대화 동행자.
      - **상태 어휘 정합**: 위젯 `handleSubmit`이 visitor-context 어휘를 그대로 넘겨 CTA가 항상 guest로 떨어지던
        문제를, `memberState()` 실측 결과를 `CHAT_STATE`에 캐시(`chatState()`)해 chat 어휘로 정확히 전달하도록 수정.
        히어로는 `__lpHeroChatState()`로 visitor→chat 어휘 동기 매핑.
    - **검증**: 로컬+라이브 Playwright 전수 통과 — 4층 엔진 19/19, CTA 맥락 착지 14/14(콘솔 errors 0),
      라이브 SHA256 3파일(index.html·chat-core.js·ask-widget.js) MATCH.
    - **커밋 분리(헌법)**: `13a317d` chat-core CTA 엔진 · `1d83dd1` widget 상태 어휘 정합 · `a747333` hero 빈 입력 수정.
    - **유보(비용 이슈)**: B안 RAG+LLM은 정적 호스팅에 백엔드(LLM 키 은닉용)가 없어 서버 도입·과금 결정 후 착수(보류).
  - **큐레이션 카드 언어 오염 버그 수정(2026-07-11)**: 홈 하단 "다음 한 걸음" 큐레이션 카드
    (`assets/js/curation.js` + `assets/js/visitor-context.js`)가 이전 영문 페이지 방문으로 남은
    `localStorage.lp_lang='en'` 때문에 한글 홈에서도 영문 블로그(`/blog/posts-en/…`)로 연결되던 문제.
    → 언어 판단을 홈/블로그 CTA와 동일 원칙(`LP_I18N.lang → URL ?lang=en → <html lang> → ko`)으로 정렬,
    `localStorage.lp_lang` 참조 제거. 라이브 검증: 한글 홈=한글 링크, 영문 홈=영문 링크, 콘솔 0.
- **마이페이지 (`mypage.html`)** — ✅ 완료·배포. **현재 구성·기능 100% 유지**, 시각 결만 AX 청록 팔레트로 정합
  (`--brand`/`--brand2` 남색 → 청록 승격, `--text`/`--line` AX 톤). JS 훅·리포트/검사/탈퇴 기능 무손상.
- **인사이트 (`blog/index.html` → 라이브 `/blog`)** — ✅ 완료·배포. 승인된 청사진 **6섹션 재탄생**:
  1. Quiet Discovery Hero (**실기능 검색** — 4축 필터 제거[안A], 실시간 필터/하이라이트/카운트)
  2. ~~Curated Themes(4축)~~ — **안A로 제거**(관계 축이 55개 중 3개뿐 → 억지 매핑 방지, 검색 실기능화로 대체)
  3. Featured Insight Rail (황금빛 오솔길 사진 `assets/blog/insight-featured.jpg` §6-5 무인물 + Why It Matters Now)
  4. Reading Path (지금 읽기→함께 생각→내 리포트 연결 3단계)
  5. Quiet Grid of Reflections (인용 4카드 + **기존 55개 포스트 카드·110 SEO 링크 원본 무손상 보존**)
  6. Soft Footer CTA — **결제 페이지로 직접 유도**(2026-07-11): KO "나의 리포트 시작하기 →" `/product-v2`(페이플 19,900원),
     EN/`?lang=en` "Start My Report →" `/product?lang=en`(PayPal $14.99). (기존 `/report-landing` 경유 제거)
  - IntersectionObserver 스크롤 모션(reduce-motion 안전), head SEO/JSON-LD/Pretendard 전량 보존, KO/EN 스크립트 훅 유지.
- **인사이트 영문 (`blog/en/index.html` → 라이브 `/blog/en`)** — ✅ 완료·배포. 한글 페이지와 **동일 6섹션 AX 재탄생**
  (40 포스트 카드·80 `posts-en` 링크 보존, Featured `2026-06-21-its-never-too-late-to-start`).
- **로그인·회원가입 (`login.html`·`signup.html`)** — ✅ 완료·배포. navy→teal AX 리스킨(`--brand`/`--brand2` #468D84/#3A7A72),
  i18n(data-i18n) KO/EN 훅 무손상. navy 잔존 0.
- **검색 UX 개선 (KO+EN)** — ✅ 완료·배포:
  - **스크롤은 Enter/칩 클릭 시에만**(타이핑 중에는 실시간 필터만, 스크롤 없음) — `applyFilter(raw, doScroll)`
  - 빨간 테두리(`is-hit`) 완전 제거 · 매칭 텍스트는 gold `<mark>` 하이라이트
  - **가이드 키워드 칩 6개** — KO: 사명·강점·자산·발견·창업·리포트 / EN: mission·strength·asset·career·discover·report
    (전부 결과 보장 — 포스트 카드 텍스트 카운트로 사전 검증, 모두 ≥4 매칭)
- **한글 페이지 영문 혼입 버그 수정** — ✅ 완료·배포:
  - 하단 하드코딩 "English version available…" 안내문 → 한글("영문판은 /blog/en/ 에서…")
  - CTA 언어 전환 로직: `localStorage.lp_lang` 기반 → **URL `?lang=en` 기반**으로 변경
    (한글 전용 페이지에 영문 CTA가 섞이던 문제 해소)
- **상품/결제 KO (`product-v2.html` → 라이브 `/product-v2`, 페이플 19,900원)** — ✅ 색 정합 완료·배포 (2026-07-11):
  - **옛 문서사이트 톤 → AX 동행자 톤**: body 배경 `slate-50` → 오프화이트 웜톤 `#FAFAF7`(마이페이지·홈 통일),
    결제 CTA와 무관한 `indigo` 링크/가격/hover/포커스 → 청록 `#468D84`, legal-box 링크 보라 `#4f46e5` → 청록.
  - **[B5] 결제 색 역할 보존**: 카드결제=블루 `#4A6984`(주) / 계좌결제=청록 `#468D84`(부) 그대로.
  - 방식: `<style>` 블록 내 Tailwind CDN 유틸 `!important` 재정의(HTML 본문 무수정, 31줄 추가만).
    결제 JS(페이플 SDK/Firebase/fnConfirm)·CSP·`priceLabel` 서버주입 100% 무손상. 라이브 console 0, SHA256 MATCH.
- **상품/결제 EN (`product.html` → 라이브 `/product?lang=en`, PayPal $14.99)** — ✅ 구조 재구성 완료·배포 (2026-07-11):
  - **옛 2단 마케팅 랜딩 → AX 미니멀 단일 결제 동선** (KO product-v2 **쌍둥이 통일**).
  - 은닉: 상단 4단 마케팅 네비(`.nav`)+Home 중복 버튼(`.btn-secondary`), 좌측 히어로 카피(`.hero-copy`),
    하단 마케팅 섹션 6개(what-you-get·why·how·for·faq·cta = `section.section`).
  - 재배치: 2단 그리드(`.hero-grid`) → 중앙 단일 컬럼(max-width 520px), 결제 패널(`.purchase-panel`) 미니멀 카드.
  - **방식: CSS-only (HTML 본문 1바이트 무수정, style 26줄 추가)**. `<style>` 끝 `[AX]` override 블록.
  - 무손상: 결제 DOM/id 10종(payBtn·paypalArea·paypalGuard·paypalButtonContainer·paypalAlreadyPaidCard·
    legalAgree·guardMsg·addPayEnBtn·addPayKoBtn·paypalGoMypageBtn)·`data-lang-only` 13개·PayPal SDK·CSP·i18n 전부.
    SEO JSON-LD(FAQPage 등)는 head에 보존. 라이브 SHA256 MATCH, console 0. 롤백=`[AX]` 블록 삭제.
  - ⚠️ 미로그인 시 `login?lang=en`으로 인증 가드 리다이렉트(정상 결제 보안). 실제 결제 화면은 로그인 후 노출.
  - 🔭 **향후**: product·survey·report 완전 신규 AX 결제 페이지 재설계(**옵션3**) — 마이페이지 컴포넌트 재사용, 별도 진행.
- **모바일 UX·PWA·결제 상태 3종 개선** — ✅ 완료·배포 (2026-07-11):
  - **[P1] 모바일 결제/ask 위젯 중복 해소 (`index.html`)**: 하단 결제바(`#mSticky`)의 기존 '진입 1.2초 자동 노출(PR#24)'
    제거 → **아래로 스크롤 시에만** 노출(위로 스크롤/최상단 근처면 숨김). ask-widget '함께 이야기하기' launcher 도
    sticky 노출과 연동(`html.lp-sticky-on`)하여 스크롤다운 시에만 페이드인 → 상단 CTA·'함께 보기'와의 중복/겹침 제거.
    PC(≥900px)는 기존 동작 보존(launcher 항상 노출). Playwright 검증: 최상단 opacity 0 → 스크롤다운 opacity 1 → 스크롤업 숨김.
  - **[P2] PWA 아이콘 교체 + 스플래시 3→2단계**: 앱 아이콘(`icon-512/192`, `apple-touch-icon`)을 **상표 등록 로고 정본**
    (파란 배경·금 이중테두리·L·궤도·인생포트폴리오/LIFEPORTFOLIO/삶을 설계하다)으로 교체, 캐시버전 `?v=2→v=3`(전 페이지+manifest).
  - **[P2 정정] 스플래시 3→2단계 (`index.html`)**: (앞선 잘못된 구현 — standalone에서 `#lp-splash`(AX 스플래시)를
    생략 — 을 정정.) **AX 스플래시(`#lp-splash`)는 standalone에서 반드시 표시**되도록 로직 복원
    (`if (standalone) return;` → `if (!standalone && seen) return;`). 대신 **OS 기본 '파란 로고' 스플래시**를
    억제/통일: `apple-touch-startup-image` **9종**(iOS 주요 해상도)을 `#lp-splash` 룩(`#FAFAF7→#F4F2EF` 그라데이션
    + 금테두리 로고 + 인생포트폴리오/Live Your Portfolio/발견하고·살아내고·남깁니다)으로 재현하여 `<head>`에 등록
    (`/assets/startup/`). 결과: (AX톤 OS 스플래시 → AX 스플래시 → 인덱스)가 시각적으로 **(AX 연출 → 인덱스) 2단계**로
    이어짐. 비-standalone 웹 최초 방문 연출은 보존(비파괴). Playwright(로컬·라이브 standalone) 검증: errors=0,
    splashVisible=visible, startupImageLinks=9, splashGone(3.5s)=true. 라이브 SHA256 MATCH.
  - **[P3] 결제 상태 3분기 버그 수정 (`product-v2.html` KO + `product.html` EN)**: 기존엔 `payments/{uid}/paid` 만 확인 →
    '결제만 하고 검사 안 한 회원'과 '결제+검사 완료(리포트 생성)한 회원'을 구분 못 해, 완료자에게도 '결제한 검사 이어보기 /
    마이페이지·검사 시작'이 오노출됨. 해결: **`responses/{uid}` 중 `status==="submitted"` 세션 수**(=완료 검사 수)를 추가 조회
    (mypage **PR#201 결제권 판정** 벤치마크 — 리포트가 아닌 submitted 세션 사용: 리포트 삭제 시 결제권 되살아나는 부작용 방지).
    · 결제O+검사미진행 → '결제한 검사 시작/이어보기'(→suvey) · 결제O+검사완료 → '마이페이지에서 리포트 보기'(→mypage).
    EN은 `_adjustPaidCardByProgress`로 paid 카드 표시 후 진행 여부에 맞게 문구/버튼 후조정. 결제 JS(페이플/PayPal)·`--lpx-*`·`[B5]` 무손상.
  - 🔭 **다음**: survey(`suvey.html`) AX 재탄생 — 지시서·청사진 참고하여 착수 예정.

### 주요 진입 경로 (cleanUrls: true, trailingSlash: false)
- `/` — 홈 · `/blog` — 인사이트(한글) · `/blog/en` — 인사이트(영문) · `/mypage` — 마이페이지(로그인 필요)
- `/login` · `/signup` — 로그인·회원가입(단일 파일, i18n KO/EN)
- ⚠️ `/blog/`·`/blog/en/`·`/mypage.html` 등은 301 → clean URL(`/blog`, `/blog/en`, `/mypage`)로 리다이렉트.
  로컬↔라이브 SHA256 검증은 반드시 **clean URL** 기준으로 수행.

### 🗄️ 보관(비노출) 페이지
- **`report-landing`** (`report-landing.html`) — 고객 **비노출 보관** 상태(2026-07-11). 파일은 삭제하지 않고 유지하되,
  `firebase.json` redirects 로 `/report-landing`·`/report-landing.html` → `/`(홈) **301 리다이렉트**.
  나중에 필요 시 해당 redirect 2줄만 제거하면 즉시 복원. (인사이트 CTA는 결제 페이지로 직접 유도하도록 변경 완료)
- **"자산 랜딩 5종"**(report-landing / regenerate / interpretation / action-program / product-v2) — 이 중 `report-landing`만
  비노출 처리. 나머지는 이번 정리 범위 밖(유지).

---

## 🔐 운영 콘솔(admin) — 별도 Hosting 사이트 (2026-08-24, A안)

### 왜 별도 사이트인가
`lifeportfolio.co.kr/admin` 이 404 였던 것은 **장애가 아니라 의도된 3중 차단**이었다.
공개 게시 계약(`scripts/hosting-allowlist.mjs`)에 admin 페이지가 없고,
`scripts/verify-hosting-build.mjs` 의 forbidden 목록과 `scripts/smoke-hosting-output.mjs` 가
공개 산출물에 admin 이 섞이면 배포를 실패시킨다.

이 3중 방어는 배포헌법 v1.0 의 **표면 최소화** 근거이므로 **완화하지 않는다.**
대신 운영 콘솔을 **완전히 분리된 Hosting 타깃**으로 게시한다.

### 구조
| 타깃 | 산출물 | 게시 계약 | 검증기 | 배포 워크플로 |
|---|---|---|---|---|
| `public` | `dist/hosting` (265파일) | `scripts/hosting-allowlist.mjs` | `scripts/verify-hosting-build.mjs` | `firebase-hosting-live.yml` (`--only hosting:public`) |
| `admin` | `dist/admin` (10파일) | `scripts/admin-allowlist.mjs` | `scripts/verify-admin-build.mjs` | `firebase-admin-live.yml` (`--only hosting:admin`) |

게시 대상 10파일: `admin.html` · `b2b-admin.html` · `checkin-admin.html` · `review-admin.html`
+ `assets/favicon.svg` · Pretendard 3종(css + Regular/Bold woff2)
+ **런타임 데이터 2종** `data/answer-kit.json` · `assets/checkin/questions.json`. **트리 통째 게시 금지**(개별 열거만).

> **2026-08-24 정정 (결함 CP)** — 초판은 8파일이었다. 제작규칙서 v2.1 부록 「기법④ 산출물
> 역방향 참조 검사」를 admin 산출물에 적용해 실측한 결과, 지면이 실행 중에 `fetch` 하는
> 데이터 2건이 계약에서 빠져 있었다(`admin.html:474`, `checkin-admin.html:578`).
> 절대경로 호출이므로 admin 호스트에 없으면 그 화면 기능만 404 로 조용히 죽는다.
> 두 파일은 공개 사이트에 이미 게시 중이라 **추가 정보 노출은 0건**이다.
> 같은 부류를 사람이 아니라 게이트가 잡도록 **검사 7(역방향 참조)** 을 신설했다.

### 두 파이프라인이 서로를 방어한다
`verify-admin-build.mjs` 는 7개 검사를 수행하며, 그중 두 개가 상호 방어 장치다.
- **검사 4**: 공개 검증기의 forbidden 목록에 admin 4종이 **여전히 열거되어 있는지** 확인 → 공개 방어를 몰래 약화시키면 admin 배포가 실패한다.
- **검사 5**: 각 admin 페이지 소스에 `onAuthStateChanged` · `getIdTokenResult` · `claims.admin` 이 **모두 존재하는지** 확인 → 권한 게이트를 지운 운영 페이지는 배포될 수 없다.

역방향 시험으로 실제 작동을 확인했다(공개파일 침입 / claim 게이트 제거 / forbidden 목록 훼손 → 각각 exit 1).

### 배포 명령
```bash
npm run build:admin            # dist/admin + dist/admin-manifest.json
npm run test:admin             # 계약 + claim 게이트 검증
npm run test:admin:contract    # 결정론 + 계약 (2회 빌드 매니페스트 동일성)
```

### ⚠️ 배포 전 대표님 수동 선행 작업 (코드로 대체 불가)
1. **Hosting 사이트 생성** — Firebase 콘솔에서 site id `lifeporfolio-admin` 추가 ✅ **완료 (2026-08-24)**
   (`.firebaserc` 의 `targets.lifeporfolio.hosting.admin` 값과 일치해야 함)
2. **Authorized domains 등록** — 4개 페이지 모두 `signInWithPopup` + `authDomain: lifeporfolio.firebaseapp.com` 이므로
   Authentication → Settings → Authorized domains 에 신규 admin 호스트를 **반드시 추가**. 누락 시 로그인 팝업이 차단된다.
   ✅ **완료 (2026-08-24)** — `lifeporfolio-admin.web.app` 등록됨
3. **Google Cloud API 키 HTTP 리퍼러 허용목록 등록** — ⚠️ **2번과 별개인 두 번째 관문.**
   웹 API 키 `AIzaSyB6xU…sPY4` 에 "웹사이트 제한사항"이 걸려 있어, Authorized domains 를 올바로 등록해도
   **API 키 허용목록에 신규 admin 호스트가 없으면 로그인 요청 자체가 403** 으로 차단된다
   (`Requests from referer https://lifeporfolio-admin.web.app/ are blocked.`).
   경로: Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 해당 API 키 → 애플리케이션 제한사항 → 웹사이트
   **기존 항목을 삭제하지 말고 추가만 한다** (대원칙-B 축적 원칙). 필요 항목 7건:
   ```
   https://lifeporfolio-admin.firebaseapp.com/*   ← admin 타깃
   https://lifeporfolio-admin.web.app/*           ← admin 타깃
   https://lifeporfolio.firebaseapp.com/*         ← 팝업 authDomain (필수)
   https://lifeporfolio.web.app/*
   https://lifeportfolio.co.kr/*
   https://lifeportfolio.firebaseapp.com/*
   https://www.lifeportfolio.co.kr/*
   ```
   전파에 최대 5분 소요. 검증 명령(200 이면 통과, 403 이면 미전파 또는 미등록):
   ```bash
   KEY=<웹 API 키>
   curl -sS -o /dev/null -w '%{http_code}\n' \
     -X POST "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=$KEY" \
     -H "Referer: https://lifeporfolio-admin.web.app/" -H 'Content-Type: application/json' \
     -d '{"identifier":"probe@example.com","continueUri":"https://lifeporfolio-admin.web.app/admin"}'
   ```
   반드시 통제군 `-H "Referer: https://evil.example.com/"` 도 함께 측정한다. 통제군이 200 이면
   허용목록이 추가된 것이 아니라 **제한이 통째로 해제된 것**이므로 즉시 되돌려야 한다.
   ✅ **완료 (2026-08-24)** — 7건 등록, admin 2호스트 403→200 (3/3 재현), 통제군 403 유지 확인
4. **커스텀 도메인(선택)** — `admin.lifeportfolio.co.kr`. canonical 태그는 이 주소 기준으로 이미 갱신됨. ⬜ 미적용
   ⚠️ 적용 시 위 3번 허용목록에 `https://admin.lifeportfolio.co.kr/*` 추가가 **함께** 필요하다
   (2026-08-24 실측 403). 도메인만 연결하면 로그인이 안 된다.

### ✅ 배포 상태 (실측 2026-08-24)
- **운영 콘솔 URL**: https://lifeporfolio-admin.web.app
- 배포 런: `32702760138` (`workflow_dispatch`, 승인 메시지 `3100319`, main `b4e075a`) ← 최신
  - 이전 런 `32697925544` (승인 `3097291`, main `950e12e`) — 헤더 5블록 최초 배포
- 게시 파일 10건 (4 페이지 + 6 자산), `dist/admin-manifest.json` sha256 `b036f05e…`
- 접속 확인: `/admin` `/b2b-admin` `/checkin-admin` `/review-admin` **전건 200**
- 런타임 JSON: `/data/answer-kit.json` · `/assets/checkin/questions.json` 전건 200 `application/json`
- 타깃 분리: 공개 사이트에서 admin 4경로 **전건 404** (설계 의도)
- 보안 헤더: admin 4경로 **전건 12/12 적용** (`?cb=` 캐시버스팅 실측)
- 로그인 경로: API 키 리퍼러 200 (3/3) · `__/auth/handler` 200 · `__/auth/iframe` 200
- 서버 권한: 미인증 callable 7종 전건 **403/401** (404 아님 → 배포됨 + 권한 강제 동시 입증)
- 정기점검: 자동 7건 PASS · **결함 0건** · 미측정 4건 (M1~M4, 실기기·실카드 필요)
- 운영자 식별자: admin 4지면 **전건 0회** (`ghwelcome0@gmail.com` · `BOOTSTRAP_ALLOWED` · `faise@`)
- 로그인 실사용 확인: 대표님 브라우저 로그인 성공, 기능 동작 확인 (2026-08-24)

### 🔐 admin 타깃 헤더 규칙 5블록 (`firebase.json`)
```
[0] '**/*.@(html|htm)'                               → 12 headers
[1] '/'                                              → 12 headers
[2] '/@(admin|b2b-admin|checkin-admin|review-admin)' → 12 headers   ← cleanUrls 대응 (필수)
[3] '**/*.@(css|svg)'                                →  3 headers
[4] '**/*.woff2'                                     →  3 headers
```

**⚠️ 블록 [2] 를 절대 삭제하지 말 것.** `cleanUrls: true` 이므로 요청은 확장자 없는 `/admin` 형태로
도달하고 `/admin.html` 은 **301 리다이렉트**된다. 따라서 `**/*.@(html|htm)` 패턴은 실제 서빙 URL에
**결코 매칭되지 않는다**. 블록 [2] 가 없으면 설정상 12종이 존재해도 프로덕션 적용은 **0종**이 된다
(2026-08-24 실측으로 확인된 실제 결함, PR #287 로 교정). 공개 엔트리도 동일 이유로
`'/@(index|login|signup|mypage|…)'` 규칙을 갖고 있다.

**헤더 변경 시 필수 검증 절차** — 설정 존재 확인만으로는 부족하다. 에뮬레이터가 멀티사이트
두 타깃을 동시 서빙하므로 **응답 수준에서 실측**한다.
```bash
npm run build:hosting && npm run build:admin
npx firebase emulators:start --only hosting --project lifeporfolio
#   public → http://127.0.0.1:5000
#   admin  → http://127.0.0.1:5005
curl -sSI http://127.0.0.1:5005/admin   # 보안헤더 12종이 실제로 붙는지 확인
```
프로덕션 실측값 (2026-08-24, admin 4경로 전량 동일):
`x-frame-options: DENY` · `x-content-type-options: nosniff` · `referrer-policy: no-referrer` ·
`permissions-policy` · `strict-transport-security` · `content-security-policy` ·
`content-security-policy-report-only` · `reporting-endpoints` · `cross-origin-opener-policy` ·
`cross-origin-resource-policy` · `x-robots-tag: noindex,…` · `cache-control: no-cache, no-store, must-revalidate`

### 🛡️ 실제 보안 경계 (정적 파일이 아님)
Firebase Hosting 은 인증 전에도 HTML/JS/JSON 을 내려준다. 따라서 브라우저의 `claims.admin` 검사는
**UX 게이트이며 보안 경계가 아니다**. 실측으로 확인된 실제 경계는 다음과 같다.

| 계층 | 실측 결과 |
|---|---|
| `database.rules.json` | `admin` 문자열 **0회**. 루트 `.read:false/.write:false`, 전 경로 `auth.uid === $uid` → 관리자도 클라이언트 직접 접근 불가 |
| admin 4페이지 | RTDB `ref()` 직접 호출 **0회**, `httpsCallable` **25회** → 전량 Functions 경유 |
| `functions/index.js` | `request.auth.token.admin === true` **7개 지점**, 전부 `if (!isAdmin) throw HttpsError("permission-denied")` |
| `dist/admin` 10파일 | `private_key`·`service_account`·`client_secret`·`Bearer`·`sk-` 패턴 **0건** |
| Firebase `apiKey` | 공개 dist 24파일 및 공개 사이트 응답에 **이미 존재** (Firebase 설계상 공개 식별자, 신규 노출 아님) |

### 알려진 잔여 이슈
- `lifeportfolio.co.kr/admin` 은 **계속 404** 이다(설계 의도). 운영자는 admin 호스트로 접속한다.
- **enforcing CSP 에 `default-src` 가 없다.** 현재 enforcing 지시자는
  `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` 4개뿐이고
  `script-src`·`style-src`·`connect-src` 등은 **Report-Only** 다. Report-Only 는 차단하지 않는다.
  admin 4페이지가 `apis.google.com`·`www.gstatic.com` 외부 스크립트와 inline 스크립트를 쓰므로
  `default-src 'none'` 기반 exact allowlist 전환은 회귀 위험이 있어 **단계적 전환 필요**(별건 PR).
  - 다만 전환 조건은 이미 유리하다 (2026-08-24 실측). Report-Only 정책은 `default-src`·`script-src`·
    `style-src`·`font-src`·`img-src`·`connect-src`·`frame-src` 등 **10개 지시문이 이미 작성**되어 있고,
    위반 리포트 수집 파이프라인도 살아 있다: `cspReport` 엔드포인트 POST/OPTIONS/GET **전건 204**,
    Firestore `csp_reports` 에 **7일 TTL** 저장, `firestore.rules` 로 공개 읽기 차단.
  - 따라서 안전한 전환 순서는 **"며칠 실사용 → 위반 리포트 확인 → 위반 0건이면 Report-Only 본문을
    enforcing 으로 승격"** 이다. 2026-08-24 대표님 최초 로그인이 사실상 첫 실사용이므로
    **아직 축적 데이터가 없어 전환 근거가 부족하다.** 데이터 없이 승격하면 콘솔이 깨질 수 있다.
- **custom claim 회수 시 기존 ID token 잔존** 대응(refresh-token revoke + 서버측 revoked 검증)
  구현 여부는 **미측정**.
- ~~`b2b-admin.html:240` · `checkin-admin.html:291` `BOOTSTRAP_ALLOWED` 운영자 이메일 노출~~
  → ✅ **해소 (PR #290, 배포 런 `32702760138`)**. 라이브 실측 admin 4지면 전건 0회.
  클라이언트 목록은 부트스트랩 박스 표시 여부만 결정하는 화면 장식이었고 자격 판정에
  관여하지 않아, 목록을 제거하고 박스를 미승인 사용자 전원에게 노출하도록 바꿨다.
  자격 판정은 서버 `ALLOWED_BOOTSTRAP_EMAILS` 호출 결과로만 결정되므로 경계는 불변이다.
  `scripts/verify-admin-build.mjs` 에 금지어 검사를 신설해 재발을 차단한다
  (역검증: 이메일을 되돌리면 2건 검출, 제거하면 통과).
- **권한 회수(revoke) 기능이 아예 없다.** 2026-08-24 실측:
  `setCustomUserClaims` 1건(부여만) · `revokeRefreshTokens` 0건 · `tokensValidAfterTime` 0건.
  즉 한 번 부여한 admin claim 을 **회수하는 경로가 구현되어 있지 않다.**
  1인 운영 중에는 즉각 위험이 아니라는 판단으로 **대표님 지시에 따라 보류**(2026-08-24).
  **직원·외부인에게 권한을 부여하는 시점에 반드시 선행 구현할 것.**

---

## 🩺 정기 점검 (Regular Inspection)

### 실행
```bash
node scripts/regular-inspection.mjs                        # 자동 항목 측정
node scripts/regular-inspection.mjs --json                 # 기계 판독용
node scripts/regular-inspection.mjs --manual-log log.json  # 수동 결과 반영
# A6 측정에는 admin origin 지정이 필요하다. 현재 실사용 호스트:
INSPECT_ADMIN_ORIGIN=https://lifeporfolio-admin.web.app node scripts/regular-inspection.mjs
# 커스텀 도메인 적용 후에는 https://admin.lifeportfolio.co.kr 로 교체
```

### 종료 코드 규약 — **미측정은 통과가 아니다**
| 코드 | 의미 |
|---|---|
| `0` | 전 항목 측정 완료 + 결함 0 |
| `1` | 결함 발견 |
| `2` | 자동 항목은 통과했으나 **수동 항목 미측정 = 점검 미완료** |

### 자동 측정 항목 (A)
| ID | 범주 | 내용 |
|---|---|---|
| A1 | 가용성 | 고객 경로 15건 × PC/모바일 UA = 30회 프로브 |
| A2 | 보안 | 민감 경로 12건 공개 차단(404) 확인 |
| A3 | 보안 | 보안 헤더 9종 존재 확인 |
| A4 | 무결성 | 게시 계약 4종 파일 존재 |
| A5 | 무결성 | 추적 소스 변경 0건 (배포헌법 제4조) |
| A6 | 운영콘솔 | admin 호스트 응답 (`INSPECT_ADMIN_ORIGIN` 필요) |

### 수동 측정 4항목 (M) — 2026-08-24 대표 승인으로 정기 점검 편입
자동화가 **불가능**한 이유가 각 항목에 명시되어 있고, 측정하지 않으면 영구히 `미측정` 으로 남는다.

| ID | 항목 | 자동화 불가 이유 | 관련 사고사례 |
|---|---|---|---|
| M1 | **결제 완주** (Payple KRW / PayPal USD) | 실 계좌·실 카드 승인 필요, HTTP 프로브로 대체 불가 | ① 결제 후 검사 진입 무한 루프 (제7조) |
| M2 | **로그인 2트랙 대등성** (Google / 이메일) | IndexedDB 주 세션 + localStorage 보조 세션은 실 브라우저에서만 검증 | ③ CSP report-only 를 로그인 실패로 오인 (제14조) |
| M3 | **모바일 실기기** (iOS Safari / Android Chrome) | UA 문자열 교체는 렌더링·터치·뷰포트·재생성 대기를 재현 못 함 | ② 모바일 재생성 무한 대기 (제24조, PR #73) |
| M4 | **리포트 결정론** (동일 입력 → 동일 지문) | 64bit fingerprint 재현성은 실제 2회 생성으로만 확인 | 유형 라벨·부정형 프레임 금지 검증 포함 |

각 항목의 **단계별 절차와 요구 증거**는 `scripts/regular-inspection.mjs` 의 `MANUAL_ITEMS` 에 명시되어 있다.

### 수동 결과 기록 형식 (`--manual-log`)
```json
{
  "M1": { "result": "pass", "date": "2026-08-24", "tester": "대표", "note": "Payple 승인번호 ..., 재시도 멱등 확인" },
  "M2": { "result": "fail", "date": "2026-08-24", "tester": "대표", "note": "시크릿창 이메일 트랙 세션 유실" }
}
```

---

## 🙏 사명

> "그러므로 너희는 가서 모든 민족을 제자로 삼아…" — 마태복음 28:18-20
> "충성되고 지혜 있는 종이 되어 그 집 사람들을 맡아 때를 따라 양식을 나누어 줄 자가 누구냐" — 마태복음 24:45

리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다.

## 홈페이지 공개 정책 선행 전환 — PR314
- 기존 운영 홈페이지·결제·진단·리포트·Functions·DB 규칙은 그대로 두고 EN/라이선스 고지와 정확한 연락처 정책만 선행 준비한다.
- 정책 v2는 기존38쌍+승인 검토 대상5쌍, source pin 9e3ca5b, 게시272파일. metadata는 실제 승인 증빙을 대체하지 않는다.
- 실제 public Hosting 활성 version 0764c0434244393b 및 release1788866818029000을 읽기 전용 API로 확보했다. 배포/rollback/고객 데이터 조회는 하지 않았다.
- 정합성·복구 기준·후속 홈페이지 공개 순서: docs/HOMEPAGE_POLICY_TRANSITION.md. 이 PR 자체로 Hosting을 배포하지 않는다.

## 홈페이지 한정 출시 준비 — 2026-09-12
- 사용자 요청에 따라 기존 Payple/PayPal·로그인·진단·리포트·Functions·DB 규칙은 운영 기준 ca47ef3 그대로 두고 V8 홈페이지 관련 변경만 분리했다.
- 추가 sandbox·실기기·전체 여정 시험은 요청에 따라 생략하며, 필수 빌드/게시 정합성·승인 게이트는 유지한다. 현재 결제가 원활하다는 것은 사용자 제공 관찰이다.
- 운영 https://lifeportfolio.co.kr/ 는 아직 변경하지 않았다. 새 홈 `/`, 기존 EN 호환 `/index-en?lang=en`, 라이선스 `/assets/fonts/lp-v8/licenses.html`이 후보 진입점이다.
- 공개 연락처 정책·신뢰된 게시 절차와 실제 활성 Hosting release/version 기록이 남아 있다. 소스 준비를 운영 배포 가능/완료로 오인하지 않는다.
- 상세 범위·생략한 검사·복귀 절차·데이터 경계: docs/HOMEPAGE_ONLY_RELEASE.md. 기존 제작규칙서 W15에 누적했다. 이전 통합 보안 후보는 별도 보존한다.

### B2B·블로그 진입 링크 복원 — 2026-09-12
- V8는 PR315/main9cc4673에서 실제 public Hosting에 공개됐다(run34671695828, version4716632cca7b1fe4). 아래의 미배포 문구는 준비 당시 기록이다.
- 사용자 요청으로 KO 홈 상단 메뉴에 아이콘+이름 링크 두 개만 추가: `/b2b`(기관 이용), `/blog`(기존 글 목록). 모바일에서는 기존 메뉴 버튼을 열어 접근한다.
- 두 페이지는 삭제되지 않았으며 실제 운영 GET200을 확인했다. B2B는 기존 하단 링크만 남아 있었고 블로그는 홈 진입 링크가 빠져 있었다. B2B·블로그 글·기존 고객/결제/서버·미디어·라이선스는 변경하지 않는다.
-320–1440px 9개 폭에서 새 링크의 클릭 영역·화면 내 배치·키보드 순서·18회 모의 이동을 확인했다. 실제 고객 로그인/결제 시험은 아니다. 변경된 산출물의 필수 게시 절차는 유지한다.

### 정책 정렬 및 공개 절차 진행
- PR314 정책은 필수 CI와 실제 3역할 승인 후 main `845cc0a`로 병합됐다. 이번 후보는 해당 main 위에 승인된 홈페이지 변경만 정렬했으며 기존 고객·결제·서버 파일은 불변이다.
- 사용자 최종 지시에 따라 새 홈페이지 PR의 필수 artifact/preview 확인 후 기존 Firebase live workflow로 public Hosting만 배포한다. 배포 성공 여부는 실제 workflow와 공개 URL 확인 기록을 따른다.
