#!/usr/bin/env python3
"""
13개 영역 × 5개 sub-type 매핑표 + 13개 영역 대표 사례(리포트+프로그램) 자동 생성
- data/career-rules.json 기반
- 각 영역은 김영식님 PDF와 동일한 구조(7섹션 리포트, 7섹션 프로그램)로 생성
- 출력: docs/manual/golden/13DOMAIN_EXAMPLES.md
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = json.load(open(os.path.join(ROOT, 'data', 'career-rules.json'), encoding='utf-8'))

# 13개 영역
DOMAINS = [k for k in RULES['domainPools'].keys() if not k.startswith('$')]

# 각 영역별 대표 페르소나 — primaryDomain × subType × compass × 가상 응답자 이름
PERSONAS = {
    "정치":  {"name":"이정현", "subType":"policy",       "compassKw":"책임", "secondary":"법률",   "passion":"공공정책·민주주의·시민참여"},
    "경제":  {"name":"김영식", "subType":"business",     "compassKw":"원칙", "secondary":"종교",   "passion":"경제·금융·투자"},
    "사회":  {"name":"박서연", "subType":"practitioner", "compassKw":"사람", "secondary":"복지",   "passion":"공동체·관계·연결"},
    "문화":  {"name":"정도현", "subType":"media",        "compassKw":"의미", "secondary":"예술",   "passion":"문화·정체성·서사"},
    "교육":  {"name":"한지원", "subType":"practitioner", "compassKw":"성장", "secondary":"복지",   "passion":"학습·성장·아이"},
    "의료":  {"name":"강민수", "subType":"researcher",   "compassKw":"단단함","secondary":"복지",   "passion":"의학·생명·치유"},
    "복지":  {"name":"윤혜진", "subType":"policy",       "compassKw":"사람", "secondary":"사회",   "passion":"복지·돌봄·약자"},
    "환경":  {"name":"송태우", "subType":"researcher",   "compassKw":"결과", "secondary":"교육",   "passion":"기후·생태·지속가능"},
    "예술":  {"name":"임수아", "subType":"practitioner", "compassKw":"자기 호흡","secondary":"문화","passion":"예술·창작·표현"},
    "미디어":{"name":"오재훈", "subType":"media",        "compassKw":"의미", "secondary":"문화",   "passion":"미디어·콘텐츠·서사"},
    "스포츠":{"name":"신우빈", "subType":"practitioner", "compassKw":"몰입", "secondary":"교육",   "passion":"운동·체력·집중"},
    "법률":  {"name":"조성민", "subType":"policy",       "compassKw":"책임", "secondary":"정치",   "passion":"법·정의·구조"},
    "종교":  {"name":"문하연", "subType":"researcher",   "compassKw":"의미", "secondary":"문화",   "passion":"신학·영성·인간"}
}

# 톤키 매핑 (subType + compass 조합으로 단순화)
TONE_BY_SUB = {
    "practitioner":"steady_executor",
    "researcher":"reflective_analyst",
    "business":"principled_designer",
    "media":"warm_communicator",
    "policy":"public_steward"
}

SUBTYPE_KO = {
    "practitioner":"현장 실무·전문가",
    "researcher":"연구·이론·분석",
    "business":"사업·경영·창업",
    "media":"콘텐츠·저널·평론",
    "policy":"정책·행정·공공"
}

def get_pool(domain, subType):
    p = RULES['domainPools'].get(domain, {}).get(subType, {})
    careers = p.get('careers', [])
    edu = p.get('education', [])
    return careers, edu

def make_mapping_table():
    """13 × 5 = 65 매핑표 마크다운"""
    rows = []
    rows.append("| 영역 \\ sub-type | practitioner (현장) | researcher (연구) | business (사업) | media (미디어) | policy (정책) |")
    rows.append("|---|---|---|---|---|---|")
    for d in DOMAINS:
        cells = [f"**{d}**"]
        for s in ["practitioner","researcher","business","media","policy"]:
            careers, _ = get_pool(d, s)
            top = careers[0] if careers else "—"
            cells.append(top)
        rows.append("| " + " | ".join(cells) + " |")
    return "\n".join(rows)

def make_full_pool_table():
    """13 영역 전체 풀(직업+교육) 부록"""
    out = []
    for d in DOMAINS:
        out.append(f"### {d}")
        out.append("")
        for s in ["practitioner","researcher","business","media","policy"]:
            careers, edu = get_pool(d, s)
            out.append(f"**{s} ({SUBTYPE_KO[s]})**")
            out.append("- 직업: " + " · ".join(careers))
            out.append("- 교육: " + " · ".join(edu))
            out.append("")
    return "\n".join(out)

def make_persona_case(domain):
    """13개 영역 각각 대표 사례 — 리포트 7섹션 + 프로그램 7섹션 요약"""
    p = PERSONAS[domain]
    careers, edu = get_pool(domain, p['subType'])
    careers_x, edu_x = get_pool(p['secondary'], p['subType'])  # 융합 secondary
    tone = TONE_BY_SUB[p['subType']]
    name = p['name']
    primary = domain
    secondary = p['secondary']
    compass = p['compassKw']
    sub_ko = SUBTYPE_KO[p['subType']]
    passion = p['passion']

    # 리포트 7섹션
    out = []
    out.append(f"### 사례 {DOMAINS.index(domain)+1}. {primary} × {p['subType']} — {name}님")
    out.append("")
    out.append(f"- **derived 매핑**: primaryDomain=`{primary}` · secondaryDomain=`{secondary}` · subType=`{p['subType']}`({sub_ko}) · compassKw=`{compass}` · toneKey=`{tone}` · 열정=`{passion}`")
    out.append("")
    out.append(f"#### [리포트] 7섹션 합성")
    out.append("")
    out.append(f"1. **헤드라인** — `{compass} 중심의 {primary} {sub_ko} — {primary}의 자리에서 {compass}을 나침반 삼아 살아가는 한 사람`")
    out.append(f"2. **사명(Mission) 한 줄** — `{name}님의 사명은, {primary}과 {secondary}의 자리에서 {compass}을 잃지 않으며, 사람의 곁을 머물게 하면서 자기 색대로 깊어져 가는 한 사람으로 살아가는 것입니다.`")
    out.append(f"3. **비전(Vision) 한 줄** — `{name}님의 비전은, {primary}과 {secondary}의 자리에서 곁이 따뜻하면서도 자기 색대로 자라 가는 한 사람이자 자기 {compass}이 또렷한 사람으로 자리잡는 것입니다.`")
    out.append(f"4. **TOP3 강점**(예시) — 본질을 꿰뚫는 분석적 정직성 · 결과로 답하는 전략적 성취력 · 패턴에서 의미를 읽어내는 분석력")
    out.append(f"5. **추천 진로 3** — `{careers[0]}` · `{primary}·{secondary} 융합형 — {careers_x[0] if careers_x else careers[1] if len(careers)>1 else careers[0]}` · `{careers[2] if len(careers)>2 else careers[-1]}`")
    out.append(f"6. **추천 교육 3** — `{edu[0]}` · `{edu_x[0] if edu_x else edu[1] if len(edu)>1 else edu[0]}` · `{edu[-1]}`")
    out.append(f"7. **추천 확장 방향** — `{primary}을 본업, {secondary}을 부업·연구로` / `{primary}의 그림을 {secondary} 영역의 작은 실험으로 쪼개기` / `{primary}의 통찰을 {secondary} 콘텐츠로 변환 발신`")
    out.append("")
    # 프로그램 7섹션
    out.append(f"#### [프로그램] 7섹션 합성")
    out.append("")
    out.append(f"1. **헤드라인** — `{compass} 중심의 {sub_ko} 실행가 · {primary}의 자리에서 {compass}을 작품으로 증명하는 사람`")
    out.append(f"2. **사명·비전 한 줄** — `이 프로그램은 {name}님의 사명 — '{primary}의 자리에서 {compass}을 펼쳐 내는 한 사람' — 을 매일 한 호흡으로 옮깁니다.`")
    out.append(f"3. **3주 루틴** — Week1: 아이디어를 밖으로 꺼내기({compass} 단어 수집) / Week2: 프로토타입 빠르게 끝내기({primary} 초안 피드백) / Week3: 발행과 다음 비전 연결({secondary} 결로 회고)")
    out.append(f"4. **3개월 마일스톤** — `{compass} 단어 수집 주 3회` · `{primary} 발행 5건` · `3개월 결과 12건` · `관심 주제({passion}) 결과 1건 가시화`")
    out.append(f"5. **1년 로드맵** — `1년 뒤 {primary}과 {secondary}의 자리에서 '{compass}으로 자기 결을 지켜 내는 사람'으로 자리잡기` / 분기 외부 발행 1건+ / 동료·팬 5명+")
    out.append(f"6. **부스터 + 리스크** — 부스터: 강점 활용 캡처 루틴 · 보완 훈련 프로토타입 스프린트 · 핵심 전략 비전 카피 세션 / 리스크: 아이디어 과잉→이번 주 1개만 / 반응 약화→발행 자체를 성과로 / 새 시작 끌림→발행 전 보류")
    out.append(f"7. **마무리** — `이미 {name}님 안에 자리 잡은 사명이 세상이 맞닿을 작품으로 매일 이어지도록 빚는 구조입니다. 오늘의 {compass} 한 줄 메모부터 시작하면 충분합니다.`")
    out.append("")
    return "\n".join(out)

def main():
    out_dir = os.path.join(ROOT, 'docs', 'manual', 'golden')
    os.makedirs(out_dir, exist_ok=True)
    md = []
    md.append("# 13개 영역 × 5개 sub-type 매핑표 + 13개 영역 대표 사례\n")
    md.append("**생성일**: 2026-05-06 · **소스**: data/career-rules.json (v1.2) + 김영식 모범 사례 PDF 구조\n")
    md.append("\n## A. 65셀 매핑표 (13영역 × 5sub-type 대표 직업)\n")
    md.append(make_mapping_table())
    md.append("\n\n## B. 13개 영역 대표 사례 (리포트 7섹션 + 프로그램 7섹션)\n")
    for d in DOMAINS:
        md.append(make_persona_case(d))
    md.append("\n## C. 13개 영역 전체 풀 (직업·교육 부록)\n")
    md.append(make_full_pool_table())
    out_path = os.path.join(out_dir, '13DOMAIN_EXAMPLES.md')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(md))
    print(f"Generated: {out_path}")
    print(f"  - domains: {len(DOMAINS)}")
    print(f"  - personas: {len(PERSONAS)}")
    print(f"  - cells: {len(DOMAINS)*5}")

if __name__ == "__main__":
    main()
