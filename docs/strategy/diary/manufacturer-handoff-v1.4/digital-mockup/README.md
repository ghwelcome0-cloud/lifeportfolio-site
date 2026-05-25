# 📱 디지털 목업 — 오프라인 열람 가이드

## 개요
이 폴더는 **인쇄 PDF(`print-ready/body_256p.pdf`)와 1:1 동기화된 디지털 목업**입니다.
인쇄 전 화면으로 전체 구성을 확인하시려면 이 페이지를 사용해 주세요.

---

## 🚀 여는 방법

### 방법 1: 직접 열기 (가장 간단)
1. `index.html` 파일을 **더블클릭**
2. 기본 브라우저(Chrome / Edge / Safari / Firefox 등)에서 열립니다
3. 인터넷 연결 없이도 동작합니다

### 방법 2: 브라우저로 끌어다 놓기
1. 브라우저 창을 엽니다
2. `index.html` 파일을 브라우저 창에 **드래그 앤 드롭**

> ⚠️ **참고**: 로컬 파일 보안 정책에 따라 일부 브라우저에서는 폰트가 로컬 캐시 폰트로 대체될 수 있습니다.
> 정확한 폰트(Cormorant Garamond)는 `print-ready/fonts/CormorantGaramond.ttf` 임베드된 PDF에서 확인 가능합니다.

---

## 🔒 보안 게이트 — 비밀번호 입력

목업 첫 화면에 비밀번호 입력란이 나타납니다.

**비밀번호**:
```
dlstodvhxmvhffldh zjtmxja
```

> 💡 이 비밀번호는 한글 "인생포트폴리오 커스텀"을 영문 자판으로 입력한 것입니다.
> (한/영 전환 없이 그대로 타이핑하시면 됩니다)

- 비밀번호는 **SHA-256 해시 비교** 방식으로 저장되어 코드 내 평문이 없습니다
- 인증은 **브라우저 탭을 닫을 때까지만** 유지됩니다 (sessionStorage)
- 다음 접속 시 다시 입력해야 합니다

---

## 📄 구성

```
digital-mockup/
├── index.html          # 메인 목업 페이지 (256페이지 전체 구성)
├── css/
│   └── diary.css       # 스타일시트
└── js/
    ├── gate.js         # 보안 게이트 (비밀번호 인증)
    └── page-nav.js     # 페이지 네비게이션
```

---

## 🎨 디자인 사양 (v1.4.2 기준)

- **메인 컬러**: British Racing Green `#0A3D2A` (Pantone 357 C)
- **영문 타이포**: Cormorant Garamond (Variable Font, OFL)
- **사이즈**: A5 (148×210mm) + 3mm bleed
- **페이지**: 256p (16절판)
- **종이**: 70g 미색지 (본문)

---

## ✅ 인쇄 PDF와의 동기화

이 목업의 **모든 페이지·문구·레이아웃**은 `print-ready/body_256p.pdf`와 1:1 일치합니다.
PDF는 256페이지 정확, 18개 폰트(Cormorant 8 weight + Noto CJK + WenQuanYi fallback)
모두 임베드 검증 완료된 인쇄 직행 파일입니다.

---

## 📞 문의

- **담당자**: 김영식
- **연락처**: 010-5179-9206
- **이메일**: faise@lifeportfolio.co.kr
- **희망 납기일**: 약 30일 이내
