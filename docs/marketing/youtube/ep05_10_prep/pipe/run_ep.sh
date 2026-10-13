#!/bin/bash
# usage: run_ep.sh 05  -> mix, chunk render (60s, .ok resume), mux, QA
E=$1; cd /home/user/ax-work/yt-ep$E; export EP=$E
python3 /home/user/ax-work/series/pipe/mix.py $E || { echo MIXFAIL; exit 1; }
TOT=$(python3 -c "import json;t=json.load(open('build/timing.json'));print(round(t['vo_end']+11.0,2))")
mkdir -p build/chunks qa
for a in $(seq 0 60 420); do
  b=$((a+60)); out=build/chunks/c_$(printf %03d $a).mp4
  awk "BEGIN{exit !($a < $TOT)}" || continue
  [ -s "$out.ok" ] && continue
  python3 tk/render.py render $a $b $out && echo ok > $out.ok
done
echo ALLDONE
ls build/chunks/c_*.mp4 | sort | sed "s#^#file '$PWD/#;s#\$#'#" > build/concat.txt
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i build/mix.wav -map 0:v -map 1:a -c:v copy -af alimiter=limit=0.78:level=false:attack=2:release=60 -c:a aac -b:a 192k -t $TOT -movflags +faststart build/EP${E}_longform.mp4
[ -s build/EP${E}_longform.mp4 ] || { echo MUXFAIL; exit 1; }
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact build/EP${E}_longform.mp4 > qa/probe.txt
ffmpeg -v error -i build/EP${E}_longform.mp4 -f null - 2> qa/decode_err.txt
ffmpeg -nostats -i build/EP${E}_longform.mp4 -vf "freezedetect=n=0.003:d=1.5" -map 0:v -f null - 2>&1 | grep freeze_ > qa/freeze.txt
ffmpeg -nostats -i build/EP${E}_longform.mp4 -filter_complex ebur128=peak=true -vn -f null - 2>&1 | tail -12 > qa/loud.txt
ffmpeg -v error -y -i build/EP${E}_longform.mp4 -vf "fps=1/16,scale=384:-1,tile=5x6" -frames:v 1 qa/contact.jpg
sed "s#build/EP04_longform.mp4#build/EP${E}_longform.mp4#" /home/user/ax-work/yt-ep04/tk/qa_flow.py > tk/qa_flow.py; python3 tk/qa_flow.py > qa/flow.txt 2>&1
echo QADONE
