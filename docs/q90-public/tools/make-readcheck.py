#!/usr/bin/env python3
"""E2 judge 읽기 확인용 합성 문서 생성기 (TL 6058049 · Peer 6057976 ③).

왜: 18쪽짜리 이미지 PDF를 judge가 끝까지 읽는지 확인해야 한다. 실제 샘플을 쓰면 그 샘플만 두 번 보게 되므로
명부 밖 **중립 합성 문서**를 실제 패킷과 같은 형식(170dpi 이미지 PDF, 텍스트 레이어 없음)으로 만든다.
1쪽·중간 쪽·마지막 쪽에 서로 다른 표지어를 넣고, 마지막 쪽에 작은 표를 둔다. judge는 표지어 3개 + 표의 값 1개를 답한다.
4개 모두 맞히면 통과(read_check=pass). 하나라도 틀리면 교체 또는 쪽 나눠 보내기. 답은 점수가 아니라 시트 read_check 칸에만 적는다.

Usage: python3 make-readcheck.py <outDir> <pages> <seed> [dpi=170]

rc1 실측(2026-10-12) 결함 ⑪: 질문에 쪽 번호(1·10·18)를 적어 주니 3명 모두 그 3쪽만 열어봄 → "끝까지 읽는가"를 못 쟀다.
또 3명 모두 170dpi 12pt "물레방아"를 "몰레방아"로 오독(체계적) → 표지어를 본문 크기(10pt)로 내려 실제 조건을 재고, dpi 선택 가능.
rc2부터: 표지어 쪽 번호 비공개(첫·마지막 외 중간 1곳은 무작위), 질문은 "표지어가 있는 쪽 번호 전부 + 표지어", 본문 문장 1개 질문 추가.
출력: <outDir>/readcheck-<seed>.img.pdf, <outDir>/readcheck-<seed>.key.json (정답 — 저장소·패킷에 넣지 않음)
"""
import sys, json, hashlib, random, pathlib, pymupdf

OUT, PAGES, SEED = pathlib.Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
DPI = int(sys.argv[4]) if len(sys.argv) > 4 else 170
rnd = random.Random(SEED)
WORDS = ['감나무', '종이배', '바람개비', '소금쟁이', '등불', '조약돌', '구름다리', '달팽이', '연필심', '물레방아', '쇠구슬', '솔방울']
rnd.shuffle(WORDS)
mark = {'first': WORDS[0], 'middle': WORDS[1], 'last': WORDS[2]}
mid_page = rnd.randint(3, PAGES - 2)  # 비공개 무작위 중간 쪽
probe_page = rnd.choice([i for i in range(2, PAGES) if i != mid_page]); probe_word = WORDS[3]
table = [('가', rnd.randint(11, 97)), ('나', rnd.randint(11, 97)), ('다', rnd.randint(11, 97)), ('라', rnd.randint(11, 97))]
ask_row = rnd.choice(table)

filler = ("이 문서는 읽기 확인용 연습 자료입니다. 어떤 회사나 검사와도 관계가 없습니다. 각 쪽에는 일반적인 설명 문장이 들어 있고, "
          "몇몇 쪽에는 표지어가 숨어 있습니다. 끝까지 읽은 뒤 질문에 답해 주세요. ")
src = pymupdf.open()
font = pymupdf.Font('cjk')
for i in range(1, PAGES + 1):
    pg = src.new_page(width=595, height=842)
    tw = pymupdf.TextWriter(pg.rect)
    tw.append((50, 60), f'연습 문서 · {i} / {PAGES} 쪽', font=font, fontsize=11)
    y = 100
    for _ in range(14):
        tw.append((50, y), filler[: rnd.randint(60, 110)], font=font, fontsize=10); y += 18
    # 표지어는 본문과 같은 크기(10pt)·같은 위치 체계로 — 눈에 띄는 큰 글씨면 실제 조건이 아니다
    if i == 1: tw.append((50, y + 20), f'표지어: {mark["first"]}', font=font, fontsize=10)
    if i == mid_page: tw.append((50, y + 20), f'표지어: {mark["middle"]}', font=font, fontsize=10)
    if i == probe_page: tw.append((50, y + 20), f'이 쪽의 열쇠말은 {probe_word} 입니다.', font=font, fontsize=10)
    if i == PAGES:
        tw.append((50, y + 20), f'표지어: {mark["last"]}', font=font, fontsize=10)
        ty = y + 60; tw.append((50, ty), '표 1. 항목별 값', font=font, fontsize=11); ty += 20
        for k, v in table:
            pg.draw_rect(pymupdf.Rect(50, ty - 12, 250, ty + 6), color=(0, 0, 0), width=0.5)
            tw.append((60, ty), f'항목 {k}', font=font, fontsize=10); tw.append((180, ty), str(v), font=font, fontsize=10); ty += 18
    tw.write_text(pg)
# 실제 패킷과 같은 형식: 170dpi 이미지 PDF, 메타 비움
img = pymupdf.open()
for pg in src:
    pm = pg.get_pixmap(dpi=DPI); np_ = img.new_page(width=pg.rect.width, height=pg.rect.height); np_.insert_image(np_.rect, pixmap=pm)
img.set_metadata({k: '' for k in ('author', 'producer', 'creator', 'title', 'subject', 'keywords', 'creationDate', 'modDate')})
OUT.mkdir(parents=True, exist_ok=True)
pdf = OUT / f'readcheck-{SEED}.img.pdf'; img.save(str(pdf), garbage=4, deflate=True)
chk = pymupdf.open(str(pdf)); assert sum(len(p.get_text()) for p in chk) == 0 and not any(p.get_fonts() for p in chk); chk.close()
key = {'seed': SEED, 'pages': PAGES, 'dpi': DPI,
       'questions': ['"표지어:"가 적힌 쪽 번호 전부와 각 표지어(순서대로)', '"열쇠말"이 적힌 쪽 번호와 그 열쇠말', f'마지막 쪽 표 1에서 항목 {ask_row[0]}의 값'],
       'answers': {'marker_pages': [1, mid_page, PAGES], 'markers': [mark['first'], mark['middle'], mark['last']], 'probe_page': probe_page, 'probe_word': probe_word, 'table_value': str(ask_row[1])},
       'pdf_sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(), 'pass_rule': '쪽 번호 3개·표지어 3개·열쇠말 쪽+단어·표 값 — 전부 정확히 일치(총 9항목)'}
(OUT / f'readcheck-{SEED}.key.json').write_text(json.dumps(key, ensure_ascii=False, indent=1))
print(pdf, key['pdf_sha256'][:16], 'questions', key['questions'])
