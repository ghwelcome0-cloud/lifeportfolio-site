# KB-02 가림(redaction) 파이프라인 플레이북 — PDF에서 회사·사람 정보를 지우고 누출 0을 증명하는 법

실전: E2 샘플 10건(2026-10-12). 도구 `docs/q90-public/tools/redact-sample.py`, 결과는 시트 `rows[].redaction`.

## ① 확인된 것
- **최종 산출물은 그림 PDF(200dpi)**. 텍스트 레이어·메타데이터·숨은 구조(링크·북마크·첨부·폼·JS 등 7종)를 전부 0으로. 이유: 텍스트 레이어가 남으면 가린 박스 아래 글자가 복사된다.
- **가림어 목록 3층**: 명부 전체 문자열(회사·제품·URL 호스트) + 행별 `--extra`(샘플 속 가명·저자·전화·주소) + 모델명 ALLOWLIST(남겨도 되는 일반 명사: disc·mbti·strong·via·hexaco·enneagram…).
  - **ALLOWLIST에 사람·회사 유래 단어를 넣으면 안 된다**(hogan·birkman·kolbe·cliftonstrengths는 창업자 성씨/회사명 → G04에서 'Hogan' 18쪽 전부 잔존, G17 ⑩). 누출 검사 목록은 ALLOWLIST와 **분리**(`check_terms`), ALLOWLIST 적중은 `allow_hits`로 따로 보고.
- **자동 검사 2겹(텍스트+OCR kor+eng)이 모두 0이어도 시각 확인 없이 통과시키지 않는다**(⑩의 실측 교훈). 시각 확인은 contact sheet 전체 + 의심 쪽 확대. 확인 주체가 AI면 "AI 시각 확인"이라고 적는다(사람 아님, ⑪ 정정).
- 패킷 빌더는 `status==='redacted' && visual_check.passed===true`인 행만 포함한다.
- **전화번호·절단 조각**은 자동 검사가 못 잡는다. 10번째 샘플(G15b)에서 `1.866.727.2884`와 "Standar"(Standard SDS의 절단)가 1차 통과 후 시각 확인에서 발견 → 변형 6개를 extra로. 패턴: 번호는 `.`/`-` 변형, 상품명은 **절단형(앞 6자)** 도 넣는다.
- 부수 효과 허용 범위: 일반 단어 안의 짧은 토큰(comPARing, prePARed)이 가려지는 것은 **식별 정보가 아니므로 허용**, 단 시각 확인 기록에 "가독성 소손 n곳"으로 적는다.
- 170dpi vs 200dpi: 마스크 픽셀 비교 동일, 그러나 judge의 소문자 10pt 오독은 200dpi에서 사라짐.

- **(2026-10-12 G08·K02) 눈 확인 체크리스트 — 자동 2겹이 못 잡는 것 6가지:** ① 인물 이름(John 138회 — 성·이름 따로, 소유격 `'s`) ② 창업자·저자명(바닥글 "originated by Andi and Andy Lothian") ③ 본사 주소·전화·이메일 쪽 ④ 회사 고유 도표(72유형 원형·색 역학 — **모양만으로 회사가 드러나면 쪽 통째 가림**) ⑤ 표지 안내문 글자가 읽히는가(T9 `?? ??`) ⑥ 가림 뒤 **내용이 남아 있는가**(T10 빈 회색 쪽이 "누출 0"으로 통과함).
- **`--boxes` 쪽 번호는 1부터**(T8). 좌표는 OCR tsv(`tesseract … tsv`)에서 계산하고 눈대중 금지(T11: 상자 x0 눈대중 → "비회원님은" 앞부분 노출). 상자 주변은 150dpi로 다시 본다.
- **E2-d 문서도판은 `--keep-images`**(샘플이 이미지라 기본 "이미지 전부 제거"가 내용을 지움). 가림은 `--boxes`, 검증은 OCR 겹.
- **공식 샘플 찾기 절차(G08 성공):** ① `site:<회사도메인> sample report filetype:pdf` ② 회사 소유 서브도메인·CDN(`sample.insights.com` 류) ③ 공식 안내서·활용안내서(국내 공공은 KRIVET 저장소 `krivet.re.kr/repository`) 안의 "결과표" 쪽 → 임베디드 이미지를 **원본 해상도로 추출**(`page.get_images` → `extract_image`), 썸네일(≤300px)은 판독 불가로 세지 않음 ④ 제3자 미러(대학·코치 사이트)는 §21 출처 규칙상 **미채택**(G06 Birkman 사례). 국내 사이트가 US 접속에서 403이면 브라우저 UA+Referer 헤더로 재시도(KRIVET 실측 403→200).
- **집계→시트 전사는 `tools/e2-finalize.py`**(인라인 스크립트 금지). 표 꼬리표는 build-table `e2tag()`가 `e2_alt.path`로 자동 부여: (샘플)/(문서도판·부분 n/m)/(응시)/(구매).

