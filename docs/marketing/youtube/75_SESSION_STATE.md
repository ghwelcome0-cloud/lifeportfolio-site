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
