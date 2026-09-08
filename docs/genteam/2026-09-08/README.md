# GenTeam 2차 동시 발주 (Q~V, 6건) — 2026-09-08

대표님 승인(9건) 직후 착수. 승인 항목을 **실행 설계로 전환**하는 발주다.

## 발주 대장

| 발주 | 담당 | task | 주제 | 상태 |
|---|---|---:|---|---|
| Q | 접근성·브라우저 E2E QA | 49 | Living Book 2행 toolbar 실장 설계 | **collected** |
| R | 법률 고문 | 48 | 개인정보 10건 실행계획 + 법령 현행성 전수 재검증 | **collected (body-only, 3 msgs)** |
| S | GTM 리드 | 52 | 판매 문구 vs 계약 범위 — 문구 축소안 | **collected** |
| T | 코드 리뷰어 | **51** | 게이트 잔여 결함 (a)~(f) 수정 설계 | **collected (body-only, self-rebuttal)** |
| U | 리서치 엔지니어 | 51 | INP/p75 기존 GA4 경로 실증 검증 절차 | **collected** |
| **V** | 피어 리뷰어 | 47 | **①-H 기준선 + 의뢰서 §5 개정안** | **회신 수거 완료** |

## 발주 절차에서 배운 것 (수거 규약 보강)

`docs/genteam/2026-08-31/README.md` 의 4단계 규약은 유효하다. 여기에 2건을 더한다.

### 함정 6 — `--yes` 는 없다. `--skip_confirmation true` 다
`gsk genteam members` 는 `--channel_id` 가 필수이고 `--yes` 를 모른다.
두 단계 확인(two-phase)이라 **동일 명령을 두 번** 보내야 실제로 전송된다.

### 함정 7 — 병렬 전송은 확인 세션이 엉킨다 (실측)
6건을 `&` 로 동시에 두 번씩 보냈더니 **2건만 `ok`, 4건이 `pending_confirmation`** 이었다.
순차로 재발사해 2건 추가 성공, 남은 2건은 재시도 1회로 성공했다.
⇒ **발주문 작성은 병렬로, 전송은 순차로.** 전송 결과의 `data.status` 를 건별로 확인해야 한다.
   `ok` 가 아닌 것을 발사됐다고 착각하면 회신을 기다리다 시간을 버린다.

### 함정 8 — 스레드는 발주 즉시 생기지 않는다
발사 직후 `threads` 를 조회하면 6건 중 1건만 보였다. 스레드는 **에이전트가 착수할 때** 생긴다.
3분 뒤 재조회에서 6/6 확인. `total 49 → 54`.
⇒ 스레드가 안 보이는 것은 발주 실패가 아니다. 발주 실패 판정은 전송 응답으로 한다.

### 함정 9 — `root_comet_message_id` 는 **문자열**이다
`sorted(key=lambda x: -x['root_comet_message_id'])` 가 `TypeError` 로 죽는다. `int()` 변환 필요.

## 수거 완료 산출물

### V — `V_1H기준선_의뢰서5개정안.md` (20,766 B · 242행 · sha256 6204564b…)
원본 파일명은 `V_①-H기준선_의뢰서§5개정안.md` 였다. 원문자 `①`(U+2460)와 `§` 를
파일명에 두면 교훈 #3(문자 전송 손상)에 노출되므로 저장 시 ASCII 로 바꿨다.
**내용은 무손상이다.**

**★ 이 회신은 대표님 승인 방향을 부분 수정할 것을 요구한다.** 아래 판정 참조.

#### V core verdicts — all quotes are verbatim from the deliverable

(원문 인용만 사용한다. 내가 요약을 손으로 다시 쓰면 문자 손상이 재발하기 때문이다.)

**1. 2-stage separation — the contradiction resolution**

> 가능하면 Part A와 별첨 H를 **서로 다른 외부 평가 세션**으로 운영한다. 같은 사람이 연속 수행하면 홈페이지에서 본 표현이 텍스트 채점에 스며드는 순서효과가 생긴다. 동일 평가자가 불가피하면 반드시 Part A 선제출·잠금 후 별첨 H를 공개한다.

**2. No unanchored 0~100 scoring**

> 따라서 허용 점수는 10점 단위이며, `통과/실패` 증거 없이 숫자만 제출한 결과는 무효다. 정밀해 보이는 임의의 73점보다 반복 가능한 70/80점 판정이 낫다.

**3. Final score = min(PC, mobile)**

> PC와 모바일은 각각 완전한 별도 실행으로 측정한다. 총점은 두 환경 점수의 평균이 아니라 **낮은 환경 점수**로 확정한다. 평균으로 모바일 실패를 숨기는 것을 막기 위함이다.

