#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PR #15 — SEO 메타태그 일괄 주입기
- google-site-verification 메타 (Search Console 소유권)
- canonical
- robots (페이지별 index/noindex 정책)
- Open Graph 풀세트 (og:url, og:site_name, og:locale, og:image, og:image:width/height/alt)
- Twitter Card
- favicon / apple-touch-icon
- 영문/한글 페이지에 따라 og:image 분기 (?lang=en은 런타임 처리, 정적으로는 KO 기본)

기존에 동일 키가 있으면 건너뛰고, 없을 때만 추가 (idempotent).
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/user/webapp")
BASE_URL = "https://lifeportfolio.co.kr"

# Search Console 소유권 코드
GSC_TOKEN = "uoSIxdhBhBDILkJkhTCuIf_IDymqoYZKkWfO8bmnbK4"
NAVER_TOKEN = ""   # 받으면 채움
BING_TOKEN = ""    # 받으면 채움 (또는 GSC import로 대체)

# 페이지별 정책: (filename, robots, og_title_ko, og_description_ko, og_title_en, og_description_en)
PAGES = {
    "index.html": {
        "robots": "index,follow,max-image-preview:large",
        "og_title_ko": "당신 안에 이미 답이 있습니다 — 인생포트폴리오",
        "og_desc_ko": "발견하고, 살아내고, 남기는 한 권의 인생 설계도. 76문항 15분 진단으로 당신만의 방향과 첫 행동까지. 9,900원·결제 즉시 자동 생성.",
        "og_title_en": "The answer is already inside you — Life Portfolio",
        "og_desc_en": "Your one-of-a-kind life blueprint. 76 questions in 15 minutes — discover your direction and first actions. $8.99, instant report after payment.",
    },
    "product.html": {
        "robots": "index,follow,max-image-preview:large",
        "og_title_ko": "인생포트폴리오 결제 · 9,900원으로 시작하는 한 권의 인생 설계도",
        "og_desc_ko": "76문항 진단·맞춤 리포트·3주 실행 프로그램까지 한 번에. Payple 안전 결제, 결제 즉시 자동 생성.",
        "og_title_en": "Life Portfolio Checkout · Start your blueprint for $8.99",
        "og_desc_en": "76-question diagnostic, personalized report, and 3-week execution program — all in one. PayPal Buyer Protection, instant report after payment.",
    },
    "login.html": {
        "robots": "index,follow",
        "og_title_ko": "로그인 — 인생포트폴리오",
        "og_desc_ko": "Google 계정으로 1초 로그인하고, 당신만의 한 권 인생 설계도를 시작하세요.",
        "og_title_en": "Log in — Life Portfolio",
        "og_desc_en": "Sign in with Google and start your one-of-a-kind life blueprint.",
    },
    "signup.html": {
        "robots": "index,follow",
        "og_title_ko": "회원가입 — 인생포트폴리오",
        "og_desc_ko": "Google 계정으로 빠르게 가입하고, 76문항 진단으로 당신만의 인생 설계도를 받으세요.",
        "og_title_en": "Sign up — Life Portfolio",
        "og_desc_en": "Quick sign-up with Google. Start your 76-question diagnostic and receive your personalized blueprint.",
    },
    "privacy.html": {
        "robots": "index,follow",
        "og_title_ko": "개인정보처리방침 — 인생포트폴리오",
        "og_desc_ko": "인생포트폴리오의 개인정보 수집·이용·보관·파기·국외이전 등 처리 사항 안내.",
        "og_title_en": "Privacy Policy — Life Portfolio",
        "og_desc_en": "How Life Portfolio collects, uses, stores, deletes, and transfers your personal information.",
    },
    "terms.html": {
        "robots": "index,follow",
        "og_title_ko": "이용약관 — 인생포트폴리오",
        "og_desc_ko": "청약철회·환불·저작권 등 이용자의 권리·의무를 규정한 인생포트폴리오 이용약관입니다.",
        "og_title_en": "Terms of Service — Life Portfolio",
        "og_desc_en": "Life Portfolio Terms of Service — refunds, withdrawal, copyright, and user rights & duties.",
    },
    # ── noindex 페이지: 로그인/개인정보·중간 단계 ──────────────────
    "mypage.html": {"robots": "noindex,nofollow"},
    "report.html": {"robots": "noindex,nofollow"},
    "program.html": {"robots": "noindex,nofollow"},
    "success.html": {"robots": "noindex,nofollow"},
    "suvey.html": {"robots": "noindex,nofollow"},
    "payment-success.html": {"robots": "noindex,nofollow"},
    "payment-fail.html": {"robots": "noindex,nofollow"},
    "auth-fail.html": {"robots": "noindex,nofollow"},
    "report-loading.html": {"robots": "noindex,nofollow"},
    "program-loading.html": {"robots": "noindex,nofollow"},
}

def has_meta(html: str, pattern: str) -> bool:
    return bool(re.search(pattern, html, re.IGNORECASE))

