#!/usr/bin/env python3
"""Build B2B onepager PDF from HTML source via Playwright (Chromium)."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/lead/b2b-onepager-source.html"
OUT = ROOT / "assets/lead/lifeportfolio-b2b-onepager.pdf"


async def build():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # file:// 로 로드해야 폰트·이미지 등 상대 자원이 정상 동작
        await page.goto(SRC.as_uri(), wait_until="networkidle")
        # 폰트 로드 완료 대기
        await page.evaluate("document.fonts.ready")
        await page.pdf(
            path=str(OUT),
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )
        await browser.close()
    print(f"Built: {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(build())
