#!/usr/bin/env python3
"""
PR #19 — Performance Hints Injector
Injects <link rel="preconnect"> and <link rel="dns-prefetch"> hints into all
public HTML pages so that the first-byte connection time to critical 3rd-party
origins (Firebase, GTM/GA4, fonts CDN, Payple, PayPal) is reduced by 100-300 ms.

Idempotent: looks for the marker comment block and replaces it on each run.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 16 public pages + blog index
PAGES = [
    "index.html", "product.html", "login.html", "signup.html",
    "privacy.html", "terms.html", "mypage.html", "report.html",
    "program.html", "success.html", "suvey.html", "auth-fail.html",
    "payment-success.html", "payment-fail.html",
    "report-loading.html", "program-loading.html",
    "blog/index.html",
]

# Per-page hint sets. "common" applies to every page; the per-page list is merged
# on top to add page-specific origins (e.g. PayPal only on product/payment pages).
COMMON_PRECONNECT = [
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://www.gstatic.com",
    "https://cdn.jsdelivr.net",
]
COMMON_DNS_PREFETCH = [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://www.google.com",
    "https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app",
    "https://lifeporfolio.firebaseapp.com",
]
PAGE_EXTRA = {
    "index.html": {
        "preconnect": ["https://lifeporfolio.firebaseapp.com"],
        "dns-prefetch": ["https://www.recaptcha.net"],
    },
    "product.html": {
        "preconnect": ["https://link.payple.kr", "https://www.paypal.com"],
        "dns-prefetch": ["https://www.paypalobjects.com", "https://api-m.paypal.com"],
    },
    "payment-success.html": {
        "preconnect": ["https://link.payple.kr"],
        "dns-prefetch": ["https://www.paypal.com"],
    },
    "payment-fail.html": {
        "preconnect": ["https://link.payple.kr"],
        "dns-prefetch": ["https://www.paypal.com"],
    },
    "login.html": {
        "preconnect": ["https://apis.google.com", "https://accounts.google.com"],
        "dns-prefetch": [],
    },
    "signup.html": {
        "preconnect": ["https://apis.google.com", "https://accounts.google.com"],
        "dns-prefetch": [],
    },
    "report.html": {
        "preconnect": ["https://cdnjs.cloudflare.com"],
        "dns-prefetch": [],
    },
    "program.html": {
        "preconnect": ["https://cdnjs.cloudflare.com"],
        "dns-prefetch": [],
    },
}

START_MARKER = "<!-- ===== PR#19 Perf Hints (start) ===== -->"
END_MARKER = "<!-- ===== PR#19 Perf Hints (end) ===== -->"
BLOCK_RE = re.compile(
    re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
    re.DOTALL,
)


def build_block(page: str) -> str:
    extra = PAGE_EXTRA.get(page, {"preconnect": [], "dns-prefetch": []})
    pre = list(dict.fromkeys(COMMON_PRECONNECT + extra.get("preconnect", [])))
    dns = list(dict.fromkeys(COMMON_DNS_PREFETCH + extra.get("dns-prefetch", [])))

    lines = [START_MARKER]
    for href in pre:
        lines.append(f'  <link rel="preconnect" href="{href}" crossorigin>')
    for href in dns:
        lines.append(f'  <link rel="dns-prefetch" href="{href}">')
    lines.append(END_MARKER)
    return "\n".join(lines)


def inject(page_rel: str) -> str:
    path = ROOT / page_rel
    if not path.exists():
        return f"SKIP  {page_rel} (missing)"

    html = path.read_text(encoding="utf-8")
    block = build_block(Path(page_rel).name)

    if BLOCK_RE.search(html):
        new_html = BLOCK_RE.sub(block, html)
        action = "UPDATE"
    else:
        # Insert immediately after <head> opening tag
        m = re.search(r"<head[^>]*>", html, re.IGNORECASE)
        if not m:
            return f"FAIL  {page_rel} (no <head>)"
        idx = m.end()
        new_html = html[:idx] + "\n" + block + "\n" + html[idx:]
        action = "INSERT"

    if new_html != html:
        path.write_text(new_html, encoding="utf-8")
    return f"{action:6s} {page_rel}"


def main() -> None:
    print("PR #19 — Injecting performance hints into 17 pages")
    print("=" * 60)
    for page in PAGES:
        print(inject(page))
    print("=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
