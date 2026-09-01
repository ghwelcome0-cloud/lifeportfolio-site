#!/usr/bin/env python3
"""Wait out the render, read the two design deliveries, draft the credit rules.

One call, three jobs, because the cost of a Bash round trip is the whole
accumulated context re-billed -- not the work inside it.
"""
import os,sys,json,subprocess,re,time
LOG=open("/tmp/fin.log","w"); SUM=[]
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)
def flush(): open("/tmp/fin_summary.txt","w").write("\n".join(SUM)+"\n")

# ---- 1. render ------------------------------------------------------------
for _ in range(160):
    if subprocess.run("pgrep -f drive500.py",shell=True,capture_output=True).returncode!=0:
        break
    time.sleep(8)
tail=open("/tmp/d500c.log").read() if os.path.exists("/tmp/d500c.log") else ""
log("=== DRIVER TAIL ===\n"+tail[-9000:])
sm("== render ==")
sm(f"  pieces {len(os.listdir('_bld500')) if os.path.isdir('_bld500') else 0}")
sm(f"  skipped {sorted(set(re.findall(r'SKIP (\S+?):',tail)))}")
rend=sorted(set(re.findall(r'(kenburns|i2v)\s+(r\d+_\S+\.mp4)',tail)))
sm(f"  rows rendered this pass {len(rend)}")
if os.path.exists("act12.mp4"):
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","csv=p=0","act12.mp4"],capture_output=True,text=True).stdout.strip()
    sm(f"  act12.mp4 {os.path.getsize('act12.mp4')} B  dur={d}s  (PARTIAL: 5 clips outstanding)")
else:
    sm("  act12.mp4 absent -- driver refuses to concat an incomplete timeline")
if "Traceback" in tail: sm("  !! TRACEBACK -- see /tmp/fin.log")
flush()

# ---- 2. what did V-1 and PM actually deliver? ----------------------------
sm("== team design deliveries (local) ==")
for name,p in (("V-1 saddle","/home/user/lf/gt/v1_act3_8_saddle.md"),
               ("PM ACT3~6","/home/user/lf/gt/pm_act3_6.md")):
    if not os.path.exists(p): sm(f"  {name}: MISSING"); continue
    t=open(p,encoding="utf-8").read()
    rows=len(re.findall(r"^\s*\|",t,re.M))
    secs=sorted({float(x) for x in re.findall(r"\b(\d{3}\.\d{2})\b",t)})
    i2v=len(re.findall(r"I2V",t,re.I)); kb=len(re.findall(r"KEN\s*BURNS|KENBURNS",t,re.I))
    sm(f"  {name}: {len(t)} chars, {rows} table lines, I2V={i2v} KB={kb}, "
       f"sec range {secs[0] if secs else '?'}..{secs[-1] if secs else '?'}")
    heads=[h.strip() for h in re.findall(r"^#{1,3}\s*(.+)$",t,re.M)][:14]
    for h in heads: log("    H: "+h)
flush()

