# Q90 1회차 development census 바이트 (C7e)

- 출처: 봉인 census `census-e35f8b32.json` (sha256 `e35f8b32aed5d227165d43517fd4dda58f75f11e39b6d16d134c8044e66025d6`)의 `pre_manifest.development_hashes` 1,908건과 `development_registry_sha256` 바이트.
- `round1-dev-inputs.json`: `{sha256, content}` 1,908건. 각 `content`의 sha256 = `sha256` (TL 전수 검증).
- `round1-development-registry.json`: 1회차 development registry 원문 바이트 (`input_hashes` 1,908).
- 제외: final·negative 사례 입력 바이트와 그 밖의 registry artifact (개발 입력이 아님, 공개하지 않음). final 입력 hash와 1,908건의 교집합 0.
- 2회차 패키지 조립 시: 2회차 `development_hashes` = 이 1,908 + `../c7b-dev-census-union-r3.json` 736 (+ 이후 추가분), 모든 hash의 바이트를 `registry_artifacts`에 넣는다(기반 scorer 39·42행).
