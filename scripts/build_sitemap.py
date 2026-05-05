#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PR #16 — sitemap.xml 자동 생성기 (PR #20 업그레이드)
- index/follow 페이지만 수록
- KO/EN hreflang alternates 포함 (Google 다국어 SEO)
- /blog/posts/*.html (KO) 자동 수록
- /blog/posts-en/*.html (EN) 자동 수록
- /blog/en/ 영문 인덱스 자동 수록
- 빌드/배포 시 실행 → sitemap.xml 갱신
"""
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://lifeportfolio.co.kr"

# 공개 색인 페이지 (PR #15 robots 정책 기준 index,follow)
# (path, priority, changefreq, with_hreflang)
PUBLIC_PAGES = [
    ("/",                "1.0", "weekly",  True),
    ("/index.html",      "1.0", "weekly",  True),
    ("/product.html",    "0.9", "weekly",  True),
    ("/login.html",      "0.6", "monthly", True),
    ("/signup.html",     "0.6", "monthly", True),
    ("/privacy.html",    "0.3", "yearly",  True),
    ("/terms.html",      "0.3", "yearly",  True),
    ("/blog/",           "0.8", "weekly",  True),   # 한국어 블로그 인덱스
    ("/blog/en/",        "0.8", "weekly",  True),   # 영문 블로그 인덱스 (PR #20)
]


def file_lastmod(rel_path: str) -> str:
    """해당 페이지 파일의 마지막 수정 시각 → ISO 8601 (date 부분만)."""
    if rel_path == "/":
        rel_path = "/index.html"
    fp = ROOT / rel_path.lstrip("/")
    if rel_path.endswith("/"):
        fp = ROOT / rel_path.lstrip("/") / "index.html"
    if fp.exists():
        ts = datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc)
        return ts.strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _is_indexable(fp: Path) -> bool:
    """robots noindex 게시글은 sitemap에서 제외."""
    try:
        content = fp.read_text(encoding="utf-8", errors="ignore")[:4000]
        if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', content, re.I):
            return False
    except Exception:
        pass
    return True


def collect_blog_posts():
    """PR #20 — KO/EN 시드 글 자동 수집.
    각 포스트는 hreflang alternate를 가지지만, posts-en은 EN 단독 URL.
    URL은 hreflang 페어가 메타에 명시되어 있으므로 sitemap에서는
    각 언어판 URL을 별도 항목으로 등록한다.
    """
    out = []

    # KO posts
    ko_dir = ROOT / "blog" / "posts"
    if ko_dir.exists():
        for fp in sorted(ko_dir.glob("*.html")):
            if not _is_indexable(fp):
                continue
            rel = "/blog/posts/" + fp.name
            out.append((rel, "0.7", "monthly", False))  # hreflang은 메타에 명시되어 있어 sitemap에서는 단순 URL

    # EN posts
    en_dir = ROOT / "blog" / "posts-en"
    if en_dir.exists():
        for fp in sorted(en_dir.glob("*.html")):
            if not _is_indexable(fp):
                continue
            rel = "/blog/posts-en/" + fp.name
            out.append((rel, "0.7", "monthly", False))

    return out


def build():
    pages = list(PUBLIC_PAGES) + collect_blog_posts()

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    )
    for path, prio, freq, with_hreflang in pages:
        loc_default = f"{BASE}{path}"

        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc_default)}</loc>")
        lines.append(f"    <lastmod>{file_lastmod(path)}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")

        if with_hreflang:
            sep = '?' if '?' not in path else '&'
            loc_ko = f"{BASE}{path}{sep}lang=ko"
            loc_en = f"{BASE}{path}{sep}lang=en"
            lines.append(f'    <xhtml:link rel="alternate" hreflang="ko" href="{escape(loc_ko)}"/>')
            lines.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{escape(loc_en)}"/>')
            lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{escape(loc_default)}"/>')

        lines.append("  </url>")
    lines.append("</urlset>\n")

    out_path = ROOT / "sitemap.xml"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: {out_path} ({out_path.stat().st_size} bytes, {len(pages)} URLs)")
    for path, prio, freq, _ in pages:
        print(f"  · {path:50s} prio={prio} freq={freq}")
    return out_path


if __name__ == "__main__":
    build()
