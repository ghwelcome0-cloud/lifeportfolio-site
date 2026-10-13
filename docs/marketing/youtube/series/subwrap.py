# 의미 단위 자막 분할 v3 — 문장 전체를 형태소 분석(Kiwi)해서 어절 경계마다 "끊어도 되는 정도"를 매긴다.
# 금지: 꾸미는 말(관형형·관형사·수) 뒤 / 의존명사(것·수·때·가지) 앞 / 보조용언(해 / 보다) 앞 /
#       명사+명사 복합어 사이(고유성 / 기반) / '수 / 있다' / '~이 / 되다' / 따옴표·「」 안.
# 선호: 문장끝 > 쉼표 > 연결어미(-고 -며 -면 -서) > 주제·주어·목적어 조사.
# v3.1(EP.04): 이어진 동사(받아 적다 · 고쳐 쓰다 · 어떻게 하다) 사이, 명사와 수(사진 / 한 장) 사이도 금지.
#       좋은 자리가 없고 24자 이하면 한 줄로 둔다.
# 모양: 한 큐 최대 2줄, 줄당 20자 안팎. 위아래 길이가 비슷하게, 한 줄 7자 미만 금지.
import re, json, sys
from kiwipiepy import Kiwi
KW = Kiwi()
def eojeol_tags(words):
    """words: 어절 리스트 -> 어절별 [(form, tag)] (문장 전체 맥락으로 분석)"""
    text = ' '.join(words); starts = []; p = 0
    for w in words: starts.append(p); p += len(w) + 1
    out = [[] for _ in words]
    for t in KW.tokenize(text):
        i = max(k for k, s in enumerate(starts) if s <= t.start); out[i].append((t.form, t.tag))
    return out
LOCK = ['자산화 맞춤 실행 프로그램', '고유성 기반 자산화 길찾기', '12주 자산화 퀘스트', '추천 진로 세 카드', '오늘 해 봤어요', '자산화 길 찾기', '나의 다이어리', '조금 더 여쭤볼게요', '인생 훈련 게임', '함께 배우는 소그룹']
def locked(words):
    lk = set(); txt = ' '.join(words); pos = [0]
    for w in words: pos.append(pos[-1] + len(w) + 1)
    for term in LOCK:
        for m in re.finditer(re.escape(term), txt):
            for i in range(len(words) - 1):
                if m.start() < pos[i + 1] - 1 < m.end(): lk.add(i)
    return lk
def boundary_scores(words):
    tg = eojeol_tags(words); sc = []; quote = 0; LK = locked(words)
    for i in range(len(words) - 1):
        w, n = words[i], words[i + 1]; PUN = ('SF', 'SP', 'SS', 'SSO', 'SSC', 'SE', 'SO', 'SW'); a = [x for x in tg[i] if x[1] not in PUN] or tg[i]; b = [x for x in tg[i + 1] if x[1] not in PUN] or tg[i + 1]
        quote += w.count('「') + w.count('“') - w.count('」') - w.count('”')
        lt = a[-1][1] if a else ''; ft = b[0][1] if b else ''; ff = b[0][0] if b else ''
        bt = [x[1] for x in b]
        s = 0
        if w.rstrip('"”’)」').endswith(('.', '?', '!')): s = 10
        elif w.endswith(','): s = 8
        elif quote > 0: s = -9
        elif lt in ('ETM', 'MM', 'NR', 'SN', 'XPN'): s = -9
        elif ft == 'NNB': s = -9
        elif ft == 'VX' or (ft.startswith('V') and ff in ('있', '없') and lt == 'NNB'): s = -9
        elif lt in ('NNG', 'NNP', 'NNB', 'NR', 'XSN') and ft in ('NNG', 'NNP', 'XSN', 'NR') : s = -7   # 명사+명사
        elif lt in ('JKC',) or (lt == 'JKS' and ff in ('되', '아니')): s = -7
        elif 'ETM' in bt and lt in ('JKS', 'JKO', 'JKB', 'JX', 'MAG', 'NNG'): s = -4                 # 꾸미는 절을 가르지 않게
        elif lt == 'EC' and a[-1][0] in ('어', '아', '여', '게', '어다', '아다') and ft.startswith('V'): s = -8   # 이어진 동사
        elif lt in ('NNG', 'NNP', 'NNB') and ft in ('MM', 'SN', 'NR'): s = -7       # 사진 / 한 장
        elif lt == 'EC': s = 6
        elif lt == 'JKO' and ft.startswith('V'): s = 1
        elif lt in ('JX', 'JKS', 'JKO', 'JKB', 'JC'): s = 3
        elif lt == 'JKG': s = -5
        elif lt == 'MAG': s = -3
        if i in LK: s = -9
        sc.append(s)
    return sc
def best_two(words, sc, maxc=20):
    txt = ' '.join(words)
    if len(txt) <= maxc: return [txt]
    best = None
    for k in range(1, len(words)):
        a = ' '.join(words[:k]); b = ' '.join(words[k:])
        over = max(0, max(len(a), len(b)) - (maxc + 3))
        v = (sc[k - 1] - abs(len(a) - len(b)) * 0.3 - (1.5 if len(b) > len(a) + 7 else 0)
             - (8 if min(len(a), len(b)) < 7 else 0) - over * 1.2 - (40 if sc[k - 1] <= -7 else 0))
        if best is None or v > best[0]: best = (v, [a, b])
    if best and best[0] < 0 and len(txt) <= maxc + 4: return [txt]
    return best[1] if best else [txt]
def cues_from_words(ww, max_cue=40, maxc=20):
    ww = [w for w in ww if w['t'].strip()]
    sents = []; cur = []
    for w in ww:
        cur.append(w)
        if w['t'].rstrip('"”’)」').endswith(('.', '?', '!')): sents.append(cur); cur = []
    if cur: sents.append(cur)
    res = []
    for sent in sents:
        words = [x['t'] for x in sent]; sc = boundary_scores(words)
        def split(lo, hi):
            txt = ' '.join(words[lo:hi])
            bt = best_two(words[lo:hi], sc[lo:hi - 1], maxc)
            if len(txt) <= max_cue and max(len(l) for l in bt) <= maxc + 6:
                res.append([sent[lo]['s'], sent[hi - 1]['e'], bt]); return
            best = None
            for k in range(lo + 1, hi):
                a = ' '.join(words[lo:k]); b = ' '.join(words[k:hi])
                if len(a) < 10 or len(b) < 10: continue
                v = sc[k - 1] * 2 - abs(len(a) - len(b)) * 0.08 - (60 if sc[k - 1] <= -7 else 0)
                if best is None or v > best[0]: best = (v, k)
            k = best[1] if best else (lo + hi) // 2
            split(lo, k); split(k, hi)
        split(0, len(words))
    for i, c in enumerate(res):
        nxt = res[i + 1][0] if i + 1 < len(res) else c[1] + 1
        c[1] = min(c[1] + 0.25, nxt - 0.04)
    return res
def audit(cues):
    bad = []
    for c in cues:
        ws = ' '.join(c[2]).split(' '); sc = boundary_scores(ws); pos = 0
        for li in c[2][:-1]:
            pos += len(li.split(' '))
            if sc[pos - 1] <= -7: bad.append((ws[pos - 1], ws[pos]))
    return bad
if __name__ == '__main__':
    ww = json.load(open(sys.argv[1]))['words']
    new = cues_from_words(ww); json.dump(new, open(sys.argv[2], 'w'), ensure_ascii=False)
    print('cues', len(new), 'bad line breaks', audit(new))
