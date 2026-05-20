# 폰트 사용 안내 (Fonts README · v1.4)

본 다이어리 본문 PDF에 사용된 폰트는 **Google Noto Sans/Serif CJK KR** 패밀리입니다.

## 포함된 폰트 (5 weights)

| 파일 | 패밀리 | Weight | 용도 |
|---|---|---|---|
| `NotoSansCJK-Light.ttc` | Noto Sans CJK KR | Light (300) | 본문 보조, 회색 텍스트 |
| `NotoSansCJK-Regular.ttc` | Noto Sans CJK KR | Regular (400) | 본문 기본, 라벨 |
| `NotoSansCJK-Bold.ttc` | Noto Sans CJK KR | Bold (700) | 강조, 키, 헤더 보조 |
| `NotoSerifCJK-Regular.ttc` | Noto Serif CJK KR | Regular (400) | 인용, 본문 강조 |
| `NotoSerifCJK-Bold.ttc` | Noto Serif CJK KR | Bold (700) | 페이지 타이틀, 헤더 |

## 라이선스

**SIL Open Font License 1.1** — 상업적 사용·재배포·임베드 모두 자유.

전체 라이선스 원문:
https://github.com/notofonts/noto-cjk/blob/main/LICENSE

## 추가 weight가 필요한 경우

다이어리 본문 PDF에는 이미 모든 사용 weight가 **임베드(Embedded) + 서브셋(Subset)** 처리되어 있어
폰트 추가 설치 없이도 인쇄 가능합니다.

다만 제조사가 자체 RIP/Preflight 단계에서 폰트 재처리를 원할 경우, 아래에서 전체 패밀리를 다운로드할 수 있습니다:

- **공식 페이지**: https://fonts.google.com/noto/specimen/Noto+Sans+KR
- **전체 패밀리 (Sans + Serif)**: https://github.com/notofonts/noto-cjk/releases

## 검증

본문 PDF 폰트 임베드 상태:

```
$ pdffonts body_256p.pdf
name                                 type              encoding         emb sub uni
------------------------------------ ----------------- ---------------- --- --- ---
WWZSWH+Noto-Serif-CJK-KR-Ultra-Light CID Type 0C (OT)  Identity-H       yes yes yes
WVXCWR+Noto-Serif-CJK-KR-Semi-Bold   CID Type 0C (OT)  Identity-H       yes yes yes
MMNILT+Noto-Sans-CJK-KR-Heavy        CID Type 0C (OT)  Identity-H       yes yes yes
SXAUFQ+Noto-Sans-CJK-KR-Bold         CID Type 0C (OT)  Identity-H       yes yes yes
TMDGZK+Noto-Serif-CJK-KR             CID Type 0C (OT)  Identity-H       yes yes yes
DSVEWC+Noto-Sans-CJK-KR              CID Type 0C (OT)  Identity-H       yes yes yes
UZGYGC+Noto-Serif-CJK-KR-Bold        CID Type 0C (OT)  Identity-H       yes yes yes
UAVOVU+Noto-Sans-CJK-KR-Oblique      CID Type 0C (OT)  Identity-H       yes yes yes
```

→ 모든 폰트가 `emb yes / sub yes` (임베드 + 서브셋 완료)

문서 버전: v1.4 · 2026-05-20
