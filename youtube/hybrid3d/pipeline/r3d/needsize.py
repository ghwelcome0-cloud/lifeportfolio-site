#!/usr/bin/env python3
"""needsize.py -- [CEO-83] 축④ 「지속력」 재계측.

무엇을 재는가
-------------
「조건 카드 한 장」이 6컷(A3-13 ~ A4-01) ★전 구간★ 에서 하한
`script_gate.SUBJ_FRAC_MIN` 을 넘길 수 있는가?  넘기려면 얼마나 커야 하는가?
그 크기가 여전히 ★「종이 한 장」★ 인가 (실물 A4 0.297 m 의 몇 배인가)?

§7.4 (처방 적용 전) 실측:
  | job     | lens | 최원거리 | 필요 최장변 | A4 배수 | 판정 |
  | A3-13   | 40.0 |  2.66 m |  0.335 m  | 1.13 | 과대 |
  | A3-14   | 50.0 |  1.70 m |  0.171 m  | 0.58 | OK   |
  | A3-15   | 54.0 |  1.36 m |  0.127 m  | 0.43 | OK   |
  | A3-16   | 82.5 |  4.19 m |  0.256 m  | 0.86 | OK   |
  | A3-17   | 40.0 |  2.35 m |  0.296 m  | 1.00 | 경계 |
  | A4-01   | 45.0 |  3.26 m |  0.365 m  | 1.23 | 과대 |
  판정 ❌  6컷 통일 시 A4 1.23 배 필요 + 대본이 A3-16 / A4-01 에서 카드를
  떼어놨다 (`screen_direction`) ⇒ ★62 % 커버★.

이 도구가 재는 3가지
--------------------
  ① 각 비트에서 「카드가 하한을 넘기려면 필요한 최장변」 (거리·렌즈로 결정)
  ② 실제로 놓인 카드가 그 요구를 ★만족하는가★ (없으면 「대본이 안 놓았다」)
  ③ 6컷을 한 크기로 덮을 때 필요한 최댓값 = A4 몇 배인가

★교훈 200 (대본이 서사의 정본이다)★
  카드가 없는 컷은 「결함」이 아니라 ★대본의 결정★ 이다.  그래서 이 도구는
  「없음」을 FAIL 로 세지 않고 ★커버 구간 %★ 로 집계한다.  대본을 어기고
  카드를 억지로 끼워 넣는 것이 교훈 200 위반이다.

★교훈 176★ 하한·센서·투영 산식은 anchorlib -> script_gate 를 참조한다.
★교훈 229★ 소품 조회는 anchorlib.props_of() 를 경유한다 (props_sid 폴백).

CLI: python3 -u needsize.py
"""

import sys

import anchorlib as AL


