import sys
from PIL import Image, ImageDraw, ImageFont
d,out,title=sys.argv[1],sys.argv[2],sys.argv[3]
f=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf',22) if __import__('os').path.exists('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf') else ImageFont.load_default()
W,H=480,270;c=Image.new('RGB',(W*3,H*6+50),(20,20,24));g=ImageDraw.Draw(c);g.text((12,10),title,fill='white',font=f)
for i in range(18):
  im=Image.open(f'{d}/A{i+1:02d}.png').convert('RGB').resize((W,H));x,y=(i%3)*W,50+(i//3)*H;c.paste(im,(x,y))
  g.rectangle([x,y,x+56,y+30],fill=(0,0,0));g.text((x+6,y+2),f'A{i+1:02d}',fill='white',font=f)
c.save(out,quality=85)
