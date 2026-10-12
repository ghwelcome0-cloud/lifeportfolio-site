#!/usr/bin/env python3
"""E2 집계기 (rubric-v2 aggregation 결박: diff≤1 → 낮은 값 / diff≥2 → 제3자 선택 / 평균·새 값 금지).

Usage: python3 e2-aggregate.py <e2-samples.json> <answersDir> <outFile> [--internal-draft]

- 제3자 답(answers/third/<bid>.third-answer.json)이 있으면 그 선택을 쓴다.
- 없고 diff≥2이면 그 축은 null("미확정(judge 간 차이≥2, 제3자 부재)") 로 두고, 샘플 합계도 null.
- --internal-draft 가 있으면 파일 머리에 "INTERNAL DRAFT — DO NOT PUBLISH"를 박고 공개 폴더(table/)에 쓰는 것을 거부한다(TL 6069927·Method 6069939 결박).
- 이 스크립트는 레벨 값을 stdout에 쓰지 않는다. 집계 결과는 outFile에만.
"""
import sys, json, pathlib, hashlib, datetime
E2, AD, OUT = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
DRAFT = '--internal-draft' in sys.argv
if DRAFT and 'table' in OUT.parts: sys.exit('내부 초안은 공개 폴더(table/)에 쓸 수 없음')
d = json.load(open(E2)); AX = ['A1', 'A2', 'A3', 'A4', 'A5']
rows = []; n_third_used = 0; n_unresolved = 0
for r in d['rows']:
    if r['status'] not in ('judged', 'resolved', 'final'): continue
    bid = r['blind_id']
    a1 = json.load(open(AD / f'{bid}.judge1.json'))['answer']; a2 = json.load(open(AD / f'{bid}.judge2.json'))['answer']
    tp = AD / 'third' / f'{bid}.third-packet.json'; ta = AD / 'third' / f'{bid}.third-answer.json'
    tmap = {it['axis']: it['_map'] for it in json.load(open(tp))['items']} if tp.exists() else {}
    tans = json.load(open(ta))['answer']['picks'] if ta.exists() else {}
    out = {'blind_id': bid, 'id': r['id'], 'axes': {}, 'total': None, 'unresolved_axes': []}
    for ax in AX:
        l1, l2 = int(a1[ax]['level']), int(a2[ax]['level'])
        if abs(l1 - l2) <= 1: out['axes'][ax] = {'level': min(l1, l2), 'rule': 'diff<=1 → lower'}
        elif ax in tans and tans[ax].get('pick') in ('A', 'B'):
            pick = tans[ax]['pick']; who = tmap[ax][pick]; lv = l1 if who == 'judge1' else l2
            out['axes'][ax] = {'level': lv, 'rule': f'diff>=2 → third picked {pick}', 'third_reason': tans[ax].get('reason', '')}; n_third_used += 1
        else:
            out['axes'][ax] = {'level': None, 'rule': 'diff>=2, third absent → 미확정'}; out['unresolved_axes'].append(ax); n_unresolved += 1
    if not out['unresolved_axes']: out['total'] = sum(v['level'] for v in out['axes'].values())
    out['guess'] = {'judge1': (a1.get('guess') or {}).get('thinks_knows'), 'judge2': (a2.get('guess') or {}).get('thinks_knows')}
    rows.append(out)
res = {'_header': 'INTERNAL DRAFT — DO NOT PUBLISH (TL 6069927 · Method 6069939 결박)' if DRAFT else 'E2 aggregated', 'aggregated_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
       'rule': 'diff<=1 → lower; diff>=2 → third picks one; no average/new value', 'n_samples': len(rows), 'n_third_used': n_third_used, 'n_unresolved_axes': n_unresolved,
       'judge_roles': [j['display'] for j in d['judge_sessions']['judges'] if j.get('status') == 'active'], 'limitation': d['judge_sessions'].get('limitation'), 'rows': rows}
OUT.parent.mkdir(parents=True, exist_ok=True); OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1))
print('written', OUT, '| samples', len(rows), '| third used', n_third_used, '| unresolved axes', n_unresolved, '| sha', hashlib.sha256(OUT.read_bytes()).hexdigest()[:16], '| 레벨은 파일에만')