def build_seo_block(filename: str, cfg: dict) -> str:
    """페이지별 SEO 메타 블록 생성"""
    page_url = f"{BASE_URL}/{filename}"
    is_indexable = "noindex" not in cfg.get("robots", "")
    og_title = cfg.get("og_title_ko", "인생포트폴리오 — 한 권의 인생 설계도")
    og_desc = cfg.get("og_desc_ko", "발견하고, 살아내고, 남기는 한 권의 인생 설계도.")
    og_title_en = cfg.get("og_title_en", "Life Portfolio")
    og_desc_en = cfg.get("og_desc_en", "Discover · Live · Leave — your one-of-a-kind life blueprint.")
    og_image_ko = f"{BASE_URL}/assets/og/og-default-ko.png"
    og_image_en = f"{BASE_URL}/assets/og/og-default-en.png"

    lines = []
    lines.append("  <!-- ===== PR#15 SEO / Social META (start) ===== -->")
    # GSC verification
    lines.append(f'  <meta name="google-site-verification" content="{GSC_TOKEN}">')
    if NAVER_TOKEN:
        lines.append(f'  <meta name="naver-site-verification" content="{NAVER_TOKEN}">')
    if BING_TOKEN:
        lines.append(f'  <meta name="msvalidate.01" content="{BING_TOKEN}">')

    # Canonical
    lines.append(f'  <link rel="canonical" href="{page_url}">')
    # robots
    lines.append(f'  <meta name="robots" content="{cfg.get("robots", "index,follow")}">')

    # Open Graph 보강 (og:type/og:title/og:description은 페이지에 이미 있을 수 있어 조건부)
    lines.append(f'  <meta property="og:url" content="{page_url}">')
    lines.append('  <meta property="og:site_name" content="인생포트폴리오 / Life Portfolio">')
    lines.append('  <meta property="og:locale" content="ko_KR">')
    lines.append('  <meta property="og:locale:alternate" content="en_US">')
    lines.append(f'  <meta property="og:image" content="{og_image_ko}">')
    lines.append('  <meta property="og:image:type" content="image/png">')
    lines.append('  <meta property="og:image:width" content="1200">')
    lines.append('  <meta property="og:image:height" content="630">')
    lines.append(f'  <meta property="og:image:alt" content="{og_title}">')
    # 영문 OG 이미지 (alternate)
    lines.append(f'  <meta property="og:image" content="{og_image_en}">')
    lines.append('  <meta property="og:image:type" content="image/png">')
    lines.append('  <meta property="og:image:width" content="1200">')
    lines.append('  <meta property="og:image:height" content="630">')
    lines.append(f'  <meta property="og:image:alt" content="{og_title_en}">')

    # Twitter Card
    lines.append('  <meta name="twitter:card" content="summary_large_image">')
    lines.append(f'  <meta name="twitter:title" content="{og_title}">')
    lines.append(f'  <meta name="twitter:description" content="{og_desc}">')
    lines.append(f'  <meta name="twitter:image" content="{og_image_ko}">')
    lines.append(f'  <meta name="twitter:image:alt" content="{og_title}">')

    # Favicon / Apple Touch Icon
    lines.append('  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">')
    lines.append('  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">')
    lines.append('  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">')
    lines.append('  <link rel="manifest" href="/assets/site.webmanifest">')

    lines.append("  <!-- ===== PR#15 SEO / Social META (end) ===== -->")
    return "\n".join(lines) + "\n"


def inject_into_html(filepath: Path, cfg: dict) -> tuple[bool, str]:
    """HTML 파일에 SEO 블록 주입. 이미 있으면 갱신."""
    html = filepath.read_text(encoding="utf-8")
    fname = filepath.name

    # 1) 이미 PR#15 블록이 있으면 → 통째로 교체
    block = build_seo_block(fname, cfg)
    pat = re.compile(
        r"  <!-- ===== PR#15 SEO / Social META \(start\) =====.*?  <!-- ===== PR#15 SEO / Social META \(end\) ===== -->\n",
        re.DOTALL
    )
    if pat.search(html):
        new_html = pat.sub(block, html)
        return new_html != html, new_html

    # 2) 없으면 → <title> 또는 <meta name="description"> 다음에 삽입
    # 우선 <title> 라인 찾기
    title_match = re.search(r'(  <title[^>]*>.*?</title>\n)', html, re.DOTALL)
    if title_match:
        idx = title_match.end()
        new_html = html[:idx] + block + html[idx:]
        return True, new_html

    # fallback: <meta charset> 다음
    charset_match = re.search(r'(<meta charset[^>]*>\n)', html)
    if charset_match:
        idx = charset_match.end()
        new_html = html[:idx] + block + html[idx:]
        return True, new_html

    return False, html


def main():
    summary = []
    for fname, cfg in PAGES.items():
        fp = ROOT / fname
        if not fp.exists():
            summary.append((fname, "MISSING"))
            continue
        changed, new_html = inject_into_html(fp, cfg)
        if changed:
            fp.write_text(new_html, encoding="utf-8")
            summary.append((fname, f"OK · {cfg.get('robots', 'index,follow')}"))
        else:
            summary.append((fname, "no-change"))

    print(f"{'File':<28} {'Status':<40}")
    print("-" * 70)
    for f, s in summary:
        print(f"{f:<28} {s:<40}")
    print("-" * 70)
    print(f"Total: {len(summary)} pages processed")


if __name__ == "__main__":
    main()
