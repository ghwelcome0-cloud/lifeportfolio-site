# insert (현장음) beats: extra silence before given paragraphs -> vo_paused.wav, timing_p.json, cues_p.json, SRT
import json,numpy as np,soundfile as sf
B='/home/user/ax-work/yt-ep04/build/'
PAUSE={1:1.3,2:1.3,3:1.3,5:1.4,6:1.3,8:1.3,10:1.4,11:1.4}
T=json.load(open(B+'timing.json'));C=json.load(open(B+'cues.json'))
x,sr=sf.read(B+'vo_proc.wav')
W=T['words'];ST=T['starts']
cuts=[]  # (time in old, extra)
for p,d in sorted(PAUSE.items()):
    i=ST[p]; t=(W[i-1]['e']+W[i]['s'])/2; cuts.append((t,d))
def sh(t): return t+sum(d for c,d in cuts if c<=t)
segs=[];prev=0
for c,d in cuts:
    segs.append(x[int(prev*sr):int(c*sr)]); segs.append(np.zeros((int(d*sr),)+x.shape[1:])); prev=c
segs.append(x[int(prev*sr):]); y=np.concatenate(segs); sf.write(B+'vo_paused.wav',y,sr)
for w in W: w['s']=sh(w['s']); w['e']=sh(w['e'])
T['vo_end']=sh(T['vo_end']); T['sec_starts']=[W[i]['s'] for i in ST]; T['pauses']=[[sh(c)-d,d] for c,d in cuts]
json.dump(T,open(B+'timing_p.json','w'),ensure_ascii=False)
for c in C:
    a,b=c[0],c[1]; c[0]=sh(a); c[1]=sh(b) if sh(b)-sh(a)<b-a+0.01 else sh(a)+(b-a)
json.dump(C,open(B+'cues_p.json','w'),ensure_ascii=False)
def ts(t):
    ms=int(round(t*1000));return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
OFF=1.0
with open(B+'EP04_ko.srt','w') as f:
    for k,c in enumerate(C): f.write(f"{k+1}\n{ts(c[0]+OFF)} --> {ts(c[1]+OFF)}\n"+'\n'.join(c[3])+"\n\n")
print('vo_end',round(T['vo_end'],2),'len',round(len(y)/sr,2),'secs',[round(s,1) for s in T['sec_starts']],'pauses',[[round(a,1),d] for a,d in T['pauses']])
