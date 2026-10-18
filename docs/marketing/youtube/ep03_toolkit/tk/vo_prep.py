import json,re,subprocess,numpy as np,soundfile as sf
B='/home/user/ax-work/yt-ep03/'
TEMPO=1.03
w=json.load(open(B+'vo2/words.json'))['words']
FIX=[('것의','것에'),('새','세'),('내','네'),('앞에','앞의'),('가상시험으로','가상 시험으로'),('해봤어요의','해 봤어요에'),('해봤어요','해 봤어요'),('"오늘','오늘'),('해봤어요"에','해 봤어요에'),('준비','준비중'),('중입니다.','입니다.'),('중이며','이며'),('중이라고','이라고')]
# context-aware fixes
for k,x_ in enumerate(w):
    t_=x_['text'];nx=w[k+1]['text'] if k+1<len(w) else ''; pv=w[k-1]['text'] if k else ''
    if t_=='것의' and nx.startswith('순서'): x_['text']='것에'
    elif t_=='새' and nx.startswith('카드'): x_['text']='세'
    elif t_=='내' and nx.startswith('영역'): x_['text']='네'
    elif t_=='앞에' and pv=='맨': x_['text']='앞의'
    elif t_=='가상시험으로': x_['text']='가상 시험으로'
    elif t_ in('해봤어요의','해봤어요"에'): x_['text']='해 봤어요에'
    elif t_=='"오늘': x_['text']='오늘'
    elif t_=='해봤어요': x_['text']='해 봤어요'
    elif t_=='비전' and nx in('카드에서는','카드에'): x_['text']='비전'+nx; x_['end']=w[k+1]['end']; w[k+1]['text']=''
    elif t_=='준비' and nx.startswith('중'): x_['text']='준비'+nx; x_['end']=w[k+1]['end']; w[k+1]['text']=''
    elif t_=='고유' and nx.startswith('코드'): x_['text']='고유'+nx; x_['end']=w[k+1]['end']; w[k+1]['text']=''
    elif t_=='길찾기' and pv=='자산화' and k>0 and w[k-2]['text'] in('리포트에','11장','11장에'): x_['text']='길 찾기'
for k,x_ in enumerate(w):
    if x_['text']=='동행' and k+1<len(w) and w[k+1]['text']=='대부분': x_['text']='동행.'
    if x_['text']=='12주' and k+1<len(w) and w[k+1]['text']=='매주': x_['text']='12주,'
    if x_['text']=='달' and k+1<len(w) and w[k+1]['text']=='해본': x_['text']='달,'
    if x_['text']=='1년' and k+1<len(w) and w[k+1]['text']=='그': x_['text']='1년,'
    x_['text']=x_['text'].replace('"','')
w=[x_ for x_ in w if x_['text']]
paras=open(B+'narration.txt').read().strip().split('\n\n')
H=lambda s:re.sub(r'[^가-힣]','',s)
# paragraph start word indices
starts=[];i=0
KEYS=['한사람의고유','오늘은네','홈페이지에는','한사람의응답','이일곱가','장에는이','홈페이지아래','길찾기는당신','결과는참고','길을찾았다','프로그램의한','장은','같은','이미리포트','순서는','자산화유형과','베드로전서','마이페이지의나의']
for p,key in zip(paras,KEYS):
    while i<len(w):
        if H(''.join(x['text'] for x in w[i:i+5])).startswith(key): break
        i+=1
    assert i<len(w),p[:20]
    starts.append(i);i+=1
print('starts',starts)
pstart=set(starts)
x,sr=sf.read(B+'vo2/vo_raw.wav')
# build keep-segments: compress gaps
segs=[];cur=0.0;tmap=[]  # list of (orig_t, new_t) anchors
out=[];newt=0.0
def add(a,b):
    global newt
    s=x[int(a*sr):int(b*sr)];out.append(s);tmap.append((a,newt));newt+=len(s)/sr;tmap.append((b,newt))
