#!/usr/bin/env python3
"""
PR #18 — Analytics Validator
=============================
16개 페이지의 GTM/GA4/CSP/이벤트 hook 주입 상태를 자동 점검.
"""
from __future__ import annotations
import re, sys
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

# 페이지별 기대 이벤트 hook
EVENT_HOOKS = {
    "product.html":         ["view_item", "begin_checkout"],
    "suvey.html":           ["assessment_start", "assessment_complete"],
    "payment-success.html": ["purchase"],
    "report.html":          ["report_view"],
    "login.html":           ["login"],
    "signup.html":          ["sign_up"],
}

CSP_REQUIRED = [
    "www.googletagmanager.com",
    "www.google-analytics.com",
]

def check_page(page: str) -> tuple[list[str], list[str]]:
    fp = ROOT / page
    src = fp.read_text(encoding="utf-8")
    errs, infos = [], []

    # 1) GTM head snippet
    if GTM_ID not in src:
        errs.append(f"GTM ID {GTM_ID} not found")
    if "googletagmanager.com/gtm.js" not in src:
        errs.append("GTM head snippet missing")
    # 2) GTM noscript fallback
    if "googletagmanager.com/ns.html" not in src:
        errs.append("GTM noscript fallback missing")
    # 3) GA4
    if GA4_ID not in src:
        errs.append(f"GA4 ID {GA4_ID} not found")
    # 4) analytics.js loader
    if "/assets/js/analytics.js" not in src:
        errs.append("analytics.js loader missing")
    # 5) CSP allowlist
    csp_match = re.search(r'Content-Security-Policy"\s+content="([^"]+)"', src)
    if csp_match:
        csp = csp_match.group(1)
        for d in CSP_REQUIRED:
            if d not in csp:
                errs.append(f"CSP missing domain: {d}")
    else:
        infos.append("no CSP meta tag (ok if not enforced)")
    # 6) PR#18 markers
    for marker in ("PR#18 Analytics — HEAD (start)", "PR#18 Analytics — BODY (start)"):
        if marker not in src:
            errs.append(f"missing marker: {marker}")
    # 7) event hooks
    for ev in EVENT_HOOKS.get(page, []):
        if f"'{ev}'" not in src and f'"{ev}"' not in src:
            errs.append(f"event hook missing: {ev}")
    return errs, infos

def main():
    print(f"PR #18 — Analytics validator  (GTM={GTM_ID}, GA4={GA4_ID})")
    print("=" * 72)
    total_errs = 0
    for p in PAGES:
        errs, infos = check_page(p)
        total_errs += len(errs)
        status = "OK " if not errs else "FAIL"
        hooks = EVENT_HOOKS.get(p, [])
        hooks_s = (" hooks=" + ",".join(hooks)) if hooks else ""
        print(f"[{status}] {p:<24s}{hooks_s}")
        for e in errs:
            print(f"        ⚠️  {e}")
        for i in infos:
            print(f"        ℹ️  {i}")
    print("=" * 72)
    print(f"Total: {len(PAGES)} pages, {total_errs} errors")
    sys.exit(0 if total_errs == 0 else 1)

if __name__ == "__main__":
    main()
