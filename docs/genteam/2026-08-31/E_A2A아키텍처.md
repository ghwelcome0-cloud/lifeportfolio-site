# AX 동행자 플랫폼 A2A 상호운용층 아키텍처 지침

- 문서 상태: 미래 호환 설계 지침(구현 지시 아님)
- 작성일: 2026-08-31
- 우선순위: 낮음. Phase 0만 현재 수행 가능하며, 외부 공개·성역 변경·운영 트래픽 수용은 별도 승인 전 금지
- 적용 대상: 인생포트폴리오 리포트, 21일 체크인, 자산화, B2B 그룹 인사이트 및 향후 부가·외부 연계 서비스

## 1. 결론

지금 A2A 서버를 구현하거나 Agent Card의 능력을 `true`로 바꿀 단계는 아니다. 현재의 정직한 선언(`capabilities=false`, 4개 skill의 `implemented=false`)을 유지하면서, 앞으로 추가하는 기능이 **도메인 서비스 → 안정된 작업 계약 → A2A 어댑터** 순으로 승격될 수 있게 경계를 고정하는 것이 맞다.

권고 구조는 다음과 같다.

```text
웹 UI / 내부 운영 UI / 향후 외부 Agent
                 │
        [채널별 어댑터 계층]
  Web Adapter | Internal API | A2A Binding
                 │
        [Application Task Service]
  명시적 작업·상태·취소·산출물·오류 계약
                 │
          [Domain Services]
 진단 | 리포트 | 체크인 | 자산화 | B2B 집계
                 │
      [Policy / Auth / Consent / Audit]
                 │
 Firebase RTDB · Firestore · Storage · Functions
```

A2A는 기존 엔진과 데이터를 직접 노출하는 새 코어가 아니라 **응용 서비스 앞의 상호운용 어댑터**여야 한다. 그래야 프로토콜 버전이나 JSON-RPC/gRPC/HTTP+REST 바인딩이 바뀌어도 제품 도메인과 고객 데이터 구조를 다시 뜯지 않는다.

## 2. 설계 기준과 확인된 제약

본 설계는 제공된 정본을 기준으로 한다.

- A2A 1.0.0: Canonical Data Model → Abstract Operations → Protocol Bindings의 3계층.
- Agent Card: `/.well-known/agent-card.json`, 필수 8필드 `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills`.
- 지도 원칙: Simple, Enterprise Ready, Async First, Modality Agnostic, Opaque Execution.
- MCP 인가 방향: OAuth Resource Server, OAuth 2.1 + PKCE + Resource Indicators.
- 현재 `/.well-known/agent-card.json` 배포는 `scripts/build-hosting.mjs`의 dot-path 차단과 `firebase.json`의 `**/.*` ignore 때문에 불가하며 rewrite도 없다. 두 파일은 성역이다.
- CSP enforcing 승격은 NO-GO 상태다. 따라서 A2A 보안을 CSP 강화에 의존해서는 안 된다.

미확인 사항:

- 실제 A2A 적합성 시험, 외부 에이전트 상호운용 시험, OAuth 인가 서버 제품 선정, Firebase Functions의 목표 부하·비용, 데이터 보존기간, 외부 파트너 계약은 아직 확정되지 않았다.
- Agent Card 초안의 의미 정확성과 A2A 1.0.0 스키마 적합성은 “필수 8필드 존재” 외에는 본 문서에서 재검증하지 않았다.

## 3. Phase 0~3 로드맵

### Phase 0 — 방향 보존(현재, 코드 변경 없음)

**목표:** 미래 A2A 도입을 막는 결합을 만들지 않는다.

**선행조건**
- 없음. 현행 배포와 성역을 그대로 유지한다.

**산출물**
1. 본 agent-ready 설계 규칙 채택.
2. 4개 후보 skill의 내부 계약 초안: 입력, 출력, 권한, 비동기 여부, 취소, 오류, 개인정보 등급.
3. A2A 의사결정 기록(ADR): A2A는 어댑터이며 엔진·DB를 직접 호출하지 않는다는 원칙.
4. Agent Card 상태표: 구현 전 skill은 계속 `implemented:false`; capability를 추정으로 올리지 않음.
5. 데이터 분류·동의·감사·보존 요구 목록과 위협 모델 초안.

**성역 수정:** 불필요.

