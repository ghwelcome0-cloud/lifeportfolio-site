#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rebuild_page9_only.py
=====================
p.9(검사 리포트 옮겨 적기 인트로) 한 페이지만 다시 렌더링하여
기존 body_256p.pdf의 p.9를 교체.

원인: 기존 코드에서 '년/월/일' 빈칸을 `<span style="border-bottom; display:inline-block; height:6mm;"></span>`
으로 만들었는데, WeasyPrint가 이 빈 inline-block의 baseline 처리 중
border-bottom 픽셀이 p.9 하단 목록 영역(②번 줄)에 잘못 그려지는 버그가 있었음.
table cell 기반으로 교체하여 해결.
"""

import sys
from pathlib import Path
import importlib.util

ROOT = Path("/home/user/webapp")
BODY_PDF = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/body_256p.pdf"
PAGE9_PDF = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/_page9_tmp.pdf"

# 메인 빌더 모듈 import
spec = importlib.util.spec_from_file_location(
    "builder",
    ROOT / "scripts/build_diary_print_ready_body.py"
)
builder = importlib.util.module_from_spec(spec)
# 메인 실행을 막기 위해 __name__ 다르게
sys.modules["builder"] = builder
spec.loader.exec_module(builder)

# 1) p.9 HTML 단독 생성
print("[1/3] p.9 HTML 생성 중...")
page_html = builder.intro_with_start_date("p. 9")

# 전체 페이지 래퍼 (CSS 포함)
full_html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
{builder.GLOBAL_CSS if hasattr(builder, 'GLOBAL_CSS') else ''}
</style>
</head>
<body>
{page_html}
</body>
</html>
"""

# build_html() 함수로 동일한 전체 CSS를 얻기 위해 우회
print("[2/3] 전체 HTML 빌더에서 CSS 추출 중...")
full_html_with_all_pages = builder.build_html()

# p.9만 추출하기 위해 build_html 결과에서 p.9 페이지만 살리고 나머지 삭제하는 건 비효율
# 대신: 전체 HTML 문자열에서 head + style + 9번째 <div class="page"> 만 남기기
import re

# head + style 부분
m = re.search(r'^(.*?<body[^>]*>)', full_html_with_all_pages, re.DOTALL)
head = m.group(1) if m else ''

# 모든 페이지 div 추출
pages = re.findall(r'(<div class="page">.*?</div>\s*(?=<div class="page">|</body>))', full_html_with_all_pages, re.DOTALL)
print(f"   → 추출된 페이지 수: {len(pages)}")

if len(pages) < 9:
    print(f"[ERROR] 페이지 수 부족: {len(pages)}")
    sys.exit(1)

page9_only_html = head + pages[8] + '</body></html>'  # 0-indexed, p.9 = index 8

# 임시 HTML 파일
tmp_html = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/_page9_tmp.html"
tmp_html.write_text(page9_only_html, encoding='utf-8')
print(f"   → 임시 HTML: {tmp_html.stat().st_size / 1024:.1f} KB")

# 3) WeasyPrint로 PDF 생성 (p.9만)
print("[3/3] p.9 단독 PDF 생성 중 (WeasyPrint)...")
from weasyprint import HTML, CSS

# fontconfig 환경 설정
import os
fontdir = ROOT / "assets/fonts"
if fontdir.exists():
    os.environ['FONTCONFIG_PATH'] = str(fontdir)

HTML(filename=str(tmp_html)).write_pdf(str(PAGE9_PDF))
print(f"   → p.9 PDF: {PAGE9_PDF.stat().st_size / 1024:.1f} KB")

# 4) 기존 256p PDF의 p.9를 새 p.9로 교체
print("\n[4/4] 기존 256p PDF의 p.9 교체 중...")
import fitz

src = fitz.open(str(BODY_PDF))
new_p9 = fitz.open(str(PAGE9_PDF))

# 새 PDF 만들기: p.1-8 + 새 p.9 + p.10-256
out = fitz.open()
out.insert_pdf(src, from_page=0, to_page=7)   # 1-8
out.insert_pdf(new_p9, from_page=0, to_page=0)  # 새 9
out.insert_pdf(src, from_page=9, to_page=255)  # 10-256

# 저장 경로 (덮어쓰기 안 함, 별도 파일로 먼저 저장)
FIXED_PDF = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/body_256p_FIXED.pdf"
out.save(str(FIXED_PDF), deflate=True, garbage=3)
out.close()
src.close()
new_p9.close()

print(f"\n✅ 완성: {FIXED_PDF}")
print(f"   크기: {FIXED_PDF.stat().st_size / 1024:.1f} KB")

# 검증
verify = fitz.open(str(FIXED_PDF))
print(f"   페이지 수: {len(verify)}")
verify.close()

# 임시 파일 정리
tmp_html.unlink(missing_ok=True)
PAGE9_PDF.unlink(missing_ok=True)
print("\n임시 파일 정리 완료.")
