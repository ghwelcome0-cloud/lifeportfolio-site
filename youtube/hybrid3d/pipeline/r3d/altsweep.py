#!/usr/bin/env python3
"""altsweep.py -- [CEO-83] 축① 구별성 + 축⑤ 대안 스윕 재계측.

무엇을 재는가
-------------
  축① 앵커(`card`)가 ★배경·이웃 종이에서 튀는가★  (WCAG 대비비 / 채도차)
  축⑤ 앵커가 하한 미달인 컷을 ★어떤 조정으로★ 살릴 수 있는가
      (색 / 크기 / 렌즈 -- 세 변수를 독립적으로 스윕)

§7.1 (처방 전): 현행 DOC_N 회색 -> 대비 1.90:1 / 채도차 0.00  ⇒ ❌
§7.5 (처방 전): 후보 6종 스윕 -> 게이트 통과 2/6 ~ 3/6       ⇒ ❌
                *"색(구별성)과 크기(게이트)는 독립 변수다"*

§8 에서 앵커색을 `DOC_ANCHOR_C` 로 바꾸고 이웃 백지(`DOC_W`)를 어둡게 했다.
★이 도구는 그 처방이 축①/축⑤ 를 실제로 움직였는지 재는 도구다.★

★판정 기준을 §7.1 보다 정확하게 고쳤다★
  §7.1 은 「대비비 3.0 이상」과 「채도차 0.20 이상」을 ★둘 다★ 보는 것처럼
  표를 세웠다.  그러나 관객이 대상을 구별하는 것은 ★둘 중 하나만★ 성립해도
  된다 -- 벤치마크의 「발광 물방울」은 채도가 아니라 ★휘도★ 로 튄다
  (`Sp8XFlq4s-g`), 「빨간 주석」은 휘도가 아니라 ★채도★ 로 튄다
  (`K4YuwHHGrgQ`).  그래서 판정은 ★OR★ 이다.
  ⇒ [CEO-73] *"벤치마크를 해도 내 것으로 소화해서 더 높은 품질로 가공"*.

★교훈 176★ 임계·산식은 anchorlib -> script_gate 참조.
★교훈 229★ 소품 조회는 anchorlib.props_of() 경유.
★교훈 131★ 이 도구는 ★계산만★ 한다.  SHORTS_C_LOCK(CEO 승인본) 컷의
            sets.py / scenejobs.json 을 고치지 않는다 -- 선택지를 제시한다.

CLI: python3 -u altsweep.py
"""

import sys

import anchorlib as AL
import sets

# 축① 후보색 (§7.1 표 + §8 처방색)
CAND_COLS = [
    ("현행 DOC_ANCHOR_C", sets.DOC_ANCHOR_C),
    ("DOC_N 회색 (§7.1 구)", sets.DOC_N),
    ("DOC_A 마젠타", sets.DOC_A),
    ("DOC_B 틸", sets.DOC_B),
    ("DOC_C 앰버", sets.DOC_C),
    ("CUE 시안", sets.CUE),
]

# ★★교훈 229 의 재발 -- 이 도구 자신에게서 잡았다★★
#   첫 판은 NEIGHBOURS 에 `DOC_N`(바) 를 넣었다.  그래서 축① 이 2.83:1 로
#   ★실패★ 판정됐다.  그런데 `DOC_N` 바는 ★카드 배경★ 이 아니라 ★카드 위에
#   놓인 내용★ 이다.  한 리스트가 두 질문에 동시에 답하고 있었다:
#     ① 앵커가 ★배경·이웃 종이★ 에서 구별되는가        <- 축① 의 질문
#     ② 앵커 위 바가 ★앵커 자신★ 에서 구별되는가        <- 축② 의 질문
#   ②는 대비가 ★있어야 좋은 것★ 이므로, 그것을 ①의 실패로 세면 방향이 반대다.
#   ⇒ 교훈 229 규칙 1 「한 필드가 두 질문에 답하고 있으면 분리하라」.
BACKDROP = [                       # ① 축① -- 앵커가 여기서 튀어야 한다
    ("이웃 백지 DOC_W", sets.DOC_W),
    ("책상 ENV_FURN", sets.ENV_FURN),
    ("벽 ENV_WALL_HI", sets.ENV_WALL_HI),
]
ON_CARD = [                        # ② 앵커 내부 가독성 -- 여기도 대비가 있어야 한다
    ("제목/본문 바 DOC_N", sets.DOC_N),
    ("채운 바", (0.50, 0.50, 0.49)),
    ("빈 바", (0.42, 0.42, 0.41)),
]
NEIGHBOURS = BACKDROP              # 축① 판정에 쓰는 것은 배경뿐이다

# 축⑤ 크기 스윕 (현행 최장변 배수)
SIZE_MULTS = (1.00, 1.15, 1.30, 1.50)


