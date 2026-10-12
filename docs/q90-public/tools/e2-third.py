#!/usr/bin/env python3
"""E2 제3자 단계 (rubric-v2 aggregation: diff≤1 → 낮은 값, diff≥2 → 제3자가 둘 중 하나를 고름, 평균·새 값 금지).

Usage: python3 e2-third.py <e2-samples.json> <answersDir> prepare   → 차이≥2 축 목록을 뽑아 제3자용 패킷(JSON)을 만든다(점수는 화면에 안 찍음)
       python3 e2-third.py <e2-samples.json> <answersDir> send      → 제3자 DM으로 보낸다(패킷마다 1메시지)
       python3 e2-third.py <e2-samples.json> <answersDir> poll      → 답을 받아 저장한다

결박: 이 스크립트는 축별 레벨 값을 stdout에 쓰지 않는다(총괄도 표 생성 전 미열람). 파일로만 쓴다.
제3자에게는 blind_id·축·두 답안(레벨+이유)만 보낸다. 어느 쪽이 judge1인지 모르게 A/B 무작위.
"""
import sys, json, pathlib, random, hashlib, datetime, subprocess, tempfile, re
E2, AD, CMD = sys.argv[1], pathlib.Path(sys.argv[2]), sys.argv[3]
d = json.load(open(E2)); js = d['judge_sessions']; third = next((j for j in js['judges'] if j['role'] == 'third' and j.get('status') == 'active'), None)
AX = ['A1', 'A2', 'A3', 'A4', 'A5']
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
TD = AD / 'third'; TD.mkdir(exist_ok=True)
def rubric_sha(tgz):
    import tarfile
    with tarfile.open(tgz) as t:
        for m in t.getmembers():
            if m.name.endswith('RUBRIC.md'): return hashlib.sha256(t.extractfile(m).read()).hexdigest()
    return 'none'
def save(): json.dump(d, open(E2, 'w'), ensure_ascii=False, indent=1)
def gsk(*a, infile=None):
    c = ['gsk', 'genteam', *a] + (['--args-file', infile] if infile else [])
    o = subprocess.run(c, capture_output=True, text=True, timeout=120).stdout
    try: return json.loads(o)
    except Exception: return {'raw': o[:300]}


if CMD == 'register':
    # python3 e2-third.py <e2> <answersDir> register <agent_id> <dm_channel_id> <display_name> <model_display> <bio_file>
    aid, dm, disp, model, bio = sys.argv[4:9]
    btxt = pathlib.Path(bio).read_text()
    assert not any(w in btxt for w in ['Q90', '인생포트폴리오', '진로검사', '파이스']), 'bio에 금지어'
    sha = hashlib.sha256(pathlib.Path(bio).read_bytes()).hexdigest()
    js['judges'].append({'role': 'third', 'actor_id': aid, 'dm_channel_id': dm, 'display_name': disp, 'status': 'active', 'registered_at': now(),
        'third_agent_creation': {'created_by': '대표(이해관계자)', 'created_at': now(), 'agent_id': aid, 'display_name': disp, 'description_sha256': sha,
            'description_text': btxt, 'model_display': model, 'channels': [], 'template': 'none(blank New agent)', 'skills': 0,
            'model_note': ('대표 선택 Opus 5.5 — 명세 v2 권고(Opus 5.5 아닌 것)와 다름. 교체 judge1과 같은 모델 → 같은 모델 답에 끌릴 가능성(추정)을 한계 줄에 기록' if '5.5' in model else '')}})
    save(); print('registered third', aid, dm, 'bio sha', sha[:16], 'model', model)
    sys.exit(0)
if third is None and CMD != 'prepare':
    sys.exit('active third 없음 — register 먼저')

if CMD == 'prepare':
    rnd = random.Random(hashlib.sha256(open(E2, 'rb').read()).hexdigest())
    summary = []
    for bid in d['packet_order']:
        # 결박: 이미 제3자 답이 있거나 패킷이 발송된 blind_id는 다시 섞지 않는다(X/Y 배정이 바뀌면 기록된 선택이 뒤집힘 — 2026-10-12 근접 사고)
        if (TD / f'{bid}.third-answer.json').exists() or (third and bid in (third.get('packets') or {})):
            summary.append((bid, len(json.loads((TD / f'{bid}.third-packet.json').read_text())['items']))); continue
        a1 = json.load(open(AD / f'{bid}.judge1.json'))['answer']; a2 = json.load(open(AD / f'{bid}.judge2.json'))['answer']
        items = []
        for ax in AX:
            l1, l2 = int(a1[ax]['level']), int(a2[ax]['level'])
            if abs(l1 - l2) >= 2:
                pair = [('judge1', a1[ax]), ('judge2', a2[ax])]; rnd.shuffle(pair)
                items.append({'axis': ax, 'A': {'level': pair[0][1]['level'], 'reason': pair[0][1]['reason']}, 'B': {'level': pair[1][1]['level'], 'reason': pair[1][1]['reason']}, '_map': {'A': pair[0][0], 'B': pair[1][0]}})
        (TD / f'{bid}.third-packet.json').write_text(json.dumps({'blind_id': bid, 'items': items}, ensure_ascii=False, indent=1))
        summary.append((bid, len(items)))
    json.dump({'prepared_at': now(), 'need_third': {b: n for b, n in summary}}, open(TD / '_summary.json', 'w'), ensure_ascii=False, indent=1)
    print('차이≥2 축 수(blind_id별):', {b: n for b, n in summary}, '| 레벨 값은 파일에만 기록')

