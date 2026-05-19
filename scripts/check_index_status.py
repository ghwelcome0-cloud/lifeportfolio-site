#!/usr/bin/env python3
"""
인생포트폴리오 사이트맵 색인 상태 자동 점검 스크립트
====================================================

매일 한국시간 오전 9시(UTC 00:00)에 GitHub Actions에서 실행됩니다.

기능:
1. sitemap.xml에서 모든 URL을 가져온다
2. 각 URL이 Google에 색인되어 있는지 'site:URL' 검색으로 확인한다
3. 이전 상태(.github/index-state.json)와 비교
4. 다음 3가지 조건 중 하나라도 해당되면 GitHub Issue를 생성한다:
   (a) 새로 색인된 URL이 1개 이상 있음 (좋은 소식)
   (b) 7일 이상 미색인된 URL이 1개 이상 있음 (경고)
   (c) 매주 월요일은 주간 요약을 무조건 발행

환경 변수:
- GITHUB_TOKEN: Issue 생성용 (Actions에서 자동 주입)
- GITHUB_REPOSITORY: owner/repo 형식 (Actions에서 자동 주입)

리포트는 모두 한국어로 출력합니다.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

# -----------------------------------------------------------------------------
# 설정
# -----------------------------------------------------------------------------
SITEMAP_URL = "https://lifeportfolio.co.kr/sitemap.xml"
STATE_FILE = Path(".github/index-state.json")
KST = timezone(timedelta(hours=9))

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Google 'site:' 검색 → 결과 0건이면 미색인
GOOGLE_SEARCH = "https://www.google.com/search?q={q}&hl=ko"

# 한 요청당 sleep (Google rate limit 방지)
REQUEST_INTERVAL_SEC = 4

# 7일 이상 미색인된 URL을 경고 대상으로 분류
STALE_DAYS_THRESHOLD = 7


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def now_kst_iso() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def now_kst_date() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def http_get(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            with STATE_FILE.open(encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ state 파일 읽기 실패, 새로 시작: {e}", file=sys.stderr)
    return {"last_run": None, "urls": {}}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with STATE_FILE.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)


# -----------------------------------------------------------------------------
# Step 1: sitemap 가져오기
# -----------------------------------------------------------------------------
def fetch_sitemap_urls() -> list[str]:
    print(f"📥 사이트맵 다운로드: {SITEMAP_URL}")
    xml_text = http_get(SITEMAP_URL)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.fromstring(xml_text)
    urls = [el.text.strip() for el in root.findall("sm:url/sm:loc", ns) if el.text]
    print(f"   ✅ {len(urls)}개 URL 확보")
    return sorted(set(urls))


# -----------------------------------------------------------------------------
# Step 2: Google site: 검색으로 색인 여부 확인
# -----------------------------------------------------------------------------
def is_indexed_by_google(url: str) -> tuple[bool, str]:
    """
    Returns (indexed: bool, status: 'indexed'|'not_indexed'|'unknown')
    """
    query = f"site:{url}"
    search_url = GOOGLE_SEARCH.format(q=urllib.parse.quote(query))
    try:
        html = http_get(search_url, timeout=15)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"   ⏳ 429 rate-limit — 30초 대기 후 1회 재시도")
            time.sleep(30)
            try:
                html = http_get(search_url, timeout=15)
            except Exception as e2:
                return False, "unknown"
        else:
            return False, "unknown"
    except Exception:
        return False, "unknown"

    # "검색결과가 없습니다" 또는 "did not match any documents" 패턴
    not_found_signals = [
        "일치하는 검색결과가 없습니다",
        "검색결과가 없",
        "did not match any documents",
        "No results found",
    ]
    for sig in not_found_signals:
        if sig in html:
            return False, "not_indexed"

    # 색인됐다는 강한 신호: URL 자체가 결과에 등장
    domain = re.sub(r"^https?://", "", url).rstrip("/")
    if domain in html:
        return True, "indexed"

    # 기본적으로 결과를 받았으면 색인된 것으로 본다(보수적으로)
    return True, "indexed"


# -----------------------------------------------------------------------------
# Step 3: 상태 비교 및 분류
# -----------------------------------------------------------------------------
def classify(urls: list[str], prev_state: dict) -> dict:
    """
    각 URL의 현재 색인 여부를 확인하고, 이전 상태와 비교해서 분류.
    """
    today = now_kst_date()
    prev_urls = prev_state.get("urls", {})

    results = {
        "indexed": [],          # 현재 색인됨
        "not_indexed": [],      # 현재 미색인
        "unknown": [],          # 확인 실패
        "newly_indexed": [],    # 이번에 새로 색인됨 (이전: 미색인 / 신규)
        "stale": [],            # 7일 이상 미색인 상태인 URL
        "url_state": {},        # 저장용 새 상태
    }

    for i, url in enumerate(urls, 1):
        print(f"  [{i}/{len(urls)}] 확인 중: {url}")
        indexed, status = is_indexed_by_google(url)
        prev = prev_urls.get(url, {})

        if status == "unknown":
            results["unknown"].append(url)
            # 이전 상태 유지
            results["url_state"][url] = prev or {
                "status": "unknown",
                "first_seen": today,
                "first_not_indexed": today,
                "last_checked": today,
            }
        elif indexed:
            results["indexed"].append(url)
            # 이전에 미색인이었거나 신규였다면 → newly_indexed
            if prev.get("status") != "indexed":
                results["newly_indexed"].append(url)
            results["url_state"][url] = {
                "status": "indexed",
                "first_seen": prev.get("first_seen", today),
                "first_not_indexed": prev.get("first_not_indexed", today),
                "last_indexed": today,
                "last_checked": today,
            }
        else:
            results["not_indexed"].append(url)
            first_not_indexed = prev.get("first_not_indexed", today)
            # stale 판정
            try:
                d0 = datetime.strptime(first_not_indexed, "%Y-%m-%d").date()
                age = (datetime.now(KST).date() - d0).days
            except Exception:
                age = 0
            if age >= STALE_DAYS_THRESHOLD:
                results["stale"].append((url, age))
            results["url_state"][url] = {
                "status": "not_indexed",
                "first_seen": prev.get("first_seen", today),
                "first_not_indexed": first_not_indexed,
                "last_checked": today,
                "days_unindexed": age,
            }

        if i < len(urls):
            time.sleep(REQUEST_INTERVAL_SEC)

    return results


# -----------------------------------------------------------------------------
# Step 4: 리포트 작성 (한국어)
# -----------------------------------------------------------------------------
def build_report(results: dict, urls_total: int, is_weekly: bool) -> tuple[str, str]:
    """Returns (issue_title, issue_body) — both Korean."""
    indexed = results["indexed"]
    not_indexed = results["not_indexed"]
    unknown = results["unknown"]
    newly = results["newly_indexed"]
    stale = results["stale"]

    indexed_rate = (len(indexed) / urls_total * 100) if urls_total else 0

    # 제목
    flags = []
    if newly:
        flags.append(f"🎉 새 색인 {len(newly)}개")
    if stale:
        flags.append(f"⚠️ 7일+ 미색인 {len(stale)}개")
    if is_weekly and not flags:
        flags.append("📊 주간 요약")
    if not flags:
        flags.append("📊 일일 점검")
    title = f"[색인 점검 {now_kst_date()}] " + " · ".join(flags)

    # 본문
    lines = []
    lines.append(f"## 📅 점검 일시")
    lines.append(f"{now_kst_iso()}")
    lines.append("")
    lines.append(f"## 📊 요약")
    lines.append(f"- 전체 URL: **{urls_total}개**")
    lines.append(f"- 색인됨: **{len(indexed)}개** ({indexed_rate:.1f}%)")
    lines.append(f"- 미색인: **{len(not_indexed)}개**")
    if unknown:
        lines.append(f"- 확인 실패: {len(unknown)}개 (다음 점검에서 재시도)")
    lines.append("")

    if newly:
        lines.append(f"## 🎉 새로 색인된 URL ({len(newly)}개)")
        for u in newly:
            lines.append(f"- ✅ {u}")
        lines.append("")
        lines.append("> Google이 새 페이지를 찾아 색인을 완료했습니다. 검색 노출이 시작됩니다.")
        lines.append("")

    if stale:
        lines.append(f"## ⚠️ 7일 이상 미색인 URL ({len(stale)}개)")
        for u, age in sorted(stale, key=lambda x: -x[1]):
            lines.append(f"- ❗ {u} ({age}일째 미색인)")
        lines.append("")
        lines.append("**조치 권장**:")
        lines.append("1. Google Search Console → URL 검사 → 색인 생성 요청 (수동)")
        lines.append("2. 페이지 콘텐츠가 충분한지 확인 (최소 300자 이상 권장)")
        lines.append("3. 내부 링크가 다른 페이지에서 걸려 있는지 확인")
        lines.append("")

    if not_indexed and not stale:
        lines.append(f"## ⏳ 미색인 URL ({len(not_indexed)}개, 아직 7일 미만)")
        for u in not_indexed[:10]:
            lines.append(f"- {u}")
        if len(not_indexed) > 10:
            lines.append(f"- … 외 {len(not_indexed) - 10}개")
        lines.append("")
        lines.append("> 신규 페이지는 보통 3~14일 안에 색인됩니다. 7일을 넘기면 알림드립니다.")
        lines.append("")

    if is_weekly:
        lines.append("## 📈 주간 트렌드")
        lines.append(f"- 이번 주 색인율: **{indexed_rate:.1f}%**")
        lines.append(f"- 미색인 URL 추이는 다음 주 월요일 리포트에서 비교 가능합니다.")
        lines.append("")

    # 색인된 URL 전체 목록 (접힘)
    if indexed:
        lines.append("<details>")
        lines.append(f"<summary>✅ 색인된 URL 전체 보기 ({len(indexed)}개)</summary>")
        lines.append("")
        for u in indexed:
            lines.append(f"- {u}")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    lines.append("---")
    lines.append("*🤖 이 Issue는 GitHub Actions가 매일 한국시간 오전 9시에 자동으로 점검·생성합니다.*")
    lines.append("*워크플로 파일: `.github/workflows/sitemap-index-check.yml`*")
    lines.append("*점검 스크립트: `scripts/check_index_status.py`*")

    return title, "\n".join(lines)


# -----------------------------------------------------------------------------
# Step 5: GitHub Issue 생성
# -----------------------------------------------------------------------------
def create_issue(title: str, body: str) -> bool:
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not (token and repo):
        print("⚠️ GITHUB_TOKEN / GITHUB_REPOSITORY 미설정 — Issue 생성 건너뜀")
        return False

    url = f"https://api.github.com/repos/{repo}/issues"
    payload = json.dumps({
        "title": title,
        "body": body,
        "labels": ["seo", "index-monitor", "automated"],
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            print(f"✅ Issue 생성됨: #{data.get('number')} {data.get('html_url')}")
            return True
    except Exception as e:
        print(f"❌ Issue 생성 실패: {e}", file=sys.stderr)
        return False


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main() -> int:
    print(f"🚀 인생포트폴리오 색인 점검 시작 — {now_kst_iso()}")
    print()

    # 1. sitemap
    try:
        urls = fetch_sitemap_urls()
    except Exception as e:
        print(f"❌ 사이트맵 가져오기 실패: {e}", file=sys.stderr)
        return 1
    print()

    # 2. 이전 상태 로드
    prev_state = load_state()

    # 3. 색인 여부 확인
    print(f"🔍 Google 색인 여부 확인 시작 (요청 간격 {REQUEST_INTERVAL_SEC}초)")
    results = classify(urls, prev_state)
    print()

    # 4. 결과 요약
    print(f"📊 결과:")
    print(f"   - 색인됨: {len(results['indexed'])}개")
    print(f"   - 미색인: {len(results['not_indexed'])}개")
    print(f"   - 확인 실패: {len(results['unknown'])}개")
    print(f"   - 새로 색인됨: {len(results['newly_indexed'])}개")
    print(f"   - 7일+ 미색인 (stale): {len(results['stale'])}개")
    print()

    # 5. Issue 발행 조건 판정
    today = datetime.now(KST)
    is_monday = today.weekday() == 0  # 0=월요일
    should_post = bool(
        results["newly_indexed"]  # 새 색인 알림
        or results["stale"]        # 미색인 경고
        or is_monday               # 매주 월요일 주간 요약
    )

    if should_post:
        title, body = build_report(results, len(urls), is_weekly=is_monday)
        print(f"📝 Issue 발행 조건 충족 — 생성 시도")
        print(f"   제목: {title}")
        create_issue(title, body)
    else:
        print("✅ 발행 조건 미충족 (새 색인 0, stale 0, 비-월요일) — Issue 생성 건너뜀")

    # 6. 상태 저장
    new_state = {
        "last_run": today.isoformat(),
        "urls": results["url_state"],
    }
    save_state(new_state)
    print(f"💾 상태 저장: {STATE_FILE}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
