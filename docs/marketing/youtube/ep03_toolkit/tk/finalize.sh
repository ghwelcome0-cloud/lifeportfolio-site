#!/bin/bash
cd /home/user/ax-work/yt-ep03
until grep -q ALLDONE /tmp/render.log; do sleep 20; done
ls build/chunks/c_*.mp4 | sort | sed "s/^/file '/;s/$/'/;s#file '#file '$PWD/#" > build/concat.txt
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 503.89 -movflags +faststart build/EP03_longform.mp4
mkdir -p qa
[ -s build/EP03_longform.mp4 ] || { echo MUXFAIL > qa/done.txt; exit 1; }
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact build/EP03_longform.mp4 > qa/probe.txt
ffmpeg -v error -i build/EP03_longform.mp4 -f null - 2> qa/decode_err.txt
ffmpeg -nostats -i build/EP03_longform.mp4 -vf "freezedetect=n=0.003:d=1.5" -map 0:v -f null - 2>&1 | grep freeze_ > qa/freeze.txt
ffmpeg -nostats -i build/EP03_longform.mp4 -filter_complex ebur128=peak=true -vn -f null - 2>&1 | tail -12 > qa/loud.txt
ffmpeg -v error -y -i build/EP03_longform.mp4 -vf "fps=1/20,scale=384:-1,tile=5x5" -frames:v 1 qa/contact.jpg
echo FINALDONE > qa/done.txt
