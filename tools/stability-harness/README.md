# 안정성 점검 하네스 (stability-harness) · v0.1

목적: B2C/B2B × KO/EN × PC/모바일 운영 점검을 **주기적으로 재실행**할 수 있게 한다. 판정은 PASS/FAIL/NOT_RUN/BLOCKED/NOT_APPLICABLE 5어휘만.

- `run.cjs` — 엔진(puppeteer Chromium). `cases/<lane>-*.json`을 읽어 실행, `evidence/<run_id>/`에 스크린샷·콘솔·네트워크 호스트 목록·`test-matrix.csv`·`summary.md`·`evidence-index.json` 생성.
- `cases/public-*.json` — 1단계 공개면(인증 없음, 비파괴: `destructive:true` 클릭은 public lane에서 자동 생략, 운영 Firebase/PG 호스트로의 쓰기 요청은 가로채서 차단·기록).
- `cases/isolated-*.json` — 2단계 격리(로컬 에뮬레이터·합성 계정). `--allow-hosts` 밖 송출은 차단·기록.
- 3단계(실로그인·실결제·실메일·실기기)는 하네스가 실행하지 않는다 → `requires_approval` → `BLOCKED`.

```
node tools/stability-harness/run.cjs --base https://lifeportfolio.co.kr --lane public --out docs/ops-audit/evidence --source-sha <main sha>
node tools/stability-harness/run.cjs --base http://127.0.0.1:5002 --lane isolated --allow-hosts 127.0.0.1,localhost
```
원칙(인수인계 §11): `LP_I18N.onReady` 대기 후 텍스트 검사 / 애니메이션 정착 대기 / CSP Report-Only와 enforce 구분 / localStorage ≠ 서버 저장 / 성공 표시 ≠ 저장 확인 / 실패를 재시도로 숨기지 않음.
