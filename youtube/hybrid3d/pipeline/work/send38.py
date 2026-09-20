# -*- coding: utf-8 -*-
"""Dispatch the ACT3~8 orders, then harvest whatever is already waiting.

One process, four jobs, because each Bash round trip re-bills the whole
accumulated context (헌법 제2조). Every state-changing send carries an
--operation_id: the duplicate-order incident earlier this session came from a
retry loop with no idempotency key, and four identical orders is four times the
credit for one deliverable (헌법 제7조).
"""
import json, subprocess, time, os, sys

GSK = "gsk"
CH_IMG = "ch_d161a407a31cf5b8d200aea17b5470c6"   # #6  AI 이미지
CH_V2  = "ch_a156a871acc7e528d846b49dba8553ab"   # #10 V-2 AI 비디오
CH_V5  = "ch_0e0cef77c890ae9f7d847660c2d6d269"   # #14 V-5 AI 오디오
AG_IMG = "agent_4pfyyrx8kmd7"
AG_V2  = "agent_4gettwpxdxp6"
AG_V5  = "agent_5ry8ha5hy8xg"
LOG = []

def sh(args, timeout=100):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"

def jparse(out):
    try:
        return json.JSONDecoder().raw_decode(out.lstrip())[0]
    except Exception:
        return None

def send(ch, agent, content, opid):
    """Send once, confirm once. `gsk genteam send` answers the first identical
    call with pending_confirmation and no message id; repeating it is the
    confirmation. The operation_id makes that repeat idempotent, so a confirm
    can never become a second order."""
    res = []
    for attempt in range(2):
        rc, out, err = sh([GSK, "genteam", "send", "--channel_id", ch,
                           "--content", content, "--mentions", agent,
                           "--operation_id", opid])
        d = jparse(out) or {}
        data = d.get("data", d)
        st, mid = data.get("status"), data.get("message_id") or data.get("id")
        res.append((rc, st, mid))
        if st == "ok" and mid:
            break
        time.sleep(1.5)
    return res

# ── 1. plates -> image agent ──────────────────────────────────────────────────
brief = open("/home/user/lf/gt/plate38_order.md", encoding="utf-8").read()
r = send(CH_IMG, AG_IMG, brief, "act38-plates-v1")
LOG.append(f"PLATES -> image agent: {r}")

# ── 2. nine clips -> V-2, with the plate each one starts from ─────────────────
import shots38 as T
man = T.i2v_manifest38()
v2 = ["# ACT3~8 i2v 9클립 발주서 v1 (선행 조건: plate 도착)",
      "",
      "## 중요 — 순서",
      "이 9클립은 **plate(정지판) 27장이 먼저 도착해야** 생성할 수 있습니다.",
      "각 클립의 **첫 프레임은 지정된 plate 이미지 그 자체**입니다. plate URL을 제가",
      "받는 즉시 이 채널에 클립별로 전달하겠습니다. **지금은 대기해 주십시오.**",
      "미리 알려드리는 이유는 사양을 먼저 검토하실 수 있도록 하기 위함입니다.",
      "",
      "## 공통 사양",
      "- 1920×1080 · 24fps · 16:9 · **무음**",
      "- 요청 길이 + 1.0초 이상 여유 (제가 프레임 단위로 잘라 씁니다)",
      "- **첫 프레임 = 전달받은 plate 원본과 동일 구도** (재해석 금지)",
      "- **SF 금지**: 배관·포털·홀로그램·회로·와이어프레임·연결 광선",
      "- **종이는 찢어지지 않습니다.** 파괴·분해·폭발 표현 금지",
      "- **종이 장수는 변하지 않습니다.** 첫 프레임의 장수 = 마지막 프레임의 장수",
      "- 읽히는 한글 본문을 새로 만들지 마십시오 (문서 본문 = 회색 바)",
      "",
      "## 왜 9개만인가",
      "이 구간 80개 샷 중 71개는 정지판 위 카메라 이동으로 처리합니다.",
      "영상 생성은 **화면 안의 물체가 실제로 변하는 샷에만** 사용합니다.",
      "아래 9개가 그 조건을 만족하는 샷입니다.",
      ""]
