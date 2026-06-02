#!/usr/bin/env python3
"""End-to-end smoke test for lease-esign.html using Playwright."""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "http://localhost:8099/lease-esign.html"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        pg = await b.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto(URL, wait_until="load")

        # intro -> write
        await pg.click("#goWrite")
        assert await pg.is_visible("#screen-write"), "write screen not shown"

        # try to advance with empty -> should alert (we auto-dismiss)
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

        # fill required fields
        await pg.fill("#f_addr", "서울특별시 강남구 테헤란로 123, 4층 401호")
        await pg.fill("#f_start", "2026-07-01")
        await pg.fill("#f_end", "2028-06-30")
        await pg.fill("#f_deposit", "100000000")
        await pg.fill("#f_rent", "800000")
        await pg.fill("#f_lessor_name", "홍길동")
        await pg.fill("#f_lessor_phone", "010-1111-2222")
        await pg.fill("#f_lessee_name", "김철수")
        await pg.fill("#f_lessee_phone", "010-3333-4444")
        await pg.fill("#f_special", "1. 반려동물 사육 허용\n2. 입주 전 도배 새로")

        # verify comma format applied
        dep = await pg.input_value("#f_deposit")
        assert dep == "100,000,000", f"deposit format wrong: {dep}"

        await pg.click("#goSign")
        assert await pg.is_visible("#screen-sign"), "sign screen not shown"

        # finalize should be disabled before signing
        assert await pg.is_disabled("#goFinalize"), "finalize should be disabled"

        # draw on both pads
        async def draw(sel):
            box = await pg.query_selector(sel)
            bb = await box.bounding_box()
            cx, cy = bb["x"] + 20, bb["y"] + 40
            await pg.mouse.move(cx, cy)
            await pg.mouse.down()
            for i in range(1, 8):
                await pg.mouse.move(cx + i * 12, cy + (i % 3) * 10)
            await pg.mouse.up()
        await draw("#padLessor")
        await draw("#padLessee")

        # statuses should be 서명됨
        sl = await pg.inner_text("#statLessor")
        se = await pg.inner_text("#statLessee")
        assert "서명" in sl and sl.strip() == "서명됨", f"lessor status: {sl}"
        assert se.strip() == "서명됨", f"lessee status: {se}"
        assert not await pg.is_disabled("#goFinalize"), "finalize should be enabled now"

        await pg.click("#goFinalize")
        await pg.wait_for_selector("#screen-done", state="visible", timeout=5000)

        hash_text = await pg.inner_text("#hashOut")
        assert "SHA-256" in hash_text, "hash missing"
        import re
        m = re.search(r"\b[0-9a-f]{64}\b", hash_text)
        assert m, "no 64-hex hash found"

        # print doc populated
        pa = await pg.inner_html("#printArea")
        assert "임 대 차 계 약 서" in pa, "print doc title missing"
        assert "100,000,000" in pa, "deposit missing in doc"
        assert "홍길동" in pa and "김철수" in pa, "names missing in doc"
        assert pa.count("<img") == 2, "signature images missing in doc"

        if errs:
            print("JS ERRORS:", errs); sys.exit(1)
        print("ALL TESTS PASSED")
        print("  hash:", m.group(0))
        await b.close()

asyncio.run(main())
