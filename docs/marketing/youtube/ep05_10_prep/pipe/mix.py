# mix: VO (1.0s lead) + BGM loop 0.20 ducked by VO (sidechain) + field sound beats; loudnorm -16 LUFS
import json,subprocess,sys
import sys; B=f'/home/user/ax-work/yt-ep{sys.argv[1]}/'; T=json.load(open(B+'build/timing.json')); W,S=T['words'],T['starts']
TOTAL=T['vo_end']+1.0+10.0
sec=[W[i]['s']+1.0 for i in S]
# field-sound beats: (start, dur, file, vol) — placed in the pauses before these sections + scene beds
beats=[(0.0,6.0,'sfx_main',0.55),(sec[1]-2.2,4.5,'sfx_main',0.50),(sec[2]-2.2,4.0,'sfx_paper',0.45),(sec[3]-2.2,4.0,'sfx_paper',0.50),
       (sec[5]-2.2,4.0,'sfx_paper',0.45),(sec[6]-2.2,4.0,'sfx_main',0.45),(sec[7]+0.0,8.0,'sfx_main',0.30),(sec[8]-2.2,4.0,'sfx_paper',0.45),
       (sec[9]-0.5,8.0,'sfx_office',0.40),(sec[10]-2.2,4.0,'sfx_office',0.45),(sec[11]-2.2,4.0,'sfx_paper',0.40),(T['vo_end']+1.2,8.0,'sfx_main',0.40)]
inp=['-i',B+'build/vo_proc.wav','-stream_loop','-1','-i',B+'build/bgm.mp3']
fc=['[0:a]adelay=1000|1000,apad=whole_dur=%.2f,aformat=channel_layouts=stereo,asplit=2[vo][sc]'%TOTAL,
    '[1:a]atrim=0:%.2f,volume=0.20,afade=t=in:d=2,afade=t=out:st=%.2f:d=5[bg]'%(TOTAL,TOTAL-5),
    '[bg][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=420[bgd]']
mixin=['[vo]','[bgd]']
for k,(t0,d,f,v) in enumerate(beats):
    inp+=['-i',B+f'build/{f}.mp3']; n=k+2; off=(k*3.1)%max(0.1,12-d)
    fc.append(f'[{n}:a]atrim={off:.2f}:{off+d:.2f},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,volume={v},afade=t=in:d=0.6,afade=t=out:st={d-1.2:.2f}:d=1.2,adelay={int(t0*1000)}|{int(t0*1000)}[s{k}]')
    mixin.append(f'[s{k}]')
fc.append(''.join(mixin)+f'amix=inputs={len(mixin)}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
subprocess.run(['ffmpeg','-v','error','-y',*inp,'-filter_complex',';'.join(fc),'-map','[out]','-ar','48000','-t','%.2f'%TOTAL,B+'build/mix.wav'],check=True)
print('mix ok',TOTAL)
