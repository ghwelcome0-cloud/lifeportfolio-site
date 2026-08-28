# 75. 세션 상태 (LIVING STATE) — 2026-08-24

> **이 문서의 지위**: **매 세션 갱신하는 유일한 문서.** 나머지 문서(00 / 71 / 73 / 74)는
> 확정된 것을 보존하므로 추가만 하고 고치지 않는다.
>
> **CEO-72 해답의 핵심**: 대화 요약에는 아래 §1 「4항목」만 남긴다.
> 나머지는 전부 이 문서와 형제 문서를 참조한다.

---

## 1. 다음 세션 시작 시 필요한 4항목

### ① 최신 지시
**CEO-72** — 대화 압축 병목. → **이 세션에서 해결 (외부화 완료)**
그 이전 진행 중 지시: **CEO-70/71** (숏츠 3부작 선행), **CEO-67** (6항목 반려),
**CEO-64/65** (글자 = 문장 패널)

### ② 현재 편집 중인 파일
```
youtube/hybrid3d/pipeline/r3d/mkwords.py       ← ★다음 편집 대상 (교훈 191 처방)★
youtube/hybrid3d/pipeline/r3d/previz_batch.py  ← 편집 완료(6곳), 게이트 실패 중
```
샌드박스 작업 사본: `/home/user/lf/r3d/` (repo 미러와 동일 내용)

### ③ 실패 중인 게이트 (verbatim)
```
$ cd /home/user/lf/r3d && PREVIZ_DRY=1 PREVIZ_JOBSFILE=scenejobs.json python3 -u previz_batch.py
    glyph ink 602-602 px of 1280 (lift)
★GLYPH GATE FAILED J_A3-02: off-frame x 0.60 y 1.01 at frame 66★
```
근본 원인 = **교훈 191** (두 승인 지표가 2글자 단어에서 동시 충족 불가).
처방 = `mkwords.py` 가 「단어」 대신 **「문장」** 을 렌더.

### ④ 다음 1동작
`mkwords.py` 를 문장 렌더로 전환한다.
- 입력: `pipeline/script/SCRIPT_ACT3-8.csv` 의 `on_screen_text` 열
- aspect 게이트 상한 `6.0 → 10.0`
- A8 텍스처 동시 생성 (현재 부재)
- 후속: `words/meta.json` 재생성 → 76잡 드라이런 → **60잡 회귀 확인(안정성 지침)**

---

## 2. 진행 중 작업의 정확한 위치

### 숏폼 C 파이프라인 (CEO-70/71) — STEP 1 에서 막혀 있음

```
STEP 0   3부작 정본 확정                         ✅ 완료
STEP 0b  제작 규칙 3항 확보 + C 잡 매핑           ✅ 완료
STEP 1   글자 = 문장 전환 + 76잡 드라이런 통과     ◀ 현재 위치 (막힘)
STEP 2   J_A3-14~17 프리비즈 렌더 (450 f ≈ 7.5분)
STEP 3   9:16 1080x1920 조립 + 광류 p95>=1.5px + 번인 자막
STEP 4   ★대표님 시청 → 품질 기준 확정★          유료 호출 0건 지점
STEP 5   승인된 프리비즈로 v2v (4잡) → 완성본
STEP 6   ★대표님 시청 → 최종 확정★
STEP 7   파라미터를 코드 상수로 고정 → A·B 설계 + 확대
```

상세 스펙: **`74_SHORTS_TRILOGY_SPEC.md`**

### 미완결 2건 (v2v 전 필수)
- [ ] 새 잡 19개 프롬프트 생성 (`r3d/prompts.py`)
- [ ] A8 글자 텍스처 (`mkwords.py` 전환 시 동시 처리)

### CEO-67 6항목
| # | 반려 | 처방 | 상태 |
|---|---|---|---|
| 1 | 짜깁기 | `previzcut.py` HEAD/HEAD_F 제거 | ☐ |
| 2 | 헤드 소재 폐기 | `act0`/`act12`/`head.mp4` 배제 | ☐ |
| 3 | 500초 해제 | `TOTAL` 하드게이트 제거 | ◐ 길이 확정(349.958s)·코드 미수정 |
| 4 | 영화적 연속성 | chain/cut(38/38)+weld | ◐ 설계 완료·렌더 검증 전 |
| 5 | 동일 모션+씬 부재 | sets+scenemap+scenejobs+previz_batch | ◐ 글자 datum 진행 중 |
| 6 | 자막 저품질 | 시안 네온 ASS | ☐ 과업 P 회신 대기 |

### GenTeam (CEO-63/68)
- [ ] previz 채널 `ch_60f831f6870e4e2fba2c25a214f94566` — 과업 N/O/P 회신 회수
      (3회 폴링 0건) · 과업 L · H1 검토
- [ ] 마케팅 채널 `ch_847d45c3176f45a0a3d856045ee9d23d` — I-1/I-2 · S-1~S-3
      **네이티브 멘션으로 1인 1발주** 재발주
- **M-1 은 총괄이 확정** (회신 부재 확정 — 상세: `74_..._SPEC.md` §9)

### Deferred (착수 금지)
GENTEAM_BRIDGE 개정 · 부록 개정12 · OPEN PR #271 #269 #252 #245 · ② GC 티켓 ·
팀 125장 zip · 로그 반경 · 오픈소스 에셋 임포트(미채택 확정) ·
`J_A4-06~A5-03` 구간(CEO-71 반려) · 숏츠 후보 1~5(다른 롱폼 기반)

---

## 3. 파일 지도 — 무엇이 어디 있는가

### repo 정본 문서 (`docs/marketing/youtube/`)
| 파일 | 담는 것 | 갱신 방식 |
|---|---|---|
| `00_CEO_DIRECTIVES.md` | CEO-1~72 원문 전량 | 새 지시 추가만 |
| `60_YOUTUBE_MARKET_RESEARCH.md` | 시장 조사 | — |
| `61_YOUTUBE_MANUAL.md` | 운영 매뉴얼 | — |
| `70_HYBRID_3D_MOTION_GUIDE.md` | **요청1 = 제작법 교육 (648행, 완료)** | 완료 |
| `71_HYBRID_3D_PRODUCTION_RULES.md` | 교훈 1~192 (2,101행) | 추가만 |
| `72_CREDIT_DISCIPLINE.md` | 크레딧 규율 | — |
| `73_ARTIFACT_LEDGER.md` | artifact URL + 판정 태그 | 추가만 |
| `74_SHORTS_TRILOGY_SPEC.md` | 숏츠 3부작 정본 | 확정 시 갱신 |
| `75_SESSION_STATE.md` | **이 문서 — 매 세션 갱신** | 덮어쓰기 |

