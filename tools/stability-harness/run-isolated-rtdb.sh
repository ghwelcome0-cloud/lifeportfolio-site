#!/usr/bin/env bash
# 격리 레인: RTDB 규칙 경계 실측 (에뮬레이터, 운영 접촉 0). repo root 에서 실행.
#   bash tools/stability-harness/run-isolated-rtdb.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
CFG=firebase.rtdb-audit.json; cp tools/stability-harness/firebase.rtdb-audit.json "$CFG"; trap "rm -f $CFG" EXIT
npx firebase emulators:exec --project demo-lp-rules-audit --config "$CFG" --only database \
  "RTDB_EMU_NS=demo-lp-rules-audit-default-rtdb node scripts/gates/rules_guard_gate.mjs; node tools/stability-harness/rtdb-boundary-probe.mjs"
