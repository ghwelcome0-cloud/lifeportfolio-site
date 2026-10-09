#!/usr/bin/env python3
"""Q90 자동 총괄 데몬 (owner automation).
루프: 스레드 신규 메시지 읽기 → 상태기계.
 (A) Method "생성 승인 가능" + TL 묶음 첨부 → 기계 검증 통과 시 승인 자동 발신.
 (B) TL 종료 보고(stage2 잠금 + judge 묶음 첨부) → judge1/judge2/adjudicator 방에 자동 인계.
 (C) 그 외(중단·질문·"총괄 결정 필요") → owner_needed.txt 에 기록만 하고 대기.
모든 발신은 표식 "결박 ref: 5731124 계보 · op:q90-auto-<n>" 포함, log 에 남김.
"""
import json, os, re, subprocess, time, hashlib, tarfile, shutil, sys, datetime
W = '/home/user/work'; CH = 'ch_4a2fbfcc47273beedd780750b6532efe'
STATE = f'{W}/autoowner.state.json'; LOG = f'{W}/autoowner.log'; NEED = f'{W}/owner_needed.txt'
TL = 'agent_f6d6hkjm9p5k'; PEER = 'agent_jnwhjh28tew6'; METHOD = 'agent_8wdz8ehh4z2y'
JUDGE = {'judge1': ('ch_895d9f9ecaa046248ace6be04734e84c', 'agent_8f71j8qxr0ke'),
         'judge2': ('ch_4d5dc84a032f49949d664186a12c4455', 'agent_h9xzc27hk6ey'),
         'adj': ('ch_8227e844d4304b1898d78d73acd0389e', 'agent_9akn3657bq2s')}
BASE = os.environ.get('GSK_BASE_URL', '').rstrip('/'); KEY = os.environ.get('GSK_API_KEY', '')
V31 = f'{W}/bundle31/q90-bundle/exec-plan.json'

def log(m):
    line = f"{datetime.datetime.utcnow().isoformat()}Z {m}"; print(line, flush=True)
    open(LOG, 'a').write(line + '\n')

def st():
    return json.load(open(STATE)) if os.path.exists(STATE) else {'after': 5760678, 'opn': 100, 'approved_plans': [], 'judge_sent': False}
def save(s): json.dump(s, open(STATE, 'w'))

def gt(after, n=30):
    out = subprocess.run(['timeout', '50', f'{W}/gt.sh', CH, str(after), str(n)], capture_output=True, text=True).stdout
    msgs = []; cur = None
    for line in out.splitlines():
        m = re.match(r'=== id (\d+) \| (.*?) \| (\S+) \|', line)
        if m: cur = {'id': int(m.group(1)), 'who': m.group(2), 'ts': m.group(3), 'text': '', 'att': []}; msgs.append(cur); continue
        if cur is None: continue
        a = re.match(r'\s*ATT: (\{.*\})', line)
        if a:
            try: cur['att'].append(json.loads(a.group(1)))
            except Exception: pass
        else: cur['text'] += line + '\n'
    return msgs

def send(content, mentions, opid, channel=CH):
    d = {'channel_id': channel, 'mentions': mentions, 'operation_id': opid, 'content': content}
    p = f'{W}/auto_{opid}.json'; json.dump(d, open(p, 'w'), ensure_ascii=False)
    r = subprocess.run(['timeout', '60', 'gsk', 'genteam', 'send', '--yes', '--args-file', p], capture_output=True, text=True).stdout
    m = re.search(r'"comet_message_id":"(\d+)"', r); log(f'send {opid} -> {m.group(1) if m else r[:200]}'); return m.group(1) if m else None

def forward(msg_id, to_channel, note, opid):
    r = subprocess.run(['timeout', '60', 'gsk', 'genteam', 'forward', '--yes', '--channel_id', CH, '--message_id', str(msg_id),
                        '--target_channel_id', to_channel, '--note', note, '--operation_id', opid], capture_output=True, text=True)
    log(f'forward {msg_id}->{to_channel[:12]} rc={r.returncode} {r.stdout[:200]} {r.stderr[:200]}'); return r.returncode == 0