## ② 아직 모르는 것
- 한국어 샘플에서 OCR(kor)의 누출 탐지 재현율 — K05·K17·K03 3건은 0건이었으나 표본 적음.
- 로고(그림)로만 들어간 회사 표식 — `images_removed:true`로 전부 제거 중이지만, 벡터 로고가 텍스트도 그림도 아닌 경로(path)로 있으면 남을 수 있다(추정). 시각 확인이 유일한 방어.

## ③ 도구·파일
- `python3 tools/redact-sample.py <e2.json> <roster.json> <id> <in.pdf> <outDir> [--extra "a|b|c"] [--boxes "page:x0,y0,x1,y1"]`
- 산출: `<blind>.img.pdf`(최종), `<blind>.img.contact.png`(시각 확인용), 시트 `redaction{items_found, leak_check, hidden_structure, visual_check}`
- 배치 예: `/home/user/work/redact-7.sh`(9건 extra 목록 — 다음 회차 재사용 가치 높음)
- 원본 샘플은 저장소 밖 `/home/user/work/e2-samples/` → AI Drive tar

## ④ 실수 장부(이 영역)
⑩ ALLOWLIST에 회사 유래 단어 + 검사 목록 공유 · ⑪ "사람 눈 확인"이라고 불렀으나 AI가 함 → 명칭 정정.

## ④-b 실수 장부 추가(2026-10-12 밤)
- T8 --boxes 0/1 기준 · T9 표지 한글 `??` · T10 문서도판 내용 삭제 · T11 상자 좌표 눈대중 → 전부 defect-ledger.md 참조. 공통 뿌리: **눈 확인을 '회색이 보이면 통과'로 함** → 체크리스트 6항목으로 교체.

## ⑤ 바로 시작하는 명령
```bash
cd docs/q90-public
node tools/fetch-sample.cjs sheets/e3-docs.json <ID> "<official pdf url>" /home/user/work/e2-samples "<출처 메모>"
# 시트 rows[ID].sample_url/sample_sha256/status=ready 기록 후
python3 tools/redact-sample.py sheets/e2-samples.json roster/roster-v2.json <ID> /home/user/work/e2-samples/<ID>.pdf /home/user/work/e2-packets --extra "가명|저자|전화 변형|상품명 절단형"
# contact.png 열어 시각 확인 → 시트 redaction.visual_check 기록(passed, by, findings) → status=redacted
node tools/build-packet.cjs sheets/e2-samples.json rubric/rubric-v2.json /home/user/work/e2-packets /home/user/work/e2-judge-packets roster/roster-v2.json
```
주의: build-packet은 `packet_order`를 **이번에 만든 것만으로 덮어쓴다** → 2회차부터는 실행 전 시트 백업, 실행 후 `packet_order`에 이전 목록을 합쳐 복구(2026-10-12 실측).

```bash
# E2-d 문서도판(이미지 샘플) 전용
python3 tools/redact-sample.py sheets/e2-samples.json roster/roster-v2.json <ID> <in.pdf> /home/user/work/e2-packets --extra "회사명|사이트|호칭(비회원)" --cover 1 --keep-images --bands 0,0 --boxes "<1-기준 쪽>:x0,y0,x1,y1"
# 집계 → 시트 전사(레벨은 여기서 처음 봄)
python3 tools/e2-aggregate.py sheets/e2-samples.json /home/user/work/e2-judge-packets/answers /home/user/work/e2-agg-rN.json
python3 tools/e2-finalize.py sheets/e2-samples.json /home/user/work/e2-agg-rN.json <blind_id>
```
