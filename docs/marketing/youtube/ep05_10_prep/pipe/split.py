import re,sys
e=sys.argv[1];B=f'/home/user/ax-work/yt-ep{e}/'
t=open(B+f'script/EP{e}_script.md').read().split('\n---\n')[0]
paras=[]
for ln in t.split('\n'):
    ln=ln.strip()
    if not ln or ln.startswith(('#','[','〔','(','제목','인물','근거','표기','연출','주의')): continue
    paras.append(ln)
assert len(paras)==13,(e,len(paras))
open(B+'script/narration.txt','w').write('\n'.join(paras)+'\n')
G=[(0,3),(3,5),(5,8),(8,11),(11,13)]
for i,(a,b) in enumerate(G): open(B+f'script/part{i+1}.txt','w').write('\n'.join(paras[a:b])+'\n')
print(e,[len(''.join(paras[a:b])) for a,b in G], sum(len(p) for p in paras), '|', ' / '.join(p[:8] for p in paras))

import subprocess as _sp
_r=_sp.run(['python3','/home/user/ax-work/series/pipe/lint_script.py',B+'script/narration.txt'])
assert _r.returncode==0,'pronunciation lint failed: fix 주 차 numerals'