def axis1(verbose=True):
    """축① -- 앵커색이 이웃에서 튀는가."""
    print("=" * 88)
    print("altsweep.py -- [CEO-83] 축① 시각적 구별성 재계측")
    print("  판정: 최악 대비비 >= %.1f:1  ★OR★  최악 채도차 >= %.2f"
          % (AL.WCAG_LARGE_MIN, AL.SAT_DIFF_MIN))
    print("=" * 88)
    print("")
    print("%-22s %8s %8s %13s %11s %8s"
          % ("후보색", "휘도", "채도", "최악대비비", "최악채도차", "판정"))
    print("-" * 88)
    res = {}
    for nm, col in CAND_COLS:
        worst_c = min(AL.contrast(col, nc) for _, nc in NEIGHBOURS)
        worst_s = min(abs(AL.sat(col) - AL.sat(nc)) for _, nc in NEIGHBOURS)
        ok = worst_c >= AL.WCAG_LARGE_MIN or worst_s >= AL.SAT_DIFF_MIN
        res[nm] = (worst_c, worst_s, ok)
        print("%-22s %8.4f %8.3f %11.2f:1 %11.3f %8s"
              % (nm, AL.luma(col), AL.sat(col), worst_c, worst_s,
                 "OK" if ok else "★실패★"))
    print("")
    print("  ① 배경 대비 상세 (현행 앵커색 기준) -- ★여기서 튀어야 한다★:")
    for nnm, nc in BACKDROP:
        print("     vs %-20s 대비 %6.2f:1   채도차 %.3f"
              % (nnm, AL.contrast(sets.DOC_ANCHOR_C, nc),
                 abs(AL.sat(sets.DOC_ANCHOR_C) - AL.sat(nc))))
    print("")
    print("  ② 앵커 ★내부★ 가독성 (교훈 229: 다른 질문이다) -- 바가 카드에서"
          " 읽혀야 한다:")
    for nnm, nc in ON_CARD:
        cc = AL.contrast(sets.DOC_ANCHOR_C, nc)
        print("     card vs %-16s 대비 %6.2f:1   %s"
              % (nnm, cc, "OK" if cc >= AL.WCAG_LARGE_MIN else "★약함★"))
    cur = res["현행 DOC_ANCHOR_C"]
    print("")
    print("  §7.1 대조: 구 DOC_N 회색 = 1.90:1 / 채도차 0.00 ⇒ ❌")
    print("  재계측    : 현행        = %.2f:1 / 채도차 %.3f ⇒ %s"
          % (cur[0], cur[1], "★해소 ✅★" if cur[2] else "미해결"))
    if cur[2] and cur[1] < AL.SAT_DIFF_MIN:
        print("     (구별 수단은 ★채도가 아니라 휘도★ 다 -- 벤치마크의 「발광」 계열.")
        print("      `Sp8XFlq4s-g` 발광 물방울 / 내장쇼츠 발광 분자와 같은 축.)")
    return res


