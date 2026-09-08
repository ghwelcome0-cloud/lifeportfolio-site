# 77. 하이브리드 3D 모션 콘텐츠 — 상시 생산 표준 (SOP)

> **[CEO-85] 지시**
> *"네 이제는 프래비즈를 넘어서 영상으로 제작하세요. 우리 롱폼과 숏츠를 하이브리드 3D 모션으로
> 원하는 품질과 우리 대본에 맞춤화된 영상을 만들기 위해서 너무 많은 시간과 비용을 지출했습니다.
> 낭비 수준이에요. 최소한 낭비가 되지 않고 목적 달성하고 앞으로 그 규칙에 따라 모든 콘텐츠를
> 생산하도록 성과를 냅시다!"*

이 문서는 그 지시의 마지막 절 — **「앞으로 그 규칙에 따라 모든 콘텐츠를 생산」** — 을 이행한다.
지금까지 219개 교훈과 10개 게이트로 흩어져 있던 규칙을, **처음 보는 사람이 이 한 문서만 읽고
영상 한 편을 끝까지 만들 수 있는 순서**로 통합했다. ([CEO-73] 재생산 지침)

---

## 0. 이 SOP 가 막으려는 것 — 「낭비」의 정의

[CEO-85] 가 「낭비」라고 지목한 것은 **렌더 자체가 아니라 「목적 없는 반복 루프」** 다.
낭비는 아래 3가지 형태로 발생했고, 각각에 대응 규칙이 있다.

| 낭비의 형태 | 실제 사례 | 이 SOP 의 대응 |
|---|---|---|
| **① 게이트를 추격하다 납품을 놓침** | v6→v7 렌더 후 픽셀 고립비 5건이 남자 「세트 조명 처방 → 재렌더」를 다음 계획으로 세웠다. CEO 는 이미 영상을 승인한 상태였다 ([CEO-82]) | **§6 납품 우선 원칙** — 자기 부과 게이트는 납품을 막을 권한이 없다 |
| **② 렌더 후에야 결함을 발견** | 알베도 8.11:1 설계가 렌더에서 1.29 였다 (교훈 217) | **§3 무료 검증을 렌더 앞으로** — 게이트 10종 전부 렌더 전 |
| **③ 같은 결함을 다시 만듦** | 거짓 양성이 나올 때마다 문턱을 낮췄고, 진짜 결함이 통과했다 | **§4 차원 추가 원칙** (교훈 219) |

**핵심 문장 3개 (이것만 외워도 낭비의 80% 가 사라진다)**

1. **렌더는 비싸고 게이트는 무료다.** 렌더 1회 = 1.15초/프레임. 게이트 10종 전량 = 0.43초.
2. **알베도 대비는 렌더 대비가 아니다.** 설계값을 성과로 보고하지 말고 렌더 픽셀을 읽어라.
3. **CEO 의 눈이 승인한 것을 내 코드가 반려하면 틀린 것은 내 코드다.**

---

## 1. 생산 파이프라인 — 7단계 (역순으로 비싸진다)

```
 [1] 대본 정본 읽기        SCRIPT_ACT*.csv          무료   0.1s
 [2] 기획 정본 읽기        74_SHORTS_TRILOGY_SPEC   무료   -
 [3] 설계 3파일 생성       sets → scenemap → scenejobs  무료  0.72s
 [4] 게이트 10종           script_gate.py           무료   0.21s   ★여기서 다 잡아라★
 [5] 렌더                  previz_batch.py          ★유료(시간)★ 1.15s/frame
 [6] 렌더 픽셀 직독        anchorpx.py              무료   5.5s/12f
 [7] 조립 + 오디오 + 납품  shorts916 / previzcut    무료   ~3분
```

**규칙**: **[4] 에서 FAILURES 0 이 아니면 [5] 로 가지 않는다.**
게이트를 「경고(NOTE)」로 만들면 결함이 그대로 렌더된다 (교훈 187 · 3회 실증).

**규칙**: **[6] 의 결과로 [5] 를 다시 돌리는 것은 1회까지만 허용한다.**
2회 이상 돌아야 한다면 그것은 렌더 문제가 아니라 **설계([3]) 또는 게이트 정의([4]) 문제**다.
설계로 돌아가라. 렌더를 반복하는 것이 [CEO-85] 가 말한 낭비다.

---

## 2. 실행 명령 전량 (복사해서 그대로 쓸 수 있다)

### 2.1 설계 → 게이트 (무료 · 0.43초 · 매 변경 후 필수)
```bash
cd /home/user/lf/r3d
python3 -u sets.py       # 세트 10종 · 250객체     ≈0.24s
python3 -u scenemap.py   # 무브 28종 · Z-FIT       ≈0.30s
python3 -u scenejobs.py  # 76잡 · lens 14 distinct ≈0.18s
python3 -u script_gate.py    # ★G1~G10 + Z-FIT★    ≈0.21s
# 반드시 마지막 줄이 `SCRIPT GATE OK` 이고 `FAILURES ...: 0` 이어야 한다
```

### 2.2 렌더 (시간 비용 발생 · 잡 선택 필수)
```bash
# ★기존 mp4 가 있으면 SKIP 된다 (previz_batch.py line 913-914) — 재렌더 전 반드시 대피★
mkdir -p /tmp/old_vN && mv /home/user/lf/r3d/_batch/J_A3-1{3,4,5,7}.mp4 /tmp/old_vN/

cd /home/user/lf/r3d
export PREVIZ_JOBS="J_A3-13,J_A3-14,J_A3-15,J_A3-17"   # 쉼표 구분 · 미지정 시 "all"
setsid nohup python3 -u previz_batch.py > /tmp/render.log 2>&1 < /dev/null &

# ★Bash 툴 타임아웃 120초 ⇒ 폴링해야 한다★
sleep 110; grep -E "^\[|BATCH DONE" /tmp/render.log | tail -5
```

### 2.3 렌더 픽셀 직독 (무료 · 교훈 217 의 도구)
```bash
mkdir -p /tmp/vNpx && cd /tmp/vNpx
cp /home/user/lf/r3d/anchor_audit/anchorpx.py .
# ★mp4 인코딩 후 PNG 디렉터리는 비워진다 ⇒ mp4 에서 추출해야 한다★
for J in J_A3-13 J_A3-14 J_A3-15 J_A3-17; do
  N=$(ffprobe -v error -count_frames -select_streams v:0 \
      -show_entries stream=nb_read_frames -of default=nw=1:nk=1 \
      /home/user/lf/r3d/_batch/$J.mp4)
  for P in 0 50 95; do
    K=$(( N * P / 100 )); [ $K -ge $N ] && K=$(( N - 1 ))
    ffmpeg -v error -i /home/user/lf/r3d/_batch/$J.mp4 \
      -vf "select=eq(n\,$K)" -vframes 1 -y ${J}_p${P}.png
  done
done
python3 anchorpx.py
```

