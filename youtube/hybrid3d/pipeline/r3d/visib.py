#!/usr/bin/env python3
"""visib.py -- [CEO-83] 축② 「변화의 가시성」 재계측.

무엇을 재는가
-------------
대본은 A3-14 에서 ★빈★ 본문 바를, A3-15 에서 ★채운★ 바를 요구한다.
그 변화가 ★관객에게 보이는 변화★ 인가?

§7.2 (처방 적용 전) 실측:
  | 컷            | 바 길이 | 바 두께 |
  | A3-14 start   |  142 px |  10.1 px |
  | A3-14 end     |  253 px |  18.1 px |
  | A3-15 start   |  201 px |  23.0 px |
  | A3-15 end     |  272 px |  31.1 px |
  판정 ◐ 부분 실패 -- 두께 10 -> 23 px 은 보이나, 컷이 바뀌며 카메라 거리도
  1.75 m -> 1.34 m 로 변하므로 시청자가 「바가 두꺼워졌다」와 「카메라가
  다가갔다」를 ★분리할 수 없다★.

§8 에서 sets.py 를 개조했다 (bodybar 0.007 -> 0.007 두께 / fillbar 0.011,
카드 x1.33 확대).  ★그래서 이 도구는 「처방이 실제로 분리 가능성을 만들었는가」
를 재는 도구다.★

★핵심 지표 = 「두께 비」 (thickness ratio)★
  px 는 카메라 거리에 반비례한다.  따라서 거리가 바뀌면 px 는 무조건 바뀐다.
  ⇒ 거리에 ★불변인 양★ 으로 재야 한다.  그것이

        두께비 = 바 두께 / ★같은 프레임의 카드 두께(=장변)★

  이다.  같은 프레임 안의 두 물체 비는 카메라 거리·렌즈와 무관하다.
  이 비가 A3-14 -> A3-15 에서 커지면, 시청자는 「카드 대비 바가 굵어졌다」를
  카메라 이동과 ★분리해서★ 읽을 수 있다.
  ⇒ 교훈 226 「게이트 임계는 물리량이어야 한다」의 적용:
     px(관측량, 거리 의존) 대신 비(물리량, 거리 불변)를 쓴다.

판정
----
  PASS  두께비가 1.30 배 이상 증가       (육안 인지 하한. 근거는 아래)
  NOTE  1.10 ~ 1.30 배
  FAIL  1.10 배 미만 또는 감소

  1.30 의 근거: §7.2 실측에서 두께 10.1 -> 23.0 px 은 「보인다」고 판정됐고
  그 중 카메라 거리 효과(1.7506 -> 1.3446 = 1.30배)를 제거하면 순수 형태
  변화는 23.0/10.1/1.30 = 1.75 배였다.  즉 1.75 는 보였다.  그 아래 어디까지
  보이는지는 모르므로, 「보인 값」보다 낮고 「거리 효과」와 같은 크기인 1.30 을
  하한으로 둔다 -- 게이트는 합격을 넉넉히가 아니라 불합격을 확실히 잡는다
  (교훈 199).

CLI: python3 -u visib.py
"""

import sys

import anchorlib as AL

BODY_NAMES = ("bodybar", "fillbar")     # 대본의 「본문 바」 -- 빈 / 채운
TITLE_NAME = "ttlbar"

RATIO_PASS = 1.30
RATIO_NOTE = 1.10


def _row(job, prop, cam, tgt, label):
    """한 프레임에서 소품 하나의 길이/두께 px 를 낸다."""
    name, _kind, loc, sc, _col = prop
    dep = AL.depth(cam, tgt, loc)
    lens = job["lens"]
    length_m = 2.0 * max(sc[0], sc[1])
    thick_m = 2.0 * min(sc[0], sc[1])
    return {
        "label": label,
        "job": job["job_id"],
        "name": name,
        "dep": dep,
        "lens": lens,
        "len_px": AL.px_of(length_m, lens, dep),
        "thk_px": AL.px_of(thick_m, lens, dep),
        "len_m": length_m,
        "thk_m": thick_m,
    }


