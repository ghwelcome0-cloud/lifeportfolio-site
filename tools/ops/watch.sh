#!/bin/bash
# Background watcher: appends new TL-thread messages and CI status to a log. Never blocks the main shell.
CH=ch_4a2fbfcc47273beedd780750b6532efe
CUR_FILE=/home/user/work/cursor.txt
LOG=/home/user/work/watch.log
[ -f "$CUR_FILE" ] || echo 5689953 > "$CUR_FILE"
while true; do
  AFTER=$(cat "$CUR_FILE")
  OUT=$(/home/user/work/gt.sh "$CH" "$AFTER" 50 2>&1)
  N=$(echo "$OUT" | head -1 | awk '{print $2}')
  if [ "${N:-0}" != "0" ] && [ -n "$N" ]; then
    echo "##### $(date -u +%H:%M:%S) NEW MESSAGES ($N)" >> "$LOG"
    echo "$OUT" >> "$LOG"
    LAST=$(echo "$OUT" | grep -o '^=== id [0-9]*' | tail -1 | awk '{print $3}')
    [ -n "$LAST" ] && echo "$LAST" > "$CUR_FILE"
  fi
  CI=$(cd /home/user/webapp && timeout 40 gh run view 37736968429 --json status,conclusion -q '"\(.status) \(.conclusion)"' 2>/dev/null)
  echo "$(date -u +%H:%M:%S) ci=$CI cursor=$(cat $CUR_FILE)" > /home/user/work/watch.status
  sleep 45
done
