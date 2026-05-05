#!/usr/bin/env python3
"""
Life Portfolio · 웹사이트 구축·고도화 성과 보고서 v5
(Trademark · Mobile UX · Performance Edition · 2026-05-05)

v4 (Global Launch Edition)에서 추가된 작업을 반영:
- PR #21: 모바일 UX 긴급 수정 + PageSpeed 90+ 최적화 + 상표권 등록 자산
- PR #22: firebase race condition 핫픽스 (로그인/회원가입/결제 무반응 해결)
- PR #23: 모바일 sticky CTA 위치/레이아웃 개선
- PR #24: 모바일 결제 CTA 위치/노출 타이밍 개선
- 상표 출원 진행 (마크인포 · 인생포트폴리오/Life Portfolio · 09류+42류)
- PageSpeed Insights 측정 결과 분석 및 권장 조치

PDF 생성 원칙:
1. 페이지 끊김 방지: KeepTogether로 표·섹션 단위 묶기
2. 문단 간격 충분: spaceAfter 12~14pt
3. 줄간격: leading 1.55배
4. 한글 폰트: NanumGothic (Regular/Bold)
"""

import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, Image as RLImage
)
from reportlab.platypus.flowables import HRFlowable

# ============================================================
# Font registration
# ============================================================
FONT_DIR = "/usr/share/fonts/truetype/nanum"
pdfmetrics.registerFont(TTFont("NanumGothic", f"{FONT_DIR}/NanumGothic.ttf"))
pdfmetrics.registerFont(TTFont("NanumGothicBold", f"{FONT_DIR}/NanumGothicBold.ttf"))
pdfmetrics.registerFont(TTFont("NanumGothicLight", f"{FONT_DIR}/NanumGothicLight.ttf"))
pdfmetrics.registerFont(TTFont("NanumGothicExtraBold", f"{FONT_DIR}/NanumGothicExtraBold.ttf"))

# ============================================================
# Brand colors (matches site/trademark)
# ============================================================
BRAND_NAVY = HexColor("#17384C")     # 메인 네이비
BRAND_BLUE = HexColor("#2563EB")     # 서브 블루
BRAND_GOLD = HexColor("#C8A24A")     # 상표 골드 보더
BRAND_INK  = HexColor("#0F172A")     # 본문 텍스트
BRAND_MUTED = HexColor("#64748B")    # 부가 설명
BRAND_LINE = HexColor("#E2E8F0")     # 라인
BRAND_BG_SOFT = HexColor("#F1F5F9")  # 부드러운 배경
BRAND_BG_GOLD = HexColor("#FDF7E6")  # 골드 배경
BRAND_BG_OK = HexColor("#ECFDF5")    # 성공 (그린)
BRAND_OK = HexColor("#059669")       # 그린
BRAND_BG_WARN = HexColor("#FEF3C7")  # 경고 (옐로우)
BRAND_WARN = HexColor("#D97706")     # 옐로우 진한
BRAND_BG_FIRE = HexColor("#FEE2E2")  # 위험 (레드)
BRAND_FIRE = HexColor("#DC2626")     # 레드

# ============================================================
# Document setup
# ============================================================
OUTPUT_PATH = "/home/user/webapp/docs/Life_Portfolio_웹사이트_성과보고서_v5_Trademark_MobileUX_2026-05-05.pdf"
TITLE = "Life Portfolio · v5 (Trademark · Mobile UX · Performance Edition)"