### repo 파이프라인 미러 (`youtube/hybrid3d/pipeline/`)
```
r3d/     41 파일  — previz_batch.py mkwords.py scenemap.py scenejobs.py sets.py
                    prompts.py camtab.py v2v.py + jobs.json scenejobs.json
                    camtab.json scenemap.json prompts.json words/meta.json
script/   5 파일  — SCRIPT_ACT1-2.csv SCRIPT_ACT3-8.csv subtitles_500s.srt
                    narration_text.txt
gt/      13 파일  — ★mkt_body.txt mkt3_body.txt = 합의의 정본 (교훈 190)★
work/    80 파일  — previzcut.py master500.py srtwrap.py rows38.json PLAN.md
```
**총 2.5MB.** 원본 = `/home/user/lf/{r3d,_script,gt,work/longform}/`

### 샌드박스 전용 (repo 밖 — 바이너리)
```
/home/user/lf/land12/ = anchors12/   ACT1-2 앵커 12장 (숏폼 A/B 유일 시각 자산)
/home/user/lf/land38/                플레이트 23장 + canvas/S2*_tall.png
/home/user/lf/_pack/ACT1-2_150s/     숏폼 A/B 플레이트 (미탐색)
/home/user/lf/std/std{1,2,3}.png     ★승인 기준 3장★
/home/user/lf/_script/audio/by_act/  ACT별 나레이션 mp3
/home/user/lf/r3d/dav2s.onnx         95MB depth 모델
/home/user/lf/work/                  4.8GB 렌더 산출물
```
⚠ 바이너리는 repo 에 넣지 않는다. 유실 시 재생성 경로:
앵커/플레이트는 `73_ARTIFACT_LEDGER.md` §6/§7 의 URL 에서 재다운로드.

### 재사용 자산
| 자산 | 경로 |
|---|---|
| 음성 클론 | `Ti6X6rs2eexqEt3ExCTr` |
| BGM | `youtube/video1/bgm.mp3` |
| 디자인 모듈 | `youtube/video2/design.py` + fonts |
| 9:16 리프레임 선례 | `youtube/video6/make_shorts.py` (크레딧 0) |
| 제작 표준 | `youtube/PRODUCTION_STANDARD.md` |

---

## 4. 코드 상태 — 게이트 통과 현황

### 통과 (유효)
```
$ python3 -u scenemap.py
  SCENEMAP 76 shots (from 80) · 10 sets · 17 moves
  length 8399 f = 349.958 s · shortest 40 f · longest 265 f
  cuts 38 deliberate, 38 chained · fit 37 exact/14 compressed/25 extended · tightest x0.57
  VARIETY GATE OK max share 9% adjacent repeats 0 · SPEED GATE OK no still/smear

$ python3 -u scenejobs.py
  SCENEJOBS OK 76 jobs 8399 f = 349.958 s
  gestures lift=58 none=10 converge=8 · lens 24-50mm over 12 values
  cam z 1.31-6.53 m · radius 1.05-9.51 m

$ python3 -u sets.py
  SET GATE OK 10 sets 250 objects budget 96/set
```

### 실패 (다음 작업 대상)
```
$ PREVIZ_DRY=1 PREVIZ_JOBSFILE=scenejobs.json python3 -u previz_batch.py
      glyph ink 602-602 px of 1280 (lift)
  ★GLYPH GATE FAILED J_A3-02: off-frame x 0.60 y 1.01 at frame 66★
```
진전: 이전 실패는 `x 0.51 y 1.00 at frame 77` (잉크 435px). 이제 잉크 602px 로
2.9배 확보. y 만 1% 초과. **근본 원인 = 교훈 191.**

`J_A3-02` 실측: set S7 · push_in · lens 40.0 · frames 92 · hold 0.26 · arc 34.0 ·
cam `[2.0913,2.2829,2.009]→[1.1289,0.2712,1.605]` · tgt `[0,-0.46,0.888]→[0,-0.42,0.888]` ·
anchor `[[-0.86,0.1],[0,-0.4],[0.86,0.1]]` · doc_z 0.768

### 회귀 미확인 ⚠ (안정성 지침)
```
$ PREVIZ_JOBSFILE=jobs.json python3 -u previz_batch.py    ← 편집 후 미실행
  직전 세션 결과: DRY OK · 60잡 · glyph ink 304-435 px · 25.3초
```
**`previz_batch.py` 편집 후 반드시 재확인해야 한다.**

---

## 5. previz_batch.py 편집 요약 (교훈 188 구현)

6곳 편집. 글자 크기 datum 을 「종이」 → 「프레임 점유율」로 전환.

| # | 위치 | 내용 |
|---|---|---|
| 1 | `PAPER_FIT` 뒤 | `OCC_MIN 0.42` / `OCC_MAX 0.63` / `OCC_LIFT 0.47` / `OCC_CONV 0.42` / `OCC_K_MIN 0.574` 신설 + 근거 주석 |
| 2 | `plane_half_width` 뒤 | `plane_half_width_occ(dist, occ, ink_share, k)` 신규 (K2 공식) |
| 3 | `ink_share` 대입 뒤 (~L417) | `occ_datum = bool(set_id)` · `occ_target` 샷별 1회 결정 |
| 4 | 프레임 루프 | K2 foreshortening `k_fore = sqrt(1-dot²)` 계산 후 datum 분기 |
| 5 | `t_off` 뒤 | `hw_paper` 클램프를 `if not occ_datum:` 로 격리 (legacy 60잡 보존) |
| 6 | `visible_docs()` | 동일 datum 분기 (converge 게이트가 다른 크기로 판정하지 않도록) |

**핵심 설계**: `set` 필드가 있는 잡(`scenejobs.json` 76개) = 프레임 점유율 datum.
`set` 없는 잡(`jobs.json` 60개) = 종이 클램프 유지 → **이미 렌더된 산출물 재현성 보존.**

미변경 상수 (참조):
```
RES=(1280,720) SAMPLES=4 INK_FRAC=0.34 INK_FRAC_CONV=0.20 MIN_INK_PX=210
PAPER_W=2.70 PAPER_H=2.16 PAPER_FIT=0.88 ALPHA_CUT=0.55 LIFTOFF=1.00
MAX_DIP_M=0.02 DOC_SPAN=2.80 CLUS_VFRAC=0.30 DOC_MIN_FRAC=0.40
SENSOR=36.0 LENS_DEFAULT=34.0 MAX_PITCH=1.15 MIN_PITCH=0.55 PITCH_NEAR=3.0 PITCH_FAR=9.0
DOC_Z_DEFAULT=0.05 CONV_REF=(0.0,-0.30,0.92)
게이트 4종 in-loop: dip(MAX_DIP_M) / off-frame(ex,ey<=1.0) / converge stack sep / ink floor(MIN_INK_PX)
env: PREVIZ_JOBS PREVIZ_JOB PREVIZ_DRY PREVIZ_JOBSFILE
```

---

## 6. GenTeam 산출물 — 구현 대기 (prompts.py / previz_batch.py)

