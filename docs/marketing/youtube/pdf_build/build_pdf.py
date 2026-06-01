#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 마케팅 문서 → 외부 공유용 PDF 빌더
- Markdown을 HTML로 변환
- 브랜드 표지 + 본문 스타일 적용
- 페이지 끊김 방지: 표/blockquote/pre는 break-inside avoid (style.css),
  추가로 heading과 직후 콘텐츠를 .block 으로 그룹핑
- Playwright(Chromium) 헤드리스로 PDF 출력
"""
import re
import sys
import asyncio
from pathlib import Path
import markdown
from playwright.async_api import async_playwright

BASE = Path(__file__).resolve().parent
STYLE = (BASE / "style.css").read_text(encoding="utf-8")

# ---- 표지 메타 (문서별) ----
COVERS = {
    "60_YOUTUBE_MARKET_RESEARCH.md": {
        "kicker": "MARKETING · YOUTUBE STRATEGY",
        "title_html": '유튜브 시장조사 리포트<br><span class="accent">어느 길목에 노출하고,<br>어느 결로 전환시킬 것인가</span>',
        "sub": "검증된 2026 데이터와 내부 전략을 교차검증한, 사탕 발림 없는 노출·전환 전략 보고서",
        "doc_no": "REPORT 60",
    },
    "61_YOUTUBE_MANUAL.md": {
        "kicker": "MARKETING · OPERATION MANUAL",
        "title_html": '유튜브 완전 정복 매뉴얼<br><span class="accent">채널 만들기 → 제작 → 운영</span>',
        "sub": "보고 따라만 하면 되는, 초등학생도 따라 할 수 있는 단계별 실행 매뉴얼",
        "doc_no": "MANUAL 61",
    },
}

META_DATE = "2026. 06. 01"
META_OWNER = "김영식 대표 · Faise"
META_CONF = "CONFIDENTIAL · 외부 공유용"


def strip_first_h1_and_meta(md_text: str):
    """첫 H1 제목과 바로 뒤 인용(메타) 블록을 본문에서 제거(표지로 대체)."""
    lines = md_text.split("\n")
    out = []
    removed_h1 = False
    skipping_meta = False
    for i, ln in enumerate(lines):
        if not removed_h1 and ln.startswith("# "):
            removed_h1 = True
            skipping_meta = True
            continue
        if skipping_meta:
            # 메타 인용(>)과 빈 줄, 구분선까지 스킵
            if ln.strip().startswith(">") or ln.strip() == "" or ln.strip() == "---":
                continue
            else:
                skipping_meta = False
        out.append(ln)
    return "\n".join(out)


def group_blocks(html: str) -> str:
    """
    heading(h2/h3/h4)과 그 직후 콘텐츠(다음 동급 이상 heading 전까지)를
    .block div로 감싸 페이지 끊김을 줄인다. 단 너무 큰 그룹은 표 단위 avoid가 처리.
    여기서는 h3/h4 단위로 묶어 '제목+표/문단'이 갈라지지 않게 한다.
    """
    # 토큰 분해
    # h2는 섹션 시작이므로 그룹핑 기준에서 제외(섹션이 길 수 있음).
    # h3, h4 + 직후 형제들을 묶음.
    pattern = re.compile(r"(<h[34][^>]*>.*?</h[34]>)", re.DOTALL)
    parts = pattern.split(html)
    result = []
    i = 0
    while i < len(parts):
        part = parts[i]
        if re.match(r"<h[34]", part.strip()):
            # 다음 part(콘텐츠)까지 묶되, 다음 heading 직전까지
            content = parts[i + 1] if i + 1 < len(parts) else ""
            # content가 다음 h3/h4를 포함하지 않도록 split이 이미 보장
            result.append(f'<div class="block">{part}{content}</div>')
            i += 2
        else:
            result.append(part)
            i += 1
    return "".join(result)


def fix_indented_tables(md_text: str) -> str:
    """
    리스트 항목 아래 들여쓰기된 GFM 표(예: '   | 칸 | 값 |')는
    python-markdown이 표로 인식하지 못한다. 표 블록만 dedent하여
    독립 표로 렌더되게 보정한다. (원본 MD는 GitHub에서 정상 표시되므로 미수정)
    """
    lines = md_text.split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        # 들여쓰기 + 표 헤더( | ... | ) + 다음 줄이 구분선( |---| )
        stripped = ln.lstrip()
        indent = len(ln) - len(stripped)
        if (
            indent >= 2
            and stripped.startswith("|")
            and i + 1 < n
            and re.match(r"^\s*\|?[\s:|-]+\|?\s*$", lines[i + 1].strip())
            and "-" in lines[i + 1]
        ):
            # 표 블록 수집(연속된 | 로 시작하는 들여쓰기 줄)
            out.append("")  # 표 앞 빈 줄 보장
            j = i
            while j < n and lines[j].lstrip().startswith("|"):
                out.append(lines[j].lstrip())  # dedent
                j += 1
            out.append("")  # 표 뒤 빈 줄 보장
            i = j
            continue
        out.append(ln)
        i += 1
    return "\n".join(out)


def md_to_html(md_path: Path) -> str:
    raw = md_path.read_text(encoding="utf-8")
    raw = strip_first_h1_and_meta(raw)
    raw = fix_indented_tables(raw)
    # 내부 상대 링크(.md, #anchor)는 PDF에서 의미 없으므로 텍스트 유지
    md = markdown.Markdown(
        extensions=[
            "tables",
            "fenced_code",
            "sane_lists",
            "attr_list",
            "md_in_html",
        ]
    )
    body = md.convert(raw)
    body = group_blocks(body)
    return body


def build_full_html(md_name: str, body_html: str) -> str:
    c = COVERS[md_name]
    cover = f"""
    <section class="cover">
      <div class="cover-brand"><span class="dot"></span>인생포트폴리오 · LIFE PORTFOLIO</div>
      <div class="cover-spacer"></div>
      <span class="cover-kicker">{c['kicker']}</span>
      <h1 class="cover-title">{c['title_html']}</h1>
      <div class="cover-rule"></div>
      <p class="cover-sub">{c['sub']}</p>
      <div class="cover-spacer"></div>
      <div class="cover-meta">
        <div><span class="label">문서</span><span class="val">{c['doc_no']}</span></div>
        <div><span class="label">작성일</span><span class="val">{META_DATE}</span></div>
        <div><span class="label">수신</span><span class="val">{META_OWNER}</span></div>
        <div><span class="label">분류</span><span class="val">{META_CONF}</span></div>
      </div>
    </section>
    """
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>{STYLE}</style>
</head>
<body>
{cover}
<main class="doc">
{body_html}
</main>
</body>
</html>"""


