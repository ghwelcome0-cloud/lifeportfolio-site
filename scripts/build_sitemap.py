#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PR #16 — sitemap.xml 자동 생성기
- index/follow 페이지만 수록
- KO/EN hreflang alternates 포함 (Google 다국어 SEO)
- /blog/* 게시글 자동 수록 (있을 경우)
- 빌드/배포 시 실행 → sitemap.xml 갱신
"""
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path("/home/user/webapp")
BASE = "https://lifeportfolio.co.kr"

# 공개 색인 페이지 (PR #15 robots 정책 기준 index,follow)
PUBLIC_PAGES = [
    # (path, priority, changefreq)
    ("/",                "1.0", "weekly"),   # index.html
    ("/index.html",      "1.0", "weekly"),
    ("/product.html",    "0.9", "weekly"),
    ("/login.html",      "0.6", "monthly"),
    ("/signup.html",     "0.6", "monthly"),
    ("/privacy.html",    "0.3", "yearly"),
    ("/terms.html",      "0.3", "yearly"),
    ("/blog/",           "0.8", "weekly"),   # 블로그 인덱스 (PR #16에서 뼈대 생성)
]

def file_lastmod(rel_path: str) -> str:
    """해당 페이지 파일의 마지막 수정 시각 → ISO 8601 (date 부분만)."""
    if rel_path == "/":
        rel_path = "/index.html"
    fp = ROOT / rel_path.lstrip("/")
    if rel_path.endswith("/"):
        # /blog/ 같은 디렉토리 → index.html
        fp = ROOT / rel_path.lstrip("/") / "index.html"
    if fp.exists():
        ts = datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc)
        return ts.strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def collect_blog_posts():
    """/blog/posts/*.html 자동 수집 (있을 때만)."""
    posts_dir = ROOT / "blog" / "posts"
    out = []
    if not posts_dir.exists():
        return out
    for fp in sorted(posts_dir.glob("*.html")):
        rel = "/blog/posts/" + fp.name
        # noindex 게시글은 건너뛰기
        try:
            content = fp.read_text(encoding="utf-8", errors="ignore")[:4000]
            if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', content, re.I):
                continue
        except Exception:
            pass
        out.append((rel, "0.7", "monthly"))
    return out


def build():
    pages = list(PUBLIC_PAGES) + collect_blog_posts()

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    )
    for path, prio, freq in pages:
        loc_default = f"{BASE}{path}"
        loc_ko = f"{BASE}{path}{'?' if '?' not in path else '&'}lang=ko"
        loc_en = f"{BASE}{path}{'?' if '?' not in path else '&'}lang=en"

        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc_default)}</loc>")
        lines.append(f"    <lastmod>{file_lastmod(path)}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")
        # hreflang alternates
        lines.append(f'    <xhtml:link rel="alternate" hreflang="ko" href="{escape(loc_ko)}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{escape(loc_en)}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{escape(loc_default)}"/>')
        lines.append("  </url>")
    lines.append("</urlset>\n")

    out_path = ROOT / "sitemap.xml"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: {out_path} ({out_path.stat().st_size} bytes, {len(pages)} URLs)")
    return out_path


if __name__ == "__main__":
    build()