```
M1 TYPOGRAPHY 대체본 (mid 3084214)
   physical cyan-neon lightbox in-scene, panel RGB (20-31,23-41,24-38) opacity ~0.80,
   rim core (190,252,255) always B>=G>R, glyphs (240,240,240) ch-diff <=6,
   glyph_h ~48% of panel_h, stroke 9-16% of glyph_h, panel 42-63% of frame width,
   preserve exact Korean glyphs, anchored to tracked scene geometry with cyan spill.
   NOT flat red text / printed ink / subtitles / UI.

M2 BAN 대체본
   no UI overlays/subtitles/captions/watermarks/logos/menus; the single specified
   physical cyan-neon Korean lightbox is the ONLY permitted designed graphic.

M3 INTENDED-TEXT-ONLY gate
   render exactly that one lightbox, reproduce ONLY the Korean text shown for it in
   @Video1, every Hangul glyph/stroke/order/spacing exact; no other letters, words,
   numbers, labels anywhere in frame.

K1 부분 빌보드
   q=|n0·v|, β=1-smoothstep(cos55°,cos35°,q), n=normalize((1-β)n0+βv)
   롤 금지 up=normalize(Z-(Z·n)n), right=normalize(up×n)

K2 화면 점유율 고정 ★previz_batch.py 에 구현 완료★
   d=||C-P||, FOVx=2atan(sensor/(2·lens)), p∈[0.42,0.63]
   W = 2·p·d·tan(FOVx/2) / max(k,0.574), k=sqrt(1-(right·v)²)
   ★월드 원점 반경 r 이 아니라 실제 거리 d 에 비례시켜야 한다★

K3 글로우 근사 (max_bounces=0)
   수광면 종속 cyan spill decal (z=+0.002m plane, 윤곽 2~3배 확장 feathered alpha,
   Transparent+Emission, 알파 0.18→0, 동일 homography)

H1 (mid 3083030) ★검토 대기★
   z 독립 보간 대신 고도각 보간: φ=atan2(z-tz,r), r=r0*(r1/r0)**e, z=tgt_z+r·tanφ
```

`prompts.py` 현행 `TYPOGRAPHY` 에 `"no plastic or neon glow"` 가 있어 **M1 과 충돌** —
교체 필요.

---

## 7. 환경 · 도구 (실측)

```
CPU 2코어 · RAM 3939MB · GPU 없음 · python 3.13.13 · ffmpeg 7.1.5 · bpy 5.2.0
Pillow · numpy · ImageMagick · 디스크 여유 7.0G (75%)
★EEVEE 불가 (CYCLES CPU only) · yt-dlp 유튜브 불가★

폰트 /usr/share/fonts/truetype/nanum/{NanumGothicBold,NanumGothic,
     NanumBarunGothicBold,NanumBarunGothic,NanumBrush,NanumBarunpenB}.ttf

★Bash 타임아웃 120초 ⇒ setsid nohup … > log 2>&1 < /dev/null &
★python3 -u 필수 (버퍼링 방지)
★각 Bash 호출은 cd <dir> && 로 시작 (cwd 유지 안 됨)
★heredoc 실증됨 · Read 툴 5MB 초과 거부
★프리비즈 렌더 약 1초/프레임 (flat emission primitive, samples=4)
★/home/user/lf 전체 grep = 120초 타임아웃. --include 로 좁히면 0.2초 (600배)
★webapp repo grep: docs/ 전체 3.3초
```

### 측정 방법 신뢰도 위계
| 방법 | 판정 지위 |
|---|---|
| **CEO 의 눈·귀** | **최상위 정본 — 유일한 합격 판정자** |
| CEO 제시 참조 이미지/영상 | 「승인 기준」 정본 |
| 발주 본문 원문 (`gt/*_body.txt`) | 「합의된 것」 정본 · 무료 (교훈 190) |
| 확대 직독 / 픽셀 계측 (PIL·numpy) | 시각 등급 수치화 정본 · 무료 |
| 잡 전수 계측 (산술 스윕) | 설계 모순 정본 · 무료 (교훈 188·191) |
| 게이트 실행 (실패 메시지) | 결함 정본 · 무료 (누적 9건 적발) |
| 코드 집계 / grep / `--help` | 「단조로움」·추측 대체 정본 · 무료 |
| CSV·SRT 대조 (문장↔초) | 타임라인 정합 정본 · 무료 |
| `analyze_media_content` | 참조 기법 규명 정본 · ⚠유료 |
| 산술 진단 | ⚠ 렌더와 모순되면 렌더가 맞다 |

---

## 8. Git 상태

```
브랜치   docs/previz-v2v-article14
직전 커밋 3c0dcc1 (교훈 181~183, 푸시됨)
PR      #285 OPEN — github.com/ghwelcome0-cloud/lifeportfolio-site/pull/285
미추적   ?? mk_report_pages.mjs   ?? shoot_report.mjs   (무접촉)
ruleset  active · squash 전용 · CI 4종 · ⚠ Dependabot 2 (1 high, 1 moderate)
PM 기준  ac533ba44d441113bb276caf1ffa5219511d903f
```

**라이브**: `lifeportfolio.co.kr/` · `/report` · `/program` 전부 200 ·
repo 소스 무접촉 · **재배포 불필요**

---

## 9. 이번 세션 리소스

**유료 호출 0건.** 전부 무료 도구(grep · ls · 직독 · 산술 · 파일 쓰기).

누적 무료 결함/발견 적발: **37건**

---

# 세션 갱신 (CEO-72 이후)

## §1 4항목
1. **최신 지시** — CEO-72: 대화 압축 병목 해소. ⇒ 3층 분리 외부화로 완결(커밋 `e6f59d5` + 본 커밋)
2. **현재 편집 중 파일** — `lf/r3d/previz_batch.py` (교훈 195/196 반영 완료 · 미러 동기화 완료)
3. **실패 중 게이트** — `GLYPH GATE FAILED J_A5-03: stack 1.08m > gap 0.84m at frame 1`
   (A5 = 3줄 텍스처 · 24mm 광각 · **frame 1 = 아직 모이지 않은 정지 구간**
    ⇒ 원인은 converge 목표점이 아니라 **시트 원위치 간격 자체가 평면 높이보다 좁음**.
    n_fit 축소는 이미 구현됨. 남은 것은 **정지 구간에서의 시트 간 초기 간격** 처리.)
4. **다음 1동작** — `J_A5-03` frame 1 의 초기 배치 진단:
   `hh 0.462` 인 A5 평면 2장이 원위치(anchor 간 ~1.0m)에서 이미 겹치는지 계측 →
   ①converge 시작 시 A5 는 1장만 쓰거나 ②A5 텍스처를 2줄로 재조판(aspect 1.808→3.0대)

## §4 게이트 현황
```
mkwords.py            WORD GATE OK   8/8 텍스처 (문장 조판 · 잉크 502~503px)
scenemap.py           OK 76샷 10세트 17무브
scenejobs.py          OK 76잡 8399f = 349.958s
sets.py               SET GATE OK 10세트 250객체
previz_batch.py  jobs.json (60잡 레거시)   ★DRY OK — 회귀 무손상★
previz_batch.py  scenejobs.json (76잡)     ✗ J_A5-03 (1잡 · 75/76 통과)
```
**진전 계보**: J_A3-02 → J_A3-03(교훈195 converge중심) → J_A3-14(교훈195 lift상승) → **J_A5-03**

