ffmpeg -y -loglevel error -i c_a.mp4 -i c_b.mp4 -i c_c.mp4 -i c_d.mp4 -i c_e.mp4 -i c_f.mp4 -filter_complex "
  [0:v][1:v]xfade=transition=fade:duration=0.35:offset=6.65[v1];
  [v1][2:v]xfade=transition=fade:duration=0.35:offset=15.3[v2];
  [v2][3:v]xfade=transition=fade:duration=0.35:offset=23.95[v3];
  [v3][4:v]xfade=transition=fade:duration=0.35:offset=32.6[v4];
  [v4][5:v]xfade=transition=fade:duration=0.35:offset=41.25,format=yuv420p[vout]
" -map "[vout]" -c:v libx264 -preset veryfast -crf 20 -r 30 video_xf.mp4
echo VIDEO_TOTAL=49.55
