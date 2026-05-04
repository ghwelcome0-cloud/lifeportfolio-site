/**
 * 인생포트폴리오 응답 마스터 - Google Apps Script
 * ─────────────────────────────────────────────────────────────
 * 역할:
 *  1) 설문 응답(suvey.html) → Google Sheet 자동 저장 (doPost)
 *  2) 수동 리포트 동기화 (manual_report_html / manual_report_status)
 *  3) Firebase RTDB 폴링용 GET 엔드포인트 (doGet)
 *
 * 시트 구성:
 *  - "responses"        : 응답 마스터 (Q1 ~ Q78 + 메타)
 *  - "manual_reports"   : 수동 리포트 (HTML 본문 + 상태)
 *  - "logs"             : 디버그/오류 로그
 *
 * 배포:
 *   배포 → 새 배포 → 웹 앱
 *   - 다음 사용자로 실행: 본인
 *   - 액세스 권한: 모든 사용자
 *   배포 후 발급되는 /exec URL 을 Firebase RTDB
 *   `config/appsScriptUrl` 에 등록하세요.
 * ─────────────────────────────────────────────────────────────
 */

// 🔧 사장님 시트 ID (이미 입력됨 — 수정 불필요)
const SHEET_ID = "1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM";

// 시트 탭 이름
const TAB_RESPONSES = "responses";
const TAB_MANUAL    = "manual_reports";
const TAB_LOGS      = "logs";

// ============================================================
//   엔트리 포인트
// ============================================================

/**
 * doPost — 설문 응답 수신
 * 호출 형식 (suvey.html → no-cors fetch JSON):
 * {
 *   "type": "submit",
 *   "uid": "...", "sessionId": "...",
 *   "name": "김영식", "email": "...",
 *   "submittedAt": "2025-09-11T10:00:00Z",
 *   "answers": { "Q3": 4, "Q6": ["계획적인","신중한","분석적인"], ... }
 * }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const type = body.type || "submit";

    if (type === "submit") {
      const row = appendResponse_(body);
      return jsonOut_({ ok: true, type, row });
    }
    if (type === "manual_report") {
      const row = upsertManualReport_(body);
      return jsonOut_({ ok: true, type, row });
    }
    if (type === "ping") {
      return jsonOut_({ ok: true, type: "pong", time: new Date().toISOString() });
    }
    return jsonOut_({ ok: false, error: "unknown_type", type });
  } catch (err) {
    log_("doPost ERROR: " + err.message + "\n" + err.stack);
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

/**
 * doGet — 수동 리포트 조회 (report-loading.html 폴링용)
 *   /exec?action=getManualReport&sessionId=xxxx
 *   /exec?action=health
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "health";

    if (action === "health") {
      return jsonOut_({ ok: true, status: "alive", time: new Date().toISOString() });
    }
    if (action === "getManualReport") {
      const sid = (e.parameter.sessionId || "").trim();
      if (!sid) return jsonOut_({ ok: false, error: "sessionId required" });
      const r = findManualReport_(sid);
      return jsonOut_({ ok: true, found: !!r, ...r });
    }
    return jsonOut_({ ok: false, error: "unknown_action", action });
  } catch (err) {
    log_("doGet ERROR: " + err.message);
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

// ============================================================
//   응답 저장 (responses 시트)
// ============================================================

function appendResponse_(body) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = getOrCreateSheet_(ss, TAB_RESPONSES);

  // 헤더(없으면 생성)
  const HEADER_META = [
    "saved_at", "uid", "sessionId", "name", "email",
    "submittedAt", "userAgent", "raw_json"
  ];
  // Q3..Q78 (메타 Q1, Q2 별도 — 이름/이메일과 중복이라 raw_json 에만 기록)
  const Q_IDS = [];
  for (let i = 3; i <= 78; i++) Q_IDS.push("Q" + i);
  const HEADER = HEADER_META.concat(Q_IDS);

  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight("bold").setBackground("#f1f3f5");
  }

  // 값 매핑
  const a = body.answers || {};
  const row = [
    new Date(),
    body.uid || "",
    body.sessionId || "",
    body.name || "",
    body.email || "",
    body.submittedAt || "",
    body.userAgent || "",
    JSON.stringify(body).slice(0, 49000)
  ];
  Q_IDS.forEach(qid => {
    const v = a[qid];
    if (v === undefined || v === null) row.push("");
    else if (Array.isArray(v))         row.push(v.join(" / "));
    else if (typeof v === "object")    row.push(JSON.stringify(v));
    else                                row.push(v);
  });

  sh.appendRow(row);
  return sh.getLastRow();
}

// ============================================================
//   수동 리포트 (manual_reports 시트)
// ============================================================

function upsertManualReport_(body) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = getOrCreateSheet_(ss, TAB_MANUAL);

  const HEADER = [
    "saved_at", "sessionId", "uid", "name",
    "manual_report_status", "manual_report_html", "memo"
  ];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight("bold").setBackground("#f1f3f5");
  }

  const sid = (body.sessionId || "").trim();
  if (!sid) throw new Error("sessionId required");

  // 동일 sessionId 행이 있으면 update, 없으면 append
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === sid) {
      sh.getRange(i + 1, 1).setValue(new Date());
      sh.getRange(i + 1, 5).setValue(body.manual_report_status || "ready");
      sh.getRange(i + 1, 6).setValue(body.manual_report_html || "");
      if (body.memo) sh.getRange(i + 1, 7).setValue(body.memo);
      return i + 1;
    }
  }
  sh.appendRow([
    new Date(),
    sid,
    body.uid || "",
    body.name || "",
    body.manual_report_status || "ready",
    body.manual_report_html || "",
    body.memo || ""
  ]);
  return sh.getLastRow();
}

function findManualReport_(sessionId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(TAB_MANUAL);
  if (!sh || sh.getLastRow() < 2) return {};
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === sessionId) {
      return {
        sessionId: data[i][1],
        uid: data[i][2],
        name: data[i][3],
        status: data[i][4],
        html: data[i][5],
        memo: data[i][6],
        savedAt: (data[i][0] instanceof Date) ? data[i][0].toISOString() : String(data[i][0])
      };
    }
  }
  return {};
}

// ============================================================
//   유틸
// ============================================================

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function log_(msg) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = getOrCreateSheet_(ss, TAB_LOGS);
    if (sh.getLastRow() === 0) sh.appendRow(["time", "message"]);
    sh.appendRow([new Date(), String(msg).slice(0, 50000)]);
  } catch (e) {
    Logger.log(msg);
  }
}

// ============================================================
//   ▶︎ 수동 테스트 (Apps Script 편집기에서 실행)
// ============================================================

/** 1) 시트 ID 연결이 잘 되었는지 확인 */
function test_openSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log("Opened: " + ss.getName());
}

