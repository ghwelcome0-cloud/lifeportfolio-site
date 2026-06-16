#!/bin/bash
# EP1 영상 빌드 v3 — 메모리 절약: 자막은 사전합성 PNG 시퀀스, overlay 최소화
set -e
cd "$(dirname "$0")"
W=work
DUR=38.1
FPS=30

# 전략: 자막 7장 + 손글씨 4장 + brand + cta = 13장을 단일 투명 오버레이 트랙으로 미리 합성하지 않고,
# 대신 각 장면을 시간대별로 1장씩만 활성화 → ffmpeg가 동시에 처리하는 레이어 수를 줄임.
# 핵심: 입력 이미지를 -framerate 1 -loop 1 로 두되, 한 번에 하나의 overlay 체인만 유지.
# 메모리 폭증 원인은 14개 동시 디코딩 + scale. → 이미지들을 미리 1080x1920 RGBA로 통일해두고 단순 overlay.

# board에 brand를 미리 굽는다(정적)
ffmpeg -y -i $W/board.png -i $W/brand.png \
  -filter_complex "[0:v]scale=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[o]" \
  -frames:v 1 $W/base.png 2>/dev/null
echo "base.png(칠판+브랜드) 생성"

# 한 번에 하나의 오버레이만 올리는 체인. fade는 유지하되 enable로 윈도우 제한.
ffmpeg -y \
  -loop 1 -t $DUR -i $W/base.png \
  -loop 1 -t 5    -i $W/ch_hook.png \
  -loop 1 -t 2    -i $W/ch_q.png \
  -loop 1 -t 13   -i $W/ch_core.png \
  -loop 1 -t 6    -i $W/ch_end.png \
  -loop 1 -t 5    -i $W/sub_01.png \
  -loop 1 -t 2    -i $W/sub_02.png \
  -loop 1 -t 5    -i $W/sub_03.png \
  -loop 1 -t 6    -i $W/sub_04.png \
  -loop 1 -t 7    -i $W/sub_05.png \
  -loop 1 -t 7    -i $W/sub_06.png \
  -loop 1 -t 6    -i $W/sub_07.png \
  -loop 1 -t $DUR -i $W/cta.png \
  -filter_complex "
  [0:v]format=rgba[bg];
  [1:v]fade=t=in:st=0:d=0.5:alpha=1,fade=t=out:st=4.2:d=0.5:alpha=1,setpts=PTS+0.3/TB[hook];
  [2:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=1.2:d=0.4:alpha=1,setpts=PTS+5.0/TB[q];
  [3:v]fade=t=in:st=0:d=0.7:alpha=1,fade=t=out:st=12.0:d=0.5:alpha=1,setpts=PTS+12.4/TB[core];
  [4:v]fade=t=in:st=0:d=0.7:alpha=1,setpts=PTS+32.8/TB[end];
  [5:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=4.4:d=0.3:alpha=1,setpts=PTS+0.5/TB[s1];
  [6:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=1.3:d=0.3:alpha=1,setpts=PTS+5.0/TB[s2];
  [7:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=4.0:d=0.3:alpha=1,setpts=PTS+7.0/TB[s3];
  [8:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=5.6:d=0.3:alpha=1,setpts=PTS+12.4/TB[s4];
  [9:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=6.1:d=0.3:alpha=1,setpts=PTS+18.3/TB[s5];
  [10:v]fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=6.0:d=0.3:alpha=1,setpts=PTS+25.5/TB[s6];
  [11:v]fade=t=in:st=0:d=0.4:alpha=1,setpts=PTS+33.0/TB[s7];
  [12:v]fade=t=in:st=1.0:d=0.5:alpha=1[ctaL];
  [bg][hook]overlay=0:0:enable='between(t,0.3,4.8)':eof_action=pass[a1];
  [a1][q]overlay=0:0:enable='between(t,5.0,6.6)':eof_action=pass[a2];
  [a2][core]overlay=0:0:enable='between(t,12.4,24.6)':eof_action=pass[a3];
  [a3][end]overlay=0:0:enable='gte(t,32.8)':eof_action=pass[a4];
  [a4][s1]overlay=0:0:enable='between(t,0.5,4.8)':eof_action=pass[a5];
  [a5][s2]overlay=0:0:enable='between(t,5.0,6.6)':eof_action=pass[a6];
  [a6][s3]overlay=0:0:enable='between(t,7.0,11.2)':eof_action=pass[a7];
  [a7][s4]overlay=0:0:enable='between(t,12.4,18.2)':eof_action=pass[a8];
  [a8][s5]overlay=0:0:enable='between(t,18.3,24.6)':eof_action=pass[a9];
  [a9][s6]overlay=0:0:enable='between(t,25.5,31.6)':eof_action=pass[a10];
  [a10][s7]overlay=0:0:enable='gte(t,32.9)':eof_action=pass[a11];
  [a11][ctaL]overlay=0:0:enable='gte(t,1.0)':eof_action=pass,format=yuv420p[vout]
  " \
  -map "[vout]" -t $DUR -r $FPS -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  -threads 2 $W/ep1_silent.mp4

echo "=== ep1_silent.mp4 생성 ==="
ffprobe -v error -show_entries format=duration -of csv=p=0 $W/ep1_silent.mp4
