# EP.03 longform renderer
#  - All backgrounds are real-motion Seedance clips (real-space building world)
#  - NEW (EP.03): "matchmove insert" - real service screens are pinned onto tracked physical
#    surfaces inside the moving footage (planar homography from KLT+RANSAC, tk/track.py),
#    then light-matched (plate luminance gradient), grained and light-wrapped, so screen and space
#    share one camera, one light, one grain. Then a seamless push-in "dives" into the page.
#  - Screen focus shots keep EP.02 grammar: keyframed zoom/pan, spotlight + gold ring, page turn.
#  - Text / cards / subtitles are deterministic overlays (supersampled).
import json, re, sys, math, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
B = '/home/user/ax-work/yt-ep03/'
A = '/home/user/main-wt/assets/blog/asset/'
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

TITLES = re.findall(r'^\[S(\d+)\|([^\]]+)\]', open(B + 'script.md').read(), re.M)
CH = []
for n, t in TITLES:
    fb, fs = font(SERIF, 60), font(PM, 25); pw = fb.getbbox(t)[2] + 84; ph = 150
    im = Image.new('RGBA', (pw, ph), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, pw - 1, ph - 1), 18, fill=(10, 24, 22, 190)); d.rectangle((0, 18, 6, ph - 18), fill=GOLD + (255,))
    d.text((38, 22), f'EP.03  ·  {int(n):02d} / {len(TITLES)}', font=fs, fill=GOLD + (255,)); d.text((38, 58), t, font=fb, fill=(255, 255, 255, 255))
    CH.append(rgba(im))
BRAND = rgba(text_layer(['인생포트폴리오'], font(PM, 26), (255, 255, 255, 235), spacing=0))
DISC_V = rgba(text_layer(['설명용 시각화'], font(PM, 24), (255, 255, 255, 225), spacing=0))
DISC_S = rgba(text_layer(['실제 서비스 화면 · 예시 계정 (이름 ○○○ 가림)'], font(PM, 24), (255, 255, 255, 225), spacing=0))

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

C_FOUR = list_card('이번에 출시된 네 가지', ['일곱 가지 변화 · 리포트 XI장', '고유성 기반 자산화 길찾기', '자산화 맞춤 실행 프로그램', '이미 받은 리포트도 재생성으로'])
C_RULE = card('정해진 규칙 · 당신의 답', '76문항', ['선택형 답과 점수형 답을 규칙대로 셉니다.', '같은 답이면 언제나 같은 결과.', '답 2개 이상 · 그중 선택형 1개 이상일 때만'], foot='성경 원리 · 관련 연구와 자료 · 앞선 서비스 사례 · 가상 시험')
C_XI = list_card('리포트 XI. 자산화 길 찾기', ['나만의 자산화 문장', '처음 남길 것 하나', '30일 방향'], num=False)
C_NOAI = card('이 문장은', 'AI가 쓰지 않습니다', ['리포트에 이미 있는 말을 정해진 틀로 엮습니다.', '같은 유형이어도 사람마다 문장이 다릅니다.'], big_size=54)
C_TAG = card('자산화 유형은', '이름표가 아니라 출발점', ['점수나 순위를 두지 않고,', '그렇게 본 이유를 함께 보여 드립니다.'], big_size=52)
C_PICK = card('다이어리에 남길 변화', '0 ~ 2개', ['나의 것이라고 느끼는 것만 고릅니다.', '고른 것만 「추천 진로 세 카드」에 들어갑니다.'])
C_SPINE = list_card('뼈대는 단순합니다', ['1주 = 1칸', '12칸 = 카드 한 장', '1년 = 같은 카드 네 장'], num=False, size=46)
C_ZONE = list_card('12주 자산화 퀘스트', ['1~4주 · 나와 가까운 사람 곁에서', '5~8주 · 이웃과 모임에서', '9~12주 · 일터와 지역에서'], num=False)
C_SEASON = list_card('한 길의 세 가지 때', ['싹 · 12주 · 실행', '이삭 · 3개월 · 성과', '열매 · 1년 · 자산'], num=False, size=46)
C_REGEN = card('재생성', '누르실 때만 바뀝니다', ['다시 진단받을 필요도, 비용도 없습니다.', 'VII장 네 영역 읽기 · XI장 자산화 길 찾기를 새로', '다른 페이지 · 점수 · 고유코드 · 사명 문장은 그대로'], big_size=52)
C_ORDER = list_card('권해 드리는 순서', ['리포트 재생성', '자산화 실행 › 프로그램 재생성', '나의 다이어리 열기'])
C_LINE = card('분명히 해 둘 선', '고르는 것은 당신', ['정해진 규칙으로 세어 보여 드립니다. 등급 · 비교 없음.', '직업 · 자산 예시는 참고, 투자 권유가 아닙니다.', '훈련 · 소그룹 · 멘토 · 프로젝트는 출시 준비중'], big_size=52)