elif CMD == 'send':
    pk = third.setdefault('packets', {})
    for bid in d['packet_order']:
        p = json.loads((TD / f'{bid}.third-packet.json').read_text())
        if not p['items'] or bid in pk: continue
        tgz = AD.parent / f'{bid}.tar.gz'
        lines = [f'[제3자 판정 · {bid} · 축 {len(p["items"])}개]', '',
                 '두 평가자의 답이 2단계 이상 벌어진 축만 왔습니다. 첨부 tar 안의 sample.pdf(그림 PDF)를 끝까지 읽고, 같은 tar 안의 RUBRIC.md 해당 축 문구·레벨 앵커만 기준으로, 축마다 **X 또는 Y 중 하나만** 고르고 이유 1문장(자료의 어느 부분 때문인지)을 적어 주세요. 평균·새 값은 안 됩니다.',
                 'tar 안의 README·ANSWER 파일은 앞선 채점자용 안내입니다. 당신의 일은 아래 축의 X/Y 선택뿐입니다. (RUBRIC.md sha256: ' + rubric_sha(tgz) + ')',
                 '답장 첫 줄은 자기선언: "나는 이 평가 대상의 다른 역할(작성·검수·채점·심판)에 관여한 적이 없다". 마지막에 competitor_research_done_before(true/false + 한 줄)와 pages_viewed/pages_total을 적어 주세요.', '']
        for it in p['items']:
            lines += [f'### {it["axis"]}', f'- X: L{it["A"]["level"]} — {it["A"]["reason"]}', f'- Y: L{it["B"]["level"]} — {it["B"]["reason"]}', '']
        lines += ['답 형식(JSON): {"blind_id":"' + bid + '","picks":{' + ','.join(f'"{it["axis"]}":{{"pick":"X|Y","reason":""}}' for it in p['items']) + '},"competitor_research_done_before":null,"pages_viewed":null,"pages_total":null}']
        up = json.loads(subprocess.run(['gsk', 'upload', str(tgz)], capture_output=True, text=True).stdout)['data']['file_wrapper_url']
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
            json.dump({'channel_id': third['dm_channel_id'], 'content': '\n'.join(lines), 'file_path': up, 'file_name': f'{bid}.tar.gz'}, f, ensure_ascii=False); fn = f.name
        r = gsk('send', '--yes', infile=fn); mid = r.get('data', {}).get('comet_message_id')
        recv = None
        for it in gsk('read', '--channel_id', third['dm_channel_id'], '--limit', '3').get('data', {}).get('items', []):
            m = it.get('data', {})
            if str(m.get('comet_message_id')) == str(mid):
                for a in m.get('attachments') or []: recv = gsk('download', '--channel_id', third['dm_channel_id'], '--attachment_ref', a['attachment_ref']).get('data', {}).get('sha256')
        pk[bid] = {'sent_msg_id': mid, 'sent_at': now(), 'axes': [it['axis'] for it in p['items']], 'attachment_sha256_sent': hashlib.sha256(tgz.read_bytes()).hexdigest(), 'attachment_sha256_received_redownload': recv, 'bytes_match': recv == hashlib.sha256(tgz.read_bytes()).hexdigest() if recv else None, 'reply_msg_id': None}
        save(); print('third', bid, 'sent', mid, 'axes', pk[bid]['axes'], 'bytes_match', pk[bid]['bytes_match'])

elif CMD == 'poll':
    pk = third.get('packets', {})
    for bid, rec in pk.items():
        if rec.get('reply_msg_id'): continue
        for it in gsk('read', '--channel_id', third['dm_channel_id'], '--after_message_id', str(rec['sent_msg_id']), '--limit', '10').get('data', {}).get('items', []):
            m = it.get('data', {})
            if m.get('sender_actor_id') != third['actor_id']: continue
            txt = m.get('display_text') or m.get('content') or ''
            mm = re.search(r'\{.*\}', txt, re.S)
            if not mm: continue
            try: ans = json.loads(mm.group(0))
            except Exception: continue
            if ans.get('blind_id') != bid: continue
            for ax, v in (ans.get('picks') or {}).items():
                if isinstance(v, dict) and v.get('pick') in ('X', 'Y'): v['pick_label'] = v['pick']; v['pick'] = {'X': 'A', 'Y': 'B'}[v['pick']]
                elif isinstance(v, dict) and v.get('pick') not in ('A', 'B'): v['pick'] = None  # 새 값·중간값 → 무효(재질문)
            first = txt.strip().split('\n')[0]
            (TD / f'{bid}.third-answer.json').write_text(json.dumps({'first_line_declaration': first, 'answer': ans, 'reply_msg_id': m.get('comet_message_id'), 'received_at': now()}, ensure_ascii=False, indent=1))
            rec.update({'reply_msg_id': m.get('comet_message_id'), 'answered_at': now(), 'first_line_declaration_ok': '관여' in first and '없' in first}); save()
            print('third', bid, 'answered', m.get('comet_message_id'), 'decl_ok', rec['first_line_declaration_ok']); break
    print('status', {b: bool(r.get('reply_msg_id')) for b, r in pk.items()})