## §5 이번 세션 편집 목록
- `lf/r3d/previz_batch.py` — `LIFT_VFRAC=0.20` 신설 · `conv_track`/`conv_gap` 신설 ·
  converge 목표점 = 시선점(set 잡만) · lift 상승 = 프레임 비율(set 잡만) ·
  converge 장 수 = 텍스처 기반 `n_fit` · 간격 = `max(CLUS_VFRAC, 2·hh·1.02)`
  ★레거시(set 없음) 경로는 전부 종전 동작 유지 — 회귀 확인됨★
- `docs/.../71_HYBRID_3D_PRODUCTION_RULES.md` — 교훈 195 · 196 추가
- 미러 동기화: `mkwords.py` · `previz_batch.py` · `words/meta.json`

---

# 세션 갱신 — 숏폼 C v5 완성 · 커밋 `05ed025`

## 도달 지점 (한 줄)

**숏폼 C 「연봉만 보면 놓치는 것」이 처음으로 6/6 전 컷 픽셀 검증을 통과해
9:16 25.92초로 조립되고 업로드까지 끝났다.** 게시 여부는 대표님 판정 대기.

## 산출물

- 영상 https://www.genspark.ai/api/files/s/K2vE63H2 — 1080x1920 · 24fps · 622f · 25.92s
- 콘택트 시트 https://www.genspark.ai/api/files/s/wLOrOXNV — 6컷 p50
- 로컬 원본 `/home/user/lf/work/longform/_c916/shortsC_916.mp4`
- 컷 원본 `/home/user/lf/r3d/_batch/J_A3-13.mp4` ~ `J_A4-01.mp4` (= v5)
- 구버전 대피: `/tmp/old_v1/` `/tmp/old_v1_916/` `/tmp/old_v2/` `/tmp/old_v3/` `/tmp/old_v4/`

## 이번 세션에 새로 생긴 것

| 항목 | 위치 |
|---|---|
| **Z-FIT 게이트** (교훈 211) | `r3d/scenemap.py` — `Z_HEADROOM` `Z_FLOOR_MIN` `_set_top()` `move_fits_height()` |
| **실내 저고도 무브 6종** | `r3d/scenemap.py MOVES` — 22 → 28 |
| **G8 화각·가림** (교훈 210) | `r3d/script_gate.py` — `visible()` `blockers_of()` `_ray_aabb()` |
| **정정 마스크 측정 도구** (교훈 212) | `r3d/pixel_check.py` **신규** |
| **벤치마크 대장** | `76_BENCHMARK_STUDY.md` **신규 221행** |
| 교훈 210 / 211 / 212 | `71_HYBRID_3D_PRODUCTION_RULES.md` 3039행 |
| CEO-73~81 원문 | `00_CEO_DIRECTIVES.md` 637행 |
| v1~v5 버전 대장 | `73_ARTIFACT_LEDGER.md` |

## 다음 작업자가 바로 이어받는 순서

### 1순위 — 대표님 판정에 따라 분기

- **게시 승인** ⇒ 유튜브 업로드. 제목/설명/해시태그는 `74_SHORTS_TRILOGY_SPEC.md` 참조.
- **반려** ⇒ 반려 사유가 아래 「알려진 한계」 중 무엇인지 먼저 특정할 것.
  한계 1(follow-the-object)이면 2순위로, 한계 2(컷 길이)면 3순위로 직행.

### 2순위 — follow-the-object 적용 (반려 시 최우선)

벤치마크 6/6 이 쓰는 서사인데 우리만 안 쓴다. 상세 처방은 `76_BENCHMARK_STUDY.md` §1.

```
① sets.py PROPS       6 beat 가 같은 오브젝트 id 를 공유하도록 재설계
                      (현재: cmptab -> card -> card -> brief -> posting -> res)
② scenejobs.gaze_of() 앵커 오브젝트를 우선 시선점으로 삼도록
③ script_gate.py      G9 ANCHOR GATE 신설 — 연속 컷의 주연 id 가 바뀌면 경고
```

**주의**: G9 는 「경고」가 아니라 「실패」로 만들 것. 경고로 두면 결함이 그대로
렌더된다 (교훈 187).

### 3순위 — 컷 길이 단축 (CEO-80 B 동시 해소)

우리 4.3초/컷 vs 벤치마크 0.5~4초. 컷을 쪼개면 프레임 수가 줄어 렌더도 빨라진다.
렌더 실측 **1.119~1.248 초/프레임** — 622f = 12.7분.

### 4순위 — 재발 방지 (근본)

```
① scenejobs.refine_lens()  후보 렌즈마다 SG.visible() 확인 (현재 화각 미고려)
② script_gate.py           job.get("sid") -> job.get("sids",[""])[0]  (항상 None 이었다)
③ script_gate.py           헤더 docstring + 출력 섹션에 G8 / Z-FIT 반영
④ shorts916.py CLIP GATE   자막/제목 밴드(y<500, y>=1108)는 무조건 글자로 보고 edge 검사,
                           영상 밴드(500~1108)만 덩어리별 fill 판정
```

### 5순위 — CEO-80 (D) 100개 완주

현재 7 / 100. `analyze_media_content` `video_style_replication` 사용 (유료 · CEO-78 허용).
결과는 **반드시** `76_BENCHMARK_STUDY.md` 에 「대상 파일 / 대상 상수」와 함께 적을 것
(교훈 192 · CEO-73).

### 6순위 — GenTeam 발주 (CEO-77 D)

`71_HYBRID_3D_PRODUCTION_RULES.md` §0.10 프리비즈 목적 정본(P0~P5)을
previz 채널 `ch_60f831f6870e4e2fba2c25a214f94566` + 마케팅 채널에 발주.

## 알려진 한계 (게시 전 대표님 판단 필요)

1. **follow-the-object 미적용** — 컷마다 소도구가 바뀐다 (CEO-76 「장면만 바뀌는 셈」의 정체)
2. **컷 길이 평균 4.3초** — 벤치마크는 0.5~4초
3. **나레이션 오디오 미결합** — 현재 무음
4. **CLIP GATE 부분 무력** — glyph 6 / sheet 4059
5. **`refine_lens()` 화각 미고려** — 교훈 210 근본 재발 방지 미완
6. **벤치마크 7 / 100**

## 재현 명령 (그대로 붙여 쓸 수 있다)

