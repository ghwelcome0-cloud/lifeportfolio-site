# TTS 발음 점검: 「주 차/주차」 앞 숫자는 한자어(일·이·삼·사…십이)로. 고유어(한·두·세·네…열두)면 오류.
import re,sys
NATIVE=r'(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두)'
bad=0
for f in sys.argv[1:]:
    for n,l in enumerate(open(f,encoding='utf-8'),1):
        for m in re.finditer(NATIVE+r'\s?주\s?차',l):
            print(f'{f}:{n}: 「{m.group(0)}」 → 한자어로 (예: 사 주 차, 십이 주 차)'); bad+=1
        for m in re.finditer(r'[0-9]+\s?주\s?차',l):
            print(f'{f}:{n}: 「{m.group(0)}」 숫자 그대로 → TTS 원고는 한글 한자어로'); bad+=1
print('lint bad',bad); sys.exit(1 if bad else 0)
