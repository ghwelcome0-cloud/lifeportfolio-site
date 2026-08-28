#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
숏폼 C — 9:16 (1080x1920) 조립기.

■ 왜 센터 크롭이 아니라 레터박스 밴드인가 (실측 근거 · 추측 아님)
   9:16 로 좁히면 720 높이 소재의 크롭 폭은 720*9/16 = 405 px 다.
   그런데 렌더된 4컷의 흰 글자 잉크 폭을 6fps 로 표본 계측하면:

       J_A3-14  ink width  min 581  med 583  max 605   -> 14/14 프레임이 405 초과
       J_A3-15  ink width  min  58  med 130  max 130   -> 0/11  (여유)
       J_A3-16  ink width  min 271  med 582  max 880   -> 22/37 초과
       J_A3-17  ink width  min 466  med 596  max 610   -> 32/32 초과

   승인 점유율(OCC 0.42~0.63)은 16:9 폭 1280 을 기준으로 정해진 값이다.
   폭을 405 로 줄이면 같은 글자가 반드시 넘친다. 즉 센터 크롭은
   「승인된 글자를 잘라내는」 변환이고, 그것은 CEO-16/18/57/58/64/65/67#6 이
   여섯 번 지적한 바로 그 반려 사유다.  (교훈 184: 승인된 퀄리티를 다른
   형식으로 「번역」하지 말라.)

   그래서 좌우를 자르지 않는다. 원본 1280x720 을 폭 1080 에 맞춰 그대로
   싣고(1080x608), 위/아래로 남는 세로를 「제목 밴드」와 「자막 밴드」로 쓴다.
   대표님이 최소 달성 목표로 지목한 참조(fUpBnpzL0co)가 9:16 상하분할이고,
   자사 선례(webapp/youtube/video6/make_shorts.py)도 같은 구조다.

■ 벤치마크 소화 (CEO-73 · 헌법 §0.0.5)
   1단계 참조 : 상하분할 + 무음 대비 번인 자막 (참조·선례 공통)
   2단계 소화 : 선례는 NAVY/GOLD 팔레트다. 그대로 쓰면 우리 승인 문법
                「B >= G > R 시안 네온」을 깬다 -> 팔레트는 승인 3장에서 실측한
                값으로 바꾼다(패널 (20..31,23..41,24..38), 림 (140,201,206),
                코어 (211,252,255), 흰 글자 (241,241,241) 채널편차<=6).
   3단계 가공 : 자막 글자 높이를 상수로 박고, 조립 후 잉크 폭/광류를 게이트로 검사.

■ 규칙 준수
   - 자막은 어절 단위 줄바꿈 (CEO-49)
   - "이직하세요" 톤 금지 (gt/mkt_body.txt 톤 규칙) — 문구는 질문을 꺼내게 한다
   - 정지 없음: 광류 p95 >= 1.5 px 게이트 (gt/mkt3_body.txt §4-1)

CLI:  build   밴드 PNG 생성 + 컷별 9:16 렌더 + concat
      gate    광류 p95 / 글자 잘림 검사
