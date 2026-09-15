# 인생포트폴리오 유튜브 — 하이브리드 3D 모션 생산 체계

## 문서 지도

| 파일 | 내용 | 행 |
|---|---|---|
| `00_CEO_DIRECTIVES.md` | **대표님 지시 원문 전량 (CEO-1~85)** | 810 |
| `60_YOUTUBE_MARKET_RESEARCH.md` | 시장 조사 | 228 |
| `61_YOUTUBE_MANUAL.md` | 채널 운영 매뉴얼 | 433 |
| `70_HYBRID_3D_MOTION_GUIDE.md` | **하이브리드 3D 제작법 (요청 1 · PR #278 머지)** | 648 |
| `71_HYBRID_3D_PRODUCTION_RULES.md` | **★생산 헌법 — 교훈 1~228★** | **4099** |
| `72_CREDIT_DISCIPLINE.md` | 크레딧 규율 | 90 |
| `73_ARTIFACT_LEDGER.md` | 산출물 원장 (납품 링크 이력) | 646 |
| `74_SHORTS_TRILOGY_SPEC.md` | 숏츠 3부작 기획 정본 | 357 |
| `75_SESSION_STATE.md` | 세션 상태 (인수인계) | 784 |
| `76_BENCHMARK_STUDY.md` | 벤치마크 연구 + 대조 | 671 |
| `77_PRODUCTION_SOP.md` | **★생산 SOP (§13 = 상시 생산 표준)★** | **874** |

## 게이트 전체 (14종)

| 게이트 | 위치 | 검사 |
|---|---|---|
| **G1~G3** | `script_gate.py` | 글자 일치 / 누락 / 직전 반복 |
| **G4** | `script_gate.py` | 같은 장면 반복 (NOTE) |
| **G5** | `script_gate.py` | 몰입 방향 (`SUBJ_NEAR` 0.25 m) |
| **G6** | `script_gate.py` | 프레이밍 (화면폭 ≥ 0.14) |
| **G7** | `script_gate.py` | 샷 사이즈 중첩 ≤ 0.34 · **분할 형제 면제** |
| **G8** | `script_gate.py` | 가시성 (화각 + 가림 AABB) |
| **G9** | `script_gate.py` | ANCHOR (첫 프레임 비 · 런 커버 · 정체성 1종) |
| **G10** | `script_gate.py` | RIVAL (휘도 55% AND 크기 70% 경쟁자 0) |
| **G11** | `script_gate.py` | **RHYTHM 0.5~4.0 s [ENFORCE] · `RHYTHM_LOCKED`** |
| **Z-FIT** | `script_gate.py` | 카메라 높이 상한 |
| **MAP GATE** | `longcut.py` | 프레임 수 대조 + re-render list |
| **SUB GATE** | `longcut.py` | 자막 1094 px / 3줄 상한 |
| **SPLIT GATE** | `cutsplit.py` | **8종 (프레임 보존 · ARC · SEAM · 승인본 보호 등)** |
| **WRITE GATE** | `cutsplit.py` | **정본 파일 쓰기 검증 (`_valid_jobs`)** |

## 파이프라인 (SOP §13.1)

```
scenejobs.py → cutsplit.py apply → script_gate.py → previz_batch.py
→ genaudit.py → longcut.py map/film/deliver → 육안 5프레임 → 납품
   ★①~③ 은 전부 0.3초 무료. ④(2.85h) 앞에서 반드시 FAILURES 0 을 만든다.★
```

## 현재 납품물

| 산출물 | 링크 | 상태 |
|---|---|---|
| **숏폼 C** (9:16 · 16.00초 · 나레이션 포함) | https://www.genspark.ai/api/files/s/p2X4kHHb | **납품 완료** |
| **롱폼** (16:9 · 349.67초 · 123컷) | — | **통합 배치 렌더 진행 중** |

## 최근 상태 (2026-08-28)

- **★SCRIPT GATE OK · FAILURES 0★** (G11 117/117 · med 2.62 s)
- **★scenejobs.json 123컷 8399 f (프레임 보존)★**
- **★교훈 228건 · 헌법 4099행 · SOP 874행★**
- 브랜치 `docs/previz-v2v-article14` · PR #285 OPEN
