# -*- coding: utf-8 -*-
"""Break Korean subtitle lines on meaning boundaries, not on width.

CEO: "자막은 고객이 봤을 때 시각적으로 정렬이(어절 단위로 의미를 살려고 정렬)
      잘 되어야 해요."

The delivered SRT was wrapped by character count, which is why it reads badly:

    해온 일도 늘었고 할 수 있는 일도 많아졌는데 막상 다음
    회사를 고르거나 새로운 역할을 생각하면 기준이 흐려집니다.

"막상 다음" ends line 1 and "회사를" starts line 2, so the viewer reads a
determiner with nothing to determine, then has to carry it across the break.
Same fault in "영상이 끝날 때는 세 / 문장이 남게 됩니다."

Korean has a property that makes this fixable without a parser: a 어절 boundary
is a space, and the STRENGTH of a boundary is readable from the ending of the
word before it. A word ending in a connective ending (-고, -며, -는데, -면,
-지만) closes a clause, so a break there costs the reader nothing. A word that
is a determiner (이, 그, 세, 다음, 새로운) or ends in an adnominal ending
(-는, -은, -ㄹ, -던) is still REACHING for the noun after it, so a break there
is the fault the CEO saw.

So: score every candidate space, take the best one near the middle. No
dictionary, no model, no credits.
"""
import re

# --- boundary scores. Higher = better place to break. ---------------------
CLAUSE_END = ("고", "며", "면", "은데", "는데", "지만", "라서", "어서", "아서",
              "니까", "으로", "로서", "인데", "다가", "거나", "든지", "면서")
PARTICLE_END = ("은", "는", "이", "가", "을", "를", "에", "에서", "에게", "께",
                "도", "만", "부터", "까지", "와", "과", "랑", "의", "보다")
# words that must NOT be the last word on a line: they modify what follows
DETERMINER = {"이", "그", "저", "이런", "그런", "저런", "어떤", "무슨", "각",
              "세", "두", "네", "한", "첫", "다음", "새로운", "지금", "바로",
              "더", "가장", "제일", "아주", "매우", "훨씬", "덜", "잘", "못",
              "안", "다시", "먼저", "특히", "오직", "단지", "약", "총", "전",
              "모든", "여러", "몇", "다른", "같은", "이번", "저번", "그때"}
ADNOMINAL = re.compile(r"(는|은|ㄴ|던|을|를)$")   # reaching for a noun
NOUN_TAIL = re.compile(r"(적|성|화|형|들)$")


def _score(prev_word, next_word, pos, n_chars):
    """How good is the space AFTER prev_word as a line break?"""
    w = prev_word.rstrip(",.?!\"')")
    s = 0.0
    if prev_word.endswith((",", ".", "?", "!")):
        s += 6.0                                    # punctuation: strongest
    if any(w.endswith(e) for e in CLAUSE_END):
        s += 4.0                                    # clause closed
    elif any(w.endswith(e) for e in PARTICLE_END) and len(w) > 1:
        s += 2.0                                    # phrase closed
    if w in DETERMINER:
        s -= 8.0                                    # ★the CEO's fault★
    elif ADNOMINAL.search(w) and len(w) <= 3:
        s -= 3.0                                    # short adnominal reaching
    if NOUN_TAIL.search(w) and len(w) <= 2:
        s -= 1.0
    # balance: prefer near the middle
    s -= abs(pos - n_chars / 2.0) / (n_chars / 2.0) * 3.0
    return s


def wrap(text, max_lines=2, max_chars=26):
    """Wrap one cue into <= max_lines lines, breaking on meaning."""
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return [text]
    words = text.split(" ")
    if len(words) < 2:
        return [text]

    # A line budget that is too tight is itself the fault. At 64 characters the
    # only two-line splits that fit are the ones near the middle, and if the
    # middle happens to fall after a determiner then the determiner break is
    # the ONLY legal candidate — which is exactly how "막상 다음 / 회사를"
    # survived my first pass. So decide the line count from the length first,
    # and let the meaning score choose freely inside a budget that has room.
    if max_lines == 2 and len(text) > 2 * max_chars:
        max_lines = 3

    # Two lines is the goal, but it is not worth a 36-character line. Cost both
    # layouts on the same scale and let the cheaper one win -- and prefer two
    # lines on a tie, because a third line costs the viewer a fixation.
    two = _dp(words, 2, max_chars, len(text))
    if max_lines < 3 or max(len(l) for l in two) <= max_chars:
        return two
    three = _dp(words, 3, max_chars, len(text))
    if max(len(l) for l in three) < max(len(l) for l in two):
        return three
    return two


