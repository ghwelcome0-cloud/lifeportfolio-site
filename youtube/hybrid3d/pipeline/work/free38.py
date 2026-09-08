# -*- coding: utf-8 -*-
"""Everything that costs nothing, while three agents work.

1. Measure the two new V-2 clips and identify which shots they are.
2. Re-render the three delivered ACT1~2 i2v pieces with the frame-exact trim,
   proving the one-frame defect is gone rather than assuming the fix worked.
3. Render the ACT8 report pages locally from report.html — those pages are our
   own product, so generating them is free and also more accurate than any
   image model could be.
"""
import os, re, json, subprocess, glob, shutil
import assemble as A

LOG = []
def sh(a, t=110, cwd=None):
    try:
        p = subprocess.run(a, capture_output=True, text=True, timeout=t, cwd=cwd)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"

# ── 1. new V-2 clips ──────────────────────────────────────────────────────────
NEW = {"Rjj3cZ2V": None, "uu00bHCG": None}
LOG.append("== new V-2 artefacts ==")
for code in NEW:
    LOG.append(f"  {code}: requires DownloadFileWrapper (curl is 401 on wrappers)")

# ── 2. prove the frame-exact trim ─────────────────────────────────────────────
LOG.append("== frame-exact trim verification ==")
import shots
tab = shots.resolve_kinds()
want = {"A1-03": None, "A1-13": None, "A1-16": None}
os.makedirs("_ftest", exist_ok=True)
for r in tab:
    if r["sid"] not in want or r["kind"] != "i2v":
        continue
    src = f"seg/i2v_{r['sid']}.mp4"
    if not os.path.exists(src):
        LOG.append(f"  {r['sid']} source missing"); continue
    dur = round(r["t1"] - r["t0"], 4)
    out = f"_ftest/{r['sid']}.mp4"
    A.trim(src, r["ss"], dur, None, out)
    got = A.duration(out)
    nf = int(round(got * 24))
    want_f = int(round(dur * 24))
    ok = (nf == want_f)
    LOG.append(f"  {r['sid']} want {dur:.4f}s/{want_f}f  got {got:.4f}s/{nf}f  "
               f"{'OK' if ok else 'STILL SHORT'}")

# ── 3. ACT8 report pages, rendered from our own product ───────────────────────
LOG.append("== ACT8 report page render ==")
RH = "/home/user/webapp/report.html"
LOG.append(f"  report.html exists: {os.path.exists(RH)} "
           f"({os.path.getsize(RH) if os.path.exists(RH) else 0} B)")
rc, out, err = sh(["bash", "-lc",
                   "which chromium chromium-browser google-chrome-stable "
                   "google-chrome wkhtmltoimage 2>/dev/null; "
                   "python3 -c 'import weasyprint' 2>&1 | tail -1"])
LOG.append(f"  renderers: {out.strip()!r} {err.strip()[:80]!r}")

# ── 4. what the render still needs ────────────────────────────────────────────
import shots38 as T
man = T.plate_manifest()
have = {os.path.basename(p).split("_",1)[1].rsplit(".",1)[0]
        for p in glob.glob("/home/user/lf/land38/plate_*.png")}
LOG.append("== ACT3~8 readiness ==")
LOG.append(f"  plates required {len(man)}  present {len(have)}  "
           f"missing {sorted(set(man) - have)[:30]}")
LOG.append(f"  i2v required {len(T.i2v_manifest38())}  present 0")
LOG.append(f"  gate CEO_PLATE_APPROVAL_38 = {T.CEO_PLATE_APPROVAL_38} "
           f"(shut until 대표님 reviews)")
open("/tmp/free38.txt","w",encoding="utf-8").write("\n".join(LOG)+"\n")
print("\n".join(LOG))
