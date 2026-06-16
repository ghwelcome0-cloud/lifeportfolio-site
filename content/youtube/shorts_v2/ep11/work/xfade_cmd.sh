ffmpeg -y -loglevel error -i c_a.mp4 -i c_b.mp4 -i c_c.mp4 -i c_d.mp4 -filter_complex "
  [0:v][1:v]xfade=transition=fade:duration=0.35:offset=6.15[v1];
  [v1][2:v]xfade=transition=fade:duration=0.35:offset=12.3[v2];
  [v2][3:v]xfade=transition=fade:duration=0.35:offset=17.95,format=yuv420p[vout]
" -map "[vout]" -c:v libx264 -preset veryfast -crf 20 -r 30 video_xf.mp4
echo VIDEO_TOTAL=23.75
