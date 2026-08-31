#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shorts4.py — ★숏츠 4막 조립기★ (기승전결 · 화면 100% · 오버레이 레이어)

■ 왜 shorts916.py 를 버리고 새로 만드는가 (CEO-89 / CEO-91)
   [CEO-89] "숏폼도 단순히 롱폼에서 일부 잘라내기가 아니라 알고리즘에 최적화된
            기승전결이 있어야 하지 않을까요? 지금 숏폼 C는 16초이고
            프래비즈 일부 적용한 영상이네요."

   shorts916.py 의 두 구조적 결함 (코드 실측):
     결함 1  CUTS = 롱폼 4컷(J_A3-13/14/15/17)을 ★순서 그대로★ 재사용
             ⇒ 「잘라내기」. 숏츠 고유의 기승전결이 없다.
     결함 2  VID_H=608 / H=1920 ⇒ 영상이 화면의 ★31.7%★, 68% 가 정적 밴드
             ⇒ 「프래비즈 일부 적용」의 정확한 정체.

■ 결함 2 의 해소 근거 (★이 세션 실측★)
   shorts916 이 레터박스를 택한 이유는 "구운 흰 글자가 9:16 크롭 폭 405px 를
   넘는다" 였다. 그 계측은 옳았다. 그런데 ★전제가 4컷에만 참이다★:

       scenejobs.json 123 컷 중 on_screen_text 가 있는 컷 = ★5개★
         J_A3-01 / J_A3-05 / J_A3-12 / J_A4-01 / J_A5-10
       나머지 ★118 컷은 구운 글자가 없다★.

   글자가 없는 컷은 크롭해도 잘릴 글자가 없다. 그래서 이 조립기는
   ★글자 없는 컷만 사용★하고 화면 100% 를 쓴다. 글자는 우리가 조판한다
   (교훈 224: 자막은 우리가 조판한다).

■ 4막 구조 (벤치마크 실측 · @archcutaway patj0ZL5HOA / V_5mJPY0XNw)
   기 0~4s    후킹. 「오해/역설」을 던진다.        (그들: "멈췄는데 더 위험하다")
   승 4~27s   전개. 구성요소를 해부해 보여준다.
   전 28~49s  위기. "이걸 놓치면 어떻게 되는가"
   결 50~72s  결론 + CTA. 루프로 처음과 이어진다.

   길이: 벤치마크 실측 72~82초. 74 문서 §7 의 "15~35초"는 2023년 기준이고,
   ★품질 하한선은 벤치마크다 (CEO-91)★ 이므로 벤치마크를 따른다.

■ 오디오 (비용 0 · 목소리 완벽 일관)
   500초 나레이션 원본(v14_audio_500s.wav)에서 CSV sid 타임코드로 비트를
   ★잘라 붙인다★. TTS 재생성이 아니라 재조립이므로 크레딧 0 이고,
   대표님이 이미 승인한 목소리·톤이 그대로 유지된다.

■ 오버레이 (완성도의 원천 · 원리 2)
   r3d/overlay.py 를 import 한다. 팔레트·조판은 그 파일이 정본 참조를 한다.

CLI
   python3 shorts4.py plan          비트 표 + 길이 검산 (렌더 없음)
   python3 shorts4.py build         오버레이 PNG + 컷 합성 + concat + 오디오 mux
   python3 shorts4.py gate [path]   기승전결/후킹/화면점유/광류/글자잘림 게이트