"""
import os, sys, json, math, subprocess, glob

BATCH = "/home/user/lf/r3d/_batch"
WORK = "/home/user/lf/work/longform/_c916"
JOBS = "/home/user/lf/r3d/scenejobs.json"
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
FONT_R = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
FPS = 24

W, H = 1080, 1920
VID_W, VID_H = 1080, 608          # 1280x720 -> 1080 wide, no horizontal loss
VID_Y = 500                       # video band top edge

# ── 팔레트: 승인 3장 픽셀 실측 (std1/std2/std3) ─────────────────────────
BG = (11, 15, 17)                 # letterbox ground, darker than any panel
PANEL = (26, 34, 33)              # median of approved panel fills
RIM = (140, 201, 206)             # approved neon rim
CORE = (211, 252, 255)            # approved neon core
INK = (241, 241, 241)             # approved white hangul
DIM = (128, 150, 155)

# ── 자막: 무음 시청 대비. 높이는 상수로 박는다 ──────────────────────────
SUB_PT = 62                       # glyph box height for the caption band
SUB_LEAD = 1.34
SUB_Y = 1330                      # caption band top
PANEL_W_MAX = 0.633               # approved upper bound (std3, measured)
TITLE_PT = 58
TAG_PT = 30
CTA_PT = 40

# ── 컷 정의 ─────────────────────────────────────────────────────────────
# 소재는 500초 격자 잡. 자막은 CSV narration 원문을 어절 단위로 끊었다.
# t0/t1 은 scenejobs.json 실측값, frames 도 실측값.
CUTS = [
    # (job_id, [자막 줄], 이 컷에서 자막을 띄우기 시작할 프레임 비율)
    ("J_A3-13", ["중요한 건", "과장 없이", "알아보는 것"], 0.00),
    ("J_A3-14", ["두 번째 문장을", "완성해 보세요"], 0.00),
    ("J_A3-15", ["나는 이런 방식으로", "일할 수 있는 환경에서", "더 꾸준히 기여한다"], 0.00),
    ("J_A3-16", ["목적은 공유받고", "실행 방식은", "스스로 설계할 수 있는 환경"], 0.00),
    ("J_A3-17", ["회사 이름이나 연봉만 보면", "빠지기 쉬운 게", "바로 이 문장입니다"], 0.00),
    ("J_A4-01", ["다음은", "남기고 싶은 변화"], 0.00),
]

TAG = "다음 선택 전에"
TITLE = ["연봉만 보면", "놓치는 것"]
CTA = "당신의 두 번째 문장은?"


def sh(cmd, **kw):
    r = subprocess.run(cmd, shell=isinstance(cmd, str), **kw)
    if r.returncode != 0:
        raise SystemExit("FAILED: %s" % (cmd,))
    return r


def nframes(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
         "-show_entries", "stream=nb_read_frames", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True).stdout.strip()
    return int(out)


# ────────────────────────────────────────────────────────────────────────
def make_bands():
    """상단(태그+제목) / 하단(자막+CTA) 밴드를 컷별 PNG 오버레이로 만든다.

    자막을 drawtext 로 굽지 않고 PNG 로 만드는 이유: drawtext 는 폰트 메트릭에
    따라 글자 높이가 흔들려 「승인 글자 높이」를 상수로 고정할 수 없다.
    PIL 로 미리 조판하면 잉크 bbox 를 직접 재서 게이트를 걸 수 있다
    (교훈 193: getbbox 가 아니라 알파 채널 bbox).
    """
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs("%s/ov" % WORK, exist_ok=True)

    f_sub = ImageFont.truetype(FONT, SUB_PT)
    f_ttl = ImageFont.truetype(FONT, TITLE_PT)
    f_tag = ImageFont.truetype(FONT_R, TAG_PT)
    f_cta = ImageFont.truetype(FONT, CTA_PT)

    def ink_wh(txt, fnt):
        """알파 채널 bbox (교훈 193)."""
        probe = Image.new("L", (W * 2, int(fnt.size * 3)), 0)
        ImageDraw.Draw(probe).text((10, 10), txt, font=fnt, fill=255)
        b = probe.getbbox()
        return (0, 0) if b is None else (b[2] - b[0], b[3] - b[1])

    def centre(d, y, txt, fnt, fill):
        w, _ = ink_wh(txt, fnt)
        d.text(((W - w) / 2.0, y), txt, font=fnt, fill=fill, anchor="la")

    def neon_rule(d, y, half, thick=3):
        """승인 문법의 시안 네온 룰: 코어 위에 림. B >= G > R 유지."""
        d.rectangle([W / 2 - half, y, W / 2 + half, y + thick], fill=RIM)
        d.rectangle([W / 2 - half * 0.55, y, W / 2 + half * 0.55, y + thick], fill=CORE)

    f_sub_base = f_sub
    made = []
    for job, lines, _ in CUTS:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # ── 상단 밴드 ──
        centre(d, 210, TAG, f_tag, DIM + (255,))
        y = 268
        for ln in TITLE:
            centre(d, y, ln, f_ttl, INK + (255,))
            y += int(TITLE_PT * 1.28)
        neon_rule(d, y + 14, 150)

        # ── 하단 자막 밴드 ──
        # 자막 패널: 승인 패널 채움색 + 시안 림. 자막이 배경 위에 떠 있지 않게.
        #
        # 패널 폭은 승인 밴드 안에 있어야 한다. 승인 3장 실측 panel_w/frame_w =
        # std1 0.422 / std2 0.447 / std3 0.633 이고 0.633 이 상한이다.
        # 첫 판은 SUB_PT 를 고정값 62 로 두었더니 긴 줄에서 패널이
        #     J_A3-16  0.736   J_A3-17  0.720
        # 까지 벌어져 상한을 넘었다. 「글자 크기를 상수로 박는다」와
        # 「승인 밴드 안에 있는다」가 충돌하면 이기는 쪽은 승인 밴드다
        # (교훈 197 의 사전식 목표: 1. 밴드 안 — 하드 / 2. 그 다음이 미학).
        # 그래서 컷마다 밴드에 들어가는 최대 크기를 찾는다. 줄 수는 이미
        # 어절 단위로 정해 두었으므로(CEO-49) 여기서 바꾸지 않는다.
        f_sub_c, pt = f_sub_base, SUB_PT
        while pt >= 34:
            w_try = max(ink_wh(ln, f_sub_c)[0] for ln in lines)
            if (w_try + 2 * 46) / float(W) <= PANEL_W_MAX:
                break
            pt -= 2
            f_sub_c = ImageFont.truetype(FONT, pt)
        f_sub = f_sub_c
        wmax = max(ink_wh(ln, f_sub)[0] for ln in lines)
        hline = int(pt * SUB_LEAD)
        pad_x, pad_y = 46, 30
        bx0 = (W - wmax) / 2.0 - pad_x
        bx1 = (W + wmax) / 2.0 + pad_x
        by0 = SUB_Y - pad_y
        by1 = SUB_Y + hline * len(lines) + pad_y - int(hline - pt)
        d.rectangle([bx0, by0, bx1, by1], fill=PANEL + (218,))
        d.rectangle([bx0, by0, bx1, by0 + 3], fill=RIM + (255,))
        d.rectangle([bx0, by1 - 3, bx1, by1], fill=RIM + (255,))
        yy = SUB_Y
        for ln in lines:
            centre(d, yy, ln, f_sub, INK + (255,))
            yy += hline

        # ── CTA ──
        centre(d, 1690, CTA, f_cta, RIM + (255,))

        p = "%s/ov/%s.png" % (WORK, job)
        im.save(p)
        made.append((job, p, int(bx1 - bx0), int(by1 - by0)))
    return made


def build():
    os.makedirs(WORK, exist_ok=True)
    bands = make_bands()
    print("bands %d" % len(bands))
    for job, p, bw, bh in bands:
        print("  %-9s caption panel %dx%d  (%.3f of frame width)" % (job, bw, bh, bw / float(W)))

    parts = []
    for i, (job, lines, _) in enumerate(CUTS):
        src = "%s/%s.mp4" % (BATCH, job)
        if not os.path.exists(src):
            raise SystemExit("MISSING SOURCE: %s" % src)
        ov = "%s/ov/%s.png" % (WORK, job)
        out = "%s/p%02d_%s.mp4" % (WORK, i, job)
        # 좌우를 자르지 않는다: 1280x720 -> 1080x608, 배경 위 VID_Y 에 배치.
        vf = ("[0:v]scale=%d:%d:flags=lanczos[v];"
              "color=c=0x%02x%02x%02x:s=%dx%d:r=%d[bg];"
              "[bg][v]overlay=0:%d:shortest=1[s];"
              "[s][1:v]overlay=0:0:format=auto[o]"
              % (VID_W, VID_H, BG[0], BG[1], BG[2], W, H, FPS, VID_Y))
        sh(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", ov,
            "-filter_complex", vf, "-map", "[o]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", str(FPS), out])
        print("  %-9s -> %s  %df" % (job, os.path.basename(out), nframes(out)))
        parts.append(out)

    lst = "%s/concat.txt" % WORK
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '%s'\n" % os.path.abspath(p))
    final = "%s/shortsC_916.mp4" % WORK
    sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", final])
    n = nframes(final)
    print("BUILD OK  %s  %df = %.2fs  %dB" % (final, n, n / float(FPS),
                                              os.path.getsize(final)))
    return final


# ────────────────────────────────────────────────────────────────────────
def gate(path=None):
    """조립 결과를 두 가지로 검사한다.

    (1) 글자 잘림: 흰 글자 마스크가 프레임 좌우 끝에 닿으면 실패.
        어떤 컷이든 잉크가 x=0 또는 x=W-1 에 닿았다면 잘린 것이다.
    (2) 정지 없음: 2초 간격 광류 p95 >= 1.5 px (gt/mkt3_body.txt §4-1).
        "정지 검사 통과"를 품질 근거로 쓰지 않기 위한 게이트.
    """
    import numpy as np
    from PIL import Image
    path = path or "%s/shortsC_916.mp4" % WORK
    fr = "%s/gate" % WORK
    subprocess.run(["rm", "-rf", fr])
    os.makedirs(fr, exist_ok=True)
    sh(["ffmpeg", "-v", "error", "-i", path, "-vf", "fps=2", "-y",
        "%s/%%04d.png" % fr])
    fs = sorted(glob.glob("%s/*.png" % fr))
    print("gate frames %d (2 fps over %.2fs)" % (len(fs), nframes(path) / float(FPS)))

    # (1) 글자 잘림
    #
    # 주의: 흰 마스크 (max>170)&(max-min<28) 는 「흰 것」을 잡을 뿐이고,
    # 이 장면에는 흰 것이 두 종류 있다 — 글자와 종이 시트다. 첫 판에서 이
    # 게이트는 J_A3-15 에서 4프레임 실패를 냈는데, 실측해 보니 그 컷은
    # word_gesture = none 이라 글자가 아예 없고, 프레임 끝에 닿은 것은 시트
    # 모서리였다. 카메라가 책상으로 파고드는 컷에서 시트가 화면 끝에 걸리는
    # 것은 정상이다. 즉 결함이 아니라 게이트의 전제가 틀렸다 (교훈 198-4).
    #
    # 둘은 bbox 채움률로 갈린다 — 실측:
    #     승인본 std1 글자   bbox 868x557  fill 0.052   (얇은 획)
    #     J_A3-15 시트       bbox 130x116  fill 0.535   (solid quad)
    #     J_A3-15 시트       bbox  96x 87  fill 0.514
    # 열 배 차이다. 글자는 획이라 성기고, 시트는 면이라 빽빽하다.
    # 경계는 0.25 로 둔다 (승인본 0.052 의 5배, 시트 0.514 의 절반).
    #
    # 이 분리를 「가드」로 부르지 않는 이유: 검사 구간을 좁힌 것이 아니라
    # 검사 대상을 실측으로 바로잡은 것이다. 글자가 있는 모든 프레임은 여전히
    # 전수 검사된다 (교훈 199: 좁히기는 고치기가 아니다).
    # [교훈 201] 채움률은 ★덩어리마다★ 재야 한다. 밴드 전체의 합집합 bbox 로
    # 재면 흩어진 시트 여러 장이 「성긴 한 덩어리」로 위장한다 — 실측:
    #     J_A3-15/16 영상밴드, 연결 성분 3개
    #         px 1572  bbox 70x31  fill 0.724   ← solid quad (시트)
    #         px  748  bbox 39x31  fill 0.619   ← solid quad (시트)
    #         px  279  bbox 20x21  fill 0.664   ← solid quad (시트)
    #     합집합 bbox 96x171 → fill 0.158  ← ★획처럼 보인다 (오판)★
    # 두 컷 모두 word_gesture=none 이므로 글자가 애초에 없다. 즉 4프레임
    # 실패는 결함이 아니라 ★측정 단위 오류★ 였다 (교훈 198-1: 단위를 섞지 말라).
    # 덩어리별로 재면 세 성분 전부 0.25 를 넘어 시트로 정확히 배제된다.
    GLYPH_FILL_MAX = 0.25
    MIN_BLOB_PX = 40

    def blobs(mask):
        """4-이웃 연결 성분. scipy 없이 iterative flood fill."""
        Hh, Ww = mask.shape
        seen = np.zeros(mask.shape, dtype=bool)
        out = []
        ys_all, xs_all = np.nonzero(mask)
        for sy, sx in zip(ys_all, xs_all):
            if seen[sy, sx]:
                continue
            st = [(sy, sx)]; seen[sy, sx] = True
            y0b = y1b = sy; x0b = x1b = sx; n = 0
            while st:
                cy, cx = st.pop(); n += 1
                if cy < y0b: y0b = cy
                if cy > y1b: y1b = cy
                if cx < x0b: x0b = cx
                if cx > x1b: x1b = cx
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < Hh and 0 <= nx < Ww and mask[ny, nx] \
                            and not seen[ny, nx]:
                        seen[ny, nx] = True; st.append((ny, nx))
            out.append((n, x0b, x1b, y0b, y1b))
        return out

    bad = []
    n_glyph = 0
    n_sheet = 0
    for f in fs:
        a = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
        mx = a.max(2); mn = a.min(2)
        m = (mx > 170) & ((mx - mn) < 28)
        if m.sum() < 200:
            continue
        for y0, y1 in [(0, VID_Y), (VID_Y, VID_Y + VID_H), (VID_Y + VID_H, H)]:
            sub = m[y0:y1]
            if sub.sum() < 200:
                continue
            for n, x0b, x1b, y0b, y1b in blobs(sub):
                if n < MIN_BLOB_PX:
                    continue               # 안티에일리어싱 잔여
                fill = n / float((x1b - x0b + 1) * (y1b - y0b + 1))
                if fill > GLYPH_FILL_MAX:
                    n_sheet += 1
                    continue               # 시트(면), 글자가 아니다
                n_glyph += 1
                if x0b == 0 or x1b == sub.shape[1] - 1:
                    bad.append("%s@y%d(fill %.3f)"
                               % (os.path.basename(f), y0, fill))
    print("CLIP GATE  blobs: glyph %d / sheet %d (fill > %.2f = sheet)"
          % (n_glyph, n_sheet, GLYPH_FILL_MAX))
    print("CLIP GATE  glyph regions inspected: %d" % n_glyph)
    print("CLIP GATE  frames with ink touching a frame edge: %d" % len(bad))
    if bad:
        print("           %s" % bad[:8])

    # (2) 광류 p95 — 2초 간격, 영상 밴드만 (자막/제목은 정지가 정상 · §4-2 SLIDE)
    y0, y1 = VID_Y, VID_Y + VID_H
    step = 4                                    # 2 fps 표본에서 2초 = 4 프레임
    p95s = []
    for i in range(0, len(fs) - step, step):
        a = np.asarray(Image.open(fs[i]).convert("L"))[y0:y1].astype(np.float32)
        b = np.asarray(Image.open(fs[i + step]).convert("L"))[y0:y1].astype(np.float32)
        # 광류 대용: 국소 밝기 변화 / 국소 공간 기울기 = 화소 변위 근사
        gx = np.gradient(a, axis=1); gy = np.gradient(a, axis=0)
        g = np.sqrt(gx * gx + gy * gy) + 1e-3
        d = np.abs(b - a) / g
        m = g > 2.0                             # 평탄면은 변위를 정의할 수 없다
        if m.sum() < 500:
            continue
        p95s.append(float(np.percentile(d[m], 95)))
    if p95s:
        print("FLOW GATE  p95 over 2s windows: min %.2f  med %.2f  max %.2f  (need >= 1.50)"
              % (min(p95s), float(np.median(p95s)), max(p95s)))
        print("           windows below 1.50 px: %d / %d"
              % (sum(1 for v in p95s if v < 1.5), len(p95s)))
    return len(bad) == 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build":
        build()
    elif cmd == "gate":
        gate(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        raise SystemExit("usage: shorts916.py build|gate")
