#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 블로그 포스트 일괄 빌더 (PR 다음 단계용)
- 공통 헤더/푸터/SEO/JSON-LD 보일러플레이트를 한 곳에서 관리
- 본문(BODY)과 메타(META)만 다르게 주입
- KO/EN 동일 구조, 미러 hreflang 자동 연결
- 정책:
  * <meta robots="index,follow,max-image-preview:large">
  * CTA UTM: ?utm_source=blog&utm_medium=cta&utm_campaign=blog_<slug>(_en)
  * 익명 처리 원칙: 교회명·지역명·조직명·개인 식별 NO. 사례는 '한 도시 교회 리더팀', '한 청년 모임', '팀 단위 진단-실천 모임', '창업자 본인의 수작업 정리'로 표현. 연수(예: 12년) 같은 식별 가능한 수치도 사용하지 않음.
  * 광고문구 과장·후기 인용 없음 (안전: 표시광고법/약관규제법 준수)
"""

import os
import re
import sys
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = "https://lifeportfolio.co.kr"
KO_DIR = ROOT / "blog" / "posts"
EN_DIR = ROOT / "blog" / "posts-en"


def utm(slug, lang):
    suffix = "_en" if lang == "en" else ""
    return f"?utm_source=blog&utm_medium=cta&utm_campaign=blog_{slug}{suffix}"


def cta_link(slug, lang):
    if lang == "en":
        return f"/product.html?lang=en&utm_source=blog&utm_medium=cta&utm_campaign=blog_{slug}_en"
    return f"/product.html?utm_source=blog&utm_medium=cta&utm_campaign=blog_{slug}"


def render_ko(slug, meta, body_html):
    """Render a single Korean blog post HTML."""
    url = f"{SITE}/blog/posts/{slug}.html"
    en_url = f"{SITE}/blog/posts-en/{slug}.html"
    title = meta["title"]
    desc = meta["description"]
    keywords = meta.get("keywords", "")
    section = meta.get("section", "Insights")
    eyebrow = meta.get("eyebrow", section)
    breadcrumb_tail = meta.get("breadcrumb", title)
    pub_date = meta.get("date", "2026-05-15")
    pub_iso = meta.get("date_iso", f"{pub_date}T09:00:00+09:00")
    read_min = meta.get("read_min", "7분")
    lead = meta["lead"]
    related = meta.get("related", [])
    tags = meta.get("tags", [])
    tags_xml = "\n  ".join([f'<meta property="article:tag" content="{t}">' for t in tags])
    cta_h3 = meta.get("cta_h3", "리포트대로 살면, 당신의 삶이 자산이 됩니다")
    cta_p = meta.get("cta_p", "76문항 15분 진단 · 결제 즉시 자동 생성 · ₩9,900")
    cta_label = meta.get("cta_label", "첫 3주 실행 설계도 받기 →")
    cta_href = cta_link(slug, "ko")

    related_html = "\n      ".join(
        [f'<li><a href="/blog/posts/{r["slug"]}.html">{r["title"]}</a></li>' for r in related]
    )

    return f"""<!doctype html>
