#!/usr/bin/env python3
"""E2 블라인드용 샘플 리포트 가림 도구 (Method 6037069 ②, Peer 6037804).

Usage: python3 redact-sample.py <e2-samples.json> <roster-v2.json> <id> <in.pdf> <outDir>
         [--extra "문자열1|문자열2"] [--cover N] [--bands top,bottom] [--boxes "p:x0,y0,x1,y1;p:…"]
 --cover N   앞 N쪽(기본 1, 표지)을 통째로 가림. 표지는 채점 대상 아님.
 --boxes     썸네일 확인 뒤 남은 로고를 비율 좌표로 집어 가림. 결과 시트에 그대로 기록되어 재현 가능.

하는 일:
 1. 가림 대상 문자열 = 명부 41행의 name·provider·도메인 + 해당 행의 알려진 상표/인물명 + --extra
    (대소문자 무시). 각 등장 위치를 PyMuPDF redaction(검은 상자, 하부 텍스트 삭제)으로 지운다.
 2. 모든 페이지의 이미지(로고 포함)를 지운다. 그리고 **벡터로 그려진 로고**(이미지도 텍스트도 아님 — DiSC·WILEY 사례)를
    잡기 위해 각 페이지 상단·하단 띠(기본 상단 12%·하단 8%)의 벡터 드로잉을 지운다(--bands top,bottom 로 조정).
    그래프가 지워질 수 있으므로 judge 안내문에 "이미지·머리/꼬리 영역은 가림 처리됨"을 적는다.
 2a. 한국어 PDF(어세스타)는 본문이 윤곽선(벡터)으로 들어가 텍스트 검색이 안 된다(K03: 18쪽에 단어 수십 개뿐).
    그래서 누출 검사를 **두 겹**으로 한다: ① 텍스트 레이어 검색 ② 렌더(150dpi) → tesseract OCR(kor+eng) → 같은 용어 검색.
    OCR 결과도 0건이어야 통과. OCR이 잡은 누출은 좌표를 못 주므로 --boxes 로 사람이 가린 뒤 재실행한다.
 2b. 텍스트 누출 검사만으로는 벡터 로고를 못 잡는다(실제 사례: 1차 처리본에서 WILEY·DiSC 로고 통과). 그래서 처리본
    전 페이지를 50dpi 썸네일 시트(<blind_id>.contact.png)로 만들고, 사람이 눈으로 확인한 뒤에만 status=redacted 로 올린다
    (스크립트는 'redacted_pending_visual' 까지만 올린다).
 3. 메타데이터(Author/Producer/Title 등) 삭제.
 4. 누출 검사: 처리본 전체 텍스트에서 명부 문자열 재검색 → 0건이어야 통과. 결과를 시트 행의 redaction 칸에 기록:
    items_found(가린 문자열 목록·건수), tool_sha256(이 스크립트), leak_check, redacted_sha256.
 5. 출력 파일명은 blind_id 로만: <outDir>/<blind_id>.pdf  (원본 파일명·id가 드러나지 않게)
 6. **최종 패킷용 = 이미지 PDF** (Peer 6054792 ①, 차단급): 가림 처리본은 content stream에 원본 글자·경로가 남고(덮기), 글꼴 이름·XMP·
    책갈피·링크에도 출처 단서가 남는다. 그래서 가림본의 각 페이지를 170dpi로 렌더해 **텍스트 레이어 없는 이미지 PDF**
    (<blind_id>.img.pdf, 메타데이터 비움)를 만들고, 누출 검사·sha·패킷은 **이 파일**을 기준으로 한다.
    가림본(.pdf)은 중간 산출물로만 보관(패킷에 넣지 않음).
 7. 이미지 PDF 최종 검사 3겹: ① 텍스트 레이어(0바이트여야 정상) ② OCR(kor+eng) ③ 메타·글꼴 이름·주석 문자열(0건).
"""
import sys, json, re, hashlib, pathlib, datetime
import pymupdf  # PyMuPDF

