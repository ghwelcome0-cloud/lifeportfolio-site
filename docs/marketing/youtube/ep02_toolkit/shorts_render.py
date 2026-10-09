import json, re, sys, math, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
O = '/home/user/ax-work/shorts/s3/'; SRC = '/home/user/ax-work/shorts/src/'; P = '/home/user/ax-work/content/promo/'
W, H, FPS = 1080, 1920, 30
WD = json.load(open(O + 'words.json'))
VO_END = WD[-1]['e']; TOTAL = round(VO_END + 2.3, 2)
H_ = lambda s: re.sub(r'[^가-힣0-9%]', '', s)
def at(ph, after=0.0):
    k = H_(ph)
    for i, w in enumerate(WD):
        if w['s'] >= after and H_(''.join(x['t'] for x in WD[i:i + 3])).startswith(k): return w['s']
    raise SystemExit('nf ' + ph)
FD = '/home/user/diary-wt/assets/fonts/pretendard/'; SER = '/usr/share/fonts/truetype/nanum/NanumMyeongjoExtraBold.ttf'
F = lambda p, s: ImageFont.truetype(p, s)
PB, PX, PS, PM = FD + 'Pretendard-Bold.woff2', FD + 'Pretendard-ExtraBold.woff2', FD + 'Pretendard-SemiBold.woff2', FD + 'Pretendard-Medium.woff2'
GOLD = (201, 160, 79); CREAM = (255, 251, 240); INK = (23, 33, 43); GREEN = (11, 59, 42)
def rgba(im): return np.asarray(im).astype(np.float32)
def over(f, L, x, y, a=1.0):
    if a <= .003: return
    h, w = L.shape[:2]; x, y = int(x), int(y); x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    l = L[y0 - y:y1 - y, x0 - x:x1 - x]; al = l[:, :, 3:4] / 255 * a
    f[y0:y1, x0:x1] = f[y0:y1, x0:x1] * (1 - al) + l[:, :, 2::-1] * al
def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def shadow_text(lines, fnt, fill, gap=16, stroke=0, center=True, w=W - 120):
    lh = fnt.size + gap; hgt = lh * len(lines) + 40
    im = Image.new('RGBA', (w, hgt), (0, 0, 0, 0)); sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(im), ImageDraw.Draw(sh)
    for i, l in enumerate(lines):
        tw = fnt.getbbox(l)[2]; x = (w - tw) // 2 if center else 0
        ds.text((x + 3, 20 + i * lh + 5), l, font=fnt, fill=(0, 0, 0, 200))
        d.text((x, 20 + i * lh), l, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(10)); sh.alpha_composite(im); return rgba(sh)

# ---------- moving plates (AI video) ----------
def load_frames(n):
    import glob
    return [cv2.imread(p) for p in sorted(glob.glob(SRC + f'fr_{n}/*.jpg'))]
FR = {'shelf': load_frames('shelf'), 'diary': load_frames('diary')}
def plate(n, t, t0, speed=1.0, dark=1.0):
    fr = FR[n]; N = len(fr); k = (t - t0) * 24 * speed; per = 2 * (N - 1)
    k = k % per; k = per - k if k > N - 1 else k
    i = int(k); a = k - i; j = min(N - 1, i + 1)
    f = cv2.addWeighted(fr[i], 1 - a, fr[j], a, 0).astype(np.float32)
    return f * dark

# ---------- timeline ----------
T_HOOK_END = at('연구'); T_1 = at('하나'); T_2 = at('둘'); T_3 = at('셋'); T_SO = at('그래서'); T_BRAND = at('인생')
T_138 = at('138편의'); T_23 = at('23%'); T_238 = at('238명의'); T_7 = at('일곱'); T_DIRECT = at('직접')
SCENES = [  # (t0, t1, plate, speed, dark)
    (0.0, T_1, 'shelf', 1.0, .78),
    (T_1, T_2, 'diary', .75, .55),
    (T_2, T_3, 'shelf', .6, .5),
    (T_3, T_SO, 'diary', .6, .5),
]
print('times', dict(hook=T_HOOK_END, s1=T_1, s2=T_2, s3=T_3, so=T_SO, brand=T_BRAND, total=TOTAL))

