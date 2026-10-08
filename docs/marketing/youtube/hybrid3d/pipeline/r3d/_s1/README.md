# `_s1` — 숏츠 #1 제작 파이프라인 도구 5종 (재생산 정본)

> 근거: **[CEO-73]** "재생산이 가능하도록 늘 일을 구축해야 해요."
> 규칙 본문은 `docs/marketing/youtube/71_HYBRID_3D_PRODUCTION_RULES.md` **제19부**.

숏츠 #1 「이력서에 뭘 써야 할지 모르겠을 때」(1080x1920 · 61.000초 · 1464프레임 · 9컷)를
만든 도구 전량이다. 이 5개 파일 + 소재(플레이트 6장 · i2v 클립 7개 · 나레이션 1개)만 있으면
**동일한 결과물이 다시 나온다.**

작업 위치는 샌드박스의 `/home/user/lf/r3d/_s1/` 이며, 여기 있는 것은 그 **미러**다.
(영상·이미지 바이너리는 리포에 넣지 않는다. URL 은 `73_ARTIFACT_LEDGER.md` 참조.)

---

## 1. 파일별 역할과 의존 관계

```
cutsheet.py   ★정본★  나레이션 실측 타임코드 → 컷 경계 → 컷 시트
    │                 (여기가 유일한 상수 출처. 복제 금지 — 교훈 176)
    ├── build.py      조립: 세그먼트 → concat → 오버레이 합성 → 먹싱
    │      └── ovl.py 오버레이 PNG 9장 생성 (자막 / 리더선 / CTA)
    └── gate.py       최종 게이트 G1~G8 (판정면 = ★최종 합성 프레임★)
               └── tonegate.py  톤 3지표 + 글자 수 (이미지/프레임 공용)
```

`build.py` 와 `gate.py` 는 `cutsheet.py` 를 `importlib` 로 import 한다.
컷 경계를 바꾸려면 **`cutsheet.py` 만** 고친다.

---

## 2. 실행 순서 (전체 재생산)

```bash
cd /home/user/lf/r3d/_s1

# 0) 자기검사 — 도구가 살아 있는지 먼저 확인 (교훈 230)
python3 cutsheet.py          # → CUTSHEET OK
python3 ovl.py selfcheck     # → SELFCHECK 7/7

# 1) 소재 검사 — 이미지 통과 ≠ 영상 통과 (교훈 245)
python3 tonegate.py plates/*.png      # → TONEGATE n/n PASS
python3 tonegate.py work/qc/*.png     # i2v 추출 프레임도 반드시

# 2) 계획 확인 — 프레임 산술이 맞는지 (교훈 266)
python3 build.py plan        # → PLAN OK  cuts=9 total_frames=1464 61.000s

# 3) 오버레이 → 세그먼트 → 이어붙이기 → 최종
python3 ovl.py build         # → OVL OK 9
python3 build.py segs        # → SEGS OK 9
python3 build.py concat      # → CONCAT OK 1464f
python3 build.py final       # → FINAL OK  shorts1.mp4

# 4) 게이트
python3 gate.py              # → GATE 9/9 OK

# 5) ★게이트가 전부 초록이어도 육안★ (교훈 223)
#    9컷 대표 프레임 3x3 콘택트시트를 만들어 눈으로 본다
```

**주의** — 3)·4) 는 수 분 걸린다. Bash 타임아웃 120초를 넘기므로
`setsid nohup python3 -u ... > log 2>&1 < /dev/null &` 로 띄우고 로그를 폴링한다.

---

## 3. 각 도구 상세

### `cutsheet.py` — 컷 시트 정본
- `NAR_SEGS` : 나레이션 15문장의 **실측** `(start, end, text)`.
  `audio_transcribe(model="elevenlabs_scribe_v2")` 결과를 그대로 옮긴 것.
  **감으로 적지 않는다.** (교훈 261)
- `mid(i)` : 인접 문장 사이 중점. 컷 경계는 여기에만 놓는다.
- `plan()` : 컷 9개의 `(id, src, dir, sub, cam, t0, t1, dur, nar)` 반환.
- `__main__` : assert 4종 — 총합 / 단조증가 / 컷 밴드 4~10초 /
  **경계가 문장 내부를 자르지 않음(violations 0)**.

### `tonegate.py` — 톤·글자 게이트
```
BRIGHT_LO 38.0  BRIGHT_HI 75.0   배경 밝기 (벤치마크 실측 40~60)
VIG_LO    0.72                   코너/중심 밝기비 (교훈 263 2차 정정)
NEU_MAX   8.0                    R-B 편차 = 색 편향 (청록 톤 차단)
```
`judge(path)` 반환은 **6-튜플 `(m, g, ok_b, ok_v, ok_n, ok)`** 이다.
호출 전 반드시 실제 return 을 확인할 것. (교훈 249)
`glyph_count()` 는 `scipy.ndimage` 연결성분으로 **형상**을 센다. (교훈 248)

