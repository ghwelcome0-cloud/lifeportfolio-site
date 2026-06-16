#!/bin/bash
set -e
cd "$(dirname "$0")"
# Reveal via geq alpha mask: keep alpha where X < revealX(t); else 0.
# revealX(t) for top over [0,wd1]; bottom over [wd1, wd1+wd2].
twoline() {
  local out=$1 bg=$2 top=$3 bot=$4 dur=$5 wd1=$6 wd2=$7 xs=$8 xe=$9
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" \
    -loop 1 -t $dur -i "$top" \
    -loop 1 -t $dur -i "$bot" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*min(T/${wd1},1)), alpha(X,Y), 0)'[t1];
      [2:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*max(0,min((T-${wd1})/${wd2},1))), alpha(X,Y), 0)'[t2];
      [bgv][t1]overlay=0:0[s1];
      [s1][t2]overlay=0:0,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
  echo "$out done"
}
twoline c_a.mp4 bg_a.png ch_hook_t.png ch_hook_b.png 4.7 0.9 0.9 210 870
echo "A DONE"
