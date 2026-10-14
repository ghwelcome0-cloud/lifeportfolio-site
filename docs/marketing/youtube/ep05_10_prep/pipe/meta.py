import sys,json,re
E=sys.argv[1];B=f'/home/user/ax-work/yt-ep{E}/'
C=json.load(open(f'cfg/{E}_render.json'));TH=json.load(open('cfg/thumbs.json'))[E]
T=json.load(open(B+'build/timing.json'));SEC=[s+1.0 for s in T['sec_starts']]
md=open(B+f'script/EP{E}_script.md').read(); title=re.search(r'^제목: (.+)$',md,re.M).group(1)
P=[l.strip() for l in open(B+'script/narration.txt') if l.strip()]
idx=(0,1,2,3,4,5,6,9,10,11,12)
def mmss(t): t=int(t) if t>1.5 else 0; return f'{t//60:02d}:{t%60:02d}'
chap='\n'.join(f'{mmss(SEC[i])} {c.replace("XI장","11장").replace("1~4주","1주에서 4주").replace("5~8주","5주에서 8주").replace("9~12주","9주에서 12주")}' for i,c in zip(idx,C['chap']))
hook=' '.join(re.split(r'(?<=[.?!])\s+',P[0])[:-1])
nm=C['name'].split(' ')[0]
srt=open(B+f'build/EP{E}_ko_vo.srt').read(); ncue=srt.count(' --> ')
tags=f"인생포트폴리오, 고유함이 쓰이는 순간, {C['type']}, 자산화, 12주 자산화 퀘스트, 리포트 XI장, 자산화 길 찾기, 나의 다이어리, {C['role'].split(' · ')[0]}, {TH[0]} {TH[1]}, 고유함"
out=f"""# EP.{E} 업로드 정보

## 제목
{title}

## 설명
{hook}

{C['type']}은 {C['desc']} 변화입니다. {nm} 씨가 열두 주 동안 해 보고, 보여 주고, 고쳐 쓰고, 다음 사람이 그대로 쓰게 묶은 과정을 따라갑니다.

{chap}

▶ 확인하는 곳
리포트 XI장 「자산화 길 찾기」에서 자산화 유형과 처음 남길 것을 볼 수 있습니다.
마이페이지 › 나의 다이어리 › 추천 진로 세 카드에서 길찾기를 엽니다.
https://lifeportfolio.co.kr

※ 영상 속 인물과 사례는 모두 가상이며, 미니어처 인형으로 표현했습니다.
※ 서비스 화면은 실제 화면이며 예시 계정입니다.
※ 결과는 참고이고, 고르는 것은 본인입니다.

#인생포트폴리오 #고유함이쓰이는순간 #{C['type']} #자산화 #12주

## 태그
{tags}

## 썸네일
- 1안 V1_hook: 「{TH[0]} {TH[1]}」 (추천: 첫 장면과 같은 그림이라 클릭 뒤 이어짐이 좋음)
- 2안 V2_xi: 「{TH[3]} {TH[4]}」 + 실제 XI장
- 3안 V3_12weeks: 「12주 뒤 남은 것」 + 실제 12주 퀘스트

## 자막
EP{E}_ko.srt ({ncue}개, 어절·의미 단위 규칙 v3.1, 어색한 줄바꿈 0)
"""
open(B+f'build/EP{E}_METADATA.md','w').write(out);print(out)