**주요 위험**
- 문서만 만들고 후속 기능이 규칙을 우회할 위험.
- 표준/제품 요구 변화로 초안이 낡을 위험.

**통과 기준**
- 새 기능 설계 리뷰에 agent-ready 체크리스트가 들어가고, 각 기능의 계약·권한·데이터 등급이 문서화됨.

### Phase 1 — 내부 상호운용 기반(비공개, A2A 외부 노출 없음)

**목표:** 웹 UI와 분리된 내부 Application Task Service를 만든다.

**선행조건**
- 우선순위 상향 및 구현 승인.
- 개인정보 처리 목적·보존·삭제 정책 승인.
- 비용 한도, rate limit, 감사 로그 소유자 지정.

**산출물**
1. 내부 versioned task API와 공통 envelope.
2. `submitted → working → input-required → completed|failed|canceled` 상태 모델.
3. idempotency, 취소, timeout, 재시도, webhook/polling 계약.
4. 4개 후보 skill 중 저위험 read-only 또는 합성 fixture 기반 1개 pilot.
5. scope/consent/policy/audit 계층과 테스트.
6. A2A Canonical Data Model로 변환 가능한 내부 모델과 변환 테스트.

**성역 수정:** 도메인/API 구현 위치에 따라 승인 필요 가능. `scripts/build-hosting.mjs`와 `firebase.json` 수정은 아직 불필요.

**주요 위험**
- 내부 API가 UI의 Firebase 레코드를 그대로 외부 계약으로 굳힐 위험.
- 동기 요청으로 긴 작업을 처리해 timeout·중복 과금이 생길 위험.
- 인증만 있고 목적별 동의·scope 검사가 없는 위험.

**통과 기준**
- 실제 고객 데이터 없이 contract·negative·권한·idempotency 시험 통과.
- 도메인 서비스가 HTTP/A2A 자료형과 독립적임.

### Phase 2 — 제한된 A2A 파트너 pilot

**목표:** allowlist 파트너와 최소 skill 1개를 비공개 또는 제한 공개한다.

**선행조건**
- Phase 1 통과.
- OAuth 2.1 기반 인가 서버/키 관리/회수 경로 선정.
- DPA·처리목적·데이터 최소화·삭제·사고대응 승인.
- 비용·쿼터·남용탐지·운영 당직 및 kill switch 준비.
- A2A 1.0.0 스키마/바인딩 적합성 시험.

**산출물**
1. Cloud Functions `asia-northeast3`의 A2A Gateway.
2. OAuth access token 검증, audience/resource와 scope 검증, 파트너별 quota.
3. Task API: 생성·조회·취소·메시지/산출물 전달.
4. 최소 Agent Card: 실제 구현·검증된 interface/capability/skill만 선언.
5. 파트너 sandbox, 합성 데이터 fixture, 상호운용·취소·재시도 시험.
6. 감사 이벤트, 비용 원장, 데이터 export/delete 경로.

**성역 수정:** **승인 필요.** 정식 `/.well-known/agent-card.json` 공개에는 `scripts/build-hosting.mjs`와 `firebase.json` 변경 또는 승인된 rewrite 전략이 필요하다. Functions/API 배포 및 보안 규칙 변경도 각각 승인 대상이다.

**주요 위험**
- allowlist가 잘못 적용돼 공개 API가 될 위험.
- task 재시도에 따른 중복 생성·중복 결제.
- partner agent가 과도한 개인정보를 보내거나 결과를 목적 외 재사용.

**통과 기준**
- 한 파트너·한 skill·합성/최소 데이터로 end-to-end 성공.
- 취소, 토큰 회수, quota 초과, 중복 idempotency key, 악성 입력의 음성 시험 통과.
- 장애와 비용이 사전 한도 안에 있음.

### Phase 3 — 운영형 슈퍼 에이전트 생태계

**목표:** 검증된 복수 skill과 외부 서비스 연계를 운영한다.

**선행조건**
- Phase 2의 보안·비용·SLO·사용자 효용 실측.
- 파트너 온보딩/퇴출, 분쟁·결제·환불, 데이터 이동·삭제 정책.
- 다중 공급자 장애와 공급망 위험 대응.

