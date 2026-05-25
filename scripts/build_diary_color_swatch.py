#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 다이어리 v1.4.2 — 색상 스워치 PDF + colors.txt
─────────────────────────────────────────────────────────
출력:
  manufacturer-handoff-v1.4/color/color_swatch.pdf
  manufacturer-handoff-v1.4/color/colors.txt

v1.4.2 변경:
- 메인 컬러: Navy #1B2A4A → British Racing Green (BRG) #0A3D2A
- 표지·헤더 모두 BRG 기조로 통일
- Pantone 357 C / 553 C 계열로 변경
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/color"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# colors.txt — 텍스트 사양서
# ─────────────────────────────────────────────
COLORS_TXT = """인생포트폴리오 맞춤형 다이어리 v1.4.2 — 색상 사양
=====================================================

본 다이어리는 2도 인쇄 (BRG + Gold)를 사용합니다.

──────────────────────────────────────────
[1] BRG — British Racing Green (메인 컬러 · 표지·간지·헤더·키 텍스트)
──────────────────────────────────────────
이름     · LIFE PORTFOLIO BRG (British Racing Green)
HEX      · #0A3D2A
RGB      · R 10   G 61   B 42
CMYK     · C 85   M 45   Y 85   K 55        (참고치 — 제조사 ICC 프로파일에 따라 보정)
Pantone  · PANTONE 357 C        (Solid Coated, ★ 권장)
            또는 PANTONE 553 C   (대안, 약간 더 밝음)
용도     · 표지 PU 양장 컬러, 본문 헤더, 키 텍스트,
            도장 라인, 강조 박스 외곽선

──────────────────────────────────────────
[2] GOLD (강조 컬러 · 금박 박표지·라인·악센트)
──────────────────────────────────────────
이름     · LIFE PORTFOLIO GOLD
HEX      · #C9A04F
RGB      · R 201  G 160  B 79
CMYK     · C 20   M 35   Y 75   K 15        (참고치)
Pantone  · PANTONE 871 C (Metallic)         (★ 권장 — 금박용)
            또는 PANTONE 7563 C (Coated)    (인쇄용)
용도     · 표지 금박 박표지 (LIFE PORTFOLIO, Only One 등),
            본문 강조 박스 좌측 라인, 골드 룰,
            "v1.4.2" 등 태그 텍스트

──────────────────────────────────────────
[3] 보조 색상 (본문 사용)
──────────────────────────────────────────
INK      · #2C2C2C (본문 검정 — 만년필 잉크 느낌, K 100 인쇄)
INK_LIGHT · #8A8A8A (보조 텍스트 회색)
CREAM    · #FAF7F0 (강조 박스 배경, 헤더 배경)
RULE     · #D6CFC0 (선·구분선)
WEEKEND_BLUE · #2563EB (주간 토요일)
WEEKEND_RED  · #DC2626 (주간 일요일)

──────────────────────────────────────────
인쇄 사양 권장 사항
──────────────────────────────────────────
- 본문 인쇄: 2도 (BRG + Gold) 권장. 흑백 단도(K)도 가능.
- 표지 금박: 박지(Foil Stamp) — Pantone 871 C 또는 동등품
- 표지 형압(Emboss/Deboss): 사용 안 함 (v1.4.2: 표지 미니멀 — 텍스트만)
- ICC 프로파일: 제조사 표준 (Japan Color 2001 Coated 또는 ISO Coated v2)
- 종이: 70g 만년필 친화지 (도모에리버 대체재) — 별도 paper_70g_spec.md 참조
- 표지 텍스트 서체: Cormorant Garamond (Variable, OFL) — Regular / Italic

──────────────────────────────────────────
RGB → CMYK 변환 안내
──────────────────────────────────────────
본문 PDF (body_256p.pdf)는 WeasyPrint로 RGB 출력되었습니다.
제조사는 자체 RIP/Preflight 워크플로우에서:
  1) Japan Color 2001 Coated 또는 ISO Coated v2 ICC 프로파일 적용
  2) RGB → CMYK 변환
  3) 폰트 임베드 확인 (Noto Sans/Serif CJK KR + Cormorant Garamond — 이미 임베드됨)
  4) 도련 3mm 확인 (이미 적용됨)
순으로 처리 후 출력하시면 됩니다.

문의: 인생포트폴리오 / Life Portfolio
문서 버전: v1.4.2 / 2026-05-25
"""

# ─────────────────────────────────────────────
# color_swatch.pdf — 시각 스워치
# ─────────────────────────────────────────────
SWATCH_CSS = r"""
@page {
    size: A4 portrait;
    margin: 18mm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: "Noto Sans CJK KR", sans-serif;
    color: #0A3D2A;
}
h1 {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 18pt;
    color: #0A3D2A;
    margin-bottom: 3mm;
    letter-spacing: 0.5pt;
}
.subtitle {
    font-size: 9pt;
    color: #8A8A8A;
    margin-bottom: 10mm;
    font-style: italic;
}
.swatch-row {
    display: flex;
    gap: 8mm;
    margin-bottom: 8mm;
    align-items: stretch;
}
.swatch-block {
    flex: 1;
    border: 0.3mm solid #D6CFC0;
    border-radius: 1mm;
    overflow: hidden;
}
.swatch-color {
    height: 60mm;
}
.swatch-info {
    padding: 6mm;
    background: #FAF7F0;
    font-size: 8pt;
    line-height: 1.7;
}
.swatch-info h2 {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 12pt;
    margin-bottom: 2mm;
    color: #0A3D2A;
    letter-spacing: 0.3pt;
}
.swatch-info table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2mm;
}
.swatch-info td {
    padding: 1mm 2mm;
    vertical-align: top;
}
.swatch-info td.k {
    font-weight: 700;
    color: #0A3D2A;
    width: 30mm;
}
.swatch-info td.v {
    font-family: "Noto Sans CJK KR", sans-serif;
    color: #2C2C2C;
}

.secondary-section {
    margin-top: 10mm;
    border-top: 0.3mm solid #C9A04F;
    padding-top: 6mm;
}
.secondary-section h2 {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 13pt;
    color: #0A3D2A;
    margin-bottom: 4mm;
    letter-spacing: 0.3pt;
}
.mini-swatches {
    display: flex;
    gap: 4mm;
    flex-wrap: wrap;
}
.mini-swatch {
    flex: 0 0 auto;
    text-align: center;
    font-size: 7pt;
}
.mini-color {
    width: 30mm;
    height: 18mm;
    border: 0.3mm solid #D6CFC0;
    margin-bottom: 1.5mm;
}

.footer-note {
    margin-top: 10mm;
    font-size: 7.5pt;
    color: #8A8A8A;
    font-style: italic;
    line-height: 1.7;
}
"""

