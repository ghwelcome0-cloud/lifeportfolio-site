import json,base64,pathlib,random,concurrent.futures as cf,openai,pymupdf,hashlib
c=openai.OpenAI(); A=pathlib.Path('ans'); T=pathlib.Path('third'); T.mkdir(exist_ok=True)
ADD=open('ADDENDUM.md').read(); AX=['A1','A2','A3','A4','A5']
B=sorted({p.name.split('.')[0] for p in A.glob('*.json')})
jobs=[]
for b in B:
  a1=json.load(open(A/f'{b}.gpt-5.2.json'))['answer'];a2=json.load(open(A/f'{b}.gpt-5.1.json'))['answer']
  for ax in AX:
    if abs(int(a1[ax]['level'])-int(a2[ax]['level']))>=2: jobs.append((b,ax,a1[ax],a2[ax]))
print('need third',len(jobs))
def one(j):
  b,ax,x1,x2=j; f=T/f'{b}.{ax}.json'
  if f.exists(): return b,ax,'cached'
  rnd=random.Random(hashlib.sha256(f'{b}{ax}'.encode()).hexdigest()); pair=[('gpt-5.2',x1),('gpt-5.1',x2)]; rnd.shuffle(pair)
  P=next(pathlib.Path(f'/tmp/chk/{b}').rglob('sample.pdf')).parent; rb=(P/'RUBRIC.md').read_text()
  d=pymupdf.open(P/'sample.pdf'); dpi=90 if len(d)<=20 else 70; parts=[]
  for i,p in enumerate(d): parts+=[{'type':'text','text':f'[{i+1}/{len(d)}쪽]'},{'type':'image_url','image_url':{'url':'data:image/png;base64,'+base64.b64encode(p.get_pixmap(dpi=dpi).tobytes('png')).decode()}}]
  q=f'# RUBRIC.md\n{rb}\n\n{ADD}\n\n두 평가자의 {ax} 판정이 2단계 이상 다릅니다. 자료를 보고 X 또는 Y 하나만 고르세요(평균·새 값 금지).\nX: L{pair[0][1]["level"]} — {pair[0][1]["reason"]}\nY: L{pair[1][1]["level"]} — {pair[1][1]["reason"]}\nJSON만: {{"pick":"X|Y","reason":"한 문장"}}'
  r=c.chat.completions.create(model='gpt-5',messages=[{'role':'system','content':'너는 제3 판정자다. 제시 자료와 루브릭만 본다.'},{'role':'user','content':[{'type':'text','text':q}]+parts}])
  t=r.choices[0].message.content; o=json.loads(t[t.find('{'):t.rfind('}')+1]); pk=o['pick'].strip().upper()[0]
  who=pair[0][0] if pk=='X' else pair[1][0]; lv=int(pair[0][1]['level'] if pk=='X' else pair[1][1]['level'])
  f.write_text(json.dumps({'blind_id':b,'axis':ax,'pick':pk,'picked':who,'level':lv,'reason':o.get('reason',''),'map':{'X':pair[0][0],'Y':pair[1][0]},'api_id':r.id},ensure_ascii=False,indent=1)); return b,ax,'ok'
with cf.ThreadPoolExecutor(8) as ex:
  for x in ex.map(one,jobs): print(*x)
