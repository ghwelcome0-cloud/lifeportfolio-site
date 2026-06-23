# -*- coding: utf-8 -*-
"""숏츠 #1 9:16 커버 (검색/채널 노출용).
- 강한 훅 카피 + 골드 강조 + 시리즈 브랜드
"""
from design_v import *
from PIL import ImageDraw

def cover():
    img = bg_base()
    # 시리즈 브랜드
    tag(img, W // 2, 360, "인생 자산화 · 숏츠", F(B, 44))
    # 메인 훅 (행간 넉넉하게 — 위 2줄 화이트)
    wrap_glow(img, W // 2, 760,
              ["통장보다", "먼저 쌓아야 할"],
              F(EB, 124), WHITE, lh=1.45, glow_color=GOLD, glow_strength=75)
    # 핵심 강조 2줄 (골드) — 블록 간격 확보
    wrap_glow(img, W // 2, 1140,
              ["'단 하나'의", "자산"],
              F(EB, 146), GOLD_LT, lh=1.42, glow_color=GOLD, glow_strength=110)
    divider(img, W // 2, 1430, w=220)
    wrap_shadow(img, W // 2, 1580,
                ["당신이 '자산'이라 부르는 것,", "절반은 빠져 있습니다"],
                F(B, 54), GREY, lh=1.5)
    save(img, "cover.png")

if __name__ == "__main__":
    cover()