### 2.4 숏폼 조립 + 나레이션 + 납품 ★[CEO-85] 의 목적지★
```bash
cd /home/user/lf/work/longform
python3 -u shorts916.py build   # ≈55s  → _c916/shortsC_916.mp4 (무음)
python3 -u shorts916.py gate    # ≈90s  FLOW GATE p95 >= 1.50px

# ★나레이션 결합 — 컷별 정렬이 핵심이다 (§5 참조)★
cd _c916 && python3 - << 'EOF'
import subprocess
A = "/home/user/lf/inbox/rd/v14_audio_500s.wav"
SEG = [(202.50, 255), (220.06, 129)]     # (오디오 시작초, 영상 프레임수)
FPS = 24.0; parts = []
for i,(t0,nf) in enumerate(SEG):
    out = "a%02d.wav" % i
    subprocess.run(["ffmpeg","-v","error","-y","-ss","%.5f"%t0,"-t","%.5f"%(nf/FPS),
                    "-i",A,"-ac","2","-ar","48000",out], check=True)
    parts.append(out)
open("acat.txt","w").write("".join("file '%s'\n" % p for p in parts))
subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0",
                "-i","acat.txt","-c","copy","narr.wav"], check=True)
EOF
ffmpeg -v error -y -i shortsC_916.mp4 -i narr.wav -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k -shortest shortsC_916_AUDIO.mp4
# → UploadFileWrapper 로 링크 납품
```

---

## 3. 게이트 G1~G10 정본 — 「무엇을 왜 막는가」

각 게이트는 **과거에 실제로 발생한 결함 1건 이상**에서 태어났다. 근거 없는 게이트는 없다.

| 게이트 | 무엇을 재는가 | 임계 | 태어난 결함 |
|---|---|---|---|
| **G1** | 대본에 없는 소도구를 넣었다 | got ∧ ¬want → FAIL | 임의 추가 |
| **G2** | 대본이 요구한 소도구가 없다 | want ∧ ¬got → FAIL | 누락 |
| **G3** | 앞 컷과 화면 문구가 같다 | cur == prev → FAIL | 「정답은 없습니다」 반복 ([CEO-74]) |
| **G4** | 시선점·반경이 거의 안 움직인다 | dt<0.35 ∧ dr<0.60 → NOTE | 정지 화면 |
| **G5** | 카메라가 대본 지정 소도구를 안 본다 | 거리 ≤ 0.25 m | 몰입 이탈 |
| **G6** | 주연이 화면에서 너무 작다 | 화면폭 ≥ 0.14 | 「크다 ≠ 보인다」 (교훈 210) |
| **G7** | 연속 컷의 샷 사이즈가 같다 | 배율대 중첩 ≤ 0.34 | 같은 크기 반복 |
| **G8** | 화각 밖 / 가려짐 | atan(36/2/lens) · AABB | 프레임 이탈 |
| **G9** | 앵커가 주연보다 안 밝다 / 런을 못 덮는다 | 비 ≥ 1.00 · 커버 ≥ 0.85 · 정체성 1종 | follow-the-object 부재 ([CEO-82]) |
| **G10** | 앵커 옆에 시선을 나눠 갖는 경쟁자가 있다 | 휘도 55% **∧** 크기 70% **∧** AABB 밖 | 화면 산만 (교훈 218) |
| **Z-FIT** | 카메라가 천장을 뚫는다 | z ≤ max(1.20, 세트높이×1.50) | 세트 밖 |
| **FLOW** | 화면이 사실상 정지다 | 광류 p95 ≥ 1.50 px | 「정지 검사 통과」는 품질이 아니다 |

### ★G10 의 3차원 — 이 SOP 의 가장 중요한 설계 교훈★

G10 을 처음 「밝다」 1차원으로 만들었더니 카드 위의 제목 바(`ttlbar`)를 경쟁자로 잡았다.
**문턱을 0.55 → 0.60 으로 올리는 것이 즉각적 유혹**이었지만, 그러면 진짜 결함도 통과한다.

좌표를 실측하니 `ttlbar` 는 앵커 카드의 **발자국 안에 완전히 들어 있었다**:
```
A3-14 card   x -0.030..0.230  y -0.070..0.110
A3-14 ttlbar x  0.007..0.193  y  0.037..0.067   ← 완전 포함
```
즉 「앵커 **옆**의 경쟁자」가 아니라 「앵커 **위**의 표식」이고, **대본이 그것을 요구한다**
(A3-14 화면 지시: *"조건 카드 **위** 굵은 제목 바 1개"*).

⇒ 처방은 문턱 완화가 아니라 **차원 추가**였다:
```
G10 = 밝다(휘도) × 크다(크기) × 떨어져 있다(위치)   — 3차원
면제 판정 = 후보 AABB 가 앵커 AABB 에 ★완전 포함★  (중심 포함이 아니다 — 교훈 211)
```
**★일반 규칙 (교훈 219)★**
> **거짓 양성은 「문턱을 낮추라」는 신호가 아니라 「기준의 차원이 하나 빠졌다」는 신호다.**
> 문턱 완화는 진짜 결함까지 통과시키고, 차원 추가는 거짓 양성만 제거한다.
> **게이트가 다른 게이트나 대본 요구와 충돌하면, 게이트의 정의가 틀렸다.**

---

## 4. 측정 신뢰도 위계 — 「무엇이 무엇을 반증하는가」

아래로 갈수록 값이 싸지만, **위가 아래를 항상 이긴다.**

| 순위 | 방법 | 지위 | 비용 |
|---|---|---|---|
| **1** | **CEO 의 눈·귀** | **유일한 합격 판정자** | - |
| 2 | CEO 제시 참조 이미지/영상 | 「승인 기준」 정본 | - |
| 3 | 대본 CSV 열 | 서사 정본 | 무료 |
| 4 | 기획 정본 (`74_..._SPEC.md`) | 사용 구간 정본 | 무료 |
| 5 | 승인본 픽셀 직독 (std1~3) | 조판 구조 정본 | 무료 |
| 6 | **Read 툴로 프레임 눈으로 보기** | **자동 검증의 최종 심판** | 무료 |
| 7 | 렌더 프레임 픽셀 직독 (`anchorpx.py`) | **알베도 설계를 반증** | 무료 |
| 8 | 게이트 실행 실패 메시지 | 결함 정본 | 무료 |
| 9 | 프로토타입 스윕 (`proto.py`) | 처방 방향 정본 | 무료 |
| 10 | 코드 집계 / grep / `--help` | 추측 대체 정본 | 무료 |
| 11 | 산술 진단 | ⚠ 렌더와 모순되면 렌더가 맞다 | 무료 |
| 12 | `analyze_media_content` | 참조 기법 규명 | ⚠ **유료** |

**규칙**: **1 위가 2~12 위를 모두 이긴다.** [CEO-82] 에서 CEO 가 *"이제 영상 자체는 군더더기가
없어요"* 라고 승인한 뒤에도 나는 7위(픽셀 고립비 1.35)를 근거로 재렌더를 계획했다.
[CEO-85] 가 그것을 「낭비」로 규정했다. **자기 부과 임계는 CEO 승인을 뒤집지 못한다.**

---

## 5. 나레이션 정렬 — 컷을 건너뛰면 오디오도 잘라 붙여야 한다

숏폼은 대본의 연속 구간을 그대로 쓰지 않는다. 앵커가 없는 컷은 제외되기 때문이다
(예: 숏폼 C 는 A3-16 / A4-01 을 제외 — `replan.py` P4a).

⇒ 오디오도 **컷 경계에서 잘라 이어붙여야** 나레이션이 화면과 맞는다.
연속 1구간(202.50~225.44, 22.94s)을 그대로 쓰면 **A3-16 의 6.96초가 화면과 어긋난다.**

**절차**
1. 대본 CSV 에서 컷별 `start` 를 초로 환산 (`3:22.50` → `202.50`)
2. 각 컷의 **영상 프레임 수 ÷ FPS** 를 그 세그먼트의 길이로 쓴다 (대본 `dur` 이 아니다 —
   렌더 프레임 수가 정본이다. 반올림 차이 0.02s 가 누적되면 립싱크가 밀린다)
