# 원격 브랜치 정리 기록 — 2026-08-14

이 문서는 2026-08-14 에 삭제한 원격 브랜치 16개의 **복구용 SHA 원장**입니다.
다른 작업자가 "내 브랜치가 사라졌다" 고 느낄 때, 이 문서만 보면 **무엇이 왜 삭제되었고 어떻게 되살리는지** 알 수 있습니다.

- 실행 근거: 대표님 지시 — 결정 요청 3건 중 ③ "오래된 브랜치 정리"
- 실행자: 개발 담당(샌드박스)
- 삭제 수: **16** (실패 0)
- 라이브 영향: **없음** (브랜치 삭제는 배포 산출물과 무관. 산출물 manifest `802b757891aeea939e5b32900dedb051bbceefdb10e0f24a3d79841c64e54af4` 불변)

---

## 1. 삭제 안전 판정 방법 — `git cherry` 를 쓰십시오

### 하지 마세요 — `git diff main origin/<branch> --stat`

이 명령은 **거짓 신호**를 냅니다. 실제로 관측된 값입니다.

```
fix/payment-paid-safety-net-pr184  →  1520 files changed, 106146 deletions(-)
docs/ceo-report-2026-08-13         →   104 files changed,   5931 deletions(-)
```

거대한 삭제량으로 보이지만, 이것은 **그 브랜치의 미반영 작업이 아닙니다.**
브랜치가 갈라진 뒤 `main` 이 계속 앞서 나갔기 때문에(BEHIND 24~774 커밋),
`main` 에만 있는 파일이 전부 "삭제"로 집계된 것입니다. 방향이 반대인 diff 를 본 셈입니다.

### 하세요 — `git cherry` 로 패치 등가성 판정

```bash
git fetch --prune
git cherry main origin/<branch>
#  '-' 로 시작하는 줄 = main 에 패치 동등물이 이미 있음 (흡수됨 → 삭제 안전)
#  '+' 로 시작하는 줄 = main 에 없음 (고유 작업 → 보존)
```

squash 머지를 쓰는 저장소에서는 **커밋 SHA 가 보존되지 않습니다.**
그래서 "머지 커밋이 main 의 조상인가" 로 판정하면 틀립니다.
`git cherry` 는 SHA 가 아니라 **패치 내용(patch-id)** 을 비교하므로 squash 머지에도 정확합니다.

보조 지표도 함께 보십시오.

```bash
uniq=$(git cherry main origin/<branch> | grep -c '^+')
tree=$(git diff --name-only $(git merge-base main origin/<branch>) origin/<branch> | wc -l)
# uniq == 0  → 패치가 모두 흡수됨 → 삭제 안전
# tree == 0  → 브랜치 tip 의 내용이 분기점과 동일 → 고유 내용 없음 → 삭제 안전
```

### 실측 결과 (8개 브랜치 정밀 판정)

| 브랜치 | uniq(+) | tree vs merge-base | 판정 |
|---|---|---|---|
| `fix/payment-paid-safety-net-pr184` | 0 | 2 | 흡수 — 삭제 (merge commit `41e9b0b7` 은 main 조상이 아니지만 패치는 흡수됨) |
| `docs/ceo-report-2026-08-13` | 0 | 2 | 흡수 — 삭제 |
| `docs/rev8-cw-cx-cy` | 0 | 1 | 흡수 — 삭제 |
| `fix/audit-puppeteer-devdep` | 0 | 2 | 흡수 — 삭제 |
| `fix/fpcode-format-unification` | 0 | 3 | 흡수 — 삭제 |
| `fix/live-deploy-identity-fallback` | 0 | 2 | 흡수 — 삭제 |
| `genspark_ai_developer` | 6 | **0** | tip 내용이 분기점과 동일 = 고유 내용 없음. 그러나 **공용 브랜치명이라 의도적 보존** |
| `ci/verified-hosting-rollback` | **1** | 5 | **진짜 고유 작업. PR 없음 → 보존** |

---

## 2. 삭제한 브랜치 16개 — 복구용 SHA 원장

복구 방법은 아래 3절에 있습니다.

**복구 가능성은 추정이 아니라 실측입니다.** 16개 SHA 전부에 대해 `git fetch origin <sha>` + `git cat-file -e <sha>^{commit}` 을 실행했습니다.

```
recoverable=16  dead=0     (2026-08-14 검증)
```

