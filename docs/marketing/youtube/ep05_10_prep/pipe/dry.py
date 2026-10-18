import os,sys,numpy as np
os.environ['EP']=sys.argv[1]; os.chdir(f'/home/user/ax-work/yt-ep{sys.argv[1]}')
src=open('tk/render.py').read(); cut=src.index('def endcard():'); pre=src[:cut]
i=pre.index('# ---------- shot list ----------'); g={'__name__':'dry'}
exec(pre[:i],g); g['scard']=lambda n,*a,**k: np.zeros((2037,1440,4),'uint8'); exec(pre[i:],g)
sh=g['shots']; T=g['TOTAL']
miss=[t for t in np.arange(0,T,0.1) if not any(s['t0']<=t<s['t1'] for s in sh)]
short=[(s.get('c',s.get('n')),round(s['t0'],1),round(s['t1']-s['t0'],1)) for s in sh if s['t1']-s['t0']<1.5]
print(sys.argv[1],'shots',len(sh),'TOTAL',round(T,2),'uncovered',len(miss),'short',short)