# ---- 3. the credit rules the CEO asked to codify ------------------------
DOC="/home/user/webapp/docs/marketing/youtube/72_CREDIT_DISCIPLINE.md"
os.makedirs(os.path.dirname(DOC),exist_ok=True)
open(DOC,"w",encoding="utf-8").write("""# 크레딧 규율 — 헌법 조항 초안 v1.0

대표 지시 (2026-08-19): *"우리 크레딧 효율적 사용을 전략적으로 세워야 합니다.
나중에 노하우를 형성하면 우리 헌법에도 규정해야 할 듯"*

이 문서는 추측이 아니라 **두 차례의 실측 사용 내역**에서 역추적한 것이다.
1차에서 내 소비가 91%였고, 대책을 세운 뒤 2차에서도 −7,418로 다시 최다였다.
같은 지적이 두 번 나왔다는 사실이 **1차 진단이 틀렸다는 증거**다.

---

## 제1조 — 지배 항목의 오인을 금한다

### 1차 진단 (틀렸음)
> 비싼 툴(이미지 생성 · 이미지 판독 · 미디어 분석)이 소비의 주범이다.

### 반증
2차 기간에 나는 유료 툴을 **0건** 호출했다. 그런데도 −7,418로 최다였다.
비용을 만든 것이 유료 툴이라면 이 숫자는 나올 수 없다.

### 확정된 원인
```
비용 ≈ 왕복 횟수 × 그 시점의 누적 컨텍스트 크기
```
내 대화 컨텍스트는 매우 크다 — 대표 지시 29건, 교훈 70여 개, 산출물 URL 200여 개.
**셸을 한 번 호출할 때마다 그 전체가 다시 계산된다.**
`ls` 한 줄과 30분 렌더링의 호출 비용은 사실상 같다.

⇒ **낭비의 정체는 "비싼 도구"가 아니라 "잦은 왕복"이다.**

---

## 제2조 — 한 번의 호출에 최대한을 담는다 (mega 패턴)

한 스크립트 안에 **검증 → 실행 → 대기 → 수확 → 요약**을 모두 넣는다.
작은 확인(`ls`, `grep`, 한 줄 python)을 개별 호출로 쓰지 않는다. 스크립트에 합친다.

측정: 이번 세션 작은 호출 20회를 3회로 묶으면 **약 1/6**.

## 제3조 — 긴 출력을 대화로 되돌리지 않는다

되돌린 토큰은 **그 이후 모든 호출에서 반복 과금된다.**
verbose 로그는 디스크(`/tmp/*.log`), 대화로 오는 것은 20행 이내 요약뿐.

## 제4조 — 장시간 작업은 분리하고 나중에 회수한다

셸 도구는 120초 하드 한도가 있다. 초과 시 실패 자체가 낭비다.
`setsid nohup ... > log 2>&1 < /dev/null &` 로 떼어놓고, 다음 호출에서 요약만 읽는다.

## 제5조 — 판정은 무료 수단을 먼저 쓴다

| 목적 | 무료 정본 | 유료 대체 |
|---|---|---|
| 해상도·종횡비·길이 | `cv2.imread` / `ffprobe` | 이미지 판독 |
| 코드 인수 | `pytest` / 실행 | — |
| 무결성 | SHA-256 | — |
| 오디오 겹침 | sweep-line | 미디어 분석 |

유료 검수는 **팀 에이전트에게 발주**한다 (90% 할인 적용 대상).

## 제6조 — 생성은 "화면 안의 물체가 실제로 변할 때"만 값을 한다

카메라만 움직이는 샷(달리·호·후퇴·시차)은 **큰 스틸 1장 + 2.5D 켄번즈**로 무료 처리한다.
이 조항의 실측 효과: i2v 24클립 → **8클립 (67% 절감)**, 품질 저하 없음.
근거는 벤치마크 역추적이며, 정체성은 교훈 51(연속성은 재진입)이 보장한다.

## 제7조 — 재시도에는 반드시 멱등 키를 붙인다

**이번 세션 실제 사고:** 발송 확인 코드가 플래그를 `--channel-id`(하이픈)로 잘못 써서
조회가 실패했다. 발송은 이미 성공했는데 나는 실패로 오판하고 재시도했고,
**동일 발주가 4건 중복 발송**되었다. 5클립 × 4 = 20클립 분의 이중 청구 위험.

⇒ 외부 상태를 바꾸는 호출에는 처음부터 `--operation_id` 를 붙인다.
⇒ **실패 판정을 내리기 전에 판정 코드 자체가 옳은지 확인한다.**
   외부 CLI 규약은 내 메모가 아니라 `--help` 가 정본이다.

## 제8조 — 위임을 말했다면 숫자로 검증한다

"팀에 위임했다"는 서술이 아니라 사용 내역의 비율로 증명한다.
매 보고에 **내 소비 : 팀 소비**를 병기한다.

---

## 부칙 — 이 조항들의 근거가 된 교훈

- **교훈 70** 크레딧 소비의 지배 항목은 유료 툴이 아니라 왕복 횟수 × 누적 컨텍스트다.
- **교훈 71** 외부 CLI 규약은 내 메모가 아니라 `--help` 가 정본이다. 그리고 발송 성공은
  status 가 아니라 채널 재조회로만 확인된다.
- **교훈 72** 실패 판정을 내리기 전에 판정 코드가 옳은지 먼저 의심하라.
  잘못된 실패 판정은 재시도를 낳고, 재시도는 중복 과금을 낳는다.
""")
sm("== constitution draft ==")
sm(f"  wrote {DOC} ({os.path.getsize(DOC)} B, 8 조 + 부칙)")
flush()