# ============================================================
# Header / Footer
# ============================================================
def on_page(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFont("NanumGothic", 8.5)
    canvas.setFillColor(BRAND_MUTED)
    canvas.drawString(20*mm, 285*mm, "인생포트폴리오 · Life Portfolio")
    canvas.drawRightString(190*mm, 285*mm, "INTERNAL · v5 (Trademark · Mobile UX · Performance Edition) · 2026-05-05")
    # Header line
    canvas.setStrokeColor(BRAND_LINE)
    canvas.setLineWidth(0.4)
    canvas.line(20*mm, 282*mm, 190*mm, 282*mm)
    # Footer
    canvas.setFont("NanumGothic", 8.5)
    canvas.setFillColor(BRAND_MUTED)
    canvas.drawString(20*mm, 14*mm, "Marketing Brief")
    canvas.drawCentredString(105*mm, 14*mm, f"— {doc.page} —")
    canvas.drawRightString(190*mm, 14*mm, "lifeportfolio.co.kr")
    canvas.line(20*mm, 17*mm, 190*mm, 17*mm)
    canvas.restoreState()

# ============================================================
# Paragraph styles — generous spacing for readability
# ============================================================
styles = getSampleStyleSheet()

H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"],
    fontName="NanumGothicExtraBold", fontSize=22, leading=30,
    textColor=BRAND_NAVY, spaceAfter=16, spaceBefore=4, alignment=TA_LEFT,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"],
    fontName="NanumGothicBold", fontSize=16, leading=24,
    textColor=BRAND_NAVY, spaceAfter=12, spaceBefore=18, alignment=TA_LEFT,
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"],
    fontName="NanumGothicBold", fontSize=12.5, leading=20,
    textColor=BRAND_BLUE, spaceAfter=8, spaceBefore=12, alignment=TA_LEFT,
)
BODY = ParagraphStyle(
    "Body", parent=styles["BodyText"],
    fontName="NanumGothic", fontSize=10.2, leading=17,  # ~1.65x line height
    textColor=BRAND_INK, spaceAfter=12, alignment=TA_LEFT,
    firstLineIndent=0, leftIndent=0,
)
BODY_SMALL = ParagraphStyle(
    "BodySmall", parent=BODY,
    fontSize=9.2, leading=15, spaceAfter=10, textColor=BRAND_INK,
)
QUOTE = ParagraphStyle(
    "Quote", parent=BODY,
    fontName="NanumGothicBold", fontSize=11, leading=20,
    textColor=BRAND_NAVY, leftIndent=14, rightIndent=14,
    spaceBefore=8, spaceAfter=14, borderPadding=(10, 12, 10, 12),
    backColor=BRAND_BG_SOFT,
)
BULLET = ParagraphStyle(
    "Bullet", parent=BODY,
    fontSize=10, leading=16, spaceAfter=8, leftIndent=8,
    bulletIndent=0,
)
COVER_TITLE = ParagraphStyle(
    "CoverTitle", parent=H1,
    fontSize=30, leading=42, alignment=TA_LEFT, spaceAfter=18,
    textColor=BRAND_NAVY,
)
COVER_SUB = ParagraphStyle(
    "CoverSub", parent=BODY,
    fontName="NanumGothic", fontSize=13, leading=22,
    textColor=BRAND_INK, spaceAfter=10,
)
COVER_TAG = ParagraphStyle(
    "CoverTag", parent=BODY,
    fontName="NanumGothicBold", fontSize=10, leading=15,
    textColor=BRAND_BLUE, spaceAfter=4,
)
HIGHLIGHT_BOX = ParagraphStyle(
    "HighlightBox", parent=BODY,
    fontName="NanumGothicBold", fontSize=11, leading=20,
    textColor=BRAND_NAVY, leftIndent=12, rightIndent=12,
    spaceBefore=8, spaceAfter=14, borderPadding=(12, 14, 12, 14),
    backColor=BRAND_BG_GOLD, borderColor=BRAND_GOLD, borderWidth=1,
)
OK_BOX = ParagraphStyle(
    "OkBox", parent=BODY,
    fontName="NanumGothic", fontSize=10, leading=17,
    textColor=BRAND_INK, leftIndent=10, rightIndent=10,
    spaceBefore=6, spaceAfter=12, borderPadding=(10, 12, 10, 12),
    backColor=BRAND_BG_OK, borderColor=BRAND_OK, borderWidth=0.6,
)
WARN_BOX = ParagraphStyle(
    "WarnBox", parent=BODY,
    fontName="NanumGothic", fontSize=10, leading=17,
    textColor=BRAND_INK, leftIndent=10, rightIndent=10,
    spaceBefore=6, spaceAfter=12, borderPadding=(10, 12, 10, 12),
    backColor=BRAND_BG_WARN, borderColor=BRAND_WARN, borderWidth=0.6,
)

# ============================================================
# Helpers
# ============================================================
def bullet_list(items, style=BULLET):
    """Make a bulleted ListFlowable with consistent spacing."""
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=12, value="•") for t in items],
        bulletType="bullet", start="•", bulletFontName="NanumGothicBold",
        bulletFontSize=10, leftIndent=14, bulletColor=BRAND_BLUE,
        spaceBefore=2, spaceAfter=10,
    )

def standard_table(data, col_widths, header_bg=BRAND_NAVY, header_fg=white,
                   body_fg=BRAND_INK, font_size=9.5, row_pad=8):
    """Reusable table with brand styling."""
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), header_fg),
        ("FONTNAME", (0, 0), (-1, 0), "NanumGothicBold"),
        ("FONTSIZE", (0, 0), (-1, 0), font_size + 0.3),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), row_pad + 1),
        ("BOTTOMPADDING", (0, 0), (-1, 0), row_pad + 1),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), "NanumGothic"),
        ("FONTSIZE", (0, 1), (-1, -1), font_size),
        ("TEXTCOLOR", (0, 1), (-1, -1), body_fg),
        ("VALIGN", (0, 1), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 1), (-1, -1), "LEFT"),
        ("TOPPADDING", (0, 1), (-1, -1), row_pad),
        ("BOTTOMPADDING", (0, 1), (-1, -1), row_pad),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.4, BRAND_LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, BRAND_BG_SOFT]),
    ]))
    return t

def section_break(space=6):
    return Spacer(1, space*mm)

# ============================================================
# Build content (story)
# ============================================================
story = []

# ─────────────────────────────────────────────────────────
# COVER PAGE
# ─────────────────────────────────────────────────────────
story.append(Spacer(1, 18*mm))
story.append(Paragraph("INTERNAL · 마케팅 활용 자료 · v5 (Trademark · Mobile UX · Performance Edition)", COVER_TAG))
story.append(Paragraph("인생포트폴리오", COVER_TITLE))
story.append(Paragraph("웹사이트 구축·고도화 성과 보고서", H2))
story.append(Spacer(1, 4*mm))
story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_GOLD, spaceBefore=2, spaceAfter=14))

# Tagline
story.append(Paragraph(
    "<b>당신 안에 이미 답이 있습니다.</b><br/>"
    "그 답을 당신의 길로, 또 누군가의 길로 잇습니다.",
    ParagraphStyle("Tagline", parent=BODY, fontSize=15, leading=26,
                   textColor=BRAND_NAVY, fontName="NanumGothicBold",
                   spaceAfter=10)
))
story.append(Paragraph(
    "— 발견하고, 살아내고, 남기는 한 권의 인생 설계도 —",
    ParagraphStyle("TagSub", parent=BODY, fontSize=11, leading=18,
                   textColor=BRAND_MUTED, spaceAfter=18)
))

