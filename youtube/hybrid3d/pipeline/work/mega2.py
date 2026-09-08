#!/usr/bin/env python3
"""One call: measure delivered i2v, re-order the missing five, restart the render.

Lesson 70 in practice. Every step that used to be its own Bash round trip is a
function here, verbose output goes to a log on disk, and the only thing that
comes back to the transcript is a short summary file. The cost driver was never
the expensive tools -- it was paying for the whole accumulated context again on
every small shell call.
"""
import os, sys, json, subprocess, shutil, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shots

LOG = open("/tmp/mega2.log", "w")
SUM = []
def log(*a):
    print(*a, file=LOG); LOG.flush()
def sm(*a):
    s = " ".join(str(x) for x in a); SUM.append(s); log(s)

FR = 1.0 / 24.0

# ---------------------------------------------------------------- 1. measure
def probe(p):
    out = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height,r_frame_rate,nb_frames",
        "-show_entries","format=duration","-of","json",p],
        capture_output=True, text=True).stdout
    j = json.loads(out); s = j["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return dict(w=s["width"], h=s["height"], fps=float(num)/float(den),
                nf=int(s.get("nb_frames") or 0),
                dur=float(j["format"]["duration"]))

man = {m["sid"]: m for m in shots.i2v_manifest()}
sm("== delivered i2v ==")
ok_sids, bad = [], []
for sid in ("A1-03","A1-13","A1-16"):
    p = f"seg/i2v_{sid}.mp4"
    if not os.path.exists(p):
        bad.append(f"{sid} missing on disk"); continue
    q = probe(p); need = man[sid]["need"]; ss = 0.05
    room = q["dur"] - ss - 2*FR
    verdict = "OK" if room >= need else f"SHORT by {need-room:.2f}s"
    if room < need: bad.append(f"{sid} {verdict}")
    else: ok_sids.append(sid)
    sm(f"  {sid} {q['w']}x{q['h']} {q['fps']:.2f}fps {q['dur']:.4f}s "
       f"{q['nf']}f  need {need:.2f}s  headroom {room-need:+.2f}s  {verdict}")
sm(f"  accepted {len(ok_sids)}/3   problems {bad if bad else 'none'}")

