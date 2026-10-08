# tools/ops — 비차단 운영 엔진 (멈춤 방지)

총괄 에이전트(대화창)가 명령 하나를 오래 기다리면 대화가 멈춘다. 그래서 **어떤 명령도 60초 이상 전경에서 기다리지 않는다**는 규칙을 코드로 강제한다.

| 파일 | 역할 | 한 줄 사용법 |
|---|---|---|
| `jobs.sh` | 긴 작업을 PM2 백그라운드 잡으로 돌리고 결과를 파일로 남긴다 | `jobs.sh run <이름> '<명령>'` → `jobs.sh status` → `jobs.sh log <이름>` |
| `watch.sh` | GenTeam 스레드 새 메시지와 CI 상태를 45초마다 파일에 기록 (PM2 `q90watch`) | `cat /home/user/work/watch.status; tail /home/user/work/watch.log` |
| `gt.sh` | GenTeam 채널을 즉시 읽는다(차단 없음) | `gt.sh <channel_id> [after_id] [limit]` |

## 규칙 (제작규칙서 §10.4 비차단 운영)
1. `sleep N`(N>10)·`tail -f`·`pm2 logs`(no `--nostream`)·`npm run dev` 전경 실행 **금지**.
2. 테스트·빌드·설치 등 30초 넘을 수 있는 것은 전부 `jobs.sh run`.
3. 기다림은 `jobs.sh wait <이름> 50`처럼 **상한이 있는 대기**만 허용. 끝나지 않으면 다음 턴에 `status`로 다시 본다.
4. 외부 응답(에이전트·CI)은 감시자 로그를 **읽는** 것으로 대체한다. 기다리지 않는다.

## 샌드박스 재구성 시 복구
```bash
mkdir -p /home/user/work /home/user/tmp
cp tools/ops/*.sh /home/user/work/ && chmod +x /home/user/work/*.sh
echo <마지막_메시지_id> > /home/user/work/cursor.txt
pm2 start /home/user/work/watch.sh --name q90watch
```
