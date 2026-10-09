import json, re, sys, math, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
B = '/home/user/ax-work/yt-ep02/'
P = '/home/user/ax-work/content/promo/'
FPS, W, H, OFF, HOLD = 30, 1920, 1080, 1.0, 10.0
TM = json.load(open(B + 'build/timing.json'))
WD, ST = TM['words'], TM['starts']
SEC = [WD[i]['s'] + OFF for i in ST]
VO_END = TM['vo_end'] + OFF
TOTAL = VO_END + HOLD
SEC_END = SEC[1:] + [TOTAL]
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
SERIF_B = '/usr/share/fonts/truetype/nanum/NanumMyeongjoBold.ttf'
PB, PS, PM, PR = FD + 'Pretendard-Bold.woff2', FD + 'Pretendard-SemiBold.woff2', FD + 'Pretendard-Medium.woff2', FD + 'Pretendard-Regular.woff2'
GOLD = (201, 160, 79); CREAM = (255, 251, 240); INK = (23, 33, 43); GREEN = (11, 59, 42)

# ---------------- text layers (RGBA numpy, premultiplied later) ----------------
def rgba(img): return np.asarray(img).astype(np.float32)

def text_layer(lines, fnt, fill, shadow=True, spacing=14, pad=20):
    f = fnt
    ws = [f.getbbox(l)[2] for l in lines]; lh = f.size + spacing
    im = Image.new('RGBA', (max(ws) + pad * 2, lh * len(lines) + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
        for i, l in enumerate(lines): ds.text((pad + 2, pad + i * lh + 3), l, font=f, fill=(0, 0, 0, 170))
        sh = sh.filter(ImageFilter.GaussianBlur(6)); im = Image.alpha_composite(im, sh); d = ImageDraw.Draw(im)
    for i, l in enumerate(lines): d.text((pad, pad + i * lh), l, font=f, fill=fill)
    return im

SUBF = font(PS, 44)
def sub_layer(lines):
    lh = 60; ws = [SUBF.getbbox(l)[2] for l in lines]
    w = max(ws) + 56; h = lh * len(lines) + 26
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=(10, 14, 18, 150))
    for i, l in enumerate(lines):
        x = (w - ws[i]) // 2; d.text((x, 12 + i * lh), l, font=SUBF, fill=(255, 255, 255, 255))
    return im

CUES = json.load(open(B + 'build/cues.json'))
SUBS = [(c[0] + OFF, c[1] + OFF, rgba(sub_layer(c[3]))) for c in CUES]

TITLES = re.findall(r'^\[S(\d+)\|([^\]]+)\]', open(B + 'script.md').read(), re.M)
CH = []
for i, (n, t) in enumerate(TITLES):
    fb, fs = font(SERIF, 60), font(PM, 25)
    wb = fb.getbbox(t)[2]; pw = wb + 84; ph = 150
    im = Image.new('RGBA', (pw, ph), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, pw - 1, ph - 1), 18, fill=(12, 20, 17, 190)); d.rectangle((0, 18, 6, ph - 18), fill=GOLD + (255,))
    d.text((38, 22), f'EP.02  ·  {int(n):02d} / 17', font=fs, fill=GOLD + (255,)); d.text((38, 58), t, font=fb, fill=(255, 255, 255, 255))
    CH.append(rgba(im))

BRAND = rgba(text_layer(['인생포트폴리오'], font(PM, 26), (255, 255, 255, 235), spacing=0))
DISC_V = rgba(text_layer(['설명용 시각화'], font(PM, 24), (255, 255, 255, 225), spacing=0))
DISC_S = rgba(text_layer(['실제 서비스 화면 · 예시 계정 (이름 ○○○ 가림)'], font(PM, 24), (255, 255, 255, 225), spacing=0))

def over(frame, L, x, y, a=1.0):
    if a <= 0.003: return
    h, w = L.shape[:2]; x, y = int(x), int(y)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    l = L[y0 - y:y1 - y, x0 - x:x1 - x]
    al = l[:, :, 3:4] / 255.0 * a
    reg = frame[y0:y1, x0:x1]
    reg[:] = reg * (1 - al) + l[:, :, 2::-1] * al  # RGBA->BGR

