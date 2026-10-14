#!/bin/bash
cd /home/user/ax-work/yt-ep03
for a in $(seq 0 60 480); do
  b=$((a+60)); out=build/chunks/c_$(printf %03d $a).mp4
  [ -s "$out.ok" ] && continue
  python3 tk/render.py render $a $b $out && echo ok > $out.ok
done
echo ALLDONE
