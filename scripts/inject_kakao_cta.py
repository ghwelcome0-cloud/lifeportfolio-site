#!/usr/bin/env python3
"""
Inject Kakao Channel CTA into all blog posts.

- Inserts <aside class="kakao-cta"> AFTER the </div> closing of .cta-box
  and BEFORE the .related <div> block.
- Idempotent: skips files that already contain class="kakao-cta".
- Korean posts get KO copy; English posts get EN copy.
- Kakao channel URL is a placeholder variable for easy sed replacement before merge.

Usage:
  python3 scripts/inject_kakao_cta.py
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KO_DIR = ROOT / "blog" / "posts"
EN_DIR = ROOT / "blog" / "posts-en"

# Placeholder — replace before merge: sed -i 's|pf.kakao.com/_JtysX|pf.kakao.com/_REAL|g' blog/posts/*.html blog/posts-en/*.html
KAKAO_URL = "https://pf.kakao.com/_JtysX"

# Inline SVG (Kakao bubble icon, simplified) — keeps each post self-contained, no external dependency
KAKAO_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.76 1.79 5.19 4.5 6.61L5.4 21l3.93-2.36c.86.13 1.75.2 2.67.2 5.52 0 10-3.58 10-8.04S17.52 3 12 3z"/></svg>'

KO_CTA = f'''
  <aside class="kakao-cta" aria-label="카카오 채널 친구 추가 CTA">
    <p class="kakao-cta__lead">아직 결제는 부담스러우세요?</p>
    <p class="kakao-cta__sub">카카오 채널을 추가해두시면 새 글이나 안내 사항이 있을 때 가장 먼저 알려드립니다. 친구 추가는 무료이고 언제든 알림 끄기·차단이 가능합니다.</p>
    <a class="kakao-cta__btn" href="{KAKAO_URL}?utm_source=blog&utm_medium=cta&utm_campaign=kakao_channel_add&cta=kakao_friend" target="_blank" rel="noopener">
      {KAKAO_ICON_SVG}
      카카오 채널 친구 추가
    </a>
    <p class="kakao-cta__note">친구 추가만 — 결제·로그인 불필요</p>
  </aside>
'''.strip("\n")

EN_CTA = f'''
  <aside class="kakao-cta" aria-label="KakaoTalk channel friend-add CTA">
    <p class="kakao-cta__lead">Not ready to buy yet?</p>
    <p class="kakao-cta__sub">Add our KakaoTalk channel and we'll let you know first whenever there's a new post or update. Adding the channel is free; you can mute or block notifications anytime.</p>
    <a class="kakao-cta__btn" href="{KAKAO_URL}?utm_source=blog_en&utm_medium=cta&utm_campaign=kakao_channel_add&cta=kakao_friend" target="_blank" rel="noopener">
      {KAKAO_ICON_SVG}
      Add KakaoTalk Channel
    </a>
    <p class="kakao-cta__note">Friend-add only — no payment or login required</p>
  </aside>
'''.strip("\n")

# Primary pattern: posts with a .cta-box → insert Kakao CTA between .cta-box and .related
PATTERN_PRIMARY = re.compile(
    r'(<div\s+class="cta-box">.*?</div>)(\s*)(<div\s+class="related">)',
    re.DOTALL,
)
# Fallback pattern: posts without a .cta-box (pillar/academic posts) → insert directly before .related
PATTERN_FALLBACK = re.compile(
    r'(\n\s*)(<div\s+class="related">)',
)


def inject(file_path: Path, cta_html: str) -> tuple[bool, str]:
    """Returns (changed, reason). reason in {ok, ok:fallback, skipped:already_present, skipped:no_anchor}."""
    text = file_path.read_text(encoding="utf-8")

    if 'class="kakao-cta"' in text:
        return False, "skipped:already_present"

    if PATTERN_PRIMARY.search(text):
        new_text = PATTERN_PRIMARY.sub(
            lambda m: f"{m.group(1)}\n\n  {cta_html}\n{m.group(2)}{m.group(3)}",
            text,
            count=1,
        )
        if new_text != text:
            file_path.write_text(new_text, encoding="utf-8")
            return True, "ok"
        return False, "skipped:no_change"

    if PATTERN_FALLBACK.search(text):
        new_text = PATTERN_FALLBACK.sub(
            lambda m: f"\n\n  {cta_html}\n{m.group(1)}{m.group(2)}",
            text,
            count=1,
        )
        if new_text != text:
            file_path.write_text(new_text, encoding="utf-8")
            return True, "ok:fallback"
        return False, "skipped:no_change"

    return False, "skipped:no_anchor"


def process_dir(d: Path, cta_html: str, label: str) -> dict:
    stats = {"ok": 0, "ok:fallback": 0, "skipped:already_present": 0, "skipped:no_anchor": 0, "skipped:no_change": 0}
    if not d.exists():
        print(f"  [{label}] directory not found: {d}")
        return stats
    files = sorted(d.glob("*.html"))
    for f in files:
        changed, reason = inject(f, cta_html)
        stats[reason] = stats.get(reason, 0) + 1
        marker = "✓" if changed else "·"
        print(f"  [{label}] {marker} {f.name}  ({reason})")
    return stats


def main() -> int:
    print(f"Kakao channel URL (placeholder): {KAKAO_URL}")
    print()
    print("== Korean posts ==")
    ko_stats = process_dir(KO_DIR, KO_CTA, "KO")
    print()
    print("== English posts ==")
    en_stats = process_dir(EN_DIR, EN_CTA, "EN")
    print()
    print("== Summary ==")
    print(f"  KO: {ko_stats}")
    print(f"  EN: {en_stats}")

    # Sanity: fail if no file was changed AND no file already had the CTA
    total_ok = ko_stats["ok"] + ko_stats["ok:fallback"] + en_stats["ok"] + en_stats["ok:fallback"]
    total_already = ko_stats["skipped:already_present"] + en_stats["skipped:already_present"]
    if total_ok == 0 and total_already == 0:
        print("ERROR: no files were updated and none had the CTA already. Pattern mismatch?")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
