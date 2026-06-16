#!/bin/bash
# 끝맺음 수정: 마지막 멘트가 잘린 EP들의 영상을 음성 길이에 맞게 늘리고
# 원본 음성 풀버전으로 다시 믹스한다.
# 사용법: bash fix_endings.sh <EP번호>
set +e
N=$1
DIR="ep$N/work"
RAW="$DIR/ep${N}_voice.wav"
BGM="$DIR/bgm.mp3"
SRCVID="ep$N/output/EP$N.mp4"     # 기존 완성본(영상 트랙 재사용)
OUT="ep$N/output/EP$N.mp4"        # 덮어쓰기 (백업 후)

cd /home/user/webapp/content/youtube/shorts_v2

# 1) 원본 음성 전체 길이 + 0.3초 여유 = 목표 길이
RAWD=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$RAW")
TARGET=$(python3 -c "print(round($RAWD+0.3,3))")
echo "EP$N: raw음성=$RAWD -> 목표길이=$TARGET"

# 2) 기존 영상에서 영상 트랙만 추출(무음), 현재 길이 측정
CURV=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SRCVID")
ADD=$(python3 -c "print(round($TARGET-$CURV,3))")
echo "EP$N: 현재영상=$CURV, 추가freeze=$ADD"

ffmpeg -y -loglevel error -i "$SRCVID" -an -c:v copy "$DIR/vsrc.mp4"

if (( $(python3 -c "print(1 if $ADD>0.05 else 0)") )); then
  # 마지막 프레임 추출
  ffmpeg -y -loglevel error -sseof -0.1 -i "$DIR/vsrc.mp4" -frames:v 1 -q:v 2 "$DIR/lastframe.png"
  # freeze tail 클립 생성
  ffmpeg -y -loglevel error -loop 1 -t "$ADD" -i "$DIR/lastframe.png" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 19 -r 30 "$DIR/tail_freeze.mp4"
  # concat (영상 트랙)
  printf "file 'vsrc.mp4'\nfile 'tail_freeze.mp4'\n" > "$DIR/cat_fix.txt"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$DIR/cat_fix.txt" \
    -c:v libx264 -preset medium -crf 19 -r 30 -pix_fmt yuv420p "$DIR/video_fixed.mp4"
else
  cp "$DIR/vsrc.mp4" "$DIR/video_fixed.mp4"
fi

VDUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DIR/video_fixed.mp4")
echo "EP$N: 수정영상길이=$VDUR"

# 3) 음성 마스터 재생성 (음성 풀버전 사용, 영상길이에 맞춰 페이드만)
FADEOUT=$(python3 -c "print(round($VDUR-0.6,3))")
BGMFADE=$(python3 -c "print(round($VDUR-1.0,3))")
# 음성은 원본 그대로 두되, 영상보다 음성이 짧으면 무음패딩, 길면 아주 살짝만 페이드
ffmpeg -y -loglevel error -i "$RAW" -af "apad,atrim=0:$VDUR,afade=t=out:st=$FADEOUT:d=0.5" "$DIR/voice_full.wav"
ffmpeg -y -loglevel error -stream_loop -1 -i "$BGM" -t "$VDUR" \
  -af "volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=$BGMFADE:d=1.0" "$DIR/bgm_fix.wav"
ffmpeg -y -loglevel error -i "$DIR/voice_full.wav" -i "$DIR/bgm_fix.wav" \
  -filter_complex "
    [1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[bgduck];
    [0:a][bgduck]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[aout]
  " -map "[aout]" -ar 48000 "$DIR/master_fix.wav"

# 4) 최종 mux (백업 먼저)
cp "$SRCVID" "ep$N/output/EP${N}_old.mp4"
ffmpeg -y -loglevel error -i "$DIR/video_fixed.mp4" -i "$DIR/master_fix.wav" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest "ep$N/output/EP$N.mp4"

FINAL=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "ep$N/output/EP$N.mp4")
echo "EP$N: ✅ 완료 최종길이=$FINAL"