def verse_layer():
    im = Image.new('RGBA', (1500, 470), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = font(SERIF, 54)
    lines = ['각각 은사를 받은 대로', '하나님의 여러 가지 은혜를 맡은', '선한 청지기 같이 서로 봉사하라']
    for i, l in enumerate(lines):
        w = f.getbbox(l)[2]; d.text(((1500 - w) / 2, 30 + i * 88), l, font=f, fill=(255, 255, 255, 255))
    s = '베드로전서 4:10 (개역개정)'; fs = font(PM, 30); w = fs.getbbox(s)[2]; d.text(((1500 - w) / 2, 330), s, font=fs, fill=GOLD + (255,))
    sh = Image.fromarray(np.dstack([np.zeros((470, 1500, 3), np.uint8), (np.asarray(im.filter(ImageFilter.GaussianBlur(9)))[:, :, 3] * .75).astype(np.uint8)]))
    base = Image.new('RGBA', im.size, (0, 0, 0, 0)); base.alpha_composite(sh); base.alpha_composite(im); return rgba(base)
VERSE = verse_layer()

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
def clip_frame(k, u):
    """u in [0,1] over a ping-pong cycle; returns float32 1920x1080 graded frame"""
    fr = CLIPS.get(k)
    if fr is None: fr = load_clip(k); CLIPS[k] = fr
    n = len(fr)
    i = u * (n - 1); a = int(i); b = min(n - 1, a + 1); t = i - a
    f = cv2.addWeighted(fr[a], 1 - t, fr[b], t, 0) if t > 0.02 else fr[a]
    return f
def clip_at(k, local_t, dur, speed=0.85):
    # forward then gentle reverse (ping-pong) at <1x speed so long holds never loop visibly
    L = 6.0 / speed; p = (local_t % (2 * L)) / L
    u = p if p <= 1 else 2 - p
    return u

# ---------- sources: screens ----------
def load_screen(name):
    im = Image.open(A + name + '.webp').convert('RGB'); return np.asarray(im)[:, :, ::-1].copy()
SCR = {}
def scr(name):
    if name not in SCR: SCR[name] = load_screen(name)
    return SCR[name]
def rounded_alpha(h, w, r):
    m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m
CARDS = {}
def scard(name, crop=None, radius=22, up=2.0):
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

TRK = {k: json.load(open(B + f'track/{k}.json')) for k in ('R11', 'R11b')}

# ---------- shot list ----------
shots = []
def plate(clip, t0, t1, speed=0.85, dark=1.0, ov=(), chips=None, start=0.0, verse=None):
    shots.append(dict(k='plate', c=clip, t0=t0, t1=t1, sp=speed, dark=dark, ov=list(ov), chips=chips, st=start, verse=verse))
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

S = lambda i: SEC[i - 1]; E = lambda i: SEC_END[i - 1]
CL, CR = (W - 840 - 90, 170), (70, 170)

# S01 hook: street -> building, light comes on
t1 = at(0, '고유함은발견'); t2 = at(0, '이번에는')
plate('R1', 0, t1 + .4, speed=0.75)
plate('R2', t1, t2 + .4, speed=0.8)
plate('R2c', t2, E(1) + .4, speed=0.8)
# S02 four items: cutaway, card
plate('R2', S(2), E(2) + .4, speed=0.7, start=3.0, dark=.78, ov=[(S(2) + .6, E(2), C_FOUR, CL)])
# S03 seven: organizer tray + seven chips cascade; then home-routes screen
t1 = at(2, '밝힘은'); t2 = at(2, '일곱가지모두'); t3 = at(2, '남긴것이')
c = scard('home-routes')
screen('home-routes', S(3), t1 + .4, [(S(3), view_full(c, .8)), (t1 + .4, view_rect(c, 20, 100, 960, 330, 1.1))], spots=[(S(3) + 1.0, t1, R(34, 112, 340, 200))], bg='R4', tr='dissolve')
chip_t = [at(2, n) for n in ['밝힘은', '지음은', '펼침은', '돌봄은', '이음은', '세움은', '지킴은']]
plate('R4', t1, t3 + .4, speed=0.8, dark=.72, chips=chip_t)
c = scard('guide-changes', crop=(0, 260, 720, 560))
screen('guide-changes', t3, E(3) + .4, [(t3, view_full(c, .8)), (E(3) + .4, view_full(c, .88))], bg='R4', tr='dissolve')
# S04 rules: library aisle + rule card
t1 = at(3, '칠십육|76'); t2 = at(3, '이규칙은')
plate('R5', S(4), E(4) + .4, speed=0.8, dark=.75, ov=[(t1 - .3, E(4), C_RULE, CL)])
def view_side(c, side, fill=0.86, margin=150):
    h, w = c.shape[:2]; vw = max(w / fill, h / fill * 16 / 9); sc = W / vw
    cx = (W / 2 - margin) / sc if side == 'L' else w - (W / 2 - margin) / sc
    return (cx, h / 2, vw)
# S05 report XI: MATCHMOVE insert -> dive into report-xi page
t1 = at(4, '리포트맨끝'); t2 = at(4, '찾은변화'); t3 = at(4, '첫번째강점'); t3b = at(4, '이번주에'); t3c = at(4, '그리고삼십|그리고30'); t4 = at(4, '이문장은')
insert('R11', S(5), t2 + .6, 'report-xi', dive_at=t1 + 1.2, dive_to=t2 + .6)
c = scard('report-xi')
screen('report-xi', t2, E(5) + .4, [(t2, view_full(c, .92)), (t2 + .6, view_rect(c, 70, 180, 560, 90, 1.15)), (t3, view_rect(c, 70, 295, 560, 100, 1.15)), (t3b, view_rect(c, 60, 425, 580, 60, 1.25)), (t3c, view_rect(c, 60, 560, 580, 60, 1.25)), (t4, view_side(c, 'R', .9)), (E(5) + .4, view_side(c, 'R', .88))],
       spots=[(t2 + .4, t3, R(88, 182, 530, 82)), (t3 + .1, t3b, R(84, 298, 548, 96)), (t3b + .1, t3c, R(62, 432, 560, 34)), (t3c + .1, t4, R(62, 568, 560, 36))], ov=[(t4, E(5), C_NOAI, CR)], tr='dissolve')
# S06 tag + mypage card + diary
t1 = at(5, '그래서점수'); t2 = at(5, '마이페이지'); t3 = at(5, '다이어리에서')
screen('report-xi', S(6), t2 + .4, [(S(6), view_side(c, 'L', .86)), (t2 + .4, view_side(c, 'L', .84))], spots=[(S(6) + .5, t2, R(90, 226, 528, 42))], ov=[(S(6) + .8, t2 - .2, C_TAG, CL)], tr='cut')
c = scard('mypage-type'); screen('mypage-type', t2, t3 + .4, [(t2, view_full(c, .82)), (t3 + .4, view_full(c, .78))], spots=[(t2 + .6, t3, R(40, 20, 640, 150))], bg='R3')
c = scard('diary-path'); screen('diary-path', t3, E(6) + .4, [(t3, view_rect(c, 0, 20, 720, 330, 1.05)), (E(6) + .4, view_rect(c, 0, 20, 720, 330, 1.0))], bg='R3')
# S07 first door opens (hallway), home-routes CTA
t1 = at(6, '그가운데'); t2 = at(6, '훈련도')
plate('R6', S(7), t2 + .4, speed=0.75)
c = scard('home-routes'); screen('home-routes', t2, E(7) + .4, [(t2, view_full(c, .8)), (t2 + 1.2, view_rect(c, 20, 330, 760, 110, 1.15)), (E(7) + .4, view_rect(c, 20, 330, 760, 110, 1.1))], spots=[(t2 + 1.0, E(7), R(32, 380, 450, 32))], bg='R6', tr='dissolve')
# S08 pathfinding window
t1 = at(7, '가장먼저'); t2 = at(7, '그리고어떤'); t3 = at(7, '칠십육|76')
c = scard('diary-path')
screen('diary-path', S(8), E(8) + .4, [(S(8), view_rect(c, 0, 30, 720, 300, 1.05)), (t1, view_rect(c, 20, 380, 660, 400, 1.08)), (t2, view_rect(c, 20, 600, 660, 260, 1.15)), (t3, view_rect(c, 10, 1340, 690, 470, 1.05)), (E(8) + .4, view_rect(c, 10, 1340, 690, 470, 1.0))],
       spots=[(t1 + .2, t2, R(22, 382, 650, 390)), (t2 + .1, t3, R(40, 700, 600, 44)), (t3 + .3, E(8), R(20, 1342, 660, 200))], bg='R5')
# S09 pick 0-2 + card
t1 = at(8, '고른변화를'); t2 = at(8, '길찾기는마이')
screen('diary-path', S(9), t1 + .4, [(S(9), view_side(c, 'L', .9)), (t1 + .4, view_side(c, 'L', .88))], spots=[(S(9) + .5, t1 + .2, R(20, 2170, 680, 80))], ov=[(S(9) + .5, t1 + .2, C_PICK, CL)], tr='cut', bg='R5')
plate('R10', t1, E(9) + .4, speed=0.8)
# S10 program rebuilt: cover -> spine card on cork board footage
t1 = at(9, '그래서실행'); t2 = at(9, '뼈대는')
plate('R3', S(10), t1 + .4, speed=0.8)
c = pair(scard('program-cover'), scard('program-glance')); CARDS[('program-pair', None)] = c
screen('program-pair', t1, t2 + .4, [(t1, view_full(c, .9)), (t2 + .4, view_full(c, .84))], bg='R3', tr='dissolve')
plate('R10', t2, E(10) + .4, speed=0.8, dark=.72, ov=[(t2 + .2, E(10), C_SPINE, CL)])
# S11 quest: zones
t1 = at(10, '일주부터|1주부터'); t2 = at(10, '오주부터|5주부터'); t3 = at(10, '구주부터|9주부터'); t4 = at(10, '주마다'); t5 = at(10, '같은변화')
c = scard('program-quest')
screen('program-quest', S(11), t5 + .4, [(S(11), view_full(c, .92)), (t1, view_rect(c, 70, 228, 580, 135, 1.1)), (t2, view_rect(c, 70, 388, 580, 140, 1.1)), (t3, view_rect(c, 70, 548, 580, 140, 1.1)), (t4, view_rect(c, 70, 228, 580, 135, 1.12)), (t5 + .4, view_rect(c, 70, 228, 580, 135, 1.08))],
       spots=[(t1 + .2, t2, R(80, 232, 562, 126)), (t2 + .1, t3, R(80, 390, 562, 136)), (t3 + .1, t4, R(80, 550, 562, 136)), (t4 + .1, t5, R(84, 276, 556, 22))], bg='R3')
plate('R8', t5, E(11) + .4, speed=0.8, dark=.8, ov=[(t5 - .2, E(11), C_ZONE, CL)])
# S12 three seasons: rooftop garden + IV page
t1 = at(11, '싹은'); t4 = at(11, '매듭마다')
plate('R9', S(12), t4 + .4, speed=0.7, dark=.85, ov=[(t1 - .2, t4, C_SEASON, CL)])
c = scard('program-iv-new')
screen('program-iv-new', t4, E(12) + .4, [(t4, view_full(c, .9)), (t4 + 1.5, view_rect(c, 70, 445, 560, 370, 1.05)), (E(12) + .4, view_rect(c, 70, 445, 560, 370, 1.02))], spots=[(t4 + 1.4, E(12), R(80, 520, 520, 290))], bg='R9', tr='dissolve')
# S13 diary quest + vision card
t1 = at(12, '오늘해|오늘'); t2 = at(12, '비전카드'); t3 = at(12, '지금이용')
c = scard('diary-quest')
screen('diary-quest', S(13), t2 + .4, [(S(13), view_rect(c, 0, 180, 720, 290, 1.05)), (t1, view_rect(c, 30, 500, 660, 380, 1.05)), (t2 + .4, view_rect(c, 30, 500, 660, 380, 1.0))],
       spots=[(S(13) + 1.5, t1, R(40, 312, 600, 140)), (t1 + .3, t2, R(56, 600, 600, 140))], bg='R10')
c = scard('diary-vision-top')
screen('diary-vision-top', t2, E(13) + .4, [(t2, view_rect(c, 0, 60, 720, 300, 1.05)), (t2 + 2.0, view_rect(c, 20, 860, 660, 420, 1.0)), (t3, view_rect(c, 60, 1100, 600, 160, 1.15)), (E(13) + .4, view_rect(c, 60, 1100, 600, 160, 1.1))],
       spots=[(t2 + .3, t2 + 1.9, R(190, 160, 340, 150)), (t3 + .1, E(13), R(200, 1128, 340, 56))], bg='R10')
# S14 regen: real booklet footage + card
t2 = at(13, '저장된리포트는')
plate('R11b', S(14), t2 + .4, speed=0.8)
plate('R11', t2, E(14) + .4, speed=0.8, dark=.7, ov=[(t2, E(14), C_REGEN, CL)])
# S15 order: IV before/after -> order card on footage -> diary
t1 = at(14, '다음은'); t2 = at(14, '마지막으로')
c = pair(scard('program-iv-old'), scard('program-iv-new')); CARDS[('iv-pair', None)] = c
screen('iv-pair', S(15), t1 + .4, [(S(15), view_full(c, .9)), (S(15) + 1.6, view_rect(c, 780, 0, 720, 1019, 1.05)), (t1 + .4, view_rect(c, 780, 0, 720, 1019, 1.02))], bg='R11')
plate('R11b', t1, t2 + .4, speed=0.7, dark=.7, start=2.5, ov=[(t1, t2 + .3, C_ORDER, CL)])
c = scard('diary-quest'); screen('diary-quest', t2, E(15) + .4, [(t2, view_rect(c, 0, 180, 720, 290, 1.05)), (E(15) + .4, view_rect(c, 30, 500, 660, 380, 1.0))], bg='R10', tr='dissolve')
# S16 line: calm window view
plate('R8', S(16), E(16) + .4, speed=0.65, dark=.68, start=2.0, ov=[(S(16) + .4, E(16), C_LINE, CL)])
# S17 verse: gathering table -> dusk cutaway (recall whole building)
t1 = at(16, '받은것은'); t2 = at(16, '저희가만든'); t3 = at(16, '신앙이')
plate('R12', S(17), t2 + .4, speed=0.7, dark=.6, verse=(at(16, '각각') - .3, t1 + 1.5))
plate('R2b', t2, VO_END + .4, speed=0.7)
# S18 CTA + end hold
plate('R2b', VO_END, TOTAL + .1, speed=0.6, dark=.55, start=4.5)
c = scard('mypage-type')

def endcard():
    im = Image.new('RGBA', (1400, 520), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((0, 0), '처음 남길 것 하나면', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 104), '충분합니다.', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 250), '마이페이지  ›  나의 다이어리  ›  💎 내 변화 찾기'.replace('💎 ', ''), font=font(PS, 40), fill=GOLD + (255,))
    d.text((0, 318), 'lifeportfolio.co.kr', font=font(PM, 34), fill=(255, 255, 255, 230))
    d.text((0, 384), '고유성 기반 자산화 길찾기 · 이용 가능', font=font(PR, 28), fill=(235, 230, 215, 230))
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

