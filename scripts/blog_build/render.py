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


def _split_body_for_midcta(body_html: str) -> tuple:
    """[E3] Insert second CTA at the mid-point of the article body.
    Splits body_html into (before, after) at the second <h2> occurrence so that
    the mid-CTA appears AFTER the first major section ends (right before the
    second <h2>). If the body has fewer than 2 <h2>, returns (body, "").
    """
    occurrences = [m.start() for m in re.finditer(r"<h2[ >]", body_html)]
    if len(occurrences) < 2:
        return body_html, ""
    cut = occurrences[1]
    return body_html[:cut], body_html[cut:]


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
    # [E3] Mid-article second CTA (split body at 2nd <h2>)
    body_before, body_after = _split_body_for_midcta(body_html)
    mid_cta_href = cta_href + "&cta=mid" if "?" in cta_href else cta_href + "?cta=mid"
    mid_cta_html = (
        '\n  <aside class="mid-cta" aria-label="본문 중간 CTA">\n'
        '    <p class="mid-cta__lead">여기까지 읽으셨다면, 이 한 권을 직접 받아 보세요.</p>\n'
        f'    <a class="mid-cta__btn" href="{mid_cta_href}">15분 진단으로 첫 3주 설계도 받기 →</a>\n'
        '    <p class="mid-cta__sub">₩9,900 · 결제 즉시 자동 생성 · 결제 후 7일 내 100% 환불</p>\n'
        '  </aside>\n'
    ) if body_after else ""
    body_html_final = body_before + mid_cta_html + body_after
    # [E1/E2] Sticky bar + Exit-intent destination
    sticky_href = cta_href + "&cta=sticky" if "?" in cta_href else cta_href + "?cta=sticky"
    exit_href = cta_href + "&cta=exit" if "?" in cta_href else cta_href + "?cta=exit"

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
  <style>
    /* [E3] Mid-article inline CTA */
    .mid-cta{{margin:28px 0;padding:20px 22px;border:1px solid #E5D9B8;background:linear-gradient(180deg,#FBF6E7 0%,#F4ECD8 100%);border-radius:14px;text-align:center}}
    .mid-cta__lead{{margin:0 0 10px;font-size:15px;color:#5B4A1F;font-weight:600}}
    .mid-cta__btn{{display:inline-block;padding:12px 22px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 2px 6px rgba(200,162,74,0.35)}}
    .mid-cta__btn:hover{{background:#B58E36;color:#fff}}
    .mid-cta__sub{{margin:10px 0 0;font-size:12px;color:#7A6A3F}}
    /* [E1] Sticky bottom bar — mobile only */
    .sticky-cta-bar{{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:none;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.97);border-top:1px solid #E5D9B8;box-shadow:0 -4px 16px rgba(0,0,0,0.08);backdrop-filter:saturate(140%) blur(6px)}}
    .sticky-cta-bar__text{{font-size:13px;color:#5B4A1F;line-height:1.35;flex:1;min-width:0}}
    .sticky-cta-bar__text b{{color:#3A2E10}}
    .sticky-cta-bar__btn{{flex-shrink:0;padding:10px 14px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}}
    .sticky-cta-bar__close{{flex-shrink:0;width:28px;height:28px;border:0;background:transparent;color:#7A6A3F;font-size:18px;line-height:1;cursor:pointer;padding:0}}
    @media (max-width:768px){{.sticky-cta-bar{{display:flex}} body{{padding-bottom:64px}}}}
    /* [E2] Exit-intent modal — PC only */
    .exit-modal{{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(40,30,10,0.55);padding:20px}}
    .exit-modal.is-open{{display:flex}}
    .exit-modal__card{{max-width:440px;width:100%;background:#fff;border-radius:18px;padding:30px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.25);text-align:center;position:relative}}
    .exit-modal__eyebrow{{display:inline-block;font-size:12px;letter-spacing:0.08em;color:#C8A24A;text-transform:uppercase;font-weight:700;margin-bottom:10px}}
    .exit-modal__h{{margin:0 0 10px;font-size:22px;line-height:1.35;color:#2A2208}}
    .exit-modal__p{{margin:0 0 18px;font-size:14px;color:#5B4A1F;line-height:1.55}}
    .exit-modal__btn{{display:inline-block;padding:13px 24px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(200,162,74,0.4)}}
    .exit-modal__btn:hover{{background:#B58E36;color:#fff}}
    .exit-modal__sub{{margin:12px 0 0;font-size:12px;color:#7A6A3F}}
    .exit-modal__close{{position:absolute;top:10px;right:14px;width:34px;height:34px;border:0;background:transparent;color:#7A6A3F;font-size:24px;line-height:1;cursor:pointer}}
    @media (max-width:768px){{.exit-modal{{display:none !important}}}}
    /* [D] Reader-friendly accents — opt-in via .summary-card / .closing-note, harmless to other posts */
    article.post .summary-card{{margin:32px 0;padding:22px 24px 6px;background:linear-gradient(180deg,#FFFDF6 0%,#FBF6E7 100%);border:1px solid #E5D9B8;border-radius:14px;box-shadow:0 2px 12px rgba(74,105,132,.06)}}
    article.post .summary-card>p:first-child{{margin:0 0 12px;font-size:12px;letter-spacing:1.5px;color:#C49E45;font-weight:800;text-transform:uppercase}}
    article.post .summary-card ul{{margin:0 0 14px;padding:0;list-style:none}}
    article.post .summary-card li{{position:relative;margin:0 0 12px;padding:0 0 0 30px;font-size:16px;color:#37414D;line-height:1.6}}
    article.post .summary-card li:before{{content:"\\2713";position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:999px;background:#4A6984;color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center}}
    article.post .closing-note{{margin:26px 0 0;padding:18px 20px;border-left:3px solid #C49E45;background:#FFFDF6;border-radius:0 8px 8px 0;font-size:15.5px;color:#3A4A5C;line-height:1.7}}
    article.post .closing-note p{{margin:0}}
  </style>
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

{body_html_final}

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

<!-- [E1] Sticky bottom CTA bar — mobile only -->
<div class="sticky-cta-bar" id="stickyCtaBar" role="region" aria-label="고정 CTA">
  <div class="sticky-cta-bar__text"><b>₩9,900</b> · 15분 진단 · 첫 3주 설계도</div>
  <a class="sticky-cta-bar__btn" href="{sticky_href}">받기 →</a>
  <button class="sticky-cta-bar__close" type="button" aria-label="닫기" onclick="(function(){{document.getElementById('stickyCtaBar').style.display='none';try{{sessionStorage.setItem('lp_sticky_closed','1');}}catch(e){{}}}})();return false;">×</button>
</div>

<!-- [E2] Exit-intent modal — PC only, once per session -->
<div class="exit-modal" id="exitModal" role="dialog" aria-modal="true" aria-labelledby="exitModalH" aria-hidden="true">
  <div class="exit-modal__card">
    <button class="exit-modal__close" type="button" aria-label="닫기" onclick="document.getElementById('exitModal').classList.remove('is-open');document.getElementById('exitModal').setAttribute('aria-hidden','true');">×</button>
    <span class="exit-modal__eyebrow">잠깐, 나가시기 전에</span>
    <h3 class="exit-modal__h" id="exitModalH">유형 검사 위에 ‘한 줄’을 얹어 보세요</h3>
    <p class="exit-modal__p">76문항 15분 진단 → 결제 즉시 한 권의 리포트 자동 생성. 결제 후 7일 내 100% 환불 보장이라 한 번 받아 보셔도 부담이 없습니다.</p>
    <a class="exit-modal__btn" href="{exit_href}">첫 3주 설계도 받기 →</a>
    <p class="exit-modal__sub">₩9,900 · 결제 즉시 자동 생성 · 7일 내 100% 환불</p>
  </div>
</div>

<script>
(function(){{
  // [E1] Sticky bar: restore closed state from sessionStorage
  try{{
    if(sessionStorage.getItem('lp_sticky_closed')==='1'){{
      var b=document.getElementById('stickyCtaBar'); if(b) b.style.display='none';
    }}
  }}catch(e){{}}
  // [E2] Exit-intent (PC only): trigger once per session when mouse leaves through top edge
  var isMobile = window.matchMedia('(max-width:768px)').matches;
  if(isMobile) return;
  var shown=false;
  try{{ if(sessionStorage.getItem('lp_exit_shown')==='1') shown=true; }}catch(e){{}}
  function show(){{
    if(shown) return;
    shown=true;
    try{{ sessionStorage.setItem('lp_exit_shown','1'); }}catch(e){{}}
    var m=document.getElementById('exitModal');
    if(m){{ m.classList.add('is-open'); m.setAttribute('aria-hidden','false'); }}
  }}
  document.addEventListener('mouseout', function(e){{
    if(!e.toElement && !e.relatedTarget && e.clientY < 10) show();
  }});
  // Also: trigger on Esc-then-leave behavior is skipped to avoid false positives
}})();
</script>

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
    # [E3] Mid-article second CTA (split body at 2nd <h2>)
    body_before, body_after = _split_body_for_midcta(body_html)
    mid_cta_href = cta_href + "&cta=mid" if "?" in cta_href else cta_href + "?cta=mid"
    mid_cta_html = (
        '\n  <aside class="mid-cta" aria-label="In-article CTA">\n'
        '    <p class="mid-cta__lead">If you have read this far, take this booklet home.</p>\n'
        f'    <a class="mid-cta__btn" href="{mid_cta_href}">15-min diagnostic → first 3-week blueprint →</a>\n'
        '    <p class="mid-cta__sub">$8.99 · auto-delivered · 7-day 100% refund</p>\n'
        '  </aside>\n'
    ) if body_after else ""
    body_html_final = body_before + mid_cta_html + body_after
    # [E1/E2] Sticky bar + Exit-intent destination
    sticky_href = cta_href + "&cta=sticky" if "?" in cta_href else cta_href + "?cta=sticky"
    exit_href = cta_href + "&cta=exit" if "?" in cta_href else cta_href + "?cta=exit"

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
  <style>
    /* [E3] Mid-article inline CTA */
    .mid-cta{{margin:28px 0;padding:20px 22px;border:1px solid #E5D9B8;background:linear-gradient(180deg,#FBF6E7 0%,#F4ECD8 100%);border-radius:14px;text-align:center}}
    .mid-cta__lead{{margin:0 0 10px;font-size:15px;color:#5B4A1F;font-weight:600}}
    .mid-cta__btn{{display:inline-block;padding:12px 22px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 2px 6px rgba(200,162,74,0.35)}}
    .mid-cta__btn:hover{{background:#B58E36;color:#fff}}
    .mid-cta__sub{{margin:10px 0 0;font-size:12px;color:#7A6A3F}}
    /* [E1] Sticky bottom bar — mobile only */
    .sticky-cta-bar{{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:none;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.97);border-top:1px solid #E5D9B8;box-shadow:0 -4px 16px rgba(0,0,0,0.08);backdrop-filter:saturate(140%) blur(6px)}}
    .sticky-cta-bar__text{{font-size:13px;color:#5B4A1F;line-height:1.35;flex:1;min-width:0}}
    .sticky-cta-bar__text b{{color:#3A2E10}}
    .sticky-cta-bar__btn{{flex-shrink:0;padding:10px 14px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}}
    .sticky-cta-bar__close{{flex-shrink:0;width:28px;height:28px;border:0;background:transparent;color:#7A6A3F;font-size:18px;line-height:1;cursor:pointer;padding:0}}
    @media (max-width:768px){{.sticky-cta-bar{{display:flex}} body{{padding-bottom:64px}}}}
    /* [E2] Exit-intent modal — PC only */
    .exit-modal{{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(40,30,10,0.55);padding:20px}}
    .exit-modal.is-open{{display:flex}}
    .exit-modal__card{{max-width:440px;width:100%;background:#fff;border-radius:18px;padding:30px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.25);text-align:center;position:relative}}
    .exit-modal__eyebrow{{display:inline-block;font-size:12px;letter-spacing:0.08em;color:#C8A24A;text-transform:uppercase;font-weight:700;margin-bottom:10px}}
    .exit-modal__h{{margin:0 0 10px;font-size:22px;line-height:1.35;color:#2A2208}}
    .exit-modal__p{{margin:0 0 18px;font-size:14px;color:#5B4A1F;line-height:1.55}}
    .exit-modal__btn{{display:inline-block;padding:13px 24px;background:#C8A24A;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(200,162,74,0.4)}}
    .exit-modal__btn:hover{{background:#B58E36;color:#fff}}
    .exit-modal__sub{{margin:12px 0 0;font-size:12px;color:#7A6A3F}}
    .exit-modal__close{{position:absolute;top:10px;right:14px;width:34px;height:34px;border:0;background:transparent;color:#7A6A3F;font-size:24px;line-height:1;cursor:pointer}}
    @media (max-width:768px){{.exit-modal{{display:none !important}}}}
    /* [D] Reader-friendly accents — opt-in via .summary-card / .closing-note, harmless to other posts */
    article.post .summary-card{{margin:32px 0;padding:22px 24px 6px;background:linear-gradient(180deg,#FFFDF6 0%,#FBF6E7 100%);border:1px solid #E5D9B8;border-radius:14px;box-shadow:0 2px 12px rgba(74,105,132,.06)}}
    article.post .summary-card>p:first-child{{margin:0 0 12px;font-size:12px;letter-spacing:1.5px;color:#C49E45;font-weight:800;text-transform:uppercase}}
    article.post .summary-card ul{{margin:0 0 14px;padding:0;list-style:none}}
    article.post .summary-card li{{position:relative;margin:0 0 12px;padding:0 0 0 30px;font-size:16px;color:#37414D;line-height:1.6}}
    article.post .summary-card li:before{{content:"\\2713";position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:999px;background:#4A6984;color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center}}
    article.post .closing-note{{margin:26px 0 0;padding:18px 20px;border-left:3px solid #C49E45;background:#FFFDF6;border-radius:0 8px 8px 0;font-size:15.5px;color:#3A4A5C;line-height:1.7}}
    article.post .closing-note p{{margin:0}}
  </style>
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

{body_html_final}

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

<!-- [E1] Sticky bottom CTA bar — mobile only -->
<div class="sticky-cta-bar" id="stickyCtaBar" role="region" aria-label="Sticky CTA">
  <div class="sticky-cta-bar__text"><b>$8.99</b> · 15-min diagnostic · First 3-week blueprint</div>
  <a class="sticky-cta-bar__btn" href="{sticky_href}">Get it →</a>
  <button class="sticky-cta-bar__close" type="button" aria-label="Close" onclick="(function(){{document.getElementById('stickyCtaBar').style.display='none';try{{sessionStorage.setItem('lp_sticky_closed','1');}}catch(e){{}}}})();return false;">×</button>
</div>

<!-- [E2] Exit-intent modal — PC only, once per session -->
<div class="exit-modal" id="exitModal" role="dialog" aria-modal="true" aria-labelledby="exitModalH" aria-hidden="true">
  <div class="exit-modal__card">
    <button class="exit-modal__close" type="button" aria-label="Close" onclick="document.getElementById('exitModal').classList.remove('is-open');document.getElementById('exitModal').setAttribute('aria-hidden','true');">×</button>
    <span class="exit-modal__eyebrow">Before you go</span>
    <h3 class="exit-modal__h" id="exitModalH">Add a 0 → 1 line on top of your personality tests</h3>
    <p class="exit-modal__p">A 76-question, 15-minute diagnostic that auto-delivers a one-page booklet right after payment. 7-day, no-questions-asked 100% refund — take it home with zero risk.</p>
    <a class="exit-modal__btn" href="{exit_href}">Get my First 3-Week Blueprint →</a>
    <p class="exit-modal__sub">$8.99 · auto-delivered · 7-day 100% refund</p>
  </div>
</div>

<script>
(function(){{
  // [E1] Sticky bar: restore closed state from sessionStorage
  try{{
    if(sessionStorage.getItem('lp_sticky_closed')==='1'){{
      var b=document.getElementById('stickyCtaBar'); if(b) b.style.display='none';
    }}
  }}catch(e){{}}
  // [E2] Exit-intent (PC only): trigger once per session when mouse leaves through top edge
  var isMobile = window.matchMedia('(max-width:768px)').matches;
  if(isMobile) return;
  var shown=false;
  try{{ if(sessionStorage.getItem('lp_exit_shown')==='1') shown=true; }}catch(e){{}}
  function show(){{
    if(shown) return;
    shown=true;
    try{{ sessionStorage.setItem('lp_exit_shown','1'); }}catch(e){{}}
    var m=document.getElementById('exitModal');
    if(m){{ m.classList.add('is-open'); m.setAttribute('aria-hidden','false'); }}
  }}
  document.addEventListener('mouseout', function(e){{
    if(!e.toElement && !e.relatedTarget && e.clientY < 10) show();
  }});
}})();
</script>

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