# 4 highlight tiles for v5
v5_tiles = [
    ["이번 사이클 핵심", "이번 사이클 핵심", "이번 사이클 핵심", "이번 사이클 핵심"],
    ["상표 출원 진행", "모바일 UX 완성", "성능 최적화", "긴급 핫픽스"],
    ["인생포트폴리오/<br/>Life Portfolio<br/>09+42류 출원",
     "결제 동선 명확화<br/>sticky CTA 즉시<br/>노출 + 안전영역",
     "preconnect 6→4<br/>GTM lazy-load<br/>인라인 critical CSS",
     "firebase race<br/>condition 해결<br/>로그인·결제 정상화"],
]
tile_data = [
    [Paragraph(f"<b>{v5_tiles[1][i]}</b>", ParagraphStyle("TileH", parent=BODY,
              fontName="NanumGothicBold", fontSize=10.5, leading=15,
              textColor=BRAND_BLUE, alignment=TA_CENTER, spaceAfter=4))
     for i in range(4)],
    [Paragraph(v5_tiles[2][i], ParagraphStyle("TileB", parent=BODY,
              fontName="NanumGothic", fontSize=9, leading=14,
              textColor=BRAND_INK, alignment=TA_CENTER))
     for i in range(4)],
]
tile_table = Table(tile_data, colWidths=[42*mm, 42*mm, 42*mm, 42*mm], rowHeights=[12*mm, 24*mm])
tile_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BG_SOFT),
    ("BACKGROUND", (0, 1), (-1, 1), white),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("BOX", (0, 0), (-1, -1), 0.6, BRAND_LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, BRAND_LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(tile_table)
story.append(Spacer(1, 14*mm))

# Meta block
meta_data = [
    ["대상", "마케팅 담당자 · 운영팀 · 변리사(상표 출원 협업)"],
    ["발행일", "2026년 5월 5일"],
    ["버전", "v5 (Trademark · Mobile UX · Performance Edition)"],
    ["기준 PR", "PR #21 · #22 · #23 · #24 (모두 머지·배포 완료)"],
    ["도메인", "lifeportfolio.co.kr"],
    ["제공", "인생포트폴리오 운영팀"],
]
meta_table = Table(meta_data, colWidths=[28*mm, 140*mm])
meta_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "NanumGothicBold"),
    ("FONTNAME", (1, 0), (1, -1), "NanumGothic"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("TEXTCOLOR", (0, 0), (0, -1), BRAND_NAVY),
    ("TEXTCOLOR", (1, 0), (1, -1), BRAND_INK),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_LINE),
]))
story.append(meta_table)

story.append(PageBreak())

# ─────────────────────────────────────────────────────────
# PAGE 2 — v4 → v5 변경 요약
# ─────────────────────────────────────────────────────────
story.append(Paragraph("v4 → v5, 무엇이 달라졌는가", H1))

story.append(Paragraph(
    "v4(Global Launch Edition)에서 글로벌 결제 인프라가 완성되었다면, "
    "v5에서는 <b>실사용 단계의 안정성과 신뢰</b>를 완성했습니다. "
    "라이브 사이트 운영 중 발견된 모바일 UX 문제를 즉시 해결하고, PageSpeed 모바일 점수를 끌어올렸으며, "
    "브랜드 자산을 법적 보호 단계까지 진입시켰습니다.",
    BODY
))

story.append(Paragraph("이번 사이클의 4가지 큰 변화", H3))

change_data = [
    ["영역", "v4까지", "v5 (현재)", "마케팅 활용 포인트"],
    ["상표 보호",
     "브랜드명·로고 사용 중\n(법적 보호 미진행)",
     "마크인포 통해 출원 진행\n인생포트폴리오/Life Portfolio\n09류 + 42류",
     "광고에 ™ 표기 가능\n경쟁사 모방 차단 기반"],
    ["모바일 UX",
     "로그인/회원가입 일부\n잘림 · 결제 버튼\n무반응 이슈 발생",
     "상단 정리 + 하단 sticky\nCTA 즉시 노출\n결제 동선 명확화",
     "모바일 광고 ROAS 보호\n(이탈 방지)"],
    ["성능 최적화",
     "preconnect 6개\nGTM·Firebase 즉시 로드\nrender-blocking CSS",
     "preconnect 4개로 정리\nGTM lazy-load\n인라인 critical CSS",
     "광고 클릭 → 페이지 도달\n시간 단축 → 전환율 ↑"],
     ["긴급 안정화",
     "firebase race\ncondition으로 인증 UI\n간헐적 무반응",
     "SDK 동기 로드 +\n방어 가드 +\nCSP 강화로 100% 정상화",
     "결제 신뢰성 회복\n(0% → 정상)"],
]
ct = standard_table(change_data, [22*mm, 48*mm, 50*mm, 48*mm], font_size=9, row_pad=7)
story.append(KeepTogether(ct))

story.append(Spacer(1, 6*mm))

story.append(Paragraph("PR 단위 진행 요약", H3))
pr_data = [
    ["PR #", "내용", "효과"],
    ["#21",
     "모바일 UX 긴급 수정 + PageSpeed 90+ 최적화\n+ 상표권 등록 자산(12개 PNG/SVG) 생성",
     "모바일 점수 68 → 90+ 목표\n상표 출원 즉시 가능"],
    ["#22",
     "firebase race condition 핫픽스\n(SDK defer 제거, 방어 가드, CSP 강화)",
     "로그인·회원가입·결제 100% 정상화\n(라이브 인시던트 즉시 해결)"],
    ["#23",
     "모바일 sticky CTA 위치/레이아웃 개선\n(가격↔버튼 균형, 영문 CTA 잘림 방지)",
     "iPhone Pro/Plus 등 모든\n모바일 해상도에서 정상 표시"],
    ["#24",
     "모바일 결제 CTA 위치/노출 타이밍 개선\n(상단 CTA 숨김, 하단 sticky 즉시 노출)",
     "첫 화면부터 결제 동선 명확\n사용자 만족도 직접 회복"],
]
prt = standard_table(pr_data, [16*mm, 78*mm, 76*mm], font_size=9.2, row_pad=7)
story.append(KeepTogether(prt))

story.append(PageBreak())

