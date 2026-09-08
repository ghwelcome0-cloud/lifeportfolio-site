import shots38 as S
rows = {r['sid']: r for r in S.TABLE38}
pm = S.plate_manifest()
for a in ['S23','S24','S25','S26','S27']:
    e = pm[a]
    print('==', a, e['kind'], 'rows', e['rows'], 'secs', e['secs'], 'moves', e['moves'], 'levels', e['levels'])
    print('   objects(n=%d):' % len(e.get('objects') or []), e.get('objects'))
    print('   protect:', e.get('protect'))
    for sid in e['rows']:
        r = rows[sid]
        print('   >', sid, round(r['t0'],2), '-', round(r['t1'],2))
        print('     narr:', (r.get('narr') or '')[:120])
        print('     cam :', (r.get('note') or '')[:130])
