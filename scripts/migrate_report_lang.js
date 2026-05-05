#!/usr/bin/env node
/**
 * PR#37 [D-1] 리포트 lang 라벨 마이그레이션 스크립트 (일회성)
 * --------------------------------------------------------------
 * 사용 시나리오:
 *   사용자가 한국어 페이지에서 검사를 마쳤는데도 localStorage의 lp_lang=en
 *   회귀 버그 때문에 RTDB에 lang="en"으로 잘못 저장된 리포트가 있음.
 *   본 스크립트는 RTDB 전체를 안전하게 스캔해서 (또는 특정 uid만)
 *   잘못 라벨링된 리포트의 lang 필드를 일괄 정정합니다.
 *
 * 모드:
 *   1) --dry-run         : 실제 변경 없이 영향 받을 레코드만 출력
 *   2) --uid=<UID>       : 특정 사용자만 대상 (생략 시 전체)
 *   3) --swap            : ko↔en 완전 교환 (특정 uid에 대해 전체 라벨이 정반대인 경우)
 *   4) --set-lang=ko|en  : 특정 sid 또는 uid의 모든 리포트 라벨을 강제 설정
 *   5) --sids=sid1,sid2  : 정확한 sid 리스트만 대상 (가장 안전)
 *
 * 권장 사용법 (4개 리포트 KO↔EN 정반대 케이스):
 *   1) 먼저 dry-run으로 분포 확인:
 *      node scripts/migrate_report_lang.js --uid=<USER_UID> --dry-run
 *   2) 분포가 의도와 정반대임이 확인되면:
 *      node scripts/migrate_report_lang.js --uid=<USER_UID> --swap
 *
 * 사전 준비:
 *   1) `npm install firebase-admin` (sandbox 외부 환경에서)
 *   2) Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *      → 다운로드한 JSON 파일을 프로젝트 루트에 `serviceAccount.json`로 저장
 *   3) `serviceAccount.json`은 .gitignore에 반드시 포함 (절대 커밋 금지)
 *   4) 환경변수: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json (선택)
 *
 * 안전장치:
 *   - 변경 전 자동 백업 파일 생성: scripts/backup_<uid>_<timestamp>.json
 *   - 모든 변경은 multi-path update()로 원자적 적용
 *   - --dry-run이 기본 활성화되도록 권장 (--apply 명시 필요)
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ----------------------- CLI 인자 파싱 -----------------------
function parseArgs() {
  const args = { dryRun: true, uid: null, swap: false, setLang: null, sids: null, apply: false };
  process.argv.slice(2).forEach(arg => {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--apply") { args.apply = true; args.dryRun = false; }
    else if (arg === "--swap") args.swap = true;
    else if (arg.startsWith("--uid=")) args.uid = arg.slice(6);
    else if (arg.startsWith("--set-lang=")) args.setLang = arg.slice(11);
    else if (arg.startsWith("--sids=")) args.sids = arg.slice(7).split(",").map(s => s.trim()).filter(Boolean);
  });
  return args;
}

// ----------------------- Firebase 초기화 -----------------------
function initAdmin() {
  const keyPath = path.resolve(process.cwd(), "serviceAccount.json");
  if (!fs.existsSync(keyPath) && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ serviceAccount.json이 프로젝트 루트에 없습니다.");
    console.error("   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성으로 발급 받아 두세요.");
    process.exit(1);
  }
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? admin.credential.applicationDefault()
    : admin.credential.cert(require(keyPath));
  admin.initializeApp({
    credential,
    databaseURL: "https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
  return admin.database();
}

// ----------------------- 백업 -----------------------
function backupSnapshot(uid, snapshot) {
  const dir = path.resolve(process.cwd(), "scripts", "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `backup_${uid}_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
  console.log("📦 백업 저장:", file);
}

// ----------------------- 수집 단계 -----------------------
async function collectReports(db, uid) {
  // users/{uid}/reports 인덱스 + reports/{uid} 본문 모두 읽어 통합 분석
  const [idxSnap, dirSnap] = await Promise.all([
    db.ref(`users/${uid}/reports`).get(),
    db.ref(`reports/${uid}`).get()
  ]);
  const idx = idxSnap.exists() ? (idxSnap.val() || {}) : {};
  const dir = dirSnap.exists() ? (dirSnap.val() || {}) : {};
  const sids = new Set([...Object.keys(idx), ...Object.keys(dir)]);
  const items = [];
  sids.forEach(sid => {
    const idxRow = idx[sid] || {};
    const dirRow = dir[sid] || {};
    const r = (dirRow && dirRow.report) || dirRow || {};
    const rawLang = idxRow.lang || dirRow.lang || (r && r.lang) || null;
    const lang = (rawLang ? String(rawLang).toLowerCase() : null);
    items.push({
      sid,
      lang,
      hasIdx: !!idx[sid],
      hasDir: !!dir[sid],
      generatedAt: idxRow.generatedAt || dirRow.generatedAt || (r && r.generatedAt) || null,
      name: idxRow.name || dirRow.name || (r && r.profile && r.profile.name) || ""
    });
  });
  return { items, raw: { idx, dir } };
}

// ----------------------- 변경 계획 수립 -----------------------
function buildUpdates(uid, items, opts) {
  const updates = {};
  const planned = [];
  for (const it of items) {
    let target = null;
    if (opts.sids && opts.sids.length) {
      if (!opts.sids.includes(it.sid)) continue;
      if (opts.setLang) target = opts.setLang;
      else if (opts.swap) target = (it.lang === "en" ? "ko" : "en");
    } else if (opts.swap) {
      target = (it.lang === "en" ? "ko" : (it.lang === "ko" ? "en" : null));
    } else if (opts.setLang) {
      target = opts.setLang;
    }
    if (!target || target === it.lang) continue;
    // 인덱스/본문 양쪽 lang 필드 동시 정정
    if (it.hasIdx) updates[`users/${uid}/reports/${it.sid}/lang`] = target;
    if (it.hasDir) updates[`reports/${uid}/${it.sid}/lang`] = target;
    planned.push({ sid: it.sid, from: it.lang || "(unset)", to: target, name: it.name });
  }
  return { updates, planned };
}

// ----------------------- 메인 -----------------------
async function main() {
  const args = parseArgs();
  console.log("🔧 PR#37 리포트 lang 마이그레이션");
  console.log("   옵션:", args);

  if (!args.uid) {
    console.error("❌ --uid=<USER_UID>가 필요합니다 (전체 사용자 일괄 처리는 지원하지 않습니다 — 안전을 위해).");
    process.exit(1);
  }
  if (!args.swap && !args.setLang) {
    console.error("❌ --swap 또는 --set-lang=ko|en 중 하나를 지정해 주세요.");
    process.exit(1);
  }

  const db = initAdmin();
  const { items, raw } = await collectReports(db, args.uid);
  const dist = items.reduce((acc, it) => {
    const k = it.lang || "(unset)";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  console.log("📊 현재 분포(uid=" + args.uid + "):", dist, "/ 총 sid 수:", items.length);
  console.table(items.map(it => ({
    sid: it.sid.slice(0, 12) + "...",
    lang: it.lang || "(unset)",
    hasIdx: it.hasIdx ? "Y" : "-",
    hasDir: it.hasDir ? "Y" : "-",
    generatedAt: it.generatedAt,
    name: (it.name || "").slice(0, 10)
  })));

  const { updates, planned } = buildUpdates(args.uid, items, args);
  console.log("📝 계획된 변경:", planned.length, "건");
  planned.forEach(p => console.log(`   • ${p.sid}  ${p.from} → ${p.to}  (${p.name})`));

  if (planned.length === 0) {
    console.log("✅ 변경할 항목이 없습니다.");
    process.exit(0);
  }

  if (args.dryRun) {
    console.log("\n🟡 dry-run 모드 — 실제 변경은 적용되지 않았습니다.");
    console.log("   적용하려면 동일 명령에서 --dry-run 대신 --apply 플래그를 사용하세요.");
    process.exit(0);
  }

  // 실제 적용 전 백업
  backupSnapshot(args.uid, raw);

  console.log("\n✏️  RTDB 적용 중...");
  await db.ref().update(updates);
  console.log("✅ 적용 완료. 변경 키 수:", Object.keys(updates).length);
  console.log("   백업 파일은 scripts/backups/ 아래에 보존됩니다 (필요 시 수동 복원).");
  process.exit(0);
}

main().catch(err => {
  console.error("💥 실행 오류:", err);
  process.exit(1);
});