```bash
# 체인 재실행 (전부 무료 · 각 1초 미만)
cd /home/user/lf/r3d
python3 -u sets.py && python3 -u scenemap.py && python3 -u scenejobs.py
python3 -u script_gate.py --report          # FAILURES 0 이어야 한다

# 재렌더 (구 mp4 를 반드시 먼저 치울 것 — 있으면 SKIP 된다)
mkdir -p /tmp/old_vN && mv _batch/J_A3-1*.mp4 _batch/J_A4-01.mp4 /tmp/old_vN/
PREVIZ_JOBS=J_A3-13,J_A3-14,J_A3-15,J_A3-16,J_A3-17,J_A4-01 \
  setsid nohup python3 -u previz_batch.py > /tmp/vN.log 2>&1 < /dev/null &

# 폴링 (CEO-80 A 처방 — 같은 턴 안에서 완주 확인)
sleep 110; grep -E "^\[|BATCH DONE" /tmp/vN.log      # 4~7회 반복 (622f ≈ 12.7분)

# 렌더 픽셀 검증 (교훈 212 정정 마스크)
python3 -u /home/user/webapp/youtube/hybrid3d/pipeline/r3d/pixel_check.py

# 9:16 조립 + 게이트
cd /home/user/lf/work/longform
python3 -u shorts916.py build && python3 -u shorts916.py gate
```

## 함정 (실제로 밟은 것만)

- **기존 mp4 가 있으면 `previz_batch.py` 는 SKIP 한다.** 재렌더 전 반드시 대피시켜라.
- **`pgrep -f` 는 자기 자신을 잡는다.** `ps -ef | grep X | grep -v grep` 을 쓸 것.
- **mp4 인코딩 후 프레임 PNG 디렉터리는 비워진다.** 재검증은 ffmpeg 로 mp4 에서 추출.
- **CSV 는 BOM 이 있다.** `encoding="utf-8-sig"` 필수.
- **scipy 가 없다.** 연결 성분은 손으로 flood fill.
- **`scenejobs.json` 잡 키는 `job_id`** (`id` 아님) · `sid` 필드 없음 (`sids` 리스트).
- **측정 도구를 먼저 의심하라.** 같은 컷이 세 번 실패하면 도구가 틀렸을 확률이 높다 (교훈 212).

---

# 세션 상태 — 2026-08-28 [CEO-85] ★프리비즈를 넘어 영상 납품★

## 0. 이 세션의 한 줄

**프리비즈 반복 루프를 종료하고, 나레이션이 결합된 「영상」을 실제로 납품했다.**
추가 렌더 루프 **0회**. 유료 호출 **0건**.

## 1. 대표님 지시 (verbatim · CEO-85)

> "네 이제는 프래비즈를 넘어서 영상으로 제작하세요. 우리 롱폼과 숏츠를 하이브리드 3D 모션으로
> 원하는 품질과 우리 대본에 맞춤화된 영상을 만들기 위해서 너무 많은 시간과 비용을 지출했습니다.
> 낭비 수준이에요. 최소한 낭비가 되지 않고 목적 달성하고 앞으로 그 규칙에 따라 모든 콘텐츠를
> 생산하도록 성과를 냅시다!"

## 2. 이행 결과

| 지시 | 이행 |
|---|---|
| ① 프리비즈를 넘어 「영상」 | **✅ 숏폼 C 납품** https://www.genspark.ai/api/files/s/p2X4kHHb |
| ② 롱폼 + 숏츠 둘 다 | 숏츠 ✅ / **롱폼 렌더 진행 중** (미렌더 19잡 착수) |
| ③ "너무 많은 시간과 비용 / 낭비 수준" | **✅ 추가 렌더 루프 0회** · 유료 0건 |
| ④ "최소한 낭비가 되지 않고 목적 달성" | **✅ 링크 납품 완료** (16.000000s · 1.10 MB) |
| ⑤ "앞으로 그 규칙에 따라 모든 콘텐츠를 생산" | **✅ `77_PRODUCTION_SOP.md` 401행 신설** |

## 3. 납품물 규격 (실측)

```
shortsC_연봉만보면놓치는것_1080x1920_16s_나레이션포함.mp4
  h264 1080x1920 24/1  duration = 16.000000
  aac  192k            duration = 16.000000     ← 소수점까지 일치
  1,151,434 B (1.10 MB)
  4컷: J_A3-13(101f) J_A3-14(55f) J_A3-15(99f) J_A3-17(129f) = 384f
```

## 4. 게이트 최종 상태

```
SCRIPT GATE   FAILURES 0      (G1~G3 · G5 6/6 · G6 6/6 · G7 2/2 · G8 · G9 4/4 · G10 4/4)
G9 런 커버    100% (384/384f = 16.00s) · 앵커 정체성 1종
FLOW GATE     p95 min 15.09 / med 24.59 / max 35.32   (하한 1.50 → 10배)  미달 0/7
CLIP GATE     엣지 접touch 0 프레임  (⚠ glyph 0 / sheet 2390 — 분류 정정은 잔여)
육안 확인      f12 / f130 / f370 — 조판·앵커 정상 (최종 심판 통과)
```

## 5. 이번 세션에 추가된 규칙

### 교훈 220 — 자기 부과 게이트는 납품을 막을 권한이 없다

게이트를 **3분류**한다.

| 분류 | 출처 | 미달 시 |
|---|---|---|
| 합의 게이트 (G1~G3, 사용 구간) | 대본 / 기획 / CEO 지시 | **납품 중단** |
| 관객 하한 게이트 (G5~G10, FLOW, CLIP) | 벤치마크 / 승인본 | **납품 중단** |
| **자기 부과 개선 목표** (`ISOLATION_MIN` 등) | **내가 정한 값** | **납품하고 다음 배치 이월** |

판별 질문 3개:
1. CEO 가 제시했거나 대본/기획이 요구하는가? → 아니면 자기 부과
2. 이 수준으로 CEO 가 이미 승인한 산출물이 있는가? → 있으면 납품 우선
3. 미달을 고치려면 렌더를 다시 돌려야 하는가? → 그렇다면 이월

**교훈 131 과의 관계**: 131 = "코드를 고쳐라" / 220 = **"그 전에 먼저 납품하라"**
**부가 규칙**: 렌더 픽셀 직독 결과로 렌더를 다시 돌리는 것은 **1회까지만**.
2회 이상은 렌더 문제가 아니라 설계/게이트 정의 문제 → 상류로 올라가라.

### 교훈 221 — 컷을 건너뛰면 오디오도 잘라 붙여야 한다

숏폼 C 는 `J_A3-16`(6.96s) / `J_A4-01`(2.94s) 을 제외한다.
연속 구간 22.94s 를 통째로 붙이면 A3-16 만큼 나레이션이 어긋난다.

**세그먼트 길이 = 렌더 프레임 수 ÷ FPS** (대본 `dur` 아님).
대본 dur 합 = 15.98s ⇒ 0.02s 오차. 롱폼에서 누적되면 립싱크가 밀린다.

검증: `ffprobe` 로 오디오 총 길이 == 영상 길이 (소수점까지). `-shortest` 는 안전망일 뿐.

## 6. 문서 상태