3. 연속 컷은 하나의 세그먼트로 묶는다 (A3-13+14+15 = 255f = 10.625s)
4. `ffmpeg -f concat` 으로 이어붙인 뒤 **총 길이가 영상과 소수점까지 일치**함을 확인
5. `-c:v copy -c:a aac -shortest` 로 결합 (영상 재인코딩 금지 — 화질 손실)

**실측 검증 (숏폼 C)**
```
seg0  t0=202.50  want=10.62500  got=10.625000   (A3-13,14,15 = 255f)
seg1  t0=220.06  want= 5.37500  got= 5.375000   (A3-17      = 129f)
NARR total = 16.000000   ==   video 16.000000   ★소수점까지 일치★
```

---

## 6. 납품 우선 원칙 ★[CEO-85] 의 핵심★

### 6.1 자기 부과 게이트 vs 납품

게이트는 **두 종류**다. 이 구분이 [CEO-85] 낭비 방지의 핵심이다.

| 종류 | 예 | 미달 시 |
|---|---|---|
| **대본/기획 게이트** (G1~G3, 사용 구간) | 대본에 없는 소도구, 문구 중복 | **★납품 중단★** — 합의 위반이다 |
| **품질 하한 게이트** (G5~G10, FLOW) | 앵커 크기, 광류 | **★납품 중단★** — 관객이 못 본다 |
| **자기 부과 개선 목표** (`ISOLATION_MIN=1.35` 등) | 픽셀 고립비 | **★납품하고 다음 배치에 반영★** |

**판별 질문 3개**
1. 이 임계값을 **CEO 가 제시했거나 대본/기획이 요구**하는가? → 아니면 자기 부과다
2. 이 수준으로 **CEO 가 이미 승인**한 산출물이 있는가? → 있으면 납품이 우선이다
3. 미달을 고치려면 **렌더를 다시 돌려야** 하는가? → 그렇다면 다음 배치로 이월한다

### 6.2 이번 판단 기록 (전례로 남긴다)

**상황**: v7 렌더 후 `anchorpx.py` 가 4컷 12프레임 중 5건에서 고립비 미달을 냈다.
```
J_A3-13  1.18~1.20  (하한 1.35 미달)
J_A3-17  1.28~1.29  (후반부 미달)
J_A3-14  1.62~1.63  통과      ← v6 대비 2등 138 → 115.7 개선
J_A3-15  1.37~1.62  통과      ← 개선
```
**원인 규명 (좌표 실측)**: 2등 덩어리는 이웃 종이(`note`)가 아니라 **L≈138 의 벽면/구조물**이었다.
```
J_A3-13_p50  2등 L138.9  12811px  x822-1124 y637-719   ← 벽
J_A3-17_p50  2등 L138.2   6231px  x669-836  y78-142    ← 벽
```
`ENV_WALL_HI = (0.215, 0.203, 0.186)` 이 렌더에서 138 로 올라오는 반면,
알베도 0.94 앵커는 164 로밖에 못 올라온다. ⇒ **종이 색으로는 고립비를 못 올린다.**

**판단**: **(B) 현 v7 로 조립·납품.** 근거 4가지
1. 하한 1.35 는 **내가 정한 값**이고 CEO·대본·기획 어디에도 없다 (§6.1 판별 1)
2. CEO 는 동일 수준 영상을 이미 승인했다 — [CEO-82] *"영상 자체는 군더더기가 없어요"* (판별 2)
3. 처방은 벽 톤 변경 = **전 세트 재렌더** 필요 (판별 3) — [CEO-85] 가 「낭비」로 규정한 루프
4. 실제로 **필수 게이트는 전부 통과**했다: SCRIPT GATE FAILURES 0 · FLOW p95 min 15.09 (하한의 10배)

**이월**: `ENV_WALL_HI` 하향은 **다음 신규 렌더 배치에서 함께 반영**한다.
기존 클립을 위해 단독 재렌더하지 않는다.

---

## 7. 세션 규율 — 「왜 자꾸 멈추나요」 ([CEO-80] A · [CEO-84])

| 금지 | 대신 |
|---|---|
| 승인 요청으로 턴을 끝낸다 | 판단 근거를 기록하고 **진행한다** |
| 긴 작업 앞에서 멈춘다 | `setsid nohup … &` + `sleep 110` 폴링 |
| 결과를 기다리며 아무것도 안 한다 | 렌더 27분 동안 **문서·SOP·다음 단계 준비** |
| 실패를 숨긴다 | 실패 이력에 번호를 붙여 남긴다 (현재 29건) |

**병행 작업 패턴 (이번 세션 실적)**
```
[렌더 백그라운드 착수]  ─┬─ 문서 작성 (SOP · CEO 지시 기록)
                        ├─ 다음 단계 자산 확인 (오디오 구간 CSV 실측)
                        └─ 폴링 (sleep 110 → tail log)
```

---

## 8. 교훈 인덱스 — 상황별 즉시 조회

`71_HYBRID_3D_PRODUCTION_RULES.md` 의 교훈 1~221 중 **생산 중 가장 자주 필요한 것들**.

| 상황 | 교훈 | 한 줄 |
|---|---|---|
| 처방을 코드에 넣기 직전 | **206** | 프로토타입 스윕으로 먼저 반증하라 |
| 처방값을 정할 때 | **208** | 게이트가 재는 값과 **같은 값**으로 계산하라 |
| 게이트는 통과했는데 이상하다 | **210** | 「크다」는 「보인다」가 아니다 |
| 면제 규칙을 만들 때 | **211** | 「어울리는가」 ≠ 「안에 있는가」 |
| 픽셀 측정이 이상하다 | **212** | 마스크가 대상 색을 전제하면 픽셀도 거짓말한다 |
| 게이트 다 통과했다 | **213** | 게이트 통과 앵커 ≠ 관객 붙잡는 앵커 |
| 관객 개선 처방을 낼 때 | **214** | 처방도 **대본 제약**을 통과해야 한다 |
| 새 게이트를 만들 때 | **215** | 「실패」로 세워라. 0건 잡으면 느슨하다는 신호 |
| 대본에 좋은 장면이 있다 | **216** | **납품 구간 밖**이면 쓸 수 없다 |
| 대비를 설계했다 | **217** | 알베도 대비 ≠ 렌더 대비. 렌더 픽셀을 읽어라 |
| 화면이 산만하다 | **218** | 게이트가 대상 하나만 보면 산만함은 남는다 |
| 거짓 양성이 나왔다 | **219** | 문턱 낮추지 말고 **차원을 추가**하라 |
| 상수의 의미를 바꿀 때 | 218 부 | **사용처 전수 grep** (S7 `note` 를 놓쳤다) |
| CEO 승인본과 내 코드가 충돌 | **131** | 틀린 것은 내 코드다 |
| 자기 부과 임계에 미달했다 | **220** | **자기 부과 게이트는 납품을 막을 권한이 없다** |
| 컷을 건너뛰고 조립한다 | **221** | 오디오도 컷 경계에서 잘라 붙여라 |

---

## 9. 환경 실측 — 「추측하지 말고 이 표를 봐라」

