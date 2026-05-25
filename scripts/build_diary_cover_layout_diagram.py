#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 맞춤형 다이어리 v1.4.2 — 표지 후가공 위치 가이드 (Layout Diagram)
─────────────────────────────────────────────────────────────────────────
출력: manufacturer-handoff-v1.4/cover-finishing/cover_layout_diagram.pdf

v1.4.2 변경:
- 색상: Navy #1B2A4A → British Racing Green #0A3D2A
- 'L' 로고 / 형압 모노그램 완전 제거 (텍스트 금박만)
- 헤드라인 폰트: Cormorant Garamond (고급 세리프)

내용:
- 앞표지·뒤표지·책등 위치 mm 단위 표기
- 금박 박표지 영역 (LIFE PORTFOLIO, 인생포트폴리오, Only One)
- 도련 3mm 가이드
- 책등 두께 ~20mm (256p 70g 기준 추정 — 실측 후 확정 필요)
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/cover-finishing"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DIAGRAM_CSS = r"""
@page {
    size: A4 landscape;  /* 297 x 210 mm */
    margin: 12mm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: "Noto Sans CJK KR", sans-serif;
    color: #0A3D2A;
    background: #FFFFFF;
}

h1 {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 600;
    font-size: 16pt;
    color: #0A3D2A;
    margin-bottom: 2mm;
}
.subtitle {
    font-size: 9pt;
    color: #8A8A8A;
    margin-bottom: 6mm;
    font-style: italic;
}

.spread {
    margin: 8mm auto;
    border: 0.4mm dashed #C9A04F;
    position: relative;
    background: #FFFFFF;
    /* 1mm = 0.6mm at scale 0.6 for diagram fitting on A4 */
}

/* Real-size dimensions in mm, but diagram is at print-friendly scale */
.scale-info {
    text-align: center;
    font-size: 8pt;
    color: #1B2A4A;
    margin-top: 3mm;
    font-weight: 600;
}

.front, .back, .spine {
    display: inline-block;
    vertical-align: top;
    border: 0.4mm solid #0A3D2A;
    background: rgba(10, 61, 42, 0.88);
    color: #C9A04F;
    text-align: center;
    position: relative;
    box-sizing: border-box;
}

.front .label, .back .label, .spine .label {
    position: absolute;
    bottom: 4mm;
    left: 0; right: 0;
    font-size: 7pt;
    color: #C9A04F;
    letter-spacing: 0.15em;
}

.front .dim, .back .dim, .spine .dim {
    position: absolute;
    top: 50%;
    left: 0; right: 0;
    transform: translateY(-50%);
    text-align: center;
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 600;
    font-size: 13pt;
    color: #C9A04F;
}

/* 금박 표시 (실제 위치) */
.foil-marker {
    position: absolute;
    border: 0.5mm dashed #C9A04F;
    background: rgba(201, 160, 79, 0.18);
    color: #C9A04F;
    text-align: center;
    font-size: 6pt;
    padding: 0.5mm;
    box-sizing: border-box;
    font-weight: 700;
    letter-spacing: 0.05em;
}

