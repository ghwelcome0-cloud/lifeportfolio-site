# Social slides — B2B launch announcement (Instagram 1:1)

## Output

| File | Size | Purpose |
|---|---|---|
| `out/slide1.png` | 1080×1080 | HOOK — 당신은 의미대로 살고 있나요? |
| `out/slide2.png` | 1080×1080 | PROBLEM — 잘하는 건 아는데, 왜 일하는지는 대답이 안 됩니다 |
| `out/slide3.png` | 1080×1080 | SOLUTION — 당신 안의 사명과 비전을 함께 발견합니다 |
| `out/slide4.png` | 1080×1080 | CTA — 조직에서, 함께 + 1인당 ₩5,000부터 |
| `out/lifeportfolio-b2b-launch-slides.zip` | ~5MB | 4장 묶음 |

## How to rebuild

1. Generate 4 background images (2048×2048, nano-banana-pro) using the prompts in the chat archive
2. Save them as `raw/slide{1..4}_bg.png` (this folder is `.gitignore`-d)
3. Run:
   ```bash
   python3 assets/social/build_slides.py
   ```

## Caption (Instagram body)

See chat archive for the full Korean caption and hashtag block (5 tags).