/** 2) 가짜 응답을 한 줄 넣어보기 */
function test_appendDummy() {
  const fake = {
    type: "submit",
    uid: "test-uid",
    sessionId: "test-session-001",
    name: "테스트유저",
    email: "test@example.com",
    submittedAt: new Date().toISOString(),
    userAgent: "Apps Script test",
    answers: {
      Q3: 4, Q4: 5, Q5: 4,
      Q6: ["계획적인", "신중한", "분석적인"],
      Q7: "혼자 깊이 생각할 때",
      Q9: 5, Q10: 4
    }
  };
  const row = appendResponse_(fake);
  Logger.log("appended row: " + row);
}

/** 3) 가짜 수동 리포트 등록 테스트 */
function test_manualReport() {
  const row = upsertManualReport_({
    sessionId: "test-session-001",
    uid: "test-uid",
    name: "테스트유저",
    manual_report_status: "ready",
    manual_report_html: "<h1>테스트 리포트</h1><p>본문</p>",
    memo: "수동 테스트"
  });
  Logger.log("manual row: " + row);
}

/** 4) 김영식님 실제 응답 (Excel row 63, 2026-04-15) — E2E 검증용
 *  실행 후 시트 'responses' 탭 마지막 행에 김영식님 응답 1줄이 추가됩니다.
 *  실행 로그에 'KYS appended row: N' 형식으로 출력됩니다.
 *  56개 문항 모두 매핑 (Q3 ~ Q77).
 */