```
5ee0a45cfcc94428a3319f10f0d041e5057cb710  archive/dual-edition-vector-p26
c083074d7194f38b66567548453e311349483f5d  feat/b2b-progress-funnel
d2b8df7c023cfe790c42aaf8d0ed0eff25887522  feat/journey-remove-download-pr192
f052ff0237e699af9719f90b252d65589102d13c  feat/journey-slide3-baseline-pr191
6f84b6541b90ee88fb3901a05a9696c37d281277  fix/ios-payment-redirect-pr182
ddbddfa5e051bee9d4fabf2eb6667b73e85f567d  fix/payment-success-ux-pr183
b2feb7c95c1527be7c82acbef07afe132f413b2d  genspark_marketing_playbook
c318b0859c4c8c6cce59d3fdd6f9d7e43d0964ea  genspark_pr_b1_q1q2_index
0a8148a78ce306f7d92f396e3ca530e41c0233e2  genspark_pr_b_quarterly
fac36eadb03b95ccaee4384e4b2e6de815d988af  pr72-plain-language
8cb460e4cf9a12fe4e360a1bb385062cf373aab7  fix/payment-paid-safety-net-pr184
c4d4eabd62e19195c41624e102549d8c6b3a8daa  docs/ceo-report-2026-08-13
cc1b15c1b765e3f22fe80e6477cf6a14e22c7fe6  docs/rev8-cw-cx-cy
3a1fc0ce227fc07b971ef097a6374e777d526c50  fix/audit-puppeteer-devdep
cc04e4f9f16ae0c802cf2627365f4454e7945f18  fix/fpcode-format-unification
b4c23ffa19912c8b04ff623b5741ec55248a9b76  fix/live-deploy-identity-fallback
```

머지되어 자동 삭제된 브랜치(정상 소멸, 복구 불필요):
`docs/video-production-rules`(#253) · `ci/static-e2e-scaffold`(#270) · `docs/genteam-crossteam-bridge`(#275)

---

## 3. 되살리는 방법

```bash
# 예: feat/b2b-progress-funnel 복구
git push origin c083074d7194f38b66567548453e311349483f5d:refs/heads/feat/b2b-progress-funnel
```

SHA 는 GitHub 에서 최소 30일간 접근 가능하므로, 위 명령이 그대로 동작합니다.
그 이후에도 `git reflog` 나 GitHub Support 를 통해 복구할 수 있습니다.

내용만 확인하려면 push 없이도 볼 수 있습니다.

```bash
git fetch origin c083074d7194f38b66567548453e311349483f5d
git show c083074d
```

---

## 4. 삭제하지 않고 보존한 브랜치 — 손대지 마십시오

| 브랜치 | 이유 |
|---|---|
| `genspark_ai_developer` | **여러 작업자가 공용으로 쓰는 브랜치명.** 판정상 삭제 안전이었으나 다른 작업자 작업 흐름을 끊을 수 있어 의도적 보존 |
| `ci/verified-hosting-rollback` | `git cherry` uniq=1 — **main 에 없는 고유 커밋 1개.** PR 이 없어 리뷰 이력도 없음. 작성자 확인 전 삭제 금지 |
| `security/production-credential-fail-closed` | PR #244 는 중복으로 폐쇄했으나 브랜치는 보존 |
| OPEN PR 4건의 head | `feat/contact-recovery-links`(#271) · `security/production-credential-only`(#269) · `legal/l0-manifest-schema`(#252) · `fix/p0a-ix-x-disclosures`(#245) — **삭제 금지** |
| CLOSED PR 9건의 head | 재개 가능성 있어 보존 |

---

## 5. PR #244 폐쇄에 대하여

`security/production-credential-fail-closed`(#244) 는 **#269 와 중복**이라 폐쇄했습니다.
제목만으로 판단하지 않고 두 브랜치를 직접 diff 해 **#269 가 #244 의 상위 집합**임을 확인했습니다.

```diff
       - name: (자격증명 준비)
         run: |
+          node scripts/verify-production-freeze.mjs
+          # The production-live environment secret is the only permitted deploy identity.
           test -n "$FIREBASE_PRODUCTION_SERVICE_ACCOUNT"
       - name: Deploy canonical main output to live
-        run: npx --no-install firebase deploy --only hosting --project "lifeporfolio" --non-interactive
+        run: |
+          node scripts/verify-production-freeze.mjs
+          npx --no-install firebase deploy --only hosting --project "lifeporfolio" --non-interactive
```

즉 #269 는 배포 동결 검증을 2단으로 추가합니다. #244 에는 이 부분이 없습니다.
**#244 의 의도는 #269 안에 온전히 살아 있습니다.** 브랜치도 보존했으므로 작업 유실은 없습니다.

---

## 6. 앞으로 브랜치를 정리할 분께

1. `git fetch --prune` 후 `git cherry` 로 판정하십시오. `git diff main origin/<b> --stat` 은 보지 마십시오.
2. 삭제 **직전에** `git rev-parse` 로 SHA 를 기록하고, 이 문서에 이어 붙이십시오. `/tmp` 는 소실됩니다.
3. OPEN PR 의 head 브랜치는 절대 삭제하지 마십시오. `gh pr list --state open --json headRefName` 로 먼저 확인하십시오.
4. `genspark_ai_developer` 처럼 **개인 소유가 아닌 공용 브랜치명**은 판정이 안전해도 남겨 두십시오.
5. 고유 커밋이 있는 브랜치(`uniq > 0`)는 PR 을 열어 리뷰 경로에 올린 뒤 정리하십시오. 조용히 지우면 근거가 사라집니다.