for m in man:
    v2 += [f"### `{m['sid']}` — {m['need']:.2f}초 필요 (plate `{m['anchor']}` 에서 시작)",
           f"- 시간: {m['t0']:.2f}~{m['t1']:.2f}초",
           f"- 카메라: {m['note'].split(' | ')[0]}",
           f"- 화면: {m['objects'] or '(plate 구도 유지)'}",
           f"- **실제로 변하는 것**: 아래 물체 이동/전개만. 카메라 외 나머지는 정지.",
           ""]
v2 += ["## 회신 방법", "`gsk upload` URL + 클립 ID 를 함께 회신해 주십시오.",
       "완성되는 대로 부분 회신 환영합니다.", "",
       "## 직전 5클립 재발주 관련",
       "A1-06 / A1-08 / A2-02 / A2-04 / A2-13 재발주가 **동일 내용으로 4건 중복 발송**",
       "되었습니다. 제 조회 코드 오류였습니다. **각각 1개씩만 생성해 주십시오.**",
       "이미 생성하신 분량이 있으면 그것을 그대로 회신해 주시면 됩니다."]
v2txt = "\n".join(v2)
open("/home/user/lf/gt/v2_act38_order.md", "w", encoding="utf-8").write(v2txt)
r = send(CH_V2, AG_V2, v2txt, "act38-i2v-v1")
LOG.append(f"I2V9 -> V-2: {r}")

# ── 3. SRT realignment -> V-5 ─────────────────────────────────────────────────
v5 = """# 자막(SRT) 500초 재정합 발주

기존 SRT 112큐는 **405초 기준**으로 작성되어 현재 500초 마스터와 맞지 않습니다.
`v14_audio_F6_fixed_500s.wav` (500.010667초) 를 정본으로 **전량 재정합**해 주십시오.

## 요구사항
- 형식: SRT. 0.00~500.01초 전 구간.
- 타이밍은 **해당 wav 실측** 기준. 추정 금지.
- 한 큐 최대 2줄, 줄당 한글 기준 약 20자 이내.
- 문장을 쪼개거나 합치지 마십시오 — 나레이션 문장 경계를 유지합니다.
- 405.12~411.20 및 488.98~499.80 은 실측 무발화 구간입니다. 큐 없음.
- 마지막 문장(499.80 "다음 시간에 만나요")은 파일 끝에서 잘린 것으로 표시되어
  있습니다. 들리는 대로만 적고 임의로 보완하지 마십시오.

`gsk upload` URL 로 회신해 주십시오."""
r = send(CH_V5, AG_V5, v5, "srt-500-realign-v1")
LOG.append(f"SRT -> V-5: {r}")

# ── 4. harvest: has anything arrived while we were building the table? ────────
for tag, ch in (("V-2", CH_V2), ("IMG", CH_IMG), ("V-5", CH_V5)):
    rc, out, err = sh([GSK, "genteam", "read", "--channel_id", ch, "--limit", "25"])
    d = jparse(out) or {}
    items = (d.get("data") or {}).get("items") or []
    urls = []
    for m in items:
        md = m.get("data", m)
        if md.get("sender_actor_type") == "agent":
            c = md.get("content") or ""
            for tok in c.replace("(", " ").replace(")", " ").split():
                if "/api/files/s/" in tok:
                    urls.append(tok.strip(".,`'\"<>"))
    LOG.append(f"{tag} channel rc={rc} rows={len(items)} agent_urls={len(set(urls))}")
    for u in sorted(set(urls))[-12:]:
        LOG.append(f"    {u}")

open("/tmp/send38.txt", "w", encoding="utf-8").write("\n".join(LOG) + "\n")
print("\n".join(LOG))
