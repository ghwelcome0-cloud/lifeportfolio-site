# -*- coding: utf-8 -*-
"""plan_i2v.json + anchor_en.py -> 생성 모델 프롬프트.

왜 이렇게 쓰는가 (설계 근거)
--------------------------
R-a 첫 프레임은 승인된 plate 그대로 고정한다.
    CEO-32 "이미지 퀄리티는 합격!" / CEO-37 "이미지 퀄리티는 만족합니다" 를
    깨뜨리지 않는 유일한 방법. <FIRST_FRAME> 바인딩 + look 유지 지시.

R-b 카메라 문법은 번역하지 않는다 — 설계표 note 에 이미 영문으로 있다.
    실측: pull-back / top-down / dolly-in / push-through / lateral track /
    micro-push. 한국어 부분은 "무엇을 향해"라는 목적어이고, 그 목적어는
    plate 안에 이미 존재하는 물체다. (교훈 95 의 연장)

R-c 목적어는 anchor_en.py 의 targets 에서만 고른다.
    기계 번역이 만든 "the subject already visible in frame" 은 목적어가
    아니다. 그것이 CEO-33 "움직임에도 의미가 있어야" 가 지적한 결함이다.
    targets 는 plate 를 눈으로 확인해 적은 실물 목록이므로, 모델에게
    없는 것을 만들라고 시키지 않는다는 보증도 된다.

R-d 해부(CEO-39 "실사 3D 해부")는 cutaway 가 있는 anchor 에서만 요구한다.
    없는 곳에 요구하면 모델이 새 물체를 발명한다 = 금지요소 위반.
    실측: 20 anchor 중 11 종만 단면/층/서랍/칸을 실제로 갖고 있다.

R-e 한글이 구워진 plate 는 생성하지 않는다.
    assemble.py R5 는 "한글은 오버레이" 라고 적었지만, plate 실물을 보니
    P01/P02/P07/P10/P18 에는 유리 패널 안에 한글이 구워져 있다
    (P01 패널 Laplacian 선명도 607.1, 프레임 면적 5.17%).
    생성에 통과시키면 반드시 녹는다 = CEO-16 "글자 퀄리티는 저급이에요" 재발.
    -> 이 7 job / 30.9초 는 현행 정지+카메라를 유지한다.

R-f plate 원본에 손이 있는 anchor 는 "no hands" 를 넣지 않는다.
    Q06/Q21/S08 에는 CEO-32 가 승인한 손이 이미 화면에 있다. 지우라고
    지시하면 모델이 그 영역을 뭉갠다. 대신 "손을 추가하지 말고 이미 있는
    손만 자연스럽게 유지" 로 바꾼다. (교훈 117 의 귀속 원칙)

R-g run 안에서 목적어를 순환시킨다.
    같은 anchor 의 job 이 6개까지 있으므로(S23), 전부 같은 목적어·같은
    마무리로 끝나면 CEO-37 "이미지를 왔다 갔다" 가 재발한다. job 순번에
    따라 targets 를 돌려 쓰고, 해부 마무리는 그 anchor 의 마지막 job 에만
    붙인다.
"""
import json
import re

import anchor_en

VERB = {
    "도착": "settles onto",
    "관통": "travels forward through",
    "후퇴": "pulls back from",
    "경로": "glides along",
    "진입": "pushes into",
    "이동": "moves toward",
}

TERM = {
    "pull-back": "retreating so the view widens",
    "top-down": "descending vertically from directly overhead",
    "dolly-in": "dollying steadily forward",
    "dolly": "dollying",
    "micro-push": "pushing in by only a hair",
    "push-through": "pushing straight through the plane",
    "lateral track": "tracking sideways",
    "track": "tracking",
    "whole": "opening out to take in the whole scene",
    "recap": "sweeping back across ground already covered",
    "hold": "holding nearly steady",
}

BAN_KO = {
    "홀로그램": "holograms",
    "회로": "circuit patterns",
    "우열": "any ranking or superiority marking",
    "임의 생성": "invented labels of any kind",
    "발광": "emissive glowing light",
    "그래프": "graphs",
    "차트": "charts",
}

LOOK = ("Photoreal live-action macro cinematography, shallow depth of field, natural soft "
        "window light, subtle real hand-held camera micro-shake, cinematic 24 fps motion "
        "blur, colour and contrast matched to the opening frame.")


def ban_block(hands_ok):
    b = ("Strict constraints: absolutely no readable letters, no words, no numbers, no "
         "captions, no titles and no labels anywhere in the frame — every grey bar and "
         "grey block must remain a plain flat grey shape with nothing written inside it. "
         "No glowing lines, no connecting lines, no arrows, no icons, no user-interface "
         "elements, no holograms, no circuit patterns, no data-visualisation overlays, no "
         "charts, no diagrams, no light beams, no particles, no sparks, no lens flares. ")
    if hands_ok:
        b += ("Keep any hand already visible in the opening frame exactly as it is and let "
              "it move naturally, but do not add any further person, hand or face. ")
    else:
        b += "No people, no hands, no faces. "
    b += ("No cuts, no transitions, no dissolves, no fades — one single unbroken continuous "
          "shot. Do not add, remove or replace any object that is not already present in "
          "the opening frame.")
    return b


