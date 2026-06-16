#!/bin/bash
# 범용 EP 빌더: ./build_ep.sh <ep>
# build_meta.json 기반으로 배경/씬/xfade/오디오/mux 자동 처리
set +e
EP=$1
ROOT="$(cd "$(dirname "$0")" && pwd)"
source "$ROOT/build_lib.sh"
cd "$ROOT/ep$EP/work" || exit 1

echo "===== EP$EP BUILD START ====="
mk_base

# build_meta.json 파싱 (id, dur, type, twoline)
META=build_meta.json
SCENES=$(python3 -c "import json;d=json.load(open('$META'));print(' '.join(s['id'] for s in d['scenes']))")

# --- 각 씬 배경 생성 ---
for sid in $SCENES; do
  typ=$(python3 -c "import json;d=json.load(open('$META'));print([s['type'] for s in d['scenes'] if s['id']=='$sid'][0])")
  if [ "$typ" = "chalk" ]; then
    mk_full full_$sid.png ch_$sid.png sub_$sid.png
    mk_bg   bg_$sid.png   sub_$sid.png
  else
    mk_bg   st_$sid.png   sub_$sid.png
  fi
done
echo "backgrounds done"

# --- 손글씨 분할/측정 ---
declare -A SPLIT_INFO
for sid in $SCENES; do
  info=$(python3 -c "import json;d=json.load(open('$META'));print([s for s in d['scenes'] if s['id']=='$sid'][0].get('type'),[s for s in d['scenes'] if s['id']=='$sid'][0].get('twoline',False))")
  typ=$(echo $info | awk '{print $1}')
  tl=$(echo $info | awk '{print $2}')
  if [ "$typ" = "chalk" ]; then
    if [ "$tl" = "True" ]; then
      split2line ch_$sid > xr_$sid.txt
    else
      xrange ch_$sid > xr_$sid.txt
    fi
  fi
done
echo "split/measure done"

# --- 씬 클립 빌드 ---
for sid in $SCENES; do
  dur=$(python3 -c "import json;d=json.load(open('$META'));print([s['dur'] for s in d['scenes'] if s['id']=='$sid'][0])")
  typ=$(python3 -c "import json;d=json.load(open('$META'));print([s['type'] for s in d['scenes'] if s['id']=='$sid'][0])")
  if [ "$typ" = "sub" ]; then
    staticclip st_$sid.png $dur c_$sid.mp4
    echo "  scene $sid (sub) done"
    continue
  fi
  tl=$(python3 -c "import json;d=json.load(open('$META'));print([s.get('twoline',False) for s in d['scenes'] if s['id']=='$sid'][0])")
  # x-range 읽기
  xr=$(cat xr_$sid.txt)
  xs=$(echo $xr | sed -E 's/.*x=([0-9]+)-([0-9]+).*/\1/')
  xe=$(echo $xr | sed -E 's/.*x=([0-9]+)-([0-9]+).*/\2/')
  # reveal 길이: 글자 폭에 비례, 최소 0.9 최대 2.0
  if [ "$tl" = "True" ]; then
    REV=2.0; wd=0.9
    twoline rev_$sid.mp4 bg_$sid.png ch_${sid}_t.png ch_${sid}_b.png $REV $wd $wd $xs $xe
  else
    REV=1.4; wd=1.1
    # 한 글자 큰 강조(왜?/숫자)는 더 짧게
    oneline rev_$sid.mp4 bg_$sid.png ch_$sid.png $REV $wd $xs $xe
  fi
  catseg $sid $dur $REV
  echo "  scene $sid (chalk tl=$tl rev=$REV x=$xs-$xe) done"
done
echo "all scenes built"

# --- xfade concat ---
python3 - "$META" <<'PY' > xfade_cmd.sh
import json,sys
d=json.load(open(sys.argv[1]))
ids=[s['id'] for s in d['scenes']]
durs={s['id']:s['dur'] for s in d['scenes']}
XF=0.35
inputs=' '.join(f"-i c_{i}.mp4" for i in ids)
fc=[]
prev=f"[0:v]"
cum=durs[ids[0]]
label="0:v"
chain=""
cur="[0:v]"
vlab="0:v"
parts=[]
cum=durs[ids[0]]
last="[0:v]"
expr=""
# build sequential xfade
labels=[f"[{n}:v]" for n in range(len(ids))]
out_prev=labels[0]
cum=durs[ids[0]]
lines=[]
for n in range(1,len(ids)):
    off=round(cum-XF,3)
    tag=f"[v{n}]" if n<len(ids)-1 else "[vout]"
    extra="" if n<len(ids)-1 else ",format=yuv420p"
    lines.append(f"{out_prev}{labels[n]}xfade=transition=fade:duration={XF}:offset={off}{extra}{tag}")
    out_prev=tag
    cum=cum-XF+durs[ids[n]]
fc=";\n  ".join(lines)
total=round(cum,3)
print(f'ffmpeg -y -loglevel error {inputs} -filter_complex "\n  {fc}\n" -map "[vout]" -c:v libx264 -preset veryfast -crf 20 -r 30 video_xf.mp4')
print(f'echo VIDEO_TOTAL={total}')
PY
bash xfade_cmd.sh
VDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 video_xf.mp4)
echo "video_xf done VDUR=$VDUR"

# --- 마스터 오디오 + mux ---
master_audio ep${EP}_voice.wav bgm.mp3 $VDUR master_audio.wav
final_mux video_xf.mp4 master_audio.wav ../output/EP$EP.mp4
echo "===== EP$EP DONE ====="
ffprobe -v error -show_entries format=duration -of csv=p=0 ../output/EP$EP.mp4
