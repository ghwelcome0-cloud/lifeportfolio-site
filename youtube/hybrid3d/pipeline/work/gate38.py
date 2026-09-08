"""Free measurement gate for the 22 delivered ACT3~8 plates.

The point of this file is that no plate reaches the CEO's eyes, and no plate is
handed to a paid i2v call, until a machine has confirmed the two things that have
actually broken this project before: the aspect ratio (a portrait plate poisoned
an earlier batch) and the minimum width (an undersized plate cannot survive a
Ken Burns push without softening). Both checks cost nothing, so they run on
every plate, every time.
"""
import os, cv2, json, shots38 as S

LAND = "/home/user/lf/land38"
pm = S.plate_manifest()
have, bad, missing = [], [], []

for a in sorted(pm):
    p = os.path.join(LAND, a + ".png")
    if not os.path.exists(p):
        missing.append(a); continue
    im = cv2.imread(p)
    if im is None:
        bad.append((a, "unreadable")); continue
    h, w = im.shape[:2]
    ar = w / h
    # The tolerance is the one already in the SSOT; this gate does not invent a
    # looser rule than the table the renderer will later trust.
    if abs(ar - S.REQ_AR) > S.REQ_AR_TOL:
        bad.append((a, f"aspect {w}x{h} ar={ar:.4f}")); continue
    if w < S.REQ_MIN_W:
        bad.append((a, f"width {w} < {S.REQ_MIN_W}")); continue
    have.append((a, w, h, pm[a]["kind"], pm[a]["secs"], pm[a].get("panel")))

print("=== delivered & PASSED gate:", len(have))
for a, w, h, k, secs, panel in have:
    print(f"  {a}  {w}x{h}  {k:<10} {secs:6.2f}s  {panel or ''}")
print("=== FAILED:", len(bad))
for a, why in bad: print("  ", a, why)
print("=== not yet delivered:", len(missing), missing)

json.dump({"pass": [a for a, *_ in have], "fail": bad, "missing": missing},
          open("gate38_result.json", "w"), ensure_ascii=False, indent=1)
