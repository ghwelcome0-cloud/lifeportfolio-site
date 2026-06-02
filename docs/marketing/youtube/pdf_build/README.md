# PDF 빌드 (외부 공유용)

마케팅 문서(60/61)를 브랜드 디자인 PDF로 변환하는 빌더.

## 사용법
```bash
cd docs/marketing/youtube/pdf_build
pip install playwright markdown pymdown-extensions
python3 -m playwright install chromium
sudo python3 -m playwright install-deps chromium   # 최초 1회 시스템 의존성
python3 build_pdf.py
```
산출물: `dist/*.pdf`

## 구성
- `build_pdf.py` — MD→HTML→PDF 변환. 표지 생성, 들여쓰기 표 보정, 페이지 끊김 방지(.block 그룹핑).
- `style.css` — 브랜드 스타일(네이비/그린/골드), 표·콜아웃·코드 break-inside avoid.
- `dist/` — 생성된 HTML/PDF.

## 페이지 끊김 방지 원칙
- 표/blockquote/pre: `break-inside: avoid`
- 제목+직후 콘텐츠: h3/h4 단위 `.block` 그룹핑 + `break-after: avoid`
- thead: `display: table-header-group` (페이지 넘김 시 헤더 반복)
