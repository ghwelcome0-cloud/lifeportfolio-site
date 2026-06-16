#!/bin/bash
set -e
cd "$(dirname "$0")"

# Build a chalk scene clip with left->right write-on reveal.
# args: out_clip bg_png chalk_png dur write_dur x_start x_end
chalk_scene() {
  local out=$1 bg=$2 chalk=$3 dur=$4 wd=$5 xs=$6 xe=$7
  # reveal: visible width of chalk grows from xs to xe over [0,wd], then full.
  # We crop the chalk PNG to width = revealW (from left, x=0) and overlay at 0:0.
  # revealW(t) = clip( xs + (xe-xs)*t/wd , xs, xe ) ; after wd -> xe (full text shown)
  ffmpeg -y -loglevel error \
    -loop 1 -t $dur -i "$bg" \
    -loop 1 -t $dur -i "$chalk" \
    -filter_complex "
      [0:v]fps=30,scale=1080:1920,setsar=1[bgv];
      [1:v]fps=30,format=rgba[ch];
      [ch]crop=w='min(1080, ${xs} + (${xe}-${xs})*min(t/${wd},1))':h=1920:x=0:y=0[chr];
      [bgv][chr]overlay=0:0:format=auto,format=yuv420p[o]
    " -map "[o]" -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
  echo "$out done (chalk reveal)"
}

# Static scene (no chalk): gentle, just hold bg
static_scene() {
  local out=$1 bg=$2 dur=$3
  ffmpeg -y -loglevel error -loop 1 -t $dur -i "$bg" \
    -vf "fps=30,scale=1080:1920,setsar=1,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 "$out"
  echo "$out done (static)"
}

# Scene A: hook reveal (write ~1.6s). text x 244-830
chalk_scene c_a.mp4 bg_a.png ch_hook.png 4.7 1.6 230 850
# Scene B: question mark "탁" — quick reveal 0.5s, text x 487-589
chalk_scene c_b.mp4 bg_b.png ch_q.png 1.8 0.5 470 610
# Scene C: subtitle only
static_scene c_c.mp4 bg_c.png 5.4
# Scene D: core handwriting reveal ~1.8s, x 235-831
chalk_scene c_d.mp4 bg_d.png ch_core.png 6.0 1.8 225 850
# Scene E: keep core (already written) — static hold so it doesn't re-write
static_scene c_e.mp4 bg_e.png 7.0
# Scene F: subtitle only
static_scene c_f.mp4 bg_f.png 7.4
# Scene G: ending handwriting reveal ~1.8s, x 281-796
chalk_scene c_g.mp4 bg_g.png ch_end.png 7.9 1.8 270 820

echo "ALL SCENES DONE"
