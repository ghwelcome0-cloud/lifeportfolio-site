#!/usr/bin/env python3
"""
PR #17 — JSON-LD Structured Data Injector
==========================================
공개 페이지 7개에 schema.org JSON-LD를 주입합니다.

- Organization : 모든 공개 페이지 (사이트 전역 정체성)
- WebSite      : index, blog (사이트 검색 박스 후보)
- Product      : index, product (가격: KRW 9,900 + USD 8.99 이중 통화)
- FAQPage      : index, product (8개 핵심 Q&A)
- BreadcrumbList: product, login, signup, privacy, terms, blog

기존 PR#15 SEO 블록 다음에 PR#17 JSON-LD 블록을 삽입하며,
이미 PR#17 블록이 있으면 갱신(idempotent)합니다.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://lifeportfolio.co.kr"

# ─────────────────────── 공통 스키마 빌더 ───────────────────────

def organization() -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": f"{BASE}/#organization",
        "name": "인생포트폴리오",
        "alternateName": ["Life Portfolio", "LifePortfolio"],
        "url": BASE + "/",
        "logo": {
            "@type": "ImageObject",
            "url": f"{BASE}/assets/icon-512.png",
            "width": 512,
            "height": 512
        },
        "image": f"{BASE}/assets/og/og-default-ko.png",
        "description": (
            "76문항 15분 진단으로 사명·비전·강점을 발견하고 첫 행동까지 잇는 "
            "Only One 인생 설계도. 결제 즉시 자동 발급."
        ),
        "slogan": "당신 안에 이미 답이 있습니다 — 발견하고, 살아내고, 남기는 한 권의 인생 설계도",
        "areaServed": ["KR", "US", "Worldwide"],
        "knowsLanguage": ["ko", "en"]
    }

def website() -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": f"{BASE}/#website",
        "url": BASE + "/",
        "name": "인생포트폴리오 / Life Portfolio",
        "inLanguage": ["ko-KR", "en-US"],
        "publisher": {"@id": f"{BASE}/#organization"},
        "description": (
            "발견하고, 살아내고, 남기는 한 권의 인생 설계도. "
            "76문항 15분 진단으로 만든 Only One 리포트와 3주 실행 프로그램."
        )
    }

def product_schema() -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": f"{BASE}/product.html#product",
        "name": "인생포트폴리오 Only One 리포트",
        "alternateName": "Life Portfolio Only One Report",
        "sku": "LP-ONLYONE-001",
        "brand": {"@id": f"{BASE}/#organization"},
        "category": "자기경영 진단 / Self-Management Assessment",
        "image": [
            f"{BASE}/assets/og/og-default-ko.png",
            f"{BASE}/assets/og/og-default-en.png"
        ],
        "description": (
            "76문항 15분 진단을 기반으로 사명·비전·강점·첫 행동·3주 루틴을 한 권으로 "
            "정리해 결제 즉시 자동 발급하는 Only One 인생 설계도. "
            "유형 분류가 아닌 약 10^53 가지 조합의 개인 맞춤 리포트."
        ),
        "audience": {
            "@type": "Audience",
            "audienceType": "20–60대 자기 방향을 찾는 전 연령"
        },
        "offers": [
            {
                "@type": "Offer",
                "name": "한국어 결제 (국내)",
                "url": f"{BASE}/product.html?lang=ko",
                "priceCurrency": "KRW",
                "price": "9900",
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition",
                "areaServed": "KR",
                "deliveryLeadTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 0, "maxValue": 1, "unitCode": "MIN"
                },
                "seller": {"@id": f"{BASE}/#organization"}
            },
            {
                "@type": "Offer",
                "name": "English Checkout (Global)",
                "url": f"{BASE}/product.html?lang=en",
                "priceCurrency": "USD",
                "price": "8.99",
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition",
                "areaServed": "Worldwide",
                "deliveryLeadTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 0, "maxValue": 1, "unitCode": "MIN"
                },
                "seller": {"@id": f"{BASE}/#organization"}
            }
        ]
    }

def faq_schema() -> dict:
    qa = [
        ("리포트는 언제 받을 수 있나요?",
         "결제와 76문항 진단 완료 즉시 자동 생성됩니다. 별도의 대기 시간이 없으며, 결제 후 평균 1분 이내에 마이페이지에서 PDF로 받아볼 수 있습니다."),
        ("76문항을 푸는 데 얼마나 걸리나요?",
         "평균 12–15분이 소요됩니다. 중간 저장이 가능해 한 번에 끝내지 않아도 됩니다."),
        ("가격은 얼마이며, 결제 수단은 무엇인가요?",
         "국내는 9,900원(신용카드·카카오페이 등 페이플 결제), 해외는 $8.99(PayPal Live)입니다. 세금 포함 단일 가격이며 추가 비용은 없습니다."),
        ("MBTI나 에니어그램 같은 유형 검사인가요?",
         "아닙니다. 16개·9개 유형으로 분류하지 않고, 76문항 응답 조합(약 10^53가지)을 바탕으로 당신만의 사명·비전·강점·첫 행동을 한 권으로 정리합니다."),
        ("환불이 되나요?",
         "콘텐츠 특성상 리포트 발급 전에는 청약철회가 가능합니다. 발급 후에는 전자상거래법 17조 2항 5호에 따라 청약철회가 제한될 수 있으며, 자세한 내용은 이용약관에 명시되어 있습니다."),
        ("해외에서도 구매할 수 있나요?",
         "네. PayPal로 전 세계 결제가 가능하며, 영문 리포트(EN 버전)도 함께 제공됩니다. 결제 통화는 USD 8.99입니다."),
        ("리포트 외에 무엇이 더 제공되나요?",
         "리포트 기반의 3주(21일)·3개월·1년 실행 프로그램이 자동 생성되어 마이페이지에서 바로 시작할 수 있습니다."),
        ("내 응답 데이터가 AI 학습에 사용되나요?",
         "사용되지 않습니다. 응답·리포트는 본인 식별 영역에 분리 저장되며, AI 학습이나 외부 공유 목적으로 활용하지 않습니다.")
    ]
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": f"{BASE}/#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a}
            } for q, a in qa
        ]
    }

def breadcrumb(items: list[tuple[str, str]]) -> dict:
    """items: [(name, url), ...] — 홈은 자동 추가하지 않으니 호출 측이 포함"""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": name,
                "item": url
            } for i, (name, url) in enumerate(items)
        ]
    }

# ─────────────────────── 페이지별 정책 ───────────────────────

def schemas_for(page: str) -> list[dict]:
    """페이지별 JSON-LD 객체 리스트 반환"""
    org = organization()
    web = website()

    if page == "index.html":
        return [org, web, product_schema(), faq_schema()]

    if page == "product.html":
        return [
            org,
            product_schema(),
            faq_schema(),
            breadcrumb([
                ("홈", f"{BASE}/"),
                ("결제", f"{BASE}/product.html")
            ])
        ]

    if page == "login.html":
        return [org, breadcrumb([
            ("홈", f"{BASE}/"),
            ("로그인", f"{BASE}/login.html")
        ])]

    if page == "signup.html":
        return [org, breadcrumb([
            ("홈", f"{BASE}/"),
            ("회원가입", f"{BASE}/signup.html")
        ])]

    if page == "privacy.html":
        return [org, breadcrumb([
            ("홈", f"{BASE}/"),
            ("개인정보처리방침", f"{BASE}/privacy.html")
        ])]

    if page == "terms.html":
        return [org, breadcrumb([
            ("홈", f"{BASE}/"),
            ("이용약관", f"{BASE}/terms.html")
        ])]

    if page == "blog/index.html":
        return [
            org,
            {
                "@context": "https://schema.org",
                "@type": "Blog",
                "@id": f"{BASE}/blog/#blog",
                "url": f"{BASE}/blog/",
                "name": "Insights · 인생포트폴리오 블로그",
                "description": (
                    "발견하고, 살아내고, 남기는 한 권의 인생 설계도. "
                    "자기경영 인사이트와 Only One 리포트 활용 가이드."
                ),
                "inLanguage": ["ko-KR", "en-US"],
                "publisher": {"@id": f"{BASE}/#organization"}
            },
            breadcrumb([
                ("홈", f"{BASE}/"),
                ("블로그", f"{BASE}/blog/")
            ])
        ]

    return [org]

# ─────────────────────── 주입 로직 ───────────────────────

START = "<!-- ===== PR#17 JSON-LD (start) ===== -->"
END   = "<!-- ===== PR#17 JSON-LD (end) ===== -->"
ANCHOR = "<!-- ===== PR#15 SEO / Social META (end) ===== -->"

def render_block(schemas: list[dict]) -> str:
    parts = [START]
    for s in schemas:
        body = json.dumps(s, ensure_ascii=False, indent=2)
        parts.append(f'  <script type="application/ld+json">\n{body}\n  </script>')
    parts.append("  " + END)
    return "\n  ".join(parts) if False else "\n".join(parts)

def inject(page: str) -> str:
    fp = ROOT / page
    src = fp.read_text(encoding="utf-8")
    schemas = schemas_for(page)
    block = render_block(schemas)

    # 1) 이미 PR#17 블록이 있으면 교체
    pat = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    if pat.search(src):
        new_src = pat.sub(block, src)
        action = "updated"
    else:
        # 2) 없으면 PR#15 END 마커 직후에 삽입
        if ANCHOR not in src:
            return f"SKIP {page} (anchor not found)"
        new_src = src.replace(ANCHOR, ANCHOR + "\n  " + block, 1)
        action = "inserted"

    if new_src != src:
        fp.write_text(new_src, encoding="utf-8")
    n_scripts = len(schemas)
    return f"{action:>8s} {page:<22s} ({n_scripts} schemas)"

PAGES = [
    "index.html",
    "product.html",
    "login.html",
    "signup.html",
    "privacy.html",
    "terms.html",
    "blog/index.html",
]

if __name__ == "__main__":
    print(f"PR #17 — JSON-LD injector  (root={ROOT})")
    print("-" * 60)
    for p in PAGES:
        print(inject(p))
    print("-" * 60)
    print(f"Done — {len(PAGES)} pages processed.")