**4. No causal claim**

> 두 점수의 동반 변동은 상관 관찰일 뿐 인과 증거가 아니다. 인과를 말하려면 다른 변경을 통제한 사전 등록 실험이 별도로 필요하다. 현재 문서에서는 **인과를 주장하지 않는다.**

**5. Partially rebuts the approved direction — NOT a permanent 8th axis**

> **신설은 승인하되, 8번째 핵심 성과축이 아니라 한시적·비가중 진단지표로 운영해야 한다.**

> 기존 7축 가중식 `콘텐츠(①②③④ 평균)×0.60 + ⑤×0.15 + ⑥×0.15 + ⑦×0.10`은 그대로 둔다. 현재 75.42와 목표 90.56도 재계산하지 않는다.

> 즉, 대표 승인 방향은 옳지만 “축을 하나 더 영구 관리한다”로 해석하면 틀리다. 필요한 것은 과거 ①을 오염시키지 않는 **측정 사이드카**이지, 7축 체계의 8축화가 아니다.

**Definition (1.1)**

> `①~⑤ 텍스트 재평가`와 `①-H 홈페이지 평가`는 **한 파일에 함께 안내할 수는 있어도, 서로 다른 평가 도구·제출 단계·증거 묶음으로 분리**해야 한다. 권고 구조는 다음과 같다.

---

#### DECISION REQUIRED (대표님)

V 는 승인 방향을 부분 반박했다. 반박 근거를 3.1 에 쓰고 3.2 에서 자기 반박까지 했으므로
지시 반항이 아니라 전문 판단으로 본다. 그러나 **승인 방향 자체를 바꾸는 사안이므로 내가 재단하지 않는다.**

- (A) 원안대로 `①-H` 를 상시 지표로 운용
- (B) V 판정 수용 — 한시적/비가중 진단 사이드카로 운용, 7축 가중식/75.42/90.56 불변

---

### My own parallel work during this dispatch

1. commit `5ca8021` — fixed the item-count arithmetic in 10 customer-facing locations.
   Truth was established FIRST by measuring `data/questions.json` v2.2 down to `sections`:
   core 56 (declared 56, match) + hasOther 20 (declared 20, match) = 76 (declared 76, match);
   the 2 meta items sit outside the 76.

2. commit `67cd990` — **actually applied** the isMain fix.
   The 2026-08-31 commit message CLAIMED it was fixed, but the diff contained no such change.
   Reproduction: copying the gate under a new filename gave EXIT 0 with 0 bytes of output
   — it still passed silently.
   New rule: **a commit message is not evidence. The diff and the reproduction are evidence.**
   Verify `git diff` carries the change BEFORE claiming a fix.


---

## Collected deliverables (5/6) - 148 KB total

| file | bytes | note |
|---|---:|---|
| `Q_LivingBook_2row_toolbar_실장설계.md` | 21093 | |
| `R_개인정보실행계획_법령현행성재검증.md` | 25293 | |
| `S_판매문구_계약정합_축소안.md` | 31308 | |
| `U_INP_p75_기존경로_실증검증절차.md` | 27492 | |
| `V_1H기준선_의뢰서5개정안.md` | 20766 | |

### R - the heaviest reply of this campaign. NO ATTACHMENT.

R arrived as **3 body messages, 15,192 chars, zero attachments**.
An attachment-only sweep would have lost it entirely. This is the **third** time
(J, L, N before it) - the failure mode from incident 17 lesson 3 keeps recurring.

**R corrected our own verification, in two directions:**

1. Not only stale citations. **Citing a not-yet-effective future statute as current** is the
   mirror-image error, and we were exposed to it:
   > `[시행 2026. 9. 11.] [법률 제21445호, 2026. 3. 10.]`는 2026-09-08 현재 **미시행 미래법**이다. 9월 8일 현행으로 인용하면 틀린다. 해당 개정은 대표자 최종책임, CPO 권한, 일정 규모 개인정보처리자의 인증 의무, 유출 가능성 통지, 중대·반복 위반 과징금 강화 등이 중심이다.

2. Our Supreme Court citation was **over-claimed**:
   > 판결이 직접 언급한 국가표준은 **KWCAG 2.1**이다. KWCAG 2.2의 33항목 전체를 모든 사기업에 직접 강제한다고 판시한 것은 아니다. 표준·고시는 사기업 웹사이트 접근성 판단의 `일응의 기준`이 될 수 있다는 취지다.

   > 위자료는 피고가 고의·과실 없음을 증명해 기각됐다.

