#!/usr/bin/env python3
"""E2E test for the SHAREABLE PDF signing tool (pdf-sign-share.html).

Covers the two new features:
  - client-side auto seal generation (no embedded personal seal)
  - integrity hash + metadata on save
plus core render/place/save flow.

Run a local static server for the webapp dir, drive it with Playwright.
"""
import os, sys, time, http.server, socketserver, threading, glob, functools

WEBAPP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8801
DL_DIR = "/tmp/pdfsign_share_dl"
TEST_PDF = "/tmp/contract_test.pdf"  # pikepdf-repaired, valid PDF

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEBAPP)
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.serve_forever()

def main():
    assert os.path.exists(os.path.join(WEBAPP, "pdf-sign-share.html")), "share html missing"
    assert os.path.exists(TEST_PDF), "test pdf missing"
    os.makedirs(DL_DIR, exist_ok=True)
    for f in glob.glob(os.path.join(DL_DIR, "*")):
        os.remove(f)

    t = threading.Thread(target=serve, daemon=True); t.start(); time.sleep(1)

    from playwright.sync_api import sync_playwright
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(accept_downloads=True, viewport={"width":1400,"height":1000})
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(f"http://127.0.0.1:{PORT}/pdf-sign-share.html")

        # wait for CDN libs to load
        page.wait_for_function("window.__libsOK && window.__libsOK.pdfjs && window.__libsOK.pdflib", timeout=30000)

        # 1) ensure NO embedded personal seal references exist
        html = page.content()
        assert "seal_kimyoungsik" not in html, "FAIL: personal seal must NOT be present in share version"
        assert "내부용" not in html, "FAIL: '내부용' branding should be removed"

        # 2) open the test PDF
        with page.expect_file_chooser() as fc:
            page.click("#btnOpen")
        fc.value.set_files(TEST_PDF)
        page.wait_for_selector("canvas.pdf-page", timeout=20000)
        pages_n = page.eval_on_selector_all("canvas.pdf-page", "els => els.length")
        assert pages_n >= 1, "no pages rendered"

        # 3) AUTO-GENERATE a seal (new feature)
        page.fill("#sealName", "홍길동")
        page.click("#btnGenSeal")
        page.wait_for_selector("#stampPick .stamp-thumb.sel", timeout=5000)
        prev = page.eval_on_selector("#sealPrevImg", "el => el.src.startsWith('data:image/png')")
        assert prev, "seal preview not generated as PNG"

        # place the generated seal on page (click within the visible viewport)
        wrap = page.query_selector(".page-wrap")
        box = wrap.bounding_box()
        vp_h = page.viewport_size["height"]
        y_seal = box["y"] + min(box["height"]*0.3, vp_h*0.55)
        page.mouse.click(box["x"] + box["width"]*0.65, y_seal)
        page.wait_for_selector(".placed", timeout=5000)

        # 4) handwritten signature
        pad = page.query_selector("#sigPad"); pb = pad.bounding_box()
        page.mouse.move(pb["x"]+20, pb["y"]+60); page.mouse.down()
        page.mouse.move(pb["x"]+70, pb["y"]+30)
        page.mouse.move(pb["x"]+120, pb["y"]+80)
        page.mouse.move(pb["x"]+170, pb["y"]+40); page.mouse.up()
        page.click("#sigUse")
        page.wait_for_function("document.querySelectorAll('#stampPick .stamp-thumb').length >= 2", timeout=5000)
        # place signature (within visible viewport)
        y_sig = box["y"] + min(box["height"]*0.45, vp_h*0.7)
        page.mouse.click(box["x"] + box["width"]*0.3, y_sig)
        page.wait_for_function("document.querySelectorAll('.placed').length >= 2", timeout=5000)

        placed = page.eval_on_selector_all(".placed", "els => els.length")
        assert placed >= 2, f"expected >=2 placements, got {placed}"

        # 5) save -> verify download + integrity hash shown
        with page.expect_download(timeout=30000) as dl:
            page.click("#btnSave")
        d = dl.value
        out_path = os.path.join(DL_DIR, d.suggested_filename)
        d.save_as(out_path)
        assert os.path.exists(out_path) and os.path.getsize(out_path) > 1000, "output pdf not saved"

        # integrity hash text should appear
        page.wait_for_selector("#saveStatus code", timeout=5000)
        hash_txt = page.eval_on_selector("#saveStatus code", "el => el.textContent")
        assert len(hash_txt) >= 16, "integrity hash not displayed"

        b.close()

    real_errors = [e for e in errors if "favicon" not in e and "404" not in e]
    print("=" * 50)
    print("ALL TESTS PASSED")
    print(f"pages: {pages_n} | placed: {placed} | output: {out_path} ({os.path.getsize(out_path)} bytes)")
    print(f"integrity hash prefix: {hash_txt}")
    if real_errors:
        print("console errors:", real_errors[:5])
    print("=" * 50)

if __name__ == "__main__":
    main()