# ---------- overlays ----------
HOOK = shadow_text(['적기만 해도', '달라질까요?'], F(SER, 120), (255, 255, 255, 255), gap=26)
HOOK_SUB = shadow_text(['연구 3개로 확인해 보세요'], F(PB, 52), GOLD + (255,))
def chip(n):
    im = Image.new('RGBA', (W - 120, 90), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = (W - 120 - 3 * 92 - 2 * 20) // 2
    for i in range(3):
        on = i < n; d.rounded_rectangle((x + i * 112, 18, x + i * 112 + 92, 72), 27, fill=(GOLD + (255,)) if on else (255, 255, 255, 70))
        d.text((x + i * 112 + 46, 45), str(i + 1), font=F(PX, 36), fill=GREEN + (255,) if on else (255, 255, 255, 220), anchor='mm')
    return rgba(im)
CHIPS = [chip(i) for i in range(4)]

def card(kicker, big_fmt, lines, src, w=940):
    """returns function(value_text)->RGBA array of card"""
    cache = {}
    def mk(val):
        if val in cache: return cache[val]
        im = Image.new('RGBA', (w, 760), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w - 1, 759), 38, fill=CREAM + (248,)); d.rectangle((0, 40, 12, 720), fill=GOLD + (255,))
        d.text((60, 54), kicker, font=F(PB, 40), fill=GOLD + (255,))
        d.text((56, 112), big_fmt.format(val), font=F(SER, 168), fill=GREEN + (255,))
        y = 330
        for l in lines: d.text((60, y), l, font=F(PS, 50), fill=INK + (255,)); y += 72
        d.text((60, y + 26), src, font=F(PM, 30), fill=(120, 116, 104, 255)); y += 96
        im = im.crop((0, 0, w, y + 20)); m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, y + 19), 38, fill=255)
        c = Image.new('RGBA', im.size, (0, 0, 0, 0)); c.paste(im, (0, 0), m)
        sh = Image.new('RGBA', (w + 100, c.height + 100), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((50, 66, w + 50, c.height + 66), 38, fill=(0, 0, 0, 150))
        sh = sh.filter(ImageFilter.GaussianBlur(22)); sh.alpha_composite(c, (50, 50)); cache[val] = rgba(sh); return cache[val]
    return mk
C1 = card('연구 1 · 실험 138편을 모은 분석', '{}편', ['진행을 점검할수록', '목표에 더 가까이.', '직접 적으면 효과가 더 컸습니다.'], 'Harkin 외 (2016) Psychological Bulletin')
C2 = card('연구 2 · 하루 15분 글로 돌아보기', '+{}%', ['계속 교육만 받은 동료보다', '최종 평가가 약 23% 높았습니다.', '(신입 직원 대상 현장 실험)'], 'Di Stefano 외, HBS Working Paper 14-093')
C3 = card('연구 3 · 238명의 업무 일지', '10일 중 {}일', ['기분이 가장 좋았던 날,', '열에 일곱 이상은', '일이 조금이라도 나아간 날.'], 'Amabile & Kramer (2011) The Progress Principle')
def dots(n_on, p):
    im = Image.new('RGBA', (W - 120, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = 34; gap = 22; x0 = (W - 120 - (10 * 2 * r + 9 * gap)) // 2
    for i in range(10):
        cx = x0 + r + i * (2 * r + gap); on = i < n_on
        d.ellipse((cx - r, 60 - r, cx + r, 60 + r), fill=(GOLD + (255,)) if on else (255, 255, 255, 60), outline=(255, 255, 255, 160), width=3)
    return rgba(im)
DOTS = [dots(i, 0) for i in range(11)]

# screen & phone
def phone(name, wpx=620):
    im = cv2.imread(P + name + '.png'); s = wpx / im.shape[1]; im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    h, w = im.shape[:2]; bz = 22; R = 70
    def ra(h, w, r):
        m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
        for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
        return m
    out = np.zeros((h + 2 * bz, w + 2 * bz, 4), np.float32); out[:, :, :3] = 18; out[:, :, 3] = ra(h + 2 * bz, w + 2 * bz, R)
    ia = ra(h, w, R - bz)[:, :, None] / 255; sl = out[bz:bz + h, bz:bz + w]; sl[:, :, :3] = sl[:, :, :3] * (1 - ia) + im * ia
    o = np.zeros_like(out); o[:, :, :3] = out[:, :, 2::-1]; o[:, :, 3] = out[:, :, 3]; return o  # to RGBA order for over()
PH_WEEK = phone('m-week'); PH_FAB = phone('m-fab')
SO_TXT = shadow_text(['그래서 이 원리를,', '한 권에 담았습니다'], F(SER, 84), (255, 255, 255, 255), gap=22)
END_T1 = shadow_text(['인생포트폴리오'], F(PB, 50), GOLD + (255,))
END_T2 = shadow_text(['「내 다이어리」 출시'], F(SER, 96), (255, 255, 255, 255))
END_T3 = shadow_text(['홈페이지 맨 위  ›  내 다이어리'], F(PS, 46), (255, 255, 255, 235))
DISC2 = shadow_text(['실제 서비스 화면 · 예시 계정'], F(PM, 30), (255, 255, 255, 210))
DISC = shadow_text(['배경: AI 설명용 시각화 · 화면: 실제 서비스 (예시 계정)'], F(PM, 28), (255, 255, 255, 200))

# captions: phrase groups (max ~14 chars), burned in, big
groups = []; buf = []
for w in WD:
    buf.append(w); L = len(' '.join(b['t'] for b in buf))
    if w['t'].endswith(('.', '?', ',')) or L >= 12: groups.append(buf); buf = []
if buf: groups.append(buf)
CAPF = F(PX, 64)
def cap_layer(txt):
    tw = CAPF.getbbox(txt)[2]; im = Image.new('RGBA', (tw + 80, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((40, 20), txt, font=CAPF, fill=(255, 255, 255, 255), stroke_width=7, stroke_fill=(10, 10, 10, 255)); return rgba(im)
CAPS = []
for g in groups:
    txt = ' '.join(x['t'] for x in g).rstrip('.')
    CAPS.append((g[0]['s'], g[-1]['e'] + .12, cap_layer(txt)))
for i in range(len(CAPS) - 1): CAPS[i] = (CAPS[i][0], min(CAPS[i][1], CAPS[i + 1][0]), CAPS[i][2])

def compose(t):
    # background
    if t < T_SO:
        sc = [s for s in SCENES if s[0] <= t < s[1]][0]; f = plate(sc[2], t, sc[0], sc[3], sc[4])
        prev = [s for s in SCENES if s[1] <= t and t - s[1] < .35]
        if prev and t >= .35:
            p = prev[-1]; a = ease((t - p[1]) / .35); f = plate(p[2], t, p[0], p[3], p[4]) * (1 - a) + f * a
    else:
        f = plate('diary', t, T_SO, .5, .42)
    # hook
    if t < T_1 + .3:
        a = ease(1 - (t - T_HOOK_END) / .45) if t > T_HOOK_END else 1.0
        over(f, HOOK, 60, 360 - (0 if t > .25 else (1 - ease(t / .25)) * 30), a)
        sa = ease((t - .5) / .3) * a; over(f, HOOK_SUB, 60, 700, sa)
    # chips
    if T_HOOK_END - .1 < t < T_SO:
        n = 0 if t < T_1 else (1 if t < T_2 else (2 if t < T_3 else 3)); over(f, CHIPS[n], 60, 250, ease((t - T_HOOK_END) / .3))
    # cards
    def show(C, t0, t1, val):
        a = ease((t - t0) / .35) * ease((t1 - t) / .3); over(f, C(val), (W - 1040) / 2, 400 + (1 - ease((t - t0) / .45)) * 60, a)
    if T_1 - .05 < t < T_2:
        v = int(round(138 * ease((t - T_1 - .15) / 1.0))); show(C1, T_1, T_2, str(max(1, v)))
    if T_2 - .05 < t < T_3:
        v = int(round(23 * ease((t - T_2 - .15) / 1.0))); show(C2, T_2, T_3, str(v))
    if T_3 - .05 < t < T_SO:
        n = 0 if t < T_7 - .9 else min(7, int((t - (T_7 - .9)) / .13) + 1); show(C3, T_3, T_SO, '7')
        over(f, DOTS[n], 60, 1150, ease((t - T_3) / .35) * ease((T_SO - t) / .3))
    # finale: phone + so text + end card
    if t >= T_SO - .1:
        a = ease((t - T_SO) / .4)
        y = 820 + (1 - ease((t - T_SO) / .6)) * 120 - max(0, t - T_SO) * 6
        over(f, PH_WEEK if t < T_BRAND else PH_FAB, (W - PH_WEEK.shape[1]) / 2, y, a)
        if t < T_BRAND: over(f, SO_TXT, 60, 330, a)
        else:
            b = ease((t - T_BRAND) / .35)
            over(f, END_T1, 60, 250, b); over(f, END_T2, 60, 320, b); over(f, END_T3, 60, 500, ease((t - T_BRAND - .5) / .35))
    if t >= T_SO - .1: over(f, DISC2, 60, 150, .9 * ease((t - T_SO) / .4))
    for a0, a1, L in CAPS:
        if a0 <= t < a1 and T_HOOK_END - .05 <= t < T_SO - .05:
            over(f, L, (W - L.shape[1]) / 2, 1300 - (0 if t - a0 > .08 else (1 - (t - a0) / .08) * 12)); break
    return np.clip(f, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    if sys.argv[1] == 'stills':
        for t in [float(x) for x in sys.argv[2].split(',')]: cv2.imwrite(f'/tmp/sh_{t:05.2f}.jpg', compose(t), [cv2.IMWRITE_JPEG_QUALITY, 85])
    else:
        a0, a1, outp = float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', O + outp], stdin=subprocess.PIPE)
        for n in range(int(round(a0 * FPS)), int(round(min(a1, TOTAL) * FPS))): p.stdin.write(compose(n / FPS).tobytes())
        p.stdin.close(); p.wait(); print('DONE', TOTAL)
