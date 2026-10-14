#!/bin/bash
# usage: fetch.sh DIR ID1 ID2 ... -> DIR/A01.png ...
D=$1; shift; i=1
for id in "$@"; do n=$(printf "A%02d" $i); (u=$(gsk download https://www.genspark.ai/api/files/s/$id 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['download_url'])"); curl -sL "$u" -o $D/$n.png) & i=$((i+1)); done; wait
