# -*- coding: utf-8 -*-
"""숏츠 #2 9:16 커버 — "목적이 또렷한 사람의 통장" (Hill 연구).
- Visual Shock(숫자) 훅 + 골드 강조 + 시리즈 브랜드
"""
from design_v import *
from PIL import ImageDraw

def cover():
    img = bg_base()
    tag(img, W // 2, 360, "인생 자산화 · 숏츠", F(B, 44))
    # 메인 훅 (화이트 2줄)
    wrap_glow(img, W // 2, 740,
              ["목적이 또렷하면", "통장이"],
              F(EB, 118), WHITE, lh=1.45, glow_color=GOLD, glow_strength=75)
    # 핵심 강조 (골드, 숫자 충격)
    wrap_glow(img, W // 2, 1120,
              ["+$20,000"],
              F(EB, 168), GOLD_LT, glow_color=GOLD, glow_strength=120)
    wrap_shadow(img, W // 2, 1290, ["달라진다"],
                F(EB, 96), WHITE, lh=1.40)
    divider(img, W // 2, 1450, w=220)
    wrap_shadow(img, W // 2, 1590,
                ["미국 4,660명 추적 연구가", "증명한 자산의 비밀"],
                F(B, 54), GREY, lh=1.5)
    save(img, "cover.png")

if __name__ == "__main__":
    cover()
