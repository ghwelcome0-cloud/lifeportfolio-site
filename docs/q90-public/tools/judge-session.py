#!/usr/bin/env python3
"""E2 judge 세션 진행기 — 패킷 1개씩 보내고, 답을 받으면 다음 패킷(TL 6054779 5조건 · Peer 6057976 ④ 받은 쪽 sha).

Usage:
  python3 judge-session.py <e2-samples.json> <packetsDir> send  <role>            # 다음 미발송 패킷 1개를 해당 judge DM에 보냄
  python3 judge-session.py <e2-samples.json> <packetsDir> poll  <role>            # 마지막 발송 패킷의 답(ANSWER.json 첨부 또는 본문 JSON)을 받아 저장
  python3 judge-session.py <e2-samples.json> <packetsDir> status

원칙(결박): 점수는 여기서 집계·출력하지 않는다. ANSWER 원본 JSON을 <packetsDir>/answers/<blind_id>.<role>.json 로 저장하고
시트에는 msg id·sha만 적는다. 표 생성(aggregate 단계) 전까지 총괄도 점수를 보지 않는다.
받은 쪽 sha: 보낸 첨부를 DM에서 다시 내려받아 sha256을 기록 → 두 judge가 같은 바이트를 받았음을 증명.
"""
import sys, json, subprocess, hashlib, pathlib, re, datetime, tempfile

E2, PK, CMD = sys.argv[1], pathlib.Path(sys.argv[2]), sys.argv[3]
ROLE = sys.argv[4] if len(sys.argv) > 4 else None
d = json.load(open(E2)); js = d['judge_sessions']
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = lambda b: hashlib.sha256(b).hexdigest()

def gsk(*args, infile=None):
    cmd = ['gsk', 'genteam', *args]
    if infile: cmd += ['--args-file', infile]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    try: return json.loads(out)
    except Exception: return {'raw': out[:500]}

def judge(role): return next(j for j in js['judges'] if j['role'] == role)
def save(): json.dump(d, open(E2, 'w'), ensure_ascii=False, indent=1)

PACKET_MSG = """[채점 패킷 {n}/{total} · {bid}]

첨부 tar.gz 안에 README.md · RUBRIC.md · sample.pdf · ANSWER.json 이 있습니다.
1) README.md 를 먼저 읽고 규칙대로 합니다. **답장 첫 줄은 자기선언 문장**입니다.
2) sample.pdf(그림 PDF)를 1쪽부터 끝까지 읽습니다.
3) ANSWER.json 을 채워 **JSON 그대로** 본문에 붙여 주세요(파일 첨부도 좋습니다). pages_total / pages_viewed / unreadable_pages / competitor_research_done_before 칸을 빠뜨리지 마세요.
이 패킷 밖의 것(검색·메모·다른 대화)은 보지 않습니다. 짐작되는 회사가 있어도 guess 칸에만 적습니다."""

if CMD == 'status':
    for j in js['judges']:
        pk = j.get('packets', {})
        print(j['role'], j['actor_id'], 'sent', len(pk), 'answered', sum(1 for v in pk.values() if v.get('reply_msg_id')))
    sys.exit()

j = judge(ROLE); ch = j['dm_channel_id']; order = d['packet_order']; pk = j.setdefault('packets', {})

if CMD == 'send':
    pending = [b for b in order if b in pk and not pk[b].get('reply_msg_id')]
    if pending: print('아직 답 없는 패킷', pending, '→ 보내지 않음'); sys.exit(1)
    nxt = [b for b in order if b not in pk]
    if not nxt: print('전부 발송됨'); sys.exit()
    bid = nxt[0]; tgz = PK / f'{bid}.tar.gz'; b = tgz.read_bytes()
    up = gsk('upload') if False else json.loads(subprocess.run(['gsk', 'upload', str(tgz)], capture_output=True, text=True).stdout)
    url = up['data']['file_wrapper_url']
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump({'channel_id': ch, 'content': PACKET_MSG.format(n=order.index(bid) + 1, total=len(order), bid=bid), 'file_path': url, 'file_name': f'{bid}.tar.gz'}, f, ensure_ascii=False); fn = f.name
    r = gsk('send', '--yes', infile=fn); mid = r.get('data', {}).get('comet_message_id')
    # 받은 쪽 sha(Peer 6057976 ④): 방금 보낸 첨부를 DM에서 다시 내려받는다 — gsk download가 서버 쪽 sha256을 돌려준다
    recv = None
    rd = gsk('read', '--channel_id', ch, '--limit', '3')
    for it in rd.get('data', {}).get('items', []):
        m = it.get('data', {})
        if str(m.get('comet_message_id')) == str(mid):
            for a in m.get('attachments') or []:
                dl = gsk('download', '--channel_id', ch, '--attachment_ref', a['attachment_ref'])
                recv = dl.get('data', {}).get('sha256') or recv
    pk[bid] = {'sent_msg_id': mid, 'sent_at': now(), 'wrapper': url, 'attachment_sha256_sent': sha(b), 'attachment_sha256_received_redownload': recv, 'bytes_match': (recv == sha(b)) if recv else None, 'reply_msg_id': None, 'answer_sha256': None}
    save(); print(ROLE, bid, 'sent', mid, 'recv_sha_match', pk[bid]['bytes_match'])

elif CMD == 'poll':
    cur = [b for b in order if b in pk and not pk[b].get('reply_msg_id')]
    if not cur: print('대기 중인 패킷 없음'); sys.exit()
    bid = cur[0]; rec = pk[bid]
    rd = gsk('read', '--channel_id', ch, '--after_message_id', str(rec['sent_msg_id']), '--limit', '10')
    for it in rd.get('data', {}).get('items', []):
        m = it.get('data', {})
        if m.get('sender_actor_id') != j['actor_id']: continue
        txt = m.get('display_text') or m.get('content') or ''
        ans = None
        mm = re.search(r'\{.*\}', txt, re.S)
        if mm:
            try: ans = json.loads(mm.group(0))
            except Exception: ans = None
        if not ans:
            for a in m.get('attachments') or []:
                if a.get('file_name', '').endswith('.json'):
                    with tempfile.TemporaryDirectory() as td:
                        lf = f'{td}/a.json'; subprocess.run(['gsk', 'genteam', 'download', '--channel_id', ch, '--attachment_ref', a['attachment_ref'], '--local_file', lf], capture_output=True, timeout=120)
                        try: ans = json.load(open(lf))
                        except Exception: ans = None
        if ans and ans.get('blind_id') == bid:
            first_line = txt.strip().split('\n')[0]
            out = PK / 'answers'; out.mkdir(exist_ok=True)
            raw = json.dumps({'first_line_declaration': first_line, 'answer': ans, 'reply_msg_id': m.get('comet_message_id'), 'received_at': now()}, ensure_ascii=False, indent=1).encode()
            (out / f'{bid}.{ROLE}.json').write_bytes(raw)
            rec.update({'reply_msg_id': m.get('comet_message_id'), 'answer_sha256': sha(raw), 'answered_at': now(), 'first_line_declaration_ok': ('관여' in first_line and '없' in first_line) or ('declaration' in ans and bool(ans['declaration']))})
            save(); print(ROLE, bid, 'answered', m.get('comet_message_id'), 'declaration_ok', rec['first_line_declaration_ok']); sys.exit()
    print(ROLE, bid, '아직 답 없음')
