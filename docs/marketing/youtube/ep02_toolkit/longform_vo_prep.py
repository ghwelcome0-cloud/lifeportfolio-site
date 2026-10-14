import json,re,subprocess,numpy as np,soundfile as sf
B='/home/user/ax-work/yt-ep02/'
TEMPO=1.04
w=json.load(open(B+'vo/words.json'))['words']
paras=open(B+'narration.txt').read().strip().split('\n\n')
H=lambda s:re.sub(r'[^가-힣]','',s)
# paragraph start word indices
starts=[];i=0
for p in paras:
    key=H(p)[:4]
    while i<len(w):
        if H(''.join(x['text'] for x in w[i:i+5])).startswith(key): break
        i+=1
    assert i<len(w),p[:20]
    starts.append(i);i+=1
print('starts',starts)
pstart=set(starts)
x,sr=sf.read(B+'vo/vo_raw.wav')
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
 f'rubberband=tempo={TEMPO}:pitchq=quality,highpass=f=70,equalizer=f=250:t=q:w=1.2:g=-1.5,equalizer=f=3800:t=q:w=1.5:g=1.5,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.2:attack=8:release=160:makeup=2',
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
with open(B+'build/EP02_ko.srt','w') as f:
    for k,c in enumerate(cues): f.write(f"{k+1}\n{ts(c[0])} --> {ts(c[1])}\n"+'\n'.join(c[3])+"\n\n")
print('cues',len(cues),'max lines',max(len(c[3]) for c in cues),'secs',[round(s,1) for s in sec])
