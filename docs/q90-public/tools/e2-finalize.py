#!/usr/bin/env python3
"""E2 집계 결과(e2-aggregate.py 출력)를 시트 행의 A1~A5·final 로 전사한다.

Usage: python3 e2-finalize.py <e2-samples.json> <aggregate.json> [blind_id ...]

- blind_id 를 주면 그 행만, 없으면 집계 파일의 모든 행(미확정 축이 있는 행은 건너뜀).
- 값은 집계 파일 그대로(평균·새 값 금지). 총괄은 이 단계에서 처음으로 레벨을 본다(표 생성 직전).
- 이전(1~2회차)에는 이 전사를 인라인 스크립트로 했다 → 반복 작업은 도구로(KB 자산화, 2026-10-12).
"""
import sys, json, hashlib, datetime, pathlib

E2, AGG = sys.argv[1], sys.argv[2]; only = set(sys.argv[3:])
d = json.load(open(E2)); agg = json.load(open(AGG))
rows = {r['blind_id']: r for r in d['rows'] if r.get('blind_id')}
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
asha = hashlib.sha256(pathlib.Path(AGG).read_bytes()).hexdigest()
n = 0
for a in agg['rows']:
    bid = a['blind_id']
    if only and bid not in only: continue
    if a.get('unresolved_axes'): print(bid, 'skip: unresolved', a['unresolved_axes']); continue
    r = rows[bid]
    if r.get('final', {}).get('total') is not None and not only:
        continue  # 이미 전사된 행은 건드리지 않는다(값 덮어쓰기 금지)
    for ax, v in a['axes'].items(): r[ax] = v['level']
    r['final'] = {'rule': agg.get('rule'), 'total': a['total'], 'axes': a['axes'], 'resolved_at': now,
                  'third_used': [ax for ax, v in a['axes'].items() if 'third' in str(v.get('rule', ''))], 'aggregate_sha256': asha}
    n += 1; print(bid, r['id'], 'transcribed', {ax: v['level'] for ax, v in a['axes'].items()})
json.dump(d, open(E2, 'w'), ensure_ascii=False, indent=1)
print('rows transcribed', n)