def main():
    jobs = AL.load_jobs()
    bj = AL.beat_jobs(jobs, beats=("A3-14", "A3-15"))

    print("=" * 78)
    print("visib.py -- [CEO-83] 축② 변화의 가시성 재계측   (%s x %s 기준)"
          % (int(AL.RES_W), int(AL.RES_H)))
    print("=" * 78)

    missing = [b for b in ("A3-14", "A3-15") if b not in bj]
    if missing:
        print("★ABORT★ 비트를 찾지 못했다: %s" % missing)
        return 1

    rows = []
    ref = {}          # 비트 -> (바 두께비 계산용) 카드 두께 px
    for beat in ("A3-14", "A3-15"):
        cands = bj[beat]
        props = AL.props_of(cands[0])
        body = None
        for nm in BODY_NAMES:
            body = AL.find_prop(props, nm)
            if body:
                break
        card = AL.find_prop(props, AL.ANCHOR_NAME)
        if not body or not card:
            print("★ABORT★ %s: body=%s card=%s" % (beat, bool(body), bool(card)))
            return 1

        (c0, t0), (c1, t1) = AL.span_of(cands)
        for tag, cam, tgt in (("start", c0, t0), ("end", c1, t1)):
            r = _row(cands[0] if tag == "start" else cands[-1],
                     body, cam, tgt, "%s %s" % (beat, tag))
            rc = _row(cands[0] if tag == "start" else cands[-1],
                      card, cam, tgt, "%s %s card" % (beat, tag))
            r["card_thk_px"] = rc["len_px"]          # 카드의 장변을 기준자로 쓴다
            r["ratio"] = r["thk_px"] / rc["len_px"] if rc["len_px"] else 0.0
            r["prop"] = body[0]
            rows.append(r)
            if tag == "start":
                ref[beat] = r

    # ---- 표 -----------------------------------------------------------------
    print("")
    print("%-16s %-9s %6s %6s %9s %9s %11s %9s"
          % ("컷", "소품", "lens", "깊이m", "바길이px", "바두께px",
             "카드장변px", "두께비"))
    print("-" * 78)
    for r in rows:
        print("%-16s %-9s %6.1f %6.3f %9.1f %9.1f %11.1f %9.4f"
              % (r["label"], r["prop"], r["lens"], r["dep"],
                 r["len_px"], r["thk_px"], r["card_thk_px"], r["ratio"]))

    # ---- 판정 ---------------------------------------------------------------
    a, b = ref["A3-14"], ref["A3-15"]
    px_gain = b["thk_px"] / a["thk_px"] if a["thk_px"] else 0.0
    dist_gain = a["dep"] / b["dep"] if b["dep"] else 0.0      # 다가가면 >1
    ratio_gain = b["ratio"] / a["ratio"] if a["ratio"] else 0.0
    pure = px_gain / dist_gain if dist_gain else 0.0

    print("")
    print("=== 분해 (A3-14 start -> A3-15 start) ===")
    print("  두께 px        %6.1f -> %6.1f      = x %.3f  (관측량)"
          % (a["thk_px"], b["thk_px"], px_gain))
    print("  카메라 깊이 m  %6.3f -> %6.3f      = x %.3f  (거리 효과)"
          % (a["dep"], b["dep"], dist_gain))
    print("  ★두께비★      %6.4f -> %6.4f      = x %.3f  ★거리 불변 = 물리량★"
          % (a["ratio"], b["ratio"], ratio_gain))
    print("  px 증가에서 거리 효과 제거      = x %.3f  (순수 형태 변화)"
          % pure)

    verdict = ("PASS" if ratio_gain >= RATIO_PASS else
               "NOTE" if ratio_gain >= RATIO_NOTE else "FAIL")
    print("")
    print("=== 판정 ===")
    print("  기준: 두께비 증가 >= %.2f 배 = PASS / >= %.2f 배 = NOTE / 그 아래 FAIL"
          % (RATIO_PASS, RATIO_NOTE))
    print("  실측: x %.3f   ⇒  ★%s★" % (ratio_gain, verdict))
    print("")
    print("  §7.2 (처방 전) 실측 대조: 두께 10.1 -> 23.0 px (px x2.28)")
    print("     그때는 두께비를 재지 않았고, 거리 효과와 분리되지 않았다.")
    if verdict == "PASS":
        print("  ⇒ 두께비가 자체적으로 %.2f 배 커졌으므로, 카메라가 다가간 것과"
              % ratio_gain)
        print("     ★무관하게★ 「바가 굵어졌다」가 읽힌다. 축② 해소.")
    else:
        print("  ⇒ 두께비 증가가 부족하다. 카메라 이동과 분리되지 않는다.")
    print("=" * 78)
    return 0 if verdict != "FAIL" else 2


if __name__ == "__main__":
    sys.exit(main())
