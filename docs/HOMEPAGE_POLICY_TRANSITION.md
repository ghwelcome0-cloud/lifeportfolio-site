# 홈페이지 공개를 위한 선행 정책 전환

이 PR은 홈페이지 개편과 분리된 정책 전용 준비다. 운영 홈페이지 index.html, 결제/진단/리포트/마이페이지, Functions 및 양DB 규칙은 ca47ef3 그대로다. 변경은 기존 EN 호환 페이지·라이선스 고지·관련 헤더/게시 목록과 정확한 연락처 정책뿐이다.

## 정합성
- 정책 버전2, 대상 PR314.
- 기존38쌍 보존, EN2쌍·라이선스3쌍만 추가.
- 게시 원본 pin: 9e3ca5b2b2f5d566bdecccd8dc5af2c5db9aa21d.
- 게시 파일272개, manifest SHA256: 00cc496e31c98fe429f22240a8a1f7fe0dcfa58f3b1773480aaac65a8b7e3114.
- 정책 SHA256: 61e922ba9a777a095dd5efd5df6c95bfc2ea0ddf5bafb0b74232590ce3b0e3e1.
- 기존 PR240 승인 이력 보존. DLP 본체·실제 승인 증빙 검사·activation manifest는 변경하지 않는다. 메타데이터는 실제 승인 메시지를 대신하지 않는다.

이 작은 선행 변경이 승인되어 main에 들어가면, main의 신뢰된 검증기가 새 홈페이지의 정확한 연락처 경로를 인지할 수 있다. 이 PR의 main 병합만으로 Hosting을 배포하지 않는다. 이후 홈페이지 전용 후보를 main 위에 정렬하고 일치하는 게시 산출물로 기존 배포 절차를 따른다.

## 실제 복구 대상 확보
2026-09-12T03:00:35.632Z에 Firebase Hosting API의 live channel GET과 release list GET으로 확인했다.
- site: lifeporfolio (public)
- 활성 release: sites/lifeporfolio/channels/live/releases/1788866818029000
- 활성 version: sites/lifeporfolio/versions/0764c0434244393b
- 상태: FINALIZED
- releaseTime: 2026-09-08T11:26:58.029Z
- 증빙 run: https://github.com/ghwelcome0-cloud/lifeportfolio-site/actions/runs/34669192736

이 조회는 배포/롤백/DB/Auth/고객/결제/함수 로그 작업을 하지 않았다. 서비스 계정의 비밀값이나 OAuth 토큰도 산출물로 내보내지 않았다. 실제 공개 직전에 활성 버전이 여전히 같은지 재확인한다. 복구 시 해당 public Hosting 버전을 사용하며 DB/결제 상태를 되돌리지 않는다.

사용자의 최종 공개 승인 원문은 현재 대화에 있다. CI가 요구하는 실제 승인 메시지 ID·링크와 두 검토 역할의 같은-head 증빙을 임의 생성하지 않는다. 이 문서는 승인 증빙 자체가 아니다.