**산출물**
1. 복수 protocol binding을 지원할 수 있는 adapter registry.
2. skill versioning, deprecation, compatibility matrix.
3. 사용자 위임·승인·지출 한도·고위험 human-in-the-loop.
4. partner trust tier, capability attestation, 정책 엔진.
5. 비동기 이벤트 전달, dead-letter/replay, 지역·보존 정책.
6. 사용량 정산과 고객별 가치/비용 측정.

**성역 수정:** **승인 필요.** Hosting, Functions, Firebase 규칙, 공개 정책·약관, 결제/정산 영역 변경 가능성이 높다.

**주요 위험**
- 에이전트 연쇄 호출로 비용과 책임 경계가 폭발.
- 외부 서비스 장애·응답 변화·정책 위반이 우리 결과로 귀속.
- “슈퍼 에이전트” 표현이 실제 capability보다 앞서는 과장.

**통과 기준**
- skill별 SLO·비용·오류·보안·사용자 효용을 외부 실측으로 관리.
- capability 선언과 실제 구현/권한/가용성이 자동 대조됨.

## 4. Agent-ready 설계 규칙

앞으로 모든 신규 기능은 아래 규칙을 설계 리뷰의 필수 항목으로 삼는다.

1. **도메인과 전송 분리:** 비즈니스 로직은 HTTP request, A2A message, Firebase event 객체를 직접 받지 않는다. 내부 command/query DTO를 받고 A2A/웹 어댑터가 변환한다.
2. **버전된 계약:** 입력·출력 envelope에 `schemaVersion`, `operation`, `requestId`를 둔다. 필드 의미 변경은 기존 버전을 덮어쓰지 않는다.
3. **작업 중심 모델:** 1초를 넘거나 외부 호출·PDF 생성·집계가 있는 기능은 동기 응답이 아니라 task로 모델링한다. 상태, 진행, 결과, 실패, 취소를 명시한다.
4. **결정적 idempotency:** 쓰기 작업은 호출자가 제공하는 `idempotencyKey`와 주체·operation을 묶어 중복 실행을 차단한다. 재시도는 새 결제·리포트·체크인을 만들지 않는다.
5. **오류를 데이터로:** 안정된 error code, retryable 여부, 사용자 조치, trace ID를 반환한다. 내부 stack, DB 경로, 개인정보는 노출하지 않는다.
6. **입출력 모드 명시:** text, JSON, file/PDF 등 modality를 명시하고 MIME type, 크기 한도, hash, 만료를 계약화한다. base64 대용량 본문을 기본으로 쓰지 않는다.
7. **내부 실행 불투명성:** 외부에는 결과·상태·필요 입력만 보여주고 프롬프트, chain-of-thought, 내부 엔진 구조, 데이터베이스 키를 공개 계약으로 만들지 않는다.
8. **최소권한 scope:** skill별 read/write/admin, 개인/B2B, report/checkin/asset 범위를 분리한다. “로그인됨”만으로 모든 skill을 허용하지 않는다.
9. **명시적 사용자 동의:** 어떤 데이터가 어느 외부 서비스로, 무슨 목적으로, 얼마나 보존되는지 작업 전 표시·기록한다. 동의 없는 cross-service 전달을 금지한다.
10. **데이터 최소화 DTO:** Firebase 원본 레코드를 그대로 반환하지 않는다. skill에 필요한 필드만 allowlist DTO로 투영하고 민감도·보존기간을 붙인다.
11. **출처·계보:** 산출물에 입력 버전, 엔진/규칙 버전, 생성 시각, source artifact hash를 내부 감사 정보로 남긴다. 외부에는 필요한 범위만 공개한다.
12. **취소·timeout·보상:** 작업별 취소 가능 시점, 외부 부작용 발생 후 보상 동작, timeout과 재시도 상한을 정한다. 단순 재시도 불가능한 결제·발송은 별도 승인 단계가 필요하다.
13. **rate/cost budget:** 사용자·파트너·skill별 요청량, 동시성, 토큰/외부 API/Functions 비용 한도를 둔다. 예산 소진 시 fail closed 또는 input-required로 전환한다.
14. **감사 가능한 정책 결정:** 인증 성공뿐 아니라 scope, consent, tenant, data class, 정책 결과와 거부 이유를 구조화 로그로 남긴다. 원문 응답은 기본 로그에 남기지 않는다.
15. **테넌트 격리:** 개인과 B2B 조직의 주체·데이터·quota·audit namespace를 분리한다. 조직 집계에서 소규모 집단 재식별 방지 기준을 둔다.
16. **외부 의존 격리:** 제3자 서비스는 connector 인터페이스 뒤에 두고 timeout, circuit breaker, response validation, provider 교체가 가능해야 한다.
17. **capability honesty:** Agent Card에는 배포되어 인증·권한·성공/실패/취소 시험을 통과한 능력만 선언한다. roadmap 기능은 description이 아니라 별도 문서로 관리한다.
18. **양방향 시험:** 정상 fixture뿐 아니라 권한 없음, 동의 없음, 과대 입력, 중복 key, 취소 race, provider 장애, 개인정보 유출 시도를 음성 통제군으로 둔다.
19. **사람 승인 경계:** 결제, 외부 메시지 발송, 데이터 삭제·공유, B2B 조직 변경 등 비가역 작업은 agent가 바로 실행하지 않고 명시적 human approval token을 요구한다.
20. **표준 독립 내부 모델:** A2A Canonical Data Model과 1:1로 맞출 수 있는 adapter는 두되, 내부 DB schema 자체를 A2A schema로 만들지 않는다.