| 파일 | 행수 | 이번 세션 |
|---|---|---|
| `77_PRODUCTION_SOP.md` | **401** | **★신설 — [CEO-85] ⑤ 상시 생산 표준★** |
| `00_CEO_DIRECTIVES.md` | 810 | CEO-85 원문 + 분해 + 자기 진단 + 도출 원칙 |
| `71_HYBRID_3D_PRODUCTION_RULES.md` | 3309 | 교훈 220 · 221 추가 |
| `73_ARTIFACT_LEDGER.md` | 507 | **v7 납품 절 신설** (URL · 게이트 · 이월 판정 · 재생산 명령) |
| `75_SESSION_STATE.md` | (본 문서) | CEO-85 세션 기록 |
| `README.md` | 43 | CEO-1~85 · 교훈 1~221 · SOP 행 삽입 |

## 7. ★다음 1동작★

**롱폼.** 미렌더 19잡을 백그라운드로 렌더 중 (`/tmp/lf19.log`).
완료 후 순서:

1. `previzcut.py` 개조 4항 — ① HEAD 제거 ② TOTAL 12000 하드게이트 해제 ③ 자막 시안 네온 ASS ④ 오프셋
2. 롱폼 조립 → 나레이션 결합 (교훈 221 절차) → 육안 → 업로드 납품
3. 컷 길이 단축 (4.00초 → 1.5~3초) — 벤치마크 0.5~4초 대비 · **렌더 시간도 줄어 [CEO-85] ③ 에 직접 대응**

## 8. 잔여 과제 (우선순위)

| # | 과제 | 근거 |
|---|---|---|
| 1 | 롱폼 렌더 완주 → 조립 → 납품 | [CEO-85] ② |
| 2 | 컷 길이 단축 4.00초 → 1.5~3초 | [CEO-85] ③ · [CEO-82] B · 벤치마크 |
| 3 | 세대 혼재 판단 — 렌더된 57잡 중 53개가 08-22~23 구세대 (`sets.py` 는 08-28) | **실패 30** |
| 4 | CLIP GATE 정정 — 자막/제목 밴드는 무조건 글자 | glyph 0 / sheet 2390 |
| 5 | `ENV_WALL_HI=0.215` 하향을 **다음 신규 배치에** | 교훈 217 · 220 (단독 재렌더 금지) |
| 6 | 5축 재계측 3종 (`visib.py` / `needsize.py` / `altsweep.py`) | [CEO-83] |
| 7 | 벤치마크 100개 (현재 7) | [CEO-80] D |
| 8 | GenTeam 채널에 SOP 발주 | [CEO-77] · [CEO-85] ⑤ |
| 9 | **실제 유튜브 게시** | [CEO-80] C · [CEO-81] |

## 9. 리소스

```
유료 호출  이번 세션 0건  (누적 7건 = analyze_media_content 벤치마크)
무료 결함/발견 적발 누적  133건
Mem 3939MB · 디스크 7.0G · GPU 없음 (CYCLES CPU)
프리비즈 렌더 1.10~1.33 s/frame
```

---

# 세션 상태 — 2026-08-28 (2) [CEO-85] ★롱폼 조립 착수 + 교훈 222 + G11★

## §0 한 줄

**롱폼 렌더 19/19 완주 → `longcut.py film` 이 프레임 세대 불일치 11잡을 잡아냈다 →
교훈 222 로 규칙화 + MAP 게이트 강화 + 재렌더 착수 → 병행하여 G11 RHYTHM 신설.**

## §1 이 세션의 결정적 사건 — 게이트가 38.8초 어긋난 납품을 막았다

```
1) 렌더 19/19  BATCH DONE  jobs 19  frames 1392  28.8 min
2) longcut.py map    → MAP OK  76 pieces → 8392 f = 349.666667 s
3) longcut.py film   → ★FILM FAILED  concat produced 9330 f, jobs declare 8399★
4) 조각별 ffprobe    → ★MISMATCH 11잡  +931 f = 38.8 초★
```

`_batch/` 에 76개가 다 있었고 MAP 은 통과시켰다. 그런데 **11개가 08-22~23 구세대**였다.
`sets.py`/`scenemap.py`/`scenejobs.py` 는 08-28 수정본이다. 그 사이 대본의 `frames` 가
바뀌었는데 `previz_batch.py` 의 **SKIP 로직**이 재렌더를 막았다.

**MAP 이 「존재」만 봤기 때문이다. 존재는 최신을 뜻하지 않는다.**

| 조각 | 대본 | 디스크 | delta |
|---|---|---|---|
| J_A3-02 | 92 | 205 | +113 |
| J_A3-04 | 169 | 230 | +61 |
| J_A3-11 | 129 | 169 | +40 |
| J_A4-02 | 78 | 149 | +71 |
| J_A4-12 | 94 | 156 | +62 |
| J_A5-03 | 157 | 276 | +119 |
| J_A5-13 | 73 | 134 | +61 |
| J_A6-02 | 191 | **460** | **+269** |
| J_A6-07 | 116 | 187 | +71 |
| J_A7-01 | 90 | 99 | +9 |
| J_A7-11 | 115 | 170 | +55 |
| **합** | **1304** | **2235** | **+931** |

## §2 이행 결과

| # | 항목 | 결과 |
|---|---|---|
| ① | 롱폼 렌더 19잡 | ✅ **BATCH DONE 28.8분** |
| ② | `longcut.py map`/`film` 실행 | ✅ **결함 검출 → 원인 규명** |
| ③ | 교훈 222 헌법 등재 | ✅ **3309 → 3367행** |
| ④ | `cmd_map()` 프레임 수 검사로 강화 | ✅ **적용 · STALE + re-render list 출력** |
| ⑤ | `shift_srt()` 미사용 잔재 3줄 정리 | ✅ |
| ⑥ | SOP §12.8 복구 절차 표준화 | ✅ **505 → 591행** |
| ⑦ | 11잡 대피 + 재렌더 | ◐ **5/11 진행 중** (`/tmp/lf11.log`) |
| ⑧ | **G11 RHYTHM 신설** | ✅ **745 → 812행 · FAILURES 0 유지** |
| ⑨ | 벤치마크 §10 문서화 | ✅ **517 → 606행** |
| ⑩ | 커밋 2건 + 푸시 | ✅ `0ee39bc` `6e30888` |

## §3 G11 RHYTHM — 컷 길이를 게이트로 세웠다

```
RHYTHM (G11, 컷 길이 0.5~4.0 s): 30 / 74 컷 통과   [인구조사 — 렌더를 막지 않는다]
   실측  min 1.67  med 4.29  mean 4.50  max 9.50 s   (목표 med 3.0 s)
   4.0 s 초과 44 컷 · ★분할 대상 목록(쉼표) 출력★
FAILURES (G1/G2/G3/G5/G6/G7/G8/Z-FIT/G9/G10/G11): 0
```

**★2단 스위치★** `RHYTHM_ENFORCE=False` (지금) → `True` (분할기 적용 배치).
지금 FAIL 로 켜면 대표님이 승인한 숏폼 C(4.21초 컷)까지 반려된다 (교훈 131).

