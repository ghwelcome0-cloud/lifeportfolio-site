#!/bin/bash
# after run_ep.sh: verify QA, commit to repo, upload via gsk, record links, delete local mp4
E=$1; cd /home/user/ax-work/yt-ep$E; R=/tmp/final_$E.txt; : > $R
F=build/EP${E}_longform.mp4; [ -s $F ] || { echo "NOFILE" >> $R; exit 1; }
DEC=$(wc -c < qa/decode_err.txt); FRZ=$(grep -c freeze_start qa/freeze.txt)
LUF=$(ffmpeg -nostats -i $F -filter_complex ebur128=peak=true -vn -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' ' | tr '\n' ' ')
FLOW=$(grep -o "1.5px: [0-9]*" qa/flow.txt)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $F)
echo "EP$E dur=$DUR decode=$DEC freeze=$FRZ $LUF flow=$FLOW" >> $R
cp build/EP${E}_ko_vo.srt build/EP${E}_ko.srt
D=/home/user/diary-wt/docs/marketing/youtube/ep05_10_prep/EP$E; mkdir -p $D/thumb
cp build/EP${E}_METADATA.md build/EP${E}_ko.srt $D/; cp build/thumb/*_1280.jpg build/thumb/compare_sheet.jpg $D/thumb/; cp qa/contact.jpg $D/EP${E}_qa_contact.jpg
echo "$(cat $R)" > $D/EP${E}_QA.txt
(cd /home/user/diary-wt && git add docs/marketing/youtube/ep05_10_prep && git commit -qm "EP$E longform done: QA, metadata, srt, thumbs" && git push -q origin HEAD) >> $R 2>&1
for f in $F build/thumb/V1_hook_1280.jpg build/thumb/V2_xi_1280.jpg build/thumb/V3_12weeks_1280.jpg build/EP${E}_ko.srt build/EP${E}_METADATA.md qa/contact.jpg; do
  u=$(gsk upload $f 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',d).get('file_wrapper_url') or d)" 2>&1)
  echo "$(basename $f) $u" >> $R
done
if grep -q "longform.mp4 https" $R; then rm -f $F build/mix.wav; echo DELETED >> $R; fi
echo FINALDONE >> $R
