import collections
import lightbox as L

tr = L.track_v2v('/tmp/pilot.mp4', k=3)
print('frames', len(tr))
print('hist', sorted(collections.Counter(len(f) for f in tr).items()))
ln = [L.smooth(l) for l in L.lanes(tr, 3)]
for j in range(3):
    pts = [c for c in ln[j] if c]
    print('lane', j, 'samples', len(pts))
    if pts:
        print('  cy %.3f -> %.3f  cx %.3f -> %.3f  bw %.3f bh %.3f' % (
            pts[0][1], pts[-1][1], pts[0][0], pts[-1][0],
            sorted(p[2] for p in pts)[len(pts) // 2],
            sorted(p[3] for p in pts)[len(pts) // 2]))
