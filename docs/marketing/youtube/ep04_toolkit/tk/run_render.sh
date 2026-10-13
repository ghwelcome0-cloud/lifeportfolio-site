#!/bin/bash
cd /home/user/ax-work/yt-ep04
for a in $(seq 0 60 360); do
  b=$((a+60)); out=build/chunks/c_$(printf %03d $a).mp4
  [ -s "$out.ok" ] && continue
  python3 tk/render.py render $a $b $out && echo ok > $out.ok
done
echo ALLDONE
ls build/chunks/c_*.mp4 | sort | sed "s#^#file '$PWD/#;s#\$#'#" > build/concat.txt
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 409.8 -movflags +faststart build/EP04_longform.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact build/EP04_longform.mp4 > qa/probe.txt
ffmpeg -v error -i build/EP04_longform.mp4 -f null - 2> qa/decode_err.txt
ffmpeg -nostats -i build/EP04_longform.mp4 -vf "freezedetect=n=0.003:d=1.5" -map 0:v -f null - 2>&1 | grep freeze_ > qa/freeze.txt
ffmpeg -nostats -i build/EP04_longform.mp4 -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:|LRA:" | tail -3 > qa/loud.txt
ffmpeg -v error -y -i build/EP04_longform.mp4 -vf "fps=1/16.4,scale=384:-1,tile=5x5" -frames:v 1 qa/contact.jpg
sed 's#yt-ep03/build/EP03#yt-ep04/build/EP04#' /home/user/ax-work/yt-ep03/tk/qa_flow.py > tk/qa_flow.py; sed -i "s#build/EP03_longform.mp4#build/EP04_longform.mp4#" tk/qa_flow.py
python3 tk/qa_flow.py > qa/flow.txt 2>&1
echo FINALDONE > qa/done.txt