## 5. Cloud Functions 기반 A2A Server 경계 설계

### 5.1 권장 논리 구성

```text
/.well-known/agent-card.json       정적 발견 문서(Phase 2, 승인 필요)
api.lifeportfolio.co.kr/a2a/*      권장 논리 호스트 예시; 실제 도메인은 미확정
  └─ A2A Gateway Function
      ├─ Protocol Binding Adapter
      ├─ OAuth Token/Resource/Scope Validator
      ├─ Tenant + Consent + Policy Engine
      ├─ Rate/Cost/Abuse Guard
      ├─ Task Application Service
      ├─ Skill Registry
      └─ Audit/Telemetry (redacted)
             │
      Domain Service Ports
             │
   Queue/Task Store/Artifact Store/Connectors
```

Functions는 edge adapter와 orchestration entrypoint로 사용하고, 긴 실행을 단일 HTTP invocation 수명에 묶지 않는다. 실제 큐·저장 제품 선정은 미확정이다.

### 5.2 A2A 계층 대응

- **Canonical Data Model:** 내부 Task, Message, Artifact, Part DTO와 A2A 모델 사이의 명시적 mapper. unknown field 처리와 schema validation을 둔다.
- **Abstract Operations:** task 생성/조회/취소, 메시지 전송, artifact 획득을 application service port로 정의한다.
- **Protocol Bindings:** 첫 pilot은 한 binding만 선택한다. JSON-RPC/gRPC/HTTP+REST를 동시에 구현하지 않는다. 추가 binding은 같은 abstract operation을 호출하는 별도 adapter로만 추가한다.

### 5.3 공통 task envelope 권고

```json
{
  "schemaVersion": "1.0",
  "requestId": "opaque-id",
  "idempotencyKey": "caller-stable-key",
  "skill": "life-diagnostic-76",
  "skillVersion": "1.0",
  "subject": { "type": "user|organization", "id": "opaque-subject" },
  "input": { "mode": "application/json", "data": {} },
  "policyContext": { "tenantId": "opaque", "consentId": "opaque" },
  "callback": { "mode": "poll|webhook", "url": null }
}
```

응답은 task ID, 상태, 생성/만료 시각, 허용 operation, 결과 artifact metadata를 반환한다. 이메일·응답 원문·Firebase 경로를 식별자로 쓰지 않는다.

### 5.4 OAuth 2.1 방향

아래는 설계 방향이며 제품 선정은 미확정이다.

1. A2A Gateway는 OAuth Resource Server로 동작한다.
2. 사용자 위임 클라이언트에는 Authorization Code + PKCE를 사용한다. 기계 간 호출은 별도 client credential 정책이 필요하며 사용자 권한을 자동 상속하지 않는다.
3. Resource Indicator/audience를 A2A API로 제한해 다른 API용 token의 재사용을 차단한다.
4. scope를 `diagnostic:submit`, `report:read`, `checkin:write`, `asset:read`, `b2b-insight:read`처럼 skill/동작별로 분리한다.
5. access token은 단기, refresh token은 회전·회수 가능하게 하고 서버에 원문 token을 로그하지 않는다.
6. 조직 tenant, 사용자 subject, client, scope, consent를 모두 검사한다. scope 하나만 맞는 것으로 충분하지 않다.
7. webhook에는 별도의 송신 서명, timestamp/nonce, replay 방지, allowlist 또는 등록된 callback 검증을 둔다.
8. token 회수, client 폐기, partner kill switch가 즉시 적용되는 운영 절차가 있어야 한다.

