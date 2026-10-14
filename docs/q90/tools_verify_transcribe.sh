#!/bin/bash
# 통합 공개 문서의 각 전재 절이 출처와 바이트 일치하는지 기계 검사(rc≠0이면 불일치)
cd "$(dirname "$0")"; O="Q90_공개기록_1·2회차_통합_2026-10-14.md"; R1=G07_G14_판정기록_1회차_전사본_2026-10-09.md; G=G17_공개문구_2회차_결박본_2026-10-13.md; T=${1:-../q90-public/runs/latest/table-v2.md}
s(){ sed -n "/^$1/,/^$2/p" "$3" | sed '1d;$d'; }
diff <(s '### 4.0 scorer 공식 결과' '### 4.1' $R1) <(s '## 1\. 1회차' '## 2\. 1회차' "$O") >/dev/null || { echo "FAIL §1"; exit 1; }
diff <(s '## 6\. G14 비교 문장' '## 7\.' $R1) <(s '## 2\. 1회차' '## 3\. 1회차' "$O") >/dev/null || { echo "FAIL §2"; exit 1; }
diff <(s '## 7\. 미달 시 다음 행동' '## 8\.' $R1) <(s '## 3\. 1회차' '## 4\. 2회차' "$O") >/dev/null || { echo "FAIL §3"; exit 1; }
diff <(sed '1,/^## A\./{/^## A\./!d}' $G) <(s '## 4\. 2회차' '## 5\. 2회차' "$O" | sed '1d;$d') >/dev/null || { echo "FAIL §4"; exit 1; }
[ -f "$T" ] && { grep -qxF "$(tail -1 "$O")" "$T" || { echo "FAIL §5"; exit 1; }; }
echo "OK 전재 5절 일치"
