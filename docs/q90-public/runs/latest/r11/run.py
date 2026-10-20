import sys,json,base64,pathlib,concurrent.futures as cf,openai,pymupdf,datetime
c=openai.OpenAI(); OUT=pathlib.Path('/home/user/work/r11/ans'); OUT.mkdir(exist_ok=True)
ADD=open('/home/user/work/r11/ADDENDUM.md').read()
def one(bid,model):
  f=OUT/f'{bid}.{model}.json'
  if f.exists(): return bid,model,'cached'
  P=next(pathlib.Path(f'/tmp/chk/{bid}').rglob('sample.pdf')).parent
  rd=(P/'README.md').read_text(); rb=(P/'RUBRIC.md').read_text(); an=(P/'ANSWER.json').read_text()
  d=pymupdf.open(P/'sample.pdf'); dpi=100 if len(d)<=20 else 80; parts=[]
  for i,p in enumerate(d):
    parts+= [{'type':'text','text':f'[sample.pdf {i+1}/{len(d)}쪽]'},{'type':'image_url','image_url':{'url':'data:image/png;base64,'+base64.b64encode(p.get_pixmap(dpi=dpi).tobytes('png')).decode(),'detail':'high'}}]
  u=[{'type':'text','text':f'# README.md\n{rd}\n\n# RUBRIC.md\n{rb}\n\n# {ADD}\n\n# ANSWER.json(빈 양식)\n{an}\n\nsample.pdf 전 쪽을 끝까지 읽은 뒤, 첫 줄에 자기선언 문장, 다음 줄부터 채운 ANSWER.json 하나만(코드블록 없이) 출력하라.'}]+parts
  for k in range(3):
    try:
      r=c.chat.completions.create(model=model,messages=[{'role':'system','content':f'너는 블라인드 채점자다. 패킷 안 자료와 규칙만 쓴다. 기억·외부 자료 금지. actor id = openai:{model}'},{'role':'user','content':u}])
      t=r.choices[0].message.content; a=json.loads(t[t.find('{'):t.rfind('}')+1])
      for ax in ['A1','A2','A3','A4','A5']: a[ax]['level']=int(str(a[ax]['level']).strip().lstrip('Ll'))
      f.write_text(json.dumps({'first_line':t.strip().split('\n')[0],'answer':a,'api_id':r.id,'model':r.model,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()},ensure_ascii=False,indent=1)); return bid,model,'ok'
    except Exception as e: err=str(e)[:120]
  return bid,model,'FAIL '+err
B=sys.argv[2:]; M=sys.argv[1].split(',')
with cf.ThreadPoolExecutor(8) as ex:
  for x in ex.map(lambda p:one(*p),[(b,m) for b in B for m in M]): print(*x,flush=True)