### 5.5 skill별 경계

- `life-diagnostic-76`: 입력 데이터 민감도가 높다. Phase 2 첫 pilot로 권하지 않는다. 동의·삭제·재처리 경계가 먼저다.
- `asset-accumulation`: 장기간 누적 데이터와 쓰기 부작용이 있어 idempotency·version conflict·사용자 승인 필요.
- `checkin-21`: 비교적 작은 단위지만 반복 호출·알림·민감 회고가 있어 rate limit과 일정/동의가 필요.
- `b2b-group-insight`: 재식별·고용 맥락 오용 위험이 가장 크다. 최소 집단 크기, 억제, 역할별 접근, 개인 결과 역추론 방지 전에는 외부 공개하지 않는다.

## 6. 보안·운영 위험 등록부

현재 CSP·HSTS·X-Frame-Options DENY는 브라우저 보안에 유효하지만 A2A API의 인증·인가·남용·데이터 경계를 대체하지 않는다. CSP enforcing은 NO-GO이므로 본 완화책에서 전제하지 않는다.

| 우선 | 위험 | 가능성 | 영향 | 등급 | 통제/완화 | 책임 역할 | 상태 |
|---:|---|---|---|---|---|---|---|
| 1 | 탈취 token·과도한 scope로 개인/B2B 데이터 접근 | 중 | 높음 | 높음 | 단기 token, audience/resource, 세분 scope, tenant+consent 검사, 회수·kill switch | 보안 책임자 | 미구현 |
| 2 | 외부 agent가 76문항·리포트·체크인 개인정보를 목적 외 전송/보존 | 중 | 높음 | 높음 | 최소 DTO, 목적별 동의, partner 계약, 보존·삭제 API, 민감 skill 단계적 공개 | 개인정보 책임자 | 미구현 |
| 3 | 자동 재시도·agent loop로 Functions/외부 API 비용 폭증 | 높음 | 중 | 높음 | idempotency, depth/hop 제한, quota, 동시성, 예산 hard cap, circuit breaker | 플랫폼 운영 | 미구현 |
| 4 | B2B 집계에서 개인 재식별·고용 의사결정 오용 | 중 | 높음 | 높음 | 최소 집단 크기, suppression, 개인 drill-down 금지, 목적 제한, audit | B2B·개인정보 책임자 | 미구현 |
| 5 | scraping으로 카피·규칙·결과 대량 수집 | 높음 | 중 | 높음 | 인증 전/후 rate limit, anomaly 탐지, 대량 export 별도 scope, 응답 최소화 | 보안·제품 | 미구현 |
| 6 | prompt/instruction injection이 connector 호출·데이터 유출 유도 | 중 | 높음 | 높음 | 입력을 명령 아닌 데이터로 취급, tool allowlist, 정책 계층, 출력 validation, 비가역 human approval | AI 안전 책임자 | 미구현 |
| 7 | 외부 서비스 응답 변조·장애가 우리 산출물로 귀속 | 중 | 높음 | 높음 | connector 격리, schema/signature 검증, provenance, timeout, fallback, 공급자 상태 표시 | 통합 책임자 | 미구현 |
| 8 | webhook SSRF·재전송·위조 | 중 | 높음 | 높음 | callback 등록/검증, private IP 차단, 서명, nonce/timestamp, retry cap | 보안 책임자 | 미구현 |
| 9 | Agent Card가 미구현 능력을 선언해 신뢰 훼손 | 중 | 중 | 중간 | capability honesty, 배포 전 자동 contract 대조, implemented=false 유지 | 제품·QA | 현재 완화 |
| 10 | task/artifact 장기 보존과 로그가 새로운 개인정보 저장소가 됨 | 중 | 높음 | 높음 | TTL, redaction, 암호화, 삭제 전파, 로그 allowlist, 접근 감사 | 데이터 운영 | 미구현 |
| 11 | 공개 endpoint DDoS·고비용 payload | 중 | 높음 | 높음 | body/file 한도, 인증 전 rate limit, queue backpressure, timeout, WAF/edge 통제 검토 | 플랫폼 운영 | 미구현 |
| 12 | protocol/version drift로 파트너 연동 파손 | 중 | 중 | 중간 | versioned card/skill/schema, compatibility test, deprecation window | 아키텍처 책임자 | Phase 0 규칙 |
| 13 | agent가 결제·발송·삭제를 사용자 확인 없이 수행 | 낮~중 | 높음 | 높음 | 명시적 승인 token, 지출 한도, dry-run, 보상/취소 정책 | 제품·재무·보안 | 미구현 |
| 14 | 한국 외 지역 agent/partner 연계 시 국외 이전·관할 문제 | 미확인 | 높음 | 미확인 | 파트너·처리지역 확정 후 법적 검토, 지역별 routing/저장 정책 | 법무·개인정보 | 미확인 |