def _dp(words, n_lines, max_chars, n_chars):
    """choose all break points at once, by exact optimum instead of greedily

    The greedy pass this replaces picked break 1 near 1/3 and break 2 near 2/3
    INDEPENDENTLY, each time taking the best meaning score near its own target.
    Because neither choice could see the other, it produced this (cue #56):

        예를 들면,                                         <-  5 chars
        나는 목적을 공유받고                                <- 11
        실행 방식은 스스로 설계할 수 있는 환경에서 더 꾸준히 기여한다.  <- 36

    Every individual break scored well; the LAYOUT is unreadable. A line that
    is 36 characters wide next to one that is 5 is exactly the "시각적으로
    정렬" fault, arrived at from the opposite direction.

    So score the whole layout, not one break at a time: cost = sum over lines
    of an over-width penalty plus a balance penalty, minus the meaning score of
    each break used. n <= ~30 words and n_lines <= 3, so the exact optimum is
    a 3-nested walk -- no heuristic needed.
    """
    n = len(words)
    cum = [0] * (n + 1)                 # cum[i] = chars in words[:i] joined
    for i, w in enumerate(words):
        cum[i + 1] = cum[i] + len(w) + (1 if i else 0)

    def width(i, k):                    # words[i:k] joined
        return cum[k] - cum[i] - (1 if i else 0)

    sc = [0.0] * n                      # meaning score of the break after i
    veto = [False] * n
    for i in range(n - 1):
        sc[i] = _score(words[i], words[i + 1], cum[i + 1], n_chars)
        veto[i] = words[i].rstrip(",.?!\"')") in DETERMINER

    ideal = n_chars / float(n_lines)

    # Meaning and geometry have to be priced on ONE scale or the bigger raw
    # number simply wins. A comma scores +7 in _score, while a line 8
    # characters too long costs 8*0.45 = 3.6 in balance -- so a comma break
    # bought a 29/10 split in cue #116. MEANING_W brings the meaning term down
    # to where one strong boundary is worth roughly 4 characters of imbalance:
    # enough to break a tie, not enough to buy a lopsided layout.
    MEANING_W = 0.55

    def line_cost(i, k):
        w = width(i, k)
        c = 0.0
        if w > max_chars:
            c += (w - max_chars) ** 2 * 0.30    # over budget hurts, and fast
        c += abs(w - ideal) * 0.45              # ragged layout hurts too
        return c

    best, arg = None, None
    if n_lines == 3:
        for i in range(1, n - 1):
            if veto[i - 1]:
                continue
            for k in range(i + 1, n):
                if veto[k - 1]:
                    continue
                c = (line_cost(0, i) + line_cost(i, k) + line_cost(k, n)
                     - (sc[i - 1] + sc[k - 1]) * MEANING_W)
                if best is None or c < best:
                    best, arg = c, (i, k)
        if arg:
            i, k = arg
            return [" ".join(words[:i]), " ".join(words[i:k]), " ".join(words[k:])]
    for i in range(1, n):
        if veto[i - 1]:
            continue
        c = line_cost(0, i) + line_cost(i, n) - sc[i - 1] * MEANING_W
        if best is None or c < best:
            best, arg = c, (i,)
    if arg and len(arg) == 1:
        i = arg[0]
        return [" ".join(words[:i]), " ".join(words[i:])]
    return [" ".join(words)]


_TS = re.compile(r"(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)")


MIN_DUR = 0.90          # below this a viewer registers a flash, not a word
GAP = 0.08              # keep this much air between neighbouring cues


def _sec(ts):
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def _ts(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int((t - h * 3600) // 60)
    s = t - h * 3600 - m * 60
    return "%02d:%02d:%02d,%03d" % (h, m, int(s), round((s - int(s)) * 1000))


def _hold(cues, end):
    """give every cue at least MIN_DUR on screen, or fold it into its neighbour

    The delivered SRT has four cues of 0.18-0.20 s:

        #99  414.960..415.160  첫째.
        #101 419.500..419.700  둘째.
        #103 423.600..423.780  셋째.
        #118 499.800..500.000  다음

    Five frames is below the threshold at which a reader can fixate at all, so
    these are flashes: the viewer sees something appear and vanish and looks
    for what they missed. The narration really does say 첫째 in 0.2 s, so the
    fix is not to slow the audio -- it is to stop treating a spoken beat as its
    own caption. Merge it into the sentence it introduces ("첫째. 기억나는
    프로젝트 3개를 적고...") and the beat is read where it belongs.

    #118 is different: "다음" with nothing after it is a truncation artefact of
    the 500 s cut, with no following cue to merge into, so it is dropped.
    """
    out, merged, dropped, held = [], 0, 0, 0
    i = 0
    while i < len(cues):
        t0, t1, body = cues[i]
        if t1 - t0 >= MIN_DUR:
            out.append([t0, t1, body]); i += 1; continue
        nxt = cues[i + 1] if i + 1 < len(cues) else None
        if nxt is not None and nxt[0] - t1 < 1.20:
            # fold into the next cue and let it start where this one started
            cues[i + 1] = (t0, nxt[1], (body + " " + nxt[2]).strip())
            merged += 1; i += 1; continue
        room = (nxt[0] - GAP if nxt else end) - t0
        if room >= MIN_DUR:
            out.append([t0, t0 + max(MIN_DUR, t1 - t0), body]); held += 1
        else:
            dropped += 1
        i += 1
    return out, merged, held, dropped


def rewrap_srt(src, dst, max_chars=26, end=500.010667):
    blocks, cur = [], []
    for line in open(src, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.strip() == "":
            if cur: blocks.append(cur); cur = []
        else:
            cur.append(line)
    if cur: blocks.append(cur)

    cues = []
    for b in blocks:
        m = _TS.search(b[1]) if len(b) >= 3 else None
        if not m:
            continue
        cues.append((_sec(m.group(1)), _sec(m.group(2)), " ".join(b[2:])))

    timed, merged, held, dropped = _hold(cues, end)

    fixed = 0
    out = []
    for n, (t0, t1, body) in enumerate(timed, 1):
        lines = wrap(body, 2, max_chars)
        if len(lines) > 1 or len(body) > max_chars:
            fixed += 1
        out.append([str(n), "%s --> %s" % (_ts(t0), _ts(t1))] + lines)

    with open(dst, "w", encoding="utf-8") as f:
        for b in out:
            f.write("\n".join(b) + "\n\n")
    return len(out), fixed, merged, held, dropped


if __name__ == "__main__":
    import sys
    n, fixed, merged, held, dropped = rewrap_srt(sys.argv[1], sys.argv[2])
    print("cues %d   wrapped %d   merged %d   held %d   dropped %d"
          % (n, fixed, merged, held, dropped))
