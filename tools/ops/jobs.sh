#!/bin/bash
# jobs.sh — FAISE 비차단 작업 엔진 (멈춤 방지)
# 원칙: 어떤 명령도 전경(foreground)에서 60초 이상 기다리지 않는다.
#   긴 작업은 모두 PM2 백그라운드 잡으로 넘기고, 결과는 파일로 읽는다.
#
# 사용법:
#   jobs.sh run <이름> <명령...>     # 백그라운드로 실행 (즉시 반환)
#   jobs.sh status [이름]           # 상태 요약 (RUNNING/DONE exit=N, 경과 시간)
#   jobs.sh log <이름> [줄수]        # 결과 로그 꼬리
#   jobs.sh wait <이름> [초]         # 최대 N초(기본 50)만 기다렸다가 상태 반환 — 절대 그 이상 안 멈춤
#   jobs.sh clean                    # 끝난 잡 정리
JOBS=/home/user/work/jobs; mkdir -p "$JOBS"
cmd=$1; shift
case "$cmd" in
  run)
    name=$1; shift
    script="$JOBS/$name.sh"; log="$JOBS/$name.log"; st="$JOBS/$name.status"
    printf '#!/bin/bash\ncd /home/user/webapp\nmkdir -p /home/user/tmp; export TMPDIR=/home/user/tmp\necho "RUNNING $(date -u +%%s)" > %q\n{ %s ; } > %q 2>&1\necho "DONE exit=$? $(date -u +%%s)" > %q\n' "$st" "$*" "$log" "$st" > "$script"
    chmod +x "$script"
    pm2 delete "job-$name" >/dev/null 2>&1
    pm2 start "$script" --name "job-$name" --no-autorestart >/dev/null 2>&1 && echo "started job-$name -> $log"
    ;;
  status)
    now=$(date -u +%s)
    for f in $JOBS/${1:-*}.status; do
      [ -f "$f" ] || continue
      n=$(basename "$f" .status); read -r s rest < "$f"
      case "$s" in
        RUNNING) echo "$n: RUNNING $((now-rest))s";;
        DONE) set -- $rest; echo "$n: DONE $1 ($((now-${2:-now}))s ago)";;
      esac
    done
    ;;
  log) tail -n "${2:-30}" "$JOBS/$1.log" 2>/dev/null | cut -c1-300 ;;
  wait)
    name=$1; max=${2:-50}; i=0
    while [ $i -lt $max ]; do
      grep -q '^DONE' "$JOBS/$name.status" 2>/dev/null && break
      sleep 2; i=$((i+2))
    done
    "$0" status "$name"
    ;;
  clean) for f in $JOBS/*.status; do grep -q '^DONE' "$f" 2>/dev/null && pm2 delete "job-$(basename "$f" .status)" >/dev/null 2>&1; done; echo cleaned ;;
  *) sed -n 2,13p "$0" ;;
esac
