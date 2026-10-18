import json,subprocess,concurrent.futures as cf
A={'05':['LJKMH0i1','NoxZ1LQR','YFnoeWam','QZmFC5TA'],'06':['xOq9GsoC','HPTliVJ5','wbczfLz3','VpdnHkkt'],
'07':['z6jrPhHE','InEPGHPt','TM18DWIR','pmkWkyZZ'],'08':['5Am3Od0z','MWdvXSWs','qrxA5bG6','YLwqfNEo'],
'09':['MgheCj5X','QpmNOxFB','makjM4N3','rIN4Lt2j'],'10':['9HfrvULy','WNBQZKSe','7z8t5TIO','diaXEu5k']}
N=['bgm','sfx_main','sfx_paper','sfx_office']
jobs=[(e,N[i],id) for e,l in A.items() for i,id in enumerate(l)]
def get(j):
    e,n,id=j
    u=json.loads(subprocess.run(['gsk','download','https://www.genspark.ai/api/files/s/'+id],capture_output=True,text=True).stdout)['data']['download_url']
    subprocess.run(['mkdir','-p',f'yt-ep{e}/build']); subprocess.run(['curl','-sL',u,'-o',f'yt-ep{e}/build/{n}.mp3'])
with cf.ThreadPoolExecutor(8) as ex: list(ex.map(get,jobs))
