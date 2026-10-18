#!/bin/bash
# wait for the chain2 run of EP08 (already rendering), finalize; then EP09, EP10 render+finalize, one at a time
C2=$(cat /tmp/c2pid); kill $C2 2>/dev/null   # stop chain2 loop; its current run_ep.sh 08 keeps running
until grep -q "QADONE\|FAIL" /tmp/run08.log 2>/dev/null; do sleep 30; done
bash /home/user/ax-work/series/pipe/finish_ep.sh 08
for e in 09 10; do
  bash /home/user/ax-work/series/pipe/run_ep.sh $e > /tmp/run$e.log 2>&1
  bash /home/user/ax-work/series/pipe/finish_ep.sh $e
done
echo ALLEPDONE > /tmp/all_done