```
CPU 2코어 · RAM 3939MB · GPU 없음 · 디스크 7.0G
python 3.13.13 · ffmpeg 7.1.5 · bpy 5.2.0 · Pillow · numpy · ImageMagick
★EEVEE 불가 (CYCLES CPU) · yt-dlp 유튜브 불가 · scipy 없음 (flood fill 손구현)★
폰트 /usr/share/fonts/truetype/nanum/{NanumGothicBold,NanumGothic}.ttf
```
| 작업 | 실측 시간 |
|---|---|
| sets / scenemap / scenejobs / script_gate 전량 | **0.43s** |
| 프리비즈 렌더 | **1.13~1.20 s/frame** (384f = 7.6분) |
| 9:16 build / gate | 55s / 90s |
| anchorpx 12프레임 / ffmpeg 추출 | 5.5s / 10s |
| 오디오 절단+결합+먹싱 | ~3.5s |

**함정 목록 (전부 실제로 당했다)**
- `Bash` 툴 타임아웃 **120초** ⇒ 장시간 작업은 `setsid nohup … > log 2>&1 < /dev/null &`
- `python3 -u` 없으면 로그가 버퍼링돼 폴링이 무용해진다
- **기존 mp4 가 있으면 렌더가 SKIP** (`previz_batch.py` line 913-914) ⇒ 재렌더 전 대피
- **mp4 인코딩 후 프레임 PNG 디렉터리는 비워진다** ⇒ mp4 에서 `select=eq(n\,K)` 로 추출
- `pgrep -f` 는 **자기 자신을 잡는다** ⇒ `ps -ef | grep X | grep -v grep`
- 대본 CSV 는 **BOM** ⇒ `encoding="utf-8-sig"` 필수
- `scenejobs.json` 최상위는 **dict** `{"jobs":[...]}`. 세트는 `j["set"]`(S7),
  `j["sids"][0]` 은 **비트 id** 라서 `build_spec` 이 죽는다
- 파일 편집 전 `cp <f> /tmp/<f>.bak` · 치환 전 `grep`/`cat -A` 로 **실제 포맷(인덴트·공백 패딩)** 확인
- 안전한 편집: **줄 인덱스 기반 재조립 + 내용 assert** (heredoc 치환 + `assert count==1` 은 원자적)

---

## 10. 산출물 체크리스트 — 이걸 다 채우면 게시 가능

```
[ ] SCRIPT GATE OK · FAILURES 0                     (script_gate.py)
[ ] 렌더 완료 · BATCH DONE                          (previz_batch.py)
[ ] 렌더 픽셀 직독 실행 + 결과 기록                 (anchorpx.py)  ※미달은 §6.1 로 판별
[ ] 조립 완료 · 목표 길이 달성 (숏폼 15s 이상)      (shorts916 build)
[ ] FLOW GATE p95 >= 1.50px · 미달 윈도 0           (shorts916 gate)
[ ] 글자 클리핑 0 · 프레임 엣지 접촉 0              (CLIP GATE)
[ ] 나레이션 결합 · 길이 소수점까지 일치            (§5)
[ ] ★Read 툴 육안 확인★ (최소 3프레임: 도입/중반/종반)
[ ] 업로드 + 링크 납품                              (UploadFileWrapper)
[ ] 판단 근거 기록 (특히 게이트 미달을 납품한 경우)
[ ] 문서 갱신 + 커밋/푸시                           (항구 지침 ①)
```

---

## 11. 이 SOP 로 생산한 첫 산출물 (전례)

| 항목 | 값 |
|---|---|
| 제목 | **연봉만 보면 놓치는 것** (숏폼 C) |
| 규격 | 1080x1920 · 24fps · **16.00s** · H.264 + AAC 192k · 1.10 MB |
| 컷 | 4컷 (J_A3-13 / 14 / 15 / 17) · 384 프레임 |
| 나레이션 | `v14_audio_500s.wav` 202.50~213.125 + 220.06~225.435 |
| SCRIPT GATE | **OK · FAILURES 0** · G9 4/4 · G10 4/4 |
| FLOW GATE | p95 min **15.09** / med 24.59 / max 35.32 (하한 1.50) · 미달 0/7 |
| CLIP GATE | glyph 0 / 엣지 접촉 0 |
| 픽셀 고립비 | 5/12 미달 → **§6.2 판단으로 납품** · `ENV_WALL_HI` 다음 배치 이월 |
| 납품 | https://www.genspark.ai/api/files/s/p2X4kHHb |

---

## 부록 A. 파일 소관 지도

| 파일 | 역할 | 편집 시 주의 |
|---|---|---|
| `r3d/sets.py` | 세트 10종 · 색 상수 · 소도구 | 색 상수 의미 변경 시 **사용처 전수 grep** |
| `r3d/scenemap.py` | 무브 28종 · Z-FIT | 세트 높이 상한 확인 |
| `r3d/scenejobs.py` | 76잡 · 렌즈 · gaze | `refine_lens()` 화각 미고려 (P0 잔여) |
| `r3d/script_gate.py` | **G1~G10 게이트** | `build_spec` 은 **함수 안 로컬 import** (line 316) |
| `r3d/previz_batch.py` | 렌더 | `PREVIZ_JOBS` env · 기존 mp4 SKIP |
| `r3d/anchor_audit/*.py` | 검증 스위트 10종 | `anchorpx.py` 가 렌더 반증 정본 |
| `work/longform/shorts916.py` | **9:16 숏폼 조립** | `CUTS` 가 컷 선택 정본 |
| `work/longform/previzcut.py` | 롱폼 조립 | HEAD 제거 / TOTAL 해제 필요 |
| `_script/SCRIPT_ACT*.csv` | **대본 정본** | BOM · 읽기 전용 |

## 부록 B. 승인 기준 3장 조판 규격 (픽셀 직독 정본)

| 항목 | std1 | std2 | std3 (상한) |
|---|---|---|---|
| panel_w / frame_w | 0.422 | 0.447 | **0.633** |
| glyph_h / frame_h | 0.0885 | 0.1390 | **0.1893** |
| 줄 수 | 1 | 1 | 3 |
| 본문 줄 aspect | 6.292 | 4.603 | **6.830** |

**공통 문법**: `B >= G > R` 항상 · 흰 글자는 순백 아님(240 전후) · **문구가 문장 단위**
**금지**: 어절 파편만 던지기 · 글리프 클리핑 · 프레임 엣지 접촉

---

*작성 근거: [CEO-85] ⑤ "앞으로 그 규칙에 따라 모든 콘텐츠를 생산하도록 성과를 냅시다"*
*[CEO-73] "재생산이 가능하도록 늘 일을 구축해야 해요. 누군가의 지식화가 또 다른 누군가에게도 지식이 되도록"*

---

## §12 롱폼 조립 — `longcut.py` (숏폼과 무엇이 다른가)

### 12.1 왜 `previzcut.py` 를 고치지 않고 새 파일을 만들었는가

`previzcut.py` 는 **「대표님이 시뮬레이션을 검토하는 컷」** 을 만든다.
그 목적에 좋은 모든 요소가 **게시를 불가능하게 만든다.**

| 요소 | 검토에는 좋다 | 게시에는 |
|---|---|---|
| 인트로 슬레이트 | "이건 프리비즈다" | ❌ |
| `ROUGH PREVIZ` 태그 | "아직 미완성이다" | ❌ |
| 샷 ID 표시 | "12번 샷에 피드백 주세요" | ❌ |
| 러닝 타임코드 | "몇 초 지점인지 말해주세요" | ❌ |
| HEAD (3608f) | 앞 3개 ACT 를 실사로 채운다 | ❌ **[CEO-67] 반려 1·2 = 짜깁기 / 헤드 소재 폐기** |

