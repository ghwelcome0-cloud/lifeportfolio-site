cd /home/user/ax-work
(python3 series/pipe/vo_prep.py 05 > /tmp/vp_05.log 2>&1; python3 series/pipe/vo_prep.py 07 > /tmp/vp_07.log 2>&1; python3 series/pipe/vo_prep.py 09 > /tmp/vp_09.log 2>&1) &
(python3 series/pipe/vo_prep.py 06 > /tmp/vp_06.log 2>&1; python3 series/pipe/vo_prep.py 08 > /tmp/vp_08.log 2>&1; python3 series/pipe/vo_prep.py 10 > /tmp/vp_10.log 2>&1) &
wait; echo VPDONE > /tmp/vp_done
