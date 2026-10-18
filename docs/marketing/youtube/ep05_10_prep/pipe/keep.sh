#!/bin/bash
# hardlink each finished longform into ~/.keep so an outside delete of build/ cannot lose it (no extra disk)
while true; do
  for f in /home/user/ax-work/yt-ep*/build/EP*_longform.mp4; do
    [ -f "$f" ] || continue
    n=$(basename $f); [ -e /home/user/.keep/$n ] && [ /home/user/.keep/$n -ef $f ] && continue
    ln -f "$f" /home/user/.keep/$n && echo "$(date +%H:%M:%S) kept $n" >> /tmp/keep.log
  done
  [ -f /tmp/chain_done ] && break
  sleep 5
done