**★핵심 산술★** 76컷×110f = 120컷×70f = **8399f 동일** ⇒ **렌더 시간 불변, 리듬만 1.6배.**
컷 분할만이 비용 중립인 개선 항목이다.

## §4 교훈 220 ↔ 222 — 게이트의 「출처」로 지위를 가린다

| | 220 | 222 |
|---|---|---|
| 대상 | 자기 부과 값 (`ISOLATION_MIN=1.35`) | 대본이 정한 값 (`frames`) |
| 출처 | **내가 코드에 써넣었다** | **대본 정본** |
| 납품 | **막을 권한 없음 → 이월** | **막을 정당한 사유 → 고쳐라** |

**구분 기준은 「출처」다. 내가 정한 값인가, 대본이 정한 값인가.**

이번 재렌더 11잡은 **현세대 대본으로 한 번도 렌더된 적이 없다** ⇒ 반복 루프가 아니다.

## §5 문서 상태

| 파일 | 행 | 상태 |
|---|---|---|
| `00_CEO_DIRECTIVES.md` | 810 | 커밋됨 |
| `71_HYBRID_3D_PRODUCTION_RULES.md` | **3367** | ✅ `0ee39bc` (교훈 222) |
| `73_ARTIFACT_LEDGER.md` | 507 | 커밋됨 |
| `75_SESSION_STATE.md` | (이 절) | 갱신 중 |
| `76_BENCHMARK_STUDY.md` | **606** | ✅ `6e30888` (§10 G11) |
| `77_PRODUCTION_SOP.md` | **591** | ✅ `0ee39bc` (§12.8) |

## §6 ★다음 1동작★

재렌더 11/11 완주 → `longcut.py map` (**MAP OK**) → `film` → `deliver`
→ 육안 3프레임 → `UploadFileWrapper` 납품.

## §7 잔여 과제

| # | 항목 | 상태 |
|---|---|---|
| 1 | 롱폼 납품 | **재렌더 5/11** |
| 2 | 컷 분할 (G11 2단 승격) | **게이트·목록 준비 완료 · 분할기 미구현** |
| 3 | `ENV_WALL_HI` 하향 | **다음 배치에 G11 과 동시 반영** |
| 4 | 5축 재계측 3종 | 미착수 |
| 5 | CLIP GATE 정정 (glyph 0) | 미착수 |
| 6 | 벤치마크 100개 (7/100) | 미착수 |
| 7 | GenTeam SOP 발주 | 미착수 |
| 8 | 실제 유튜브 게시 | 미착수 |

## §8 리소스

**이 세션 유료 호출 0건** · 누적 7건 · 재렌더 CPU 만 사용 · 디스크 여유 확인 필요

---

# 세션 (5) 2026-08-28 — ★게이트 FAILURES 0 + 통합 배치 렌더 착수★

## §5.1 대표님 지시

> **"예산 아직 있습니다. 계속 진행해서 결과물을 도출하세요."**
> (직전) **"계속 진행하세요"**
> (지배) **[CEO-85]** "네 이제는 프래비즈를 넘어서 영상으로 제작하세요. … 낭비 수준이에요.
> 최소한 낭비가 되지 않고 목적 달성하고 앞으로 그 규칙에 따라 모든 콘텐츠를 생산하도록 성과를 냅시다!"

## §5.2 이 세션이 한 일 (11단계)

| # | 작업 | 결과 |
|---|---|---|
| 1 | 진단 (병렬 2호출) | **`scenejobs.json` + 백업 둘 다 19바이트 float 파괴 확정** |
| 2 | 복구 | `python3 scenejobs.py` → **`SCENEJOBS OK 76 jobs 8399 f`** (1초) |
| 3 | 근본 원인 규명 | **변수 섀도잉** (SEAM 의 `d` 가 `d = json.load(JOBS)` 를 덮었다) |
| 4 | `cutsplit.py` 5패치 | `d`→`gap` · **WRITE GATE** (`_valid_jobs`/`_write_jobs`) · revert 순서 · 로드 검증 |
| 5 | `script_gate.py` 7패치 | `RHYTHM_LOCKED` + G11 면제 + **G7 분할 형제 면제** + `ENFORCE=True` → **1회 AST OK** |
| 6 | `cutsplit.py apply` | **123컷 · 8399f 보존 · SPLIT GATE OK** |
| 7 | `script_gate.py` 전량 | **★FAILURES 0 · SCRIPT GATE OK★** (G11 117/117 · med 2.62s) |
| 8 | `_batch` 대피 | 79 mp4 → `/tmp/gen0828/` |
| 9 | **통합 배치 렌더 착수** | PID 39339 · 123컷 8399f · **1.18~1.22 s/f** · 예상 2.85h |
| 10 | 헌법 등재 | 교훈 225·226·227·228 + §12.9 → **3551 → 4099행** |
| 11 | 커밋 + 푸시 | **`5185c4e`** (4 files · 1074 insertions) → **푸시 완료** |

## §5.3 근본 원인 상세 — 실패 37 은 flush 가 아니라 「변수 섀도잉」이었다

직전 세션의 추정("파일 핸들 미닫힘")은 **틀렸다.**
`sed -n 415,452p cutsplit.py` 로 **실제 코드를 읽어** 확인했다:

```python
def cmd_plan(apply_=False):
    d = json.load(open(JOBS))                              # line 294 ★정본 데이터★
    jobs = d["jobs"] if isinstance(d, dict) else d
    ...
    d = math.dist(a["cam_end_xyz"], b["cam_start_xyz"])    # SEAM 안 ★d 를 덮었다★
    ...
    if apply_:
        json.dump(d, open(BAK, "w"), ...)                  # ★float 을 백업에 썼다★
```

**★추측을 코드 직독으로 대체한 것이 해결의 전부였다 (신뢰도 위계 10 > 11).★**

## §5.4 게이트 승격 결과

```
RHYTHM (G11, 컷 길이 0.5~4.0 s): ★117 / 117 컷 통과★   [ENFORCE]
   실측  min 1.67  med ★2.62★  mean 2.71  max 3.96 s   (목표 med 3.0 s)

SCENE NOTES (G4, 같은 장면 반복): 41         ← NOTE (FAIL 아님)

★FAILURES (G1/G2/G3/G5/G6/G7/G8/Z-FIT/G9/G10/G11): 0★
★SCRIPT GATE OK★
```

**벤치마크 대조** — 벤치마크 6/6 이 컷 길이 0.5~4초.
우리 롱폼은 med **4.29초** → **med 2.62초**. **★총 프레임 불변 (8399 → 8399) · 렌더 비용 증가 0★**

## §5.5 즉시 다음 동작

```
① 렌더 폴링 (PID 39339 · /tmp/lfall.log) — 현재 11/123 · 15.3분
② genaudit.py → OLD-GEN 0 확인
③ longcut.py map (★123 pieces★) → film → deliver
④ 육안 5프레임 (색 통일 + 자막 3줄 + 리듬)
⑤ UploadFileWrapper 업로드 → 대표님께 링크 보고
⑥ PR #285 본문 갱신
```

