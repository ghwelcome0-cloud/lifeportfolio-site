#!/usr/bin/env bash
# AX 톤 iOS 스타트업(런치) 이미지 생성기.
# #lp-splash 룩과 통일: 밝은 그라데이션(#FAFAF7→#F4F2EF) 배경 + 중앙 로고 + "인생포트폴리오".
# OS 기본 파란 스플래시를 이 AX 톤 이미지로 대체 → 시각적 2단계(AX 연출 → 인덱스).
set -euo pipefail
cd "$(dirname "$0")"

# device_w device_h (물리 픽셀, portrait)
SIZES=(
  "750 1334"    # SE2/3, 8
  "828 1792"    # 11, XR
  "1080 1920"   # 일반 안드로이드 대응(부가)
  "1125 2436"   # X, XS, 11 Pro
  "1170 2532"   # 12, 12 Pro, 13, 13 Pro, 14
  "1179 2556"   # 14 Pro, 15, 16
  "1242 2208"   # 8 Plus
  "1242 2688"   # XS Max, 11 Pro Max
  "1284 2778"   # 12/13 Pro Max, 14 Plus
  "1290 2796"   # 14 Pro Max, 15 Pro Max, 16 Pro Max
)

for pair in "${SIZES[@]}"; do
  W=${pair% *}; H=${pair#* }
  LOGO=$(python3 -c "print(int(min($W,$H)*0.30))")   # 로고 폭 = 짧은변의 30%
  CX=$(python3 -c "print($W/2)")
  LY=$(python3 -c "print($H/2 - $LOGO/2 - $H*0.03)")  # 로고 top (중앙보다 살짝 위)
  WORD_Y=$(python3 -c "print(int($LY + $LOGO + $H*0.045))")
  TAG_Y=$(python3 -c "print(int($WORD_Y + $H*0.028))")
  FOOT_Y=$(python3 -c "print(int($H*0.90))")
  WORD_FS=$(python3 -c "print(int(min($W,$H)*0.048))")
  TAG_FS=$(python3 -c "print(int(min($W,$H)*0.033))")
  FOOT_FS=$(python3 -c "print(int(min($W,$H)*0.030))")
  OUT="startup-${W}x${H}.png"

  cat > _tmp.svg <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$W" height="$H" viewBox="0 0 $W $H">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FAFAF7"/>
      <stop offset="100%" stop-color="#F4F2EF"/>
    </linearGradient>
  </defs>
  <rect width="$W" height="$H" fill="url(#bg)"/>
  <g transform="translate($(python3 -c "print($CX - $LOGO/2)") $LY)">
    <svg width="$LOGO" height="$LOGO" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#475D74"/>
      <rect x="4" y="4" width="56" height="56" rx="9" fill="none" stroke="#C5A262" stroke-width="1.3" opacity="0.95"/>
      <rect x="7.5" y="7.5" width="49" height="49" rx="6.5" fill="none" stroke="#C5A262" stroke-width="0.9" opacity="0.7"/>
      <path d="M20 44 A 18 18 0 0 1 44 22" fill="none" stroke="#C5A262" stroke-width="1.4" opacity="0.9" stroke-linecap="round"/>
      <text x="30" y="46" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" fill="#F7F2E8" text-anchor="middle" letter-spacing="-1">L</text>
      <circle cx="45" cy="23" r="3" fill="#C5A262"/>
    </svg>
  </g>
  <text x="$CX" y="$WORD_Y" font-family="NanumSquare_ac, 'Noto Sans CJK KR', sans-serif" font-size="$WORD_FS" font-weight="700" fill="#2A2A2A" text-anchor="middle" letter-spacing="-0.5">인생포트폴리오</text>
  <text x="$CX" y="$TAG_Y" font-family="Georgia, serif" font-size="$TAG_FS" fill="#468D84" text-anchor="middle" letter-spacing="0.4">Live Your Portfolio</text>
  <text x="$CX" y="$FOOT_Y" font-family="NanumSquare_ac, 'Noto Sans CJK KR', sans-serif" font-size="$FOOT_FS" fill="#8A8A85" text-anchor="middle" letter-spacing="0.3">발견하고 · 살아내고 · 남깁니다</text>
</svg>
SVG

  rsvg-convert -w "$W" -h "$H" _tmp.svg -o "$OUT"
  echo "generated $OUT"
done
rm -f _tmp.svg
echo "DONE"
