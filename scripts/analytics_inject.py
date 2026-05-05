#!/usr/bin/env python3
"""
PR #18 — Analytics Injector
============================
16개 HTML 페이지에 다음을 일괄 주입(idempotent):

A) <head>의 PR#15 SEO 블록 직후
   - GTM 컨테이너 헤드 스니펫 (GTM-WWNXZLZX)
   - assets/js/analytics.js 로더

B) <body> 시작 직후
   - GTM noscript iframe (JS 비활성 사용자 폴백)

C) 16페이지 CSP에 google-analytics·googletagmanager·doubleclick·facebook 도메인 추가

이미 PR#18 블록이 있으면 갱신.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GTM_ID = "GTM-WWNXZLZX"
GA4_ID = "G-C8XKL4L9MZ"

PAGES = [
    "index.html", "product.html", "login.html", "signup.html",
    "privacy.html", "terms.html", "mypage.html", "report.html",
    "program.html", "success.html", "suvey.html",
    "payment-success.html", "payment-fail.html", "auth-fail.html",
    "report-loading.html", "program-loading.html",
]

# ─────────── HEAD 스니펫 (PR#15 end 직후 삽입) ───────────
HEAD_START = "<!-- ===== PR#18 Analytics — HEAD (start) ===== -->"
HEAD_END   = "<!-- ===== PR#18 Analytics — HEAD (end) ===== -->"
HEAD_BLOCK = f"""{HEAD_START}
  <!-- Google Tag Manager -->
  <script>
  (function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
  new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  }})(window,document,'script','dataLayer','{GTM_ID}');
  </script>
  <!-- End Google Tag Manager -->
  <!-- GA4 fallback (GTM이 차단된 환경 백업: AdBlock 미차단 시 1회 전송) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{GA4_ID}', {{ send_page_view: true, anonymize_ip: true }});
  </script>
  <script src="/assets/js/analytics.js" defer></script>
  {HEAD_END}"""

# ─────────── BODY noscript 폴백 ───────────
BODY_START = "<!-- ===== PR#18 Analytics — BODY (start) ===== -->"
BODY_END   = "<!-- ===== PR#18 Analytics — BODY (end) ===== -->"
BODY_BLOCK = f"""{BODY_START}
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
{BODY_END}"""

# ─────────── CSP 추가 도메인 ───────────
# script-src / connect-src / img-src에 추가할 분석 도메인
CSP_ADDS = {
    "script-src": [
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://*.analytics.google.com",
        "https://connect.facebook.net",
    ],
    "connect-src": [
        "https://www.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.google-analytics.com",
        "https://stats.g.doubleclick.net",
        "https://www.googletagmanager.com",
        "https://*.facebook.com",
        "https://*.facebook.net",
    ],
    "img-src": [
        "https://www.google-analytics.com",
        "https://*.analytics.google.com",
        "https://stats.g.doubleclick.net",
        "https://www.googletagmanager.com",
        "https://*.facebook.com",
        "https://www.facebook.com",
    ],
    "frame-src": [
        "https://www.googletagmanager.com",
        "https://td.doubleclick.net",
    ],
}

ANCHOR_HEAD = "<!-- ===== PR#15 SEO / Social META (end) ===== -->"

def update_csp(src: str) -> tuple[str, bool]:
    """meta CSP의 각 directive에 누락 도메인을 추가"""
    pat = re.compile(
        r'(<meta http-equiv="Content-Security-Policy"\s+content=")([^"]+)(")',
        re.IGNORECASE
    )
    m = pat.search(src)
    if not m:
        return src, False
    csp = m.group(2)
    parts = [p.strip() for p in csp.split(";") if p.strip()]
    new_parts = []
    changed = False
    for p in parts:
        # split first token (directive name) vs rest (sources)
        tokens = p.split()
        if not tokens:
            continue
        name = tokens[0]
        sources = set(tokens[1:])
        if name in CSP_ADDS:
            for d in CSP_ADDS[name]:
                if d not in sources:
                    sources.add(d)
                    changed = True
            # preserve order: keep originals first, then new ones sorted
            originals = [t for t in tokens[1:] if t in sources]
            extras = sorted([d for d in CSP_ADDS[name] if d not in tokens[1:]])
            new_parts.append(name + " " + " ".join(originals + extras))
        else:
            new_parts.append(p)
    if not changed:
        return src, False
    new_csp = "; ".join(new_parts)
    new_src = src[:m.start(2)] + new_csp + src[m.end(2):]
    return new_src, True

def inject_head(src: str) -> tuple[str, str]:
    pat = re.compile(re.escape(HEAD_START) + r".*?" + re.escape(HEAD_END), re.DOTALL)
    if pat.search(src):
        return pat.sub(HEAD_BLOCK, src), "head:updated"
    if ANCHOR_HEAD not in src:
        return src, "head:no-anchor"
    return src.replace(ANCHOR_HEAD, ANCHOR_HEAD + "\n  " + HEAD_BLOCK, 1), "head:inserted"

def inject_body(src: str) -> tuple[str, str]:
    pat = re.compile(re.escape(BODY_START) + r".*?" + re.escape(BODY_END), re.DOTALL)
    if pat.search(src):
        return pat.sub(BODY_BLOCK, src), "body:updated"
    # match <body ...> tag (with possible attrs), insert right after
    bpat = re.compile(r'(<body\b[^>]*>)', re.IGNORECASE)
    m = bpat.search(src)
    if not m:
        return src, "body:no-tag"
    insert = m.group(1) + "\n" + BODY_BLOCK
    return src[:m.start()] + insert + src[m.end():], "body:inserted"

def process(page: str) -> str:
    fp = ROOT / page
    src = fp.read_text(encoding="utf-8")
    src, head_status = inject_head(src)
    src, body_status = inject_body(src)
    src, csp_changed = update_csp(src)
    fp.write_text(src, encoding="utf-8")
    return f"{page:<26s} {head_status:<14s} {body_status:<14s} csp={'+' if csp_changed else '-'}"

if __name__ == "__main__":
    print(f"PR #18 — Analytics injector  (GTM={GTM_ID}, GA4={GA4_ID})")
    print("-" * 75)
    for p in PAGES:
        print(process(p))
    print("-" * 75)
    print(f"Done — {len(PAGES)} pages processed.")