Phase 2 시작 전 1~8, 10~11은 owner와 통제가 정해져야 한다. 위험 수용만으로 외부 공개해서는 안 된다.

## 7. llms.txt와 Agent Card 역할 분담

### llms.txt

- 대상: LLM·검색·에이전트가 사업/콘텐츠를 이해하도록 돕는 B2A 설명 자산.
- 내용: 제품 개요, 공개 문서·콘텐츠 탐색, 용어, 공개 가능한 정책과 링크.
- 하지 않을 일: 실행 가능한 skill, 인증 방식, 보장된 endpoint, 실시간 capability를 선언하는 운영 계약으로 사용하지 않는다.

### Agent Card

- 대상: A2A client의 발견과 상호운용.
- 내용: 실제 endpoint/interface, 버전, capability, input/output modes, 구현·검증된 skills.
- 하지 않을 일: 마케팅 로드맵, 미구현 skill, 민감한 내부 구조, 비밀 endpoint를 싣지 않는다.

### 상호 참조 방침

1. llms.txt는 공개 Agent Card의 canonical well-known URL을 “기계 실행 인터페이스”로 링크할 수 있다. **Phase 2 이전에는 정식 경로가 없으므로 링크하지 않는다.**
2. Agent Card는 `description` 또는 skill documentation URL에서 llms.txt나 공개 설명 문서를 참조할 수 있으나 필수 runtime dependency로 삼지 않는다.
3. 두 문서의 제품명, 설명, 공개 skill 명칭은 한 registry에서 생성하거나 CI에서 일치 검증한다.
4. 충돌 시 실행 계약은 Agent Card, 설명·콘텐츠 탐색은 llms.txt가 정본이다.
5. llms.txt에 존재한다고 capability가 구현된 것은 아니다. Agent Card의 선언도 실제 contract test와 배포 상태가 뒷받침해야 한다.
6. 개인정보 schema, 내부 프롬프트, 운영 key, 비공개 endpoint는 양쪽 모두에 싣지 않는다.

## 8. 품질 게이트 7종의 장기 에이전트 승격 판정

### 공통 판정

현재 7종은 **에이전트가 아니다.** 결정론적 검사기와 selfTest/음성 통제군은 신뢰 가능한 tool의 조건이지, Agent Card·프로토콜·작업 수명주기·권한·자율성이 있는 agent의 증거가 아니다.

장기적으로는 모두 A2A **skill로 노출 가능**하다. 그러나 7개의 독립 agent로 만드는 것은 권하지 않는다. 공통 입력(artifact/commit/URL), 공통 정책, 공통 결과 schema를 가진 **Quality Assurance Agent 1개 + 7 skills**가 운영·보안·발견 측면에서 단순하다. 외부 공개 가치가 낮은 내부 wiring/guard는 내부 tool로 유지할 수 있다.

