# Q90 2회차 개발 census 바이트 보존 (C7e)

- candidate: `3d3ebb476f36bbd24f65fb709ff4123e38609556` (tag `q90-r2-candidate`, 보호 ruleset 24894119)
- `c7b-dev-census-union-r3.json`: 2회차 개발 census(`development_hashes` 736 = withQ1Q2 368 + noQ1Q2 368), `development_scope` 포함
- `bytes-3d3ebb4/`, `bytes-3f300a3/`: 각 hash의 원본 바이트(`dev-NNN.json`, `dev-NNN.noQ1Q2.json`) — scorer 42행 `development_registry_census`용 `registry_artifacts` 원천
- `c7b-gen-bytes.cjs`: 재현 도구(결정적). `node c7b-gen-bytes.cjs <repo> <outDir> <commit>`
- 1회차 1,908건(`census-e35f8b32.json`)은 TL 보존본 — TL이 이 디렉터리(`docs/q90-r2/census/round1/`)에 복사하고 SHA를 결박한다.
- 이 디렉터리는 제품 hosting 산출물에 포함되지 않는다(`docs/`는 hosting allowlist 밖).
