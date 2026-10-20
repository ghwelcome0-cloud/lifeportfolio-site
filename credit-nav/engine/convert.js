// 3단계: 원가 → 서비스 단위
export function usdPerCredit(service, services, calib) {
  return calib?.[service]?.usdPerCredit ?? services.services[service].usdPerCredit;
}
export function toCredits(usd, service, services, calib) { return usd / usdPerCredit(service, services, calib); }
export function toKRW(usd, services) { return usd * services.fx.KRWperUSD; }