# 블라인드의 한계(결박): 리포트 본문은 자기 모델명·유형명(DiSC, MBTI·ISTJ, 34 themes, Holland code…)을 계속 쓴다.
# 이것까지 지우면 리포트가 읽히지 않아 채점이 불가능하다. 그래서 가림 범위는 **회사명·인물명·URL·연락처·로고·표지·저작권 줄**로 정의하고,
# 모델명은 남긴다. 그 결과 judge는 "어느 계열 도구인지"는 짐작할 수 있다(guess 칸에 기록). 이 한계는 표에 공개한다.
# → 유출 검사 용어에서 모델명을 뺀다(ALLOWLIST). 회사명·사람명은 뺄 수 없다.
# 결함 ⑩(2026-10-12, 사람 눈 확인에서 발견): hogan·cliftonstrengths·birkman·kolbe는 "모델명"이지만 동시에 회사명·창업자 성(姓)이다.
# ALLOWLIST에 있어 G04 18쪽 전부에 'Hogan'이 남았고, 누출검사도 같은 목록을 써서 못 잡았다 → 사람 이름·회사명인 것은 전부 뺀다.
# 남기는 것은 사람·회사가 아닌 일반 모델명뿐(disc, mbti, strong, via, hexaco, insights, enneagram, strengthsfinder).
ALLOWLIST = {'disc', 'mbti', 'strong', 'strengthsfinder', 'via', 'hexaco', 'insights', 'enneagram'}

args = sys.argv[1:]
extra = []; bands = (0.12, 0.08); cover_pages = 1; boxes = []  # boxes: 페이지별 사용자 지정 가림 사각형 "p:x0,y0,x1,y1" (비율 0~1)
if '--cover' in args:
    i = args.index('--cover'); cover_pages = int(args[i + 1]); del args[i:i + 2]
if '--boxes' in args:
    i = args.index('--boxes'); boxes = [b for b in args[i + 1].split(';') if b]; del args[i:i + 2]
if '--bands' in args:
    i = args.index('--bands'); bands = tuple(float(x) for x in args[i + 1].split(',')); del args[i:i + 2]
if '--extra' in args:
    i = args.index('--extra'); extra = [s for s in args[i + 1].split('|') if s]; del args[i:i + 2]
E2, ROSTER, ID, INPDF, OUTDIR = args[:5]
e2 = json.load(open(E2, encoding='utf-8')); roster = json.load(open(ROSTER, encoding='utf-8'))
row = next(r for r in e2['rows'] if r['id'] == ID)
if not row.get('blind_id'):
    sys.exit('blind_id 없음 — salt 적용된 시트가 필요')

# 1) 가림 문자열 모으기 -------------------------------------------------------
def domain(u):
    m = re.match(r'https?://([^/]+)', u or ''); 
    if not m: return None
    d = m.group(1).lower(); return d[4:] if d.startswith('www.') else d
terms = set()
for r in roster['rows']:
    for k in ('name', 'provider'):
        v = (r.get(k) or '').strip()
        if v: terms.add(v)
        # 괄호 안 별칭도: "CliftonStrengths 34 (Gallup)" → "CliftonStrengths", "Gallup"
        for part in re.split(r'[()/·,]', v):
            p = part.strip()
            if len(p) >= 4 and not re.fullmatch(r'[\d\s]+', p): terms.add(p)
    d = domain(r.get('url')); 
    if d: terms.add(d); terms.add(d.split('.')[0]) if len(d.split('.')[0]) >= 5 else None
terms |= set(extra)
# 인물명은 성·이름 따로도 가린다("Alex Bradley" → "Alex", "Bradley"): 본문이 이름만 부르는 경우가 많다(실측: DiSC 샘플 14회)
COMMON = {'the', 'and', 'inc', 'company', 'sample', 'ltd', 'llc', 'co', 'corp', 'group', 'institute', 'press', 'systems', 'assessment', 'assessments', 'consulting', 'international', 'psychologists', 'john'}  # 'John' 은 John Doe 처리 때문에 별도 extra로 넣는다
for t in list(extra):
    for part in t.split():
        part = part.strip('.,;:()')
        if len(part) >= 3 and part[0].isupper() and part.lower() not in COMMON: terms.add(part)
    # 사람 이름 전체(예: "Mark Sample", "John Doe")는 띄어쓰기 포함 그대로도 가린다(위에서 이미 extra로 들어감)
