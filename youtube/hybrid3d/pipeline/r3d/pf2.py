import pflow, itertools, subprocess, sys
# aggressive fly-in: strong lateral sweep + deep dolly
cfgs = [
 ("A", dict(strength=260.0, path=[(-0.55,0.55),(0.18,-0.14),(0.00,0.55)])),
 ("B", dict(strength=420.0, path=[(-0.80,0.80),(0.25,-0.22),(0.00,0.85)])),
]
for tag,c in cfgs:
    el = pflow.render("/home/user/lf/land38/S19.png", "pf_%s.mp4"%tag, 72,
                      path=c["path"], focus=(0.42,0.62), strength=c["strength"], crop=0.78)
    print("cfg %s  %.1fs"%(tag,el), flush=True)
