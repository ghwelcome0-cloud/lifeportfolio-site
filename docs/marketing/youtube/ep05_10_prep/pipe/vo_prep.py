# generic VO prep (EP.05~10): concat 5 parts -> align scribe words to script -> gap compress -> tempo/EQ
# text rule: spacing/homophones/punctuation from script; numerals (digits) from scribe (screen uses Arabic numerals)
import json,re,subprocess,sys,difflib,numpy as np,soundfile as sf
sys.path.insert(0,'/home/user/ax-work/series'); import subwrap
E=sys.argv[1]; B=f'/home/user/ax-work/yt-ep{E}/'; TEMPO=1.03
# 1) concat parts with word offsets
xs=[];S=[];off=0.0;SR=None
for i in range(1,6):
    subprocess.run(['ffmpeg','-v','error','-y','-i',B+f'vo/p{i}.mp3','-ac','1','-ar','44100',B+f'vo/p{i}.wav'],check=True)
    x,sr=sf.read(B+f'vo/p{i}.wav'); SR=sr
    for q in json.load(open(B+f'vo/w{i}.json'))['words']:
        t=q['text'].strip()
        if not t or q.get('type','word')!='word' and not re.search(r'[가-힣0-9]',t): continue
        if not re.search(r'[가-힣0-9A-Za-z]',t): continue
        S.append(dict(text=t,start=q['start']+off,end=q['end']+off))
    gap=np.zeros(int(0.9*sr)); xs+=[x,gap]; off+=len(x)/sr+0.9
x=np.concatenate(xs); sr=SR
# 2) script tokens
paras=[l.strip() for l in open(B+'script/narration.txt') if l.strip()]
T=[];pstart=[]
for p in paras:
    pstart.append(len(T)); T+= p.split()
N=lambda s:re.sub(r'[^가-힣0-9A-Za-z]','',s)
sm=difflib.SequenceMatcher(None,[N(q['text']) for q in S],[N(t) for t in T],autojunk=False)
w=[];log=[]
def spread(a,b,toks,tidx):
    L=[max(1,len(N(t))) for t in toks]; tot=sum(L); c=a
    for t,l,ti in zip(toks,L,tidx):
        d=(b-a)*l/tot; w.append(dict(text=t,start=c,end=c+d,ti=ti)); c+=d
for op,i1,i2,j1,j2 in sm.get_opcodes():
    if op=='equal':
        for k in range(i2-i1): w.append(dict(text=T[j1+k],start=S[i1+k]['start'],end=S[i1+k]['end'],ti=j1+k))
    elif op=='replace':
        ss=S[i1:i2]; st=T[j1:j2]
        if any(re.search(r'[0-9]',q['text']) for q in ss) and len(ss)!=len(st):
            # peel non-digit scribe tokens off both ends and match them to script tokens by letters
            def peel(ss,st,rev):
                outw=[]
                while len(ss)>1 and not re.search(r'[0-9]',(ss[-1] if rev else ss[0])['text']):
                    q=ss[-1] if rev else ss[0]; tgt=N(q['text']); acc=''; n=0
                    seq=st[::-1] if rev else st
                    while n<len(seq) and len(acc)<len(tgt):
                        acc=(N(seq[n])+acc) if rev else (acc+N(seq[n])); n+=1
                    if acc!=tgt or n>=len(st): break
                    toks=st[len(st)-n:] if rev else st[:n]
                    outw.append((q,toks))
                    ss=ss[:-1] if rev else ss[1:]; st=st[:len(st)-n] if rev else st[n:]
                return ss,st,outw
            ss,st,head=peel(ss,st,False); ss,st,tail=peel(ss,st,True)
            j0=j1
            for q,toks in head:
                spread(q['start'],q['end'],toks,list(range(j0,j0+len(toks)))); j0+=len(toks)
            jt=j2-sum(len(t) for _,t in tail); j1=j0
            if len(ss)==len(st):
                for k,q in enumerate(ss):
                    t=q['text']
                    if re.search(r'[0-9]',t):
                        m=re.search(r'[.,?!]+$',st[k]); t=re.sub(r'[.,?!]+$','',t)+(m.group(0) if m else '')
                    else: t=st[k]
                    w.append(dict(text=t,start=q['start'],end=q['end'],ti=j0+k))
            else:
                for k,q in enumerate(ss):
                    t=q['text']
                    if k==len(ss)-1:
                        m=re.search(r'[.,?!]+$',st[-1]); t=re.sub(r'[.,?!]+$','',t)+(m.group(0) if m else '')
                    w.append(dict(text=t,start=q['start'],end=q['end'],ti=j0+min(k,len(st)-1)))
            for q,toks in reversed(tail):
                spread(q['start'],q['end'],toks,list(range(jt,jt+len(toks)))); jt+=len(toks)
            log.append(('NUM*',' '.join(q['text'] for q in S[i1:i2]),' '.join(T[j1:j2])))
        elif any(re.search(r'[0-9]',q['text']) for q in ss):
            # keep scribe numerals; borrow trailing punctuation from script end
            for k,q in enumerate(ss):
                t=q['text']
                if len(ss)==len(st) and not re.search(r'[0-9]',t):
                    w.append(dict(text=st[k],start=q['start'],end=q['end'],ti=j1+k)); continue
                if len(ss)==len(st):
                    m=re.search(r'[.,?!]+$',st[k]); t=re.sub(r'[.,?!]+$','',t)+(m.group(0) if m else '')
                    w.append(dict(text=t,start=q['start'],end=q['end'],ti=j1+k)); continue
                if k==len(ss)-1:
                    m=re.search(r'[.,?!]+$',st[-1]); t=re.sub(r'[.,?!]+$','',t)+(m.group(0) if m else '')
                w.append(dict(text=t,start=q['start'],end=q['end'],ti=j1 if k==0 else j1+min(k,len(st)-1)))
            log.append(('NUM',' '.join(q['text'] for q in ss),' '.join(st)))
        else:
            spread(ss[0]['start'],ss[-1]['end'],st,list(range(j1,j2)))
            log.append(('FIX',' '.join(q['text'] for q in ss),' '.join(st)))
    elif op=='delete':
        ss=S[i1:i2]
        if any(re.search(r'[0-9]',q['text']) for q in ss):
            for q in ss: w.append(dict(text=q['text'],start=q['start'],end=q['end'],ti=j1))
            log.append(('KEEPDEL',' '.join(q['text'] for q in ss),''))
        else: log.append(('DROP',' '.join(q['text'] for q in ss),''))
    elif op=='insert':
        a=w[-1]['end'] if w else 0.0; b=S[i1]['start'] if i1<len(S) else a+0.3
        spread(a,max(b,a+0.05),T[j1:j2],list(range(j1,j2)))
        log.append(('INS','',' '.join(T[j1:j2])))