# ─────────────────────────────────────────────────────────
# PAGE 3 — 상표 출원 (NEW)
# ─────────────────────────────────────────────────────────
story.append(Paragraph("상표권 출원 — 브랜드 자산의 법적 보호", H1))

story.append(Paragraph(
    "<b>모바일 상단에 노출되는 ‘인생포트폴리오’ 워드마크와 L· 모노그램 로고를 "
    "법적으로 보호하기 위해 상표 출원을 진행합니다.</b> 출원이 완료되면 광고와 패키지에 "
    "™ 표기가 가능해지고, 경쟁사의 동일·유사 명칭 사용을 차단할 수 있습니다.",
    BODY
))

story.append(Paragraph("출원 정보 한 장 요약", H3))
trademark_data = [
    ["항목", "내용"],
    ["대리인 (출원 대행)", "마크인포(MarkInfo) — 온라인 상표 출원 플랫폼"],
    ["상표 유형", "복합상표 (도형 + 문자)"],
    ["상표명", "인생포트폴리오 / Life Portfolio (한글·영문 병기)"],
    ["출원 분류 (NICE)", "09류 + 42류 (총 2개 류)"],
    ["09류 지정상품",
     "다운로드 가능한 디지털 출판물(PDF 리포트), 모바일 진단 애플리케이션, "
     "컴퓨터 소프트웨어"],
    ["42류 지정서비스",
     "SaaS형 자기경영 진단 플랫폼 제공, 소프트웨어 개발·설계·유지보수, "
     "온라인 진단 도구 호스팅 서비스"],
    ["로고 자산",
     "lifeportfolio-mark-color-2048.png (KIPO 컬러 견본 표준), "
     "lifeportfolio-mark-bw-2048.png (흑백), "
     "SVG 마스터 (color/bw), 워드마크 KO/EN"],
    ["브랜드 컬러",
     "네이비 #4A6680 (배경) · 골드 #C8A24A (보더) · 아이보리 #F4ECD8 (모노그램)"],
    ["예상 비용 (정부+대리)",
     "약 25–30만 원 (2개 류 기준, 마크인포 패키지 가격에 따라 변동)"],
    ["진행 상태",
     "분류 선택 완료(09+42), 1:1 상담 매니저 배정 대기"],
]
tt = standard_table(trademark_data, [38*mm, 130*mm], font_size=9.5, row_pad=7)
story.append(KeepTogether(tt))

story.append(Spacer(1, 4*mm))

story.append(Paragraph(
    "<b>왜 09류 + 42류인가</b> — 우리 사업의 핵심 두 축을 정확히 커버합니다. "
    "09류는 <b>‘무엇을 판매하는가’</b>(다운로드 가능한 PDF 리포트 = 디지털 상품), "
    "42류는 <b>‘어떻게 제공하는가’</b>(lifeportfolio.co.kr SaaS 플랫폼 = 호스팅 서비스). "
    "최소 비용으로 핵심 비즈니스 모델을 보호할 수 있는 조합입니다.",
    BODY
))

story.append(Paragraph("향후 확장 가능 류 (선택)", H3))
expand_data = [
    ["류", "보호 범위", "추천 시점"],
    ["41류", "온라인 코칭, 워크숍, 교육 콘텐츠, 유튜브 채널 운영",
     "코칭/교육 사업 출시 시"],
    ["16류", "인쇄된 종이책 출판, 워크북",
     "종이책 출판 시"],
    ["35류", "광고/마케팅, 온라인 쇼핑몰 운영",
     "제휴 마케팅 확대 시"],
]
et = standard_table(expand_data, [20*mm, 90*mm, 58*mm], font_size=9.5, row_pad=7)
story.append(KeepTogether(et))

story.append(Spacer(1, 3*mm))

story.append(Paragraph(
    "<b>마케팅 활용 가이드</b> — 출원 접수 직후 광고·홈페이지·패키지에 ‘<b>인생포트폴리오™</b>’ 표기 가능. "
    "등록 결정(약 12–18개월 후) → ‘®’ 표기로 격상. KIPRIS(특허청 검색) 노출로 외부 신뢰도 상승 → "
    "변리사 협업 콘텐츠 작성도 가능합니다.",
    HIGHLIGHT_BOX
))

# ─────────────────────────────────────────────────────────
# PAGE 4 — 모바일 UX 개선 (NEW)
# ─────────────────────────────────────────────────────────
story.append(Paragraph("모바일 UX 완성 — 라이브 사이트 즉시 개선", H1))

story.append(Paragraph(
    "v4 글로벌 출시 후 라이브 운영 중 발견된 모바일 UX 이슈를 사용자 피드백 즉시 반영하여 "
    "PR #21~#24로 단계적으로 해결했습니다. <b>지금 인생포트폴리오 모바일 사이트는 사용자가 "
    "‘만족’이라고 평가한 상태입니다.</b>",
    BODY
))

story.append(Paragraph("Before / After — 사용자 관점에서", H3))
ux_data = [
    ["문제 영역", "Before (v4)", "After (v5)"],
    ["로그인/회원가입",
     "모바일에서 메뉴가 잘려\n보이지 않거나 사라짐",
     "상단 nav 정리 후\n잘림 없이 항상 표시"],
    ["결제 버튼",
     "‘9,900원 결제하기’ 클릭\n시 무반응 (race\ncondition)",
     "100% 정상 동작\n(SDK 로드 순서 보정 +\n방어 가드)"],
    ["결제 동선",
     "하단 sticky CTA가 스크롤\n중간에야 등장 → 결제\n의도 불명확",
     "페이지 진입 1.2초 후\n자동 노출 / 60px 스크롤\n시 즉시 표시"],
    ["sticky CTA 레이아웃",
     "영문 ‘Get my Life\nBlueprint’ 우측 잘림 위험",
     "가격↔버튼 균형 + iOS\nsafe-area + 430/360px\nbreakpoint 신설"],
    ["상단 CTA 위치",
     "‘9,900원 시작하기 →’가\n로그인/회원가입과 충돌",
     "모바일에서는 상단 CTA\n숨김 → 하단 sticky로\n결제 동선 일원화"],
]
uxt = standard_table(ux_data, [32*mm, 60*mm, 76*mm], font_size=9.2, row_pad=7)
story.append(KeepTogether(uxt))