<html lang="ko">
<head>
  <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
  <link rel="preconnect" href="https://www.google-analytics.com" crossorigin>
  <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>{title} · 인생포트폴리오 Insights</title>
  <meta name="google-site-verification" content="uoSIxdhBhBDILkJkhTCuIf_IDymqoYZKkWfO8bmnbK4">
  <meta name="naver-site-verification" content="d8784cb0e7d5de6f464cefa3a89b886d3a733733">
  <link rel="canonical" href="{url}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="description" content="{desc}">
  <meta name="keywords" content="{keywords}">
  <meta name="author" content="인생포트폴리오 / Life Portfolio">
  <meta property="article:published_time" content="{pub_iso}">
  <meta property="article:section" content="{section}">
  {tags_xml}
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="인생포트폴리오 / Life Portfolio">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:locale:alternate" content="en_US">
  <meta property="og:image" content="{SITE}/assets/og/og-default-ko.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{SITE}/assets/og/og-default-ko.png">
  <link rel="alternate" hreflang="ko" href="{url}">
  <link rel="alternate" hreflang="en" href="{en_url}">
  <link rel="alternate" hreflang="x-default" href="{url}">
  <link rel="alternate" type="application/rss+xml" title="인생포트폴리오 Insights — RSS" href="/blog/rss.xml">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="../post.css">
  <script type="application/ld+json">
  {{
    "@context":"https://schema.org",
    "@type":"BlogPosting",
    "@id":"{url}#article",
    "mainEntityOfPage":"{url}",
    "headline":"{title}",
    "description":"{desc}",
    "image":"{SITE}/assets/og/og-default-ko.png",
    "datePublished":"{pub_iso}",
    "dateModified":"{pub_iso}",
    "inLanguage":"ko-KR",
    "author":{{"@type":"Organization","@id":"{SITE}/#organization","name":"인생포트폴리오"}},
    "publisher":{{"@type":"Organization","@id":"{SITE}/#organization","name":"인생포트폴리오","logo":{{"@type":"ImageObject","url":"{SITE}/assets/icon-512.png"}}}},
    "keywords":"{keywords}"
  }}
  </script>
  <script type="application/ld+json">
  {{
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",
    "itemListElement":[
      {{"@type":"ListItem","position":1,"name":"홈","item":"{SITE}/"}},
      {{"@type":"ListItem","position":2,"name":"블로그","item":"{SITE}/blog/"}},
      {{"@type":"ListItem","position":3,"name":"{title}","item":"{url}"}}
    ]
  }}
  </script>
  <script src="../../assets/js/web-vitals.js" defer></script>
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a href="/" class="brand">인생포트폴리오 <b>·</b> Life Portfolio</a>
    <nav class="nav">
      <a href="/">홈</a>
      <a href="/product.html">상품</a>
      <a href="/blog/" aria-current="page">블로그</a>
      <a href="/login.html">로그인</a>
    </nav>
  </div>
</header>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">홈</a><span class="sep">/</span>
  <a href="/blog/">블로그</a><span class="sep">/</span>
  <span>{breadcrumb_tail}</span>
</nav>

<article class="post">
  <header class="post-head">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    <p class="lead">{lead}</p>
    <p class="meta"><time datetime="{pub_date}">{pub_date}</time> · {read_min} 읽기 · {section}</p>
  </header>

{body_html}

  <div class="cta-box">
    <h3>{cta_h3}</h3>
    <p>{cta_p}</p>
    <a class="btn" href="{cta_href}">{cta_label}</a>
  </div>

  <div class="related">
    <h4>이어 읽기</h4>
    <ul>
      {related_html}
    </ul>
  </div>
</article>

<footer class="site-footer">
  <div class="wrap">
    <div>© 2026 인생포트폴리오 / Life Portfolio · lifeportfolio.co.kr</div>
    <div>
      <a href="/privacy.html">개인정보처리방침</a> ·
      <a href="/terms.html">이용약관</a> ·
      <a href="/blog/rss.xml">RSS</a>
    </div>
  </div>
