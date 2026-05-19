#!/usr/bin/env python3
"""SEO 최종 헬스체크 + 깨진 링크 점검 (옵션 B 통합 스크립트)"""
import re, os, sys, json, glob, urllib.request, urllib.error, ssl, socket
from xml.etree import ElementTree as ET
from collections import defaultdict
from urllib.parse import urljoin, urlparse

BASE = "https://lifeportfolio.co.kr"
ROOT = "/home/user/webapp"
TIMEOUT = 12

report = {
    "robots": {}, "sitemap": {}, "canonical": [], "jsonld": [],
    "hreflang": [], "html_residue": [], "live_urls": [],
    "internal_links": [], "external_links": [], "issues": [], "summary": {}
}

def issue(level, area, msg):
    report["issues"].append({"level": level, "area": area, "msg": msg})

# ─────────────────────────────────────────────
# 1) robots.txt 검증
# ─────────────────────────────────────────────
print("▶ [1/8] robots.txt 검증...")
with open(f"{ROOT}/robots.txt") as f:
    robots = f.read()
report["robots"] = {
    "has_sitemap": "Sitemap:" in robots,
    "sitemap_url": re.search(r"Sitemap:\s*(\S+)", robots).group(1) if "Sitemap:" in robots else None,
    "allow_ai_bots": "GPTBot" in robots and "ClaudeBot" in robots and "PerplexityBot" in robots,
    "blocks_scrapers": "SemrushBot" in robots and "AhrefsBot" in robots,
    "allows_naver": "NaverBot" in robots or "Yeti" in robots,
    "allows_daum": "Daum" in robots,
}
if not report["robots"]["has_sitemap"]:
    issue("CRIT", "robots", "Sitemap 선언 누락")
if not report["robots"]["allows_naver"]:
    issue("HIGH", "robots", "Naver/Yeti 허용 누락")

# ─────────────────────────────────────────────
# 2) sitemap.xml 파싱
# ─────────────────────────────────────────────
print("▶ [2/8] sitemap.xml 파싱...")
tree = ET.parse(f"{ROOT}/sitemap.xml")
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "xh": "http://www.w3.org/1999/xhtml"}
urls = tree.getroot().findall("sm:url", ns)
sitemap_urls = []
for u in urls:
    loc = u.find("sm:loc", ns).text.strip()
    lastmod = u.find("sm:lastmod", ns)
    hreflangs = [h.get("hreflang") for h in u.findall("xh:link", ns)]
    sitemap_urls.append({
        "loc": loc,
        "lastmod": lastmod.text if lastmod is not None else None,
        "hreflang": hreflangs
    })
report["sitemap"] = {
    "url_count": len(sitemap_urls),
    "with_html_ext": sum(1 for u in sitemap_urls if u["loc"].endswith(".html")),
    "with_hreflang": sum(1 for u in sitemap_urls if u["hreflang"]),
    "duplicate_locs": len(sitemap_urls) - len(set(u["loc"] for u in sitemap_urls)),
}
if report["sitemap"]["with_html_ext"] > 0:
    issue("HIGH", "sitemap", f"sitemap에 .html 확장자 URL {report['sitemap']['with_html_ext']}개 잔존")
if report["sitemap"]["duplicate_locs"] > 0:
    issue("CRIT", "sitemap", f"sitemap에 중복 URL {report['sitemap']['duplicate_locs']}개")

# ─────────────────────────────────────────────
# 3) HTML 파일 스캔 — canonical / hreflang / robots / .html 잔재
# ─────────────────────────────────────────────
print("▶ [3/8] HTML 파일 canonical/hreflang/robots 스캔...")
html_files = sorted(glob.glob(f"{ROOT}/**/*.html", recursive=True))
# 제외: node_modules, .git, functions
html_files = [f for f in html_files if "/node_modules/" not in f and "/.git/" not in f and "/functions/" not in f]

canonical_data = []
hreflang_data = []
html_residue = []  # .html 확장자가 남은 내부 링크

