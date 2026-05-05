#!/usr/bin/env python3
"""
PR #19 — Web Vitals RUM Injector

Injects a single deferred <script src="assets/js/web-vitals.js"> into every
public HTML page, immediately after the PR #18 Analytics block in <head>
(so dataLayer is guaranteed to exist before metrics fire).

Idempotent via marker comments.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAGES = [
    "index.html", "product.html", "login.html", "signup.html",
    "privacy.html", "terms.html", "mypage.html", "report.html",
    "program.html", "success.html", "suvey.html", "auth-fail.html",
    "payment-success.html", "payment-fail.html",
    "report-loading.html", "program-loading.html",
    "blog/index.html",
]

START_MARKER = "<!-- ===== PR#19 Web Vitals RUM (start) ===== -->"
END_MARKER = "<!-- ===== PR#19 Web Vitals RUM (end) ===== -->"
BLOCK_RE = re.compile(re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER), re.DOTALL)


def build_block(page_rel: str) -> str:
    # Blog pages live one level deep — adjust src path
    src = "../assets/js/web-vitals.js" if page_rel.startswith("blog/") else "assets/js/web-vitals.js"
    return (
        f"{START_MARKER}\n"
        f'  <script src="{src}" defer></script>\n'
        f"{END_MARKER}"
    )


def inject(page_rel: str) -> str:
    path = ROOT / page_rel
    if not path.exists():
        return f"SKIP   {page_rel} (missing)"

    html = path.read_text(encoding="utf-8")
    block = build_block(page_rel)

    if BLOCK_RE.search(html):
        new_html = BLOCK_RE.sub(block, html)
        action = "UPDATE"
    else:
        # Prefer to insert just before </head> so it loads after analytics setup
        m = re.search(r"</head>", html, re.IGNORECASE)
        if not m:
            return f"FAIL   {page_rel} (no </head>)"
        idx = m.start()
        new_html = html[:idx] + block + "\n" + html[idx:]
        action = "INSERT"

    if new_html != html:
        path.write_text(new_html, encoding="utf-8")
    return f"{action:6s} {page_rel}"


def main() -> None:
    print("PR #19 — Injecting Web Vitals RUM into 17 pages")
    print("=" * 60)
    for page in PAGES:
        print(inject(page))
    print("=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