# merge glitch: digits followed by unit already merged by scribe; ensure monotonic
for k in range(1,len(w)):
    if w[k]['start']<w[k-1]['end']-0.001: w[k]['start']=w[k-1]['end']
    if w[k]['end']<w[k]['start']: w[k]['end']=w[k]['start']+0.02
for q in w:
    q['text']=re.sub(r'^([0-9]+)주차',r'\1주 차',q['text'])
for l in log: print(*l,sep=' | ')
starts=[]
for p in pstart:
    starts.append(next(k for k,q in enumerate(w) if q['ti']>=p))
assert starts==sorted(starts) and len(set(starts))==13, starts
print('starts',starts,[w[i]['text'] for i in starts])
ps=set(starts); LONG={starts[i] for i in (1,2,3,5,6,8,10,11)}
out=[];tmap=[];newt=0.0
def add(a,b):
    global newt
    s=x[int(a*sr):int(b*sr)];out.append(s);tmap.append((a,newt));newt+=len(s)/sr;tmap.append((b,newt))
prev=max(0,w[0]['start']-0.35)
for k in range(len(w)-1):
    g0=w[k]['end'];g1=w[k+1]['start'];cap=1.9 if (k+1) in LONG else (0.85 if (k+1) in ps else 0.6)
    if (k+1) in LONG and g1-g0<cap:
        add(prev,g0+0.3); pad=cap-(g1-g0); out.append(np.zeros(int(pad*sr))); tmap.append((g0+0.3,newt)); tmap.append((g0+0.3+1e-4,newt+pad)); newt+=pad; prev=g0+0.3
    elif g1-g0>cap+0.02: add(prev,g0+cap/2);prev=g1-cap/2
add(prev,min(len(x)/sr,w[-1]['end']+0.6))
y=[]
for s in out:
    s=s.copy();n=min(len(s)//2,int(0.012*sr))
    if n>0: s[:n]*=np.linspace(0,1,n);s[-n:]*=np.linspace(1,0,n)
    y.append(s)
y=np.concatenate(y);sf.write(B+'build/vo_tight.wav',y,sr)
ta=np.array([a for a,b in tmap]);tb=np.array([b for a,b in tmap])
M=lambda t:float(np.interp(t,ta,tb))/TEMPO
subprocess.run(['ffmpeg','-v','error','-y','-i',B+'build/vo_tight.wav','-af',
 f'rubberband=tempo={TEMPO}:pitchq=quality,highpass=f=70,equalizer=f=250:t=q:w=1.2:g=-1.5,equalizer=f=140:t=q:w=1.0:g=1.0,equalizer=f=3800:t=q:w=1.5:g=2.0,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.4:attack=8:release=160:makeup=2,alimiter=limit=0.89',
 '-ar','48000',B+'build/vo_proc.wav'],check=True)
ww=[dict(t=q['text'],s=M(q['start']),e=M(q['end'])) for q in w]
json.dump(dict(words=ww,sec_starts=[ww[i]['s'] for i in starts],starts=starts,vo_end=ww[-1]['e']),open(B+'build/timing.json','w'),ensure_ascii=False)
cues=subwrap.cues_from_words(ww)
for c in cues:
    if len(c[2])>1 and subwrap.audit([c]) and len(' '.join(c[2]))<=24: c[2]=[' '.join(c[2])]
bad=subwrap.audit(cues); print('cues',len(cues),'bad',bad,'maxlen',max(len(l) for c in cues for l in c[2]))
cues=[[a,b,' '.join(l),l] for a,b,l in cues]
json.dump(cues,open(B+'build/cues.json','w'),ensure_ascii=False)
def ts(t):
    ms=int(round(t*1000));return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
with open(B+f'build/EP{E}_ko_vo.srt','w') as f:
    for k,c in enumerate(cues): f.write(f"{k+1}\n{ts(c[0]+1.0)} --> {ts(c[1]+1.0)}\n"+'\n'.join(c[3])+"\n\n")
print('vo_end',round(ww[-1]['e'],1),'secs',[round(ww[i]['s'],1) for i in starts])