def download(ref, dest):
    url = f"{BASE}/api/tool_cli/genteam/attachment?channel_id={CH}&attachment_ref={ref.replace(':', '%3A')}"
    r = subprocess.run(['curl', '-s', '-m', '90', '-H', f'X-Api-Key: {KEY}', url, '-o', dest], capture_output=True)
    return os.path.exists(dest) and os.path.getsize(dest) > 1000

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def canon(v):
    if isinstance(v, list): return '[' + ','.join(canon(x) for x in v) + ']'
    if isinstance(v, dict): return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + canon(v[k]) for k in sorted(v)) + '}'
    return json.dumps(v, ensure_ascii=False)

def flat(o, p='', r=None):
    r = {} if r is None else r
    for k, v in o.items():
        q = f'{p}.{k}' if p else k
        if isinstance(v, dict): flat(v, q, r)
        else: r[q] = json.dumps(v, ensure_ascii=False, sort_keys=True)
    return r

def verify(tgz, req_sha, plan_hash):
    """기계 검증. 반환 (ok, 보고문, 요약dict)."""
    out = f'{W}/bundle_auto'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    with tarfile.open(tgz) as t: t.extractall(out)
    B = H = None
    for root, dirs, files in os.walk(out):
        if 'SHA256SUMS' in files: B = root
        if 'run-in-netns.sh' in files: H = root
    rep = []; ok = True
    def chk(c, m):
        nonlocal ok; rep.append(('OK ' if c else 'FAIL ') + m); ok = ok and c
    chk(B and H, 'bundle/harness 폴더 존재')
    if not (B and H): return False, '\n'.join(rep), {}
    r = subprocess.run(['sha256sum', '-c', 'SHA256SUMS', '--quiet'], cwd=B, capture_output=True, text=True)
    chk(r.returncode == 0, f'SHA256SUMS ({r.stdout.strip()[:100] or "all ok"})')
    reqs = [f for f in os.listdir(B) if f.startswith('REQUEST')]
    chk(len(reqs) == 1 and sha(f'{B}/{reqs[0]}') == req_sha, '요청서 SHA 일치')
    plan = json.load(open(f'{B}/exec-plan.json'))
    pc = hashlib.sha256(canon(plan).encode()).hexdigest(); pr = sha(f'{B}/exec-plan.json')
    chk(pc == plan_hash and pr == plan_hash, f'plan canonical=raw={plan_hash[:12]}')
    chk(plan.get('generation_count_so_far') == 0, 'generation_count_so_far=0')
    bad = [f for f, s in plan['harness_code'].items() if not os.path.exists(f'{H}/{f}') or sha(f'{H}/{f}') != s]
    chk(not bad, f'harness_code {len(plan["harness_code"])}파일 SHA 일치 (bad={bad})')
    a = json.load(open(V31)); A = flat(a['bindings']); Bf = flat(plan['bindings'])
    changed = [k for k in A if k in Bf and A[k] != Bf[k] and not k.startswith('messages')]
    removed = [k for k in A if k not in Bf]
    added = [k for k in Bf if k not in A and not k.startswith('messages')]
    chk(not changed and not removed, f'v3.1 결박값 39 변경/삭제 0 (changed={changed}, removed={removed}); 추가 키={added}')
    for k in ['order', 'releases', 'units_per_release', 'holdout', 'judge_isolation', 'judge_scan_exceptions', 'judge_internal_field_rule', 'census_copy', 'credit_cap']:
        chk(json.dumps(a.get(k), sort_keys=True) == json.dumps(plan.get(k), sort_keys=True), f'섹션 {k} SAME')
    # 판정 코드 불변: negative controls 줄 / pipeline digest 줄
    ref = open(f'{W}/bundle33/q90-harness/negative.cjs').read().splitlines()[53]
    cur = [l for l in open(f'{H}/negative.cjs').read().splitlines() if l.strip().startswith('const controls = ')]
    chk(len(cur) == 1 and cur[0] == ref, 'negative controls 줄 바이트 동일(v3.3 54행)')
    sel = json.load(open(f'{B}/selftest-unit.json'))
    chk(sel['passed'] == sel['total'] and sel['total'] >= 74, f'자체 시험 {sel["passed"]}/{sel["total"]}')
    chk(not re.search(r'const \[,,ud', open(f'{H}/run-in-netns.sh').read()), 'argv 결함 부재')
    scan = open(f'{H}/judge-scan.cjs').read()
    chk('/NONPERSONAL/' in scan and '/DEV 합성/' in scan and not re.search(r'/Q90[^_]', scan), 'judge-scan 패턴(NONPERSONAL·DEV 합성, Q90 없음)')
    chk(plan.get('concurrency', {}).get('negative') == 1, 'concurrency.negative=1')
    msgs = plan['bindings']['messages']
    chk(all(str(x) in msgs for x in [5731124, 5731278, 5731310]), 'messages 결박 세트')
    summary = {'files': len(plan['harness_code']), 'selftest': f'{sel["passed"]}/{sel["total"]}', 'disclosures': len(plan.get('disclosures', [])),
               'messages': len(msgs), 'stop_rules': len(plan.get('stop_rules', [])), 'changed': plan.get('changed_files_vs_v3_4') or plan.get('changed_files_vs_v3_3')}
    return ok, '\n'.join(rep), summary

