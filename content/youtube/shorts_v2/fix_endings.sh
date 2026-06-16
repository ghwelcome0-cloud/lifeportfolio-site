#!/bin/bash
# 끝맺음 수정: video_xf(원본 write-on 영상)에 freeze tail을 붙여 음성 길이에 맞추고
# 원본 음성 풀버전으로 다시 믹스한다.  사용법: bash fix_endings.sh <EP번호>
set +e
cd /home/user/webapp/content/youtube/shorts_v2
N=$1
DIR="ep$N/work"
RAW="$DIR/ep${N}_voice.wav"
BGM="$DIR/bgm.mp3"
SRC="$DIR/video_xf.mp4"     # 원본 write-on 영상(음성無)

RAWD=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$RAW")
TARGET=$(python3 -c "print(round($RAWD+0.3,3))")
CURV=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SRC")
ADD=$(python3 -c "print(round($TARGET-$CURV,3))")
echo "EP$N: raw=$RAWD target=$TARGET src=$CURV add=$ADD"

# freeze tail 추가
BIG=$(python3 -c "print(1 if $ADD>0.05 else 0)")
if [ "$BIG" = "1" ]; then
  ffmpeg -y -loglevel error -sseof -0.2 -i "$SRC" -frames:v 1 -q:v 2 "$DIR/lastframe.png"
  ffmpeg -y -loglevel error -loop 1 -t "$ADD" -i "$DIR/lastframe.png" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 19 -r 30 "$DIR/tail_freeze.mp4"
  printf "file 'video_xf.mp4'\nfile 'tail_freeze.mp4'\n" > "$DIR/cat_fix.txt"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$DIR/cat_fix.txt" \
    -c:v libx264 -preset veryfast -crf 19 -r 30 -pix_fmt yuv420p "$DIR/video_fixed.mp4"
else
  cp "$SRC" "$DIR/video_fixed.mp4"
fi
VDUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DIR/video_fixed.mp4")
echo "EP$N: video_fixed=$VDUR"

# 음성 마스터 재생성 (풀버전, 영상 길이에 맞춰 패딩+페이드아웃)
FADEOUT=$(python3 -c "print(round($VDUR-0.6,3))")
BGMFADE=$(python3 -c "print(round($VDUR-1.0,3))")
ffmpeg -y -loglevel error -i "$RAW" -af "apad,atrim=0:$VDUR,afade=t=out:st=$FADEOUT:d=0.5" "$DIR/voice_full.wav"
ffmpeg -y -loglevel error -stream_loop -1 -i "$BGM" -t "$VDUR" \
  -af "volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=$BGMFADE:d=1.0" "$DIR/bgm_fix.wav"
ffmpeg -y -loglevel error -i "$DIR/voice_full.wav" -i "$DIR/bgm_fix.wav" \
  -filter_complex "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[d];[0:a][d]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
  -map "[a]" -ar 48000 "$DIR/master_fix.wav"

# 최종 mux: 1차(faststart 없이) -> 2차(faststart copy). moov 오류 방지
rm -f "ep$N/output/EP$N.mp4"
ffmpeg -y -loglevel error -i "$DIR/video_fixed.mp4" -i "$DIR/master_fix.wav" \
  -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "$DIR/mux_nofs.mp4"
ffmpeg -y -loglevel error -i "$DIR/mux_nofs.mp4" -c copy -movflags +faststart "ep$N/output/EP$N.mp4"

FINAL=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "ep$N/output/EP$N.mp4")
echo "EP$N: DONE final=$FINAL"
