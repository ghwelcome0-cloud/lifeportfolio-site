#!/usr/bin/env python3
"""ab-compare.py — A2·B3 비교 도구(scorer와 별개, 보조 공개용). 공식 점수에 영향 없음.
usage: ab-compare.py <map_A2.json> <map_B3.json> <judge_A2_run.json> <judge_B3_run.json> [--judge <id>]
계산식(결박): 같은 case_id·lang 쌍(B3가 있는 쌍, 최대 20)에서, 지표별 level = 1 + (true 체크 수) (anchors: 0/4→1 … 4/4→5; 체크 수가 4가 아니면 round(1+4*true/n)).
  diff = level_B3 − level_A2 (지표별, 쌍별). 출력: 지표별 평균 diff, 부호 일치 비율(diff<0 쌍 비율 = contrast가 낮게 나온 비율), 쌍 수.
  두 judge 각각 따로, run1만 사용(run2는 일치도 용도). 값은 실행 시에만 읽는다."""
import json,sys,statistics
def load_map(p):
    j=json.load(open(p,encoding='utf-8')); m=j.get('map',j)
    return {lab:(v['case_id'],v['lang']) for lab,v in m.items()}
def iter_units(j):
    # 형식 1: {bundles:[{units:[{label,lang,indicators:{A1:[{value}...]}}]}]}
    # 형식 2: {units:[{label,language,indicators:{A1:{checks:[{value}...]}}}]}
    if 'bundles' in j:
        for b in (j['bundles'].values() if isinstance(j['bundles'],dict) else j['bundles']):
            for u in b.get('units',[]): yield u
    else:
        for u in j.get('units',[]): yield u
def levels(u):
    out={}
    for ind,v in (u.get('indicators') or {}).items():
        checks=v.get('checks') if isinstance(v,dict) else v
        vals=[]
        for c in checks or []:
            x=c.get('value') if isinstance(c,dict) else c
            if isinstance(x,str): x=x.lower() in ('true','참')
            vals.append(bool(x))
        n=len(vals)
        if n==0: continue
        t=sum(vals); out[ind]= (1+t) if n==4 else round(1+4*t/n)
    return out
def main():
    mA,mB=load_map(sys.argv[1]),load_map(sys.argv[2])
    jA,jB=json.load(open(sys.argv[3],encoding='utf-8')),json.load(open(sys.argv[4],encoding='utf-8'))
    byA={mA[u['label']]:levels(u) for u in iter_units(jA) if u.get('label') in mA}
    byB={mB[u['label']]:levels(u) for u in iter_units(jB) if u.get('label') in mB}
    pairs=[k for k in byB if k in byA]
    inds=sorted({i for k in pairs for i in byA[k]} & {i for k in pairs for i in byB[k]})
    res={'pairs':len(pairs),'formula':'level=1+true_checks(4-check); diff=level_B3-level_A2 per (case_id,lang) pair; run1 only','per_indicator':{}}
    for i in inds:
        d=[byB[k][i]-byA[k][i] for k in pairs if i in byA[k] and i in byB[k]]
        if d: res['per_indicator'][i]={'n':len(d),'mean_diff':round(statistics.mean(d),3),'share_B_lower':round(sum(1 for x in d if x<0)/len(d),3),'share_equal':round(sum(1 for x in d if x==0)/len(d),3)}
    print(json.dumps(res,ensure_ascii=False,indent=1))
if __name__=='__main__': main()
