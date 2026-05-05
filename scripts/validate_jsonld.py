#!/usr/bin/env python3
"""
PR #17 — JSON-LD Validator
==========================
주입된 JSON-LD 블록의 문법·필수 필드를 자동 점검합니다.

검증 항목:
1) <script type="application/ld+json"> 추출 → JSON 파싱 성공 여부
2) @context, @type 필수 필드 존재
3) 타입별 필수 필드:
   - Organization: name, url, logo
   - Product:      name, offers (그리고 각 Offer의 price, priceCurrency, availability)
   - FAQPage:      mainEntity (각 Question에 name, acceptedAnswer.text)
   - BreadcrumbList: itemListElement (각 ListItem에 position, name, item)
   - WebSite:      name, url
   - Blog:         name, url
4) Product.offers의 가격이 9900 KRW / 8.99 USD 와 일치하는지(이중 통화 확인)
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    "index.html", "product.html", "login.html", "signup.html",
    "privacy.html", "terms.html", "blog/index.html"
]

SCRIPT_RE = re.compile(
    r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
    re.DOTALL
)

REQUIRED_BY_TYPE = {
    "Organization": ["name", "url", "logo"],
    "WebSite":      ["name", "url"],
    "Product":      ["name", "offers"],
    "FAQPage":      ["mainEntity"],
    "BreadcrumbList": ["itemListElement"],
    "Blog":         ["name", "url"],
}

def check_offers(offers) -> list[str]:
    """Product.offers 가격 검증 — 9900 KRW + 8.99 USD"""
    errs = []
    if isinstance(offers, dict):
        offers = [offers]
    if not isinstance(offers, list):
        return ["offers must be Offer or [Offer]"]
    seen = set()
    for i, o in enumerate(offers):
        for k in ("price", "priceCurrency", "availability"):
            if k not in o:
                errs.append(f"offers[{i}].{k} missing")
        cur = o.get("priceCurrency")
        price = str(o.get("price"))
        seen.add((cur, price))
    expected = {("KRW", "9900"), ("USD", "8.99")}
    missing = expected - seen
    if missing:
        errs.append(f"expected offers {expected}, missing {missing}")
    return errs

def check_faq(items) -> list[str]:
    errs = []
    if not isinstance(items, list) or not items:
        return ["FAQPage.mainEntity must be non-empty list"]
    for i, q in enumerate(items):
        if q.get("@type") != "Question":
            errs.append(f"mainEntity[{i}].@type != Question")
        if not q.get("name"):
            errs.append(f"mainEntity[{i}].name missing")
        ans = q.get("acceptedAnswer", {})
        if ans.get("@type") != "Answer" or not ans.get("text"):
            errs.append(f"mainEntity[{i}].acceptedAnswer invalid")
    return errs

def check_breadcrumb(items) -> list[str]:
    errs = []
    if not isinstance(items, list) or not items:
        return ["BreadcrumbList.itemListElement must be non-empty list"]
    for i, it in enumerate(items):
        for k in ("position", "name", "item"):
            if k not in it:
                errs.append(f"itemListElement[{i}].{k} missing")
        if it.get("position") != i + 1:
            errs.append(f"itemListElement[{i}].position should be {i+1}, got {it.get('position')}")
    return errs

def validate_obj(obj: dict, where: str) -> list[str]:
    errs = []
    if obj.get("@context") not in ("https://schema.org", "http://schema.org"):
        errs.append(f"{where}: @context invalid → {obj.get('@context')}")
    t = obj.get("@type")
    if not t:
        errs.append(f"{where}: @type missing")
        return errs
    for f in REQUIRED_BY_TYPE.get(t, []):
        if f not in obj:
            errs.append(f"{where} ({t}): required field '{f}' missing")
    if t == "Product":
        errs += [f"{where} (Product): {e}" for e in check_offers(obj.get("offers"))]
    if t == "FAQPage":
        errs += [f"{where} (FAQPage): {e}" for e in check_faq(obj.get("mainEntity"))]
    if t == "BreadcrumbList":
        errs += [f"{where} (BreadcrumbList): {e}" for e in check_breadcrumb(obj.get("itemListElement"))]
    return errs

def validate_page(page: str) -> tuple[int, list[str], list[str]]:
    fp = ROOT / page
    src = fp.read_text(encoding="utf-8")
    blocks = SCRIPT_RE.findall(src)
    if not blocks:
        return 0, [], [f"{page}: no JSON-LD blocks found"]

    types_found = []
    errs = []
    for i, raw in enumerate(blocks):
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as e:
            errs.append(f"{page} block#{i}: JSON parse error → {e}")
            continue
        types_found.append(obj.get("@type", "?"))
        errs += validate_obj(obj, f"{page} block#{i}")
    return len(blocks), types_found, errs

if __name__ == "__main__":
    print(f"PR #17 — JSON-LD validator  (root={ROOT})")
    print("=" * 70)
    total_blocks = 0
    total_errs = 0
    for p in PAGES:
        n, types, errs = validate_page(p)
        total_blocks += n
        total_errs += len(errs)
        status = "OK " if not errs else "FAIL"
        print(f"[{status}] {p:<22s}  blocks={n}  types={types}")
        for e in errs:
            print(f"        ⚠️  {e}")
    print("=" * 70)
    print(f"Total: {len(PAGES)} pages, {total_blocks} JSON-LD blocks, {total_errs} errors")
    sys.exit(0 if total_errs == 0 else 1)
