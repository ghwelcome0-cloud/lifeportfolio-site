# EP.04 longform renderer (밝힘 · 윤서) — EP.03 engine + documentary tags (time/place, name, week chips)
#  - All backgrounds are real-motion Seedance clips (real-space building world)
#  - NEW (EP.03): "matchmove insert" - real service screens are pinned onto tracked physical
#    surfaces inside the moving footage (planar homography from KLT+RANSAC, tk/track.py),
#    then light-matched (plate luminance gradient), grained and light-wrapped, so screen and space
#    share one camera, one light, one grain. Then a seamless push-in "dives" into the page.
#  - Screen focus shots keep EP.02 grammar: keyframed zoom/pan, spotlight + gold ring, page turn.
#  - Text / cards / subtitles are deterministic overlays (supersampled).
import json, re, sys, math, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
B = '/home/user/ax-work/yt-ep04/'
A = '/home/user/ax-work/yt-ep04/screens/'
FPS, W, H, OFF, HOLD = 30, 1920, 1080, 1.0, 10.0
TM = json.load(open(B + 'build/timing.json'))
WD, ST = TM['words'], TM['starts']
SEC = [WD[i]['s'] + OFF for i in ST]
VO_END = TM['vo_end'] + OFF
TOTAL = VO_END + HOLD
SEC_END = SEC[1:] + [VO_END]
NSEC = len(SEC)
H_ = lambda s: re.sub(r'[^가-힣0-9]', '', s)

def at(si, phrase, nth=1):
    a = ST[si]; b = ST[si + 1] if si + 1 < len(ST) else len(WD)
    ks = [H_(p) for p in phrase.split('|')]; c = 0
    for i in range(a, b):
        if any(H_(''.join(w['t'] for w in WD[i:i + 4])).startswith(k) for k in ks):
            c += 1
            if c == nth: return WD[i]['s'] + OFF
    raise SystemExit(f'phrase not found S{si+1}: {phrase}')

FD = '/home/user/diary-wt/assets/fonts/pretendard/'
def font(n, s): return ImageFont.truetype(n, s)
SERIF = '/usr/share/fonts/truetype/nanum/NanumMyeongjoExtraBold.ttf'
PB, PS, PM, PR = FD + 'Pretendard-Bold.woff2', FD + 'Pretendard-SemiBold.woff2', FD + 'Pretendard-Medium.woff2', FD + 'Pretendard-Regular.woff2'
GOLD = (201, 160, 79); TEAL = (70, 141, 132); CREAM = (255, 251, 240); INK = (23, 33, 43); GREEN = (11, 59, 42)
def rgba(img): return np.asarray(img).astype(np.float32)

def text_layer(lines, fnt, fill, shadow=True, spacing=14, pad=20):
    ws = [fnt.getbbox(l)[2] for l in lines]; lh = fnt.size + spacing
    im = Image.new('RGBA', (max(ws) + pad * 2, lh * len(lines) + pad * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
        for i, l in enumerate(lines): ds.text((pad + 2, pad + i * lh + 3), l, font=fnt, fill=(0, 0, 0, 170))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(6))); d = ImageDraw.Draw(im)
    for i, l in enumerate(lines): d.text((pad, pad + i * lh), l, font=fnt, fill=fill)
    return im

