# -*- coding: utf-8 -*-
"""숏츠 #3 9:16 커버 — "머릿속 생각은 자산이 아니다".
- Direct Question + 반전 훅 + 골드 강조 + 시리즈 브랜드
"""
from design_v import *
from PIL import ImageDraw

def cover():
    img = bg_base()
    tag(img, W // 2, 360, "인생 자산화 · 숏츠", F(B, 44))
    # 메인 훅 (화이트)
    wrap_glow(img, W // 2, 720,
              ["머릿속 생각은", "아직"],
              F(EB, 120), WHITE, lh=1.45, glow_color=GOLD, glow_strength=75)
    # 핵심 강조 (골드, 반전)
    wrap_glow(img, W // 2, 1090,
              ["'자산'이", "아니다"],
              F(EB, 150), GOLD_LT, lh=1.42, glow_color=GOLD, glow_strength=115)
    divider(img, W // 2, 1430, w=220)
    wrap_shadow(img, W // 2, 1580,
                ["흩어진 생각을 '한 권'으로", "구조화해야 자산이 됩니다"],
                F(B, 54), GREY, lh=1.5)
    save(img, "cover.png")

if __name__ == "__main__":
    cover()