| 게이트 | A2A skill 승격 | 독립 agent 권고 | 근거와 선행조건 |
|---|---|---|---|
| `gate_ci_wiring` | 조건부 가능 | 아니오 | CI 구성 artifact를 받아 wiring 누락을 판정하는 read-only skill 가능. 저장소 권한·workflow 내부정보 노출을 최소화해야 하며 외부 고객 효용은 낮음. 내부 skill 우선. |
| `improvement_delta` | 가능 | 아니오 | 기준/후보 artifact를 비교하는 비동기 task에 적합. baseline ID·metric version·동일조건·통계/판정 계약이 필수. 자체 점수를 외부 평가로 오인시키지 않아야 함. |
| `report_ch9_render` | 가능 | 아니오 | PDF/HTML artifact를 받아 렌더 결과와 증거 이미지를 반환하는 modality-aware skill에 적합. 악성 HTML sandbox, 크기/시간 제한, 고객 데이터 최소화가 필수. |
| `rules_guard` | 조건부 가능 | 아니오 | 변경 diff와 정책 버전을 받아 위반 후보를 내는 skill 가능. 규칙의 기밀성과 false positive review가 필요하며 자동 수정·merge 권한은 부여하지 않음. |
| `security_posture` | 제한적 가능 | 아니오 | 공개 URL/승인된 artifact에 대한 posture 검사 skill 가능. 공격적 스캔으로 확장하면 권한·scope·대상 소유 검증이 필요. 결과가 보안 인증을 뜻하지 않음을 명시. |
| `touch_target` | 가능 | 아니오 | URL/렌더 artifact와 viewport를 받는 결정론적 접근성 검사 skill에 적합. 브라우저 sandbox와 동일조건 fixture 필요. 단일 gate 결과를 전체 접근성 적합으로 표현 금지. |
| `ux_quality` | 조건부 가능 | 아니오 | 수치화된 규칙 범위는 skill화 가능. 주관 평가나 외부 3차 평가를 대신할 수 없음. metric provenance·동일조건 비교·사람 검토 경계를 출력해야 함. |

### 승격 단계

```text
현재 검사기
  → 순수 함수/CLI 계약 안정화
  → 공통 GateResult schema + artifact hash
  → 내부 Task Service의 tool
  → QA Agent의 private skill
  → OAuth scope/비용/감사/취소 시험
  → 검증된 skill만 Agent Card에 선언
```

### 승격 금지 조건

- selfTest가 없거나 음성 통제군이 실제 판정 경로를 통과하지 않음.
- 입력 artifact의 출처·hash·버전을 확인할 수 없음.
- 실패가 제품 결함인지 게이트 오판인지 구분하는 evidence가 없음.
- 외부 호출자가 임의 URL/저장소를 검사하게 해 SSRF·무단 스캔이 가능함.
- Agent Card에 선언할 안정된 input/output/error/cancel 계약이 없음.

따라서 판정은 “기술적으로 모두 skill 승격 가능, 현재는 전부 agent 아님, 7개 독립 agent화는 불필요”다.

## 9. 의사결정 게이트

### 지금 채택할 것

- 본 문서의 agent-ready 규칙과 A2A 어댑터 원칙.
- Agent Card의 정직 선언 유지.
- 신규 기능마다 task/idempotency/scope/consent/data-minimization/audit 검토.
- 품질 게이트는 당분간 결정론적 검사기로 유지하고 공통 result schema를 강화.

### 지금 하지 않을 것

- `/.well-known/agent-card.json` 공개를 위한 성역 변경.
- 외부 A2A endpoint, OAuth 인프라, partner onboarding 구현.
- capability 또는 skill `implemented` 값을 실제 검증 전에 `true`로 변경.
- 7개 품질 게이트를 이름만 agent로 바꾸는 작업.

### 다음 승인 요청 시 함께 제출할 증거

1. 첫 pilot skill과 고객 효용 가설.
2. 데이터 흐름·동의·보존·삭제 설계.
3. OAuth/파트너/비용/운영 owner.
4. A2A 적합성 및 음성 시험 계획.
5. 성역 변경 diff와 rollback.
6. 외부 실측 성공 기준과 중단 기준.

## 10. 품질·신뢰 표현 경계

- 현재 계산 재현성은 증명된 범위로만 표현한다.
- 재검사 신뢰도는 미증명이다.
- 내용타당도는 진행 중이다.
- 구성·예측타당도는 미증명이다.
- A2A 도입이나 품질 게이트의 agent 승격은 위 상태를 바꾸지 않는다.
- 3차 외부 재평가 90점 이상은 목표이며 아직 결과가 아니다. A2A 문서 자체가 ⑤축 점수 향상을 보장하지 않는다.

---

### 최종 권고

Phase 0을 채택하고 구현은 보류한다. 이후 기능을 “UI 안의 Firebase 호출”로 추가하지 말고 versioned Application Task Service 뒤에 두는 것이 미래를 막지 않는 핵심이다. 외부 공개는 Phase 2에서 한 파트너·한 저위험 skill로 시작하며, 정식 Agent Card 경로와 성역 변경은 그때 별도 승인을 받는다.