def main():
    jobs = AL.load_jobs()
    bj = AL.beat_jobs(jobs)

    print("=" * 92)
    print("needsize.py -- [CEO-83] 축④ 지속력 재계측   "
          "(하한 SUBJ_FRAC_MIN = %.2f / SENSOR %.1f mm)"
          % (AL.SUBJ_FRAC_MIN, AL.SENSOR_MM))
    print("=" * 92)

    rows = []
    for beat in AL.BEATS:
        cands = bj.get(beat)
        if not cands:
            rows.append({"beat": beat, "err": "잡 없음"})
            continue
        props = AL.props_of(cands[0])
        card = AL.find_prop(props, AL.ANCHOR_NAME)

        # 「최원거리」 = 비트 전 구간(모든 조각의 start/end)에서 카드가 가장 먼 깊이.
        # 카드가 없으면 시선점 거리로 재서 「놓았다면 얼마나 커야 했나」를 낸다.
        worst_dep, worst_frac, n_frames = 0.0, None, 0
        for j in cands:
            for cam, tgt in ((j["cam_start_xyz"], j["tgt_start_xyz"]),
                             (j["cam_end_xyz"], j["tgt_end_xyz"])):
                n_frames += 1
                loc = card[2] if card else tgt
                dep = AL.depth(cam, tgt, loc)
                if dep > worst_dep:
                    worst_dep = dep
                if card:
                    fr = AL.frac_of(AL.longest(card[3]), j["lens"], dep)
                    worst_frac = fr if worst_frac is None else min(worst_frac, fr)

        lens = float(cands[0]["lens"])
        need = AL.need_edge(lens, worst_dep)
        have = AL.longest(card[3]) if card else 0.0
        rows.append({
            "beat": beat,
            "jobs": len(cands),
            "lens": lens,
            "dep": worst_dep,
            "need": need,
            "have": have,
            "need_a4": need / AL.A4_LONG_M,
            "have_a4": have / AL.A4_LONG_M if have else 0.0,
            "worst_frac": worst_frac,
            "card": bool(card),
        })

    # ---- 표 -----------------------------------------------------------------
    print("")
    print("%-8s %5s %6s %9s %11s %8s %11s %8s %10s %6s"
          % ("비트", "조각", "lens", "최원거리m", "필요최장변m", "A4배수",
             "실제최장변m", "A4배수", "최악화면폭", "판정"))
    print("-" * 92)
    n_cover, n_have_ok = 0, 0
    for r in rows:
        if r.get("err"):
            print("%-8s %s" % (r["beat"], r["err"]))
            continue
        if r["card"]:
            n_cover += 1
            ok = (r["worst_frac"] or 0.0) >= AL.SUBJ_FRAC_MIN
            if ok:
                n_have_ok += 1
            verdict = "OK" if ok else "미달"
            wf = "%10.4f" % r["worst_frac"]
            have_s = "%11.4f" % r["have"]
            have_a4 = "%8.2f" % r["have_a4"]
        else:
            verdict = "카드없음"
            wf = "%10s" % "-"
            have_s = "%11s" % "-"
            have_a4 = "%8s" % "-"
        print("%-8s %5d %6.1f %9.3f %11.4f %8.2f %s %s %s %6s"
              % (r["beat"], r["jobs"], r["lens"], r["dep"], r["need"],
                 r["need_a4"], have_s, have_a4, wf, verdict))

    # ---- 통일 요구 ----------------------------------------------------------
    live = [r for r in rows if not r.get("err")]
    with_card = [r for r in live if r["card"]]
    all_need = max(r["need"] for r in live)
    card_need = max((r["need"] for r in with_card), default=0.0)

    print("")
    print("=== 통일 요구 (한 크기로 덮으려면) ===")
    print("  6컷 전부 덮기          필요 최장변 %.4f m = A4 x %.2f"
          % (all_need, all_need / AL.A4_LONG_M))
    print("  ★카드를 실제로 놓은 컷만★ 덮기  %.4f m = A4 x %.2f"
          % (card_need, card_need / AL.A4_LONG_M))

    print("")
    print("=== 커버 구간 (교훈 200: 대본이 정본이다) ===")
    print("  카드를 놓은 비트 %d / %d = %.1f %%"
          % (n_cover, len(live), 100.0 * n_cover / max(1, len(live))))
    print("  그 중 하한 통과   %d / %d" % (n_have_ok, n_cover))
    for r in live:
        if not r["card"]:
            print("     · %s 는 대본(screen_direction)이 카드를 떼어놨다 -- "
                  "억지 삽입은 교훈 200 위반" % r["beat"])

    print("")
    print("=== §7.4 대조 ===")
    print("  §7.4 (처방 전): 6컷 통일 = A4 x1.23 / 커버 62 %  ⇒ ❌")
    print("  재계측        : 6컷 통일 = A4 x%.2f / 커버 %.0f %% / 카드컷만 A4 x%.2f"
          % (all_need / AL.A4_LONG_M,
             100.0 * n_cover / max(1, len(live)),
             card_need / AL.A4_LONG_M))
    if card_need / AL.A4_LONG_M <= 1.0 and n_have_ok == n_cover and n_cover:
        print("  ⇒ ★카드를 놓은 구간 전부에서 하한을 넘고, 크기는 A4 이내다."
              " 「종이 한 장」 유지 ✅★")
        print("     남은 것은 「전 구간 커버」가 아니라 ★대본이 정한 %d/%d 구간★ 이다."
              % (n_cover, len(live)))
    else:
        print("  ⇒ 아직 미달. 카드컷 중 %d 개가 하한 미달." % (n_cover - n_have_ok))
    print("=" * 92)
    return 0


if __name__ == "__main__":
    sys.exit(main())