SWATCH_HTML = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>색상 스워치 · v1.4.2</title>
<style>""" + SWATCH_CSS + """</style></head>
<body>

<h1>Color Swatch — 색상 사양 (v1.4.2)</h1>
<div class="subtitle">인생포트폴리오 맞춤형 다이어리 · 2도 인쇄 (BRG + Gold) · 2026-05-25</div>

<div class="swatch-row">
    <div class="swatch-block">
        <div class="swatch-color" style="background: #0A3D2A;"></div>
        <div class="swatch-info">
            <h2>LIFE PORTFOLIO BRG</h2>
            <table>
                <tr><td class="k">HEX</td><td class="v">#0A3D2A</td></tr>
                <tr><td class="k">RGB</td><td class="v">R 10 · G 61 · B 42</td></tr>
                <tr><td class="k">CMYK</td><td class="v">C 85 · M 45 · Y 85 · K 55</td></tr>
                <tr><td class="k">Pantone</td><td class="v">PANTONE 357 C ★</td></tr>
                <tr><td class="k">용도</td><td class="v">표지 PU 양장 · 본문 헤더 · 키 텍스트</td></tr>
            </table>
        </div>
    </div>
    <div class="swatch-block">
        <div class="swatch-color" style="background: #C9A04F;"></div>
        <div class="swatch-info">
            <h2>LIFE PORTFOLIO GOLD</h2>
            <table>
                <tr><td class="k">HEX</td><td class="v">#C9A04F</td></tr>
                <tr><td class="k">RGB</td><td class="v">R 201 · G 160 · B 79</td></tr>
                <tr><td class="k">CMYK</td><td class="v">C 20 · M 35 · Y 75 · K 15</td></tr>
                <tr><td class="k">Pantone</td><td class="v">PANTONE 871 C (Metallic) ★</td></tr>
                <tr><td class="k">용도</td><td class="v">금박 박표지 · 강조 박스 · 골드 룰</td></tr>
            </table>
        </div>
    </div>
</div>

<div class="secondary-section">
    <h2>보조 색상 (본문 사용)</h2>
    <div class="mini-swatches">
        <div class="mini-swatch">
            <div class="mini-color" style="background: #2C2C2C;"></div>
            <strong>INK</strong><br/>#2C2C2C
        </div>
        <div class="mini-swatch">
            <div class="mini-color" style="background: #8A8A8A;"></div>
            <strong>INK_LIGHT</strong><br/>#8A8A8A
        </div>
        <div class="mini-swatch">
            <div class="mini-color" style="background: #FAF7F0;"></div>
            <strong>CREAM</strong><br/>#FAF7F0
        </div>
        <div class="mini-swatch">
            <div class="mini-color" style="background: #D6CFC0;"></div>
            <strong>RULE</strong><br/>#D6CFC0
        </div>
        <div class="mini-swatch">
            <div class="mini-color" style="background: #2563EB;"></div>
            <strong>WEEKEND_BLUE</strong><br/>#2563EB (토)
        </div>
        <div class="mini-swatch">
            <div class="mini-color" style="background: #DC2626;"></div>
            <strong>WEEKEND_RED</strong><br/>#DC2626 (일)
        </div>
    </div>
</div>

<div class="footer-note">
    ※ 화면 표시 색상과 실제 인쇄 결과는 모니터 캘리브레이션 및 ICC 프로파일에 따라 차이가 있을 수 있습니다.<br/>
    ※ 본문 PDF (body_256p.pdf)는 RGB로 출력되어 있으며, 제조사 자체 워크플로우에서 CMYK 변환을 권장합니다.<br/>
    ※ ICC 프로파일 권장: Japan Color 2001 Coated 또는 ISO Coated v2 (FOGRA39 기반).<br/>
    ※ 표지 텍스트 서체: Cormorant Garamond (Variable, OFL) — Regular / Italic.
</div>

</body></html>"""

def build():
    from weasyprint import HTML

    # colors.txt
    txt_out = OUT_DIR / "colors.txt"
    txt_out.write_text(COLORS_TXT, encoding="utf-8")
    print(f"[OK] {txt_out}  ({txt_out.stat().st_size} bytes)")

    # color_swatch.pdf
    pdf_out = OUT_DIR / "color_swatch.pdf"
    HTML(string=SWATCH_HTML).write_pdf(str(pdf_out))
    print(f"[OK] {pdf_out}  ({pdf_out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