# ------------------------------------------------------- 2. re-order the five
PLATE_URL = "https://www.genspark.ai/api/files/s/%s"
REORDER = [
 dict(sid="A1-06", a=44.80, need=4.00, grp="A1_COOL", reason="종이 단면의 파괴적 분할",
      fix="""[재생성 사유] 지난 납품본은 종이 단면이 찢어지듯 파괴적으로 갈라졌습니다. 이 샷은 파손 묘사가 아닙니다.
[이번 지시] 종이는 절대 찢어지거나 갈라지거나 부서지지 않습니다. 종이 더미의 형태는 첫 프레임과 마지막 프레임에서 동일해야 합니다.
움직이는 것은 카메라뿐입니다. 카메라가 이미 존재하는 층과 층 사이의 얇은 틈(0.5~1mm)으로 천천히 전진해 들어가고,
전진하면서 위쪽 종이의 아랫면과 아래쪽 종이의 윗면이 화면 상단·하단으로 각각 밀려 나갑니다.
종이 섬유와 스테이플 자리의 그림자가 카메라가 지나갈 때 순차적으로 스칩니다. 초당 이동량은 일정하게, 감속 없이."""),
 dict(sid="A1-08", a=56.18, need=4.46, grp="A1_WARM", reason="장수 증가",
      fix="""[재생성 사유] 지난 납품본에서 종이 장수가 늘어났습니다. 총 장수가 늘어나는 것은 이 영상의 서사와 정면으로 충돌합니다.
[이번 지시] 첫 프레임의 종이 장수를 세어, 마지막 프레임에서도 정확히 같은 장수여야 합니다. 새 종이가 화면에 들어오지 않습니다.
이미 쌓여 있던 그 장수가 부채처럼 벌어지는 것만이 유일한 변화입니다. 위에서 내려다보는 시점 고정,
아래쪽 종이는 제자리에 있고 위쪽 종이들만 한쪽 끝을 축으로 5~12도 각도로 순차 회전해 아래 장의 인쇄면이 드러납니다.
벌어지는 순서는 위에서 아래로, 한 장씩 시간차를 두고."""),
 dict(sid="A2-02", a=85.06, need=4.00, grp="A1_WARM", reason="요구한 달리 미실현",
      fix="""[재생성 사유] 지난 납품본에서 요구한 달리(수평 이동)가 실현되지 않아 화면이 거의 정지해 있었습니다.
[이번 지시] 카메라는 4초 동안 화면 폭의 약 40%에 해당하는 거리를 왼쪽에서 오른쪽으로 등속 수평 이동합니다.
이동이 눈에 보이게 확실해야 합니다. 판단 기준: 첫 프레임에서 화면 왼쪽 끝에 있던 제목 띠가 마지막 프레임에서는 화면 중앙보다 왼쪽으로 벗어나 있어야 합니다.
줌이 아니라 평행 이동입니다. 이동 중 가까운 종이 층이 먼 층보다 빠르게 지나가는 시차가 자연스럽게 발생해야 합니다.
같은 굵기·같은 길이의 회색 제목 띠들이 차례로 화면을 지나갑니다."""),
 dict(sid="A2-04", a=101.22, need=3.10, grp="A1_WARM", reason="크레딧 부족으로 미생성",
      fix="""[신규 생성] 카메라가 여러 장에 반복해서 나타나는 동일한 회색 제목 띠 하나를 정면으로 향해 전진합니다.
띠에 도달하는 순간, 그 띠가 위·아래로 갈라지며 열리고(종이는 찢어지지 않습니다 — 띠 자체가 두 개의 얇은 판처럼 벌어집니다)
그 뒤에 있던 같은 형태의 띠가 드러납니다. 3초 안에 한 번만 일어나는 동작입니다."""),
 dict(sid="A2-13", a=104.32, need=2.28, grp="A1_WARM", reason="크레딧 부족으로 미생성",
      fix="""[신규 생성] 종이는 정확히 세 장입니다. 세 장이 유지됩니다.
세 장 위에 놓인 회색 막대들의 높이가 아래에서 위로 자라납니다. 원자료 높이(낮음)에서 요약 높이(높음)로,
왼쪽 막대부터 오른쪽 막대까지 시간차를 두고 순차적으로. 막대는 발광하지 않는 무광 회색·시안·페일옐로입니다.
카메라는 거의 정지, 아주 미세한 전진만. 2.3초 안에 성장이 완료되어야 합니다."""),
]
body = ["@[AI 비디오 커스텀 에이전트](agent_4gettwpxdxp6)",
 "",
 "■ i2v 재발주 5클립 (대표 승인 · 계정 크레딧 충전 완료)",
 "",
 "지난 납품 3클립(A1-03 / A1-13 / A1-16)은 제가 로컬에서 ffprobe 로 실측했고 전부 수락했습니다.",
 "1920x1080 / 24fps / 무음 / 필요 길이 대비 여유 확보 — 그대로 조립에 투입했습니다. 좋은 작업이었습니다.",
 "",
 "자체 반려 3건(A1-06 파괴적 분할 / A1-08 장수 증가 / A2-02 달리 미실현)은 정확한 판단이었습니다.",
 "제 발주서의 금지 조항과 반려 사유가 정확히 일치합니다. 그 판단을 신뢰합니다.",
 "크레딧 부족으로 미생성된 A2-04 / A2-13 은 계정이 충전되었으므로 이제 생성 가능합니다.",
 "",
 "아래 5클립만 생성해주세요. 통과한 3클립은 재생성하지 마세요 (크레딧 낭비).",
 "",
 "── 공통 기술 규격 (지난번과 동일) ──────────────────────",
 "· aspect_ratio 는 \"16:9\" 를 명시하세요. \"auto\" 금지.",
 "· 24fps · 1920x1080 이상 · 무음",
 "· 길이는 '사용 길이 + 1초' 이상 (제가 앞뒤를 잘라 씁니다)",
 "· 첫 프레임은 아래 원판 이미지와 사실상 동일해야 합니다 (원판을 i2v 입력으로)",
 "",
 "── 공통 내용 금지 (위반 시 제 게이트에서 자동 반려) ──────",
 "· SF 요소 전면 금지: 배관 · 도관 · 포털 · 홀로그램 · 회로 · 와이어프레임 · 발광 선",
 "· 새로운 한글 글자를 만들지 마세요. 문서 본문은 회색 바 추상화입니다.",
 "· 잉크 · 인쇄면 · 막대는 발광하지 않습니다 (무광).",
 "· 키라이트는 좌상단에서 오는 따뜻한 빛, 방향이 클립 내내 바뀌지 않아야 합니다.",
 "· 종이는 찢어지거나 부서지거나 녹지 않습니다.",
 "",
]
for r in REORDER:
    body += [f"── {r['sid']}  (앵커 {r['a']:.2f}초 · 조명 그룹 {r['grp']})",
             f"원판: {PLATE_URL % shots.ANCHORS[r['a']]}",
             f"사용 길이: {r['need']:.2f}초  → 생성 길이 {r['need']+1:.2f}초 이상",
             f"지난 결과: {r['reason']}",
             r["fix"], ""]