for path in html_files:
    rel = path.replace(ROOT + "/", "")
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        issue("WARN", "html-read", f"{rel}: {e}")
        continue
    
    # canonical
    can = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']', content, re.I)
    canon_val = can.group(1) if can else None
    
    # hreflang
    hrefs = re.findall(r'<link\s+rel=["\']alternate["\']\s+hreflang=["\']([^"\']+)["\']\s+href=["\']([^"\']+)["\']', content, re.I)
    
    # meta robots
    robots_meta = re.search(r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']', content, re.I)
    
    canonical_data.append({
        "file": rel,
        "canonical": canon_val,
        "robots": robots_meta.group(1) if robots_meta else None,
        "hreflang_count": len(hrefs),
    })
    
    # .html 잔재 (href/src/action 등에서 내부 링크가 .html로 끝나는 경우 탐색)
    # 단, 외부 도메인 / 인라인 코드블록 / 차단된 페이지(/mypage.html 등)는 화이트리스트
    blocked = {"mypage.html","report.html","program.html","success.html","suvey.html",
               "payment-success.html","payment-fail.html","auth-fail.html",
               "report-loading.html","program-loading.html","utm-builder.html",
               "lead.html","b2b.html","auth-debug.html"}
    # href|src|action="...something.html"
    for m in re.finditer(r'(?:href|src|action)=["\']([^"\'#]+\.html)(?:#[^"\']*)?["\']', content, re.I):
        url = m.group(1)
        # 외부 URL 제외
        if re.match(r'https?://(?!(www\.)?lifeportfolio\.co\.kr)', url):
            continue
        # 절대/상대 정규화해서 파일명만 추출
        fname = url.rstrip("/").split("/")[-1]
        if fname in blocked:
            continue
        # 차단 페이지는 패스, 그 외엔 잔재로 기록
        html_residue.append({"file": rel, "found_url": url})

report["canonical"] = canonical_data
report["html_residue"] = html_residue

# canonical 일관성 분석
canon_with_html = [c for c in canonical_data if c["canonical"] and c["canonical"].endswith(".html")]
if canon_with_html:
    issue("HIGH", "canonical", f"canonical에 .html 잔존 {len(canon_with_html)}개")

if html_residue:
    issue("HIGH", "links", f".html 확장자 내부 링크 잔재 {len(html_residue)}건")

# ─────────────────────────────────────────────
# 4) JSON-LD 구조화 데이터 검증
# ─────────────────────────────────────────────
print("▶ [4/8] JSON-LD 구조화 데이터 검증...")
jsonld_data = []
for path in html_files[:50]:  # 대표 50개만
    rel = path.replace(ROOT + "/", "")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    blocks = re.findall(r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                         content, re.S | re.I)
    valid, invalid, types = 0, 0, []
    for b in blocks:
        try:
            data = json.loads(b.strip())
            valid += 1
            if isinstance(data, dict):
                types.append(data.get("@type", "?"))
            elif isinstance(data, list):
                types.extend([d.get("@type", "?") for d in data if isinstance(d, dict)])
        except json.JSONDecodeError as e:
            invalid += 1
            issue("HIGH", "jsonld", f"{rel}: JSON-LD 파싱 실패 — {e}")
    if blocks:
        jsonld_data.append({"file": rel, "valid": valid, "invalid": invalid, "types": types})
report["jsonld"] = jsonld_data

# ─────────────────────────────────────────────
# 5) Live URL 200 체크 (sitemap에서 샘플링)
# ─────────────────────────────────────────────
print("▶ [5/8] 라이브 URL 응답 체크 (sitemap 전체)...")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
live_results = []
status_count = defaultdict(int)

def check_url(url, timeout=TIMEOUT):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={
            "User-Agent": "Mozilla/5.0 (LifePortfolio-SEO-HealthCheck/1.0)"
        })
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, r.url
    except urllib.error.HTTPError as e:
        return e.code, url
    except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
        return None, str(e)

for entry in sitemap_urls:
    url = entry["loc"]
    code, final = check_url(url)
    status_count[code] += 1
    live_results.append({"url": url, "status": code, "final": final if final != url else None})
    if code != 200:
        issue("CRIT" if code is None or code >= 400 else "WARN", "live", f"{url} → {code}")

report["live_urls"] = live_results
report["summary"]["status_distribution"] = dict(status_count)

# ─────────────────────────────────────────────
# 6) hreflang 양방향 일관성 검증
# ─────────────────────────────────────────────
print("▶ [6/8] hreflang 양방향 일관성 검증...")
hreflang_pairs = defaultdict(dict)
for entry in sitemap_urls:
    if entry["hreflang"]:
        # sitemap에서 hreflang이 선언된 URL은 sitemap의 xhtml:link로 읽어야 하지만
        # 여기서는 사이트맵 URL과 hreflang 리스트만 카운트
        pass

# HTML 파일에서 hreflang 양방향 매칭
hreflang_files = {}
for path in html_files:
    rel = path.replace(ROOT + "/", "")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    hrefs = re.findall(r'<link\s+rel=["\']alternate["\']\s+hreflang=["\']([^"\']+)["\']\s+href=["\']([^"\']+)["\']', content, re.I)
    if hrefs:
        hreflang_files[rel] = dict(hrefs)

# self-reference 체크 (각 페이지가 자기 자신을 hreflang으로 가리키는지)
missing_self = []
for rel, langs in hreflang_files.items():
    # 자기 자신의 canonical과 hreflang 중 하나가 일치해야 함
    canon = next((c["canonical"] for c in canonical_data if c["file"] == rel), None)
    if canon:
        urls_listed = set(langs.values())
        if canon not in urls_listed:
            missing_self.append({"file": rel, "canonical": canon, "hreflang_urls": list(urls_listed)})