[CEO-85] 가 그 단계를 닫았다 — *"이제는 프래비즈를 넘어서 영상으로 제작하세요."*
**구석에 `ROUGH PREVIZ` 가 박힌 영상은 화면이 아무리 좋아도 여전히 프리비즈다.**

그래서 `previzcut.py` 는 **검토용으로 그대로 보존**하고,
납품용 조립기 `longcut.py` 를 **신설**했다. 도구를 용도별로 분리한 것이다.

### 12.2 개조 4항 — 어디에 구현되었는가

| # | 개조 | 구현 |
|---|---|---|
| ① | **HEAD 제거** | `plan()` 이 `scenejobs.json` 76잡만 읽는다. HEAD 상수 자체가 없다 |
| ② | **TOTAL 12000 하드게이트 해제** | 길이는 잡이 정한다. 유일하게 남은 제약은 **물리적 제약** — 오디오가 없는 프레임은 나레이션할 수 없다 |
| ③ | **자막 시안 네온** | `SUB_INK`/`SUB_RIM`/`SUB_SHADOW` = `shorts916.py` 와 **동일 상수**. 롱폼과 숏폼이 한 채널로 읽힌다 |
| ④ | **나레이션 오프셋** | 오디오를 `t0 = 150.32s` 에서 절단. 길이는 **렌더 프레임 수 ÷ FPS** (교훈 221). SRT 도 `-t0` 만큼 재타이밍 |

### 12.3 ★숏폼과 롱폼의 결정적 차이 — 오디오 절단 방식★

| | 숏폼 C | 롱폼 |
|---|---|---|
| 컷 건너뜀 | **있다** (A3-16, A4-01 제외) | **없다** (76잡 전량, 대본 순서) |
| 오디오 절단 | **2 세그먼트 + concat** | **1 세그먼트** |
| 근거 | 교훈 221 — 건너뛴 만큼 어긋난다 | 연속이므로 통째로 자르면 맞다 |

**즉 교훈 221 은 "항상 잘라 붙여라"가 아니다.**
**"컷을 건너뛰었는지 먼저 확인하라"** 이다. 롱폼은 건너뛰지 않으므로 1 세그먼트가 정답이다.
`longcut.py` `cmd_deliver()` 주석에 그 판단 근거를 남겼다.

### 12.4 자막 재타이밍 — 교훈 221 의 자막 판

500초 마스터에 맞춰 쓰인 SRT 는 **HEAD 를 제거한 순간 전부 틀린다** — 모든 큐가 150초 늦다.

```python
shift_srt(SRT, srt2, offset=t0, dur=want)
#   모든 큐를 -t0 만큼 이동
#   [0, dur] 밖으로 나간 큐는 버린다
#   생존 큐가 0개면 FAIL (조용히 자막 없는 영상을 내지 않는다)
```

**규칙**: 화면이 시작하는 지점을 바꾸면, **그 시작에 묶여 있던 모든 것**(오디오·자막·
오버레이 타이밍)을 함께 재계산해야 한다.

### 12.5 실행 명령

```bash
cd /home/user/lf/work/longform

# [1] MAP — 산술 + 존재 확인만. 무료. 렌더 미완이면 MISSING 목록을 낸다
python3 -u longcut.py map

# [2] FILM — 무음 픽처 (오버레이 없음)
python3 -u longcut.py film

# [3] DELIVER — 나레이션 + 시안 네온 자막
python3 -u longcut.py deliver
#   → longform_deliver.mp4
```

**MAP 을 먼저 돌리는 이유**: 렌더가 하나라도 빠져 있으면 concat 이 **조용히 짧은
영상을 만든다.** MAP 은 그것을 **렌더 시간 0초에** 잡는다 (파이프라인 §1 의 정신).

### 12.6 MAP 이 실제로 잡은 것 (전례)

```
longform pieces 76   planned frames 8399 = 349.958 s
first job J_A3-01  t0 150.32 s   last job J_A8-GAP  t1 500.00 s
  MISSING J_A7-04 -> /home/user/lf/r3d/_batch/J_A7-04.mp4
  MISSING J_A7-06 -> /home/user/lf/r3d/_batch/J_A7-06.mp4
  MISSING J_A7-12 -> /home/user/lf/r3d/_batch/J_A7-12.mp4
MAP FAILED  3 pieces are not on disk
```

렌더 진행 중에 MAP 을 돌려 **남은 잡이 정확히 무엇인지** 확인했다.
이것이 무료 게이트를 먼저 세우는 이유다.

### 12.7 롱폼 규격 (설계값)

```
76 잡 · 8399 프레임 · 349.958 초 (약 5분 50초)
대본 구간 150.32 s ~ 500.00 s  (ACT3 ~ ACT8)
오디오 절단  t0 = 150.32 s, 길이 = 8399 / 24 = 349.958333 s
HEAD 없음 · 슬레이트 없음 · ROUGH PREVIZ 없음 · 샷 ID 없음 · 타임코드 없음
```

⚠ **주의**: `previzcut.py` 의 `JOBS` 는 `jobs.json` (60잡 레거시 · t0/t1 없음).
`longcut.py` 의 `JOBS` 는 `scenejobs.json` (76잡 · t0/t1 있음).
**두 파일은 서로 다른 잡 목록을 본다.** 이것도 `previzcut.py` 를 제자리에서 고치지 않은 이유다.

---

## §12.8 ★MAP 게이트는 「존재」가 아니라 「프레임 수」를 검사한다 (교훈 222)★

### 전례 — 게이트가 세 단계에 걸쳐 결함을 좁혔다

```
1) longcut.py map    → MAP OK  76 pieces           ← 파일 존재만 확인. ★통과시켰다★
2) longcut.py film   → FILM FAILED  concat produced 9330 f, jobs declare 8399
3) 조각별 ffprobe    → MISMATCH 11잡  +931 f (= 38.8 초)
```

`_batch/` 에 76개가 다 있었다. 그런데 **11개가 08-22~23 구세대** 였다.
`sets.py`/`scenemap.py`/`scenejobs.py` 는 08-28 에 수정되었고, 그 사이 대본의
`frames` 값이 바뀌었는데 `previz_batch.py` 의 **SKIP 로직**(기존 mp4 가 있으면 건너뜀)이
재렌더를 막았다.

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

**그대로 붙였다면 나레이션이 38.8초 어긋난 영상을 납품했다.**

### 처방 — `cmd_map()` 강화 (적용 완료)

```python
# [lesson 222]  Existence is NOT freshness.
missing, stale = [], []
for r in rows:
    if not os.path.exists(r["src"]):
        missing.append(r); continue
    got = nframes(r["src"])
    if got != r["want"]:
        r["got"] = got; stale.append(r)
if missing or stale:
    ... print("  STALE   %s  want %4d f  got %4d f  (delta %+d)")
    print("  re-render list: %s" % ",".join(r["job"] for r in stale))
    print("MAP FAILED  %d missing + %d stale of %d pieces")
    return 1
```

`re-render list` 를 그대로 `PREVIZ_JOBS` 에 넣을 수 있게 **쉼표 구분으로 출력**한다.

### 복구 절차 (표준화)

```bash
# 1) 구세대 조각을 대피한다 (덮어쓰지 않는다 — SKIP 로직이 있으므로 반드시 이동)
mkdir -p /tmp/gen0822
cd /home/user/lf/r3d && for j in <re-render list를 공백구분으로>; do mv _batch/$j.mp4 /tmp/gen0822/; done

# 2) 재렌더 (PREVIZ_JOBS = MAP 이 출력한 re-render list 그대로)
cd /home/user/lf/r3d && PREVIZ_JOBS="J_A3-02,J_A3-04,..." \
  setsid nohup python3 -u previz_batch.py > /tmp/lfNN.log 2>&1 < /dev/null &

# 3) MAP 재실행 → MAP OK 확인 후 film
cd /home/user/lf/work/longform && python3 -u longcut.py map
```