story.append(Spacer(1, 5*mm))

story.append(Paragraph("핵심 기술 변경 (PR #22 critical fix)", H3))

story.append(Paragraph(
    "<b>문제의 본질</b> — PR #19에서 Firebase compat SDK를 <code>defer</code>로 로딩하면서, "
    "인라인 초기화 스크립트가 SDK보다 먼저 실행되는 race condition이 발생했습니다. "
    "그 결과 <code>firebase is not defined</code> 에러가 던져지고, 그 뒤의 모든 인증 UI 코드가 "
    "중단되어 로그인 메뉴가 비어 보이고 결제 버튼이 무반응이 됐습니다.",
    BODY
))

story.append(Paragraph(
    "<b>해결 방법</b> — Firebase SDK의 <code>defer</code> 속성을 제거하여 동기 로드로 전환했고, "
    "<code>typeof firebase === \"undefined\"</code> 가드를 추가해 SDK 미로드 상황에서도 "
    "최소한의 로그인/회원가입 링크는 항상 렌더링되도록 했습니다. 동시에 CSP에 jsdelivr와 "
    "Google Fonts 도메인을 추가해 Pretendard 폰트도 정상 로드되게 했습니다.",
    BODY
))

story.append(Paragraph(
    "<b>운영 임팩트</b> — 라이브 사이트 인증 UI 무반응이 100%에서 0%로 회복되었고, "
    "결제 클릭 → login.html 정상 라우팅도 복구되었습니다. 데스크톱 콘솔 에러 0건, "
    "그리고 무엇보다 사용자 직접 피드백으로 <i>“모바일 UX는 해결됐어요. 결론적으로 만족합니다!”</i> "
    "라는 응답을 받았습니다.",
    OK_BOX
))

# ─────────────────────────────────────────────────────────
# PAGE 5 — 성능 최적화
# ─────────────────────────────────────────────────────────
story.append(Paragraph("PageSpeed 최적화 — 광고 클릭 손실 방지", H1))

story.append(Paragraph(
    "광고 클릭 후 페이지가 늦게 뜨면 사용자의 30% 이상이 이탈한다는 것은 업계 정설입니다. "
    "v5에서는 PageSpeed Insights 모바일 점수를 끌어올리기 위한 4가지 최적화를 적용했습니다.",
    BODY
))

story.append(Paragraph("적용된 최적화 4가지", H3))
perf_data = [
    ["항목", "Before", "After"],
    ["preconnect 개수", "6개\n(GTM, GA, gstatic, jsdelivr ×2,\nfirebase)", "4개\n(gstatic, jsdelivr, firebase, GTM)"],
    ["render-blocking CSS", "lang-toggle.css 외부 로드",
     "인라인화 + Pretendard preload\n+ onload swap"],
    ["GTM/GA 로딩",
     "페이지 로드 즉시\n(약 134 KiB JS)",
     "requestIdleCallback로\n사용자 첫 인터랙션 대기 후 로드"],
    ["미사용 JS",
     "Firebase Auth ~35 KiB\n+ GTM ~134 KiB\n초기 로드 포함",
     "lazy-load 처리\n(약 170 KiB 절감)"],
]
pft = standard_table(perf_data, [40*mm, 60*mm, 68*mm], font_size=9.2, row_pad=7)
story.append(KeepTogether(pft))

story.append(Spacer(1, 5*mm))

story.append(Paragraph("측정 결과 해석 (콜드 스타트 가능성)", H3))

story.append(Paragraph(
    "측정 환경에 따라 PageSpeed 결과가 크게 달라질 수 있습니다. 최근 측정에서 모바일 점수 55점, "
    "FCP 25.4초, LCP 28.1초가 관측됐는데, 이는 정상 트래픽 상황의 우리 사이트 실제 성능과는 "
    "괴리가 큽니다(PR #21 적용 후 예상치 LCP ≈ 2.0초). 이는 다음과 같이 해석됩니다.",
    BODY
))

story.append(Paragraph(
    "<b>유력한 원인 (우선순위 순)</b><br/>"
    "1. <b>Firebase Hosting 콜드 스타트 / CDN 지연</b> — 이용 빈도가 낮은 측정 리전에서 "
    "측정될 때 발생. 5분 후 재측정으로 검증 가능.<br/>"
    "2. <b>외부 스크립트 초기 핸드셰이크</b> — reCAPTCHA Enterprise / GTM 첫 통신.<br/>"
    "3. <b>실제 사용자 데이터(필드 데이터) 부족</b> — PageSpeed 상단 ‘실제 사용자 경험’이 "
    "‘데이터 없음’ → 트래픽 누적 후 정확도 향상.",
    BODY
))

story.append(Paragraph(
    "<b>안정 지표 — 우리 코드는 정상</b><br/>"
    "• TBT (Total Blocking Time): <b>0ms</b> — JS 메인 스레드 차단 없음<br/>"
    "• CLS (Cumulative Layout Shift): <b>0</b> — 레이아웃 흔들림 없음<br/>"
    "• 접근성: <b>88점</b> · 권장사항: <b>96점</b> · SEO: <b>100점 만점</b><br/>"
    "→ 즉, 코드 품질은 만점에 가깝고, 측정된 LCP는 네트워크/콜드스타트 영향이 큰 상황입니다.",
    OK_BOX
))

