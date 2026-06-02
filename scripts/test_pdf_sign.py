#!/usr/bin/env python3
"""E2E test for pdf-sign.html: load real contract, stamp seal, save, verify."""
import asyncio, os, glob, sys
from playwright.async_api import async_playwright

URL = "http://localhost:8099/pdf-sign.html"
PDF = "/tmp/contract_test.pdf"
DL = "/tmp/pdfsign_dl"

async def main():
    os.makedirs(DL, exist_ok=True)
    for f in glob.glob(DL + "/*"):
        os.remove(f)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE: " + m.text) if m.type == "error" else None)
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_timeout(1500)  # let CDN libs load

        # check libs loaded
        libs = await pg.evaluate("({pdfjs: typeof pdfjsLib, pdflib: typeof PDFLib})")
        assert libs["pdfjs"] == "object", "pdf.js not loaded: " + str(libs)
        assert libs["pdflib"] == "object", "pdf-lib not loaded: " + str(libs)

        # open PDF
        async with pg.expect_file_chooser() as fc_info:
            await pg.click("#btnOpen")
        fc = await fc_info.value
        await fc.set_files(PDF)

        # wait for page render
        await pg.wait_for_selector(".page-wrap", timeout=15000)
        await pg.wait_for_timeout(1200)
        npages = await pg.eval_on_selector_all(".page-wrap", "els=>els.length")
        assert npages >= 1, "no pages rendered"

        # select seal stamp
        await pg.click("#stampPick .stamp-thumb")
        await pg.wait_for_timeout(300)

        # click on page to place seal
        wrap = await pg.query_selector(".page-wrap")
        await wrap.scroll_into_view_if_needed()
        bb = await wrap.bounding_box()
        await pg.mouse.click(bb["x"] + bb["width"] * 0.78, bb["y"] + bb["height"] * 0.5)
        await pg.wait_for_timeout(700)
        nplaced = await pg.eval_on_selector_all(".placed", "els=>els.length")
        assert nplaced == 1, f"seal not placed, count={nplaced}"

        # also test handwritten signature
        sigpad = await pg.query_selector("#sigPad")
        sb = await sigpad.bounding_box()
        await pg.mouse.move(sb["x"] + 15, sb["y"] + 40)
        await pg.mouse.down()
        for i in range(1, 9):
            await pg.mouse.move(sb["x"] + 15 + i * 14, sb["y"] + 40 + (i % 3) * 12)
        await pg.mouse.up()
        await pg.click("#sigUse")
        await pg.wait_for_timeout(300)
        await pg.mouse.click(bb["x"] + bb["width"] * 0.35, bb["y"] + bb["height"] * 0.5)
        await pg.wait_for_timeout(700)
        nplaced = await pg.eval_on_selector_all(".placed", "els=>els.length")
        assert nplaced == 2, f"signature not placed, count={nplaced}"

        # save
        async with pg.expect_download(timeout=15000) as dl_info:
            await pg.click("#btnSave")
        dl = await dl_info.value
        out_path = os.path.join(DL, dl.suggested_filename)
        await dl.save_as(out_path)
        await pg.wait_for_timeout(500)

        # verify output PDF
        assert os.path.exists(out_path), "no output file"
        size = os.path.getsize(out_path)
        assert size > 1000, f"output too small: {size}"

        if errs:
            print("JS ERRORS:\n" + "\n".join(errs)); sys.exit(1)
        print("ALL TESTS PASSED")
        print("  pages:", npages, "| placed:", nplaced, "| output:", out_path, f"({size} bytes)")
        await b.close()

asyncio.run(main())
