# -*- coding: utf-8 -*-
"""Retry the plate order as an attachment, then measure the two new V-2 clips.

The first attempt failed with status=error: a 15,734-character brief exceeds
what --content accepts. The brief is not too long — 27 plates each need their
own composition, protection rules and framing budget, and trimming it would
just move the ambiguity into the images. So the document travels as a document,
which is what --file_path is for.
"""
import json, subprocess, os, time

GSK = "gsk"
CH_IMG = "ch_d161a407a31cf5b8d200aea17b5470c6"
AG_IMG = "agent_4pfyyrx8kmd7"
LOG = []

def sh(a, t=110):
    try:
        p = subprocess.run(a, capture_output=True, text=True, timeout=t)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"

def jp(o):
    try:
        return json.JSONDecoder().raw_decode(o.lstrip())[0]
    except Exception:
        return None

# ── upload the brief ──────────────────────────────────────────────────────────
BR = "/home/user/lf/gt/plate38_order.md"
rc, out, err = sh([GSK, "upload", BR])
d = jp(out) or {}
url = None
for k in ("url", "file_url", "download_url", "wrapper_url"):
    v = (d.get("data") or d).get(k) if isinstance(d, dict) else None
    if v: url = v; break
if not url:
    import re
    m = re.search(r"https://\S*/api/files/s/\w+", out + err)
    url = m.group(0) if m else None
LOG.append(f"upload rc={rc} url={url}")
LOG.append(f"upload raw head: {(out or err)[:220]}")

if url:
    caption = ("""ACT3~8(150.32~500.00초) 정지판 27장 발주서를 첨부합니다.

## 핵심 요약
- **정지 이미지 27장**입니다. 영상 아닙니다. 2048×1152 가로 고정.
- 이 27장 위에서 카메라만 움직여 350초 중 약 320초를 채웁니다.
- 세계관: **현실 사무실 단면(벽 절개)**. SF 배관·포털·홀로그램·회로 전면 금지.
- 문서 본문은 **회색 바 추상화** — 읽히는 한글 본문을 그리지 마십시오.
- 읽히는 한글은 **유리 패널 5장(P01·P02·P07·P10·P18)에서만**. 패널 내부 장식 금지.
- `Q` 코드 8장은 **순차 공개 상태판**입니다. 그 시점에 보여야 하는 것만 채우고
  **다음에 나올 항목은 비워** 두십시오. 미리 채우면 반려됩니다.
- 카메라가 이 판 위를 이동하므로 **여백 5~8%** 를 반드시 남겨 주십시오.

첨부 문서에 27장 각각의 구도·오브젝트·보호조건·여백이 개별 명시되어 있습니다.

## 회신
`gsk upload` URL + plate 코드를 함께, **완성되는 대로 부분 회신** 부탁드립니다.
도착한 순서대로 조립을 시작합니다. 대표님이 이미지를 먼저 검토하십니다.""")
    res = []
    for _ in range(2):
        rc, out, err = sh([GSK, "genteam", "send", "--channel_id", CH_IMG,
                           "--content", caption, "--file_path", url,
                           "--file_name", "plate38_order.md",
                           "--mentions", AG_IMG,
                           "--operation_id", "act38-plates-v2"])
        dd = jp(out) or {}
        da = dd.get("data", dd)
        res.append((rc, da.get("status"), da.get("message_id") or da.get("id")))
        if da.get("status") == "ok": break
        time.sleep(2)
    LOG.append(f"PLATES send: {res}")
    LOG.append(f"send raw head: {(out or err)[:220]}")
else:
    LOG.append("PLATES send SKIPPED — no upload url; brief stays local")

open("/tmp/send38b.txt","w",encoding="utf-8").write("\n".join(LOG)+"\n")
print("\n".join(LOG))
