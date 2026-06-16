#!/bin/bash
# 공통 빌드 함수 라이브러리 — EP3~EP12 공용
# 사용법: source build_lib.sh (각 EP work 디렉터리에서)
set +e

# 칠판+브랜드+CTA 베이스
mk_base() {
  ffmpeg -y -loglevel error -i board.png -i brand.png -i cta.png \
    -filter_complex "[0][1]overlay=0:0[a];[a][2]overlay=0:0" base.png
}

# base + 손글씨(완성) + 자막 = full background
mk_full() { ffmpeg -y -loglevel error -i base.png -i "$2" -i "$3" -filter_complex "[0][1]overlay=0:0[a];[a][2]overlay=0:0" "$1"; }
# base + 자막만 = writeon 시작 배경 / 정적 자막 배경
mk_bg()   { ffmpeg -y -loglevel error -i base.png -i "$2" -filter_complex "[0][1]overlay=0:0" "$1"; }

# 2줄 write-on
twoline() {
  local out=$1 bg=$2 top=$3 bot=$4 dur=$5 wd1=$6 wd2=$7 xs=$8 xe=$9
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" -loop 1 -t $dur -i "$top" -loop 1 -t $dur -i "$bot" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*min(T/${wd1},1)), alpha(X,Y), 0)'[t1];
      [2:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*max(0,min((T-${wd1})/${wd2},1))), alpha(X,Y), 0)'[t2];
      [bgv][t1]overlay=0:0[s1];[s1][t2]overlay=0:0,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
}

# 1줄 write-on
oneline() {
  local out=$1 bg=$2 layer=$3 dur=$4 wd=$5 xs=$6 xe=$7
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" -loop 1 -t $dur -i "$layer" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*min(T/${wd},1)), alpha(X,Y), 0)'[t1];
      [bgv][t1]overlay=0:0,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
}

# 정적 클립 (png, dur, out)
staticclip() {
  ffmpeg -y -loglevel error -loop 1 -t $2 -i "$1" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 "$3"
}

# reveal + tail concat (name, total_dur, reveal_dur)
# rev_<name>.mp4 + full_<name>.png(tail) -> c_<name>.mp4
catseg() {
  local name=$1 total=$2 rev=$3
  local tail=$(python3 -c "print(round($total-$rev,3))")
  staticclip full_$name.png $tail tail_$name.mp4
  printf "file '%s'\nfile '%s'\n" "rev_$name.mp4" "tail_$name.mp4" > cat_$name.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i cat_$name.txt \
    -c:v libx264 -preset veryfast -crf 20 -r 30 -pix_fmt yuv420p "c_$name.mp4"
}

# 2줄 손글씨 분할 (PNG name -> name_t.png, name_b.png), x-range/split-y 출력
split2line() {
  python3 - "$1" <<'PY'
from PIL import Image
import numpy as np, sys
n=sys.argv[1]
a=np.array(Image.open(n+'.png').convert('RGBA'))
alpha=a[:,:,3]
rows=np.where(alpha.sum(axis=1)>0)[0]
rowsum=(alpha.sum(axis=1)>0).astype(int)
top,bot=rows[0],rows[-1]
best=(0,0); y=top
while y<=bot:
    if rowsum[y]==0:
        gs=y
        while y<=bot and rowsum[y]==0: y+=1
        if y-gs>best[1]-best[0]: best=(gs,y)
    else: y+=1
sy=(best[0]+best[1])//2 if best[1]>best[0] else (top+bot)//2
ti=a.copy(); ti[sy:,:,3]=0
bi=a.copy(); bi[:sy,:,3]=0
Image.fromarray(ti).save(n+'_t.png')
Image.fromarray(bi).save(n+'_b.png')
cols=np.where(alpha.sum(axis=0)>0)[0]
print(f"{n} split-y={sy} x={cols[0]}-{cols[-1]}")
PY
}

# 1줄 손글씨 x-range 측정
xrange() {
  python3 - "$1" <<'PY'
from PIL import Image
import numpy as np, sys
n=sys.argv[1]
a=np.array(Image.open(n+'.png').convert('RGBA'))
cols=np.where(a[:,:,3].sum(axis=0)>0)[0]
print(f"{n} x={cols[0]}-{cols[-1]}")
PY
}

# 마스터 오디오 (voice.wav, bgm.mp3, video_dur, out)
master_audio() {
  local voice=$1 bgm=$2 vdur=$3 out=$4
  local fadeout=$(python3 -c "print(round($vdur-0.6,3))")
  local bgmfade=$(python3 -c "print(round($vdur-1.0,3))")
  ffmpeg -y -loglevel error -i $voice -t $vdur -af "afade=t=out:st=$fadeout:d=0.5" voice_cut.wav
  ffmpeg -y -loglevel error -stream_loop -1 -i $bgm -t $vdur \
    -af "volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=$bgmfade:d=1.0" bgm_loop.wav
  ffmpeg -y -loglevel error -i voice_cut.wav -i bgm_loop.wav \
    -filter_complex "
      [1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[bgduck];
      [0:a][bgduck]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[aout]
    " -map "[aout]" -ar 48000 $out
}

# 최종 mux (video, audio, out)
final_mux() {
  ffmpeg -y -loglevel error -i "$1" -i "$2" \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 192k -shortest "$3"
}

echo "build_lib loaded"