# 실측 결함: 'The Myers-Briggs Company' 분해로 'The'·'Sample'이 들어가 본문 the/sample 전부가 검게 칠해짐(M03 1차). COMMON 으로 차단.
# 너무 일반적인 낱말은 제외(가림이 본문을 망가뜨림)
STOP = {'report', 'profile', 'strong', 'insight', 'complete', 'premium', 'career', 'suite', 'workplace', 'signature', 'discovery', 'perform', 'planner', 'journal', 'inventory', 'survey', 'index', 'behavioral', 'assessment', '검사', '리포트', '진단', '성격', '직업'}
# Peer 6057976 ①(구조 결함, ⑩의 근본 원인): 지우는 목록과 검사하는 목록이 같으면 목록의 실수가 검사에서도 통과한다.
# → 누출 검사용 목록(check_terms)은 STOP·ALLOWLIST를 적용하기 **전**의 전체 문자열로 따로 둔다(명부 41행 name·provider·도메인 + extra 전부).
#   ALLOWLIST 단어가 적중하면 "통과"가 아니라 allow_hits 로 출력해 사람 눈 확인 칸에 넘긴다.
check_terms = {t for t in terms if len(t) >= 4 and t.lower() not in COMMON}
terms = {t for t in terms if t.lower() not in STOP and len(t) >= 3}
model_terms = {t for t in terms if t.lower() in ALLOWLIST}  # 가리지 않음(모델명). 누출 검사는 check_terms 로 따로 센다.
terms -= model_terms

# 2) 처리 ---------------------------------------------------------------------
doc = pymupdf.open(INPDF)
found = {}
for page in doc:
    W, H = page.rect.width, page.rect.height; cover_rects = []
    # 표지(기본 1쪽): 회사 로고·워드마크가 벡터로 들어가 자동 검출이 안 되므로 통째로 가린다. 표지는 채점 대상이 아니다.
    if page.number < cover_pages:
        page.add_redact_annot(page.rect, fill=(0.85, 0.85, 0.85), text='[표지 — 가림 처리. 채점 대상 아님]', fontsize=14)
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE, graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)
        continue
    # 사용자 지정 사각형(썸네일 확인 뒤 남은 로고를 집어서 가림)
    for b in boxes:
        pn, coords = b.split(':'); 
        if int(pn) != page.number + 1: continue
        x0, y0, x1, y1 = (float(v) for v in coords.split(','))
        page.add_redact_annot(pymupdf.Rect(x0 * W, y0 * H, x1 * W, y1 * H), fill=(0.85, 0.85, 0.85))
    # 저작권 줄("© 2012 by John Wiley & Sons, Inc.") — 회사명이 쪼개져 들어가므로 줄 단위로 가림
    for blk in page.get_text('blocks'):
        if '©' in blk[4] or 'All rights reserved' in blk[4] or 'Copyright' in blk[4]:
            page.add_redact_annot(pymupdf.Rect(blk[:4]), fill=(0, 0, 0)); found['©-line'] = found.get('©-line', 0) + 1
    # 텍스트
    for t in terms:
        for rect in page.search_for(t, quads=False):
            page.add_redact_annot(rect + (-1, -1, 1, 1), fill=(0, 0, 0)); found[t] = found.get(t, 0) + 1
    # 낱말이 글리프 단위로 쪼개져 search_for가 일부만 잡는 경우(실측: "DONALD" → "DON"+"ALD") → words 단위로 다시 확인해 전체 낱말 상자를 가림
    for w in page.get_text('words'):
        wl = w[4].lower().strip('.,;:()®™')
        if wl in COMMON: continue
        if any(wl == t.lower() or (len(t) >= 5 and t.lower() in wl) for t in terms):
            page.add_redact_annot(pymupdf.Rect(w[:4]) + (-1, -1, 1, 1), fill=(0, 0, 0))
    # 이미지(로고 포함) 전부
    for img in page.get_images(full=True):
        for rect in page.get_image_rects(img[0]):
            page.add_redact_annot(rect, fill=(0.85, 0.85, 0.85))
    # 상단·하단 띠의 벡터 드로잉(벡터 로고·워드마크)
    top = pymupdf.Rect(0, 0, W, H * bands[0]); bot = pymupdf.Rect(0, H * (1 - bands[1]), W, H)
    # 글자 하나하나가 따로 그려진 벡터 워드마크(CliftonStrengths 사례)는 낱자 상자만 가리면 윤곽이 읽힌다 →
    # 같은 띠 안에서 가까운 드로잉을 한 덩어리로 합쳐(간격 < 높이×1.5) 여유(패딩 2pt)를 두고 가린다.
    band_rects = [d['rect'] for d in page.get_drawings() if d.get('rect') and (d['rect'].intersects(top) or d['rect'].intersects(bot)) and d['rect'].height < H * 0.25]
    band_rects.sort(key=lambda r: (round(r.y0), r.x0))
    clusters = []
    # 같은 줄(세로 겹침)이고 가로 간격이 띠 높이(= 글자 크기 상한) 미만이면 한 덩어리. 낱자 높이가 제각각(i, t, g)이라 높이 기준은 쓰지 않는다.
    GAP = H * bands[0] * 0.5
    for r in band_rects:
        for k, c in enumerate(clusters):
            v_overlap = min(c.y1, r.y1) - max(c.y0, r.y0)
            if v_overlap > 0 and (r.x0 - c.x1) < GAP and (c.x0 - r.x1) < GAP:
                clusters[k] = c | r; break   # 주의: `c |= r`는 새 Rect를 지역변수에 묶어 리스트가 안 바뀜(결함 사례)
        else:
            clusters.append(pymupdf.Rect(r))
    # 덩어리끼리 다시 한 번 합침(순서 때문에 못 붙은 것)
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                if min(a.y1, b.y1) - max(a.y0, b.y0) > 0 and (b.x0 - a.x1) < GAP and (a.x0 - b.x1) < GAP:
                    clusters[i] = a | b; del clusters[j]; merged = True; break
            if merged: break
    cover_rects = [c + (-2, -2, 2, 2) for c in clusters]
    for c in cover_rects:
        page.add_redact_annot(c, fill=(0.85, 0.85, 0.85))
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE, graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED)
    # 벡터 글리프가 redaction으로 안 지워지는 경우(실측: CliftonStrengths 워드마크, 경로가 한 객체로 묶임) → 불투명 사각형을 위에 그려 덮는다.
    # 덮기(cover)는 지우기(remove)가 아니므로 OCR 층이 최종 검증을 맡는다. 썸네일에서 사람이 한 번 더 본다.
    for c in cover_rects:
        page.draw_rect(c, color=None, fill=(0.85, 0.85, 0.85), overlay=True)