def handle_approval(s, msgs):
    """Method '생성 승인 가능' 탐지 → 최신 TL 묶음 첨부 찾기 → 검증 → 승인."""
    def first(m): return re.sub(r'^(@\S+\s*)+', '', m['text'].strip().split('\n')[0].strip()).strip().lstrip('*').strip()
    meth = [m for m in msgs if m['who'] == '리서치 사이언티스트' and first(m).startswith('생성 승인 가능') and '조건부' not in first(m) and '전제' not in first(m)]
    if not meth: return
    m = meth[-1]
    req = re.search(r'요청서 SHA `([0-9a-f]{64})`', m['text']); ph = re.search(r'실행계획 hash `([0-9a-f]{64})`', m['text'])
    if not (req and ph): log('method msg without hashes'); return
    if ph.group(1) in s['approved_plans']: return
    if '총괄 결정 필요' in m['text'] or '먼저 정해' in m['text'] or re.search(r'보완 \d+건', first(m)):
        open(NEED, 'a').write(f"{m['id']} Method 승인가능이나 총괄 결정 선행 필요\n"); log('owner decision needed'); return
    tl = [x for x in msgs if x['who'].startswith('테크') and x['att'] and x['id'] < m['id']]
    if not tl: log('no TL bundle'); return
    att = [a for a in tl[-1]['att'] if a.get('file_name', '').endswith('.tgz')]
    if not att: return
    dest = f"{W}/auto_{att[0]['attachment_ref'].replace(':', '_')}.tgz"
    if not download(att[0]['attachment_ref'], dest): log('download fail'); return
    ok, rep, summ = verify(dest, req.group(1), ph.group(1))
    log(f'verify ok={ok}\n{rep}')
    if not ok:
        open(NEED, 'a').write(f"{m['id']} 자동검증 FAIL:\n{rep}\n"); return
    s['opn'] += 1; ts = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    content = f"""[Q90 · 총괄 **생성 승인(1회차 다음 시도 · 자동 총괄)**] 요청서 SHA `{req.group(1)}` · 실행계획 hash `{ph.group(1)}` · 결박 집합 변경 없음 확인. 두 release 생성·봉인 → 출력 hash → 블라인드·stage2 잠금까지 **중단 없이** 진행. judge 열람은 잠금 ref 보고 뒤 총괄(자동)이 별도 발주. 중단 규칙 발생 시 즉시 멈추고 보고. 승인 시각 `{ts}`.

**자동 총괄 기계 검증(tgz SHA256 `{sha(dest)}` 직접 재계산 — Peer 재계산용)** — Method {m['id']} "생성 승인 가능" 수신 후 실행:
```
{rep}
```
요약: 하네스 {summ['files']}파일 · 자체 시험 {summ['selftest']} · disclosures {summ['disclosures']} · messages {summ['messages']} · 변경 {summ['changed']}.
이 승인은 총괄이 사전 위임한 자동 절차(5760588 이후, 대표 지시 2026-10-08 20:2xZ)로 발신됨. 사람 총괄은 기록 열람으로 사후 확인. 종료 보고 필수 항목은 5738785와 동일.

@테크 리드 **실행 시작.** 0단계 input-gate final + 키·값 사전 점검 → 로그 첫 줄. @피어 리뷰어 @리서치 사이언티스트 참고.
결박 ref: 5731124 계보 · op:q90-auto-{s['opn']}"""
    mid = send(content, [TL, PEER, METHOD], f'q90-auto-{s["opn"]}')
    if mid: s['approved_plans'].append(ph.group(1)); s['last_approval'] = mid; save(s)

