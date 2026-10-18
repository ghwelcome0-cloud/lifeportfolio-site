# EP.04 VO prep: concat 5 parts -> gap compress -> tempo/EQ -> timing.json + cues (subwrap v3)
import json,re,subprocess,sys,numpy as np,soundfile as sf
sys.path.insert(0,'/home/user/ax-work/series'); import subwrap
B='/home/user/ax-work/yt-ep04/'; TEMPO=1.03
# 1) concat parts with word offsets
xs=[];w=[];off=0.0;SR=None
for i in range(1,6):
    subprocess.run(['ffmpeg','-v','error','-y','-i',B+f'vo/p{i}.mp3','-ac','1','-ar','44100',B+f'vo/p{i}.wav'],check=True)
    x,sr=sf.read(B+f'vo/p{i}.wav'); SR=sr
    for q in json.load(open(B+f'vo/w{i}.json'))['words']: w.append(dict(text=q['text'],start=q['start']+off,end=q['end']+off))
    gap=np.zeros(int(0.9*sr)); xs+= [x,gap]; off+=len(x)/sr+0.9
x=np.concatenate(xs); sr=SR
# 2) text fixes (TTS spoke the script; transcript spacing/homophones fixed to script)
REP={'까닥':'까닭','해보기.':'해 보기.','보여주기.':'보여 주기.','써보게':'써 보게','해보고':'해 보고','보여주고':'보여 주고','저장해둔':'저장해 둔',
'그려줍니다.':'그려 줍니다.','짚어줍니다.':'짚어 줍니다.','밝혀주는':'밝혀 주는','적어보기.':'적어 보기.','적어봅니다.':'적어 봅니다.','풀어본':'풀어 본',
'적어왔고,':'적어 왔고,','끝나갈':'끝나 갈','신입교육을':'신입 교육을','신입교육':'신입 교육','첫걸음입니다.':'첫 걸음입니다.','모양':'모양.','11장':'11장,'}
for k,q in enumerate(w):
    t=q['text'].replace('"','').replace('“','').replace('”','')
    nx=w[k+1]['text'] if k+1<len(w) else ''; pv=w[k-1]['text'] if k else ''
    if t=='새' and nx.startswith('카드'): t='세'
    elif t=='다이어리에' and nx.replace('"','').startswith('오늘'): t='다이어리의'
    elif t=='해봤어요에': t='해 봤어요에'
    elif t=='11장' and nx=='자산화': t='11장,'
    elif t=='교대' and nx.startswith('조장'): t='교대'+nx; q['end']=w[k+1]['end']; w[k+1]['text']=''
    elif t=='고객' and nx=='경험': t='고객경험'; q['end']=w[k+1]['end']; w[k+1]['text']=''
    elif t in REP and not (t=='11장' ) and not (t=='모양' and nx!='모두'): t=REP[t]
    if t=='34살': t='34살,'
    if t=='차' and nx in('해보기.','해 보기.','다듬기.','까닥','까닭','보여주기.','보여 주기.','소개하기.','고쳐','넓히기.','돌아보기.','써보게','써 보게','묶기.','건네기.','카드'): t='차,'
    q['text']=t
w=[q for q in w if q['text']]
for k,q in enumerate(w):
    if q['text']=='해보기.' : q['text']='해 보기.'
    if q['text']=='보여주기.': q['text']='보여 주기.'
print(' '.join(q['text'] for q in w)[:3000])
H=lambda s:re.sub(r'[^가-힣]','',s)
KEYS=['새벽','윤서씨는올해','근무가끝나','윤서씨가받은','윤서씨는자산화맞춤','주부터주는보여','주부터주는일터','주차써보게','주차묶기','주차오후','같은밝힘이','주가지났습니다','고유함은발견']
starts=[];i=0
for key in KEYS:
    while i<len(w):
        if H(''.join(q['text'] for q in w[i:i+5])).startswith(key): break
        i+=1
    assert i<len(w),key
    starts.append(i);i+=1
print('starts',starts)
ps=set(starts); LONG={starts[i] for i in (1,2,3,5,6,8,10,11)}  # (현장음) beats: 1.9s of field sound before these paragraphs
out=[];tmap=[];newt=0.0
def newt_add(d):
    global newt; newt+=d
def add(a,b):
    global newt
    s=x[int(a*sr):int(b*sr)];out.append(s);tmap.append((a,newt));newt+=len(s)/sr;tmap.append((b,newt))
prev=max(0,w[0]['start']-0.35)
for k in range(len(w)-1):
    g0=w[k]['end'];g1=w[k+1]['start'];cap=1.9 if (k+1) in LONG else (0.85 if (k+1) in ps else 0.6)
    if (k+1) in LONG and g1-g0<cap:  # pad with silence
        add(prev,g0+0.3); out.append(np.zeros(int((cap-(g1-g0))*sr))); global_pad=cap-(g1-g0); tmap.append((g0+0.3,newt)); tmap.append((g0+0.3+1e-4,newt+global_pad)); newt_add(global_pad); prev=g0+0.3
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
# a short cue whose only possible break is a forbidden one stays on one line (<=24 chars)
for c in cues:
    if len(c[2])>1 and subwrap.audit([c]) and len(' '.join(c[2]))<=24: c[2]=[' '.join(c[2])]
bad=subwrap.audit(cues); print('cues',len(cues),'bad',bad,'maxlen',max(len(l) for c in cues for l in c[2]))
cues=[[a,b,' '.join(l),l] for a,b,l in cues]
json.dump(cues,open(B+'build/cues.json','w'),ensure_ascii=False)
def ts(t):
    ms=int(round(t*1000));return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
with open(B+'build/EP04_ko_vo.srt','w') as f:
    for k,c in enumerate(cues): f.write(f"{k+1}\n{ts(c[0])} --> {ts(c[1])}\n"+'\n'.join(c[3])+"\n\n")
print('vo_end',round(ww[-1]['e'],1),'secs',[round(ww[i]['s'],1) for i in starts])