## §5.6 잔여 과제

| # | 항목 | 상태 |
|---|---|---|
| 1 | 롱폼 납품 | **★통합 배치 렌더 진행 중 (11/123)★** |
| 2 | 컷 분할 (G11 2단 승격) | **✅ 완료 — apply + FAILURES 0** |
| 3 | `ENV_WALL_HI` 하향 | **✅ 통합 배치에 반영됨** |
| 4 | 5축 재계측 3종 | 미착수 |
| 5 | CLIP GATE 정정 (glyph 0) | 미착수 |
| 6 | 벤치마크 100개 (7/100) | 미착수 |
| 7 | GenTeam SOP 발주 | 미착수 |
| 8 | 실제 유튜브 게시 | 미착수 |

## §5.7 리소스

**이 세션 유료 호출 0건** · 누적 7건 · 렌더는 CPU 만 사용 · 디스크 6.8G 여유
누적 무료 자기 적발 **271건** (이 세션 SPLIT GATE 117 + WRITE GATE 1 + 섀도잉 1)

---

# §6 세션 (6) — [CEO-88] "남은 일 착수하세요"

## §6.1 들어올 때의 상태

```
렌더        통합 배치 PID 39339 · 78/123 (106.8min) 진행 중
5축 도구    계승 요약은 「소실」이라 적혀 있었다 → ★실측으로 확인★
            ls: cannot access 'visib.py'/'needsize.py'/'altsweep.py': No such file
문서        76_BENCHMARK_STUDY.md 665행 · 헌법 4248행 (교훈 229까지)
게이트      FAILURES 0 · G11 117/117
```

**첫 동작은 실측이었다.** 계승 요약의 「미완료/소실」 주장을 그대로 믿지 않고
`ls` 로 확인했다 — 실제로 없었다.

## §6.2 한 일

| # | 작업 | 결과 |
|---|---|---|
| 1 | §7 사양 전문 직독 + `sets.py` 색·PROPS 실측 | §7 은 **처방 전** 실측임을 인식 |
| 2 | `script_gate` 헬퍼·상수 좌표 확보 | `line 840 if __name__` = **import 안전** 확인 |
| 3 | `anchorlib.py` 신설 (교훈 176 완전 준수) | **selfcheck 12/12 OK** |
| 4 | `visib.py` 신설 (축②) | **PASS 두께비 x1.558** |
| 5 | `needsize.py` 신설 (축④) | **중대 발견 — 앵커 2컷 하한 미달** |
| 6 | `altsweep.py` 신설 (축①+⑤) | 첫 실행 **축① 2.83:1 실패** |
| 7 | **도구 자신의 교훈 229 재발 포착** | `BACKDROP`/`ON_CARD` 분리 → **8.11:1 OK** |
| 8 | `76_BENCHMARK_STUDY.md` §11 등재 | 665 → **922행** |
| 9 | 교훈 230 헌법 등재 | 4248 → **4433행** (교훈 60개) |
| 10 | 미러 4파일 + 커밋 `b738576` 푸시 | 6파일 1258행 |
| 11 | 문서 4종 갱신 (00 / 73 / 77 / 75) | SOP §14 신설 (874 → 954행) |

## §6.3 가장 중요한 발견 — 게이트가 초록인데 앵커가 미달이다

```
script_gate  FAILURES 0 · G11 117/117 통과
needsize     A3-13 최악 화면폭 0.1148  /  A3-17 0.1237   (하한 0.14)
```

**G6 는 「컷의 최대 주연」만 본다.** A3-13 의 최대 주연은 카드가 아니라 비교표
`cmptab` 이므로, 카드가 작아도 통과한다.
**G9 는 「첫 프레임의 비」와 「런 커버」만 본다.** 절대 크기를 보지 않는다.

⇒ 교훈 213 의 **정량 증거**. [CEO-83] 「게이트 통과가 곧 관객 몰입은 아니다」가
가리킨 지점이 정확히 여기였다.

**그런데 적용하지 않았다.** A3-13/A3-17 은 `SHORTS_C_LOCK` = CEO 승인 납품본
구성 컷이다. 교훈 131 + [CEO-85] ⇒ 계산만 하고 선택지를 남긴다.

## §6.4 두 번째 발견 — 도구 자신이 교훈 229 를 재발시켰다

`altsweep.py` 의 `NEIGHBOURS` 에 `DOC_N`(카드 **위**의 바)을 넣었다. 한
리스트가 두 질문에 동시에 답했고, ②는 대비가 커야 좋은 것이므로 ①의 최악값으로
세면 **좋은 설계가 실패로 집계된다**. 분리하니 축① 통과 + 내부 가독성 부가
정보(DOC_N 제목바 2.83:1 약함)까지 얻었다.

**교훈: 교훈 229 는 데이터 파이프라인만의 문제가 아니다. 검증 도구 자신도
예외가 아니다.**

## §6.5 세 번째 발견 — §7.5 의 판정이 뒤집혔다

§7.5 는 「색과 크기는 독립 변수」라고 적었다(크기 x1.46 에서 3/6). 그런데 그
관찰은 **색이 실패한 상태(1.90:1)** 에서 이루어진 것이었다. §8 이 색을
해소(8.11:1)하자 크기가 단일 변수로 작동해 **x1.30 에서 4/4** 가 됐다.

## §6.6 잔여 (P0)

| # | 항목 | 상태 |
|---|---|---|
| 1 | 통합 배치 렌더 완료 | **진행 중 (94/123 · 130min)** |
| 2 | `J_A3-16_s2` 개별 재렌더 (props_sid 반영) | 렌더 완료 후 |
| 3 | `genaudit.py` OLD-GEN 0 확인 | 렌더 완료 후 |
| 4 | `longcut.py map`(123 pieces·8399f) → `film` → `deliver` | 렌더 완료 후 |
| 5 | 육안 5프레임 + **축③ 육안 확인** | 렌더 완료 후 |
| 6 | 업로드 → 납품 링크 보고 | 렌더 완료 후 |
| 7 | PR #285 본문에 §11 + 교훈 229/230 반영 | 대기 |
| 8 | `refine_lens()` 화각 상한 (altsweep [5b] 가 같은 지점 지적) | 미착수 |
| 9 | CLIP GATE 정정 (glyph 0) | 미착수 |
| 10 | 벤치마크 100개 (7/100) | 미착수 |
| 11 | GenTeam SOP 발주 (SOP §14 포함) | 미착수 |
| 12 | 실제 유튜브 게시 | 미착수 |

## §6.7 리소스

**이 세션 유료 호출 0건** · 누적 7건 · 렌더는 CPU 만 사용 · 디스크 6.8G 여유
누적 무료 자기 적발 **285건** (이 세션 5축 6건 + 도구 자신의 229 재발 1건)
