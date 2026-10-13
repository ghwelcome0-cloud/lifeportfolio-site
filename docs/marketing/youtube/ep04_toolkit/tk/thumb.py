from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
B='/home/user/ax-work/yt-ep04/'
FD='/home/user/diary-wt/assets/fonts/pretendard/';SER='/usr/share/fonts/truetype/nanum/NanumMyeongjoExtraBold.ttf'
S=3;W,H=1280*S,720*S;GOLD=(214,172,86);DG=(10,40,36)
F=lambda p,s:ImageFont.truetype(p,int(s*S));BF=FD+'Pretendard-Bold.woff2'
def base(n,bright=.9,dark_to=.30,flip=False):
    bg=Image.open(B+f'plates/{n}.png').convert('RGB').resize((W,H),Image.LANCZOS)
    if flip: bg=bg.transpose(Image.FLIP_LEFT_RIGHT)
    bg=ImageEnhance.Brightness(bg).enhance(bright)
    g=Image.new('L',(W,H));gd=ImageDraw.Draw(g)
    for x in range(0,W,2): gd.line([(x,0),(x,H)],fill=int(max(0,215-(x/S)*dark_to)))
    return Image.composite(Image.new('RGB',(W,H),(6,22,20)),bg,g).convert('RGBA')
def card(src,crop,w,rot,ring=None):
    sc=Image.open(B+'screens/'+src).convert('RGB')
    if crop: sc=sc.crop(crop)
    cw=sc.width;h=int(w*sc.height/sc.width);sc=sc.resize((w*S,h*S),Image.LANCZOS)
    m=Image.new('L',sc.size,0);ImageDraw.Draw(m).rounded_rectangle((0,0,sc.width-1,sc.height-1),18*S,fill=255)
    c=Image.new('RGBA',sc.size);c.paste(sc,(0,0),m)
    if ring:
        d=ImageDraw.Draw(c);k=S*w/cw;x,y,ww,hh=[v*k for v in ring];d.rounded_rectangle((x,y,x+ww,y+hh),14*S,outline=GOLD,width=6*S)
    return c.rotate(rot,expand=True,resample=Image.BICUBIC)
def put(bg,c,x,y):
    sh=Image.new('RGBA',(c.width+80*S,c.height+80*S),(0,0,0,0));sh.paste((0,0,0,170),(40*S,52*S),c);sh=sh.filter(ImageFilter.GaussianBlur(18*S))
    bg.alpha_composite(sh,((x-40)*S,(y-40)*S));bg.alpha_composite(c,(x*S,y*S))
def txt(d,xy,t,f,fill):
    d.text((xy[0]*S+4*S,xy[1]*S+5*S),t,font=f,fill=(0,0,0,180)); d.text((xy[0]*S,xy[1]*S),t,font=f,fill=fill)
def badge(d,x,y,t,size=38):
    f=F(FD+'Pretendard-ExtraBold.woff2',size);w=f.getbbox(t)[2]/S
    d.rounded_rectangle((x*S,y*S,(x+w+52)*S,(y+size+24)*S),12*S,fill=GOLD);d.text(((x+26)*S,(y+12-size*0.08)*S),t,font=f,fill=DG)
def save(im,n):
    im=im.convert('RGB');im.save(B+f'build/thumb/{n}_3840.jpg',quality=90);im.resize((1280,720),Image.LANCZOS).save(B+f'build/thumb/{n}_1280.jpg',quality=92)
# V1: the sheet in the new lead's hands (hook)
bg=base('A13',.95,.30,flip=True);d=ImageDraw.Draw(bg);badge(d,64,66,'EP.04 · 밝힘')
txt(d,(60,175),'10분 설명서',F(SER,120),(255,255,255));txt(d,(60,320),'한 장',F(SER,150),GOLD)
txt(d,(66,520),'모르던 것을 알게 하는 사람',F(BF,40),(240,236,225))
save(bg,'V1_sheet')
# V2: real XI card
bg=base('A02',.9,.32,flip=True);put(bg,card('xi.webp',(0,140,720,560),430,-4,ring=(60,32,600,250)),780,150)
d=ImageDraw.Draw(bg);badge(d,64,66,'EP.04 · 밝힘')
txt(d,(60,180),'같은 질문을',F(SER,104),(255,255,255));txt(d,(60,310),'종이 한 장에',F(SER,104),GOLD)
txt(d,(66,500),'리포트 XI장 · 12주 자산화 퀘스트',F(BF,36),(240,236,225))
save(bg,'V2_xi')
# V3: 12 weeks
bg=base('A14',.9,.30,flip=True);put(bg,card('quest.webp',(40,200,680,620),470,4,ring=(30,30,610,150)),760,200)
d=ImageDraw.Draw(bg);badge(d,64,66,'EP.04 · 밝힘')
txt(d,(60,180),'12주 뒤',F(SER,130),(255,255,255));txt(d,(60,330),'남은 것',F(SER,130),GOLD)
txt(d,(66,520),'원인과 해결 순서 → 지적 자산',F(BF,38),(240,236,225))
save(bg,'V3_12weeks')
ims=[Image.open(B+f'build/thumb/{n}_1280.jpg') for n in ['V1_sheet','V2_xi','V3_12weeks']]
sheet=Image.new('RGB',(1160,370*3),(255,255,255))
for i,im in enumerate(ims):
    sheet.paste(im.resize((640,360)),(0,i*370));sheet.paste(im.resize((246,138)),(680,i*370+20));sheet.paste(im.resize((168,94)),(950,i*370+20))
sheet.save(B+'build/thumb/compare_sheet.jpg',quality=88)