# ---------------- info cards (deterministic Korean text) ----------------
def info_card(kicker, big, body, src, w=760):
    im = Image.new('RGBA', (w, 400), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fk, fb, fy, fs = font(PS, 26), font(SERIF, 72), font(PM, 32), font(PR, 22)
    y = 34
    d.text((40, y), kicker, font=fk, fill=GOLD + (255,)); y += 50
    d.text((40, y), big, font=fb, fill=GREEN + (255,)); y += 98
    for l in body: d.text((40, y), l, font=fy, fill=INK + (255,)); y += 46
    y += 10; d.text((40, y), src, font=fs, fill=(110, 110, 100, 255)); y += 50
    card = Image.new('RGBA', (w, y), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, w - 1, y - 1), 22, fill=CREAM + (246,))
    cd.rectangle((0, 22, 8, y - 22), fill=GOLD + (255,))
    card.alpha_composite(im.crop((0, 0, w, y)))
    sh = Image.new('RGBA', (w + 80, y + 80), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((40, 52, w + 40, y + 52), 22, fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); sh.alpha_composite(card, (40, 40))
    return rgba(sh)

C_138 = info_card('연구 1 · 메타분석', '138편', ['목표의 진행을 점검할수록 목표에 더 가까이.', '직접 적어 둘 때 효과가 더 컸습니다.'], 'Harkin 외 (2016), Psychological Bulletin')
C_23 = info_card('연구 2 · 현장 실험', '하루 15분', ['배운 것을 글로 돌아본 신입 직원들,', '최종 평가가 평균 약 23% 높았습니다.'], 'Di Stefano 외, HBS Working Paper 14-093')
C_238 = info_card('연구 3 · 업무 일지 분석', '238명', ['7개 회사의 업무 일지. 기분이 가장 좋았던 날의', '열에 일곱 이상은 일이 나아간 날이었습니다.'], 'Amabile & Kramer (2011), The Progress Principle')
C_66 = info_card('연구 4 · 습관 형성', '66일', ['습관이 자리 잡기까지 걸린 시간의 중간값.', '하루 빠뜨린 것은 큰 영향이 없었습니다.'], 'Lally 외 (2010), European Journal of Social Psychology')
C_FRESH = info_card('연구 5 · 새 출발 효과', '시작일', ['새 주·새 달처럼 새 출발로 느껴지는 날,', '목표를 향한 행동이 늘었습니다.'], 'Dai, Milkman & Riis (2014), Management Science')
C_IF = info_card('연구 6 · 실행 의도', '만약 → 그러면', ['언제·무엇을 할지 정해 둔 결심은', '실제 행동으로 더 잘 이어졌습니다.'], 'Gollwitzer & Sheeran (2006), 94편 메타분석')
C_YES = info_card('연구가 보여 주는 것', '방향', ['적고, 기록하고, 돌아보는 원리가', '도움이 된다는 방향입니다.'], '위 연구들은 이 다이어리 자체를 검증한 것이 아닙니다.', w=700)
C_NO = info_card('약속하지 않는 것', '성과 보장', ['“이 다이어리를 쓰면 몇 % 더 성공”', '같은 약속은 하지 않습니다.'], '한 권을 살아 있게 만드는 것은 당신의 한 줄입니다.', w=700)

# ---------------- sources ----------------
def load_plate(n):
    im = Image.open(B + f'plates/{n}.png').convert('RGB').resize((2400, 1355), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
    return np.asarray(im)[:, :, ::-1].astype(np.float32)
PL = {k: load_plate(k) for k in 'ABC'}

def rounded_alpha(h, w, r):
    m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m

def load_card(name, crop=None, radius=28):
    im = cv2.imread(P + name + '.png', cv2.IMREAD_COLOR)
    if crop: x, y, w, h = crop; im = im[y:y + h, x:x + w]
    a = rounded_alpha(im.shape[0], im.shape[1], radius)
    return np.dstack([im, a]).astype(np.float32)

def phone(name, scale=0.5):
    im = cv2.imread(P + name + '.png'); im = cv2.resize(im, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    h, w = im.shape[:2]; bz = 22; R = 70
    out = np.zeros((h + bz * 2, w + bz * 2, 4), np.float32)
    out[:, :, :3] = 18; out[:, :, 3] = rounded_alpha(h + bz * 2, w + bz * 2, R)
    inner = rounded_alpha(h, w, R - bz)
    sl = out[bz:bz + h, bz:bz + w]; ia = inner[:, :, None] / 255.0
    sl[:, :, :3] = sl[:, :, :3] * (1 - ia) + im * ia
    return out

def pair(a, b, gap=150):
    h = max(a.shape[0], b.shape[0]); w = a.shape[1] + b.shape[1] + gap
    o = np.zeros((h, w, 4), np.float32); o[:a.shape[0], :a.shape[1]] = a; o[:b.shape[0], a.shape[1] + gap:] = b
    return o

CARDS = {}
for n in ['home-d', 'pc-cover', 'pc-month-1-grid', 'pc-mission', 'pc-lifemap-1-l', 'pc-annual', 'pc-spread', 'pc-tracker-1', 'pc-quarterly-1', 'pc-gratitude-1']:
    CARDS[n] = load_card(n)
mp = cv2.imread(P + 'mypage-card.png'); mpad = np.full((mp.shape[0] + 120, mp.shape[1] + 120, 3), 250, np.uint8); mpad[60:-60, 60:-60] = mp
CARDS['mypage'] = np.dstack([mpad, rounded_alpha(*mpad.shape[:2], 34)]).astype(np.float32)
CARDS['ph-fab'] = phone('m-fab')
CARDS['ph-q'] = pair(phone('m-oneq'), phone('m-help'))
CARDS['ph-priv'] = pair(phone('m-gate'), phone('m-export'))
PHW = CARDS['ph-fab'].shape[1]

CARDS = {k: np.clip(v, 0, 255).astype(np.uint8) for k, v in CARDS.items()}
BG = cv2.GaussianBlur(PL['A'], (0, 0), 22) * 0.42
BG = cv2.resize(BG, (2112, 1188))

# ---------------- shot list ----------------
def view_full(card, fill=0.84):
    h, w = card.shape[:2]; vw = max(w / fill, h / fill * 16 / 9)
    return (w / 2, h / 2, vw)
def view_rect(card, x, y, w, h, margin=1.35):
    margin *= 1.12; vw = max(w * margin, h * margin * 16 / 9); return (x + w / 2, y + h / 2, vw)

shots = []
def plate(name, t0, t1, z0, z1, cx0=.5, cy0=.5, cx1=.5, cy1=.5, dark=1.0, overlays=(), dust=True):
    shots.append(dict(k='plate', n=name, t0=t0, t1=t1, z=(z0, z1), c=((cx0, cy0), (cx1, cy1)), dark=dark, ov=list(overlays), dust=dust))
def screen(name, t0, t1, keys, spots=(), overlays=(), tr='page'):
    shots.append(dict(k='screen', n=name, t0=t0, t1=t1, keys=keys, spots=list(spots), ov=list(overlays), tr=tr))

S = lambda i: SEC[i - 1]; E = lambda i: SEC_END[i - 1]
CL, CR = (W - 760 - 80 - 40, 160), (60, 160)   # card positions (right / left)
# S01 hook: bookshelf → open diary (anchor object)
t = at(0, '고유함은'); plate('B', 0, t + .3, 0.10, 0.02, .55, .5, .62, .48)
plate('A', t, E(1) + .3, 0.0, 0.07, .42, .55, .38, .5)
# S02
t = at(1, '다만'); plate('B', S(2), t + .3, 0.0, 0.065, .75, .45, .7, .5, dark=.82)
plate('B', t, E(2) + .3, 0.07, 0.01, .4, .55, .45, .55, dark=.82)
# S03 research cards over plate A
t1, t2, t3 = at(2, '백삼십팔|138'), at(2, '하루'), at(2, '적어')
plate('A', S(3), t2 + .3, 0.02, 0.075, .3, .5, .28, .55, dark=.78, overlays=[(t1 - .3, t2, C_138, CL)])
plate('A', t2, E(3) + .3, 0.075, 0.02, .55, .45, .5, .5, dark=.78, overlays=[(t2, t3 + .4, C_23, CL)])
# S04 where: home → mypage → diary cover
c = CARDS['home-d']; t1, t2, t3 = at(3, '홈페이지'), at(3, '마이페이지'), at(3, '계정으로')
nav = (1724, 43, 224, 87)
screen('home-d', S(4), t2 + .5, [(S(4), view_full(c)), (t1, view_full(c)), (t1 + 1.6, view_rect(c, 1200, 0, 1100, 300, 1.0)), (t2 + .5, view_rect(c, 1300, 0, 900, 260, 1.0))], spots=[(t1 + 1.2, t2 + .6, nav)])
c = CARDS['mypage']; screen('mypage', t2, t3 + .5, [(t2, view_full(c, .7)), (t3 + .5, view_full(c, .8))], spots=[(t2 + .9, t3 + .4, (785, 75, 420, 160))])
c = CARDS['pc-cover']; screen('pc-cover', t3, E(4) + .5, [(t3, view_full(c)), (E(4) + .5, view_full(c, .9))])
# S05 start date
t1 = at(4, '주차와'); t2 = at(4, '새로운')
screen('pc-cover', S(5), t1 + .5, [(S(5), view_full(c, .9)), (t1 + .5, view_rect(c, 900, 1150, 1080, 260, 1.25))], spots=[(at(4, '리포트를') + .2, t1 + .4, (1050, 1230, 780, 110))], tr='cut')
c = CARDS['pc-month-1-grid']; screen('pc-month-1-grid', t1, E(5) + .5, [(t1, view_full(c)), (t2, view_rect(c, 380, 200, 1050, 1400, 1.05)), (E(5) + .5, view_rect(c, 380, 200, 1050, 1400, 1.0))], overlays=[(t2, E(5) + .3, C_FRESH, CL)])
# S06 mission
c = CARDS['pc-mission']; t1, t2, t3, t4 = at(5, '리포트가'), at(5, '옮겨'), at(5, '내말로'), at(5, '비전과')
screen('pc-mission', S(6), E(6) + .5, [(S(6), view_full(c)), (t1, view_rect(c, 1500, 330, 960, 320, 1.15)), (t2 + .3, view_rect(c, 1500, 330, 960, 320, 1.1)), (t3, view_rect(c, 1500, 560, 960, 600, 1.1)), (t4, view_full(c, .9)), (E(6) + .5, view_full(c, .86))],
       spots=[(t1 + .2, t2, (1540, 360, 890, 140)), (t2 + .1, t3, (1540, 512, 222, 78)), (t3 + .2, t4, (1520, 600, 930, 420))])
# S07 life map
c = CARDS['pc-lifemap-1-l']; t1, t2 = at(6, '삶의'), at(6, '지금의균형')
screen('pc-lifemap-1-l', S(7), E(7) + .5, [(S(7), view_full(c)), (t1, view_rect(c, 1500, 220, 960, 1500, 1.0)), (t2, view_rect(c, 1500, 700, 960, 1000, 1.0)), (E(7) + .5, view_full(c, .9))], spots=[(t1 + .3, t2, (1500, 330, 960, 1360))])
# S08 annual / 90 days
c = CARDS['pc-annual']; t1, t2 = at(7, '그리고'), at(7, '멀리')
screen('pc-annual', S(8), E(8) + .5, [(S(8), view_full(c)), (S(8) + 1.2, view_rect(c, 1500, 1000, 960, 400, 1.2)), (t1, view_rect(c, 1500, 260, 960, 700, 1.1)), (E(8) + .5, view_full(c, .9))], spots=[(S(8) + 1.4, t1, (1516, 1100, 931, 200)), (t1 + .3, t2 + 1, (1516, 280, 931, 620))])
# S09 week
c = CARDS['pc-spread']; t1, t2, t3, t4, t5 = at(8, '맞춤'), at(8, '나는'), at(8, '중요한일과'), at(8, '만약'), at(8, '언제')
screen('pc-spread', S(9), t5 + .5, [(S(9), view_full(c)), (t1, view_rect(c, 440, 380, 930, 360, 1.15)), (t2, view_rect(c, 440, 880, 930, 300, 1.2)), (t3, view_rect(c, 440, 1000, 930, 500, 1.1)), (t4 + .2, view_rect(c, 440, 1380, 930, 300, 1.2)), (t5 + .5, view_full(c, .9))],
       spots=[(t1 + .2, t2, (468, 395, 880, 330)), (t2 + .1, t3, (440, 940, 930, 110)), (t3 + .1, t4, (440, 1110, 930, 290)), (t4 + .2, t5 + .4, (434, 1440, 931, 230))])
c = CARDS['pc-spread']; screen('pc-spread', t5, E(9) + .5, [(t5, view_full(c, .9)), (E(9) + .5, view_full(c, .8))], overlays=[(t5 + .2, E(9) + .2, C_IF, CR)], tr='cut')
# S10 log + tracker
t1, t2 = at(9, '일곱개|7개'), at(9, '주간쪽에')
c = CARDS['ph-fab']; screen('ph-fab', S(10), t2 + .5, [(S(10), view_full(c, .86)), (t1, (c.shape[1] * 1.15, c.shape[0] / 2, c.shape[1] * 3.6)), (t2 + .5, (c.shape[1] * 1.15, c.shape[0] / 2, c.shape[1] * 3.4))], spots=[(S(10) + .6, t1, (22, 1200, PHW - 44, 760))], overlays=[(t1 + .2, t2, C_238, CL)])
c = CARDS['pc-tracker-1']; screen('pc-tracker-1', t2, E(10) + .5, [(t2, view_full(c)), (t2 + 2, view_rect(c, 1500, 200, 960, 1450, 1.0)), (E(10) + .5, view_rect(c, 1500, 500, 960, 1150, 1.0))], spots=[(t2 + 1.5, E(10), (1516, 300, 931, 1300))])
# S11 one question / help / PC spread
t1, t2, t3 = at(10, '그럴때는'), at(10, '칸마다'), at(10, '휴대폰에서는')
c = CARDS['ph-q']; hw = c.shape[1]; ph = PHW
screen('ph-q', S(11), t3 + .5, [(S(11), view_full(c, .8)), (t1, view_full(c, .86)), (t3 + .5, view_full(c, .9))], spots=[(t1 + .2, t2, (0, 0, ph, c.shape[0])), (t2 + .1, t3 + .4, (hw - ph, 0, ph, c.shape[0]))])
c = CARDS['pc-spread']; screen('pc-spread', t3, E(11) + .5, [(t3, view_full(c, .78)), (E(11) + .5, view_full(c, .9))])
# S12 quarterly + gratitude
t1, t2 = at(11, '가장중요했던'), at(11, '한달에')
c = CARDS['pc-quarterly-1']; screen('pc-quarterly-1', S(12), t2 + .5, [(S(12), view_full(c)), (t1, view_rect(c, 1500, 600, 960, 1000, 1.0)), (t2 + .5, view_rect(c, 1500, 800, 960, 900, 1.0))], spots=[(t1 + .2, t2, (1516, 680, 931, 940))])
c = CARDS['pc-gratitude-1']; screen('pc-gratitude-1', t2, E(12) + .5, [(t2, view_full(c)), (E(12) + .5, view_rect(c, 420, 220, 960, 1000, 1.05))], spots=[(t2 + .5, E(12), (434, 300, 931, 860))])
# S13 skip a day → morning plate + 66
t1 = at(12, '새습관'); t2 = at(12, '다시펼친')
plate('C', S(13), t2 + .3, 0.02, 0.075, .6, .55, .55, .5, dark=.8, overlays=[(t1, t2 + .2, C_66, CR)])
plate('C', t2, E(13) + .3, 0.0, 0.06, .75, .45, .78, .4)
# S14 privacy / download
t1, t2 = at(13, '그래서'), at(13, '쓴쪽은')
c = CARDS['ph-priv']; hw = c.shape[1]
screen('ph-priv', S(14), E(14) + .5, [(S(14), view_full(c, .8)), (t2, view_full(c, .86)), (E(14) + .5, view_full(c, .9))], spots=[(t1 + .2, t2, (0, 0, ph, c.shape[0])), (t2 + .1, E(14), (hw - ph, 0, ph, c.shape[0]))])
# S15 the line we keep
t1 = at(14, '이다이어리를'); t2 = at(14, '저희는')
plate('A', S(15), t2 + .3, 0.0, 0.06, .5, .5, .45, .55, dark=.62, overlays=[(S(15) + .4, E(15), C_YES, (150, 190)), (t1, E(15), C_NO, (W - 700 - 80 - 150, 190))], dust=False)
plate('A', t2, E(15) + .3, 0.06, 0.0, .45, .55, .4, .55, dark=.62, overlays=[(t2, E(15), C_YES, (150, 190)), (t2, E(15), C_NO, (W - 700 - 80 - 150, 190))], dust=False)
# S16 stewardship
t1 = at(15, '오늘적은'); plate('C', S(16), t1 + .3, 0.075, 0.01, .5, .55, .55, .5)
plate('A', t1, E(16) + .3, 0.0, 0.075, .4, .52, .38, .48)
# S17 CTA → end card
t1, t2 = at(16, '홈페이지'), at(16, '일년뒤|1년뒤')
plate('C', S(17), t1 + .3, 0.0, 0.05, .7, .45, .72, .45)
c = CARDS['home-d']; screen('home-d', t1, t2 + .5, [(t1, view_full(c)), (t1 + 1.4, view_rect(c, 1300, 0, 900, 260, 1.0)), (t2 + .5, view_rect(c, 1350, 0, 820, 240, 1.0))], spots=[(t1 + 1.0, t2 + .5, nav)], tr='dissolve')
plate('C', t2, TOTAL, 0.0, 0.07, .3, .5, .3, .5, dark=.55, dust=True)

def endcard():
    im = Image.new('RGBA', (1300, 560), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((0, 0), '리포트를 받은 날을,', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 104), '출발일로 적어 보세요.', font=font(SERIF, 76), fill=(255, 255, 255, 255))
    d.text((0, 250), '인생포트폴리오 홈페이지 맨 위  ›  내 다이어리', font=font(PS, 38), fill=GOLD + (255,))
    d.text((0, 314), 'lifeportfolio.co.kr', font=font(PM, 34), fill=(255, 255, 255, 230))
    d.text((0, 380), '256쪽 · 1년 · 지금은 무료 · 리포트를 받은 계정으로 로그인', font=font(PR, 28), fill=(235, 230, 215, 230))
    sh = im.filter(ImageFilter.GaussianBlur(8)); base = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sh = Image.fromarray(np.dstack([np.zeros((560, 1300, 3), np.uint8), (np.asarray(sh)[:, :, 3] * .6).astype(np.uint8)]))
    base.alpha_composite(sh, (0, 0)); base.alpha_composite(im); return rgba(base)
def scrim(w, h, a0, horiz):
    g = np.linspace(a0, 0, w if horiz else h, dtype=np.float32)
    al = np.tile(g[None, :], (h, 1)) if horiz else np.tile(g[:, None], (1, w))
    if horiz:
        v = np.minimum(1, np.minimum(np.linspace(0, 3, h), np.linspace(3, 0, h)))[:, None]; al = al * v
    L = np.zeros((h, w, 4), np.float32); L[:, :, 3] = al * 255; return L
TOP = scrim(W, 130, .42, False); CHS = scrim(1250, 300, .62, True)
END = endcard(); END_T = t2 + 2.2

# ---------------- renderers ----------------
rng = np.random.default_rng(7)
DUST = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1.2, 3.2), rng.uniform(-6, 6), rng.uniform(-9, -2), rng.uniform(25, 70)) for _ in range(70)]
def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)