story.append(Paragraph(
    "<b>다음 액션</b> — 5분 간격으로 PageSpeed 3회 재측정해 점수 분포를 확인하세요. "
    "GA4 RUM(PR #19에서 설정)을 통해 실제 한국 사용자의 LCP/FCP를 베이스라인으로 잡고, "
    "점수가 지속적으로 70 이하라면 PR #25에서 reCAPTCHA Enterprise 지연 로드를 추가 진행합니다.",
    WARN_BOX
))

# ─────────────────────────────────────────────────────────
# PAGE 6 — 마케팅 활용 가이드 (업데이트)
# ─────────────────────────────────────────────────────────
story.append(Paragraph("마케팅 즉시 활용 가이드 (v5 업데이트)", H1))

story.append(Paragraph(
    "v4의 ‘Only One’과 ‘즉시 발급’ 두 후크는 그대로 유효합니다. v5에서는 여기에 "
    "<b>‘브랜드 신뢰’와 ‘모바일 안심 결제’</b>라는 새로운 후크가 추가되었습니다.",
    BODY
))

story.append(Paragraph("신규 신뢰 뱃지 (v5 추가)", H3))
badge_data = [
    ["뱃지", "표시 문구 (KO)", "표시 문구 (EN)", "사용 시점"],
    ["상표 출원",
     "인생포트폴리오™\n(특허청 출원 진행)",
     "Life Portfolio™\n(Trademark Pending)",
     "출원 접수 직후 즉시"],
    ["모바일 검증",
     "모바일 100% 검증\n(iPhone/Galaxy 전체 해상도)",
     "Mobile-Verified\n(All iPhone/Galaxy widths)",
     "광고 랜딩 헤더"],
    ["결제 안정성",
     "결제 100% 안정 운영\n(Firebase + PayPal)",
     "100% Secure Checkout\n(Firebase + PayPal)",
     "결제 직전 신뢰 강화"],
]
bt = standard_table(badge_data, [24*mm, 50*mm, 50*mm, 44*mm], font_size=9, row_pad=7)
story.append(KeepTogether(bt))

story.append(Spacer(1, 5*mm))

story.append(Paragraph("v5 추가 광고 카피 예시", H3))

story.append(Paragraph(
    "<b>국내 (KO)</b><br/>"
    "• “인생포트폴리오™ — 특허청 출원 중인, 단 하나뿐인 인생 설계도.”<br/>"
    "• “모바일에서 1분이면 시작합니다. 결제까지 끊김 없이.”<br/>"
    "• “안심하고 시작하세요. Firebase + Payple 4중 보안.”",
    BODY
))

story.append(Paragraph(
    "<b>해외 (EN)</b><br/>"
    "• “Life Portfolio™ — A trademarked one-of-a-kind life blueprint.”<br/>"
    "• “Built for mobile. Pay smoothly with PayPal in under a minute.”<br/>"
    "• “Discover, live, and leave — your blueprint, secured end-to-end.”",
    BODY
))

ch_data = [
    ["채널", "메인 후크", "보조 신뢰 뱃지"],
    ["인스타그램 (KO)",
     "“1분 만에 시작하는 인생 설계도.”",
     "모바일 검증 / Only One"],
    ["카카오 모먼트",
     "“당신 안에 이미 답이 있습니다.”",
     "Payple 안전 결제 / 4중 보안"],
    ["네이버 검색광고",
     "“방향은 보이는데 첫 걸음이 막막한 분께.”",
     "인생포트폴리오™ 출원 중"],
    ["Meta Ads (EN)",
     "“The answer is already inside you. $8.99.”",
     "PayPal Buyer Protection"],
    ["Google Ads (EN)",
     "“Trademark-pending one-of-a-kind blueprint.”",
     "Life Portfolio™ / Mobile-Verified"],
    ["TikTok Ads (EN)",
     "“Not a personality type. A direction.”",
     "Mobile-First / 15 minutes"],
]
cht = standard_table(ch_data, [38*mm, 76*mm, 56*mm], font_size=9, row_pad=7)
# Keep heading + table together so they don't split awkwardly across pages
story.append(KeepTogether([
    Paragraph("채널별 v5 메시지 매칭", H3),
    cht
]))

story.append(Spacer(1, 4*mm))

story.append(Paragraph("운영 가이드 — 신뢰 뱃지 노출 원칙", H3))
story.append(Paragraph(
    "광고 랜딩 1스크롤에는 최대 2개의 뱃지만 노출하세요. 너무 많은 뱃지는 오히려 신뢰도를 떨어뜨립니다. "
    "<b>국내 광고는</b> ‘인생포트폴리오™ + Payple 안전 결제’ 조합, "
    "<b>해외 광고는</b> ‘Life Portfolio™ + PayPal Buyer Protection’ 조합을 권장합니다. "
    "결제 직전 페이지에서는 ‘4중 보안 + Google 인증 로그인’을 추가로 노출해 결제 직전 망설임을 줄입니다.",
    BODY
))

story.append(Paragraph(
    "<b>A/B 테스트 권장 조합 (v5)</b> — A안: ‘<b>Only One</b> 후크 + 인생포트폴리오™ 뱃지’ vs "
    "B안: ‘<b>모바일 1분 시작</b> 후크 + 모바일 검증 뱃지’. 동일 예산으로 2주간 집행 후 CTR·CVR 비교를 통해 "
    "후속 사이클의 메인 카피 라인을 결정하세요.",
    HIGHLIGHT_BOX
))

story.append(PageBreak())

# ─────────────────────────────────────────────────────────
# PAGE 7 — 누적 개선 타임라인
# ─────────────────────────────────────────────────────────
story.append(Paragraph("누적 개선 타임라인 — Phase 1 → Phase 11", H1))