### ★이 재렌더는 「낭비 루프」가 아니다 — 교훈 220 판별★

| 판별 질문 | 답 |
|---|---|
| ① CEO 가 제시했거나 대본/기획이 요구하는가? | **예 — `frames` 는 대본 정본이다** |
| ② 이 수준으로 CEO 가 이미 승인한 산출물이 있는가? | **없다 — 11잡은 현세대로 한 번도 렌더된 적이 없다** |
| ③ 미달을 고치려면 렌더를 다시 돌려야 하는가? | 예 — 그러나 ①②가 「합의 게이트」로 판정한다 |

⇒ **합의 게이트 = 납품 중단 정당** (자기 부과 게이트인 `ISOLATION_MIN` 과 혼동하지 말라)

### 규칙으로 남기는 문장

**「파일이 있다」는 「그 파일이 지금 대본으로 만들어졌다」를 뜻하지 않는다.**
설계 파일을 수정하면 **그 파일에 의존하는 산출물 전량의 프레임 수를 대조하라.**
mtime 비교로 대신하지 말라 — mtime 은 내용이 실제로 바뀌었는지 말해주지 않고,
**프레임 수는 말해준다.**

---

# §13 컷 분할 · 색 세대 감사 · 자막 조판 · 정본 쓰기 (2026-08-28 확립)

이 절은 **[CEO-85]** 의 ⑤ 「앞으로 그 규칙에 따라 모든 콘텐츠를 생산하도록」 에 대한
**상시 생산 표준** 이다. 프리비즈 단계를 넘어 「영상」을 납품하기 위해 반드시 통과해야 하는
4개 절차를 순서대로 규정한다.

## §13.1 절차 순서 (반드시 이 순서)

```
① scenejobs.py       — 대본/장면맵에서 잡을 결정적으로 재생성   (0.3s · 무료)
② cutsplit.py apply  — G11 리듬 분할 (총 프레임 불변)           (0.3s · 무료)
③ script_gate.py     — G1~G11 + Z-FIT 전량 검증 → FAILURES 0    (0.3s · 무료)
④ previz_batch.py    — ★통합 배치 1회★ 전량 렌더              (2.85h · CPU)
⑤ genaudit.py        — 채도 색 세대 감사 → OLD-GEN 0            (100s · 무료)
⑥ longcut.py map     — 프레임 수 대조 + re-render list          (28s · 무료)
⑦ longcut.py film    — body 조립 + trim                          (수분 · 무료)
⑧ longcut.py deliver — 나레이션 결합 + 자막 조판 + SUB GATE      (110s · 무료)
⑨ 육안 확인 5프레임  — ffmpeg select + Read 툴                   (무료)
⑩ UploadFileWrapper  — 납품 링크 생성 → 대표님께 보고
```

**★①~③ 은 전부 0.3초 무료다. ④ 앞에서 반드시 초록으로 만들어라.★**
유료·장시간 단계(④)를 게이트 검증 전에 돌리는 것이 대표님이 「낭비 수준」이라 하신 그것이다.

## §13.2 컷 분할 (cutsplit.py) — 품질과 비용을 동시에 개선하는 유일한 지점

### 왜 이것만 다른가

| 개선 항목 | 품질 | 렌더 시간 |
|---|---|---|
| 해상도 상향 | ↑ | **↑↑ (비용 증가)** |
| 샘플 수 상향 | ↑ | **↑↑ (비용 증가)** |
| 프레임 추가 | ↑ | **↑ (비용 증가)** |
| **★컷 분할★** | **↑ (리듬 med 4.29s → 2.62s)** | **★불변 (8399 → 8399)★** |

컷 분할은 **총 프레임을 바꾸지 않는다.** 같은 궤적을 「연속된 구간」으로 쪼개기 때문이다.
벤치마크 6/6 이 컷 길이 0.5~4초인데 우리 롱폼은 med 4.29초였다.
**⇒ 비용 0 으로 벤치마크 대역에 진입하는 유일한 항목이다.**

### 명령

```bash
cd /home/user/lf/r3d
python3 -u cutsplit.py plan     # 계획만 (쓰지 않는다)
python3 -u cutsplit.py apply    # SPLIT GATE 통과 시에만 쓴다
python3 -u cutsplit.py revert   # presplit 백업으로 복원 (검증 후에만)
```

### SPLIT GATE 8종 — 신설 즉시 내 코드의 결함 117건을 잡았다

| # | 검사 | 근거 | 자기 적발 |
|---|---|---|---|
| ① | FRAME SUM 보존 (`8399 -> 8399`) | 대본이 정한 값 (교훈 222) | — |
| ② | `job_id` 중복 0 | 렌더 잡 충돌 방지 | — |
| ③ | `sid` 중복 0 | 자막 큐 중복 방지 | — |
| ④ | 숏폼 C 4컷 보존 | CEO 승인본 (교훈 131) | — |
| ⑤ | ARC 일치 (`_arc_of`) | 극좌표 원호 (교훈 225) | **★87건★** |
| ⑥ | HEIGHT ≥ 0.812 (`DESK_Z+0.05`) | 책상 아래로 안 내려간다 | — |
| ⑦ | RADIUS 원 컷 대역 ±0.02 내 | 원 안쪽 관통 방지 | — |
| ⑧ | SEAM ≤ 1프레임 실측 이동량 × 1.25 | 물리량 임계 (교훈 226) | **★30건★** |

**★게이트를 「실패」로 세웠기 때문에 87 + 30 = 117건이 렌더 전에 잡혔다.★**
이 117건이 렌더 후에 발견되었다면 2.85시간을 버렸다.

### 분할 면제 규칙 (why_skip)

```python
SHORTS_C_LOCK = ("J_A3-13", "J_A3-14", "J_A3-15", "J_A3-17")   # CEO 승인·납품본
EXEMPT_SUFFIX = ("GAP",)                                        # 전환 홀드

def why_skip(j):
    jid = j["job_id"]
    if jid in SHORTS_C_LOCK:                   return "숏폼C 승인본 (교훈 131)"
    if jid.endswith(EXEMPT_SUFFIX):            return "GAP (리듬 면제)"
    if j.get("word_gesture","none") != "none": return "글자 실린 컷 (CEO-49/57/58)"
    if j["frames"]/float(FPS) <= CUT_LEN_MAX:  return "이미 상한 이내"
    return None
```

**실측 확인** — G11 초과 44컷 **전부** `word_gesture="none"` 이었다.
⇒ 「글자 실린 컷은 쪼개지 않는다」 면제로 **잃는 것이 하나도 없다.**

### 조각별 hold / ease — [CEO-51] 준수

```python
p["hold_frac"] = hold if i == 0 else 0.0      # ★조각2+ 는 정지 없음★
p["ease"]      = ease_name if i == 0 else "linear"   # ★없던 펄스를 만들지 않는다★
p["chain"]     = True if i > 0 else bool(j["chain"])
p["cut"]       = bool(j["cut"]) if i == 0 else False
p["sids"]      = list(j["sids"]) if i == 0 else []
```

