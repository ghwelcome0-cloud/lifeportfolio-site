# ---------- EP.04 shot list (밝힘 · 윤서) ----------
S = lambda i: SEC[i - 1]; E = lambda i: SEC_END[i - 1]
CL, CR = (W - 840 - 90, 170), (70, 170)
CHT = [S(1), S(2), S(3), S(4), S(5), S(6), S(7), S(10), S(11), S(12), S(13)]   # chapter starts = script [S..] titles
def view_side(c, side, fill=0.86, margin=150):
    h, w = c.shape[:2]; vw = max(w / fill, h / fill * 16 / 9); sc = W / vw
    cx = (W / 2 - margin) / sc if side == 'L' else w - (W / 2 - margin) / sc
    return (cx, h / 2, vw)
# stamps (다큐 3일) and name tags (인간극장)
def stamp(t):
    f = font(PS, 30); w = int(f.getbbox(t)[2]) + 48; h = 58
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 12, fill=(10, 24, 22, 185)); d.text((24, 11), t, font=f, fill=(255, 255, 255, 245)); return rgba(im)
def nametag(name, role):
    fn, fr = font(PB, 40), font(PM, 28); w = int(max(fn.getbbox(name)[2], fr.getbbox(role)[2])) + 70; h = 128
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=(10, 24, 22, 200)); d.rectangle((0, 16, 6, h - 16), fill=GOLD + (255,))
    d.text((32, 16), name, font=fn, fill=(255, 255, 255, 255)); d.text((32, 76), role, font=fr, fill=(235, 225, 200, 255)); return rgba(im)
TAGS = []
def tag(a, b, L, y): TAGS.append((a, b, L, y))
ST_Y, NT_Y = 96, 700

# cards
C_TYPE = card('일곱 가지 변화 가운데', '밝힘', ['모르던 것을 알게 해요'], w=640)
C_LOG = card('나의 다이어리 · 오늘 해 봤어요', None, ['동료가 말한 한 줄', '「사진이 있으면 더 빨리 찾겠다」'], w=700)
C_V2 = list_card('두 번째 판에 생긴 것', ['질문 칸 · 많이 나온 질문 다섯', '칸마다 사진 한 장'], num=False, w=760)
C_WHO = list_card('누가 다시 썼나', ['다른 조 교대조장 한 사람', '신입 조장 한 사람', '처음 온 직원 두 사람'], num=False, w=720)
C_ASSET = list_card('열두 주 뒤에 남은 것', ['지적 자산 · 10분 설명서', '경험 자산 · 세 칸 사례와 질문 11개', '관계 자산 · 묻고 배우러 오는 사람들'], num=False, w=860, size=36)
C_SAME = card('같은 변화, 다른 얼굴', None, ['반복되는 문제의 원인을 적었고,', '그 기록을 다른 사람이 다시 씁니다.'], w=720)

# P1 hook
t1 = at(0, '이종이를쓴'); t2 = at(0, '밝힘은')
plate('A01', 0, t1 + .4, speed=0.85)
plate('A13', t1, t2 + .4, speed=0.85)
plate('A07', t2, E(1) + .4, speed=0.8, dark=.8, ov=[(t2 + .2, E(1), C_TYPE, CL)])
tag(0.4, 9.5, stamp('12주 차 · 새벽 5:40 · 출고장'), ST_Y)
# P2
t1 = at(1, '오류는자주'); t2 = at(1, '이번주에만')
plate('A02', S(2), t1 + .4, speed=0.85)
plate('A03', t1, t2 + .4, speed=0.85)
plate('A07', t2, E(2) + .4, speed=0.8, start=2.0)
tag(S(2) + .2, S(2) + 5.0, stamp('1주 차 · 새벽 5:00'), ST_Y); tag(S(2) + 5.4, S(2) + 11, nametag('윤서 (34)', '물류센터 새벽조 교대조장'), NT_Y)
# P3
t1 = at(2, '윤서씨의휴대')
plate('A04', S(3), t1 + .4, speed=0.85)
plate('A05', t1, E(3) + .4, speed=0.85)
tag(S(3) + .2, S(3) + 5.0, stamp('1주 차 · 오전 7:30 · 휴게실'), ST_Y)
# P4 report XI (real screen, example account)
t1 = at(3, '자산화유형은'); t2 = at(3, '그아래에'); t3 = at(3, '그리고처음'); t4 = at(3, '윤서씨는이한')
c = scard('xi')
screen('xi', S(4), t4 + .4, [(S(4), view_full(c, .9)), (t1, view_rect(c, 60, 165, 600, 115, 1.15)), (t2, view_rect(c, 60, 285, 600, 130, 1.12)), (t3, view_rect(c, 50, 425, 620, 45, 1.3)), (t4 + .4, view_rect(c, 50, 425, 620, 45, 1.25))],
       spots=[(t1 + .2, t2, R(68, 172, 584, 104)), (t2 + .2, t3, R(70, 294, 580, 116)), (t3 + .2, t4 + .4, R(56, 432, 600, 32))], bg='A06', tr='dissolve')
