#!/bin/bash
cd /home/user/ax-work/yt-ep03
for a in 300; do b=$((a+60)); out=build/chunks/c_$(printf %03d $a).mp4
  python3 tk/render.py render $a $b $out && echo ok > $out.ok; done
rm -f build/EP03_longform.mp4
ls build/chunks/c_*.mp4 | sort | sed "s#^#file '$PWD/#;s#\$#'#" > build/concat.txt
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 503.89 -movflags +faststart build/EP03_longform.mp4
ffmpeg -v error -i build/EP03_longform.mp4 -f null - 2> qa/decode_err.txt
ffmpeg -nostats -i build/EP03_longform.mp4 -vf "freezedetect=n=0.003:d=1.5" -map 0:v -f null - 2>&1 | grep freeze_ > qa/freeze.txt
ffmpeg -nostats -i build/EP03_longform.mp4 -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:|LRA:" | tail -3 > qa/loud.txt
python3 tk/qa_flow.py > qa/flow.txt 2>&1
echo FIXDONE > qa/done.txt