/* Legend */
.legend {
    margin-top: 8mm;
    border-top: 0.3mm solid #C9A04F;
    padding-top: 4mm;
    font-size: 8.5pt;
    line-height: 1.7;
}
.legend strong { color: #C9A04F; }

table.dim-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    margin-top: 4mm;
}
table.dim-table th, table.dim-table td {
    border: 0.2mm solid #D6CFC0;
    padding: 2mm 3mm;
    text-align: left;
}
table.dim-table th {
    background: #0A3D2A;
    color: #C9A04F;
    font-weight: 700;
    letter-spacing: 0.1em;
}
"""

# Diagram representation: scale ratio so 333mm spread fits A4 width (297mm) - 24mm margins = 273mm usable
# Scale = 273/333 = 0.82  → so 154mm front = 126mm display, 20mm spine = 16.4mm display, etc.
SCALE = 0.78

def mm(x):
    return f"{x * SCALE:.2f}mm"

DIAGRAM_HTML = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>표지 레이아웃 가이드 · v1.4</title>
<style>{DIAGRAM_CSS}</style></head>
<body>

<h1>표지 후가공 위치 가이드 — Cover Layout Diagram (v1.4.2)</h1>
<div class="subtitle">인생포트폴리오 맞춤형 다이어리 · A5 · 256p · 70g · Undated 만년형 · 도련 3mm · 2도 (British Racing Green + Gold)</div>

<div style="white-space: nowrap; text-align: center;">
    <!-- Back cover -->
    <div class="back" style="width: {mm(154)}; height: {mm(216)};">
        <div class="dim">뒤표지<br/>BACK</div>
        <div class="label">154 × 216 mm (도련 포함)</div>
        <!-- 뒤표지 가운데 카피 영역 (foil) -->
        <div class="foil-marker" style="top: {mm(70)}; left: {mm(15)}; width: {mm(124)}; height: {mm(60)};">
            금박 카피 영역<br/>(GOLD FOIL · TAGLINE)
        </div>
    </div>

    <!-- Spine -->
    <div class="spine" style="width: {mm(20)}; height: {mm(216)};">
        <div class="dim" style="writing-mode: vertical-rl; transform: translateY(-50%) rotate(180deg); white-space: nowrap;">책등 · SPINE</div>
        <div class="label">≈ 20 mm</div>
        <!-- 책등 금박 (옵션) -->
        <div class="foil-marker" style="top: {mm(80)}; left: 0; width: {mm(20)}; height: {mm(56)}; writing-mode: vertical-rl;">
            LIFE PORTFOLIO
        </div>
    </div>

    <!-- Front cover -->
    <div class="front" style="width: {mm(154)}; height: {mm(216)};">
        <div class="dim" style="visibility:hidden;">앞표지<br/>FRONT</div>
        <div class="label">154 × 216 mm (도련 포함)</div>
        <!-- LIFE PORTFOLIO foil position (top 78mm from trim top) -->
        <div class="foil-marker" style="top: {mm(76)}; left: {mm(20)}; width: {mm(114)}; height: {mm(14)};">
            ★ LIFE PORTFOLIO (금박)
        </div>
        <div class="foil-marker" style="top: {mm(94)}; left: {mm(28)}; width: {mm(98)}; height: {mm(10)};">
            인생포트폴리오 맞춤형 다이어리 (금박)
        </div>
        <div class="foil-marker" style="top: {mm(170)}; left: {mm(40)}; width: {mm(74)}; height: {mm(7)};">
            UNDATED · 만년형
        </div>
        <div class="foil-marker" style="top: {mm(184)}; left: {mm(35)}; width: {mm(84)}; height: {mm(9)};">
            ★ Only One (금박, 강조 · Cormorant Italic)
        </div>
    </div>
</div>

<div class="scale-info">※ 위 다이어그램은 실측의 약 78% 축척 (A4에 적합) — 실제 표지는 154 × 216 mm</div>

<div class="legend">
    <strong>■ 색상 (2도 인쇄)</strong>
    <table class="dim-table">
        <tr><th>요소</th><th>RGB</th><th>CMYK (참고)</th><th>Pantone (참고)</th></tr>
        <tr><td>배경 British Racing Green</td><td>#0A3D2A · R10 G61 B42</td><td>C85 M40 Y90 K55</td><td>PANTONE 357 C / 553 C 계열</td></tr>
        <tr><td>금박 Gold</td><td>#C9A04F · R201 G160 B79</td><td>C20 M35 Y75 K15</td><td>PANTONE 871 C (Metallic) 또는 7563 C (Coated)</td></tr>
    </table>

    <p style="margin-top:5mm;"><strong>■ 후가공 위치</strong> (★ = 필수 / 'L' 로고·형압 모노그램 사용 안 함)</p>
    <table class="dim-table">
        <tr><th>위치</th><th>가공</th><th>좌표 (앞표지 trim 기준, mm)</th><th>크기 (mm)</th><th>폰트</th></tr>
        <tr><td>★ LIFE PORTFOLIO</td><td>금박 박표지</td><td>top 72, center</td><td>114 × 14</td><td>Cormorant Garamond Regular</td></tr>
        <tr><td>인생포트폴리오 맞춤형 다이어리</td><td>금박 박표지 (소형)</td><td>top 94, center</td><td>98 × 10</td><td>Noto Serif CJK KR Medium</td></tr>
        <tr><td>UNDATED · 만년형</td><td>금박 박표지 (대조 옅음)</td><td>bottom 48, center</td><td>74 × 7</td><td>Cormorant Garamond Medium</td></tr>
        <tr><td>★ Only One</td><td>금박 박표지 (강조, 이탤릭)</td><td>bottom 38, center</td><td>84 × 9</td><td>Cormorant Garamond Italic</td></tr>
        <tr><td>책등 LIFE PORTFOLIO</td><td>금박 박표지 (세로)</td><td>spine, top 80</td><td>20 × 56</td><td>Cormorant Garamond Regular</td></tr>
        <tr><td>뒤표지 카피</td><td>금박 박표지 (제한적)</td><td>top 70, center</td><td>124 × 60</td><td>Noto Serif CJK KR Regular</td></tr>
    </table>

    <p style="margin-top:5mm;"><strong>■ 책등 두께 결정</strong></p>
    <p style="font-size:8pt; line-height:1.7;">
        본 가이드의 책등 폭 20mm는 256p · 70g 만년필 친화지 기준 <em>추정치</em>입니다.
        실제 제작 단계에서 제조사가 종이 두께 실측 + 사철 두께 + PU 양장 커버 두께를 합산하여 ±2mm 조정이 필요할 수 있습니다.
        <strong style="color:#C9A04F;">최종 책등 폭은 제조사 견본 작업 후 확정</strong>합니다.
    </p>

    <p style="margin-top:5mm;"><strong>■ 도련(Bleed) 3 mm 적용</strong></p>
    <p style="font-size:8pt; line-height:1.7;">
        모든 표지 PDF는 trim(154 × 216 mm) + 도련 3mm 적용된 상태로 제공됩니다.
        크롭 마크(crop marks)가 포함되어 있으므로 트림 위치 식별 가능합니다.
    </p>

    <p style="margin-top:5mm;"><strong>■ 권장 양장 사양</strong></p>
    <ul style="font-size:8pt; line-height:1.7; padding-left:6mm;">
        <li>표지 재질: PU(Polyurethane) 양장 — British Racing Green #0A3D2A 무광 (고급 초록)</li>
        <li>제본: 사철 (Smyth-Sewn) + PUR 풀제본</li>
        <li>책등 라운드: 옵션 (제조사 권장)</li>
        <li>가름끈: 2개 (Gold + BRG, 220 mm)</li>
        <li>모서리 마감: 라운드 (R 5mm) 또는 직각 (제조사 권장)</li>
        <li>표지 'L' 로고 / 형압 모노그램: <strong>사용 안 함</strong> (텍스트 금박 4요소만)</li>
    </ul>
</div>

</body></html>"""

def build():
    from weasyprint import HTML
    out = OUT_DIR / "cover_layout_diagram.pdf"
    print("[INFO] 표지 레이아웃 가이드 생성...")
    HTML(string=DIAGRAM_HTML).write_pdf(str(out))
    print(f"[OK] {out}  ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