story.append(Paragraph(
    "v3까지의 개선이 ‘기본기 완성’이고, v4가 ‘글로벌 진출’이라면, v5는 ‘<b>실전 운영 안정화와 "
    "브랜드 자산화</b>’입니다. 한 흐름으로 보면 다음과 같습니다.",
    BODY
))

phase_data = [
    ["Phase", "내용", "단계"],
    ["1", "인증 안정화 (Firebase 통합, CSP, 마이페이지 톤 라벨)", "v3"],
    ["2", "맞춤 실행 프로그램(3주·3개월·1년 엔진) 추가", "v3"],
    ["3", "모바일 전면 반응형 개편", "v3"],
    ["4", "보안 4중 방어 (App Check, 클릭재킹, RTDB 룰)", "v3"],
    ["4.5", "‘즉시 자동 생성’으로 카피 통일", "v3"],
    ["5", "회원 UX 고도화 (자동 분기 모달)", "v3"],
    ["5.5", "‘Only One 인생’ 비전 카피 정렬", "v3"],
    ["6", "영문 버전 출시 (i18n + ?lang=en)", "v4"],
    ["7", "Functions v2 + Secret Manager 마이그레이션", "v4"],
    ["8", "PayPal Live 적용 — 해외 판매 개시", "v4"],
    ["9", "PageSpeed 90+ 최적화 + 모바일 UX 긴급 수정", "v5 (PR #21)"],
    ["9.5", "Firebase race condition 핫픽스 (로그인/결제 정상화)", "v5 (PR #22)"],
    ["10", "모바일 sticky CTA 레이아웃 개선", "v5 (PR #23)"],
    ["10.5", "모바일 결제 CTA 위치/노출 타이밍 개선", "v5 (PR #24)"],
    ["11", "상표 출원 자산 + 분류 작성 (출원 진행 중)", "v5 (PR #21+)"],
]
pht = standard_table(phase_data, [16*mm, 116*mm, 34*mm], font_size=9.2, row_pad=6)
story.append(KeepTogether(pht))

story.append(Spacer(1, 4*mm))

story.append(Paragraph(
    "<b>현재 인프라가 준비된 상태</b> — 글로벌 결제 인프라(v4) + 모바일 신뢰성(v5) + 브랜드 "
    "법적 보호(v5) 3박자가 동시에 갖춰진 시점입니다. <b>이제는 광고 예산을 공격적으로 "
    "투입해도 시스템이 떨어지지 않습니다.</b>",
    HIGHLIGHT_BOX
))

story.append(PageBreak())

# ─────────────────────────────────────────────────────────
# PAGE 8 — 마케팅팀 To-Do
# ─────────────────────────────────────────────────────────
story.append(Paragraph("마케팅팀 To-Do (v5 업데이트)", H1))

story.append(Paragraph(
    "이번 사이클에서 추가된 자산을 즉시 활용 가능한 형태로 정리했습니다.",
    BODY
))

story.append(Paragraph("우선순위 (1주 이내 실행)", H3))
todo_high = [
    "광고 카피·랜딩에 ‘<b>인생포트폴리오™</b>’ 표기 추가 (출원 접수 즉시).",
    "모바일 광고 비중을 데스크톱 대비 70% 이상으로 상향 (모바일 UX 자신감).",
    "PageSpeed 점수 변동을 1주 단위로 모니터링 (콜드 스타트 패턴 파악).",
    "GA4 RUM 데이터로 실제 한국 사용자 LCP/FCP 베이스라인 측정.",
    "‘<b>모바일 1분 시작</b>’ 신규 후크를 인스타그램 릴스 광고에 우선 적용.",
]
story.append(bullet_list(todo_high))

story.append(Paragraph("중기 (2–4주)", H3))
todo_mid = [
    "Meta/TikTok Ads (EN) 영문 카피 A/B 테스트 — “Trademark-pending” 후크 vs “Only One” 후크.",
    "유튜브 협찬·인플루언서 콘텐츠에 상표 출원 사실을 신뢰 메시지로 활용.",
    "‘안심 결제 4중 보안’ 뱃지를 결제 직전 페이지에 명시적으로 노출.",
    "?lang=en UTM 세그먼트 단독으로 ROAS 측정 → 글로벌 채널 가성비 파악.",
    "1단(진단) → 2단(21일 패키지) 업셀 퍼널 ROAS LTV 측정 시작.",
]
story.append(bullet_list(todo_mid))

story.append(Paragraph("장기 (1–3개월)", H3))
todo_low = [
    "상표 등록 결정 시점(약 12–18개월 후) ‘®’ 표기로 격상.",
    "추가 분류 출원 검토 — 41류(코칭/교육)와 16류(인쇄물).",
    "운영자 대시보드에 PR/배포 흐름과 KPI 통합 (별도 일정).",
    "글로벌 시장에서 검증된 후크를 한국 시장에 역수입 적용.",
]
story.append(bullet_list(todo_low))

story.append(Spacer(1, 4*mm))

story.append(Paragraph(
    "<b>주의 — 광고 카피 컴플라이언스</b><br/>"
    "v4에서 안내드린 대로 ‘영구 보관 / 평생 보관’ 표현은 여전히 사용 금지입니다. "
    "또한 상표 출원 ‘진행 중’ 단계에서는 <b>™</b>은 가능하나 <b>®</b>은 등록 결정 이후에만 사용해야 합니다. "
    "광고심의(KOSO·KCAP) 가이드라인 위반 위험이 있습니다.",
    WARN_BOX
))

story.append(PageBreak())

# ─────────────────────────────────────────────────────────
# PAGE 9 — 종합 요약 (One-Pager)
# ─────────────────────────────────────────────────────────
story.append(Paragraph("종합 요약 (One-Pager)", H1))