### `build.py` — 조립 정본
- `plan()` : **경계 시각을 프레임으로 반올림한 뒤 차분**. `assert f0 == prev_end`
  로 gap 0 강제 → 총합이 정확히 1464. (교훈 266)
- `cmd_segs()` : `fwd` 는 `trim → scale`, `rev` 는 `scale → reverse → trim`
  (reverse 는 전체를 RAM 에 올리므로 scale 을 먼저). **crop 금지, scale 만.**
- `RAMP` / `_ramp_vf()` : G7(정지 없음) 위반 컷에 **아주 느린 푸시인 램프**.
  계수는 실측으로 정한다 — C6 은 1.14. (교훈 269)
- `cmd_final()` : 오버레이 0.5초 알파 페이드 합성 + `apad` 먹싱.
  **길이는 `-frames:v` 로만 결정한다.** `-loop 1 -i png` 에 loop/trim 을
  중복 적용하면 프레임이 1개 사라진다. (교훈 265)
- 그레이딩 **무적용** — 신규 플레이트가 이미 밝은 중성 CAD 톤이다.
- 전환 **하드컷** — 벤치마크 실측. (교훈 255)

### `ovl.py` — 오버레이 v3
프리미티브 3개뿐. HUD·격자·시안 글로우 계열(구 `overlay.py`)은 전부 버렸다.
- `subtitle()` : 어절 단위 wrap + 줄마다 반투명 검정 받침 + 흰 볼드.
- `leader()` : 원형 앵커 → 꺾인 빨강 리더선 → 라벨.
  **라벨에도 받침**을 깔고, 좌표를 `MARGIN` 안으로 **clamp**. (교훈 267)
- `cta()` : 마지막 컷 전용. 단일 판 + 좌측 빨강 세로 악센트.
  밝은 종이 지층 위에서는 alpha 205 + 둘째 줄 별도 받침이 필요하다.
- `LEADERS` : 앵커 좌표. **실제 프레임을 눈으로 보고 찍은 값**이다.
  상상으로 찍으면 허공/프레임 밖을 짚는다. (교훈 268)

### `gate.py` — 최종 게이트
판정면은 **최종 합성 프레임**(`shorts1.mp4`)이다. 소스 클립이 아니다. (교훈 246)
```
G1 프레임/AV  G2 해상도  G3 톤 27프레임  G4 대본 동기  
G5 컷 밴드    G6 하드컷 실재  G7 정지 없음  G8 오디오
```
**성능** — 프레임을 하나씩 `ffmpeg` 로 뽑으면 매번 처음부터 디코딩한다.
대량 판정은 `rawvideo` 파이프 1패스로 하라 (1464프레임 분석이 10초).

---

## 4. 확정 사양 (숏츠 #1)

| 항목 | 값 |
|---|---|
| 주제 | 「이력서에 뭘 써야 할지 모르겠을 때」 (주제 3체크 14.8/16) |
| 실물 | 3공 바인더 수직 절단 — 수백 장 서류 + **금속 링 3개 관통 절단** |
| 길이 | 61.000초 · 1464프레임 · 24fps |
| 컷 | 9컷 · 평균 6.78초 · 최단 4.32 · 최장 9.39 (벤치마크 밴드 4~10초) |
| 해상도 | 1080x1920 |
| 나레이션 | minimax `speech-2.8-hd` · Korean_CalmGentleman · speed 0.8 · pitch -2 · 60.912초 |
| 그레이딩 | 무적용 |
| 전환 | 하드컷 |
| CTA | `lifeportfolio.co.kr` + "10년치 산출물을 한 페이지로" |

---

## 5. 이 파이프라인이 지키는 원칙

- **[CEO-102]** 성공 = ①대본-영상 일치 + ②몰입감 → ①을 `G4 violations 0` 로 기계화.
- **[CEO-51]** 컷 안에서 움직임, 정지 없음 → `G7` 로 기계화 + `RAMP` 로 처방.
- **[CEO-49]** 어절 단위 자막 → `ovl.wrap()` 이 어절 단위로만 끊는다.
- **[CEO-94/95]** 실물 해부가 아니면 반려 → 플레이트 프롬프트의 **PROOF OF THE CUT** 블록.
- **교훈 223** 게이트가 전부 초록이어도 **육안**. 실제로 이번 오버레이 결함 5건은
  게이트가 하나도 못 잡았고 육안만이 잡았다.
- **교훈 176** 상수는 참조. `cutsheet.py` 하나가 유일한 출처.
- **교훈 230** 도구는 영구 파일 + 자기검사(`selfcheck`).