plate('A06', t4, E(4) + .4, speed=0.85)
# P5 weeks 1-4
t0 = at(4, '1주부터'); t1 = at(4, '1주차'); t2 = at(4, '2주차'); t3 = at(4, '3주차'); t4 = at(4, '4주차'); t5 = at(4, '동료가말한')
c = scard('quest')
screen('quest', S(5), t1 + .4, [(S(5), view_full(c, .9)), (t0, view_rect(c, 60, 222, 600, 140, 1.12)), (t1 + .4, view_rect(c, 60, 222, 600, 140, 1.08))], spots=[(t0 + .2, t1 + .4, R(70, 228, 588, 128))], bg='A07', tr='dissolve')
plate('A07', t1, t2 + .4, speed=0.85, start=1.0)
plate('A03', t2, t3 + .4, speed=0.85, start=2.5)
screen('quest', t3, t4 + .4, [(t3, view_rect(c, 60, 222, 600, 140, 1.12)), (t4 + .4, view_rect(c, 60, 222, 600, 140, 1.06))], spots=[(t3 + .2, t4 + .3, R(80, 300, 570, 24))], bg='A06', tr='dissolve')
plate('A08', t4, E(5) + .4, speed=0.85, ov=[(t5 - .1, E(5), C_LOG, CL)])
tag(S(5) + .2, S(5) + 5.5, stamp('1~4주 차 · 해 보고 남기기'), ST_Y)
# P6 weeks 5-8
t1 = at(5, '5주차'); t2 = at(5, '6주차'); t3 = at(5, '7주차'); t4 = at(5, '8주차')
screen('quest', S(6), t1 + .4, [(S(6), view_rect(c, 60, 365, 600, 155, 1.15)), (t1 + .4, view_rect(c, 60, 365, 600, 155, 1.1))], spots=[(S(6) + .3, t1 + .4, R(70, 370, 588, 145))], bg='A09', tr='dissolve')
plate('A09', t1, t2 + .4, speed=0.85)
plate('A10', t2, t3 + .4, speed=0.85, ov=[(t2 + 1.5, t3, C_V2, CL)])
plate('A04', t3, t4 + .4, speed=0.85, start=2.5)
plate('A11', t4, E(6) + .4, speed=0.85)
tag(S(6) + .2, S(6) + 5.5, stamp('5~8주 차 · 보여 주고 고쳐 쓰기'), ST_Y)
# P7 weeks 9-12 intro
screen('quest', S(7), E(7) + .4, [(S(7), view_rect(c, 60, 525, 600, 158, 1.15)), (E(7) + .4, view_rect(c, 60, 525, 600, 158, 1.08))], spots=[(S(7) + .3, E(7) + .3, R(70, 530, 588, 148))], bg='A12', tr='dissolve')
tag(S(7) + .2, E(7), stamp('9~12주 차 · 다음 사람이 쓰는 것'), ST_Y)
# P8 week 9 solo read (현장음 pause precedes)
t1 = at(7, '직원은혼자')
plate('A12', S(8) - 1.2, t1 + .4, speed=0.85)
plate('A13', t1, E(8) + .4, speed=0.85, start=1.5)
tag(S(8) - 1.0, S(8) + 4.5, stamp('9주 차 · 새벽 4:50 · 교육실'), ST_Y)
# P9 weeks 10-12
t1 = at(8, '11주차'); t2 = at(8, '12주차'); t3 = at(8, '누가다시썼나칸')
plate('A14', S(9) - 1.2, t1 + .4, speed=0.85)
plate('A15', t1, t2 + .4, speed=0.85)
screen('quest', t2, E(9) + .4, [(t2, view_rect(c, 60, 685, 600, 130, 1.25)), (t3, view_side(c, 'R', .9)), (E(9) + .4, view_side(c, 'R', .88))], spots=[(t2 + .3, t3, R(36, 694, 290, 118))], ov=[(t3, E(9), C_WHO, CR)], bg='A14', tr='dissolve')
# P10 next step
t1 = at(9, '리포트11장에는')
plate('A16', S(10), t1 + .4, speed=0.85)
c = scard('xi')
screen('xi', t1, E(10) + .4, [(t1, view_rect(c, 50, 535, 620, 40, 1.35)), (E(10) + .4, view_rect(c, 50, 535, 620, 40, 1.3))], spots=[(t1 + .3, E(10) + .3, R(56, 541, 600, 30))], bg='A16', tr='dissolve')
tag(S(10) + .2, S(10) + 5.5, stamp('12주 차 · 오후 2:00 · 사무실'), ST_Y)
# P11 same change, other faces
t1 = at(10, '콜센터'); t2 = at(10, '세사람')
plate('A17', S(11) - 1.2, t1 + .4, speed=0.85)
plate('A18', t1, E(11) + .4, speed=0.85, ov=[(t2, E(11), C_SAME, CL)])
tag(S(11) - 1.0, S(11) + 4.8, stamp('같은 변화, 다른 얼굴'), ST_Y)
tag(S(11) + 5.4, t1 - .2, nametag('현수 (45)', '물류 소프트웨어 회사 창업자'), NT_Y)
tag(t1 + .3, t2 - .3, nametag('태성 (41)', '콜센터 상담원 → 고객경험 연구원 지원'), NT_Y)
# P12 fruit
t1 = at(11, '첫째')
screen('xi', S(12) - 1.2, t1 + .4, [(S(12) - 1.2, view_full(c, .9)), (S(12) + 1.5, view_rect(c, 50, 465, 620, 72, 1.3)), (t1 + .4, view_rect(c, 50, 465, 620, 72, 1.25))], spots=[(S(12) + 1.6, t1 + .4, R(56, 470, 600, 64))], bg='A14', tr='dissolve')
plate('A14', t1, E(12) + .4, speed=0.8, start=2.5, dark=.75, ov=[(t1 + .1, E(12), C_ASSET, CL)])
# P13 close: same final composition (next person's hands)
t1 = at(12, '리포트11장에서')
plate('A01', S(13), t1 + .4, speed=0.85, start=1.0)
screen('xi', t1, VO_END + .5, [(t1, view_full(c, .9)), (VO_END + .5, view_full(c, .86))], spots=[(t1 + .3, VO_END, R(56, 432, 600, 32))], bg='A01', tr='dissolve')
plate('A13', VO_END, TOTAL + .1, speed=0.6, dark=.5, start=3.0)
