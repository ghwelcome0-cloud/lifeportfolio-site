# -*- coding: utf-8 -*-
"""숏츠 #1 번인 자막 (ASS).
- 하단 안전구역 배치 (슬라이드 메인 텍스트와 비중복)
- 무음 시청 대비: 나레이션 흐름을 보조 캡션으로
- 골드 강조어({\c}), 큰 폰트, 두꺼운 외곽선+그림자
- B-roll 구간엔 핵심 자막(슬라이드 없으므로 강조)
"""
# (start, end, text)  — \N 줄바꿈, {G}...{/G} 골드 강조
SUBS = [
    # S1 hook (0~4.46) — 슬라이드가 메인. 자막은 생략(중복 방지)
    # S2 three (4.46~13.90) — 슬라이드 카드가 메인. 자막 생략
    # B-roll (13.90~18.12) — 슬라이드 없음 → 핵심 자막 必
    (13.90, 18.12, "돈·부동산만이\\N{G}자산은 아닙니다{/G}"),
    # S3 human (18.12~29.52) — 보조 흐름
    (18.20, 22.40, "{G}지식·기술·자기이해{/G}"),
    (22.60, 25.10, "경제학은 이것을"),
    (25.10, 29.40, "{G}인적자본{/G}이라 부릅니다"),
    # S4 cta (29.52~40.67) — 슬라이드 CTA 카드가 메인. 자막 중복 제거.
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
