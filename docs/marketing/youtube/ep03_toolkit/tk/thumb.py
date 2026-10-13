from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
B='/home/user/ax-work/yt-ep03/';A='/home/user/main-wt/assets/blog/asset/'
FD='/home/user/diary-wt/assets/fonts/pretendard/';SER='/usr/share/fonts/truetype/nanum/NanumMyeongjoExtraBold.ttf'
S=3;W,H=1280*S,720*S;GOLD=(214,172,86);DG=(10,40,36)
F=lambda p,s:ImageFont.truetype(p,int(s*S))
def base(n,bright=.82,dark_to=.34):
    bg=Image.open(B+f'thumb/{n}.png').convert('RGB').resize((W,H),Image.LANCZOS);bg=ImageEnhance.Brightness(bg).enhance(bright)
    g=Image.new('L',(W,H));gd=ImageDraw.Draw(g)
    for x in range(0,W,2): gd.line([(x,0),(x,H)],fill=int(max(0,215-(x/S)*dark_to)))
    return Image.composite(Image.new('RGB',(W,H),(6,22,20)),bg,g).convert('RGBA')
def card(src,crop,w,rot,ring=None):
    sc=Image.open(A+src).convert('RGB')
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
def txt(d,xy,t,f,fill,sh=True):
    if sh: d.text((xy[0]*S+4*S,xy[1]*S+5*S),t,font=f,fill=(0,0,0,180))
    d.text((xy[0]*S,xy[1]*S),t,font=f,fill=fill)
def badge(d,x,y,t,size=40,bgc=GOLD,fg=DG,padx=26,pady=12):
    f=F(FD+'Pretendard-ExtraBold.woff2',size);w=f.getbbox(t)[2]/S
    d.rounded_rectangle((x*S,y*S,(x+w+padx*2)*S,(y+size+pady*2)*S),12*S,fill=bgc);d.text(((x+padx)*S,(y+pady-size*0.08)*S),t,font=f,fill=fg);return w+padx*2
def save(im,n):
    im=im.convert('RGB');im.save(B+f'build/thumb/{n}_3840.jpg',quality=90);im.resize((1280,720),Image.LANCZOS).save(B+f'build/thumb/{n}_1280.jpg',quality=92)
BF=FD+'Pretendard-Bold.woff2'
# V1 launch: pathfinding open (cutaway building + diary-path card)
bg=base('bgA');put(bg,card('diary-path.webp',(0,0,720,820),330,-4,ring=(20,382,650,390)),850,120)
d=ImageDraw.Draw(bg);badge(d,64,66,'NEW 출시',40)
txt(d,(60,175),'자산화',F(SER,140),(255,255,255));txt(d,(60,330),'길찾기',F(SER,140),GOLD)
txt(d,(66,530),'고유성 기반 자산화 길찾기 · 이용 가능',F(BF,38),(240,236,225))
save(bg,'V1_launch')
# V2 first door
bg=base('bgB',.85);put(bg,card('home-routes.webp',(0,0,1000,520),420,4),800,170)
d=ImageDraw.Draw(bg);badge(d,64,66,'출시',40)
txt(d,(60,175),'발견한 나를,',F(SER,104),(255,255,255));txt(d,(60,305),'남기는 길로',F(SER,104),GOLD)
txt(d,(66,490),'일곱 가지 변화 · 리포트 XI장 · 실행 프로그램',F(BF,34),(240,236,225))
save(bg,'V2_found_to_left')
# V3 12 weeks one card
bg=base('bgC',.85);put(bg,card('program-quest.webp',(40,150,680,520),470,-4,ring=(30,80,580,135)),760,240)
d=ImageDraw.Draw(bg);badge(d,64,66,'NEW · 실행 프로그램',38)
txt(d,(60,180),'12주,',F(SER,130),(255,255,255));txt(d,(60,330),'카드 한 장',F(SER,118),GOLD)
txt(d,(66,520),'자산화 맞춤 실행 프로그램 출시',F(BF,38),(240,236,225))
save(bg,'V3_12weeks')
ims=[Image.open(B+f'build/thumb/{n}_1280.jpg') for n in ['V1_launch','V2_found_to_left','V3_12weeks']]
sheet=Image.new('RGB',(1280*3//2+40,720//2*3+160),(255,255,255))
for i,im in enumerate(ims):
    sheet.paste(im.resize((640,360)),(0,i*370));sheet.paste(im.resize((246,138)),(680,i*370+20));sheet.paste(im.resize((168,94)),(950,i*370+20))
sheet.save(B+'build/thumb/compare_sheet.jpg',quality=88)