"""
import os, sys, csv, json, math, subprocess, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
BATCH = HERE + "/_batch"
# ★글자 끝접촉 게이트 상수 (교훈 248)★
#   우리 조판 글자가 놓이는 y 띠. 이 밖은 배경/장식이므로 검사 대상이 아니다.
TEXT_BAND_TOP = 420      # 이 위 = 챕터 태그 / 수치 / 훅 타이틀
TEXT_BAND_BOT = 1330     # 이 아래 = 자막 / CTA
EDGE_PX = 6              # 최외곽 이 폭 안에 닿으면 「끝접촉」
GLYPH_H_MIN = 14         # 글자 최소 세로 높이(px). 자막은 48pt+ 이므로 여유
ASPECT_LINE = 8.0        # 가로/세로 >= 이 값이면 글자가 아니라 「선」
AISRC = HERE + "/_aisrc"
SRC_DIR = AISRC   # AI i2v 정규화 소스 (aisrc.py 산출). 3D 배치본은 BATCH.
JOBS = HERE + "/scenejobs.json"
SCRIPT_CSV = "/home/user/lf/_script/SCRIPT_ACT3-8.csv"
NARR = "/home/user/lf/inbox/rd/v14_audio_500s.wav"
WORK = "/home/user/lf/work/longform/_s4"

FPS = 24
W, H = 1080, 1920          # ★화면 100% — 레터박스 없음★

_spec = importlib.util.spec_from_file_location("_ov", HERE + "/overlay.py")
OV = importlib.util.module_from_spec(_spec)
sys.modules["_ov"] = OV
_spec.loader.exec_module(OV)


# ────────────────────────────────────────────────────────────────────────
# ★기획 정본★ — 대본 80행에서 숏츠 전용으로 ★새로 선정한★ 비트
#   원칙 1  롱폼 순서를 따르지 않는다. 4막 기능에 맞는 문장을 대본 전역에서 고른다.
#   원칙 2  구운 글자가 있는 5컷(A3-01/A3-05/A3-12/A4-01/A5-10)은 ★쓰지 않는다★
#           (화면 100% 크롭을 위해).
#   원칙 3  각 막은 「기능」이 다르다. 같은 기능의 문장을 두 번 쓰지 않는다.
#   원칙 4  루프: 결의 마지막 문장이 기의 첫 문장으로 자연 연결된다.
# ────────────────────────────────────────────────────────────────────────
BEATS = [
    # (act, sid)  ★조립 단위는 sid 그룹 = 분할 형제 전체★
    #
    # ■ 왜 job 이 아니라 sid 인가 (★이 세션 실측으로 정정★)
    #   첫 판은 (act, sid, job_id) 로 job 하나씩 골랐다. plan 이 두 결함을 잡았다:
    #     ① J_A6-02_s1 / _s2 에 ★같은 나레이션이 중복★ 출력
    #        -> CEO-74 가 반려한 "'정답은 없습니다'만 계속 반복" 과 같은 결함.
    #     ② 나레이션(7.96s)이 job 하나(2.67s)보다 길어 ★문장이 잘림★.
    #   실측: sid 그룹의 프레임 합 == 대본 dur (오차 <= 0.02s, 70개 sid 전량).
    #        A6-02  3컷 191f = 7.96s   대본 7.96s
    #        A5-08  3컷 228f = 9.50s   대본 9.52s
    #   ⇒ 나레이션과 영상이 맞는 유일한 단위는 ★sid 그룹★ 이다.
    #     (교훈 200: 대본이 서사의 정본 / 교훈 222: 대본이 정한 frames 가 정당한 사유)
    #
    # ■ 막 배정 원칙
    #   원칙 1  롱폼 순서를 따르지 않는다 — 4막 「기능」에 맞는 sid 를 전역에서 고른다.
    #   원칙 2  구운 글자가 있는 5 sid (A3-01/A3-05/A3-12/A4-01/A5-10) 는 쓰지 않는다
    #           (화면 100% 크롭을 위해 · 교훈 224 자막은 우리가 조판한다).
    #   원칙 3  같은 sid 를 두 번 쓰지 않는다.
    #   원칙 4  루프: 결의 마지막(A6-11)이 기의 첫(A6-02)과 주제로 이어진다
    #           "이미 살아온 삶에서 발견" -> "미래를 검색하지 말고 지나온 경험에서"

    # ── 기 (후킹) 역설을 던진다 ────────────────────────────────────────────
    ("기", "A6-02"),   # 7.96s  "미래만 더 오래 검색하기보다 이미 지나온 경험에서"

    # ── 승 (전개) 세 가지를 해부하고, 문장으로 굳힌다 ─────────────────────
    ("승", "A6-03"),   # 2.71s  나는 어떤 역할을 반복해 왔는가?
    ("승", "A6-04"),   # 2.79s  어떤 방식에서 꾸준히 기여하는가?
    ("승", "A6-05"),   # 2.96s  어떤 변화를 남기고 싶은가?
    ("승", "A3-15"),   # 4.12s  나는 이런 방식으로 ... 더 꾸준히 기여한다
    ("승", "A4-14"),   # 3.33s  나는 ... 의미 있는 변화를 남기고 싶다

    # ── 전 (위기) 놓치면 어떻게 되는가 ───────────────────────────────────
    ("전", "A3-17"),   # 5.38s  회사 이름이나 연봉만 볼 때 빠지기 쉬운 것
    ("전", "A5-08"),   # 9.50s  "주도적으로" 가 내 자율성과 같은 뜻인지 단정하지 않는다
    ("전", "A5-09"),   # 4.96s  면접에서 물어볼 항목으로 바꾼다

    # ── 결 (결론 + CTA + 루프) ────────────────────────────────────────────
    ("결", "A6-06"),   # 4.88s  완벽하게 예측할 수 있는 것은 아니다
    ("결", "A6-07"),   # 4.83s  다만 중요한 것을 놓치지 않고 살펴볼 수 있다
    ("결", "A6-11"),   # 4.71s  이미 살아온 삶에서 다음 방향을 발견해 보세요
]

# 컷 리듬 상한 (물리량 · 교훈 226). 이보다 긴 job 은 세그먼트로 쪼개고
# ★세그먼트마다 오버레이를 바꾼다★ — 카메라는 계속 움직이고 그래픽이 갱신되는,
# 벤치마크 자신의 문법이다 (patj0ZL5HOA 0:04-0:27 전개 구간).
RHYTHM_MAX = 4.0
RHYTHM_MIN = 0.5

BAKED_SIDS = ("A3-01", "A3-05", "A3-12", "A4-01", "A5-10")

TAG = "경력은 쌓였는데 다음이 안 보인다면"
HOOK = ["미래를 더 검색해도", "답은 안 나옵니다"]
CTA = "이미 살아온 삶에서 찾으세요"


def sh(cmd, **kw):
    r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True,
                       text=True, **kw)
    if r.returncode != 0:
        raise SystemExit("FAILED: %s\n%s" % (cmd, r.stderr[-1200:]))
    return r


def nframes(path):
    return int(subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
         "-show_entries", "stream=nb_read_frames", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True).stdout.strip())


def tc(s):
    """'6:04.20' -> 364.20"""
    s = s.strip()
    if ":" in s:
        m, sec = s.split(":")
        return int(m) * 60 + float(sec)
    return float(s)


def load_script():
    rows = list(csv.DictReader(open(SCRIPT_CSV, encoding="utf-8-sig")))
    return {r["sid"]: r for r in rows}


def load_jobs():
    d = json.load(open(JOBS))
    jobs = d["jobs"] if isinstance(d, dict) else d
    return {j["job_id"]: j for j in jobs}


# ────────────────────────────────────────────────────────────────────────
def plan(verbose=True):
    """sid 그룹 -> 세그먼트 목록.

    한 sid 는 대본이 정한 dur 를 갖고, 그 sid 의 job(분할 형제)들의 프레임 합이
    정확히 그 dur 다 (70 sid 전량 실측, 오차 <= 0.02 s). 그래서 sid 를 통째로
    쓰고, 그 안의 job 각각을 「세그먼트」로 삼는다. 나레이션은 sid 단위로
    한 번만 흐르고, 자막도 sid 단위로 한 번만 조판된다 (중복 없음).
    """
    S = load_script()
    J = load_jobs()
    from collections import defaultdict
    grp = defaultdict(list)
    baked = set()
    for jid, j in J.items():
        ps = j.get("props_sid") or jid.replace("J_", "").split("_s")[0]
        grp[ps].append(jid)
        if (j.get("on_screen_text") or "").strip():
            baked.add(ps)
    for k in grp:
        grp[k].sort()

    used = set()
    beats, t = [], 0.0
    for act, sid in BEATS:
        if sid in used:
            raise SystemExit("SID REUSED: %s" % sid)
        used.add(sid)
        if sid not in S:
            raise SystemExit("SID MISSING IN SCRIPT: %s" % sid)
        if sid in baked or sid in BAKED_SIDS:
            raise SystemExit("BAKED-TEXT SID NOT ALLOWED (crop unsafe): %s" % sid)
        jids = grp.get(sid)
        if not jids:
            raise SystemExit("NO JOB FOR SID: %s" % sid)
        segs = []
        for jid in jids:
            mp4 = "%s/%s.mp4" % (SRC_DIR, jid)
            if not os.path.exists(mp4):
                raise SystemExit("MP4 MISSING: %s" % mp4)
            f = int(J[jid]["frames"])
            # ★시간축 분할★ — 한 job 이 RHYTHM_MAX 를 넘으면 프레임 구간으로
            #   쪼갠다. 영상 픽셀은 그대로이고 「오버레이가 갱신되는 단위」가
            #   늘어난다. 벤치마크 전개 구간의 문법(그래픽이 계속 갱신된다)이
            #   바로 이것이며, 컷 리듬 게이트(G11)도 이렇게 충족된다.
            #   합계 프레임은 보존되므로 나레이션 정합(오차<=0.02s)은 불변이다.
            nsub = int(math.ceil(f / float(RHYTHM_MAX * FPS)))
            base = f // nsub
            rem = f - base * nsub
            off = 0
            for k in range(nsub):
                fk = base + (1 if k < rem else 0)
                segs.append(dict(jid=jid, frames=fk, dur=fk / float(FPS),
                                 f0=off, sub=k, nsub=nsub))
                off += fk
            assert off == f, (jid, off, f)
        r = S[sid]
        vdur = sum(x["dur"] for x in segs)
        a0, a1 = tc(r["start"]), tc(r["end"])
        beats.append(dict(act=act, sid=sid, segs=segs, t0=t, t1=t + vdur,
                          dur=vdur, a0=a0, a1=a1, adur=a1 - a0,
                          narr=r["narration"].strip()))
        t += vdur

    if verbose:
        print("shorts4.plan   sid-beats %d   segments %d"
              % (len(beats), sum(len(b["segs"]) for b in beats)))
        cur = None
        for b in beats:
            if b["act"] != cur:
                cur = b["act"]
                print("  ── %s ──" % cur)
            print("    %-7s %5.2fs vid / %5.2fs narr  (delta %+.2f)  %d seg  [%6.2f-%6.2f]"
                  % (b["sid"], b["dur"], b["adur"], b["dur"] - b["adur"],
                     len(b["segs"]), b["t0"], b["t1"]))
            print("        %s" % b["narr"])
            print("        segs: %s" % ", ".join(
                "%s %.2fs" % (x["jid"], x["dur"]) for x in b["segs"]))
        print("  TOTAL %.2f s  (%d f)"
              % (t, sum(x["frames"] for b in beats for x in b["segs"])))
        for a in ("기", "승", "전", "결"):
            v = [b for b in beats if b["act"] == a]
            print("  %s  %d sid  %.2f s" % (a, len(v), sum(x["dur"] for x in v)))
        worst = max((abs(b["dur"] - b["adur"]), b["sid"]) for b in beats)
        print("  worst video/narration delta  %.3f s  (%s)" % worst)
    return beats


def _ov_spec(b, seg_i, nseg, acts_idx, act_total, gprog=0.0):
    """세그먼트 하나의 오버레이 spec.

    ■ 막마다 문법이 다르다 (원리 2/3/4 · 76 §12 벤치마크 정본)
       기  큰 후킹 타이틀 + 역설 지시 화살표
       승  장 태그 [n/5] + 큰 수치 + 리더선 라벨 + 발광 라인 + 눈금
       전  경고 아이콘(빨강) + "같은 뜻일까?" 반문 라벨
       결  세 문장 라벨 + 발광 라인, 마지막 세그먼트에만 CTA
    ■ 세그먼트마다 그래픽이 갱신된다 — 벤치마크 전개 구간의 문법.
       자막은 sid 단위로 한 번 조판하고 세그먼트 전체에 그대로 실린다.
    """
    # ★wrap_words 는 개행이 든 문자열을 돌려준다 — 반드시 split 한다★
    sub = [x for x in (t.strip() for t in
                       str(OV.wrap_words(b["narr"])).split("\n")) if x][:3]
    sp = {"hud": True, "sub": sub, "sub_y": 1418, "sub_pt": 54}
    act = b["act"]
    prog = (seg_i + 1) / float(nseg)

    # ★진행 바★ (이 세션 신설 · 원리 = 이탈 방지)
    #   벤치마크 숏츠는 「얼마 남았는가」를 화면에 계속 알린다. 시청자는 끝이
    #   보이면 끝까지 본다 -> 시청 유지율이 알고리즘 노출을 만든다.
    #   gprog 는 ★영상 전체★ 기준 누적 진행률이며 build() 가 계산해 넘긴다.
    sp["progress"] = gprog
    sp["progress_y"] = 58

    # ★측정 격자★ (이 세션 신설 · 크레딧 0 의 밀도 보강)
    #   육안 검출: 우리 3D 배경은 평평한 판 1~2장뿐이라 화면이 비어 보였다.
    #   벤치마크는 배경을 비워두지 않는다. 격자를 깔면 같은 배경이 「계측된
    #   도면」으로 읽힌다 (분석 원문: clean vector graphics HIDE THE
    #   IMPERFECTIONS ... sell the educational/technical vibe).
    #   재렌더(123컷 = 170분 + 낭비) 대신 이 한 줄로 해결한다.
    sp["grid"] = {"step": 132, "alpha": 40}

    # ★단면 해칭 + 치수선★ — 우리 주제는 「경력의 해부」다. 해부했다는 사실을
    #   3D 로 다시 만들지 않고 2D 제도 기호로 선언한다.
    sp["sections"] = [{"box": [232, 812, 848, 1148], "alpha": 128, "pitch": 74}]

    if act == "기":
        sp["hook"] = HOOK
        sp["hook_y"] = 240
        sp["hook_pt"] = 84
        sp["labels"] = [{"anchor": [300, 940 + int(60 * prog)],
                         "text": "지나온 경험", "side": "right"}]
        sp["arrows"] = [{"p0": [860, 700], "p1": [430, 900 + int(60 * prog)]}]
        sp["ticks"] = [{"y": 1330, "x0": 90, "x1": 990}]
        # ★데이터 스트립★ — 상단 여백을 비우지 않는다. 화면이 「계측 장비의
        #   화면」처럼 읽히면 교육·기술 신뢰감이 생긴다 (유료 분석 원문:
        #   "sell the educational/technical vibe").
        sp["strip"] = [("SUBJECT", "경력 해부"), ("MODE", "3D+2D")]
        # 후킹 막은 시야가 열려야 한다 — 단면 박스를 넓게, 옅게
        sp["sections"] = [{"box": [140, 860, 940, 1200], "alpha": 96,
                           "pitch": 96}]

    elif act == "승":
        n = acts_idx
        names = ["반복한 역할", "일하는 방식", "남기고 싶은 변화",
                 "두 번째 문장", "세 번째 문장"]
        sp["chapter"] = (n, act_total, names[min(n - 1, len(names) - 1)])
        sp["chapter_xy"] = (52, 160)
        sp["numbers"] = [{"xy": [64, 252], "value": str(min(n, 3)),
                          "unit": "번째", "label": "확인할 기준", "pt": 94}]
        sp["labels"] = [{"anchor": [330, 900 + ((n - 1) % 3) * 74],
                         "text": ["반복", "방식", "변화", "문장", "문장"][min(n - 1, 4)],
                         "side": "right"}]
        sp["lines"] = [{"pts": [[90, 1300], [380, 1268 - int(20 * prog)],
                                [700, 1306], [990, 1258 + int(20 * prog)]],
                        "thick": 5}]
        sp["ticks"] = [{"y": 1348, "x0": 90, "x1": 990}]
        sp["strip"] = [("STEP", "%d/%d" % (min(n, act_total), act_total)),
                       ("SCALE", "1:1")]

    elif act == "전":
        sp["chapter"] = (1, 1, "놓치기 쉬운 것")
        sp["chapter_xy"] = (52, 160)
        sp["warns"] = [{"xy": [900, 290], "r": 34}]
        sp["labels"] = [{"anchor": [770, 980 + int(50 * prog)],
                         "text": "같은 뜻일까?", "side": "left", "col": "warn"}]
        sp["arrows"] = [{"p0": [200, 1200], "p1": [560, 1010 + int(50 * prog)],
                         "col": "warn"}]
        sp["strip"] = [("ALERT", "의미 불일치"), ("CHECK", "직무명 != 경력")]
        # 위기 막은 해칭을 촘촘히 = 시각적 긴장 (색 대신 밀도로 긴장을 만든다)
        sp["sections"] = [{"box": [268, 828, 812, 1132], "alpha": 158,
                           "pitch": 52}]

    else:  # 결
        sp["labels"] = [{"anchor": [320, 930], "text": "세 문장", "side": "right"}]
        sp["lines"] = [{"pts": [[120, 1240], [420, 1198 + int(18 * prog)],
                                [720, 1246], [980, 1188]], "thick": 6}]
        sp["strip"] = [("RESULT", "세 문장"), ("NEXT", "이력서 재작성")]
        if b["sid"] == BEATS[-1][1] and seg_i == nseg - 1:
            sp["cta"] = CTA
            sp["cta_y"] = 1668
            sp["cta_pt"] = 46
    return sp


def build():
    """★조립 단위는 sid 그룹 · 합성 단위는 세그먼트★

    나레이션은 sid 단위로 대본 dur 와 일치한다(실측 70/70, 오차<=0.02s).
    영상은 분할 형제(_s1/_s2/...) 로 쪼개져 있으므로 세그먼트마다 합성한 뒤
    이어 붙인다. 오버레이는 세그먼트마다 갱신하고, 자막은 sid 단위로 한 번
    조판한 것을 형제 전체에 그대로 실어 문장이 잘리지 않게 한다.
    """
    beats = plan(verbose=True)
    os.makedirs(WORK + "/ov", exist_ok=True)
    print("\nbuild")

    # 1) 세그먼트별 오버레이 PNG
    act_seen = {}
    act_total = {a: len([b for b in beats if b["act"] == a])
                 for a in ("기", "승", "전", "결")}
    segs_all = []
    total_f = sum(x["frames"] for bb in beats for x in bb["segs"])
    done_f = 0
    for b in beats:
        act_seen[b["act"]] = act_seen.get(b["act"], 0) + 1
        for i, sg in enumerate(b["segs"]):
            # ★영상 전체 기준 누적 진행률★ — 세그먼트 끝 시점 / 총 길이.
            #   frames 합으로 계산하므로 반올림 오차가 없다 (교훈 176 참조).
            done_f += sg["frames"]
            sp = _ov_spec(b, i, len(b["segs"]),
                          act_seen[b["act"]], act_total[b["act"]],
                          gprog=done_f / float(total_f))
            png = "%s/ov/%03d_%s_%d.png" % (WORK, len(segs_all),
                                            sg["jid"], sg["sub"])
            OV.render_spec(sp, png, W, H)
            segs_all.append(dict(jid=sg["jid"], png=png, sid=b["sid"],
                                 act=b["act"], dur=sg["dur"],
                                 f0=sg["f0"], frames=sg["frames"],
                                 sub=sg["sub"]))
    print("  overlays %d" % len(segs_all))

    # 2) ★화면 100%★ — 1280x720 -> 9:16 중앙 크롭 -> 1080x1920 + 오버레이
    #    구운 글자가 없는 컷만 쓰므로(BAKED_SIDS 배제) 좌우 크롭이 승인 글자를
    #    자르지 않는다. 레터박스(화면 31.7%)의 근거는 이 실측으로 소멸했다.
    parts = []
    for i, sg in enumerate(segs_all):
        src = "%s/%s.mp4" % (SRC_DIR, sg["jid"])
        out = "%s/p%03d_%s_%d.mp4" % (WORK, i, sg["jid"], sg["sub"])
        # trim 은 ★프레임 번호★ 로 한다 (초 단위 -ss 는 반올림 오차가 쌓인다)
        # ★색은 의미다 (원리 3 · 76 §12)★ — 벤치마크 팔레트는 「산업 회색 +
        #   네온 시안/틸」이다. 우리 3D 컷은 중성 회색이라 육안으로 밋밋했다
        #   (이 세션 육안 검출. 게이트는 색을 재지 않는다 = 교훈 223/230).
        #   렌더를 다시 돌리지 않고 그레이딩으로 해결한다 = ★크레딧 0★.
        #     colorbalance  그림자/중간톤을 청록으로, 붉은기를 뺀다
        #     eq            콘트라스트를 올려 단면 구조가 읽히게 한다
        #     vignette      시선을 화면 중앙(피사체)으로 모은다
        grade = ("colorbalance=rs=-0.08:gs=0.02:bs=0.12"
                 ":rm=-0.05:gm=0.01:bm=0.06:rh=-0.02:bh=0.04,"
                 "eq=contrast=1.14:brightness=-0.012:saturation=1.05,"
                 "vignette=angle=PI/5.2")
        vf = ("[0:v]trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS,"
              "scale=%d:%d:flags=lanczos,%s,setsar=1[v];"
              "[v][1:v]overlay=0:0:format=auto[o]"
              % (sg["f0"], sg["f0"] + sg["frames"], W, H, grade))
        sh(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", sg["png"],
            "-filter_complex", vf, "-map", "[o]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", str(FPS), out])
        n = nframes(out)
        if n != sg["frames"]:
            raise SystemExit("SEG FRAME MISMATCH %s sub%d: got %d want %d"
                             % (sg["jid"], sg["sub"], n, sg["frames"]))
        print("  %-16s sub%d f%03d+%03d -> %df"
              % (sg["jid"], sg["sub"], sg["f0"], sg["frames"], n))
        parts.append(out)

    lst = "%s/concat.txt" % WORK
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '%s'\n" % os.path.abspath(p))
    silent = "%s/video.mp4" % WORK
    sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", silent])
    nv = nframes(silent)
    print("  video %df = %.3fs" % (nv, nv / float(FPS)))

    # 3) 오디오 — 500초 원본에서 sid 구간을 잘라 붙인다 (★TTS 비용 0★)
    #    영상 길이에 정확히 맞추기 위해 apad 로 늘린 뒤 -t 로 자른다.
    apart = []
    for i, b in enumerate(beats):
        a = "%s/a%02d.wav" % (WORK, i)
        alen = b["adur"]
        sh(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % b["a0"],
            "-t", "%.3f" % alen, "-i", NARR,
            "-af", "apad", "-t", "%.6f" % b["dur"],
            "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", a])
        apart.append(a)
    alst = "%s/aconcat.txt" % WORK
    with open(alst, "w") as f:
        for p in apart:
            f.write("file '%s'\n" % os.path.abspath(p))
    voice = "%s/voice.wav" % WORK
    sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", alst,
        "-c", "copy", voice])
    ad = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                               "format=duration", "-of", "default=nw=1:nk=1",
                               voice], capture_output=True,
                              text=True).stdout.strip())
    print("  voice %.3f s  (video %.3f s  ★delta %.3f★)"
          % (ad, nv / float(FPS), ad - nv / float(FPS)))

    final = "%s/shorts4.mp4" % WORK
    sh(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", voice,
        "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", "-shortest", final])
    print("BUILD OK  %s  %df = %.2fs  %dB"
          % (final, nframes(final), nframes(final) / float(FPS),
             os.path.getsize(final)))
    return final


# ────────────────────────────────────────────────────────────────────────
def gate(path=None):
    """★숏츠 알고리즘 게이트★ — 기존 게이트가 재지 않는 차원 (교훈 230).

    A~F 는 기획(plan) 검사, G~I 는 산출 영상 검사.
    ★조립 단위가 sid 그룹으로 바뀌었으므로 컷 리듬은 세그먼트 단위로 재고,
      비연속성은 sid 단위로 잰다★ (이 세션 정정).
    """
    import numpy as np
    from scipy import ndimage
    from PIL import Image
    path = path or "%s/shorts4.mp4" % WORK
    beats = plan(verbose=False)
    ok = True

    def chk(name, cond, detail=""):
        nonlocal ok
        print("  %-44s %s %s" % (name, "OK  " if cond else "FAIL", detail))
        if not cond:
            ok = False

    print("shorts4.gate  %s" % path)
    # A. 4막이 모두 존재하고 순서가 기승전결인가
    seq = [b["act"] for b in beats]
    order, seen = [], set()
    for a in seq:
        if a not in seen:
            seen.add(a); order.append(a)
    chk("4-act structure present & ordered",
        order == ["기", "승", "전", "결"], str(order))
    # B. 후킹: 첫 막이 t=0 에서 시작하고 3초 이상
    ki = [b for b in beats if b["act"] == "기"]
    chk("hook act starts at t=0", bool(ki) and abs(ki[0]["t0"]) < 1e-6)
    chk("hook act >= 3.0 s", sum(b["dur"] for b in ki) >= 3.0,
        "%.2f s" % sum(b["dur"] for b in ki))
    # C. 총 길이: 벤치마크 실측 대역 (72~82s 를 포함하는 45~95s)
    tot = sum(b["dur"] for b in beats)
    chk("total length 45~95 s (benchmark band)", 45.0 <= tot <= 95.0,
        "%.2f s" % tot)
    # D. ★컷 리듬 — 합성 단위인 세그먼트로 잰다★ (G11 과 동일 물리량)
    segd = [(sg["jid"], round(sg["dur"], 2))
            for b in beats for sg in b["segs"]]
    bad = [x for x in segd if not (RHYTHM_MIN <= x[1] <= RHYTHM_MAX)]
    chk("cut rhythm %.1f~%.1f s (G11, per segment)" % (RHYTHM_MIN, RHYTHM_MAX),
        not bad, "%d segs / bad %s" % (len(segd), str(bad[:4])))
    # E. 같은 sid 를 두 번 쓰지 않는다 (CEO-74 「반복」 재발 방지)
    sids = [b["sid"] for b in beats]
    chk("no sid reused", len(sids) == len(set(sids)), "%d sids" % len(sids))
    # F. ★롱폼 잘라내기 아님★ — 대본 시간축이 단조증가면 그냥 자른 것 (CEO-89)
    a0 = [b["a0"] for b in beats]
    chk("not a contiguous longform slice (CEO-89)", a0 != sorted(a0),
        "audio order non-monotonic = re-planned")
    # F2. 구운 글자 컷 배제 (좌우 크롭 안전)
    chk("no baked-text sid used (crop safe)",
        not [s for s in sids if s in BAKED_SIDS])

    if not os.path.exists(path):
        print("GATE (plan only — video not built yet)")
        return 0 if ok else 1

    # G. 화면 점유 100%
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                         "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", path],
                        capture_output=True, text=True).stdout.strip()
    chk("frame is 1080x1920 (9:16 full)", pr.startswith("1080,1920"), pr)
    # H. 오디오 트랙 존재
    ap = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                         "-show_entries", "stream=codec_name,duration",
                         "-of", "csv=p=0", path],
                        capture_output=True, text=True).stdout.strip()
    chk("audio track present", bool(ap), ap)
    # I. 프레임 추출 → 글자 잘림 + 레터박스 + 광류
    fr = "%s/gate" % WORK
    subprocess.run(["rm", "-rf", fr]); os.makedirs(fr, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", "fps=2",
                    "%s/g_%%04d.png" % fr], capture_output=True)
    fs = sorted(os.listdir(fr))
    chk("gate frames extracted", len(fs) > 10, "%d" % len(fs))
    edge_hits, letterbox = [], []
    prev, flows = None, []
    for fn in fs:
        im = Image.open("%s/%s" % (fr, fn)).convert("RGB")
        a = np.asarray(im).astype(np.int16)
        mx, mn = a.max(axis=2), a.min(axis=2)
        wm = (mx > 170) & ((mx - mn) < 28)
        # ★오탐 방지★ — 이 검사의 대상은 「★우리가 조판한 글자★」다.
        #   배경 3D 컷에도 밝은 회색 판(도면 플레이트)이 있고 그것이 프레임
        #   좌우 끝에 닿는다. 그건 결함이 아니라 승인된 영상 내용이다.
        #   (교훈 199: 게이트는 「불합격을 확실히」 잡아야 하고, 동시에
        #    합격을 불합격으로 만들면 안 된다.)
        #   따라서 오버레이가 글자를 놓는 띠 = 챕터/수치(y<420) + 자막/CTA
        #   (y>1330) 영역만 본다.
        #   ★판별의 정확한 형태★: 우리 글자는 언제나 ★어두운 유리 패널 위★
        #   에 놓인다(glass_panel). 따라서 프레임 좌우 최외곽 열에서 「밝은
        #   회색 = 글자 후보」인 행을 찾은 뒤, 그 행이 ★패널 위에 있는가★ 를
        #   본다. 패널이면 그 행의 x=0..40 평균 휘도가 낮다(어두운 패널).
        #   배경 도면판은 그 반대로 밝다 -> 오탐이 제거된다.
        # ★★교훈 248 (AI 소스 전환에서 검출·시정)★★
        #   구버전은 「어두운 곳의 밝은 무채색 화소」만 봤다. AI 실물해부
        #   배경은 근-검정 대기 + 네온 엣지광이라 ⓐ 화면 중단의 종이 단면
        #   하이라이트 ⓑ 오버레이 HUD 장식선 이 그 조건에 걸려 오탐 10건이
        #   났다 (실측 전부 y 910~1240, 세로 run 1~7px = 글자가 아니라 선).
        #   ⇒ ★형상으로 판별한다★. 프레임 끝에 닿은 「연결성분」을 뽑아
        #      · 글자 띠(y<TEXT_BAND_TOP 또는 y>TEXT_BAND_BOT) 안인가
        #      · 세로 높이 >= GLYPH_H_MIN 인가         (선은 1~7px)
        #      · 가로/세로 < ASPECT_LINE 인가          (선은 비가 극단적)
        #   세 조건을 모두 만족할 때만 「글자가 끝에 닿았다」로 본다.
        #   ★검증 (교훈 236)★ 실제 빌드 116 프레임 오탐 0건 /
        #     인위 주입한 끝접촉 글자(좌·우) 2/2 검출.
        lab, ncc = ndimage.label(wm)
        hit = False
        if ncc:
            for sl_y, sl_x in ndimage.find_objects(lab):
                y0, y1 = sl_y.start, sl_y.stop
                x0, x1 = sl_x.start, sl_x.stop
                if not ((x0 < EDGE_PX) or (x1 > W - EDGE_PX)):
                    continue
                if not ((y1 <= TEXT_BAND_TOP) or (y0 >= TEXT_BAND_BOT)):
                    continue
                gh, gw = y1 - y0, x1 - x0
                if gh < GLYPH_H_MIN:
                    continue
                if gw / float(gh) >= ASPECT_LINE:
                    continue
                hit = True
                break
        if hit:
            edge_hits.append(fn)
        top, bot = a[:40], a[-40:]
        if top.std() < 1.2 and bot.std() < 1.2:
            letterbox.append(fn)
        g = a.mean(axis=2)
        if prev is not None:
            flows.append(float(np.percentile(np.abs(g - prev), 95)))
        prev = g
    chk("no glyph touching left/right edge", not edge_hits, str(edge_hits[:4]))
    chk("no uniform letterbox bands", len(letterbox) <= 2,
        "%d frames" % len(letterbox))
    if flows:
        p50 = float(np.percentile(flows, 50))
        chk("motion: median 0.5s-window p95 >= 1.5", p50 >= 1.5, "%.2f" % p50)
    print("GATE %s" % ("OK" if ok else "FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if cmd == "plan":
        plan(); sys.exit(0)
    elif cmd == "build":
        build(); sys.exit(0)
    elif cmd == "gate":
        sys.exit(gate(sys.argv[2] if len(sys.argv) > 2 else None))
    else:
        raise SystemExit(__doc__)