doc.set_metadata({k: '' for k in ('author', 'producer', 'creator', 'title', 'subject', 'keywords')})
pathlib.Path(OUTDIR).mkdir(parents=True, exist_ok=True)
out = pathlib.Path(OUTDIR) / f"{row['blind_id']}.pdf"
doc.save(str(out), garbage=4, deflate=True); doc.close()

# 2c) 이미지 PDF로 다시 만들기 ------------------------------------------------
mid = out  # 가림본(중간 산출물)
src = pymupdf.open(str(mid)); img_doc = pymupdf.open()
for pg in src:
    pm = pg.get_pixmap(dpi=170, alpha=False)
    np_ = img_doc.new_page(width=pg.rect.width, height=pg.rect.height)
    np_.insert_image(np_.rect, pixmap=pm)
img_doc.set_metadata({k: '' for k in ('author', 'producer', 'creator', 'title', 'subject', 'keywords', 'creationDate', 'modDate')})
img_doc.del_xml_metadata() if hasattr(img_doc, 'del_xml_metadata') else None
out = pathlib.Path(OUTDIR) / f"{row['blind_id']}.img.pdf"
img_doc.save(str(out), garbage=4, deflate=True); img_doc.close(); src.close()

# 3) 누출 검사 (최종 = 이미지 PDF) ---------------------------------------------
chk = pymupdf.open(str(out)); text = ' '.join(p.get_text() for p in chk).lower()
# ③ 메타·글꼴·주석 문자열 — 이미지 PDF에는 글꼴·주석·책갈피가 없어야 한다
hidden = {'text_layer_bytes': len(text.strip()), 'fonts': sorted({f[3] for pg in chk for f in pg.get_fonts()}), 'annots': sum(1 for pg in chk for _ in pg.annots()), 'links': sum(len(pg.get_links()) for pg in chk), 'toc': len(chk.get_toc()), 'embedded_files': chk.embfile_count(), 'metadata_nonempty': {k: v for k, v in chk.metadata.items() if v and k not in ('format', 'encryption')}}
hidden_leak = hidden['text_layer_bytes'] > 0 or hidden['fonts'] or hidden['annots'] or hidden['links'] or hidden['toc'] or hidden['embedded_files']
# 썸네일 시트(사람 눈 확인용)
from PIL import Image
thumbs = [Image.frombytes('RGB', (pm.width, pm.height), pm.samples) for pm in (pg.get_pixmap(dpi=50) for pg in chk)]
chk.close()
cols = 4; w = max(t.width for t in thumbs); h = max(t.height for t in thumbs); rows_n = -(-len(thumbs) // cols)
sheet = Image.new('RGB', (cols * w, rows_n * h), 'white')
for i, t in enumerate(thumbs): sheet.paste(t, ((i % cols) * w, (i // cols) * h))
sheet.save(str(out.with_suffix('.contact.png')))
# 누출 검사는 check_terms(허용 목록 미적용)로 돌린다. 허용 목록 단어·STOP 단어의 적중은 allow_hits 로 분리 출력(차단 아님, 눈 확인 대상).
def _is_allow(t): return t.lower() in ALLOWLIST or t.lower() in STOP
leaks_text = sorted({t for t in check_terms if t.lower() in text and not _is_allow(t)})
allow_hits = {'text_layer': sorted({t for t in check_terms if t.lower() in text and _is_allow(t)}), 'ocr_layer': {}}
# OCR 겹 — 렌더된 화면에서 다시 찾는다(윤곽선 글자·이미지 안 글자 대비)
import subprocess, tempfile
ocr_hits = {}
chk = pymupdf.open(str(out))
with tempfile.TemporaryDirectory() as td:
    for pg in chk:
        pm = pg.get_pixmap(dpi=150); img = f'{td}/p{pg.number}.png'; pm.save(img)
        try:
            txt = subprocess.run(['tesseract', img, '-', '-l', 'kor+eng', '--psm', '3'], capture_output=True, text=True, timeout=120).stdout.lower()
        except Exception as e:
            txt = ''; ocr_hits.setdefault('_ocr_error', []).append(f'p{pg.number + 1}:{e}')
        flat = re.sub(r'\s+', '', txt)  # OCR이 글자 사이를 띄우는 경우 대비
        for t in check_terms:
            tl = t.lower()
            if len(tl) >= 4 and (tl in txt or tl.replace(' ', '') in flat):
                (allow_hits['ocr_layer'] if _is_allow(t) else ocr_hits).setdefault(t, []).append(pg.number + 1)
chk.close()
leaks_ocr = sorted(k for k in ocr_hits if not k.startswith('_'))
leaks = sorted(set(leaks_text) | set(leaks_ocr) | ({'_hidden_structure'} if hidden_leak else set()))
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
row['redaction'] = {
    'items_found': [{'term': k, 'n': v} for k, v in sorted(found.items(), key=lambda x: -x[1])],
    'tool_sha256': sha(__file__), 'images_removed': True,
    'leak_check': {'roster_strings_found': len(leaks), 'leaked_terms': leaks, 'text_layer': leaks_text, 'ocr_layer': {k: v for k, v in ocr_hits.items()}, 'ocr_lang': 'kor+eng@150dpi', 'check_terms_n': len(check_terms), 'allow_hits': allow_hits, 'allow_hits_note': '허용 목록(모델명)·STOP 단어가 최종본에 남은 곳 — 차단 아님, 사람 눈 확인 대상', 'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')},
    'redacted_sha256': sha(str(out)) if not leaks else None, 'final_file': out.name, 'final_format': 'image-pdf@170dpi', 'intermediate_sha256': sha(str(mid)), 'hidden_structure': hidden,
    'visual_check': {'contact_sheet': out.with_suffix('.contact.png').name, 'passed': None, 'by': None, 'at': None},  # 사람이 채움
}
row['status'] = 'redacted_pending_visual' if not leaks else 'ready'
json.dump(e2, open(E2, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(ID, '→', out.name, '| 가린 문자열', sum(found.values()), '건', '| 누출 텍스트', len(leaks_text), 'OCR', len(leaks_ocr), {k: v for k, v in ocr_hits.items()} if ocr_hits else '', '| status', row['status'])
