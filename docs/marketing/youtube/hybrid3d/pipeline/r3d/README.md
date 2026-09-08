# AI 실물 해부 파이프라인 — 도구 3종 (정본 미러)

이 디렉토리는 샌드박스 작업 경로 `/home/user/lf/r3d/` 의 **정본 미러**다.
재생산([CEO-73])을 위해 리포에 보존한다.

## 파일

| 파일 | 역할 | 자기검사 |
|---|---|---|
| `overlay.py` | 2D HUD 오버레이 프리미티브 16종 (완성도를 만드는 층) | `python3 overlay.py selfcheck` → 19/19 |
| `aisrc.py` | AI i2v 121프레임 고정 출력을 대본 길이로 **setpts 시간 재매핑** | `python3 aisrc.py selfcheck` → 9/9 |
| `shorts4.py` | 숏폼 4막 기획·조립·게이트 | `python3 shorts4.py gate` → 14/14 |

## 실행 순서

```bash
cd /home/user/lf/r3d
python3 overlay.py selfcheck          # 19/19 OK
python3 aisrc.py  selfcheck           # 9/9 OK
python3 aisrc.py  build               # _ai/ (121f) → _aisrc/ (대본 길이) 20 파일
python3 shorts4.py plan               # 22 seg / 1395f / 58.13s / worst delta 0.020s
python3 shorts4.py build              # → work/longform/_s4/shorts4.mp4
python3 shorts4.py gate               # 14항 전부 OK 여야 납품 가능
```

## 의존 관계 (삭제·이동 금지)

```
overlay.py  ──import──▶ work/longform/shorts916.py   (팔레트 BG/PANEL/RIM/CORE/INK/DIM, FONT)
overlay.py  ──import──▶ work/longform/longcut.py     (wrap_words — 개행이 든 문자열을 반환)
aisrc.py    ──import──▶ shorts4.py  (importlib · sid_plan 을 shorts4 에서 가져온다 · 교훈 176)
```
**수식·상수를 복제하지 말고 참조한다** (교훈 176). 두 곳에 같은 숫자가 있으면 반드시 갈라진다.

## 소스 디렉토리

| 경로 | 내용 |
|---|---|
| `_ai/` | AI 생성 원본 12편 (716x1284 · 24fps · 121f · 5.041667s) + 승인 플레이트 |
| `_aisrc/` | `aisrc.py build` 산출 20편 (1080x1920 · 대본 길이로 재매핑 · crf 16) |
| `_batch/` | 구 3D 배치 렌더 123편 (16:9). AI 로 대체되었으나 보존 |

`SRC_DIR` 상수 하나로 3D/AI 소스를 전환한다:
```python
BATCH = HERE + "/_batch"
AISRC = HERE + "/_aisrc"
SRC_DIR = AISRC   # AI i2v 정규화 소스. 3D 배치본으로 되돌리려면 BATCH.
```
**주의**: AI 클립은 이미 9:16 이다. `crop=in_h*9/16:...` 를 넣으면 화면이 잘린다 (교훈: crop 금지, scale 만).

## 게이트 14항

```
A 4막구조   B 후킹 t=0 + 기막>=3.0s   C 총길이 45~95s   D 컷리듬 0.5~4.0s
E sid중복없음   F 롱폼잘라내기아님(오디오 순서 비단조)   F2 구운글자sid배제
G 1080x1920   H 오디오   I 게이트프레임추출   J 글자끝접촉(연결성분 · 교훈 248)
K 레터박스없음   L 광류 p95>=1.5
```
**게이트는 합격을 불합격으로 만들어서도, 불합격을 놓쳐서도 안 된다** (교훈 236).
J항을 고칠 때는 반드시 **인위 결함 주입 검증**을 함께 한다.

## 최종 실측 (2026-08 기준값)

```
shorts4.mp4  1080x1920 · 1395f · 58.125s · 31,925,142 B · 22 세그먼트
voice delta 0.000 s · worst per-sid delta 0.020 s (A5-08)
GATE OK 14/14 · 광류 p95 38.00 (3D 판본 13.00 → 2.9배)
```