def amp_phrase(note):
    m = re.findall(r"([0-9.]+)\s*%", note or "")
    if not m:
        return "with a clearly visible, unhurried travel"
    v = max(float(x) for x in m)
    if v < 1.5:
        return "with an extremely small, barely perceptible creep"
    if v < 4.0:
        return "with a small but unmistakable travel"
    if v < 8.0:
        return "with a firm, substantial travel"
    return "with a large, sweeping travel"


def verb_of(note):
    m = re.match(r"^\s*(\S+?)\s*[—\-–]", note or "")
    tok = m.group(1) if m else (note or "")[:2]
    return VERB.get(tok, "moves across")


def terms_of(note):
    body = note.split("—", 1)[1] if "—" in (note or "") else (note or "")
    body = body.split("|", 1)[0].lower()
    out = []
    for k in sorted(TERM, key=len, reverse=True):
        if k in body and TERM[k] not in out:
            out.append(TERM[k])
    return out


def extra_bans(notes):
    out = []
    for n in notes:
        for ko, en in BAN_KO.items():
            if ko in (n or "") and en not in out:
                out.append(en)
    return out


def build(job, spans, seq, is_last):
    """seq: 이 anchor 안에서 이 job 이 몇 번째인가 (0-based) — 목적어 순환용
       is_last: 이 anchor 의 마지막 job 인가 — 해부 마무리는 여기에만"""
    a = anchor_en.get(job["anchor"])
    tg = a["targets"]
    L = []
    L.append("Use <FIRST_FRAME> exactly as the opening frame. Keep its photographic look, "
             "materials, lighting, colour and texture identical for the entire shot.")
    L.append("")
    L.append("The scene is %s." % a["scene"])
    L.append("")
    L.append("One continuous live-action camera move over this real physical scene, shot "
             "like an architectural cutaway documentary that dissects what it films.")
    L.append("")
    for i, ((sid, s, e), note) in enumerate(zip(spans, job["notes"])):
        tgt = tg[(seq + i) % len(tg)]
        seg = "%0.1f-%0.1fs: the camera %s %s, %s" % (
            s, e, verb_of(note), tgt, amp_phrase(note))
        t = terms_of(note)
        if t:
            seg += ", " + ", ".join(t)
        L.append(seg + ".")
    if is_last and a["cutaway"]:
        L.append("")
        L.append("By the end of the move the camera has revealed %s. As the camera passes, "
                 "individual layers separate by a hair, like strata being read." % a["cutaway"])
    L.append("")
    L.append(LOOK)
    L.append("")
    b = ban_block(a["hands"])
    ex = extra_bans(job["notes"])
    if ex:
        b += " Additionally forbidden: " + ", ".join(ex) + "."
    L.append(b)
    return "\n".join(L)


def main():
    import shots38 as s
    T = {r["sid"]: r for r in s.TABLE38}
    jobs = json.load(open("plan_i2v.json"))

    # anchor 별 job 순번 / 마지막 여부
    seq = {}
    order = {}
    for j in jobs:
        order.setdefault(j["anchor"], []).append(j["jid"])
    for anc, lst in order.items():
        for i, jid in enumerate(lst):
            seq[jid] = (i, i == len(lst) - 1)

    out = []
    skip = []
    for j in jobs:
        a = anchor_en.get(j["anchor"])
        if a is None:
            skip.append((j["jid"], "anchor 사전 없음"))
            continue
        if a["baked_text"]:
            skip.append((j["jid"], "plate 에 한글이 구워져 있음 — 생성하면 글자가 녹는다"))
            continue
        base = j["t0"]
        raw = j["t1"] - j["t0"]
        scale = (float(j["dur"]) / raw) if raw > 0 else 1.0
        spans = [(sid, (T[sid]["t0"] - base) * scale, (T[sid]["t1"] - base) * scale)
                 for sid in j["sids"]]
        i, last = seq[j["jid"]]
        j2 = dict(j)
        j2["prompt"] = build(j, spans, i, last)
        j2["hands_ok"] = a["hands"]
        out.append(j2)

    json.dump(out, open("prompts_i2v.json", "w"), ensure_ascii=False, indent=1)
    bad = [j["jid"] for j in out if re.search(r"[가-힣]", j["prompt"])]
    print("생성 대상 job   : %d" % len(out))
    print("생성 제외 job   : %d" % len(skip))
    for jid, why in skip:
        print("   - %-14s %s" % (jid, why))
    print("덮는 시간       : %.1f초 / 274.5초" % sum(j["raw"] for j in out))
    print("한글 잔존 프롬프트: %d %s" % (len(bad), bad))
    print("=" * 74)
    print("### %s" % out[0]["jid"])
    print(out[0]["prompt"])


if __name__ == "__main__":
    main()