**★원 컷에 없던 정지나 가속을 조각이 새로 만들어서는 안 된다.★**
`hold` 와 `ease` 는 첫 조각만 물려받고, 뒤 조각은 `0.0` / `linear` 로 **등속 통과**한다.
이것이 [CEO-51] 「컷 안에서 움직임 · 정지 없음」의 코드 구현이다.

### 상위 게이트 2건 면제 — 「출처」로 지위를 가려라

| 게이트 | FAIL | 판정 | 처방 |
|---|---|---|---|
| **G11** 3건 | 숏폼 C 4컷 | **★게이트가 CEO 승인본을 반려했다★** | `RHYTHM_LOCKED` 명시 면제 (교훈 131) |
| **G7** 7건 | 전부 `X_s1 -> X_s2` | **★게이트의 적용 범위 오류★** | `prev_split_of` 로 분할 형제 건너뛰기 |

G7 은 「다른 컷을 같은 크기로 또 찍었다」를 잡는 게이트다. 그런데 분할 조각은
**같은 컷의 이어지는 구간** 이므로 샷 크기가 겹치는 것이 당연하고, **겹치지 않으면
오히려 궤적이 끊긴 것이다.** ⇒ 임계를 늘리는 게 아니라 **적용 범위를 고쳤다.**

## §13.3 색 세대 감사 (genaudit.py)

### 왜 필요한가

`sets.py` 의 색 상수를 바꿔도 **프레임 수는 바뀌지 않는다.**
따라서 MAP GATE(프레임 대조)로는 구세대 렌더를 절대 잡을 수 없다.
게이트 3단이 전부 초록인데 롱폼 76컷 중 **42컷이 구세대 색** 이었다 (교훈 223).

### 명령과 판정

```bash
cd /home/user/lf/r3d && python3 -u genaudit.py     # ≈100초
```
판정식: `frac(sat > 60) > 0.03` → **OLD-GEN**
출력에 `re-render list:` 쉼표 목록이 포함된다 ⇒ **그대로 `PREVIZ_JOBS` 에 붙인다** (CEO-73).

### mtime 교차 확인 (신뢰도 위계 7.5)

```
★sets.py mtime = 08-28_07:26★
NEW-GEN (34잡)  08-28 08:16 ~ 09:12       OLD-GEN (42잡)  08-22 ~ 08-23
⇒ sets.py 변경 이후 렌더된 잡만 신세대. 파일시스템이 입증한다.
```

**★색 상수를 바꿨다면 채도 감사 + mtime 두 축으로 확인하라. 프레임 수는 침묵한다.★**

## §13.4 자막 조판 (longcut.py) — 우리가 조판한다

### 절대 규칙

**자막 줄바꿈을 렌더러(libass)에 맡기지 않는다** (교훈 224).
libass 자동 줄바꿈은 **글자 중간에서 끊는다.** [CEO-49] 어절 단위 자막의 정면 위반이다.

### 3중 장치

```python
# ① 어절 경계에서만 나눈다
def wrap_words(body):
    words = " ".join(body.split()).split(" ")
    lines, cur = [], ""
    for w in words:
        cand = w if not cur else cur + " " + w
        if cur and _measure(cand) > _SAFE_PX:
            lines.append(cur); cur = w
        else: cur = cand
    if cur: lines.append(cur)
    if len(lines) > _MAX_LINES:
        lines = lines[:_MAX_LINES-1] + [" ".join(lines[_MAX_LINES-1:])]
    return "\n".join(lines)

# ② ASS 에 WrapStyle=2 (자동 줄바꿈 금지) 를 반드시 넣는다
force_style = "...,WrapStyle=2,..."

# ③ SUB GATE — 조판 결과를 스스로 검증한다
_SAFE_PX   = 1094      # 승인본 std3 픽셀 계측에서 온 값
_MAX_LINES = 3         # 승인본 std3 = 3줄 (상한)
```

**★`WrapStyle=2` 를 빼면 ①의 조판이 무효화된다. 세 개가 한 세트다.★**

### 캘리브레이션 원칙

`_SAFE_PX` 는 **실제 납품 렌더 프레임** 에서 계측한다. 측정용 임의 포인트(55pt)로
계산하면 실제 조판(56pt)과 어긋나 게이트가 거짓 초록을 낸다.

## §13.5 정본 파일 쓰기 (WRITE GATE) — 읽기 → 검증 → 쓰기

### 사고 실측

```
scenejobs.json           float  jobs= float  0.01130884609498245     ★19 바이트★
scenejobs.presplit.json  float  jobs= float  0.01130884609498245     ★19 바이트★
```

8399프레임 설계가 담긴 정본과 그 백업이 **둘 다** 파괴되었다.
원인은 `cmd_plan()` 안의 **변수 섀도잉** 이었다 (교훈 227).

```python
d = json.load(open(JOBS))                              # 정본 데이터
...
d = math.dist(a["cam_end_xyz"], b["cam_start_xyz"])    # ★같은 이름이 덮었다★
...
json.dump(d, open(BAK, "w"))                           # ★float 을 백업에 썼다★
```
그리고 `revert` 는 그 손상 백업을 **검증 없이 먼저 정본에 쓰고** 나서 죽었다.

### 3중 처방 (전부 구현 완료)

```python
def _valid_jobs(jl):
    """정본 형태 검증 — 잡 리스트이고, 각 원소가 job_id/frames 를 가진 dict."""
    if not isinstance(jl, list) or not jl:               return False
    for j in jl:
        if not isinstance(j, dict):                      return False
        if "job_id" not in j or "frames" not in j:       return False
        if not isinstance(j["frames"], int) or j["frames"] < 1: return False
    return True

def _write_jobs(path, jl, label, skip_if_exists=False):
    """★검증 후에만★ 쓴다. 임시 파일에 쓰고 원자적으로 교체한다."""
    if skip_if_exists and os.path.exists(path): return
    if not _valid_jobs(jl):
        raise SystemExit("WRITE GATE FAILED  %s (%s) — 정본을 보호했다"
                         % (path, type(jl).__name__))
    tmp = path + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"jobs": jl}, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, path)                # ★원자적 교체 — 중간 상태 없음★
```

① **WRITE GATE** — `_valid_jobs()` 통과 후에만 쓴다
② **원자적 교체** — `tmp` + `os.replace()` 로 반쯤 쓰인 파일이 남지 않는다
③ **읽기→검증→쓰기 순서** — `revert` 는 백업을 **먼저 검증하고** 나서 정본에 쓴다

### 복구 경로를 반드시 유지하라 — 이번에 이것이 전부를 살렸다

```bash
cd /home/user/lf/r3d && rm -f scenejobs.presplit.json && python3 -u scenejobs.py
★SCENEJOBS OK  76 jobs  8399 f = 349.958 s★
```

`scenejobs.json` 은 손 편집 파일이 아니라 **`scenemap.json` + `rows38.json` + CSV 에서
결정적으로 재생성되는 파생 파일** 이다. 그래서 정본과 백업이 동시에 파괴되었는데도
**복구가 1초** 로 끝났다.

**★파생 파일은 「생성 가능한 것」으로 유지하라. 그것이 마지막 백업이다.★**

## §13.6 코드 치환 절차 (교훈 228) — 7패치 1회 성공 방식

```python
old = ('        prev_band, prev_props, prev_jid = band, props, jid\n'
       '        prev_tgt_for_g7 = t\n'
       '\n'
       '    # G9b')                        # ★뒤따르는 주석까지 포함 = 유일★
assert s.count(old) == 1, "loop tail"      # ★유일성을 증명한다★
s = s.replace(old, new)                    # ★개수 인자 불필요★
```