**R final verdict:**
> 최종 판정: **추가 검토/시정 필요**. 우선 차단 대상은 근거 없는 DPA·MFA·완전삭제 주장과 동의 없는 GA/GTM 로드이고, 우선 구현 대상은 서버 권위 동의·삭제 receipt와 21일 데이터 TTL입니다.

R located 10 public-claim vs implementation conflicts at file:line granularity.
The three gravest:
- P0-1 DPA: 판정: **체결 여부 미확인인데 공개적으로 충족 주장**. 계약 원본/버전/당사자/재위탁/처리국가 확보 전 사실형 문구 유지 금지.
- P0-7 analytics: 홈은 idle/상호작용/4초 후 GTM+direct GA를 로드합니다(`/home/user/repos/lifeportfolio-site/index.html:92-133`); B2B도 idle/상호작용 후 로드(`/home/user/repos/lifeportfolio-site/b2b.html:172-200`); 로그인·가입·설문·리포트 등은 즉시 direct gtag+GTM 구조입니다(예: `/home/user/repos/lifeportfolio-site/signup.html:70-87`, `/home/user/repos/lifeportfolio-site/suvey.html:77-88`). Consent Mode default-denied는 없습니다.
- P1-8 deletion: 심각한 충돌: RTDB 루트 default deny와 `$other` deny(`/home/user/repos/lifeportfolio-site/database.rules.json:2-4,415-418`) 아래 `payments_anonymized`·`withdrawn_logs` 허용 규칙이 없습니다. 따라서 브라우저 쓰기는 배포 규칙이 동일하다면 거부될 가능성이 높습니다. scheduler

R also states plainly what it could not confirm (operator legal form, Firebase region,
contract classification, traffic-scale duties) and refuses to judge final legality.

**KWCAG 2.2 currency: confirmed still current** as of 2026-09-08
(`KS X OT0003:2022`, upheld by RRA notice 2025-21 dated 2025-12-31; no 2.3 found).


---

## Correction to the order/task mapping (measured, not assumed)

task numbers were NOT assigned in dispatch order. Verified mapping:

| task | thread | deliverable filename (authoritative) |
|---:|---|---|
| 47 | `ch_bf9f230cfb4a826baf559419ffa18367` | `V_...` |
| 48 | `ch_c53c7f3484dbe1f5eb1b57bf68584008` | `R_...` |
| 49 | `ch_7faefc9e05a41dc5449895707063f79d` | `U_...` |
| 50 | `ch_acb47585b0083e7d518abca0562c1072` | `Q_...` |
| 51 | `ch_6ffce88ceea3c0b4d240563adb98d3ce` | `T_...` |
| 52 | `ch_45026642ee8dc1a31bdbbc90a10f9c8d` | `S_...` |

**Rule: trust the attached filename, not the task number.** Task 49 carried the U file and
task 50 carried the Q file. Labelling threads by dispatch order mislabels the deliverables.

## R - attachment arrived LATE, after the body

R first sent 3 body messages, then attached the official file **later** (`3805811:0`, 27,065 B,
sha256 `cc387ecb...`). Both are kept:
- `R_개인정보실행계획_법령현행성재검증.md` (25,293 B) - body reconstruction, collected first
- `R_개인정보실행계획_법령현행성재검증_첨부정본.md` (27,065 B) - **authoritative attachment**

R's own summary of its three corrections:
> (not found)

**Rule: `in_review` does not mean the deliverable has arrived, and a body-only reply may still
gain an attachment minutes later. Re-poll before declaring a collection complete.**

## T - the reply attacks its own design, and the design itself is MISSING

T arrived body-only (3 messages, 15,771 chars) and opens with `## Critical` faulting
`T_게이트잔여결함_수정설계.md` - **a file it never attached.** 30+ numbered defects were raised
against a proposal we do not possess.

Sample of what T faults in its own work:
- 1. (e) Hash probe proves load, not consumption
- 4. (d) `Date(anyArgument)` remains an evasion
- 6. (f) Requiring `quality-axes-gates` still leaves known checks fail-open
- 8. (a) Off-screen content is claimed as detected but passes
- 11. (b) `pages=999` is not rejected by the proposed validator
- 12. (b) The schema breaks the checked-in baseline without a migration
- 15. (c) Process isolation leaves a larger false green intact
- 24. (f) The rollout order can deadlock merges

**BLOCKED - do not implement gate fixes from T yet.** Re-request the design file
`T_게이트잔여결함_수정설계.md` as an attachment. Item 6 and 15 in particular assert that
the fixes we were about to make would leave larger false greens intact - that claim must be
read against the actual proposal before any gate is touched.

