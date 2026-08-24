# -*- coding: utf-8 -*-
"""Write the plate order for the AI image agent, one brief per plate.

The brief is generated from the table rather than composed by hand because each
plate must satisfy every row that uses it — one plate serves up to six camera
moves — and because a hand-written brief drifts from the table it is supposed to
describe.
"""
import json, shots38 as T

man = T.plate_manifest()
order = sorted(man.values(), key=lambda e: min(
    r["t0"] for r in T.TABLE38 if r["anchor"] == e["anchor"]))

MOVE_NEED = {
    "도착": "카메라가 3~5% 다가갑니다. 중앙 피사체 주변에 여백이 있어야 합니다.",
    "후퇴": "카메라가 3~5% 물러납니다. 프레임 가장자리까지 장면이 이어져야 합니다.",
    "관통": "카메라가 좌우로 화면 폭의 1~2% 이동합니다. 좌우 양쪽에 여백이 필요합니다.",
    "정지": "카메라가 거의 정지합니다. 단독으로 아름다운 정지 구도여야 합니다.",
}

H = """# ACT3~8 정지판(plate) 27장 발주서 v1

## 무엇을 만드는가
150.32~500.00초 구간의 **정지 이미지 27장**입니다. 영상이 아닙니다.
이 27장 위에서 카메라만 움직여(2.5D 켄번즈) 350초 중 대부분을 채웁니다.
영상 생성은 화면 안 물체가 실제로 변하는 **9개 샷에만** 사용합니다.

## 전 장 공통 절대 규칙 (하나라도 위반 시 반려)
1. **2048×1152 가로**. 세로·정사각 금지. 종횡비 1.7778 (16:9).
2. **세계관 = 현실 사무실 단면 (벽 절개)**. 책상·서재·협업공간·종이·서류철.
3. **SF 금지**: 배관·포털·발광 도관·홀로그램·회로·와이어프레임·연결 광선 전면 배제.
4. **문서 본문은 회색 바 추상화**. 읽히는 한글 본문을 그리지 마십시오.
   굵은 진회색 블록 = 제목 / 얇은 중간회색 바 = 본문 / 컬러 바 = 강조.
   팔레트: 시안 `#66C5E3` / 페일옐로 `#FCE17B` / 코랄 `#F29496` / 세이지 `#B4DB8D`
5. **읽히는 한글은 유리 패널 5장에서만** 등장합니다 (아래 P 항목).
   패널 안에 밑줄·구분선·아이콘·점 등 **장식 금지**.
6. 성과 수치·트로피·정답 표시·우열 표시·가격 금지.
7. **프레이밍 여백**: 카메라가 이 정지판 위를 움직입니다. 피사체를 프레임에
   꽉 채우면 움직일 공간이 없습니다. 각 항목의 `여백` 지시를 지켜주십시오.

## 참조 (craft 기준선 · 이 질감을 목표로)
- 사무실 단면 정본: https://www.genspark.ai/api/files/s/COoiaKn7
- 회색 바 추상화 기준: https://www.genspark.ai/api/files/s/9eMljtGR
- craft 9.8 참조본: https://www.genspark.ai/api/files/s/pTtOAOpx

## 제출 방식
`gsk upload` 로 업로드한 URL을 **plate 코드와 함께** 회신해 주십시오.
27장 전량이 아니라 **완성되는 대로 부분 회신**해 주셔도 됩니다 — 도착한 순서대로
조립을 시작합니다. 파일명은 `plate_<코드>.png` 로 해주십시오.

---
"""

body = [H]
for e in order:
    t0 = min(r["t0"] for r in T.TABLE38 if r["anchor"] == e["anchor"])
    t1 = max(r["t1"] for r in T.TABLE38 if r["anchor"] == e["anchor"])
    body.append(f"## `{e['anchor']}` — {e['kind']}  ({t0:.2f}~{t1:.2f}초, "
                f"화면 점유 {e['secs']:.1f}초, {len(e['rows'])}개 샷 공유)")
    if e["panel"]:
        body.append(f"- **유리 패널 문자열 (정확히 이 글자만, 오탈자 금지)**: `{e['panel']}`")
        body.append("  - 발광하는 반투명 유리 패널에 이 한글을 렌더합니다. 장면 위에 떠 있고,")
        body.append("    패널 뒤로 사무실 단면이 흐릿하게 보입니다. 패널 내부 장식 금지.")
    if e["kind"] == "sequential":
        body.append("- **순차 공개 상태판입니다.** 이 시점에 보여야 하는 것만 채우고,")
        body.append("  **다음에 나올 항목은 비워 두십시오** (미리 채우면 반려).")
    body.append("- 화면에 있어야 할 것:")
    for o in e["objects"]:
        body.append(f"  - {o}")
    if e["narr"]:
        body.append("- 이 순간의 나레이션 (분위기 참고용, 화면에 글자로 넣지 마십시오):")
        for n in e["narr"][:3]:
            body.append(f"  - “{n}”")
    body.append(f"- 카메라가 이 판 위에서 하는 동작: {', '.join(e['moves'])}")
    for mv in e["moves"]:
        if mv in MOVE_NEED:
            body.append(f"  - {mv}: {MOVE_NEED[mv]}")
    body.append(f"- **여백**: 상하좌우 각 {int(e['pad']*100)}% 이상 확보")
    if e["protect"]:
        body.append("- 보호 요구사항 (PM 지정):")
        for p in e["protect"]:
            body.append(f"  - {p}")
    body.append(f"- 이 판을 쓰는 샷: {', '.join(e['rows'])}")
    body.append("")

body.append("## 요약")
body.append(f"- 총 {len(order)}장 = 씬 "
            f"{sum(1 for e in order if e['kind']=='scene')}장 / 유리 패널 "
            f"{sum(1 for e in order if e['kind']=='panel')}장 / 순차 상태판 "
            f"{sum(1 for e in order if e['kind']=='sequential')}장")
body.append("- 이 27장으로 350초 중 약 320초를 채웁니다. 나머지 30초만 영상 생성입니다.")
body.append("- 대표님이 이미지를 먼저 검토하십니다. 정확도가 속도보다 중요합니다.")

txt = "\n".join(body)
open("/home/user/lf/gt/plate38_order.md", "w", encoding="utf-8").write(txt)
print(f"brief {len(txt)} chars, {len(order)} plates")
print(f"panel plates: {[e['anchor'] for e in order if e['kind']=='panel']}")
print(f"seq plates:   {[e['anchor'] for e in order if e['kind']=='sequential']}")
