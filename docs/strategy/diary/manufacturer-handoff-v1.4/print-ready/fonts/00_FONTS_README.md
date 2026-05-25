# 폰트 사용 안내 (Fonts README · v1.4.2)

본 다이어리에 사용된 폰트:
- **Google Noto Sans/Serif CJK KR** — 한글 본문·라벨·헤더
- **Cormorant Garamond** (v1.4.2 신규) — 표지·헤드라인 영문 세리프

## 포함된 폰트

### 한글 (Noto CJK KR · 5 weights)
| 파일 | 패밀리 | Weight | 용도 |
|---|---|---|---|
| `NotoSansCJK-Light.ttc` | Noto Sans CJK KR | Light (300) | 본문 보조, 회색 텍스트 |
| `NotoSansCJK-Regular.ttc` | Noto Sans CJK KR | Regular (400) | 본문 기본, 라벨 |
| `NotoSansCJK-Bold.ttc` | Noto Sans CJK KR | Bold (700) | 강조, 키, 헤더 보조 |
| `NotoSerifCJK-Regular.ttc` | Noto Serif CJK KR | Regular (400) | 인용, 본문 강조 |
| `NotoSerifCJK-Bold.ttc` | Noto Serif CJK KR | Bold (700) | 페이지 타이틀, 헤더 |

### 영문 (Cormorant Garamond · Variable, v1.4.2 신규)
| 파일 | 패밀리 | 축 (Axis) | 용도 |
|---|---|---|---|
| `CormorantGaramond.ttf` | Cormorant Garamond | Weight 300~700 | 표지 LIFE PORTFOLIO (Regular), 본문 영문 헤더 |
| `CormorantGaramond-Italic.ttf` | Cormorant Garamond | Italic, Weight 300~700 | 표지 "Only One" (Italic) |

## 라이선스

**SIL Open Font License 1.1** — 상업적 사용·재배포·임베드 모두 자유.

- Noto CJK KR: https://github.com/notofonts/noto-cjk/blob/main/LICENSE
- Cormorant Garamond: `CormorantGaramond_OFL.txt` 동봉, https://github.com/CatharsisFonts/Cormorant

## 추가 weight가 필요한 경우

본문 PDF에는 이미 모든 사용 weight가 **임베드(Embedded) + 서브셋(Subset)** 처리되어 있어
폰트 추가 설치 없이도 인쇄 가능합니다.

제조사가 자체 RIP/Preflight 단계에서 폰트 재처리를 원할 경우:

- **Noto CJK KR 전체**: https://github.com/notofonts/noto-cjk/releases
- **Cormorant Garamond 전체**: https://fonts.google.com/specimen/Cormorant+Garamond

## 검증 (v1.4.2 본문 PDF)

본문 PDF 폰트 임베드 상태 (총 18개 서브셋):

```
$ pdffonts body_256p.pdf
name                                          type              emb sub uni
--------------------------------------------- ----------------- --- --- ---
RNUXYW+Cormorant-Garamond                     CID TrueType      yes yes yes
SYUBDG+Cormorant-Garamond-Medium-Italic       CID TrueType      yes yes yes
XSLEJI+Cormorant-Garamond-Semi-Bold           CID TrueType      yes yes yes
KTACKN+Cormorant-Garamond-Italic              CID TrueType      yes yes yes
DOKAKE+Cormorant-Garamond-Light               CID TrueType      yes yes yes
JRCFZH+Cormorant-Garamond-Bold                CID TrueType      yes yes yes
RFKOSQ+Cormorant-Garamond-Semi-Bold-Italic    CID TrueType      yes yes yes
GLWMKX+Cormorant-Garamond-Bold-Italic         CID TrueType      yes yes yes
WVXCWR+Noto-Serif-CJK-KR-Semi-Bold            CID Type 0C (OT)  yes yes yes
SXAUFQ+Noto-Sans-CJK-KR-Bold                  CID Type 0C (OT)  yes yes yes
MURMPG+Noto-Serif-CJK-KR-Oblique              CID Type 0C (OT)  yes yes yes
UZGYGC+Noto-Serif-CJK-KR-Bold                 CID Type 0C (OT)  yes yes yes
DSVEWC+Noto-Sans-CJK-KR                       CID Type 0C (OT)  yes yes yes
TMDGZK+Noto-Serif-CJK-KR                      CID Type 0C (OT)  yes yes yes
UAVOVU+Noto-Sans-CJK-KR-Oblique               CID Type 0C (OT)  yes yes yes
... (외 폴백용 WenQuanYi Zen Hei 3종)
```

→ 모든 폰트가 `emb yes / sub yes` (임베드 + 서브셋 완료)

문서 버전: v1.4.2 · 2026-05-25
