#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cutsheet.py — 숏츠 #1 컷 시트 정본.
컷 경계는 추정이 아니라 ★나레이션 실측 타임코드★(elevenlabs_scribe_v2)의
문장 사이 무음 구간 중점에서 잡는다. 대본-영상 일치의 근거.
"""

# 나레이션 실측 세그먼트 (초) — audio_transcribe 결과 원문
NAR_SEGS = [
    (0.46,  4.32, "흰 종이 한 장 앞에서 1시간째 커서가 안 떠오릅니다."),
    (4.92,  6.80, "10년을 일했는데 쓸 게 없다."),
    (7.58,  9.34, "이건 당신만의 문제가 아닙니다."),
    (10.06,14.26, "없는 게 아니라 쌓여 있는데 꺼내는 방법을 모르는 겁니다."),
    (14.96,18.86, "이 단면의 한 층이 당신이 만든 문서 한 장입니다."),
    (19.84,23.70, "층이 쌓인 순서가 곧 당신의 연차입니다."),
    (24.30,27.72, "맨 아래층은 3년 차 때 만든 보고서입니다."),
    (28.34,32.92, "지금 보면 사소하지만 그때 처음 배운 방식이 여기 있습니다."),
    (33.74,36.34, "맨 위층은 작년에 끝낸 프로젝트입니다."),
    (37.16,40.92, "두껍고 무겁고 아직 정리되지 않았습니다."),
    (41.56,43.08, "오늘 딱 하나만 하세요."),
    (43.94,48.50, "최근 3년치 폴더를 열고 파일 이름만 쭉 훑어보세요."),
    (49.12,51.00, "이력서가 안 써지는 게 아닙니다."),
    (51.64,52.72, "아직 안 꺼낸 겁니다."),
    (53.54,60.56, "당신의 10년치 산출물을 한 페이지로 모으는 방법은 라이프 포트폴리오에서 시작됩니다."),
]
TOTAL = 61.00

def mid(i):
    """세그먼트 i 끝과 i+1 시작 사이 무음의 중점 = 컷 경계."""
    return round((NAR_SEGS[i][1] + NAR_SEGS[i+1][0]) / 2.0, 2)

# 컷 경계: 나레이션 의미 단락이 바뀌는 지점에서만 자른다
# 9컷. 벤치마크 컷 밴드(최단 4초 ~ 최장 10초)를 전 컷이 지키도록 경계를 잡았다.
# 마지막 경계는 mid(13)=53.13 — "아직 안 꺼낸 겁니다"까지가 명제의 마무리,
# 그 다음부터가 CTA 한 덩어리다. 명제와 CTA를 한 컷에 섞지 않는다.
BOUNDS = [0.00, mid(0), mid(2), mid(3), mid(5), mid(7), mid(9), mid(11), mid(13), TOTAL]
#                 C1     C2      C3      C4      C5      C6      C7      C8      C9
# mid(0)=4.62  mid(2)=9.70  mid(3)=14.61  mid(5)=24.00  mid(7)=33.33
# mid(9)=41.24 mid(11)=48.81 mid(13)=53.13

# 각 컷: (id, 소스클립, 방향, 화면자막, 카메라, 담당 나레이션 인덱스)
CUTS = [
    ("C1", "A_full",  "fwd", "커서가 안 떠오른다",      "전신 롱샷에서 아주 느린 푸시인",       [0]),
    ("C2", "D_face",  "fwd", "쓸 게 없는 게 아니다",    "절단면 정면으로 푸시인",               [1,2]),
    ("C3", "B_ring",  "fwd", "쌓여 있는데 못 꺼낸다",   "절단된 금속 링 단면 위를 횡이동",      [3]),
    ("C4", "D_down",  "fwd", "한 층 = 문서 한 장",      "층리 벽을 따라 아래로 트래킹",         [4,5]),
    ("C5", "E_bottom","fwd", "맨 아래층 · 3년차",       "가장 아래 지층으로 미세 밀착",         [6,7]),
    ("C6", "F_top",   "fwd", "맨 윗층 · 작년",          "최상층으로 상승",                      [8,9]),
    ("C7", "A_full",  "rev", "3년치 폴더를 열어보라",   "물러나며 단면 전체가 다시 보인다",     [10,11]),
    ("C8", "D_face",  "rev", "아직 안 꺼낸 겁니다",     "절단면에서 천천히 물러난다",           [12,13]),
    ("C9", "G_wide",  "fwd", "lifeportfolio.co.kr",     "완전히 물러나 정지, 단면이 중앙에",    [14]),
]

def plan():
    rows = []
    for i, (cid, src, dirn, sub, cam, nidx) in enumerate(CUTS):
        t0, t1 = BOUNDS[i], BOUNDS[i+1]
        rows.append(dict(id=cid, src=src, dir=dirn, sub=sub, cam=cam,
                         t0=t0, t1=t1, dur=round(t1-t0, 3),
                         nar=" ".join(NAR_SEGS[j][2] for j in nidx)))
    return rows

if __name__ == "__main__":
    rows = plan()
    print("%-4s %-9s %-4s %7s %7s %7s  %-22s %s" %
          ("CUT","SRC","DIR","IN","OUT","DUR","SUBTITLE","NARRATION"))
    for r in rows:
        print("%-4s %-9s %-4s %7.2f %7.2f %7.2f  %-22s %s" %
              (r["id"], r["src"], r["dir"], r["t0"], r["t1"], r["dur"], r["sub"], r["nar"][:46]))
    ds = [r["dur"] for r in rows]
    print("---")
    print("cuts=%d  total=%.2fs  avg=%.2fs  min=%.2fs  max=%.2fs" %
          (len(ds), sum(ds), sum(ds)/len(ds), min(ds), max(ds)))
    # 정합 검사
    assert abs(sum(ds) - TOTAL) < 0.01, "duration mismatch"
    for i in range(len(rows)-1):
        assert abs(rows[i]["t1"] - rows[i+1]["t0"]) < 1e-6, "gap at %d" % i
    # 컷 경계가 어떤 나레이션 문장도 자르지 않는지 확인 (대본-영상 일치의 핵심)
    bad = []
    for b in BOUNDS[1:-1]:
        for s, e, txt in NAR_SEGS:
            if s < b < e:
                bad.append((b, txt))
    print("boundary-inside-speech violations:", len(bad))
    assert not bad, bad
    print("BENCH BAND (4~10s):", "PASS" if min(ds) >= 4.0 and max(ds) <= 10.0 else "FAIL")
    print("CUTSHEET OK")
