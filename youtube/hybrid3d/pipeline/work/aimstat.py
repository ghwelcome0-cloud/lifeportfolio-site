"""Audit the aim plan for all 80 ACT3~8 rows before rendering a single frame.

What this is looking for, in order of how badly it would hurt:

  A clamped aim that has become a STOP. proof_aim.py showed that zoompan clamps
  an over-budget crop internally rather than showing black, so the failure mode
  of an impossible aim is not a letterbox — it is a move that travels partway and
  then freezes. That reads worse than the centred version it replaces, because
  the eye is promised a move and then denied it. So every aimed row is checked
  for whether its aim fits the zoom it was given.

  An aim on a text row. Those plates carry Korean glass panels the image model
  composed at plate centre; aiming off-centre crops the glyphs, which is the
  CEO-16 rejection ("글자 퀄리티는 저급이에요") coming back. aim38 refuses these
  by construction, and this counts them to prove the refusal happened.

  A row that should have been aimed and was not. 58 of 80 rows carry position
  language. If far fewer than that end up aimed, the reader is failing and the
  meaning the team wrote is being thrown away again.

Free: reads the table, runs the planners, prints. No ffmpeg, no models.
"""
import shots38 as shots
import subseg38
import motion38
import aim38


def main():
    table = shots.TABLE38
    kb = [r for r in table if r["kind"] != "i2v"]

    kinds = {"path": 0, "target": 0, "centre": 0}
    stopped = []          # aim exceeds the zoom budget -> would freeze mid-move
    aimed_text = []       # must be empty
    aimed_rows = []
    prev = None
    for idx, r in enumerate(table):
        if r["kind"] == "i2v":
            prev = r
            continue
        dur = round(r["t1"] - r["t0"], 4)
        p = aim38.aim_for(r, motion38.plan(r, dur, prev=prev))
        prev = r

        reason = p["aim_reason"]
        if reason.startswith("path"):
            kinds["path"] += 1
        elif reason.startswith("centre"):
            kinds["centre"] += 1
        else:
            kinds["target"] += 1

        a0, a1 = p["aim0"], p["aim1"]
        moved = max(abs(a1[0] - a0[0]), abs(a1[1] - a0[1]))
        if moved > 1e-6:
            aimed_rows.append((r["sid"], reason, a0, a1, p["z0"], p["z1"]))
            if r.get("text"):
                aimed_text.append(r["sid"])
            # would the aim survive the zoom it actually has, at both ends?
            # The tolerance is not decorative: fit() rounds to 4 places, so an aim
            # sitting exactly on its budget reads as 0.1476 > 0.1476 in float. A
            # judgement that flags its own clamp as a failure is a broken
            # judgement, and lesson 72 says suspect the test before the subject.
            for z, a in ((p["z0"], a0), (p["z1"], a1)):
                room = aim38.room_for(z)
                if max(abs(a[0]), abs(a[1])) > room + 5e-5:
                    stopped.append((r["sid"], round(z, 4), a, round(room, 4)))

        # every internal cut must also fit
        n = len(subseg38.cuts_for(r))
        for i in range(n):
            d = aim38.split_aim(motion38.split(p, i, n), i, n)
            for z, a in ((d["z0"], d["aim0"]), (d["z1"], d["aim1"])):
                room = aim38.room_for(z)
                if max(abs(a[0]), abs(a[1])) > room + 5e-5:
                    stopped.append((f"{r['sid']}#c{i}", round(z, 4), a,
                                    round(room, 4)))

    print(f"kenburns rows            {len(kb)}")
    print(f"aim classification       {kinds}")
    print(f"rows whose aim MOVES     {len(aimed_rows)}")
    print(f"text rows aimed off-centre (must be 0)   {len(aimed_text)} {aimed_text}")
    print(f"aims exceeding zoom budget (would FREEZE mid-move, must be 0)   {len(stopped)}")
    for s in stopped[:12]:
        print(f"    {s}")

    # how much of the frame the aim actually travels, so the CEO's "의미" is not
    # a rounding error
    if aimed_rows:
        trav = sorted(max(abs(a1[0] - a0[0]), abs(a1[1] - a0[1]))
                      for _, _, a0, a1, _, _ in aimed_rows)
        mid = trav[len(trav) // 2]
        print(f"aim travel  min {trav[0]*100:.1f}%  median {mid*100:.1f}%  "
              f"max {trav[-1]*100:.1f}%  (of a half-plate)")

    print("\n--- sample of aimed rows ---")
    for sid, reason, a0, a1, z0, z1 in aimed_rows[:10]:
        print(f"  {sid:6} z {z0:.3f}->{z1:.3f}  aim {a0} -> {a1}   {reason}")


if __name__ == "__main__":
    main()