def handle_judge(s, msgs):
    """TL 종료 보고: stage2 잠금 + judge 묶음 첨부 → 3방 인계."""
    if s.get('judge_sent'): return
    tl = [m for m in msgs if m['who'].startswith('테크') and ('stage2' in m['text'].lower() or '잠금' in m['text']) and ('MANIFEST' in m['text']) and m['att']]
    if not tl: return
    m = tl[-1]; j = [a for a in m['att'] if 'judge' in a.get('file_name', '').lower()]
    if not j: log('end report without judge bundle attachment'); open(NEED, 'a').write(f"{m['id']} 종료 보고에 judge 묶음 첨부 없음\n"); return
    # Peer 확인 대기(점수 없는 대조)
    peer_ok = [x for x in msgs if x['who'] == '피어 리뷰어' and x['id'] > m['id'] and x['text'].strip().split('\n')[0].strip().strip('*').strip() == 'Peer 대조 확인']
    if not peer_ok: log('waiting Peer "Peer 대조 확인" first line'); return
    # judge_input_rule must be bound in the approved plan (a or D)
    try:
        plan = json.load(open(f'{W}/bundle_auto/' + [d for d in os.listdir(f'{W}/bundle_auto') if 'bundle' in d][0] + '/exec-plan.json'))
    except Exception: plan = {}
    if 'judge_input_rule' not in json.dumps(plan): log('judge_input_rule not bound -> no auto handoff'); open(NEED,'a').write(f"{m['id']} judge 인계 보류: plan에 judge_input_rule 없음\n"); return
    bsha = re.search(r'judge[^`]*`([0-9a-f]{8,})', m['text']); lock = re.search(r'(stage2[^`\n]*`[^`]+`)', m['text'])
    ts = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    tpl = open(f'{W}/d49.json').read()
    for key in ('judge1', 'judge2'):
        ch, ag = JUDGE[key]; s['opn'] += 1
        body = json.load(open(f'{W}/d49.json'))['content'].replace('{BUNDLE_SHA}', bsha.group(1) if bsha else '첨부 참조').replace('{SENT_AT}', ts).replace('{LOCK_REF}', f"{m['id']}")
        if forward(m['id'], ch, body, f'q90-auto-{s["opn"]}') is False:
            send(body + '\n(첨부는 총괄이 별도 전달)', [ag], f'q90-auto-{s["opn"]}b', ch)
    s['judge_sent'] = True; s['judge_sent_at'] = ts; save(s)
    s['opn'] += 1
    send(f"[Q90 · 총괄(자동) — judge 인계 완료 {ts}] judge1·judge2 격리 방에 묶음 인계(종료 보고 {m['id']} 기준, Peer 확인 {peer_ok[-1]['id']}). adjudicator는 judge 출력 4개 수신 후 발주. **90% 도달.** @피어 리뷰어 @리서치 사이언티스트\n결박 ref: 5731124 계보 · op:q90-auto-{s['opn']}", [PEER, METHOD], f'q90-auto-{s["opn"]}')
    save(s)

def main():
    s = st(); log('autoowner start after=%s' % s['after'])
    while True:
        try:
            msgs = gt(s['after'] - 1, 40)  # 재스캔 범위 포함
            new = [m for m in msgs if m['id'] > s['after']]
            for m in new:
                t = m['text']
                if m['who'].startswith('테크') and ('중단 보고' in t or '멈췄습니다' in t): open(NEED, 'a').write(f"{m['id']} TL 중단 보고 — 총괄 결정 필요\n"); log(f'STOP report {m["id"]}')
                if '총괄 결정 필요' in t or '정해 주세요' in t or '답해 주세요' in t: open(NEED, 'a').write(f"{m['id']} {m['who']} 결정 요청\n"); log(f'decision request {m["id"]}')
            handle_approval(s, msgs); handle_judge(s, msgs)
            if new: s['after'] = max(m['id'] for m in new); save(s)
        except Exception as e:
            log(f'ERR {e!r}')
        time.sleep(75)

if __name__ == '__main__': main()
