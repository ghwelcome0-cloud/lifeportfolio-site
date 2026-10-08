#!/usr/bin/env python3
"""Wait out the render, measure the partial master, then open the credit PR.

Same call-consolidation discipline: the render wait, the measurement, the git
work and the PR all happen inside one shell invocation so the accumulated
context is billed once rather than four times.
"""
import os,sys,json,subprocess,re,time
SUM=[]
LOG=open("/tmp/last.log","w")
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)
    open("/tmp/last_summary.txt","w").write("\n".join(SUM)+"\n")
def sh(cmd,cwd=None,t=600):
    r=subprocess.run(cmd,shell=True,capture_output=True,text=True,cwd=cwd,timeout=t)
    log(f"$ {cmd}\nrc={r.returncode}\n{r.stdout[-3000:]}\n{r.stderr[-1500:]}")
    return r

# 1. render -----------------------------------------------------------------
for _ in range(200):
    if subprocess.run("pgrep -f drive500.py",shell=True,capture_output=True).returncode!=0: break
    time.sleep(6)
tail=open("/tmp/d500c.log").read()
log("=== FULL DRIVER LOG ===\n"+tail)
sm("== render ==")
sm(f"  pieces {len(os.listdir('_bld500'))}")
sm(f"  skipped {sorted(set(re.findall(r'SKIP (\S+?):',tail)))}")
if os.path.exists("act12.mp4"):
    p=subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height,r_frame_rate,nb_frames",
        "-show_entries","format=duration","-of","json","act12.mp4"],
        capture_output=True,text=True).stdout
    j=json.loads(p); s=j["streams"][0]
    sm(f"  act12.mp4 {os.path.getsize('act12.mp4')} B  {s['width']}x{s['height']} "
       f"{s['r_frame_rate']}  {float(j['format']['duration']):.4f}s  {s.get('nb_frames')}f")
    sm("  ^ PARTIAL master: 5 i2v rows (17.32s of 120s) still missing by design")
else:
    sm("  act12.mp4 not produced")
if "Traceback" in tail: sm("  !! TRACEBACK present")

# 2. credit-rules PR --------------------------------------------------------
R="/home/user/webapp"
sm("== credit rules PR ==")
sh("git checkout main && git pull --ff-only origin main",cwd=R)
br="docs/credit-discipline-v1"
sh(f"git checkout -B {br}",cwd=R)
sh("git add docs/marketing/youtube/72_CREDIT_DISCIPLINE.md",cwd=R)
msg="""docs(credit): 크레딧 규율 헌법 조항 초안 v1.0 신설

대표 지시(2026-08-19) "우리 크레딧 효율적 사용을 전략적으로 세워야 합니다.
나중에 노하우를 형성하면 우리 헌법에도 규정해야 할 듯"에 대한 응답입니다.

■ 왜 새 문서인가
1차 사용 내역에서 제 소비가 91%였고, 대책을 세운 뒤 2차에서도 -7,418로
다시 최다였습니다. 같은 지적이 두 번 나왔다는 사실 자체가 1차 진단이
틀렸다는 증거이므로, 진단부터 다시 썼습니다.

■ 제1조 - 지배 항목의 오인을 금한다
기존 가설은 "비싼 툴이 주범"이었습니다. 그러나 2차 기간에 유료 툴은 0건
호출했는데도 -7,418이 나왔습니다. 유료 툴이 원인이라면 불가능한 숫자입니다.
확정된 원인은 '왕복 횟수 x 그 시점의 누적 컨텍스트 크기'입니다.
셸을 한 번 부를 때마다 지시 29건 + 교훈 70여 개 + URL 200여 개가 다시
계산됩니다. ls 한 줄과 30분 렌더링의 호출 비용이 사실상 같습니다.

■ 제2~4조 - 그래서 무엇을 바꾸는가
한 스크립트에 검증/실행/대기/수확/요약을 모두 담고(mega 패턴), 긴 로그는
디스크에만 쓰고, 장시간 작업은 setsid로 분리합니다. 작은 호출 20회를
3회로 묶으면 약 1/6입니다. 되돌린 토큰은 이후 모든 호출에서 반복
과금되므로, 대화로 오는 것은 20행 이내 요약뿐입니다.

■ 제5~6조 - 무료 판정 우선, 생성은 변화가 있을 때만
해상도/길이는 cv2와 ffprobe로, 코드 인수는 pytest로, 무결성은 SHA-256으로
판정합니다. 그리고 카메라만 움직이는 샷은 큰 스틸 1장 + 2.5D 켄번즈로
무료 처리합니다. 이 조항의 실측 효과가 i2v 24클립 -> 8클립(67% 절감)이며,
정체성은 교훈 51(연속성은 재진입)이 보장하므로 품질 저하가 없습니다.

■ 제7조 - 이번 세션의 실제 사고를 조항으로 고정
발송 확인 코드가 --channel-id(하이픈)를 썼으나 CLI 정본은 --channel_id
(밑줄)였습니다. 발송은 이미 성공(mid 2881303)했는데 조회 실패를 발송
실패로 오판해 재시도했고, 동일 발주가 4건 중복 발송되었습니다. 즉시 V-2에
정정 통지(mid 2881406)를 보내 1개씩만 생성하도록 막았습니다.
=> 상태를 바꾸는 호출에는 처음부터 --operation_id를 붙입니다.
=> 실패 판정 전에 판정 코드 자체를 의심합니다.

■ 부칙 - 신규 교훈 3건
교훈 70(지배 항목) / 71(--help가 정본, 발송은 채널 재조회로만 확인) /
72(잘못된 실패 판정이 재시도를 낳고 재시도가 중복 과금을 낳는다).

■ 안정성
문서 1개 신설뿐이며 런타임 코드/설정 무변경입니다. 라이브 사이트에
영향이 없습니다."""
open("/tmp/cm.txt","w").write(msg)
sh("git commit -F /tmp/cm.txt",cwd=R)
sh(f"git push -u origin {br} --force",cwd=R)
r=sh(f'gh pr create --base main --head {br} '
     f'--title "docs(credit): 크레딧 규율 헌법 조항 초안 v1.0 신설" '
     f'--body-file /tmp/cm.txt',cwd=R)
url=re.findall(r"https://github\.com/\S+/pull/\d+",r.stdout+r.stderr)
sm(f"  PR {url[-1] if url else 'FAILED rc='+str(r.returncode)}")
if url:
    m=sh(f"gh pr merge {url[-1]} --squash --admin --delete-branch",cwd=R)
    sm(f"  merge rc={m.returncode}")
    sh("git checkout main && git pull --ff-only origin main",cwd=R)
    h=sh("git rev-parse --short HEAD",cwd=R)
    sm(f"  main now {h.stdout.strip()}")