def axis5():
    """축⑤ -- 하한 미달 컷을 색/크기/렌즈로 살릴 수 있는가."""
    jobs = AL.load_jobs()
    bj = AL.beat_jobs(jobs)

    # 카드를 실제로 놓은 비트만 대상 (교훈 200: 없는 컷은 대본의 결정)
    tgt = []
    for beat in AL.BEATS:
        cands = bj.get(beat)
        if not cands:
            continue
        card = AL.find_prop(AL.props_of(cands[0]), AL.ANCHOR_NAME)
        if not card:
            continue
        worst_dep, lens = 0.0, float(cands[0]["lens"])
        for j in cands:
            for cam, t in ((j["cam_start_xyz"], j["tgt_start_xyz"]),
                           (j["cam_end_xyz"], j["tgt_end_xyz"])):
                d = AL.depth(cam, t, card[2])
                if d > worst_dep:
                    worst_dep = d
        tgt.append({"beat": beat, "lens": lens, "dep": worst_dep,
                    "edge": AL.longest(card[3])})

    print("")
    print("=" * 88)
    print("축⑤ 대안 스윕 -- 하한 %.2f 를 넘기는 조합   (대상 = 카드를 놓은 %d 비트)"
          % (AL.SUBJ_FRAC_MIN, len(tgt)))
    print("=" * 88)

    # ---- 5a. 크기만 스윕 ---------------------------------------------------
    print("")
    print("[5a] ★크기만★ 키운다 (렌즈 고정)")
    print("%-10s %10s %10s %s"
          % ("크기배수", "최장변m", "A4배수", "  비트별 최악 화면폭 / 통과수"))
    print("-" * 88)
    best_size = None
    for m in SIZE_MULTS:
        cells, npass = [], 0
        edge = 0.0
        for t in tgt:
            e = t["edge"] * m
            edge = max(edge, e)
            fr = AL.frac_of(e, t["lens"], t["dep"])
            ok = fr >= AL.SUBJ_FRAC_MIN
            npass += 1 if ok else 0
            cells.append("%s %.3f%s" % (t["beat"], fr, "" if ok else "✗"))
        line = "  ".join(cells)
        print("%-10.2f %10.4f %10.2f   %s  => %d/%d"
              % (m, edge, edge / AL.A4_LONG_M, line, npass, len(tgt)))
        if npass == len(tgt) and best_size is None:
            best_size = (m, edge)

    # ---- 5b. 렌즈만 스윕 ---------------------------------------------------
    print("")
    print("[5b] ★렌즈만★ 올린다 (크기 고정 = 「종이 한 장」 유지)")
    print("%-10s %8s %10s %10s %10s %s"
          % ("비트", "현행lens", "최악화면폭", "필요lens", "증가", "판정"))
    print("-" * 88)
    lens_plan = []
    for t in tgt:
        fr = AL.frac_of(t["edge"], t["lens"], t["dep"])
        need_l = AL.SUBJ_FRAC_MIN * t["dep"] * AL.SENSOR_MM / t["edge"]
        ok = fr >= AL.SUBJ_FRAC_MIN
        lens_plan.append((t["beat"], t["lens"], need_l, ok))
        print("%-10s %8.1f %10.4f %10.1f %10s %s"
              % (t["beat"], t["lens"], fr, need_l,
                 "-" if ok else "+%.1f" % (need_l - t["lens"]),
                 "이미 OK" if ok else "★렌즈 상향 필요★"))

    # ---- 5c. 결론 ----------------------------------------------------------
    print("")
    print("=== §7.5 대조 및 결론 ===")
    print("  §7.5 (처방 전): 후보 6종 전부 게이트 2/6, 크기 1.46배로도 3/6 ⇒ ❌")
    print("     *\"색(구별성)과 크기(게이트)는 독립 변수\"*")
    print("")
    cur_pass = sum(1 for t in tgt
                   if AL.frac_of(t["edge"], t["lens"], t["dep"])
                   >= AL.SUBJ_FRAC_MIN)
    print("  재계측 현행: %d/%d 비트 통과 (앵커색은 축① 해소, 크기는 A4 x%.2f)"
          % (cur_pass, len(tgt), tgt[0]["edge"] / AL.A4_LONG_M))
    if best_size:
        print("  크기 처방  : x%.2f (최장변 %.4f m = A4 x%.2f) 이면 %d/%d 전부 통과"
              % (best_size[0], best_size[1],
                 best_size[1] / AL.A4_LONG_M, len(tgt), len(tgt)))
        if best_size[1] / AL.A4_LONG_M > 1.0:
            print("     ⚠ A4 를 넘는다 -- 더 이상 「종이 한 장」이 아니다 (§7.4 의 그 문제)")
        else:
            print("     ✅ A4 이내 -- 「종이 한 장」을 유지한다")
    else:
        print("  크기 처방  : 스윕 범위(x%.2f) 안에서 전부 통과하는 배수 없음"
              % SIZE_MULTS[-1])
    need_up = [p for p in lens_plan if not p[3]]
    if need_up:
        print("  렌즈 처방  : %s"
              % ", ".join("%s %.1f->%.1f" % (b, l, n) for b, l, n, _ in need_up))
        print("     ⚠ 렌즈 상향은 화각을 좁힌다 -- 같은 컷의 다른 주연(비교표 등)이")
        print("       화각 밖으로 밀려 G6/G8 을 새로 깨뜨릴 수 있다 (교훈 210).")
        print("       ⇒ `scenejobs.refine_lens()` 의 ★화각 상한 미고려★ 미해결 항목과")
        print("         같은 지점이다. 단독 처방으로는 안전하지 않다.")

    print("")
    print("★교훈 131 / [CEO-85] 에 따른 처리★")
    locked = ("A3-13", "A3-14", "A3-15", "A3-17")
    hit = [p[0] for p in lens_plan if not p[3] and p[0] in locked]
    if hit:
        print("  미달 비트 %s 는 ★SHORTS_C_LOCK = CEO 승인 납품본★ 이다." % hit)
        print("  · 교훈 131: CEO 가 승인한 것을 내 코드가 반려하면 틀린 것은 내 코드다.")
        print("  · [CEO-85]: 프리비즈 반복은 낭비다 -- 승인본을 다시 흔들지 않는다.")
        print("  ⇒ 이 도구는 ★고치지 않고 선택지를 남긴다★. 실제 적용은")
        print("     롱폼 납품 이후 ★숏폼 D(앵커 재설계)★ 에서 대표님 판단으로 한다.")
    else:
        print("  미달 비트 없음 -- 조정 불필요.")
    print("=" * 88)
    return 0


def main():
    AL.selfcheck(verbose=False)
    axis1()
    return axis5()


if __name__ == "__main__":
    sys.exit(main())