report["hreflang"] = {
    "pages_with_hreflang": len(hreflang_files),
    "self_reference_missing": missing_self[:20],  # 상위 20개만
    "total_self_ref_missing": len(missing_self),
}
if missing_self:
    issue("WARN", "hreflang", f"hreflang self-reference 누락 {len(missing_self)}개")

# ─────────────────────────────────────────────
# 7) 내부 링크 크롤링 (HTML 파일에서 추출 → 응답 체크 샘플링)
# ─────────────────────────────────────────────
print("▶ [7/8] 내부 링크 추출 & 응답 체크 (샘플링)...")
internal_set = set()
external_set = set()
for path in html_files:
    with open(path, encoding="utf-8") as f:
        content = f.read()
    for m in re.finditer(r'href=["\']([^"\'#]+)["\']', content):
        url = m.group(1).strip()
        if url.startswith("mailto:") or url.startswith("tel:") or url.startswith("javascript:"):
            continue
        if url.startswith("http"):
            host = urlparse(url).netloc
            if "lifeportfolio" in host:
                internal_set.add(url)
            else:
                external_set.add(url)
        elif url.startswith("/"):
            internal_set.add(BASE + url)
        # 상대경로는 복잡해서 패스 (canonical 검증이 대체)

# 내부 링크 중복 제거 + sitemap에 없는 URL만 추가 체크
sitemap_set = set(e["loc"] for e in sitemap_urls)
internal_extra = sorted(internal_set - sitemap_set)
print(f"   → sitemap 외 내부 링크 {len(internal_extra)}개 추가 체크")

# 너무 많으면 샘플링 (상위 30개)
sample = internal_extra[:30]
for url in sample:
    code, final = check_url(url)
    report["internal_links"].append({"url": url, "status": code})
    if code is None or (code != 200 and code != 301 and code != 302):
        issue("HIGH", "internal-link", f"{url} → {code}")

# 외부 링크 응답 체크 (샘플링 — 도메인별 1개씩)
print(f"   → 외부 도메인 응답 체크 (도메인별 1개씩 샘플링)...")
ext_by_domain = defaultdict(list)
for url in external_set:
    host = urlparse(url).netloc
    ext_by_domain[host].append(url)
ext_sample = [urls[0] for urls in ext_by_domain.values()]
for url in ext_sample:
    code, final = check_url(url, timeout=8)
    report["external_links"].append({"url": url, "status": code})
    if code is None or code >= 400:
        issue("WARN", "external-link", f"{url} → {code}")

# ─────────────────────────────────────────────
# 8) 요약
# ─────────────────────────────────────────────
print("▶ [8/8] 요약 생성...")
report["summary"]["html_file_count"] = len(html_files)
report["summary"]["sitemap_url_count"] = len(sitemap_urls)
report["summary"]["jsonld_blocks"] = sum(d["valid"] + d["invalid"] for d in jsonld_data)
report["summary"]["internal_links_unique"] = len(internal_set)
report["summary"]["external_domains"] = len(ext_by_domain)
report["summary"]["issues_by_level"] = {
    "CRIT": sum(1 for i in report["issues"] if i["level"]=="CRIT"),
    "HIGH": sum(1 for i in report["issues"] if i["level"]=="HIGH"),
    "WARN": sum(1 for i in report["issues"] if i["level"]=="WARN"),
}

# 저장
os.makedirs(f"{ROOT}/docs/seo", exist_ok=True)
with open(f"{ROOT}/docs/seo/healthcheck_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

# 콘솔 요약
print("\n" + "="*70)
print("📊 SEO 헬스체크 결과")
print("="*70)
print(f"HTML 파일       : {report['summary']['html_file_count']}개")
print(f"Sitemap URL     : {report['summary']['sitemap_url_count']}개")
print(f"JSON-LD 블록    : {report['summary']['jsonld_blocks']}개")
print(f"내부 링크 unique: {report['summary']['internal_links_unique']}개")
print(f"외부 도메인     : {report['summary']['external_domains']}개")
print(f"라이브 URL 분포 : {dict(status_count)}")
print()
print(f"🔴 CRIT 이슈   : {report['summary']['issues_by_level']['CRIT']}")
print(f"🟠 HIGH 이슈   : {report['summary']['issues_by_level']['HIGH']}")
print(f"🟡 WARN 이슈   : {report['summary']['issues_by_level']['WARN']}")
print()
if report["issues"]:
    print("─── 발견 이슈 (상위 30개) ───")
    for it in report["issues"][:30]:
        icon = {"CRIT":"🔴","HIGH":"🟠","WARN":"🟡"}.get(it["level"],"⚪")
        print(f"  {icon} [{it['area']}] {it['msg']}")
else:
    print("✅ 발견된 이슈 없음")
print()
print(f"📄 상세 리포트: docs/seo/healthcheck_report.json")