def r_plate(s, t):
    src = PL[s['n']]; d = (t - s['t0']) / max(.01, s['t1'] - s['t0']); e = d  # linear: camera never stops
    z = s['z'][0] + (s['z'][1] - s['z'][0]) * e
    cx = s['c'][0][0] + (s['c'][1][0] - s['c'][0][0]) * e; cy = s['c'][0][1] + (s['c'][1][1] - s['c'][0][1]) * e
    sh, sw = src.shape[:2]; base = W / sw * 1.0; sc = base * (1.0 + z) * (sw / W) * (W / sw)
    sc = (W / sw) * (1.0 + z) * 1.0
    vw, vh = W / sc, H / sc
    x0 = np.clip(cx * sw - vw / 2, 0, sw - vw); y0 = np.clip(cy * sh - vh / 2, 0, sh - vh)
    M = np.float32([[sc, 0, -x0 * sc], [0, sc, -y0 * sc]])
    f = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if s['dust']:
        L = np.zeros((H // 2, W // 2), np.float32)
        for (x, y, r, vx, vy, a) in DUST:
            px = (x + vx * t * 3) % W; py = (y + vy * t * 3) % H
            cv2.circle(L, (int(px / 2), int(py / 2)), max(1, int(r / 2)), a * (0.6 + 0.4 * math.sin(t * 1.3 + x)), -1, cv2.LINE_AA)
        L = cv2.resize(cv2.GaussianBlur(L, (0, 0), 1.2), (W, H))
        f += L[:, :, None] * np.float32([0.75, 0.9, 1.0])
    if s['dark'] < 1: f *= s['dark']
    for (a, b, L, pos) in s['ov']:
        al = ease((t - a) / .45) * ease((b - t) / .4); rise = (1 - ease((t - a) / .6)) * 26
        over(f, L, pos[0], pos[1] + rise, al)
    return f, False

def interp_keys(keys, t):
    if t <= keys[0][0]: return keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            e = ease((t - a) / max(.01, b - a)); return tuple(va[i] + (vb[i] - va[i]) * e for i in range(3))
    return keys[-1][1]

def spot_mask(rects, M):
    m = np.zeros((H // 4, W // 4), np.float32); rings = []
    for (x, y, w, h, a) in rects:
        p0 = M @ np.float32([x, y, 1]); p1 = M @ np.float32([x + w, y + h, 1])
        q0 = (int(p0[0] / 4) - 3, int(p0[1] / 4) - 3); q1 = (int(p1[0] / 4) + 3, int(p1[1] / 4) + 3)
        cv2.rectangle(m, q0, q1, a, -1); rings.append((p0, p1, a))
    m = cv2.GaussianBlur(m, (0, 0), 4); return cv2.resize(m, (W, H)), rings

def r_screen(s, t):
    card = CARDS[s['n']]; ch, cw = card.shape[:2]
    cx, cy, vw = interp_keys(s['keys'], t)
    drift = 0.006 * math.sin((t - s['t0']) * 0.5)  # micro-breathing so frames never freeze
    vw *= (1 - 0.012 * ((t - s['t0']) / max(1, s['t1'] - s['t0']))) * (1 + drift)
    sc = W / vw; tx, ty = W / 2 - cx * sc, H / 2 - cy * sc
    M = np.float32([[sc, 0, tx], [0, sc, ty]])
    # background: blurred plate A with slow parallax (moves slower than card)
    bx = 96 + (cx / cw - .5) * 60; by = 54 + (cy / ch - .5) * 40
    f = BG[int(by):int(by) + H, int(bx):int(bx) + W].copy()
    # shadow
    p0 = M @ np.float32([0, 0, 1]); p1 = M @ np.float32([cw, ch, 1])
    sm = np.zeros((H // 4, W // 4), np.float32)
    cv2.rectangle(sm, (int(p0[0] / 4) + 2, int(p0[1] / 4) + 6), (int(p1[0] / 4) + 2, int(p1[1] / 4) + 8), 0.55, -1)
    sm = cv2.resize(cv2.GaussianBlur(sm, (0, 0), 7), (W, H)); f *= (1 - sm[:, :, None])
    inter = cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR
    if sc < 0.9:
        k = sc / 0.9; small = cv2.resize(card, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        M2 = np.float32([[sc / k, 0, tx], [0, sc / k, ty]]); warped = cv2.warpAffine(small, M2, (W, H), flags=cv2.INTER_LINEAR)
    else:
        warped = cv2.warpAffine(card, M, (W, H), flags=cv2.INTER_LINEAR)
    warped = warped.astype(np.float32); al = warped[:, :, 3:4] / 255.0; f = f * (1 - al) + warped[:, :, :3] * al
    act = [(x, y, w, h, ease((t - a) / .4) * ease((b - t) / .35)) for (a, b, (x, y, w, h)) in s['spots'] if a - .1 < t < b + .1]
    act = [r for r in act if r[4] > 0.01]
    if act:
        m, rings = spot_mask(act, M); amax = max(r[4] for r in act)
        f *= (1 - 0.5 * amax * (1 - np.minimum(1, m / max(amax, 1e-3))))[:, :, None]
        for (p0, p1, a) in rings:
            ring = np.zeros((H, W), np.uint8)
            cv2.rectangle(ring, (int(p0[0]) - 10, int(p0[1]) - 10), (int(p1[0]) + 10, int(p1[1]) + 10), 255, 5, cv2.LINE_AA)
            ys, xs = np.nonzero(ring)
            if len(ys): f[ys, xs] = f[ys, xs] * (1 - a) + np.float32([79, 160, 201]) * a
    for (a, b, L, pos) in s['ov']:
        alp = ease((t - a) / .45) * ease((b - t) / .4); rise = (1 - ease((t - a) / .6)) * 26
        over(f, L, pos[0], pos[1] + rise, alp)
    return f, True

def render_shot(s, t): return r_plate(s, t) if s['k'] == 'plate' else r_screen(s, t)

def page_turn(fa, fb, p):
    e = ease(p); edge = int(W * (1 - e)); out = fa.copy()
    out[:, edge:] = fb[:, edge:]
    sw = 90; a0 = max(0, edge - sw)
    if edge > 0:
        g = np.linspace(1, 0.55, edge - a0, dtype=np.float32)[None, :, None]; out[:, a0:edge] *= g
    hl = min(W, edge + 24)
    if hl > edge: out[:, edge:hl] = out[:, edge:hl] * 0.85 + 255 * 0.15
    return out

def compose(t):
    act = [s for s in shots if s['t0'] <= t < s['t1']]
    if not act: act = [shots[-1]]
    if len(act) == 1:
        f, isS = render_shot(act[0], t)
    else:
        a, b = act[-2], act[-1]; d = b['t0']; ov = a['t1'] - b['t0']
        p = (t - d) / max(.01, ov); fa, sa = render_shot(a, t); fb, sb = render_shot(b, t)
        tr = b.get('tr', 'dissolve') if b['k'] == 'screen' else 'dissolve'
        if tr == 'page' and sa and sb: f = page_turn(fa, fb, p)
        elif tr == 'cut' and ov < 0.6: f = fb if p > .5 else fa
        else: e = ease(p); f = fa * (1 - e) + fb * e
        isS = sb if p > .5 else sa
    # overlays: brand, disclosure, chapter, subtitles, end card
    over(f, TOP, 0, 0, 1)
    over(f, BRAND, 70, 34, .95)
    D = DISC_S if isS else DISC_V; over(f, D, W - D.shape[1] - 70, 34, .95)
    for i, s0 in enumerate(SEC):
        if s0 - .05 <= t < s0 + 5.8 and t < END_T - .5:
            a = ease((t - s0) / .5) * ease((s0 + 5.8 - t) / .6)
            over(f, CH[i], 70, 680 - (1 - a) * 14, a)
    if t >= END_T:
        a = ease((t - END_T) / .9); over(f, END, 150, 300 + (1 - a) * 24, a)
    for (a, b, L) in SUBS:
        if a <= t < b:
            al = ease((t - a) / .12) * ease((b - t) / .12); over(f, L, (W - L.shape[1]) / 2, H - 70 - L.shape[0], al); break
    return np.clip(f, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'stills':
        ts = [float(x) for x in sys.argv[2].split(',')]
        for t in ts: cv2.imwrite(f'/tmp/st_{t:07.2f}.jpg', compose(t), [cv2.IMWRITE_JPEG_QUALITY, 85])
        print('TOTAL', TOTAL, 'shots', len(shots))
    else:
        a, b = float(sys.argv[2]), float(sys.argv[3]); out = sys.argv[4]
        n0, n1 = int(round(a * FPS)), int(round(min(b, TOTAL) * FPS))
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                              '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
        for n in range(n0, n1):
            p.stdin.write(compose(n / FPS).tobytes())
            if n % 300 == 0: print(out, n, n1, flush=True)
        p.stdin.close(); p.wait(); print('DONE', out)