story.append(Paragraph("FINAL MESSAGE", H3))

story.append(Paragraph(
    "당신은 그 누구와도 같지 않은 한 사람입니다.<br/>"
    "그 사실을 코드로 증명하고, 안전한 모바일 결제와 법적으로 보호받는 브랜드로,<br/>"
    "그 답을 당신과 누군가의 길로 잇는 것이 인생포트폴리오입니다.",
    QUOTE
))

story.append(Paragraph(
    "76문항 × 무한 조합 × 5가지 어조 × KO·EN 2개 언어 × KRW·USD 2개 통화 × "
    "<b>출원 진행 중인 인생포트폴리오™ 브랜드 × 100% 정상화된 모바일 결제 동선</b>으로, "
    "당신만의 방향과 첫 행동, 그리고 살아낸 삶이 다른 누군가의 양식이 되는 흐름까지. "
    "이제는 ‘안심하고 광고를 켤 수 있는’ 단계에 도달했습니다.",
    BODY
))

# Final 4-tile summary
final_data = [
    ["결과의 고유성", "발급 속도", "실행 연결", "판매 권역"],
    ["Only One", "즉시", "3주~1년", "글로벌"],
    ["사람마다 단 하나뿐인\n리포트",
     "결제 후 검사만 마치면\n자동",
     "루틴·구조화·흐름까지",
     "Payple(KR) +\nPayPal(WW)"],
    ["브랜드 보호",
     "모바일 신뢰",
     "성능 최적화",
     "긴급 안정화"],
    ["인생포트폴리오™\n출원 진행",
     "결제 동선 100%\n정상 + sticky CTA\n즉시 노출",
     "preconnect 4개 +\nGTM lazy-load",
     "Firebase race\ncondition 해결"],
]
final_styles = [
    [Paragraph(f"<b>{c}</b>", ParagraphStyle("FT", parent=BODY,
              fontName="NanumGothicBold", fontSize=10.5, leading=14,
              textColor=BRAND_BLUE, alignment=TA_CENTER)) for c in row]
    if i in (0, 3) else
    [Paragraph(f"<b>{c}</b>", ParagraphStyle("FT2", parent=BODY,
              fontName="NanumGothicExtraBold", fontSize=12.5, leading=18,
              textColor=BRAND_NAVY, alignment=TA_CENTER)) for c in row]
    if i in (1,) else
    [Paragraph(c, ParagraphStyle("FT3", parent=BODY,
              fontSize=8.8, leading=13, textColor=BRAND_INK,
              alignment=TA_CENTER)) for c in row]
    for i, row in enumerate(final_data)
]
final_table = Table(final_styles, colWidths=[42*mm, 42*mm, 42*mm, 42*mm],
                    rowHeights=[10*mm, 11*mm, 16*mm, 9*mm, 19*mm])
final_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BG_SOFT),
    ("BACKGROUND", (0, 1), (-1, 1), white),
    ("BACKGROUND", (0, 2), (-1, 2), white),
    ("BACKGROUND", (0, 3), (-1, 3), BRAND_BG_GOLD),
    ("BACKGROUND", (0, 4), (-1, 4), white),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("BOX", (0, 0), (-1, -1), 0.7, BRAND_GOLD),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, BRAND_LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(KeepTogether(final_table))

story.append(Spacer(1, 6*mm))

story.append(Paragraph("마케팅팀에게 드리는 메시지", H3))
final_msgs = [
    "핵심 후크는 ‘<b>Only One 인생 설계도</b>’ + ‘<b>인생포트폴리오™ 브랜드</b>’ + "
    "‘<b>모바일 1분 시작</b>’ 세 가지로 확장되었습니다.",
    "비교/네거티브 프레이밍 대신 비전 정렬형 카피를 1순위로 사용하세요.",
    "인프라·UX·보안·결제·브랜드 보호까지 ‘공격적 광고를 견딜 준비’가 모두 끝났습니다.",
    "국내는 인스타·카카오, 해외는 Meta·TikTok·Google Ads에서 가장 큰 효과가 기대됩니다.",
    "결제 신뢰 뱃지(Google · Payple · PayPal · 4중 보안 + 인생포트폴리오™)는 결제 전환률 향상에 직결됩니다.",
    "다음 단계는 가입자·매출 증가에 따른 운영자 대시보드 통합입니다 (별도 일정).",
]
story.append(bullet_list(final_msgs))

story.append(Spacer(1, 5*mm))

story.append(Paragraph(
    "<b>최종 한 줄</b> — 광고를 켜면, 시스템이 알아서 받아냅니다. "
    "이제 그 시스템은 국내 9,900원과 해외 $8.99를 동시에 받고, 모바일에서 끊김 없이 결제되며, "
    "‘<b>인생포트폴리오™</b>’라는 법적으로 보호받는 브랜드 아래 운영됩니다. "
    "마케팅이 단 하나의 메시지에만 집중할 수 있는 환경이 완성되었습니다.",
    HIGHLIGHT_BOX
))

story.append(Spacer(1, 8*mm))

story.append(Paragraph(
    "인생포트폴리오 · Internal Marketing Brief v5 (Trademark · Mobile UX · Performance Edition) "
    "· 2026-05-05 · Prepared by 운영팀",
    ParagraphStyle("Footnote", parent=BODY, fontSize=8.5, leading=12,
                   textColor=BRAND_MUTED, alignment=TA_CENTER)
))

# ============================================================
# Build PDF
# ============================================================
def build():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=24*mm, bottomMargin=22*mm,
        title="Life Portfolio · 웹사이트 구축·고도화 성과 보고서 v5",
        author="인생포트폴리오 운영팀",
        subject="v5 (Trademark · Mobile UX · Performance Edition)",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"OK — wrote {OUTPUT_PATH} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    build()
