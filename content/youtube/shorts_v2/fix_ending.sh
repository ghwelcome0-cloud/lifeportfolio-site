#!/bin/bash
# 끝맺음 수정: 영상 마지막 프레임 freeze 연장 + raw 음성 전체 재믹스
# 사용법: bash fix_ending.sh <ep>
set +e
cd "$(dirname "$0")"
N=$1
DIR="ep$N"
W="$DIR/work"
SRC="$W/video_xf.mp4"     # 깨끗한 비디오 소스 (xfade 완료, 음성 입히기 전)
RAW=$(ls $DIR/work/*voice*.wav 2>/dev/null | grep -viE "cut|master|full|tail|check" | head -1)
BGM="ep2/work/bgm.mp3"   # 공통 BGM

if [ ! -f "$SRC" ] || [ -z "$RAW" ]; then echo "[EP$N] 소스 없음 (src=$SRC raw=$RAW)"; exit 1; fi

# 목표 길이 = raw 음성 전체 길이 (잘림 0 보장)
TARGET=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$RAW")
VID=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SRC")
ADD=$(python3 -c "print(round($TARGET-$VID,3))")
echo "[EP$N] vid=$VID target=$TARGET add=$ADD"

# 연장이 거의 없으면(<=0.05) 음성만 다시 입힘
NEED_EXT=$(python3 -c "print(1 if $ADD>0.05 else 0)")

# 1) 비디오: 마지막 프레임 추출 → freeze 클립 → 원본과 concat
if [ "$NEED_EXT" = "1" ]; then
  # 원본 비디오만 재인코딩 (오디오 제거, 안정적 NAL)
  ffmpeg -y -loglevel error -i "$SRC" -an -c:v libx264 -preset medium -crf 19 \
    -pix_fmt yuv420p -r 30 "$W/v_base.mp4"
  # 마지막 프레임 PNG 추출
  ffmpeg -y -loglevel error -sseof -0.1 -i "$SRC" -vframes 1 "$W/lastframe.png"
  # 정지 클립 생성 (ADD 초)
  ffmpeg -y -loglevel error -loop 1 -t $ADD -i "$W/lastframe.png" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 -r 30 "$W/v_freeze.mp4"
  # concat (재인코딩)
  printf "file '%s'\nfile '%s'\n" "v_base.mp4" "v_freeze.mp4" > "$W/vcat.txt"
  (cd "$W" && ffmpeg -y -loglevel error -f concat -safe 0 -i vcat.txt \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 video_ext.mp4)
else
  ffmpeg -y -loglevel error -i "$SRC" -an -c:v libx264 -preset medium -crf 19 \
    -pix_fmt yuv420p -r 30 "$W/video_ext.mp4"
fi

# 2) 오디오: raw 음성 전체 + BGM(TARGET 만큼 loop) 재믹스
FADEOUT=$(python3 -c "print(round($TARGET-0.6,3))")
BGMFADE=$(python3 -c "print(round($TARGET-1.0,3))")
ffmpeg -y -loglevel error -i "$RAW" -t $TARGET -af "afade=t=out:st=$FADEOUT:d=0.5" "$W/voice_full.wav"
ffmpeg -y -loglevel error -stream_loop -1 -i "$BGM" -t $TARGET \
  -af "volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=$BGMFADE:d=1.0" "$W/bgm_full.wav"
ffmpeg -y -loglevel error -i "$W/voice_full.wav" -i "$W/bgm_full.wav" \
  -filter_complex "
    [1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[bgduck];
    [0:a][bgduck]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[aout]
  " -map "[aout]" -ar 48000 "$W/master_full.wav"

# 3) 최종 mux → 임시파일
ffmpeg -y -loglevel error -i "$W/video_ext.mp4" -i "$W/master_full.wav" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest "$W/EP${N}_tmp.mp4"

# 검증: 길이/스트림 정상이면 output 로 이동
FD=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$W/EP${N}_tmp.mp4" 2>/dev/null)
VOK=$(ffprobe -v error -select_streams v -show_entries stream=codec_type -of csv=p=0 "$W/EP${N}_tmp.mp4" 2>/dev/null)
AOK=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$W/EP${N}_tmp.mp4" 2>/dev/null)
if [ "$VOK" = "video" ] && [ "$AOK" = "audio" ] && python3 -c "exit(0 if abs($FD-$TARGET)<0.7 else 1)"; then
  mkdir -p "$DIR/output"
  mv "$W/EP${N}_tmp.mp4" "$DIR/output/EP${N}.mp4"
  echo "[EP$N] ✅ DONE  최종=$FD (목표=$TARGET, video+audio OK)"
else
  echo "[EP$N] ❌ 검증실패 fd=$FD v=$VOK a=$AOK — output 미반영"
fi