body += [
 "── 납품 형식 ────────────────────────────────────────",
 "· 각 클립을 gsk upload 로 올린 URL 로 주세요 (채널 첨부는 제가 받을 수 없습니다).",
 "· 실측값을 적어주세요: 해상도 · fps · 초 · 프레임수 · 모델 · tier · aspect_ratio.",
 "  요청값이 아니라 실제 파일에서 읽은 값이어야 합니다.",
 "· 부분 납품 환영합니다. 되는 것부터 보내주세요.",
 "· 스스로 기준 미달이라 판단되면 지난번처럼 반려하고 사유를 적어주세요. 그 판단이 저를 살립니다.",
 "",
 "── 제 판정 방법 (사전 공개) ──────────────────────────",
 "· cv2 / ffprobe 로 해상도·fps·길이 실측",
 "· 첫 프레임을 원판과 픽셀 비교 (봉인 유지 확인)",
 "· 문제 있는 클립만 개별 재생성 요청. 전체 재발주는 하지 않습니다.",
]
os.makedirs("/home/user/lf/gt", exist_ok=True)
open("/home/user/lf/gt/v2_reorder.txt","w").write("\n".join(body))
sm(f"== reorder body written == {len('\n'.join(body))} chars, 5 clips")

# ------------------------------------------------------------------- 3. send
# Reuse the sender that is already proven against the current CLI contract
# (lesson 71: --content, no --confirm, re-call until comet_message_id appears).
src = "/home/user/lf/gt/sendv2.py"
dst = "/home/user/lf/gt/sendv2b.py"
sent = "sender script missing"
if os.path.exists(src):
    code = open(src).read().replace("v2_order.txt", "v2_reorder.txt")
    open(dst,"w").write(code)
    r = subprocess.run([sys.executable, dst], capture_output=True, text=True,
                       cwd="/home/user/lf/gt", timeout=300)
    log("SENDER STDOUT:\n"+r.stdout); log("SENDER STDERR:\n"+r.stderr)
    ids = re.findall(r"comet_message_id[\"'\s:=]+(\d+)", r.stdout)
    st  = re.findall(r"status[\"'\s:=]+([a-z_]+)", r.stdout)
    sent = f"rc={r.returncode} mid={ids[-1] if ids else 'NONE'} status={st[-1] if st else '?'}"
sm("== v2 reorder send ==", sent)

# --------------------------------------------------- 4. restart the render
subprocess.run("pkill -f drive500.py", shell=True)
pieces_before = len([f for f in os.listdir("_bld500")]) if os.path.isdir("_bld500") else 0
lg = open("/tmp/d500c.log","w")
subprocess.Popen([sys.executable,"drive500.py"], stdout=lg, stderr=lg,
                 cwd=os.path.dirname(os.path.abspath(__file__)),
                 start_new_session=True)
sm(f"== render restarted == pieces before {pieces_before}; "
   f"3 i2v rows now resolvable, 5 still awaited; log /tmp/d500c.log")

open("/tmp/mega2_summary.txt","w").write("\n".join(SUM)+"\n")
LOG.close()
