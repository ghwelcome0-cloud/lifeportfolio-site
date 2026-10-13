# r6 — 고용24 6행, 휴대폰 테더링으로 한 번 더 (5분, 복사-붙여넣기 2번)

## 왜
r4(집 와이파이)에서 고용24 6행(K01a·K08~K12)이 **연결 시간 초과**였습니다. 그런데 같은 주소가 다른 출구(제3의 크롤러)에서는 정상(200)으로 열립니다. 즉 사이트는 살아 있고, **특정 망에서만 막히는** 것으로 보입니다. 망을 바꿔 한 번만 더 재 보면 6칸이 채워질 수 있습니다(E1 32→최대 38/40). 측정기는 r4와 **같은 파일, 한 글자도 안 바꿈**(sha 게이트가 확인).

## 준비 (1분)
1. 휴대폰 **핫스팟(테더링)** 켜고, PC 와이파이를 그 핫스팟에 연결.
2. r4 때 쓰신 `q90-kit` 폴더가 바탕화면에 그대로 있으면 됩니다. (지우셨으면 알려 주세요 — 키트 다시 드립니다.)

## 받기 (PowerShell에 붙여넣기 1번)
```powershell
cd "$HOME\Desktop\q90-kit"; iwr https://raw.githubusercontent.com/ghwelcome0-cloud/lifeportfolio-site/r6-kit-v1/docs/q90-public/runs/run-r6.cjs -OutFile runs\run-r6.cjs; iwr https://raw.githubusercontent.com/ghwelcome0-cloud/lifeportfolio-site/r6-kit-v1/docs/q90-public/roster/roster-v2.r6-subset.json -OutFile roster\roster-v2.r6-subset.json
```

## 실행 (붙여넣기 1번)
```powershell
node runs\run-r6.cjs
```
`Network kind` 물으면 **`mobile-tether`** 라고 치고 Enter. `== 6/6` 뒤에 `r6-result.tar.gz` 가 생깁니다.

## 보내기
`q90-kit\r6-result.tar.gz` 파일 하나를 채팅에 올려 주세요. 끝.

> 규칙: 끝까지 **한 번만**. 실패 행이 나와도 다시 돌리지 않습니다. 그래도 시간 초과면 "두 망에서도 시간 초과"로 확정하고 넘어갑니다.
