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
d = json.load(open(E2)); js = d['judge_sessions']; third = next(j for j in js['judges'] if j['role'] == 'third')
AX = ['A1', 'A2', 'A3', 'A4', 'A5']
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
TD = AD / 'third'; TD.mkdir(exist_ok=True)
def save(): json.dump(d, open(E2, 'w'), ensure_ascii=False, indent=1)
def gsk(*a, infile=None):
    c = ['gsk', 'genteam', *a] + (['--args-file', infile] if infile else [])
    o = subprocess.run(c, capture_output=True, text=True, timeout=120).stdout
    try: return json.loads(o)
    except Exception: return {'raw': o[:300]}

if CMD == 'prepare':
    rnd = random.Random(hashlib.sha256(open(E2, 'rb').read()).hexdigest())
    summary = []
    for bid in d['packet_order']:
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
        lines = [f'[제3자 판정 · {bid} · 축 {len(p["items"])}개]', '',
                 '두 채점자의 답이 2단계 이상 벌어진 축만 왔습니다. 첨부 sample.pdf(이전에 받은 적 없는 그림 PDF)를 끝까지 읽고, 축마다 **A 또는 B 중 하나만** 고르고 이유 1문장을 적어 주세요. 평균·새 값은 안 됩니다.',
                 '답장 첫 줄은 자기선언: "나는 이 평가 대상의 다른 역할(작성·검수·채점·심판)에 관여한 적이 없다". 마지막에 competitor_research_done_before(true/false + 한 줄)와 pages_viewed/pages_total을 적어 주세요.', '']
        for it in p['items']:
            lines += [f'### {it["axis"]}', f'- A: L{it["A"]["level"]} — {it["A"]["reason"]}', f'- B: L{it["B"]["level"]} — {it["B"]["reason"]}', '']
        lines += ['답 형식(JSON): {"blind_id":"' + bid + '","picks":{' + ','.join(f'"{it["axis"]}":{{"pick":"A|B","reason":""}}' for it in p['items']) + '},"competitor_research_done_before":null,"pages_viewed":null,"pages_total":null}']
        # sample.pdf만 따로 보낸다(RUBRIC 포함 패킷은 같은 tar를 재사용)
        tgz = AD.parent / f'{bid}.tar.gz'
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
            first = txt.strip().split('\n')[0]
            (TD / f'{bid}.third-answer.json').write_text(json.dumps({'first_line_declaration': first, 'answer': ans, 'reply_msg_id': m.get('comet_message_id'), 'received_at': now()}, ensure_ascii=False, indent=1))
            rec.update({'reply_msg_id': m.get('comet_message_id'), 'answered_at': now(), 'first_line_declaration_ok': '관여' in first and '없' in first}); save()
            print('third', bid, 'answered', m.get('comet_message_id'), 'decl_ok', rec['first_line_declaration_ok']); break
    print('status', {b: bool(r.get('reply_msg_id')) for b, r in pk.items()})