FOOTER_TPL = (
    '<div style="width:100%;font-size:7.5pt;color:#9aa3b2;'
    'font-family:\'Noto Sans CJK KR\',sans-serif;padding:0 16mm;'
    'display:flex;justify-content:space-between;">'
    '<span>인생포트폴리오 · 외부 공유용 · CONFIDENTIAL</span>'
    '<span>{TITLE}</span>'
    '<span class="pageNumber"></span> / <span class="totalPages"></span>'
    "</div>"
)


async def render(md_name: str, title_short: str):
    md_path = BASE.parent / md_name
    body = md_to_html(md_path)
    html = build_full_html(md_name, body)
    out_html = BASE / "dist" / md_name.replace(".md", ".html")
    out_html.write_text(html, encoding="utf-8")
    out_pdf = BASE / "dist" / md_name.replace(".md", ".pdf")

    footer = FOOTER_TPL.replace("{TITLE}", title_short)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--font-render-hinting=none"])
        page = await browser.new_page()
        await page.goto(out_html.as_uri(), wait_until="networkidle")
        await page.emulate_media(media="print")
        await page.pdf(
            path=str(out_pdf),
            format="A4",
            print_background=True,
            margin={"top": "0", "bottom": "16mm", "left": "0", "right": "0"},
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=footer,
            prefer_css_page_size=True,
        )
        await browser.close()
    print(f"OK  {md_name}  ->  {out_pdf.name}")
    return out_pdf


async def main():
    await render("60_YOUTUBE_MARKET_RESEARCH.md", "유튜브 시장조사 리포트")
    await render("61_YOUTUBE_MANUAL.md", "유튜브 완전 정복 매뉴얼")


if __name__ == "__main__":
    asyncio.run(main())
