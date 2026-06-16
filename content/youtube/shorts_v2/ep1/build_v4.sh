#!/usr/bin/env bash
# EP1 build v4 — write-on(손글씨 좌→우 reveal) + 칠판 안쪽 글자 + BGM 더킹
# 메모리 안전: 장면별 클립 생성 후 xfade concat
set -e
cd "$(dirname "$0")/work"
echo "=== EP1 build v4 (write-on) ==="

BASE=base.png   # board + brand (칠판 안쪽 브랜드 포함)
CTA=cta.png

# ── 배경(손글씨 없는) 합성: base + 자막 + cta ──
bg(){ # $1=out  $2=sub  ($CTA 자동)
  ffmpeg -y -i "$BASE" -i "$2" -i "$CTA" \
   -filter_complex "[0:v]scale=1080:1920,setsar=1[b];[b][1:v]overlay=0:0[c];[c][2:v]overlay=0:0[o]" \
   -map "[o]" -frames:v 1 "$1" >/dev/null 2>&1
}

# ── 정적 클립(손글씨 이미 완성된 배경 또는 손글씨 없는 배경) ──
static_clip(){ # $1=png $2=dur $3=out
  ffmpeg -y -loop 1 -t "$2" -i "$1" -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
   -c:v libx264 -preset veryfast -crf 20 -r 30 -pix_fmt yuv420p "$3" >/dev/null 2>&1
}

# ── write-on 클립: bg 위에 손글씨를 좌→우 reveal ──
writeon_clip(){ # $1=bg(손글씨無) $2=hand(손글씨PNG) $3=out $4=WD(쓰는시간) $5=TOT(총길이)
  local bg=$1 hand=$2 out=$3 WD=$4 TOT=$5
  ffmpeg -y -loop 1 -t "$TOT" -i "$bg" -loop 1 -t "$TOT" -i "$hand" \
   -filter_complex "\
[0:v]fps=30,setsar=1[bg];\
[1:v]fps=30,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,1080*min(1,T/${WD})),alpha(X,Y),0)'[h];\
[bg][h]overlay=0:0:format=auto[o]" \
   -map "[o]" -t "$TOT" -c:v libx264 -preset veryfast -crf 20 -r 30 -pix_fmt yuv420p "$out" >/dev/null 2>&1
}

echo "[1/5] backgrounds..."
bg bg_a.png sub_01.png   # AI=답3초
bg bg_b.png sub_02.png   # ?
bg bg_c.png sub_03.png   # 전개(손글씨無)
bg bg_d.png sub_04.png   # 나는왜뒤처진
bg bg_e.png sub_05.png   # core 유지(자막교체)
bg bg_f.png sub_06.png   # 전환(손글씨無)
bg bg_g.png sub_07.png   # 단하나뿐인

# E 장면용: core 손글씨 이미 완성된 배경 (write-on 안함, 유지)
ffmpeg -y -i bg_e.png -i ch_core.png \
 -filter_complex "[0:v]scale=1080:1920,setsar=1[b];[b][1:v]overlay=0:0[o]" \
 -map "[o]" -frames:v 1 full_e.png >/dev/null 2>&1

echo "[2/5] write-on + static clips..."
# 장면 길이 (xfade 0.35 겹침 고려해 합 ≈ 38.1s)
# A4.7 B1.8 C5.4 D6.0 E7.0 F7.4 G7.9  (xfade 6회 *0.35=2.1 겹침 → 실효 38.1)
writeon_clip bg_a.png ch_hook.png c_a.mp4 1.3 4.7
writeon_clip bg_b.png ch_q.png   c_b.mp4 0.5 1.8
static_clip  bg_c.png 5.4 c_c.mp4
writeon_clip bg_d.png ch_core.png c_d.mp4 1.5 6.0
static_clip  full_e.png 7.0 c_e.mp4
static_clip  bg_f.png 7.4 c_f.mp4
writeon_clip bg_g.png ch_end.png c_g.mp4 1.4 7.9

echo "[3/5] xfade concat..."
XF=0.35
# offset = 누적길이 - XF
# A4.7 -> off1=4.35
# +B1.8 =6.5 -off=6.15... 누적 계산
ffmpeg -y -i c_a.mp4 -i c_b.mp4 -i c_c.mp4 -i c_d.mp4 -i c_e.mp4 -i c_f.mp4 -i c_g.mp4 \
 -filter_complex "\
[0][1]xfade=transition=fade:duration=${XF}:offset=4.35[v1];\
[v1][2]xfade=transition=fade:duration=${XF}:offset=5.80[v2];\
[v2][3]xfade=transition=fade:duration=${XF}:offset=10.85[v3];\
[v3][4]xfade=transition=fade:duration=${XF}:offset=16.50[v4];\
[v4][5]xfade=transition=fade:duration=${XF}:offset=23.15[v5];\
[v5][6]xfade=transition=fade:duration=${XF}:offset=30.20[vout]" \
 -map "[vout]" -c:v libx264 -preset veryfast -crf 20 -r 30 -pix_fmt yuv420p video_xf.mp4 >/dev/null 2>&1
echo "    video_xf.mp4:"; ffprobe -v error -show_entries format=duration -of csv=p=0 video_xf.mp4

echo "[4/5] audio master (BGM duck) — reuse master_audio.wav if exists"
if [ ! -f master_audio.wav ]; then
  ffmpeg -y -i bgm.mp3 -af "volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=36:d=2.0" -t 38.1 -ar 48000 -ac 1 bgm_soft.wav >/dev/null 2>&1
  ffmpeg -y -i ep1_voice.wav -i bgm_soft.wav \
   -filter_complex "[1:0][0:0]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[bgmduck];[0:0][bgmduck]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[aout]" \
   -map "[aout]" -ar 48000 -ac 2 master_audio.wav >/dev/null 2>&1
fi

echo "[5/5] final mux..."
mkdir -p ../output
ffmpeg -y -i video_xf.mp4 -i master_audio.wav -c:v copy -c:a aac -b:a 192k -shortest \
  "../output/EP1_효율의시대는끝났다.mp4" >/dev/null 2>&1
echo "DONE:"; ffprobe -v error -show_entries format=duration:stream=width,height -of default=nw=1 "../output/EP1_효율의시대는끝났다.mp4"
