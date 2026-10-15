# B2B 인원별 가격 검산기 (docs/pricing/01_B2B_VOLUME_PRICING_v1.md 근거)
import math
def all_units(t):
    return lambda n: n*[p for m,p in t if n>=m][-1]
def graduated(br):  # [(start_seat, price)] closed form
    def T(n):
        tot=0
        for i,(s,p) in enumerate(br):
            e=br[i+1][0]-1 if i+1<len(br) else 10**9
            if n>=s: tot+=(min(n,e)-s+1)*p
        return tot
    return T
def report(name,T,ns=(10,29,30,49,50,99,100,199,200,499,500,1000,3000,10000)):
    print(f"\n== {name}")
    for n in ns:
        t=T(n); print(f"{n:>6}명 공급가 {t:>12,}  평균 {t/n:>7,.0f}  할인 {1-t/n/18000:>5.1%}")
    drop=[n for n in range(10,10000) if T(n+1)<T(n)]
    # 'buy more pay less' zone: n where some m>n has T(m)<=T(n): use running min from top
    best=[0]*10002; mn=10**18
    for n in range(10001,9,-1):
        mn=min(mn,T(n)); best[n]=mn
    zone=[n for n in range(10,10001) if best[n+1]<T(n)] if True else []
    print(f"  1명 더하면 총액이 줄어드는 지점: {drop[:6]} | '더 사면 더 싼' 인원: {len(zone)}개 {zone[:2]}..{zone[-2:] if zone else ''}")
    a=math.log(T(500)/T(10))/math.log(50); print(f"  총액 탄력 a={a:.3f} (인원 2배→단가 {1-2**(a-1):.1%} 하락)")

if __name__ == "__main__":
    cur = all_units([(10,18000),(30,16000),(50,14000),(100,12000),(200,11000),(500,10000)])
    rec = graduated([(1,18000),(30,15000),(100,12000),(300,10000),(1000,8000)])
    report("현행 A안(전 구간 동일단가)", cur)
    report("추천 R(누진 5구간)", rec)