function test_appendKimYS() {
  const sid = "kys-real-" + new Date().getTime();
  const body = {
    type: "submit",
    uid: "kys-real-uid",
    sessionId: sid,
    name: "김영식",
    email: "ghwelcome0@gmail.com",
    submittedAt: "2026-04-15T17:16:05Z",
    userAgent: "E2E test (Excel row 63 / 2026-04-15)",
    answers: {
      Q3: 5,
      Q4: 4,
      Q5: 4,
      Q6: ["신중한", "도전적인", "분석적인"],
      Q7: "내 생각을 표현해야 할 때",
      Q9: 5,
      Q10: 4,
      Q11: 5,
      Q12: 5,
      Q13: ["사랑", "자유", "의미 추구"],
      Q14: "다른 사람과 갈등 중에도 내 기준을 지키고 싶을 때",
      Q16: 4,
      Q17: 4,
      Q18: 5,
      Q19: ["친구", "연인", "가족과의 중요한 관계 변화", "종교나 가치관의 변화"],
      Q21: ["기도", "명상", "종교 활동", "감정을 글이나 그림으로 표현하기"],
      Q23: 4,
      Q24: 4,
      Q25: 4,
      Q26: ["생각을 글이나 그림으로 표현하기", "신뢰하는 사람과 이야기 나누기"],
      Q28: ["잘 숨겨서 감정을 모르겠다는 말을 듣는다", "감정보다 논리적으로 말하는 편이다"],
      Q30: 3,
      Q31: ["새로운 시각을 제시하는 사람", "사람들을 연결해주는 사람"],
      Q33: ["진정성", "안정감"],
      Q35: 5,
      Q36: 3,
      Q37: 5,
      Q38: 5,
      Q39: ["사람들과 아이디어를 나누거나 토론하기", "문제를 분석하고 해결책을 찾는 일"],
      Q41: ["교육과 학습 방식", "리더십", "공동체", "관계"],
      Q43: 4,
      Q44: 5,
      Q45: 5,
      Q46: 3,
      Q47: ["정돈된 실내(정리된 내 방, 사무 공간)", "내 방이나 익숙한 공간"],
      Q49: ["아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴", "몰입 시간과 휴식 시간을 명확히 나누는 하루"],
      Q51: 5,
      Q52: 3,
      Q53: 5,
      Q54: 5,
      Q55: ["내가 의미 있다고 느끼는 일이기 때문에", "누군가에게 도움이 되기 때문에"],
      Q57: ["내가 만든 규칙이 있어서", "성과나 보상이 있었기 때문에"],
      Q59: 5,
      Q60: 5,
      Q61: 5,
      Q62: 4,
      Q63: ["의미 / 보람 / 가치", "신념 / 원칙 / 종교적 기준"],
      Q65: "멘토나 존경하는 인물의 가치관",
      Q67: 4,
      Q68: 4,
      Q69: 4,
      Q70: 2,
      Q71: ["구체적인 계획을 세우는 것", "멀리 내다보며 흐름을 설계하기"],
      Q73: "문제를 해결하고 결과가 나왔을 때, 내가 의미 있다고 여긴 일을 마쳤을 때",
      Q75: ["경제", "교육", "종교"],
      Q77: ["문제를 해결하거나 정책을 만드는 활동", "사람들의 삶을 돕고 지원하는 활동"]
    }
  };
  const row = appendResponse_(body);
  Logger.log("KYS appended row: " + row + " (sessionId=" + sid + ")");
  return { row: row, sessionId: sid };
}

/** 5) 김영식님 수동 리포트 자동 등록 (test_appendKimYS 실행 후 사용)
 *  report.html 의 자동 리포트 결과를 manual_reports 시트에 ready 상태로 저장.
 *  ※ sessionId 는 test_appendKimYS 결과 로그에서 복사하거나, 가장 최근 행의 sessionId 자동 사용.
 */
function test_manualReportKimYS() {
  // 가장 최근 김영식 응답의 sessionId 찾기
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(TAB_RESPONSES);
  if (!sh || sh.getLastRow() < 2) {
    Logger.log("ERROR: responses 시트에 데이터 없음. 먼저 test_appendKimYS 를 실행하세요.");
    return;
  }
  const data = sh.getDataRange().getValues();
  let kysSid = null;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][3]).includes("김영식")) { kysSid = data[i][2]; break; }
  }
  if (!kysSid) { Logger.log("ERROR: 김영식 응답을 찾을 수 없음"); return; }

  const html = "<h1>김영식님의 인생포트폴리오</h1>" +
    "<p><strong>유형</strong>: 정직·책임·성장 중심의 분석적 설계자</p>" +
    "<p>이 자리는 자동 리포트가 들어가는 영역입니다. " +
    "원하시면 ChatGPT/Claude 로 직접 작성한 HTML로 교체하세요.</p>";

  const row = upsertManualReport_({
    sessionId: kysSid,
    uid: "kys-real-uid",
    name: "김영식",
    manual_report_status: "ready",
    manual_report_html: html,
    memo: "E2E test 자동 등록 (" + new Date().toISOString() + ")"
  });
  Logger.log("KYS manual report row: " + row + " (sessionId=" + kysSid + ")");
}
