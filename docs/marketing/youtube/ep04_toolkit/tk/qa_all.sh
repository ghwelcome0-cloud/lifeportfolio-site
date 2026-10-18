cd /home/user/ax-work/yt-ep04
ffmpeg -v error -i build/EP04_longform.mp4 -f null - 2> qa/decode_err.txt
ffmpeg -nostats -i build/EP04_longform.mp4 -vf "freezedetect=n=0.003:d=1.5" -map 0:v -f null - 2>&1 | grep freeze_ > qa/freeze.txt
ffmpeg -nostats -i build/EP04_longform.mp4 -filter_complex ebur128=peak=true -vn -f null - 2>&1 | tail -12 > qa/loud.txt
ffmpeg -v error -y -i build/EP04_longform.mp4 -vf "fps=1/16,scale=384:-1,tile=5x6" -frames:v 1 qa/contact.jpg
python3 tk/qa_flow.py > qa/flow.txt 2>&1
echo QADONE > qa/qa_done.txt
