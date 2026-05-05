#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PR #20 — RSS 2.0 자동 생성기 (KO + EN)

- /blog/posts/*.html        → /blog/rss.xml      (ko-KR)
- /blog/posts-en/*.html     → /blog/rss-en.xml   (en-US)

각 포스트의 <title>, <meta name="description">, og:url, article:published_time,
article:section, article:tag, og:image 를 파싱해 RSS 항목으로 변환한다.

RFC-822 pubDate, GUID(=canonical URL), <atom:link> self 링크를 포함하여
Feedly / NetNewsWire / 구독 도구가 그대로 인식할 수 있는 형태.
"""
import re
from datetime import datetime, timezone, timedelta
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://lifeportfolio.co.kr"
KST = timezone(timedelta(hours=9))


# ── HTML helpers ────────────────────────────────────────────────────────────
def _meta(html: str, name: str) -> str:
    m = re.search(
        rf'<meta\s+(?:name|property)="{re.escape(name)}"\s+content="([^"]*)"',
        html, re.I,
    )
    return m.group(1) if m else ""


def _all_meta(html: str, name: str) -> list[str]:
    return re.findall(
        rf'<meta\s+(?:name|property)="{re.escape(name)}"\s+content="([^"]*)"',
        html, re.I,
    )


def _title(html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    return m.group(1).strip() if m else ""


def _parse_iso8601(s: str) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    # 2026-05-05T09:00:00+09:00
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        pass
    # 2026-05-05
    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d")
        return d.replace(tzinfo=KST)
    except Exception:
        return None


# ── Per-post extraction ─────────────────────────────────────────────────────
def parse_post(fp: Path) -> dict | None:
    try:
        html = fp.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None

    # noindex skip
    if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', html, re.I):
        return None

    title = _title(html)
    desc = _meta(html, "description") or _meta(html, "og:description")
    url = _meta(html, "og:url")
    if not url:
        return None
    pub_raw = _meta(html, "article:published_time")
    pub_dt = _parse_iso8601(pub_raw) or datetime.fromtimestamp(fp.stat().st_mtime, tz=KST)

    section = _meta(html, "article:section")
    tags = _all_meta(html, "article:tag")
    image = _meta(html, "og:image")

    return {
        "title": title,
        "description": desc,
        "url": url,
        "pubDate": format_datetime(pub_dt),  # RFC-822
        "section": section,
        "tags": tags,
        "image": image,
        "guid": url,
    }


# ── Feed builder ────────────────────────────────────────────────────────────
def build_feed(posts: list[dict], lang: str, channel: dict, out_rel: str) -> Path:
    """posts: 최신순 정렬된 dict 리스트."""
    self_href = f"{BASE}{out_rel}"

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(
        '<rss version="2.0"\n'
        '     xmlns:atom="http://www.w3.org/2005/Atom"\n'
        '     xmlns:dc="http://purl.org/dc/elements/1.1/"\n'
        '     xmlns:content="http://purl.org/rss/1.0/modules/content/">'
    )
    lines.append("  <channel>")
    lines.append(f"    <title>{escape(channel['title'])}</title>")
    lines.append(f"    <link>{escape(channel['link'])}</link>")
    lines.append(
        f'    <atom:link href="{escape(self_href)}" rel="self" type="application/rss+xml"/>'
    )
    lines.append(f"    <description>{escape(channel['description'])}</description>")
    lines.append(f"    <language>{escape(lang)}</language>")
    lines.append(f"    <copyright>{escape(channel['copyright'])}</copyright>")
    if posts:
        lines.append(f"    <lastBuildDate>{posts[0]['pubDate']}</lastBuildDate>")
    else:
        lines.append(f"    <lastBuildDate>{format_datetime(datetime.now(KST))}</lastBuildDate>")
    lines.append("    <generator>scripts/build_rss.py — PR #20</generator>")
    lines.append("    <ttl>60</ttl>")

    for p in posts:
        lines.append("    <item>")
        lines.append(f"      <title>{escape(p['title'])}</title>")
        lines.append(f"      <link>{escape(p['url'])}</link>")
        lines.append(f'      <guid isPermaLink="true">{escape(p["guid"])}</guid>')
        lines.append(f"      <pubDate>{p['pubDate']}</pubDate>")
        if p.get("section"):
            lines.append(f"      <category>{escape(p['section'])}</category>")
        for tag in p.get("tags", []):
            lines.append(f"      <category>{escape(tag)}</category>")
        if p.get("description"):
            lines.append(f"      <description>{escape(p['description'])}</description>")
        if p.get("image"):
            lines.append(
                f'      <enclosure url="{escape(p["image"])}" type="image/png" length="0"/>'
            )
        lines.append("    </item>")

    lines.append("  </channel>")
    lines.append("</rss>\n")

    out_path = ROOT / out_rel.lstrip("/")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: {out_path} ({out_path.stat().st_size} bytes, {len(posts)} items)")
    for p in posts:
        print(f"  · {p['title'][:70]}")
    return out_path


def collect(dir_rel: str) -> list[dict]:
    d = ROOT / dir_rel.lstrip("/")
    if not d.exists():
        return []
    out = []
    for fp in sorted(d.glob("*.html")):
        info = parse_post(fp)
        if info:
            out.append(info)
    # newest first by pubDate (parse from rfc-822 isn't trivial — use file pos as fallback,
    # but article:published_time should already be in newest-first order via filename sort
    # since we use ISO date prefix in filenames). We sort by url path desc as tie-breaker.
    out.sort(key=lambda x: x["url"], reverse=True)
    return out


def main() -> None:
    print("PR #20 — Building RSS feeds (KO + EN)")
    print("=" * 60)

    # Korean feed
    ko_posts = collect("blog/posts")
    build_feed(
        ko_posts,
        lang="ko-KR",
        channel={
            "title": "Insights · 인생포트폴리오 블로그",
            "link": f"{BASE}/blog/",
            "description": "발견하고, 살아내고, 남기는 한 권의 인생 설계도. 자기경영 인사이트와 Only One 리포트 활용 가이드.",
            "copyright": "© 2026 인생포트폴리오 / Life Portfolio",
        },
        out_rel="/blog/rss.xml",
    )

    # English feed
    en_posts = collect("blog/posts-en")
    build_feed(
        en_posts,
        lang="en-US",
        channel={
            "title": "Insights · Life Portfolio Blog",
            "link": f"{BASE}/blog/en/",
            "description": "Discover, live it out, leave a trace. Self-management essays, Only One Report how-to guides, and 21-day routine designs.",
            "copyright": "© 2026 Life Portfolio · 인생포트폴리오",
        },
        out_rel="/blog/rss-en.xml",
    )

    print("=" * 60)
    print(f"Done. KO posts: {len(ko_posts)} · EN posts: {len(en_posts)}")


if __name__ == "__main__":
    main()