| 금지 | 이유 |
|---|---|
| `s.replace(old, new, 1)` | 「첫 occurrence」다. **방금 삽입한 블록 안의 것** 을 잡아 `IndentationError` 를 냈다 |
| 컨텍스트 없는 짧은 패턴 | 여러 곳에 매치되어 엉뚱한 위치를 고친다 |
| `grep -n` 없이 치환 | 추측(flush)이 아니라 **직독(섀도잉)** 이 원인을 찾았다 |

**절차**: ① `cp <file> /tmp/<file>.bak` → ② `grep -n` / `sed -n` 으로 **실제 코드를 읽는다**
→ ③ 주변 문맥을 붙여 **유일한 패턴** 을 만든다 → ④ `assert s.count(old)==1`
→ ⑤ 전체를 **한 번의 heredoc** 으로 치환 → ⑥ `python3 -c "import ast; ast.parse(...)"` AST 검증

**★이 방식으로 `script_gate.py` 7패치가 1회 실행에 AST OK 되었다.★**

## §13.7 통합 배치 원칙 (교훈 223 규칙 3)

결함을 발견하면 **먼저 「이미 예정된 렌더가 있는가」를 묻는다.**

| 방식 | 내용 | 시간 |
|---|---|---|
| A (나눠서) | 색 세대 42잡 재렌더 → 그 다음 G11 분할 재렌더 | **4.6 h** |
| **B (합쳐서)** | 색 통일 + G11 분할 + `ENV_WALL_HI` 를 **1회 배치** | **★2.85 h★** |

**A 가 대표님이 「낭비 수준」이라 하신 그것이다.**
설계 파일을 수정할 때는 **「이 수정이 어떤 차원에 나타나는가」** 를 먼저 묻고,
같은 렌더 패스에 반영할 수 있는 것을 **전부 모아서 한 번에 돌린다.**

```bash
# 대피 (SKIP 로직 때문에 반드시 mv)
mkdir -p /tmp/genYYMMDD && mv /home/user/lf/r3d/_batch/*.mp4 /tmp/genYYMMDD/
# 통합 배치 1회
cd /home/user/lf/r3d && setsid nohup python3 -u previz_batch.py > /tmp/lfall.log 2>&1 < /dev/null &
# 폴링 (Bash 타임아웃 120초)
sleep 110; grep -E "^\[|BATCH DONE" /tmp/lfall.log | tail -3
```

**★`previz_batch.py` 는 기존 mp4 가 있으면 SKIP 한다. 재렌더 전 반드시 `mv` 로 대피하라.★**

---

# §14 앵커 5축 재계측 절차 (교훈 230)

## §14.1 언제 도는가

**`sets.py` 의 색 상수 / `PROPS` 의 소품 크기 / 카메라 렌즈·좌표를 고친 직후.**
「처방 전 실측」을 「현재 상태」로 들고 다니는 사고를 막는다 (교훈 230 사고 ②).

## §14.2 명령 (전부 무료 · 각 0.2~0.4초)

```bash
cd /home/user/lf/r3d
python3 -u anchorlib.py   # ① 자기검사 — §7 표 12개 재현. 여기서 FAIL 이면 나머지는 무의미
python3 -u altsweep.py    # ② 축① 구별성 + 축⑤ 대안(크기·렌즈) 스윕
python3 -u visib.py       # ③ 축② 변화의 가시성 (두께비 = 거리 불변량)
python3 -u needsize.py    # ④ 축④ 26초 지속력 (앵커 절대 크기 하한)
```

**순서가 중요하다.** `anchorlib.py` 의 `selfcheck()` 가 실패하면 산식이
게이트와 갈라진 것이므로, 다른 세 도구의 숫자는 §7/§11 과 비교할 자격이 없다.

## §14.3 합격 기준

| 축 | 도구 | 기준 |
|---|---|---|
| 공용 | `anchorlib` | `selfcheck OK (0 fails)` — 12/12 |
| ① 구별성 | `altsweep` | 최악 대비 ≥ 3.0:1 **OR** 최악 채도차 ≥ 0.20 (**OR 이다**) |
| ② 가시성 | `visib` | 두께비 증가 ≥ 1.30 (PASS) / ≥ 1.10 (NOTE) |
| ④ 지속력 | `needsize` | 카드를 놓은 비트 전부에서 최악 화면폭 ≥ `SUBJ_FRAC_MIN`(0.14) |
| ③ 후킹 | **육안** | 첫 프레임에서 앵커가 주연보다 크게 읽히는가 — **도구가 못 대신한다** |

## §14.4 판정 해석 규칙

1. **`script_gate` FAILURES 0 은 5축 합격을 의미하지 않는다.**
   G6 는 「컷의 최대 주연」만, G9 는 「비·커버」만 본다. **앵커의 절대 크기는
   어느 게이트도 재지 않는다** — `needsize.py` 가 그 자리를 메운다 (교훈 213).
2. **축① 판정식은 OR 이다.** 벤치마크의 앵커는 휘도 **또는** 채도 하나로 튄다.
   AND 로 두면 「발광 앵커」를 우리 손으로 반려한다.
3. **축② 는 px 로 재지 마라.** px 는 카메라 거리에 반비례하므로 「바가
   굵어졌다」와 「카메라가 다가갔다」가 섞인다. **비(比)** 로 재라 (교훈 226).
4. **카드가 없는 컷은 FAIL 이 아니다.** 대본이 정본이다 (교훈 200). `needsize`
   는 그것을 「카드없음」으로 따로 집계한다.

## §14.5 발견을 적용할 때의 제약

**`SHORTS_C_LOCK` / `RHYTHM_LOCKED` 에 든 컷은 CEO 승인 납품본이다.**
도구가 미달을 잡아도 **그 자리에서 고치지 않는다** — 교훈 131 + [CEO-85]
「낭비 종료」. 계산 결과를 선택지로 남기고, 다음 편(숏폼 D 등)에서 대표님
판단으로 적용한다.

## §14.6 도구를 새로 만들 때 (교훈 230 규칙)

```
1. /tmp 금지 — /home/user/lf/r3d/ 에 영구 파일로
2. 상수·수식은 정본 모듈에서 import (교훈 176) — 절대 복제하지 마라
3. 「문서 표 값 재현 자기검사」를 반드시 넣어라 — 같은 축을 재고 있다는 유일한 증명
4. 한 리스트/필드가 두 질문에 답하고 있으면 분리하라 (교훈 229 — 도구 자신도 예외 아님)
5. 임계는 발명하지 말고 「보였다고 판정된 값」에서 유도하라 (교훈 199)
6. 판정식(AND/OR)은 벤치마크로 검증하라
7. 미러(youtube/hybrid3d/pipeline/r3d/)까지 함께 커밋하라 ([CEO-73])
```

## §14.7 분할 후 필수 확인 (교훈 229)

컷 분할(`cutsplit.py apply`) 뒤에는 **PROPS 적중 집계를 반드시 출력**하라.

```bash
cd /home/user/lf/r3d && python3 - << 'PY'
import json, sets
jobs = json.load(open("scenejobs.json"))
jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
hit = sum(1 for j in jobs if sets.PROPS.get(j.get("props_sid") or ""))
print("PROPS 적중", hit, "/", len(jobs))
PY
```

`dict.get(k, default)` 는 결함을 조용히 숨긴다. **집계를 출력**해야 「소품을
잃은 조각」이 드러난다 (실패 38 의 발견 경로).
