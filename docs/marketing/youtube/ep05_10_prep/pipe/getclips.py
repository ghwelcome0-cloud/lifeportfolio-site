import json,subprocess,sys,concurrent.futures as cf
e=sys.argv[1]; ids=sys.argv[2:]
def get(a):
    i,id=a
    if id=='-': return
    u=json.loads(subprocess.run(['gsk','download','https://www.genspark.ai/api/files/s/'+id],capture_output=True,text=True).stdout)['data']['download_url']
    subprocess.run(['curl','-sL',u,'-o',f'yt-ep{e}/clips/A{i+1:02d}.mp4'])
with cf.ThreadPoolExecutor(9) as ex: list(ex.map(get,enumerate(ids)))
