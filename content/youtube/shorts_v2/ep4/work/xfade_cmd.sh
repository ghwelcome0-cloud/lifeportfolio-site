ffmpeg -y -loglevel error -i c_a.mp4 -i c_b.mp4 -i c_c.mp4 -i c_d.mp4 -i c_e.mp4 -i c_f.mp4 -i c_g.mp4 -filter_complex "
  [0:v][1:v]xfade=transition=fade:duration=0.35:offset=5.15[v1];
  [v1][2:v]xfade=transition=fade:duration=0.35:offset=13.3[v2];
  [v2][3:v]xfade=transition=fade:duration=0.35:offset=19.95[v3];
  [v3][4:v]xfade=transition=fade:duration=0.35:offset=25.6[v4];
  [v4][5:v]xfade=transition=fade:duration=0.35:offset=32.75[v5];
  [v5][6:v]xfade=transition=fade:duration=0.35:offset=39.4,format=yuv420p[vout]
" -map "[vout]" -c:v libx264 -preset veryfast -crf 20 -r 30 video_xf.mp4
echo VIDEO_TOTAL=47.4