def plate_frame(k, lt, sp, start=0.0):
    u = clip_at(k, lt + start * sp, 0, sp); f = clip_frame(k, u)
    f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    return f

def r_plate(s, t):
    lt = t - s['t0']; f = plate_frame(s['c'], lt, s['sp'], s['st'])
    if s['dark'] < 1: f *= s['dark']
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

def screen_bg(k, t, cx_n, cy_n):
    # moving real-space clip, blurred and darkened, with a parallax offset that is SLOWER than the card
    f = plate_frame(k, t, 0.7)
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
    f = screen_bg(s['bg'], t, cx / cw, cy / ch); place_card(f, card, M, t)
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
    im = scr(name); PAGE_CACHE[name] = im; return im
INSERT_Q = {'R11': [[652, 425], [882, 428], [997, 630], [662, 627]], 'R11b': [[658, 385], [975, 388], [1185, 640], [648, 645]]}
OLD_Q = {'R11b': [[322, 385], [612, 385], [595, 640], [148, 632]]}
def pin(f, clip, n, tex, quad0, scale, inset=0.06, light=None):
    Hm = np.array(TRK[clip]['H'][n]); q = cv2.perspectiveTransform(np.float32(quad0)[None], Hm)[0]
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
    tint = np.float32([0.96, 0.99, 1.04]) if light is None else light   # warm library light (BGR)
    wp = wp * (0.80 + 0.20 * gain) * tint
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
    f = grain(f, t)
    over(f, TOP, 0, 0, 1); over(f, BRAND, 70, 34, .95)
    D = DISC_S if isS else DISC_V; over(f, D, W - D.shape[1] - 70, 34, .95)
    for i, s0 in enumerate(SEC):
        if s0 - .05 <= t < s0 + 5.2 and t < END_T - .5:
            a = ease((t - s0) / .5) * ease((s0 + 5.2 - t) / .6); over(f, CH[i], 70, 690 - (1 - a) * 14, a)
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
