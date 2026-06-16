#!/bin/bash
set -e
cd "$(dirname "$0")"

# Sequential 2-line write-on.
# args: out bg topPNG botPNG dur wd1 wd2 xs xe
twoline() {
  local out=$1 bg=$2 top=$3 bot=$4 dur=$5 wd1=$6 wd2=$7 xs=$8 xe=$9
  # top revealed over [0,wd1]; bottom revealed over [wd1, wd1+wd2]
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" \
    -loop 1 -t $dur -i "$top" \
    -loop 1 -t $dur -i "$bot" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,crop=w='min(1080, ${xs} + (${xe}-${xs})*min(t/${wd1},1))':h=1920:x=0:y=0[t1];
      [2:v]fps=30,format=rgba,crop=w='min(1080, ${xs} + (${xe}-${xs})*max(0,min((t-${wd1})/${wd2},1)))':h=1920:x=0:y=0[t2];
      [bgv][t1]overlay=0:0:format=auto[s1];
      [s1][t2]overlay=0:0:format=auto,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
  echo "$out done (2-line write-on)"
}

# A: hook 4.7s, top 0.9s then bottom 0.9s
twoline c_a.mp4 bg_a.png ch_hook_t.png ch_hook_b.png 4.7 0.9 0.9 210 870
# D: core 6.0s, slightly slower
twoline c_d.mp4 bg_d.png ch_core_t.png ch_core_b.png 6.0 1.0 1.0 210 870
# G: ending 7.9s
twoline c_g.mp4 bg_g.png ch_end_t.png ch_end_b.png 7.9 1.0 1.0 210 870
echo "CHALK2 DONE"
