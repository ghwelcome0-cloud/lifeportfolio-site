from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
B='/home/user/ax-work/yt-ep02/';P='/home/user/ax-work/content/promo/'
FD='/home/user/diary-wt/assets/fonts/pretendard/';SER='/usr/share/fonts/truetype/nanum/NanumMyeongjoExtraBold.ttf'
S=3;W,H=1280*S,720*S;GOLD=(201,160,79);DG=(11,40,28)
F=lambda p,s:ImageFont.truetype(p,int(s*S))
def base(plate,bright=.7,dark_to=0.30):
    bg=Image.open(B+f'plates/{plate}.png').convert('RGB').resize((W,int(W*768/1360)),Image.LANCZOS).crop((0,0,W,H))
    bg=ImageEnhance.Brightness(bg).enhance(bright)
    g=Image.new('L',(W,H));gd=ImageDraw.Draw(g)
    for x in range(0,W,2): gd.line([(x,0),(x,H)],fill=int(max(0,225-(x/S)*dark_to)))
    return Image.composite(Image.new('RGB',(W,H),(8,16,12)),bg,g).convert('RGBA')
def card(src,crop,w,rot,ring=None):
    sc=Image.open(P+src).convert('RGB').crop(crop);h=int(w*sc.height/sc.width);sc=sc.resize((w*S,h*S),Image.LANCZOS)
    m=Image.new('L',sc.size,0);ImageDraw.Draw(m).rounded_rectangle((0,0,sc.width-1,sc.height-1),18*S,fill=255)
    c=Image.new('RGBA',sc.size);c.paste(sc,(0,0),m)
    if ring:
        d=ImageDraw.Draw(c);x,y,ww,hh=[v*S*w/(crop[2]-crop[0]) for v in ring];d.rounded_rectangle((x,y,x+ww,y+hh),14*S,outline=GOLD,width=6*S)
    return c.rotate(rot,expand=True,resample=Image.BICUBIC)
def put(bg,c,x,y):
    sh=Image.new('RGBA',(c.width+80*S,c.height+80*S),(0,0,0,0));sh.paste((0,0,0,170),(40*S,52*S),c);sh=sh.filter(ImageFilter.GaussianBlur(18*S))
    bg.alpha_composite(sh,((x-40)*S,(y-40)*S));bg.alpha_composite(c,(x*S,y*S))
def txt(d,xy,t,f,fill,sh=True):
    if sh: d.text((xy[0]*S+4*S,xy[1]*S+5*S),t,font=f,fill=(0,0,0,170))
    d.text((xy[0]*S,xy[1]*S),t,font=f,fill=fill)
def badge(d,x,y,t,size=40,bgc=GOLD,fg=DG,padx=26,pady=12):
    f=F(FD+'Pretendard-ExtraBold.woff2',size);w=f.getbbox(t)[2]/S
    d.rounded_rectangle((x*S,y*S,(x+w+padx*2)*S,(y+size+pady*2)*S),12*S,fill=bgc);d.text(((x+padx)*S,(y+pady-size*0.08)*S),t,font=f,fill=fg)
    return w+padx*2
def save(im,n):
    im=im.convert('RGB');im.save(B+f'build/thumb/{n}_3840.jpg',quality=92);im.resize((1280,720),Image.LANCZOS).save(B+f'build/thumb/{n}_1280.jpg',quality=92)
# V1 launch announcement
bg=base('A');put(bg,card('pc-spread.png',(360,140,2520,1700),600,-4,ring=(1180,640,330,70)),640,150)
d=ImageDraw.Draw(bg);badge(d,64,70,'NEW 출시',40)
txt(d,(60,190),'내',F(SER,150),(255,255,255));txt(d,(60,350),'다이어리',F(SER,150),(255,255,255))
txt(d,(66,560),'인생포트폴리오 새 서비스',F(FD+'Pretendard-Bold.woff2',44),GOLD)
save(bg,'V1_launch')
# V2 report → diary
bg=base('A',.68);put(bg,card('pc-cover.png',(1180,140,1700,1700),230,5),1010,90);put(bg,card('pc-mission.png',(360,140,2520,1700),470,-5,ring=(1190,380,890,260)),700,270)
d=ImageDraw.Draw(bg);badge(d,64,70,'출시',40)
txt(d,(60,180),'리포트가',F(SER,118),(255,255,255));txt(d,(60,330),'다이어리로',F(SER,118),GOLD)
txt(d,(66,540),'인생포트폴리오 「내 다이어리」',F(FD+'Pretendard-Bold.woff2',40),(240,236,225))
save(bg,'V2_report_to_diary')
# V3 feature close-up (dark green brand field)
bg=Image.new('RGBA',(W,H),(9,38,27,255));pl=base('C',.55,.0);bg=Image.blend(bg,pl,.35)
ph=Image.open(P+'m-fab.png').convert('RGB').crop((0,0,1170,2532)).resize((300*S,650*S),Image.LANCZOS)
fr=Image.new('RGBA',(ph.width+24*S,ph.height+24*S),(0,0,0,0));ImageDraw.Draw(fr).rounded_rectangle((0,0,fr.width-1,fr.height-1),46*S,fill=(16,16,16,255))
m=Image.new('L',ph.size,0);ImageDraw.Draw(m).rounded_rectangle((0,0,ph.width-1,ph.height-1),36*S,fill=255);fr.paste(ph,(12*S,12*S),m)
fr=fr.rotate(-6,expand=True,resample=Image.BICUBIC);put(bg,fr,930,40)
put(bg,card('pc-lifemap-1-l.png',(1480,140,2520,1700),300,4),690,170)
d=ImageDraw.Draw(bg);badge(d,64,70,'NEW · 내 다이어리',38)
txt(d,(60,190),'1년을 담는',F(SER,100),(255,255,255));txt(d,(60,320),'나만의 한 권',F(SER,100),(255,255,255))
txt(d,(66,520),'리포트에서 시작하는 다이어리 출시',F(FD+'Pretendard-Bold.woff2',34),GOLD)
save(bg,'V3_one_book')
# mobile-size readability preview: 3 variants at 246x138 (phone list size) + 1280 sheet
ims=[Image.open(B+f'build/thumb/{n}_1280.jpg') for n in ['V1_launch','V2_report_to_diary','V3_one_book']]
sheet=Image.new('RGB',(1280*3//2+40, 720//2*3+ 160),(255,255,255))
for i,im in enumerate(ims):
    sheet.paste(im.resize((640,360)),(0,i*370));sheet.paste(im.resize((246,138)),(680,i*370+20));sheet.paste(im.resize((168,94)),(950,i*370+20))
sheet.save(B+'build/thumb/compare_sheet.jpg',quality=88)
