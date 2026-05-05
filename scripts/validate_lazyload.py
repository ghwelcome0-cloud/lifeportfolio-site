#!/usr/bin/env python3
"""
PR #19 — Lazy-Load & CLS Validator

Scans all HTML files in the project for <img> tags and verifies:
  1. loading="lazy" present (skip if explicitly marked as above-the-fold via data-eager)
  2. decoding="async" present
  3. width and height attributes present (prevents CLS)
  4. alt attribute present (a11y + SEO)

This is a safety net for future blog content additions in PR #20.
The script exits non-zero if any violation is found, making it CI-friendly.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Folders we never lint
SKIP_DIRS = {"node_modules", "functions", ".git", "scripts", "data"}

IMG_RE = re.compile(r"<img\b([^>]*?)/?>", re.IGNORECASE | re.DOTALL)
ATTR_RE = re.compile(r'(\w[\w-]*)\s*=\s*"([^"]*)"', re.IGNORECASE)


def parse_attrs(tag_inner: str) -> dict:
    return {k.lower(): v for k, v in ATTR_RE.findall(tag_inner)}


def scan_file(path: Path) -> list[str]:
    issues: list[str] = []
    try:
        html = path.read_text(encoding="utf-8")
    except Exception as e:
        return [f"{path}: read error {e}"]

    for m in IMG_RE.finditer(html):
        tag_inner = m.group(1)
        attrs = parse_attrs(tag_inner)

        # Allow explicit opt-out for above-the-fold (LCP) images via data-eager
        if "data-eager" in attrs or attrs.get("loading", "").lower() == "eager":
            # In that case still require width/height + alt
            missing = [k for k in ("width", "height", "alt") if k not in attrs]
            if missing:
                line = html[: m.start()].count("\n") + 1
                issues.append(
                    f"{path.relative_to(ROOT)}:{line}  eager <img> missing {missing}"
                )
            continue

        line = html[: m.start()].count("\n") + 1
        loc = f"{path.relative_to(ROOT)}:{line}"

        if attrs.get("loading", "").lower() != "lazy":
            issues.append(f"{loc}  missing loading=\"lazy\"")
        if attrs.get("decoding", "").lower() != "async":
            issues.append(f"{loc}  missing decoding=\"async\"")
        if "width" not in attrs:
            issues.append(f"{loc}  missing width attribute (CLS risk)")
        if "height" not in attrs:
            issues.append(f"{loc}  missing height attribute (CLS risk)")
        if "alt" not in attrs:
            issues.append(f"{loc}  missing alt attribute (a11y/SEO)")

    return issues


def collect_html() -> list[Path]:
    files = []
    for p in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        files.append(p)
    return sorted(files)


def main() -> int:
    files = collect_html()
    print(f"PR #19 — Lazy-Load Validator: scanning {len(files)} HTML files")
    print("=" * 60)

    total_imgs = 0
    all_issues: list[str] = []
    for f in files:
        html = f.read_text(encoding="utf-8")
        n_imgs = len(IMG_RE.findall(html))
        total_imgs += n_imgs
        issues = scan_file(f)
        all_issues.extend(issues)

    print(f"Total <img> tags found: {total_imgs}")
    if not all_issues:
        print("✅ No lazy-load / CLS / a11y issues found.")
        if total_imgs == 0:
            print("ℹ️  Site currently uses CSS/SVG/emoji for visuals — perfect baseline.")
        return 0

    print(f"❌ {len(all_issues)} issue(s) found:")
    for issue in all_issues:
        print(f"  - {issue}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
