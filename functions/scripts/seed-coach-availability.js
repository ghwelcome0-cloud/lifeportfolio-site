// functions/scripts/seed-coach-availability.js
// PR #91 r2 — 운영자 가능 시간 슬롯 시드/관리 스크립트 (임시 도구)
//
// 향후 PR #92+ 에서 운영 대시보드 UI 로 대체될 예정. 그 전까지는 이 스크립트로
// Firebase Admin SDK 를 통해 coach_availability 컬렉션에 슬롯을 직접 등록한다.
//
// ─────────────────────────────────────────────────────────────────────
// 사전 준비:
//   1) Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
//   2) 다운로드된 JSON 파일을 안전한 위치에 저장
//   3) 환경변수 설정:
//        export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//        export FIREBASE_PROJECT_ID=lifeporfolio
//   4) functions 디렉토리에서 의존성 설치 확인:
//        npm install
//
// ─────────────────────────────────────────────────────────────────────
// 사용법:
//
// [목록 조회]
//   node scripts/seed-coach-availability.js list
//
// [단일 슬롯 추가]
//   node scripts/seed-coach-availability.js add \
//     "2026-05-20T10:00:00+09:00" 30 1 "월요일 오전 슬롯"
//
//   인자 순서: <slot_at ISO> <duration_min> <capacity> [notes]
//   ※ slot_at 은 반드시 timezone offset 포함 ISO 형식 (한국 시간은 +09:00)
//
// [여러 슬롯을 한 번에 (이번 주 평일 오전 10시, 오후 3시)]
//   node scripts/seed-coach-availability.js bulk-week
//
//   다음 7일 동안 평일(월~금) 오전 10시, 오후 3시 (KST) 슬롯 자동 생성.
//
// [슬롯 비활성화]
//   node scripts/seed-coach-availability.js deactivate <slotId>
//
// [슬롯 활성화]
//   node scripts/seed-coach-availability.js activate <slotId>
//
// [슬롯 삭제 (주의: 이미 예약된 슬롯은 삭제하지 말 것)]
//   node scripts/seed-coach-availability.js delete <slotId>
//
// ─────────────────────────────────────────────────────────────────────

"use strict";

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "lifeporfolio",
  });
}
const db = admin.firestore();
const COLL = "coach_availability";

async function listSlots() {
  const snap = await db.collection(COLL).orderBy("slot_at", "asc").limit(100).get();
  if (snap.empty) {
    console.log("(슬롯이 없습니다.)");
    return;
  }
  console.log(`\nTotal: ${snap.size} slots\n`);
  console.log("ID                              | slot_at (KST)         | dur | cap | booked | active | notes");
  console.log("─".repeat(120));
  snap.forEach((d) => {
    const sd = d.data();
    const at = sd.slot_at && sd.slot_at.toDate ? sd.slot_at.toDate() : new Date(0);
    const kstStr = formatKst(at);
    const row = [
      d.id.padEnd(30),
      kstStr.padEnd(22),
      String(sd.duration_min || "?").padStart(3),
      String(sd.capacity || "?").padStart(3),
      String(sd.booked_count || 0).padStart(6),
      sd.active ? "  YES " : "  no  ",
      (sd.notes || "").slice(0, 40),
    ].join(" | ");
    console.log(row);
  });
}

function formatKst(date) {
  const ms = date.getTime() + 9 * 3600 * 1000;
  const k = new Date(ms);
  const y = k.getUTCFullYear();
  const mo = String(k.getUTCMonth() + 1).padStart(2, "0");
  const da = String(k.getUTCDate()).padStart(2, "0");
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  const wd = ["일", "월", "화", "수", "목", "금", "토"][k.getUTCDay()];
  return `${y}-${mo}-${da}(${wd}) ${hh}:${mm}`;
}

