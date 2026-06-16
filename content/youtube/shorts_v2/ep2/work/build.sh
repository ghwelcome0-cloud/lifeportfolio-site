#!/bin/bash
# EP2 빌드 — EP1 검증 파이프라인 재사용
set -e
cd "$(dirname "$0")"
BOARD=board.png

# ---------- 공통: 칠판+브랜드+CTA 베이스 합성 ----------
# base.png = 칠판 + 브랜드(상단) + CTA(하단)
ffmpeg -y -loglevel error -i $BOARD -i brand.png -i cta.png \
  -filter_complex "[0][1]overlay=0:0[a];[a][2]overlay=0:0" base.png

# 자막 포함 정적 배경 만들기 헬퍼: base + 손글씨(완성) + 자막
mkstatic() { # out chalk(or none) sub(or none)
  local out=$1 chalk=$2 sub=$3
  local inputs=(-i base.png); local fc="[0:v]null[b]"; local idx=1
  if [ "$chalk" != "none" ]; then inputs+=(-i $chalk); fc="$fc;[b][${idx}:v]overlay=0:0[b]"; idx=$((idx+1)); fi
  if [ "$sub" != "none" ]; then inputs+=(-i $sub); fc="$fc;[b][${idx}:v]overlay=0:0[b]"; idx=$((idx+1)); fi
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "${fc}" -map "[b]" "$out"
}

# ---------- write-on 빌더 (2줄) ----------
twoline() {
  local out=$1 bg=$2 top=$3 bot=$4 dur=$5 wd1=$6 wd2=$7 xs=$8 xe=$9
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" \
    -loop 1 -t $dur -i "$top" \
    -loop 1 -t $dur -i "$bot" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*min(T/${wd1},1)), alpha(X,Y), 0)'[t1];
      [2:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*max(0,min((T-${wd1})/${wd2},1))), alpha(X,Y), 0)'[t2];
      [bgv][t1]overlay=0:0[s1];
      [s1][t2]overlay=0:0,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
}

# ---------- write-on 빌더 (1줄) ----------
oneline() {
  local out=$1 bg=$2 layer=$3 dur=$4 wd=$5 xs=$6 xe=$7
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" \
    -loop 1 -t $dur -i "$layer" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X, ${xs}+(${xe}-${xs})*min(T/${wd},1)), alpha(X,Y), 0)'[t1];
      [bgv][t1]overlay=0:0,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
}

# ---------- 정적 자막 클립 (write-on 불필요) ----------
staticclip() { # out static_png dur
  ffmpeg -y -loglevel error -loop 1 -t $3 -i "$1" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 "$2_clip.mp4"
}

echo "build.sh ready (functions defined)"
