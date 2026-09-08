# R - Privacy action plan + statute currency re-verification

- Order: R (task #48), agent = legal counsel
- Collected: 2026-09-08
- **NO ATTACHMENT.** This reply arrived as 3 body messages (15192 chars total).
  An attachment-only sweep would have lost this entire deliverable.
  This is the third occurrence of the failure mode recorded as lesson 3 of incident 17
  (orders J, L, N previously submitted body-only).
- Preserved verbatim below, in message order, with no editing by me.

---

## Body message 1/3  (comet_message_id=3805554, ts=2026-09-08T05:18:27+00:00, 6524 chars)

**2026-09-08 기준 정본 조사 결과**

이 자료는 법률자문이 아니라 변호사 검토용 현행성 조사입니다. 조사 기준은 국가법령정보센터의 시행일 지정 판본, 대한민국 법원 판결문, 국립전파연구원 고시·표준자료입니다.

## 1. 개인정보 보호법

**기준일 현행 판본:** `[시행 2025. 10. 2.] [법률 제20897호, 2025. 4. 1., 일부개정]`

정본: https://www.law.go.kr/LSW/lsInfoP.do?lsId=011357

**중요한 판본 구분**

- `[시행 2026. 9. 11.] [법률 제21445호, 2026. 3. 10.]`는 2026-09-08 현재 **미시행 미래법**이다. 9월 8일 현행으로 인용하면 틀린다. 해당 개정은 대표자 최종책임, CPO 권한, 일정 규모 개인정보처리자의 인증 의무, 유출 가능성 통지, 중대·반복 위반 과징금 강화 등이 중심이다.
- 2026-09-08 공포된 `[시행 2027. 3. 9.] [법률 제21910호]`도 미래법이다.
- 연혁·개정이유 정본: https://www.law.go.kr/LSW/lsRvsRsnListP.do?lsId=011357&chrClsCd=010202&lsRvsGubun=all

**현행 조문과 서비스 관련성**

| 조문 | 9/8 현행 내용·판정 |
|---|---|
| 제15조 | 수집·이용의 법적 근거. 동의 시 목적, 항목, 보유기간, 거부권·불이익 고지. 계약 이행에 필요한 처리는 제1항 제4호 가능. |
| 제16조 | 목적에 필요한 최소수집, 최소성 입증책임은 처리자. 선택정보 거부를 이유로 서비스 거부 금지. |
| 제17조 | 제3자 제공의 근거와 별도 고지사항. 단순 처리위탁과 구분 필요. |
| 제18·19조 | 목적 외 이용·제공과 제공받은 자의 재이용 제한. 응답·체크인의 모델개선/B2B 분석 재사용은 최초 목적과 별도 검토 필요. |
| 제20조 | 정보주체 아닌 곳에서 수집한 경우 출처·목적·정지/철회권 통지. |
| 제21조 | 목적 달성·보유기간 경과 시 지체 없이 복구 불가능하게 파기, 법정보존 시 분리 보관. |
| 제22조 | 동의사항을 구분하여 명확히 고지·동의. 선택동의 거부로 서비스 거절 금지. |
| 제23조 | 건강, 사상·신념 등 민감정보는 다른 개인정보 동의와 **별도 동의** 또는 법령 근거 필요. 자유서술·진단응답은 실제 내용에 따라 민감정보가 될 수 있음. |
| 제24조 | 여권번호·운전면허번호·외국인등록번호 등 고유식별정보 제한. 주민등록번호는 제24조의2의 더 엄격한 별도 제한. |
| 제26조 | 처리위탁은 목적 외 처리 금지, 안전조치 등 문서화, 위탁 공개, 수탁자 감독 및 재위탁 동의 체계가 핵심. Firebase/클라우드 역할을 실제 계약·데이터 흐름으로 분류해야 함. |
| 제28조의8 | 국외 제공·처리위탁·보관의 허용 근거, 고지·동의 또는 법정 대체근거, 보호조치. 해외 리전·지원 접근까지 사실확인 필요. |
| 제29조 | 내부관리계획, 접속기록, 접근통제, 암호화 등 기술적·관리적·물리적 안전조치 의무. |
| 제30조 | 처리 목적·항목·기간, 제3자 제공, 파기, 권리행사, 안전조치, 책임자, 자동수집장치, 국외이전 등을 실제 처리와 맞춰 처리방침에 공개. |

제15~24조 정본 묶음: https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=900078586&lsId=011357&chrClsCd=010202&print=print

제26조 정본: https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=900079061&lsId=011357&chrClsCd=010202&print=print

## 2. PIPA 시행령·안전성 확보

- 현행 시행령: `[시행 2026. 8. 20.] [대통령령 제36121호, 2026. 2. 19., 일부개정]`
- 제30조는 내부관리계획, 권한 부여·변경·말소와 인증, 침입 탐지·차단, 암호화 저장·전송, 접속기록 저장·점검·안전보관, 악성프로그램 방지, 물리조치를 요구한다.
- 시행령 정본: https://www.law.go.kr/LSW/lsInfoP.do?lsId=011468&ancYnChk=0
- 제30조 정본: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lspttninfSeq=66999&chrClsCd=010202
- 세부 고시는 `[시행 2026. 7. 1.] 개인정보보호위원회고시 제2026-9호`가 9/8 현행이다. 2025-9호를 최신으로 인용하면 안 된다.
- 고시 정본: https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281400&chrClsCd=010201

## 3. 장애인차별금지법상 정당한 편의

- 법 현행: `[시행 2025. 11. 11.] [법률 제21115호]`
- 정본: https://www.law.go.kr/LSW/lsInfoP.do?lsId=010420&ancYnChk=0
- 핵심은 제4조 제1항 제2호 간접차별, 제3호 정당한 편의 거부, 제4조 제3항 정당한 사유, 제20조 정보접근 차별금지, 제21조 동등한 접근·이용을 위한 필요한 수단이다.
- 시행령 현행: `[시행 2026. 1. 22.] [대통령령 제36005호]`; 제14조 제2항 제1호는 신체적·기술적 여건과 관계없이 원하는 서비스를 이용할 수 있도록 접근성이 보장되는 웹사이트를 규정한다.
- 시행령 정본: https://www.law.go.kr/LSW/lsInfoP.do?lsId=010745&ancYnChk=0
- 법인 운영 웹서비스에는 명확히 문제될 수 있다. 개인사업자까지 동일 범위라는 단정은 운영자 지위·업종 사실 없이 불가하다. 과도한 부담 등 정당한 사유는 개별 판단이고 사업자가 입증한다.

## 4. 디지털포용법 제21조·시행령

- 법: `[시행 2026. 1. 22.] [법률 제20672호, 2025. 1. 21., 제정]`
- 제21조는 지능정보서비스·제품 접근성 품질인증 및 인증기관 지정의 근거다. 제22조는 인증 신청·표시 및 미인증자의 유사표시 금지를 규정한다.
- 정본: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=268533
- 시행령: `[시행 2026. 1. 22.] [대통령령 제36005호, 2025. 12. 31., 제정]`; 제17~19조 인증기관, 제20조 인증 신청·기술심사, 제21조 유효기간 1년, 제22조 수수료, 제23조 표시·홍보를 규정한다.
- 시행령 정본: https://www.law.go.kr/lsInfoP.do?lsiSeq=282439
- **이관:** 2026-01-22부터 구 「지능정보화 기본법」 제47·48조를 현행 품질인증 근거로 쓰지 말고 디지털포용법 제21·22조를 써야 한다. 인증 신청 자체는 일반 민간 웹서비스의 일률적 의무가 아니며, 실질적 접근성 의무와 인증 취득은 별개다.

## 5. 정보통신망법

- 현행: `[시행 2026. 7. 7.] [법률 제21305호, 2026. 1. 6., 일부개정]`
- 정본: https://www.law.go.kr/LSW/lsInfoP.do?lsId=000030&ancYnChk=0
- **개인정보 수집·이용·제공·위탁·국외이전·처리방침에 관한 이 서비스의 주된 근거 조문은 현행 정보통신망법에 없다.** 관련 규정은 2020-08-05 PIPA로 일원화되었고, 2023 개정에서 온라인 사업자 특례도 일반규정으로 정비됐다.
- 다만 정보통신서비스 제공자라면 망 안정성·정보보호 관련 제45조 이하, 불법접속·침해행위 금지 제48조, 광고성 정보 전송 시 제50조 등은 행위에 따라 별도 적용될 수 있다. 본 서비스에 광고성 발송이나 법정 규모의 정보보호 의무가 실제 발생하는지는 이용자 수·매출·발송 방식이 없어 **확인 불가**다.

## 6. 전자상거래법: 유료 디지털 웹서비스

- 법 현행: `[시행 2026. 7. 21.] [법률 제21312호, 2026. 1. 20., 일부개정]`
- 정본: https://www.law.go.kr/lsInfoP.do?lsId=009318&ancYnChk=0
- 제13조: 사업자 신원, 상품·서비스 내용, 가격·지급, 공급방법·시기, 청약철회 기한·방법·효과, 환불, 기술사항, 분쟁처리, 약관 등을 계약 전 표시·고지하고 계약서면을 교부해야 한다. 정기결제 증액·무료 후 유료전환은 사전 동의·해지정보 고지가 추가된다.
- 제13조 정본: https://www.law.go.kr/LSW/lsSideInfoP.do?lsiSeq=282793&joNo=0013&joBrNo=00&docCls=jo&urlMode=lsScJoRltInfoR
- 제17조: 원칙적으로 서면 수령 또는 공급 개시일부터 7일. 용역·디지털콘텐츠 제공이 개시되면 제한될 수 있으나, 가분적 계약의 미개시 부분은 철회 가능하다. 사업자는 철회 불가를 명확히 표시하고, 디지털콘텐츠는 시행령 제21조의2에 따른 시험사용 상품 등도 함께 제공해야 한다. 단순 체크박스만으로 이 요건을 대체한다고 단정할 수 없다. 표시·광고 또는 계약과 다르면 공급일부터 3개월, 안 날부터 30일 내 철회 가능하다.
- 제18조: 디지털콘텐츠 철회 시 철회일부터 3영업일 내 환급.
- 제17·18조 정본: https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=009318&lsJoLnkSeq=1000527255&print=print
- 시행령 현행: `[시행 2026. 7. 21.] [대통령령 제36507호]`; 제21조의2는 일부 이용 허용, 한시 이용, 체험용 콘텐츠, 정보 제공 중 하나 이상을 규정한다.
- 시행령 정본: https://www.law.go.kr/lsInfoP.do?lsId=009338&ancYnChk=0
- 생성 리포트·21일 서비스가 법정 `디지털콘텐츠`, `용역`, 또는 혼합계약 중 무엇인지와 가분성은 실제 판매·공급 구조를 보아야 하므로 **확인 불가**다.

## 7. 대법원 2026. 3. 12. 선고 2023다255130

**실재 확인.** 사건명 손해배상(기), 상고와 부대상고 모두 기각.

- 국가법령정보센터 판결 전문: https://www.law.go.kr/LSW/precInfoP.do?mode=0&precSeq=618507
- 대한민국 법원 판례속보: https://www.scourt.go.kr/portal/news/NewsViewAction.work?seqnum=10971&gubun=4&searchOption=&searchWord=

정확한 요지:

- 온라인 쇼핑몰이 텍스트 아닌 콘텐츠에 의미·용도를 인식할 수 있는 적절하고 충분한 대체텍스트를 제공하지 않은 것은 제20조 제1항의 간접차별이자 제21조 제1항의 정당한 편의 제공 거부에 해당한다.
- 판매자가 만든 상품정보도 플랫폼이 불특정 다수에게 전달하면 플랫폼의 `배포`로 볼 수 있다.
- 일정한 비용이 든다는 사정만으로 과도한 부담·현저한 곤란을 쉽게 인정하지 않는다.
- 원심의 `확정일부터 6개월 이내 대체텍스트 제공`은 행정상 시정명령이 아니라 제48조 제2항의 **적극적 조치 판결**이다.
- 위자료는 피고가 고의·과실 없음을 증명해 기각됐다.
- 판결이 직접 언급한 국가표준은 **KWCAG 2.1**이다. KWCAG 2.2의 33항목 전체를 모든 사기업에 직접 강제한다고 판시한 것은 아니다. 표준·고시는 사기업 웹사이트 접근성 판단의 `일응의 기준`이 될 수 있다는 취지다.

## 8. KWCAG 2.2 최신성

- 표준: `KS X OT0003:2022`, 한국형 웹 콘텐츠 접근성 지침 2.2, 제·개정일 2022-12-28, 4원칙·14지침·33검사항목.
- 국립전파연구원 원문·첨부: https://www.rra.go.kr/ko/reference/kcsList_view.do?nb_seq=5247&nb_type=6
- 국립전파연구원고시 제2025-21호(2025-12-31) 국가표준 적부확인 결과에서 `KS X OT0003 한국형 웹 콘텐츠 접근성 지침 2.2`가 **확인**으로 유지됐다.
- 적부확인 정본 PDF: https://www.rra.go.kr/FileDownSvl?file_type=notice&file_parentseq=6300&file_seq=1
- 따라서 2026-09-08 기준 확인 가능한 최신 국가표준은 `KS X OT0003:2022 / KWCAG 2.2`다. 2026-09-08까지 이를 대체한 2.3 또는 개정판은 정부 정본에서 확인되지 않았다.
- 한계: e나라표준인증의 개별 표준 상세 페이지는 검색 결과에서 안정적으로 확인되지 않았으나, 2025-12-31 국립전파연구원 적부확인 고시로 존속은 정본 확인했다.

**확인 불가 사항**

- 운영주체의 법인/개인사업자 여부, 실제 Firebase 저장 리전·해외 지원 접근 및 계약구조.
- 생성 리포트와 21일 프로그램의 디지털콘텐츠/용역/혼합계약 분류 및 가분성.
- 이용자 수·매출·광고성 발송 방식에 따른 정보통신망법 개별 의무.
- 위 사실이 없으므로 서비스의 최종 적법성이나 면책 여부는 판단하지 않았다.

---

## Body message 2/3  (comet_message_id=3805563, ts=2026-09-08T05:18:47+00:00, 4043 chars)

(1/2) 조사 기준: 현재 체크아웃 `b03e21901e0c1449a14ce092d0c4676d7ccf5401`. 파일은 수정하지 않았고, 기존 미추적 `docs/게이트/`도 건드리지 않았습니다. 아래 “사실”은 저장소 정적 증거이며 콘솔·실배포·계약 체결 상태는 미확인입니다.

**P0 — 즉시 문구 정정 또는 구현 봉쇄**

1. **B2B DPA 체결 주장은 증거와 정면 충돌**
- 공개 주장(사실): `/home/user/repos/lifeportfolio-site/b2b-privacy.html:141-150`은 Google Firebase·Resend·홈택스를 열거하고 “표준 데이터 처리 위탁계약(또는 동등한 약정)을 체결”했다고 단정합니다.
- 반대 내부 증거(사실): `/home/user/repos/lifeportfolio-site/internal/evidence/ropa/registry.v0.1.json:21-24,61-64,101-104,141-145,221-225,301-305,341-345,381-385`는 DPA·재위탁·이전근거를 unknown/pending으로 둡니다. `/home/user/repos/lifeportfolio-site/internal/evidence/ropa/vendor-evidence-checklist.md:14-24,43-49`도 Firebase/Resend 계약 증빙을 미완료로 둡니다.
- 판정: **체결 여부 미확인인데 공개적으로 충족 주장**. 계약 원본/버전/당사자/재위탁/처리국가 확보 전 사실형 문구 유지 금지.

2. **ROPA는 ‘충족’이 아니라 명시적 미승인 초안**
- 사실: `/home/user/repos/lifeportfolio-site/internal/evidence/ropa/README.md:3-9`는 compliance approval artifact가 아니라고 명시합니다. `registry.v0.1.json:2-5`는 `fact_evidence_draft`, 과거 SHA `f728870...`; 각 활동은 `not_approved`입니다(예: `:14-26,294-306,374-386`). 현재 HEAD와 불일치합니다.
- 사실: 스키마도 미승인을 강제합니다(`/home/user/repos/lifeportfolio-site/internal/evidence/ropa/schema.v0.1.json:5-10,18-28`). 테스트는 구조·금칙정보·코드경로만 검사합니다(`/home/user/repos/lifeportfolio-site/scripts/test-ropa-evidence.mjs:14-53,65-87`).
- 판정: ROPA 구조 초안은 있으나 최신성·실증·승인이 없습니다.

3. **동의 UI는 있으나 증명 가능한 consent receipt가 거의 없음**
- 가입: `/home/user/repos/lifeportfolio-site/signup.html:1416-1421,2419-2454`에서 만 14세+약관+방침을 한 체크박스로 묶고 클라이언트에서만 차단합니다. 프로필 필드는 email/displayName/provider/createdAt/lastLogin뿐입니다(`:1954-1988`). 버전·원문/hash·locale·동의시각·거절·서버검증 없음.
- B2B 견적: 분리 UI는 `/home/user/repos/lifeportfolio-site/b2b-quote.html:162-176,263-281`; 서버는 bool만 저장합니다(`/home/user/repos/lifeportfolio-site/functions/_b2b_group_module.js:478-518,549-580`).
- 체크인: `/home/user/repos/lifeportfolio-site/checkin-21.html:661-666,895-923`은 체크 여부를 서버 payload로 보내지 않고, 저장 스키마에도 동의 필드가 없습니다(`/home/user/repos/lifeportfolio-site/functions/index.js:2447-2451,2547-2561`).
- 결제: `/home/user/repos/lifeportfolio-site/product-v2.html:187-203,491-510` 및 `/home/user/repos/lifeportfolio-site/product.html:1606-1614,2205-2231`은 청약철회 체크를 결제 진입 가드로만 씁니다. 주문별 receipt 연결 없음.
- 구현 목표는 이미 `/home/user/repos/lifeportfolio-site/internal/evidence/ropa/data-map-v0.1.md:170-200`에 설계됐지만 런타임이 아닙니다.

4. **76응답·qlog는 직접식별자와 같은 RTDB 사용자 영역에 있고 클라이언트 쓰기 가능**
- 사실: `/home/user/repos/lifeportfolio-site/database.rules.json:181-246`에서 `responses/{uid}` 본인 read/write, 한 세션에 name/email/userAgent(`:205-218`), answers(`:231-235`), qlog 체류시간·수정횟수·시각(`:236-243`)을 둡니다.
- 사실: 방침은 검사 응답을 “선택” 표시(`/home/user/repos/lifeportfolio-site/privacy.html:199-204`)하지만 서비스 핵심 리포트는 응답 기반입니다(`/home/user/repos/lifeportfolio-site/terms.html:204-210,220-223`).
- 판정: 필수/선택 표시와 서비스 조건이 충돌할 가능성이 높고, qlog 별도 목적·최소화·보유·연구 재사용 근거가 없습니다. ROPA도 연구/행동분석 재사용을 금지합니다(`registry.v0.1.json:128-165`).

5. **21일 체크인·채팅은 상세 원문을 저장하지만 보유/삭제가 없음**
- 응답은 이메일·구매일·12문항·revision을 Firestore에 저장(`/home/user/repos/lifeportfolio-site/functions/index.js:1611-1717`). 채팅은 이메일·session·노드·최대 500자 자유입력을 turn별 저장(`:1763-1891`). 에스컬레이션은 note/free_inputs/예약을 저장하고 Resend로 코치에게 전달합니다(`:1915-2104`). 관리자 API는 이메일로 preorder·응답·채팅을 결합해 최대 500턴 반환(`:2709-2806`), 내부 메모는 4,000자입니다(`:2811-2836`).
- Firestore Rules의 클라이언트 완전 차단은 긍정적입니다(`/home/user/repos/lifeportfolio-site/firestore.rules:140-172`).
- 공백: 90일 TTL/purge 없음. TTL 언급은 CSP/rate-limit뿐입니다(`firestore.rules:273-300`). URL에 email·구매일·HMAC이 존재합니다(`/home/user/repos/lifeportfolio-site/checkin-21-form.html:193-217,328-336`; `functions/index.js:1558-1567,1725-1734`). history/referrer/analytics 노출 위험이 있습니다.

6. **ask 로그 공개 문구와 구현 불일치**
- 공개 주장: `/home/user/repos/lifeportfolio-site/privacy.html:316-324`는 원문 익명 수집, UID 마스킹, IP/UA 미수집, 90일 삭제를 말합니다.
- 코드: `/home/user/repos/lifeportfolio-site/assets/js/ask-widget.js:443-477`은 입력을 메모리 `CHAT_THREAD`에만 두고 `ask_submit`에는 visitor_state와 글자수만 보냅니다(`:451`). ask-log DB writer/purge는 발견되지 않았습니다.
- 판정: 현재 코드상 원문 서버수집 주장은 과장입니다. 다만 GTM 라이브 컨테이너/실배포가 별도 캡처하는지는 미확인이므로 “수집 안 함”도 확정 금지입니다.

---

## Body message 3/3  (comet_message_id=3805579, ts=2026-09-08T05:19:05+00:00, 4625 chars)

(2/2) **P0 계속 — analytics**

7. **GA/GTM은 동의 전 자동 로드되는 경로가 다수**
- 홈은 idle/상호작용/4초 후 GTM+direct GA를 로드합니다(`/home/user/repos/lifeportfolio-site/index.html:92-133`); B2B도 idle/상호작용 후 로드(`/home/user/repos/lifeportfolio-site/b2b.html:172-200`); 로그인·가입·설문·리포트 등은 즉시 direct gtag+GTM 구조입니다(예: `/home/user/repos/lifeportfolio-site/signup.html:70-87`, `/home/user/repos/lifeportfolio-site/suvey.html:77-88`). Consent Mode default-denied는 없습니다.
- analytics helper는 URL UTM과 referrer를 sessionStorage에 저장하고 이벤트에 붙입니다(`/home/user/repos/lifeportfolio-site/assets/js/analytics.js:26-68,92-173`).
- Clarity만 localStorage 동의+project ID 이중 게이트입니다(`/home/user/repos/lifeportfolio-site/index.html:138-160`). 반면 방침은 분류별 선택과 GA 익명 통계를 말합니다(`/home/user/repos/lifeportfolio-site/privacy.html:272-292`). 실제 GA 동의 UI/철회 제어는 확인되지 않았습니다.

**P1 — 삭제·접근권한·공개문구 정합화**

8. **탈퇴는 부분 삭제이며 ‘모든 데이터/완전 파기’ 약속을 충족하지 못함**
- 공개 문구: `/home/user/repos/lifeportfolio-site/privacy.html:214,252-270,300-305`는 개별 즉시 삭제, 탈퇴 즉시 처리/30일 내 완전 파기, 처리 즉시 중단을 함께 말해 상호 모순됩니다.
- 구현: 클라이언트가 결제를 `payments_anonymized`로 복사하고 5년 timestamp 생성(`/home/user/repos/lifeportfolio-site/mypage.html:2491-2513`), UID 조각·통계·anonPayId를 30일 로그로 남긴 뒤(`:2515-2534`), RTDB reports/users/programs/responses와 Auth만 삭제합니다(`:2536-2563`). Firestore check-in/B2B link/code/lead/inquiry/privacy notice log, Resend, Cloud Logs, 백업은 제외됩니다.
- 심각한 충돌: RTDB 루트 default deny와 `$other` deny(`/home/user/repos/lifeportfolio-site/database.rules.json:2-4,415-418`) 아래 `payments_anonymized`·`withdrawn_logs` 허용 규칙이 없습니다. 따라서 브라우저 쓰기는 배포 규칙이 동일하다면 거부될 가능성이 높습니다. scheduler는 Admin SDK로 두 노드만 파기합니다(`/home/user/repos/lifeportfolio-site/functions/index.js:819-893`).

9. **B2B 보안 주장이 과도함**
- 주장: “모든 쓰기는 서버 함수 경유”, “MFA 적용”(`/home/user/repos/lifeportfolio-site/b2b-privacy.html:154-167`).
- 반증: RTDB users/responses/reports/programs는 본인 client write 허용(`/home/user/repos/lifeportfolio-site/database.rules.json:6-10,181-184,249-252,304-307`). Firestore B2B/check-in 쓰기만 서버 전용입니다. MFA 증거는 이 문구 외 발견되지 않았습니다.
- 접근권 사실: B2B 주문은 담당자 또는 admin read, 코드는 admin read, 사용자 link는 본인 read(`/home/user/repos/lifeportfolio-site/firestore.rules:249-270`). admin은 custom claim이며 bootstrap 이메일 allowlist가 코드에 있습니다(`/home/user/repos/lifeportfolio-site/functions/_b2b_group_module.js:1911-1995`). IAM/콘솔 역할과 MFA는 미확인입니다.

10. **B2B 개인결과 이용 문구 충돌**
- `/home/user/repos/lifeportfolio-site/b2b-terms.html:136-149`은 고객사에 개인 결과를 제공하지 않는다고 하면서 다음 조항에서 고객사가 결과물을 HR·코칭에 활용할 수 있다고 합니다. `:170-175`는 인사결정 책임을 고객사에 전가합니다.
- 사실: 현재 Rules에서 조직 담당자에게 참여자 RTDB answers/report를 여는 규칙은 발견되지 않았습니다. 다만 계약은 오프라인 공유/HR 사용을 허용하는 인상을 줍니다.

**핵심 설정 위치**
- `/home/user/repos/lifeportfolio-site/firestore.rules:25-33,89-172,249-302`: default deny, 체크인/B2B 서버 전용, admin/본인 read. 요청한 302행 주변은 파일 끝이며 `csp_reports`, counters, rate_limits만 명시 deny입니다. `privacy_notice_log` 등은 default deny에 의존합니다.
- `/home/user/repos/lifeportfolio-site/database.rules.json:1-10,84-133,181-246,249-350,353-418`: RTDB 권한·스키마. `payments/{uid}`는 paid가 이미 true가 아니면 본인 write 가능(`:84-92`), responses/reports/programs도 본인 write 가능.
- `/home/user/repos/lifeportfolio-site/firebase.json:1-32,33-168,440-568,658-681`: public/admin 별도 Hosting, 보안 헤더, RTDB/Firestore rules 연결, Functions Node 22. 핵심 CSP만 enforce하고 긴 allowlist는 Report-Only입니다.
- CI 공개 배포는 Hosting만 수행(`/home/user/repos/lifeportfolio-site/.github/workflows/firebase-hosting-live.yml:105-114`; admin도 hosting:admin만 `/home/user/repos/lifeportfolio-site/.github/workflows/firebase-admin-live.yml:94-102`). 따라서 repo Rules/Functions가 운영에 배포됐다는 증거는 아닙니다.
- Functions 전역 리전/Secret Manager: `/home/user/repos/lifeportfolio-site/functions/index.js:30-69`; 주요 개인정보 함수는 체크인 `:1611-2836`, privacy notice `:3705-3881`, 결제/후기/admin `:3929-4660`; B2B는 `/home/user/repos/lifeportfolio-site/functions/_b2b_group_module.js:469-1995`.

**실행 순서**
1. 공개 문구 동결/정정: DPA 체결, MFA, 모든 쓰기 서버 경유, ask 원문 익명수집·90일 삭제, GA 익명/선택 가능, 완전·즉시 삭제, Firebase 국가/리전 단정.
2. 10개 ROPA 활동을 현재 HEAD로 재검증하고 실제 콘솔·계약 증거를 붙이되 승인 전 `not_approved` 유지.
3. 목적별 서버 consent ledger 구현: 가입/연령, B2B 담당자·참여자, 체크인, 분석, 결제/환불/제공개시를 분리해 accept+decline, 정확 문구/hash/version/locale/server time 저장.
4. 체크인 URL을 1회용 opaque token으로 바꾸고 90일 TTL/purge 및 vendor/email 삭제 receipt 추가.
5. 탈퇴를 서버 orchestration으로 옮겨 Auth+RTDB+Firestore+Resend/log/backup 결과 receipt 기록; 법정보존/hold 분리.
6. GA/GTM default-denied Consent Mode, query/referrer redaction, direct gtag 중복 제거, live container·retention·export 증빙.
7. B2B를 “개인 결과 조직 비공개·HR/채용/평가 금지”로 단일화하고 Rules/Callable/admin export E2E로 입증.

최종 판정: **추가 검토/시정 필요**. 우선 차단 대상은 근거 없는 DPA·MFA·완전삭제 주장과 동의 없는 GA/GTM 로드이고, 우선 구현 대상은 서버 권위 동의·삭제 receipt와 21일 데이터 TTL입니다.

