import json,subprocess,numpy as np,soundfile as sf
S='/home/user/ax-work/shorts/src/';O='/home/user/ax-work/shorts/s3/'
TEMPO=1.04
w=json.load(open(S+'w3.json'))['words']
w[-2]['text']='인생'; w[-1]['text']='다이어리.'
for x in w:
    if x['text']=='코트폴리오,': x['text']='포트폴리오,'
x,sr=sf.read(S+'t3.wav');out=[];tm=[];nt=0.0
hk,_=sf.read(S+'hook_trim.wav')
cut=w[3]['start']-0.30   # original hook ends; keep from '연구'
x=np.concatenate([hk,np.zeros(int(0.30*sr)),x[int(cut*sr):]])
shift=len(hk)/sr+0.30-cut
for i,ww_ in enumerate(w):
    if i>=3: ww_['start']+=shift; ww_['end']+=shift
for i,(a,b) in enumerate([(0.12,0.50),(0.56,1.26),(1.40,1.98)]): w[i]['start'],w[i]['end']=a,b
def add(a,b):
    global nt
    s=x[int(a*sr):int(b*sr)].copy();n=min(len(s)//2,int(.01*sr))
    if n: s[:n]*=np.linspace(0,1,n);s[-n:]*=np.linspace(1,0,n)
    out.append(s);tm.append((a,nt));nt+=len(s)/sr;tm.append((b,nt))
prev=0.0
for k in range(len(w)-1):
    g0,g1=w[k]['end'],w[k+1]['start'];t=w[k]['text']
    cap=0.42 if t.endswith(('.','?')) else (0.3 if t.endswith(',') else 9)
    if g1-g0>cap+0.02: add(prev,g0+cap/2);prev=g1-cap/2
add(prev,min(len(x)/sr,w[-1]['end']+0.4))
LEAD=0.25
y=np.concatenate(out)
y=np.concatenate([np.zeros(int(LEAD*sr)),y]);sf.write(O+'vo_tight.wav',y,sr)
tm=[(a,b+LEAD) for a,b in tm]
ta=np.array([a for a,b in tm]);tb=np.array([b for a,b in tm]);M=lambda t:float(np.interp(t,ta,tb))/TEMPO
subprocess.run(['ffmpeg','-v','error','-y','-i',O+'vo_tight.wav','-af',f'rubberband=tempo={TEMPO}:pitchq=quality,highpass=f=70,equalizer=f=250:t=q:w=1.2:g=-1.5,equalizer=f=3800:t=q:w=1.5:g=1.5,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.2:attack=8:release=160:makeup=2','-ar','48000',O+'vo_proc.wav'],check=True)
ww=[dict(t=a['text'],s=M(a['start']),e=M(a['end'])) for a in w]
json.dump(ww,open(O+'words.json','w'),ensure_ascii=False)
print('dur',len(y)/sr/TEMPO,'last',ww[-1])