</footer>
</body>
</html>
"""


def render_en(slug, meta, body_html):
    """Render a single English blog post HTML."""
    url = f"{SITE}/blog/posts-en/{slug}.html"
    ko_url = f"{SITE}/blog/posts/{slug}.html"
    title = meta["title"]
    desc = meta["description"]
    keywords = meta.get("keywords", "")
    section = meta.get("section", "Insights")
    eyebrow = meta.get("eyebrow", section)
    breadcrumb_tail = meta.get("breadcrumb", title)
    pub_date = meta.get("date", "2026-05-15")
    pub_iso = meta.get("date_iso", f"{pub_date}T09:00:00+09:00")
    read_min = meta.get("read_min", "7 min")
    lead = meta["lead"]
    related = meta.get("related", [])
    tags = meta.get("tags", [])
    tags_xml = "\n  ".join([f'<meta property="article:tag" content="{t}">' for t in tags])
    cta_h3 = meta.get("cta_h3", "Live by the report — your life becomes an asset")
    cta_p = meta.get("cta_p", "76 questions · 15 min · Auto-delivered · $8.99")
    cta_label = meta.get("cta_label", "Get my First 3-Week Blueprint →")
    cta_href = cta_link(slug, "en")

    related_html = "\n      ".join(
        [f'<li><a href="/blog/posts-en/{r["slug"]}.html">{r["title"]}</a></li>' for r in related]
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
  <link rel="preconnect" href="https://www.google-analytics.com" crossorigin>
  <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>{title} · Life Portfolio Insights</title>
  <meta name="google-site-verification" content="uoSIxdhBhBDILkJkhTCuIf_IDymqoYZKkWfO8bmnbK4">
  <meta name="naver-site-verification" content="d8784cb0e7d5de6f464cefa3a89b886d3a733733">
  <link rel="canonical" href="{url}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="description" content="{desc}">
  <meta name="keywords" content="{keywords}">
  <meta name="author" content="Life Portfolio">
  <meta property="article:published_time" content="{pub_iso}">
  <meta property="article:section" content="{section}">
  {tags_xml}
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="Life Portfolio · 인생포트폴리오">
  <meta property="og:locale" content="en_US">
  <meta property="og:locale:alternate" content="ko_KR">
  <meta property="og:image" content="{SITE}/assets/og/og-default-en.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{SITE}/assets/og/og-default-en.png">
  <link rel="alternate" hreflang="ko" href="{ko_url}">
  <link rel="alternate" hreflang="en" href="{url}">
  <link rel="alternate" hreflang="x-default" href="{url}">
  <link rel="alternate" type="application/rss+xml" title="Life Portfolio Insights — RSS" href="/blog/rss-en.xml">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="../post.css">
  <script type="application/ld+json">
  {{
    "@context":"https://schema.org",
    "@type":"BlogPosting",
    "@id":"{url}#article",
    "mainEntityOfPage":"{url}",
    "headline":"{title}",
    "description":"{desc}",
    "image":"{SITE}/assets/og/og-default-en.png",
    "datePublished":"{pub_iso}",
    "dateModified":"{pub_iso}",
    "inLanguage":"en-US",
    "author":{{"@type":"Organization","@id":"{SITE}/#organization","name":"Life Portfolio"}},
    "publisher":{{"@type":"Organization","@id":"{SITE}/#organization","name":"Life Portfolio","logo":{{"@type":"ImageObject","url":"{SITE}/assets/icon-512.png"}}}},
    "keywords":"{keywords}"
  }}
  </script>
  <script type="application/ld+json">
  {{
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",
    "itemListElement":[
      {{"@type":"ListItem","position":1,"name":"Home","item":"{SITE}/"}},
      {{"@type":"ListItem","position":2,"name":"Blog","item":"{SITE}/blog/en/"}},
      {{"@type":"ListItem","position":3,"name":"{title}","item":"{url}"}}
    ]
  }}
  </script>
  <script src="../../assets/js/web-vitals.js" defer></script>
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a href="/" class="brand">Life Portfolio <b>·</b> 인생포트폴리오</a>
    <nav class="nav">
      <a href="/?lang=en">Home</a>
      <a href="/product.html?lang=en">Product</a>
      <a href="/blog/en/" aria-current="page">Blog</a>
      <a href="/login.html?lang=en">Login</a>
    </nav>
  </div>
</header>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">Home</a><span class="sep">/</span>
  <a href="/blog/en/">Blog</a><span class="sep">/</span>
  <span>{breadcrumb_tail}</span>
</nav>

<article class="post">
  <header class="post-head">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    <p class="lead">{lead}</p>
    <p class="meta"><time datetime="{pub_date}">{pub_date}</time> · {read_min} read · {section}</p>
  </header>

{body_html}

  <div class="cta-box">
    <h3>{cta_h3}</h3>
    <p>{cta_p}</p>
    <a class="btn" href="{cta_href}">{cta_label}</a>
  </div>

  <div class="related">
    <h4>Read next</h4>
    <ul>
      {related_html}
    </ul>
  </div>
</article>

<footer class="site-footer">
  <div class="wrap">
    <div>© 2026 Life Portfolio · 인생포트폴리오 · lifeportfolio.co.kr</div>
    <div>
      <a href="/privacy.html?lang=en">Privacy</a> ·
      <a href="/terms.html?lang=en">Terms</a> ·
      <a href="/blog/rss-en.xml">RSS</a>
    </div>
  </div>
</footer>
</body>
</html>
"""


def write_post(slug, ko_meta, ko_body, en_meta, en_body):
    ko_path = KO_DIR / f"{slug}.html"
    en_path = EN_DIR / f"{slug}.html"
    ko_path.write_text(render_ko(slug, ko_meta, ko_body), encoding="utf-8")
    en_path.write_text(render_en(slug, en_meta, en_body), encoding="utf-8")
    return ko_path, en_path