SUBF = font(PS, 44)
def sub_layer(lines):
    lh = 60; ws = [SUBF.getbbox(l)[2] for l in lines]; w = max(ws) + 56; h = lh * len(lines) + 26
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=(10, 14, 18, 150))
    for i, l in enumerate(lines): d.text(((w - ws[i]) // 2, 12 + i * lh), l, font=SUBF, fill=(255, 255, 255, 255))
    return im
CUES = json.load(open(B + 'build/cues.json'))
SUBS = [(c[0] + OFF, c[1] + OFF, rgba(sub_layer(c[3]))) for c in CUES]

CHAP = [(0, '모르던 것을 알게 하는 사람'), (1, '같은 칸, 같은 질문'), (2, '묻는 사람이 찾아오는 자리'), (3, '리포트 XI장, 밝힘'), (4, '1~4주, 해 보고 남기기'),
        (5, '5~8주, 보여 주고 고쳐 쓰기'), (6, '9~12주, 다음 사람이 쓰는 것'), (9, '다음 걸음'), (10, '같은 변화, 다른 얼굴'), (11, '열두 주 뒤에 남은 것'), (12, '처음 남길 것 하나')]
CH = []
for k, (si, t) in enumerate(CHAP):
    fb, fs = font(SERIF, 60), font(PM, 25); pw = fb.getbbox(t)[2] + 84; ph = 150
    im = Image.new('RGBA', (pw, ph), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, pw - 1, ph - 1), 18, fill=(10, 24, 22, 190)); d.rectangle((0, 18, 6, ph - 18), fill=GOLD + (255,))
    d.text((38, 22), f'EP.04  ·  {k + 1:02d} / {len(CHAP)}', font=fs, fill=GOLD + (255,)); d.text((38, 58), t, font=fb, fill=(255, 255, 255, 255))
    CH.append((si, rgba(im)))
BRAND = rgba(text_layer(['인생포트폴리오'], font(PM, 26), (255, 255, 255, 235), spacing=0))
DISC_V = rgba(text_layer(['가상의 인물 · 설명용 시각화'], font(PM, 24), (255, 255, 255, 225), spacing=0))
DISC_S = rgba(text_layer(['실제 서비스 화면 · 예시 계정'], font(PM, 24), (255, 255, 255, 225), spacing=0))

def over(frame, L, x, y, a=1.0):
    if a <= 0.003: return
    h, w = L.shape[:2]; x, y = int(x), int(y)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    l = L[y0 - y:y1 - y, x0 - x:x1 - x]; al = l[:, :, 3:4] / 255.0 * a
    reg = frame[y0:y1, x0:x1]; reg[:] = reg * (1 - al) + l[:, :, 2::-1] * al

# ---------- deterministic cards ----------
def card(kicker, big, body, w=760, big_font=SERIF, big_size=66, foot=None):
    fk, fb, fy, fs = font(PS, 26), font(big_font, big_size), font(PM, 32), font(PR, 22)
    im = Image.new('RGBA', (w, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(im); y = 34
    d.text((40, y), kicker, font=fk, fill=GOLD + (255,)); y += 50
    if big: d.text((40, y), big, font=fb, fill=GREEN + (255,)); y += big_size + 30
    for l in body: d.text((40, y), l, font=fy, fill=INK + (255,)); y += 46
    if foot: y += 10; d.text((40, y), foot, font=fs, fill=(110, 110, 100, 255)); y += 40
    y += 24
    c = Image.new('RGBA', (w, y), (0, 0, 0, 0)); cd = ImageDraw.Draw(c)
    cd.rounded_rectangle((0, 0, w - 1, y - 1), 22, fill=CREAM + (246,)); cd.rectangle((0, 22, 8, y - 22), fill=GOLD + (255,))
    c.alpha_composite(im.crop((0, 0, w, y)))
    sh = Image.new('RGBA', (w + 80, y + 80), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((40, 52, w + 40, y + 52), 22, fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); sh.alpha_composite(c, (40, 40)); return rgba(sh)

def list_card(kicker, items, w=820, num=True, size=38):
    fk, fi = font(PS, 26), font(PS, size); y = 34
    im = Image.new('RGBA', (w, 1200), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((40, y), kicker, font=fk, fill=GOLD + (255,)); y += 58
    for i, it in enumerate(items):
        if num:
            d.ellipse((40, y + 2, 40 + size + 6, y + size + 8), fill=GREEN + (255,))
            n = str(i + 1); fw = font(PB, size - 12).getbbox(n)[2]
            d.text((40 + (size + 6 - fw) / 2, y + 7), n, font=font(PB, size - 12), fill=(255, 255, 255, 255)); x = 40 + size + 24
        else: x = 40
        d.text((x, y), it, font=fi, fill=INK + (255,)); y += size + 26
    y += 16
    c = Image.new('RGBA', (w, y), (0, 0, 0, 0)); cd = ImageDraw.Draw(c)
    cd.rounded_rectangle((0, 0, w - 1, y - 1), 22, fill=CREAM + (246,)); cd.rectangle((0, 22, 8, y - 22), fill=GOLD + (255,))
    c.alpha_composite(im.crop((0, 0, w, y)))
    sh = Image.new('RGBA', (w + 80, y + 80), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((40, 52, w + 40, y + 52), 22, fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); sh.alpha_composite(c, (40, 40)); return rgba(sh)

def seven_chip(name, desc, col):
    w, h = 300, 132
    im = Image.new('RGBA', (w + 40, h + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((20, 28, w + 20, h + 28), 18, fill=(0, 0, 0, 110))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    d.rounded_rectangle((20, 20, w + 20, h + 20), 18, fill=CREAM + (248,)); d.rectangle((20, 38, 28, h + 2), fill=col + (255,))
    d.text((48, 34), name, font=font(SERIF, 50), fill=GREEN + (255,)); d.text((48, 100), desc, font=font(PM, 25), fill=INK + (255,))
    return rgba(im)
SEVEN = [('밝힘', '모르던 것을 알게 해요'), ('지음', '없던 것을 만들어 내요'), ('펼침', '몸과 목소리로 보여 줘요'), ('돌봄', '사람과 생명을 살펴요'),
         ('이음', '사람과 사람을 이어요'), ('세움', '흩어진 것에 순서를 세워요'), ('지킴', '맡은 것을 잘 지켜요')]
SEVCOL = [(232, 222, 196), (150, 170, 140), (90, 150, 150), (214, 178, 90), (200, 110, 80), (110, 135, 170), (150, 145, 140)]
CHIPS = [seven_chip(n, d, c) for (n, d), c in zip(SEVEN, SEVCOL)]


VERSE = None
# ---------- documentary tags (다큐 3일 · 인간극장 grammar) ----------
def tag_layer(text, size=30, gold=True):
    f = font(PS, size); w = f.getbbox(text)[2] + 56; h = size + 30
    im = Image.new('RGBA', (w + 30, h + 30), (0, 0, 0, 0)); sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 16, w + 12, h + 16), 10, fill=(0, 0, 0, 120)); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im); d.rounded_rectangle((10, 10, w + 10, h + 10), 10, fill=(10, 24, 22, 200))
    d.rectangle((10, 18, 15, h + 2), fill=(GOLD if gold else (255, 255, 255)) + (255,)); d.text((36, 10 + (h - size) // 2 - 3), text, font=f, fill=(255, 255, 255, 255))
    return rgba(im)
def name_layer(name, role):
    fn, fr = font(SERIF, 46), font(PM, 28); w = max(fn.getbbox(name)[2], fr.getbbox(role)[2]) + 70
    im = Image.new('RGBA', (w + 40, 150), (0, 0, 0, 0)); sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((14, 18, w + 14, 132), 14, fill=(0, 0, 0, 120)); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)))
    d = ImageDraw.Draw(im); d.rounded_rectangle((10, 10, w + 10, 126), 14, fill=CREAM + (245,)); d.rectangle((10, 26, 17, 110), fill=GOLD + (255,))
    d.text((40, 20), name, font=fn, fill=GREEN + (255,)); d.text((40, 80), role, font=fr, fill=INK + (255,)); return rgba(im)
TAGS = []
def tag(t0, text, dur=4.6): TAGS.append((t0, t0 + dur, tag_layer(text), (52, 92)))
def name(t0, n, role, dur=4.8): TAGS.append((t0, t0 + dur, name_layer(n, role), (52, 690)))
C_TYPE = card('일곱 가지 변화 가운데 하나', '밝힘', ['모르던 것을 알게 하는 변화'], big_size=84)
C_THREE = list_card('같은 변화 · 밝힘', ['윤서 · 10분 설명서', '현수 · 창고 오류 점검표', '태성 · 7년의 질문 기록'], num=False, size=40)
C_ASSETS = list_card('열두 주 뒤에 남은 것 · 리포트 XI장의 말로', ['지적 자산 · 10분 설명서', '경험 자산 · 세 칸의 사례와 질문 11개', '관계 자산 · 묻고 배우러 오는 사람들'], size=36, w=900)
# ---------- sources: clips ----------
class EncClip:
    def __init__(self, k):
        cap = cv2.VideoCapture(B + f'clips/{k}.mp4'); self.e = []
        while True:
            ok, f = cap.read()
            if not ok: break
            self.e.append(cv2.imencode('.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 96])[1])
        self.c = {}
    def __len__(self): return len(self.e)
    def __getitem__(self, i):
        if i not in self.c:
            if len(self.c) > 6: self.c.pop(next(iter(self.c)))
            self.c[i] = cv2.imdecode(self.e[i], cv2.IMREAD_COLOR)
        return self.c[i]
def load_clip(k): return EncClip(k)
from collections import OrderedDict
class LRU(OrderedDict):
    def get(self, k, d=None):
        if k in self: self.move_to_end(k); return self[k]
        return d
    def __setitem__(self, k, v):
        super().__setitem__(k, v); self.move_to_end(k)
        while len(self) > 20: self.popitem(last=False)
CLIPS = LRU()
class _LRU6(LRU):
    def __setitem__(self, k, v):
        OrderedDict.__setitem__(self, k, v); self.move_to_end(k)
        while len(self) > 6: self.popitem(last=False)
FLOWS = _LRU6()
DIS = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_FAST)
def _flow(k, fr, a):
    key = (k, a); f = FLOWS.get(key)
    if f is None:
        g0 = cv2.cvtColor(cv2.resize(fr[a], (640, 360)), cv2.COLOR_BGR2GRAY); g1 = cv2.cvtColor(cv2.resize(fr[a + 1], (640, 360)), cv2.COLOR_BGR2GRAY)
        f = (DIS.calc(g0, g1, None), DIS.calc(g1, g0, None)); FLOWS[key] = f
    return f
def clip_frame(k, u):
    """u in [0,1] = position along the clip (forward only). Between source frames: optical-flow interpolation."""
    fr = CLIPS.get(k)
    if fr is None: fr = load_clip(k); CLIPS[k] = fr
    n = len(fr); u = min(1.0, max(0.0, u))
    i = u * (n - 1); a = min(n - 2, int(i)); t = i - a
    if t < 0.04: return fr[a]
    if t > 0.96: return fr[a + 1]
    f01, f10 = _flow(k, fr, a)
    h, w = fr[a].shape[:2]; sx = w / 640.0
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    F01 = cv2.resize(f01, (w, h)) * sx; F10 = cv2.resize(f10, (w, h)) * sx
    A = cv2.remap(fr[a], gx - F01[..., 0] * t, gy - F01[..., 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    Bf = cv2.remap(fr[a + 1], gx - F10[..., 0] * (1 - t), gy - F10[..., 1] * (1 - t), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return cv2.addWeighted(A, 1 - t, Bf, t, 0)
def clip_at(k, local_t, dur, speed=0.85, start=0.0):
    """FORWARD ONLY. Never reverses (owner 2026-10-13: ping-pong rebound looked unnatural).
    The clip is stretched so the whole shot fits inside its 6 s; start = seconds into the clip."""
    CL = 6.0; start = min(start, CL * 0.5)
    v = speed if dur <= 0 else min(speed, (CL - start) / max(dur, 1e-3))
    return (start + local_t * v) / CL

# ---------- sources: screens ----------
def load_screen(name):
    im = Image.open(A + name + '.png').convert('RGB'); return np.asarray(im)[:, :, ::-1].copy()
SCR = {}
def scr(name):
    if name not in SCR: SCR[name] = load_screen(name)
    return SCR[name]
def rounded_alpha(h, w, r):
    m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m
CARDS = {}
def scard(name, crop=None, radius=44, up=1.0):
    key = (name, crop)
    if key in CARDS: return CARDS[key]
    im = scr(name)
    if crop: x, y, w, h = crop; im = im[y:y + h, x:x + w]
    im = cv2.resize(im, None, fx=up, fy=up, interpolation=cv2.INTER_LANCZOS4)
    k = np.array([[0, -0.25, 0], [-0.25, 2.0, -0.25], [0, -0.25, 0]], np.float32); im = cv2.filter2D(im, -1, k)
    a = rounded_alpha(im.shape[0], im.shape[1], int(radius * up))
    CARDS[key] = np.dstack([im, a]).astype(np.uint8); return CARDS[key]
def pair(a, b, gap=120):
    h = max(a.shape[0], b.shape[0]); w = a.shape[1] + b.shape[1] + gap
    o = np.zeros((h, w, 4), np.uint8); o[:a.shape[0], :a.shape[1]] = a; o[:b.shape[0], a.shape[1] + gap:] = b; return o

# ---------- shot list ----------
shots = []
def plate(clip, t0, t1, speed=0.85, dark=1.0, ov=(), chips=None, start=0.0, verse=None, pu=None):
    shots.append(dict(k='plate', c=clip, t0=t0, t1=t1, sp=speed, dark=dark, ov=list(ov), chips=chips, st=start, verse=verse, pu=pu))
def screen(name, t0, t1, keys, spots=(), ov=(), tr='page', bg='R5'):
    shots.append(dict(k='screen', n=name, t0=t0, t1=t1, keys=keys, spots=list(spots), ov=list(ov), tr=tr, bg=bg))
def insert(clip, t0, t1, page, dive_at=None, dive_to=None):
    """matchmove: page pinned to tracked booklet in clip, then optional dive-in to screen shot"""
    shots.append(dict(k='insert', c=clip, t0=t0, t1=t1, page=page, dive=dive_at, to=dive_to))

def view_full(c, fill=0.86):
    h, w = c.shape[:2]; vw = max(w / fill, h / fill * 16 / 9); return (w / 2, h / 2, vw)
def view_rect(c, x, y, w, h, margin=1.25, up=2.0):
    x, y, w, h = x * up, y * up, w * up, h * up; vw = max(w * margin, h * margin * 16 / 9); return (x + w / 2, y + h / 2, vw)
def R(x, y, w, h, up=2.0): return (x * up, y * up, w * up, h * up)


TRK = {'A06': json.load(open(B + 'track/A06.json'))}
S = lambda i: SEC[i]; E = lambda i: SEC_END[i]
CL, CR = (W - 840 - 90, 170), (70, 170)
CL2 = (W - 980 - 60, 200)
def view_side(c, side, fill=0.86, margin=150):
    h, w = c.shape[:2]; vw = max(w / fill, h / fill * 16 / 9); sc = W / vw
    cx = (W / 2 - margin) / sc if side == 'L' else w - (W / 2 - margin) / sc
    return (cx, h / 2, vw)
VERB = {1: '해 보기', 2: '다듬기', 3: '까닭 달기', 4: '보여 주기', 5: '소개하기', 6: '고쳐 쓰기', 7: '넓히기', 8: '돌아보기', 9: '써 보게 하기', 10: '묶기', 11: '건네기', 12: '카드 쓰기'}
# S0 hook: dawn dock, the next person opens the sheet (same ending composition later)
t1 = at(0, '이종이를'); t2 = at(0, '밝힘은')
plate('A01', 0, t1 + .4, speed=0.8); tag(S(0) + .4, '12주 차 · 새벽 5:40 · 출고장')
plate('A02', t1, t2 + .4, speed=0.8, start=1.0)
plate('A14', t2, E(0) + .4, speed=0.7, dark=.72, ov=[(t2 + .2, E(0), C_TYPE, CL)])
# S1 the same bay, the same question
t1 = at(1, '전날잘못'); t2 = at(1, '새로온직원'); t3 = at(1, '이번주에만')
plate('A02', S(1), t1 + .4, speed=0.8); tag(S(1) + .4, '1주 차 · 새벽 5:00'); name(S(1) + 5.6, '윤서 (34)', '물류센터 새벽조 교대조장')
plate('A07', t1, t2 + .4, speed=0.8)
plate('A03', t2, t3 + .4, speed=0.8)
plate('A02', t3, E(1) + .4, speed=0.7, start=3.0)
# S2 break room, phone photos
t1 = at(2, '윤서씨의휴대전화에는')
plate('A04', S(2), t1 + .4, speed=0.8); tag(S(2) + .4, '1주 차 · 오전 7:30 · 휴게실')
plate('A05', t1, E(2) + .4, speed=0.8)
# S3 report XI: MATCHMOVE the real page onto the tablet, dive in, then the page itself
t1 = at(3, '자산화유형은'); t2 = at(3, '그아래에'); t3 = at(3, '사람들이모이는'); t4 = at(3, '그리고처음'); t5 = at(3, '윤서씨는이한')
insert('A06', S(3), t1 + .5, 'report-xi-b', dive_at=S(3) + 1.6, dive_to=t1 + .5)
c = scard('report-xi-b')
screen('report-xi-b', t1, t5 + .4, [(t1, view_full(c, .92)), (t1 + .7, view_rect(c, 69, 171, 583, 106, 1.12)), (t2, view_rect(c, 69, 292, 583, 122, 1.12)), (t4, view_rect(c, 69, 420, 583, 60, 1.18)), (t5 + .4, view_rect(c, 69, 420, 583, 60, 1.1))],
       spots=[(t1 + .5, t2, R(69, 171, 583, 106)), (t3 - .2, t4, R(69, 292, 583, 122)), (t4 + .1, t5 + .2, R(69, 430, 583, 35))], tr='dissolve', bg='A06')
plate('A06', t5, E(3) + .4, speed=0.7, start=2.5)
# S4 weeks 1-4
w = {k: at(4, f'{k}주차') for k in (1, 2, 3, 4)}; t1 = at(4, '일주부터|1주부터'); t6 = at(4, '동료가말한')
c = scard('program-quest-b')
screen('program-quest-b', S(4), w[1] + .4, [(S(4), view_full(c, .92)), (t1, view_rect(c, 69, 222, 583, 134, 1.1)), (w[1] + .4, view_rect(c, 69, 222, 583, 134, 1.06))], spots=[(t1 + .2, w[1] + .2, R(69, 222, 583, 134))], bg='A07', tr='dissolve')
plate('A07', w[1], w[2] + .4, speed=0.8, start=1.5); tag(w[1] + .2, '1주 차 · 해 보기')
plate('A03', w[2], w[3] + .4, speed=0.75, start=2.0); tag(w[2] + .2, '2주 차 · 다듬기')
plate('A06', w[3], w[4] + .4, speed=0.75, start=1.0); tag(w[3] + .2, '3주 차 · 까닭 달기')
plate('A08', w[4], t6 + .4, speed=0.8); tag(w[4] + .2, '4주 차 · 보여 주기')
c = scard('diary-q4-b')
screen('diary-q4-b', t6, E(4) + .4, [(t6, view_rect(c, 29, 120, 662, 320, 1.05)), (t6 + 1.6, view_rect(c, 40, 1273, 640, 268, 1.12)), (E(4) + .4, view_rect(c, 40, 1273, 640, 268, 1.06))],
       spots=[(t6 + .3, t6 + 1.5, R(29, 235, 662, 193)), (t6 + 1.9, E(4), R(58, 1273, 610, 268))], bg='A08', tr='dissolve')
# S5 weeks 5-8
w = {k: at(5, f'{k}주차') for k in (5, 6, 7, 8)}
c = scard('program-quest-b')
screen('program-quest-b', S(5), w[5] + .4, [(S(5), view_rect(c, 69, 367, 583, 150, 1.1)), (w[5] + .4, view_rect(c, 69, 367, 583, 150, 1.05))], spots=[(S(5) + .4, w[5] + .2, R(69, 367, 583, 150))], bg='A09', tr='dissolve')
plate('A09', w[5], w[6] + .4, speed=0.8); tag(w[5] + .2, '5주 차 · 소개하기')
plate('A10', w[6], w[7] + .4, speed=0.8); tag(w[6] + .2, '6주 차 · 고쳐 쓰기')
plate('A04', w[7], w[8] + .4, speed=0.7, start=2.5); tag(w[7] + .2, '7주 차 · 넓히기')
plate('A11', w[8], E(5) + .4, speed=0.8); tag(w[8] + .2, '8주 차 · 돌아보기 · 저녁 휴게실')
# S6 weeks 9-12 zone
screen('program-quest-b', S(6), E(6) + .4, [(S(6), view_rect(c, 69, 527, 583, 150, 1.1)), (E(6) + .4, view_rect(c, 69, 527, 583, 150, 1.04))], spots=[(S(6) + .3, E(6), R(69, 527, 583, 150))], bg='A12', tr='dissolve')
# S7 week 9 solo read (silent observer)
t1 = at(7, '라벨끝자리')
plate('A12', S(7), t1 + .4, speed=0.75, pu=0.12); tag(S(7) + .3, '9주 차 · 써 보게 하기 · 새벽 4:50 · 교육실')
plate('A13', t1, E(7) + .4, speed=0.8)
# S8 weeks 10-12
t1 = at(8, '11주차'); t2 = at(8, '12주차'); t3 = at(8, '무엇이남았나'); t4 = at(8, '누가다시썼나칸에는')
plate('A14', S(8), t1 + .4, speed=0.8); tag(S(8) + .2, '10주 차 · 묶기')
plate('A15', t1, t2 + .4, speed=0.8); tag(t1 + .2, '11주 차 · 건네기 · 교육실')
c = scard('diary-q12-b')
screen('diary-q12-b', t2, E(8) + .4, [(t2, view_rect(c, 29, 3300, 662, 540, 1.05)), (t3, view_rect(c, 29, 3844, 662, 520, 1.05)), (t4, view_rect(c, 29, 4290, 662, 420, 1.1)), (E(8) + .4, view_rect(c, 29, 4290, 662, 420, 1.05))],
       spots=[(t2 + .3, t3, R(58, 3571, 610, 228)), (t3 + .2, t4, R(40, 3940, 640, 300)), (t4 + .2, E(8), R(40, 4330, 640, 260))], bg='A14', tr='dissolve')
TAGS.append((t2 + .2, t2 + 4.4, tag_layer('12주 차 · 카드 쓰기'), (52, 92)))
# S9 next step
t1 = at(9, '리포트11장에는')
plate('A16', S(9), t1 + .4, speed=0.8); tag(S(9) + .4, '12주 차 · 오후 2:00 · 사무실')
c = scard('report-xi-b')
screen('report-xi-b', t1, E(9) + .4, [(t1, view_rect(c, 69, 470, 583, 160, 1.3)), (t1 + 4.5, view_rect(c, 69, 530, 583, 50, 1.05)), (t1 + 9.0, view_rect(c, 69, 430, 583, 190, 1.2)), (E(9) + .4, view_full(c, .9))], spots=[(t1 + .3, E(9), R(69, 536, 583, 35))], bg='A16', tr='dissolve')
# S10 same change, other faces (business founder + career changer)
t1 = at(10, '물류소프트웨어회사를'); t2 = at(10, '콜센터'); t3 = at(10, '세사람모두')
plate('A13', S(10), t1 + .4, speed=0.7, start=3.0, dark=.85)
plate('A17', t1, t2 + .4, speed=0.8); name(max(t1 + .6, S(10) + 5.5), '현수 (45)', '물류 소프트웨어 회사 창업자')
plate('A18', t2, t3 + .4, speed=0.8); name(t2 + .6, '태성 (41)', '콜센터 상담원 → 고객경험 연구원 지원')
plate('A15', t3, E(10) + .4, speed=0.7, start=2.5, dark=.72, ov=[(t3 + .1, E(10), C_THREE, CL)])
# S11 what remained
t1 = at(11, '첫째')
screen('report-xi-b', S(11), t1 + .4, [(S(11), view_rect(c, 69, 455, 583, 90, 1.15)), (t1 + .4, view_rect(c, 69, 455, 583, 90, 1.1))], spots=[(S(11) + .4, t1 + .2, R(69, 465, 583, 71))], bg='A14', tr='dissolve')
plate('A14', t1, E(11) + .4, speed=0.7, start=1.5, dark=.7, ov=[(t1 + .1, E(11), C_ASSETS, CL2)])
# S12 CTA: the same end composition as the opening (the next person holds it)
t1 = at(12, '리포트11장에서')
plate('A13', S(12), t1 + .4, speed=0.75, start=1.0)
plate('A01', t1, VO_END + .4, speed=0.7, start=1.5)
plate('A01', VO_END, TOTAL + .1, speed=0.5, dark=.55, start=3.5)
def endcard():
    im = Image.new('RGBA', (1400, 520), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((0, 0), '처음 남길 것 하나면', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 104), '충분합니다.', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 250), '마이페이지  ›  나의 다이어리  ›  추천 진로 세 카드', font=font(PS, 40), fill=GOLD + (255,))
    d.text((0, 318), 'lifeportfolio.co.kr', font=font(PM, 34), fill=(255, 255, 255, 230))
    d.text((0, 384), '고유함이 쓰이는 순간 EP.04 · 밝힘', font=font(PR, 28), fill=(235, 230, 215, 230))
    sh = Image.fromarray(np.dstack([np.zeros((520, 1400, 3), np.uint8), (np.asarray(im.filter(ImageFilter.GaussianBlur(8)))[:, :, 3] * .6).astype(np.uint8)]))
    base = Image.new('RGBA', im.size, (0, 0, 0, 0)); base.alpha_composite(sh); base.alpha_composite(im); return rgba(base)
def scrim(w, h, a0, horiz):
    g = np.linspace(a0, 0, w if horiz else h, dtype=np.float32)
    al = np.tile(g[None, :], (h, 1)) if horiz else np.tile(g[:, None], (1, w))
    L = np.zeros((h, w, 4), np.float32); L[:, :, 3] = al * 255; return L
TOP = scrim(W, 130, .42, False)
END = endcard(); END_T = VO_END - 3.0

# ---------- renderers ----------
def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
GRAIN = [np.random.default_rng(s).normal(0, 1, (H // 2, W // 2)).astype(np.float32) for s in range(8)]
def grain(f, t, amt=3.2):
    g = cv2.resize(GRAIN[int(t * 24) % 8], (W, H), interpolation=cv2.INTER_LINEAR); f += (g * amt)[:, :, None]; return f

def plate_frame(k, lt, sp, start=0.0, dur=0.0):
    u = clip_at(k, lt, dur, sp, start * sp); f = clip_frame(k, u)
    f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    return f
def push(f, lt, dur, amt=0.055):
    """slow one-way push-in that keeps moving in the same direction as the clip (no return)"""
    if dur <= 0: return f
    z = 1 + amt * min(1, lt / dur); M = np.float32([[z, 0, W / 2 * (1 - z)], [0, z, H / 2 * (1 - z)]])
    return cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def r_plate(s, t):
    lt = t - s['t0']; d = s['t1'] - s['t0']; f = plate_frame(s['c'], lt, s['sp'], s['st'], d)
    if s.get('pu'): f = push(f, lt, d, s['pu'])
    elif d * min(s['sp'], 6.0 / d) < d * 0.5: f = push(f, lt, d)
    if s['dark'] < 1: f *= s['dark']
    # focus pull: while a card / verse / chips are up, the moving plate softens and recedes
    fa = 0.0
    for (a, b, L, pos) in s['ov']: fa = max(fa, ease((t - a + .2) / .7) * ease((b - t) / .5))
    if s['verse']: a, b = s['verse']; fa = max(fa, ease((t - a + .2) / .9) * ease((b - t) / .6))
    if s['chips']: fa = max(fa, 0.6 * ease((t - s['chips'][0] + .2) / .7) * ease((s['t1'] - .2 - t) / .4))
    if fa > 0.01:
        sm = cv2.resize(cv2.GaussianBlur(cv2.resize(f, (W // 4, H // 4)), (0, 0), 2.2), (W, H), interpolation=cv2.INTER_LINEAR)
        k = 0.85 * fa; f = f * (1 - k) + sm * k; f *= (1 - 0.12 * fa)
    if s['chips']:
        # seven chips: arc in two rows, each appears at its spoken time, then all hold
        pos = [(150, 190), (560, 190), (970, 190), (1380, 190), (355, 400), (765, 400), (1175, 400)]
        for i, ct in enumerate(s['chips']):
            a = ease((t - ct + .15) / .45) * ease((s['t1'] - .2 - t) / .4)
            over(f, CHIPS[i], pos[i][0], pos[i][1] + (1 - ease((t - ct + .15) / .6)) * 30, a)
    for (a, b, L, pos) in s['ov']:
        al = ease((t - a) / .45) * ease((b - t) / .4); over(f, L, pos[0], pos[1] + (1 - ease((t - a) / .6)) * 26, al)
    if s['verse']:
        a, b = s['verse']; al = ease((t - a) / .7) * ease((b - t) / .6); over(f, VERSE, (W - 1500) / 2, 210, al)
    return f, False

def interp_keys(keys, t):
    if t <= keys[0][0]: return keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            e = ease((t - a) / max(.01, b - a)); return tuple(va[i] + (vb[i] - va[i]) * e for i in range(3))
    return keys[-1][1]

def screen_bg(k, t, cx_n, cy_n, lt=0.0, dur=0.0):
    # moving real-space clip, blurred and darkened, with a parallax offset that is SLOWER than the card
    f = plate_frame(k, lt, 0.7, 0.0, dur)
    f = cv2.GaussianBlur(cv2.resize(f, (W // 4, H // 4)), (0, 0), 3.2)
    f = cv2.resize(f, (int(W * 1.1), int(H * 1.1)))
    bx = int(96 + (cx_n - .5) * 60); by = int(54 + (cy_n - .5) * 40)
    bx = min(max(bx, 0), f.shape[1] - W); by = min(max(by, 0), f.shape[0] - H)
    return f[by:by + H, bx:bx + W] * 0.48

def place_card(f, card, M, t):
    ch, cw = card.shape[:2]
    p0 = M @ np.float32([0, 0, 1]); p1 = M @ np.float32([cw, ch, 1])
    sm = np.zeros((H // 4, W // 4), np.float32)
    cv2.rectangle(sm, (int(p0[0] / 4) + 2, int(p0[1] / 4) + 6), (int(p1[0] / 4) + 2, int(p1[1] / 4) + 9), 0.6, -1)
    sm = cv2.resize(cv2.GaussianBlur(sm, (0, 0), 7), (W, H)); f *= (1 - sm[:, :, None])
    sc = M[0, 0]
    if sc < 0.9:
        k = sc / 0.9; small = cv2.resize(card, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        M2 = M.copy(); M2[0, 0] /= k; M2[1, 1] /= k; wp = cv2.warpAffine(small, M2, (W, H), flags=cv2.INTER_LINEAR)
    else:
        wp = cv2.warpAffine(card, M, (W, H), flags=cv2.INTER_LINEAR)
    wp = wp.astype(np.float32); al = wp[:, :, 3:4] / 255.0; f[:] = f * (1 - al) + wp[:, :, :3] * al

def spot(f, rects, M):
    m = np.zeros((H // 4, W // 4), np.float32); rings = []
    for (x, y, w, h, a) in rects:
        p0 = M @ np.float32([x, y, 1]); p1 = M @ np.float32([x + w, y + h, 1])
        cv2.rectangle(m, (int(p0[0] / 4) - 3, int(p0[1] / 4) - 3), (int(p1[0] / 4) + 3, int(p1[1] / 4) + 3), a, -1); rings.append((p0, p1, a))
    m = cv2.resize(cv2.GaussianBlur(m, (0, 0), 4), (W, H)); amax = max(r[4] for r in rects)
    f *= (1 - 0.5 * amax * (1 - np.minimum(1, m / max(amax, 1e-3))))[:, :, None]
    for (p0, p1, a) in rings:
        ring = np.zeros((H, W), np.uint8); cv2.rectangle(ring, (int(p0[0]) - 10, int(p0[1]) - 10), (int(p1[0]) + 10, int(p1[1]) + 10), 255, 5, cv2.LINE_AA)
        ys, xs = np.nonzero(ring)
        if len(ys): f[ys, xs] = f[ys, xs] * (1 - a) + np.float32([79, 160, 201]) * a

def r_screen(s, t):
    card = CARDS.get((s['n'], None)) if (s['n'], None) in CARDS else scard(s['n'])
    ch, cw = card.shape[:2]; cx, cy, vw = interp_keys(s['keys'], t)
    vw *= (1 - 0.012 * ((t - s['t0']) / max(1, s['t1'] - s['t0']))) * (1 + 0.006 * math.sin((t - s['t0']) * 0.5))
    sc = W / vw; M = np.float32([[sc, 0, W / 2 - cx * sc], [0, sc, H / 2 - cy * sc]])
    f = screen_bg(s['bg'], t, cx / cw, cy / ch, t - s['t0'], s['t1'] - s['t0']); place_card(f, card, M, t)
    act = [(x, y, w, h, ease((t - a) / .4) * ease((b - t) / .35)) for (a, b, (x, y, w, h)) in s['spots'] if a - .1 < t < b + .1]
    act = [r for r in act if r[4] > 0.01]
    if act: spot(f, act, M)
    for (a, b, L, pos) in s['ov']:
        al = ease((t - a) / .45) * ease((b - t) / .4); over(f, L, pos[0], pos[1] + (1 - ease((t - a) / .6)) * 26, al)
    return f, True

# --- matchmove insert ---
PAGE_CACHE = {}
def page_tex(name):
    if name in PAGE_CACHE: return PAGE_CACHE[name]
    im = scr(name); w = im.shape[1]; im = im[int(w * 0.10):int(w * 0.10) + int(w * 0.80), :].copy()   # tablet is landscape: top of the page (XI title, type, sentence)
    PAGE_CACHE[name] = im; return im
INSERT_Q = {'A06': [[402, 394], [510, 365], [555, 452], [451, 486]]}
OLD_Q = {}
def pin(f, clip, n, tex, quad0, scale, inset=0.02, light=None):
    Hm = np.array(TRK[clip]['H'][n]); sx_ = W / 1280.0
    q = cv2.perspectiveTransform((np.float32(quad0) / sx_)[None], Hm)[0] * sx_   # track is in 1280 space
    c = q.mean(0); q = (q - c) * (1 - inset) + c                      # page sits inside the cover margin
    q = q * scale
    th, tw = tex.shape[:2]; src = np.float32([[0, 0], [tw, 0], [tw, th], [0, th]])
    # keep page aspect: tex is portrait (720x1018); booklet quad ~ portrait-ish in perspective
    P = cv2.getPerspectiveTransform(src, np.float32(q))
    wp = cv2.warpPerspective(tex, P, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32)
    m = cv2.warpPerspective(np.full((th, tw), 255, np.uint8), P, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32) / 255.0
    m = cv2.GaussianBlur(m, (0, 0), 0.8)[:, :, None]
    # light match: multiply by the plate's own low-frequency luminance over the quad (relative to its mean)
    lum = cv2.GaussianBlur(cv2.cvtColor(f.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 25)
    inside = m[:, :, 0] > .5
    mu = float(lum[inside].mean()) if inside.any() else 128.0
    gain = np.clip(lum / max(mu, 1) , 0.55, 1.6)[:, :, None]
    tint = np.float32([0.88, 0.97, 1.05]) if light is None else light   # warm lamp light (BGR)
    wp = wp * (0.86 + 0.10 * gain) * tint * 0.93
    # light wrap from plate onto page edge
    edge = np.clip(m - cv2.GaussianBlur(m, (0, 0), 6)[:, :, None] * 1.0, 0, 1) if False else None
    f[:] = f * (1 - m) + wp * m
    return q

def r_insert(s, t):
    clip = s['c']; fr = CLIPS.get(clip)
    if fr is None: fr = load_clip(clip); CLIPS[clip] = fr
    lt = t - s['t0']; n = min(len(fr) - 1, int(lt * 24 * 0.9))           # play forward at 0.9x - tracked frames only
    base = cv2.resize(fr[n], (W, H), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    sx = W / 1280.0
    tex = page_tex(s['page'])
    q = pin(base, clip, n, tex, [[x * sx, y * sx] for x, y in INSERT_Q[clip]], 1.0)
    if clip in OLD_Q:
        pin(base, clip, n, page_tex('program-iv-old'), [[x * sx, y * sx] for x, y in OLD_Q[clip]], 1.0, light=np.float32([0.9, 0.93, 0.98]))
    f = base
    if s['dive'] and t > s['dive']:
        # seamless dive: camera pushes into the pinned page until it fills the frame (homography zoom)
        p = ease((t - s['dive']) / max(.1, s['to'] - s['dive']))
        c = q.mean(0); ext = max(q[:, 0].max() - q[:, 0].min(), (q[:, 1].max() - q[:, 1].min()) * 16 / 9)
        qh = q[:, 1].max() - q[:, 1].min(); z = 1 + p * (0.92 * H / max(qh, 1) - 1)
        tgt = c * (1 - p) + np.float32([W / 2, H / 2]) * p
        Mz = np.float32([[z, 0, tgt[0] - c[0] * z], [0, z, tgt[1] - c[1] * z]])
        f = cv2.warpAffine(f, Mz, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return f, True

def render_shot(s, t):
    return r_plate(s, t) if s['k'] == 'plate' else (r_screen(s, t) if s['k'] == 'screen' else r_insert(s, t))

def page_turn(fa, fb, p):
    e = ease(p); edge = int(W * (1 - e)); out = fa.copy(); out[:, edge:] = fb[:, edge:]
    a0 = max(0, edge - 90)
    if edge > 0: out[:, a0:edge] *= np.linspace(1, 0.55, edge - a0, dtype=np.float32)[None, :, None]
    hl = min(W, edge + 24)
    if hl > edge: out[:, edge:hl] = out[:, edge:hl] * 0.85 + 255 * 0.15
    return out

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); _r = np.sqrt(((xx - W / 2) / (W * .62)) ** 2 + ((yy - H * .47) / (H * .70)) ** 2)
VIG = (1 - 0.22 * np.clip((_r - 0.55) / 0.6, 0, 1) ** 1.6)[:, :, None].astype(np.float32); del yy, xx, _r
def compose(t):
    act = [s for s in shots if s['t0'] <= t < s['t1']]
    if not act: act = [shots[-1]]
    if len(act) == 1: f, isS = render_shot(act[0], t)
    else:
        a, b = act[-2], act[-1]; ov = a['t1'] - b['t0']; p = (t - b['t0']) / max(.01, ov)
        fa, sa = render_shot(a, t); fb, sb = render_shot(b, t)
        tr = b.get('tr', 'dissolve') if b['k'] == 'screen' else 'dissolve'
        if tr == 'page' and sa and sb and a['k'] == 'screen': f = page_turn(fa, fb, p)
        elif tr == 'cut' and ov < 0.6: f = fb if p > .5 else fa
        else: e = ease(p); f = fa * (1 - e) + fb * e
        isS = sb if p > .5 else sa
    f *= VIG
    f = grain(f, t)
    over(f, TOP, 0, 0, 1); over(f, BRAND, 70, 34, .95)
    D = DISC_S if isS else DISC_V; over(f, D, W - D.shape[1] - 70, 34, .95)
    for si, L in CH:
        s0 = SEC[si]
        if s0 - .05 <= t < s0 + 5.2 and t < END_T - .5:
            a = ease((t - s0) / .5) * ease((s0 + 5.2 - t) / .6); over(f, L, 70, 690 - (1 - a) * 14, a)
    for (a0, b0, L, pos) in TAGS:
        if a0 - .05 <= t < b0 + .05:
            a = ease((t - a0) / .45) * ease((b0 - t) / .5); over(f, L, pos[0] + (1 - ease((t - a0) / .6)) * -16, pos[1], a)
    if t >= END_T:
        a = ease((t - END_T) / .9); over(f, END, 150, 300 + (1 - a) * 24, a)
    for (a, b, L) in SUBS:
        if a <= t < b:
            al = ease((t - a) / .12) * ease((b - t) / .12); over(f, L, (W - L.shape[1]) / 2, H - 70 - L.shape[0], al); break
    return np.clip(f, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'stills':
        for x in sys.argv[2].split(','):
            t = float(x); cv2.imwrite(f'/tmp/st_{t:07.2f}.jpg', compose(t), [cv2.IMWRITE_JPEG_QUALITY, 85])
        print('TOTAL', round(TOTAL, 2), 'shots', len(shots))
    elif mode == 'gaps':
        ts = np.arange(0, TOTAL, 0.1); miss = [round(t, 1) for t in ts if not any(s['t0'] <= t < s['t1'] for s in shots)]
        print('uncovered', miss[:40], len(miss))
    else:
        a, b = float(sys.argv[2]), float(sys.argv[3]); out = sys.argv[4]
        n0, n1 = int(round(a * FPS)), int(round(min(b, TOTAL) * FPS))
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                              '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
        for n in range(n0, n1):
            p.stdin.write(compose(n / FPS).tobytes())
            if n % 300 == 0: print(out, n, n1, flush=True)
        p.stdin.close(); p.wait(); print('DONE', out)