lead=0.35
prev=max(0,w[0]['start']-lead)
for k in range(len(w)-1):
    g0=w[k]['end'];g1=w[k+1]['start'];gap=g1-g0
    cap=0.85 if (k+1) in pstart else 0.6
    if gap>cap+0.02:
        mid_keep=cap/2
        add(prev,g0+mid_keep);prev=g1-mid_keep
add(prev,min(len(x)/sr,w[-1]['end']+0.6))
# crossfade-free concat with tiny fades at joints
y=[]
for s in out:
    s=s.copy();n=min(len(s)//2,int(0.012*sr));
    if n>0: s[:n]*=np.linspace(0,1,n);s[-n:]*=np.linspace(1,0,n)
    y.append(s)
y=np.concatenate(y);sf.write(B+'build/vo_tight.wav',y,sr)
ta=np.array([a for a,b in tmap]);tb=np.array([b for a,b in tmap])
M=lambda t:float(np.interp(t,ta,tb))/TEMPO
print('orig',len(x)/sr,'tight',len(y)/sr,'final',len(y)/sr/TEMPO)
subprocess.run(['ffmpeg','-v','error','-y','-i',B+'build/vo_tight.wav','-af',
 f'rubberband=tempo={TEMPO}:pitchq=quality,highpass=f=70,equalizer=f=250:t=q:w=1.2:g=-1.5,equalizer=f=140:t=q:w=1.0:g=1.0,equalizer=f=3800:t=q:w=1.5:g=2.0,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.4:attack=8:release=160:makeup=2,alimiter=limit=0.89',
 '-ar','48000',B+'build/vo_proc.wav'],check=True)
ww=[dict(t=x_['text'],s=M(x_['start']),e=M(x_['end'])) for x_ in w]
sec=[ww[i]['s'] for i in starts]
json.dump(dict(words=ww,sec_starts=sec,starts=starts,vo_end=ww[-1]['e']),open(B+'build/timing.json','w'),ensure_ascii=False)
# subtitles: sentence split on .,?! at word ends, wrap by 어절 ≤22 chars/line, ≤2 lines
cues=[];buf=[]
def flush():
    if buf: cues.append([buf[0]['s'],buf[-1]['e'],' '.join(b['t'] for b in buf)]);buf.clear()
for k,x_ in enumerate(ww):
    buf.append(x_);L=len(' '.join(b['t'] for b in buf))
    endp=re.search(r'[.?!]["”]?$',x_['t']);comma=x_['t'].endswith(',')
    if endp or (comma and L>=18) or L>=40: flush()
flush()
def wrap(t,n=24):
    if len(t)<=n: return [t]
    ws=t.split(' ');best=None
    for k in range(1,len(ws)):
        a=' '.join(ws[:k]);b=' '.join(ws[k:]);sc=max(len(a),len(b))+(0 if a.endswith(',') else 1.5)
        if best is None or sc<best[0]: best=(sc,[a,b])
    if max(len(x) for x in best[1])<=n+4: return best[1]
    lines=[''];
    for q in ws:
        if len(lines[-1])+len(q)+1>n and lines[-1]: lines.append(q)
        else: lines[-1]=(lines[-1]+' '+q).strip()
    return lines
for c in cues: c.append(wrap(c[2]))
# extend end slightly, no overlap
for k,c in enumerate(cues):
    nxt=cues[k+1][0] if k+1<len(cues) else c[1]+1
    c[1]=min(c[1]+0.25,nxt-0.04)
json.dump(cues,open(B+'build/cues.json','w'),ensure_ascii=False)
def ts(t):
    ms=int(round(t*1000));return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
with open(B+'build/EP03_ko.srt','w') as f:
    for k,c in enumerate(cues): f.write(f"{k+1}\n{ts(c[0])} --> {ts(c[1])}\n"+'\n'.join(c[3])+"\n\n")
print('cues',len(cues),'max lines',max(len(c[3]) for c in cues),'secs',[round(s,1) for s in sec])