async function addSlot(slotAtIso, durationMin, capacity, notes) {
  const slotAt = new Date(slotAtIso);
  if (isNaN(slotAt.getTime())) {
    throw new Error(`잘못된 slot_at ISO 형식: ${slotAtIso}`);
  }
  if (slotAt.getTime() <= Date.now()) {
    throw new Error(`slot_at 이 과거 시각입니다: ${slotAtIso}`);
  }
  const doc = {
    slot_at: admin.firestore.Timestamp.fromDate(slotAt),
    duration_min: parseInt(durationMin, 10) || 30,
    capacity: parseInt(capacity, 10) || 1,
    booked_count: 0,
    active: true,
    notes: notes || "",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(COLL).add(doc);
  console.log(`✅ Added slot ${ref.id} @ ${formatKst(slotAt)} KST (${doc.duration_min}분, cap=${doc.capacity})`);
  return ref.id;
}

async function bulkWeek() {
  // 다음 7일 평일(월~금), 10:00 KST 와 15:00 KST 두 슬롯씩
  const now = new Date();
  const added = [];
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const dKst = new Date(now.getTime() + 9 * 3600 * 1000 + dayOffset * 86400000);
    const wd = dKst.getUTCDay(); // 0=일, 6=토
    if (wd === 0 || wd === 6) continue;
    const yyyy = dKst.getUTCFullYear();
    const mm = String(dKst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dKst.getUTCDate()).padStart(2, "0");
    for (const hr of ["10:00", "15:00"]) {
      const iso = `${yyyy}-${mm}-${dd}T${hr}:00+09:00`;
      try {
        const id = await addSlot(iso, 30, 1, `bulk-week auto-seed`);
        added.push(id);
      } catch (e) {
        console.warn(`  skip ${iso}: ${e.message}`);
      }
    }
    if (added.length >= 10) break;
  }
  console.log(`\nTotal added: ${added.length} slots`);
}

async function setActive(slotId, active) {
  const ref = db.collection(COLL).doc(slotId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Slot not found: ${slotId}`);
  }
  await ref.update({ active: !!active });
  console.log(`✅ Slot ${slotId} → active=${active}`);
}

async function deleteSlot(slotId) {
  const ref = db.collection(COLL).doc(slotId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Slot not found: ${slotId}`);
  }
  const bookedCount = snap.get("booked_count") || 0;
  if (bookedCount > 0) {
    console.warn(`⚠️  WARNING: this slot has ${bookedCount} booking(s). Deleting will orphan them.`);
    console.warn(`    To proceed anyway, deactivate instead: deactivate ${slotId}`);
    return;
  }
  await ref.delete();
  console.log(`🗑  Deleted slot ${slotId}`);
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  try {
    switch (cmd) {
      case "list":
        await listSlots();
        break;
      case "add":
        if (args.length < 1) throw new Error("Usage: add <slot_at_iso> <duration_min> <capacity> [notes]");
        await addSlot(args[0], args[1] || 30, args[2] || 1, args.slice(3).join(" "));
        break;
      case "bulk-week":
        await bulkWeek();
        break;
      case "activate":
        if (!args[0]) throw new Error("Usage: activate <slotId>");
        await setActive(args[0], true);
        break;
      case "deactivate":
        if (!args[0]) throw new Error("Usage: deactivate <slotId>");
        await setActive(args[0], false);
        break;
      case "delete":
        if (!args[0]) throw new Error("Usage: delete <slotId>");
        await deleteSlot(args[0]);
        break;
      default:
        console.log("Usage:");
        console.log("  node scripts/seed-coach-availability.js list");
        console.log("  node scripts/seed-coach-availability.js add <slot_at_iso> <duration_min> <capacity> [notes]");
        console.log("  node scripts/seed-coach-availability.js bulk-week");
        console.log("  node scripts/seed-coach-availability.js activate <slotId>");
        console.log("  node scripts/seed-coach-availability.js deactivate <slotId>");
        console.log("  node scripts/seed-coach-availability.js delete <slotId>");
        process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

main();
