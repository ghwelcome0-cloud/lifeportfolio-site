# -*- coding: utf-8 -*-
"""숏츠 #3 번인 자막 (ASS).
- 하단 안전구역 배치 (슬라이드 메인 텍스트와 비중복)
- 무음 시청 대비: 나레이션 흐름을 보조 캡션으로
- 골드 강조어({\c}), 큰 폰트, 두꺼운 외곽선+그림자
- B-roll 구간엔 핵심 자막(슬라이드 없으므로 강조)
"""
# (start, end, text)  — \N 줄바꿈, {G}...{/G} 골드 강조
SUBS = [
    # S1 hook (0~8.08) — 슬라이드가 메인. 자막 생략(중복 방지)
    # S2 cond (8.08~13.98) — 슬라이드 카드가 메인. 자막 생략
    # B-roll (13.98~17.20) — 슬라이드 없음 → 핵심 자막 必
    (13.98, 17.20, "흩어진 생각은\\N{G}통제도 축적도 안 된다{/G}"),
    # S3 transform (17.20~31.90) — 슬라이드가 메인. 보조 자막 최소(겹침 방지).
    (19.80, 22.20, "{G}그저 흩어진 조각{/G}일 뿐"),
    # S4 cta (31.90~41.74) — 슬라이드 태그/메인/CTA카드가 하단 안전구역까지 차지.
    #   → #1·#2와 동일하게 S4 구간 자막 전면 생략(중복·겹침 방지).
]

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,NanumSquare Bold,70,&H00F8F7F4,&H000000FF,&H00100C08,&H00000000,-1,0,0,0,100,100,0,0,1,6,4,2,80,80,300,1
Style: Gold,NanumSquare Bold,70,&H005CA8CE,&H000000FF,&H00100C08,&H00000000,-1,0,0,0,100,100,0,0,1,6,4,2,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def ts(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h:d}:{m:02d}:{sec:05.2f}"

def conv(text):
    # {G}..{/G} → ASS 골드 인라인 컬러 (BGR: GOLD 206,168,92 → 5CA8CE)
    out = text.replace("{G}", "{\\c&H005CA8CE&}").replace("{/G}", "{\\c&H00F8F7F4&}")
    return out

lines = [HEADER]
for start, end, text in SUBS:
    body = conv(text)
    # 등장 페이드 (가독성, 부드러움)
    lines.append(
        f"Dialogue: 0,{ts(start)},{ts(end)},Cap,,0,0,0,,{{\\fad(180,180)}}{body}"
    )

open("subs.ass", "w").write("\n".join(lines))
print("subs.ass written,", len(SUBS), "cues")
