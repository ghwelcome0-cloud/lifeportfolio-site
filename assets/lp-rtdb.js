/*!
 * lp-rtdb.js — 인생포트폴리오 공용 RTDB 접속 모듈 (PR#200)
 * ---------------------------------------------------------------------------
 * [근본 원인]
 *   Firebase RTDB 가 asia-southeast1 리전에 있어, Firebase SDK 의
 *   get()/set()/update() 는 WebSocket 핸드셰이크 지연/행(hang) 이 만성적으로 발생
 *   (8~20초 timeout 또는 무한 대기). 반면 REST(.json?auth=<idToken>) 엔드포인트는
 *   수백 ms 안에 응답한다.
 *
 * [해결]
 *   "REST 우선 + 모든 호출에 데드라인 + SDK 폴백" 패턴을 단일 모듈에 통합한다.
 *   suvey/report-loading 에서 개별적으로 검증된 로직을 한 곳으로 모아,
 *   RTDB 를 쓰는 모든 페이지가 이 모듈만 호출하도록 한다.
 *   → 버그 수정 지점이 51개 페이지 → 1개 모듈로 축소.
 *   → 앞으로 만드는 새 페이지도 자동으로 이 안전장치를 상속.
 *
 * [사용법] (일반 <script>, 비-module. window.LPRTDB 로 노출)
 *   1) Firebase SDK(module) 초기화 후, 인스턴스를 주입:
 *        LPRTDB.init({
 *          auth: auth,               // getAuth(app) 결과
 *          db: db,                   // getDatabase(app) 결과
 *          databaseURL: firebaseConfig.databaseURL,
 *          sdk: { ref, get, set, update, serverTimestamp } // SDK 함수 (폴백용)
 *        });
 *   2) 읽기:  const { exists, val } = await LPRTDB.readNode("reports/uid/sid");
 *   3) 쓰기:  const ok = await LPRTDB.writeNode("programs/uid/sid", body, "set"|"update");
 *
 * [비파괴] 기존 페이지의 자체 헬퍼를 강제 대체하지 않는다. 페이지가 이 모듈을
 *   로드하고 init 한 경우에만 사용한다. init 전 호출 시 명확한 에러를 던진다.
 */
(function (global) {
  "use strict";

  var _ctx = null; // { auth, db, databaseURL(정규화), sdk }

  function _isMobile() {
    try {
      return /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    } catch (_) { return false; }
  }

  var IS_MOBILE = _isMobile();

  // 기본 데드라인(ms). 모바일은 네트워크가 느려 넉넉히.
  var DEFAULTS = {
    idToken: 6000,
    restRead: IS_MOBILE ? 12000 : 9000,
    restWrite: IS_MOBILE ? 15000 : 12000,
    sdkRead: IS_MOBILE ? 12000 : 8000,
    sdkWrite: IS_MOBILE ? 12000 : 8000
  };

  /**
   * 초기화. Firebase SDK 인스턴스를 주입한다.
   */
  function init(opts) {
    if (!opts || !opts.auth || !opts.db || !opts.databaseURL) {
      throw new Error("[LPRTDB] init: auth/db/databaseURL 필수");
    }
    _ctx = {
      auth: opts.auth,
      db: opts.db,
      databaseURL: String(opts.databaseURL).replace(/\/+$/, ""),
      sdk: opts.sdk || null
    };
    return _ctx;
  }

  function _need() {
    if (!_ctx) throw new Error("[LPRTDB] init() 을 먼저 호출하세요.");
    return _ctx;
  }

  /**
   * 프로미스에 데드라인을 건다. 시간 초과 시 fallbackValue 로 resolve (reject 안 함).
   * → 어떤 RTDB 호출도 무한 대기하지 않도록 보장.
   */
  function withTimeout(promise, maxMs, fallbackValue) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return; done = true; resolve(fallbackValue);
      }, maxMs);
      Promise.resolve(promise).then(function (v) {
        if (done) return; done = true; clearTimeout(t); resolve(v);
      }, function () {
        if (done) return; done = true; clearTimeout(t); resolve(fallbackValue);
      });
    });
  }

  // 성공/실패를 구분하기 위한 특수 심볼 (값이 null 인 경우와 REST 실패를 구별).
  var REST_FAIL = { __lpRestFail: true };

  function _isRestFail(v) { return v === REST_FAIL; }

  /**
   * idToken 획득 (데드라인 포함). 실패 시 null.
   */
  async function _idToken(ms) {
    var c = _need();
    var u = c.auth.currentUser;
    if (!u) return null;
    var idt = await withTimeout(u.getIdToken(false), ms || DEFAULTS.idToken, null);
    return idt || null;
  }

  /**
   * REST GET. 성공 시 값(객체/원시값/null), 실패 시 REST_FAIL.
   * path 예: "reports/uid/sid"
   */
  async function restGet(path, ms) {
    try {
      var c = _need();
      var idt = await _idToken();
      if (!idt) return REST_FAIL;
      var url = c.databaseURL + "/" + String(path).replace(/^\/+/, "") + ".json?auth=" + encodeURIComponent(idt);
      var ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var to = setTimeout(function () { if (ac) try { ac.abort(); } catch (_) {} }, ms || DEFAULTS.restRead);
      var r = await fetch(url, { method: "GET", mode: "cors", cache: "no-store", credentials: "omit", signal: ac ? ac.signal : undefined });
      clearTimeout(to);
      if (!r.ok) {
        var t = ""; try { t = (await r.text()).slice(0, 160); } catch (_) {}
        console.warn("[LPRTDB] REST GET " + r.status + " " + path, t);
        return REST_FAIL;
      }
      return await r.json();
    } catch (e) {
      console.warn("[LPRTDB] REST GET 실패:", path, e && e.message);
      return REST_FAIL;
    }
  }

  /**
   * REST 쓰기(PUT=set / PATCH=update). 성공 true, 실패 false.
   */
  async function restWrite(path, body, method, ms) {
    try {
      var c = _need();
      var idt = await _idToken();
      if (!idt) return false;
      var m = (String(method || "PUT").toUpperCase() === "PATCH") ? "PATCH" : "PUT";
      var url = c.databaseURL + "/" + String(path).replace(/^\/+/, "") + ".json?auth=" + encodeURIComponent(idt);
      var ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var to = setTimeout(function () { if (ac) try { ac.abort(); } catch (_) {} }, ms || DEFAULTS.restWrite);
      var r = await fetch(url, {
        method: m,
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
        signal: ac ? ac.signal : undefined
      });
      clearTimeout(to);
      if (!r.ok) {
        var t = ""; try { t = (await r.text()).slice(0, 160); } catch (_) {}
        console.warn("[LPRTDB] REST " + m + " " + r.status + " " + path, t);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("[LPRTDB] REST 쓰기 실패:", path, e && e.message);
      return false;
    }
  }

  /**
   * 노드 읽기: REST 우선 → 실패 시 SDK get() 폴백(데드라인 포함).
   * 반환: { exists:boolean, val:any }
   * path 예: "reports/uid/sid"
   */
  async function readNode(path, opts) {
    opts = opts || {};
    var c = _need();
    // 1) REST 우선
    var v = await restGet(path, opts.restMs);
    if (!_isRestFail(v)) {
      return { exists: v !== null && v !== undefined, val: v };
    }
    // 2) SDK 폴백 (SDK 함수가 주입된 경우에만)
    if (c.sdk && c.sdk.ref && c.sdk.get) {
      var snap = await withTimeout(c.sdk.get(c.sdk.ref(c.db, path)), opts.sdkMs || DEFAULTS.sdkRead, null);
      if (snap && typeof snap.exists === "function") {
        return { exists: snap.exists(), val: snap.exists() ? snap.val() : null };
      }
    }
    // 3) 완전 실패
    return { exists: false, val: null, __failed: true };
  }

  /**
   * 노드 쓰기: REST 우선 → 실패 시 SDK set/update 폴백(데드라인 포함).
   * mode: "set"(PUT) | "update"(PATCH). 반환: boolean(성공 여부).
   *
   * 주의: serverTimestamp 는 REST 에서 {".sv":"timestamp"} 로 표현한다.
   *   호출자가 body 안에 이미 {".sv":"timestamp"} 를 넣어두면 REST/SDK 양쪽 모두 처리됨
   *   (SDK 폴백 시에는 sdk.serverTimestamp() 로 자동 치환).
   */
  async function writeNode(path, body, mode, opts) {
    opts = opts || {};
    var c = _need();
    var method = (mode === "update") ? "PATCH" : "PUT";
    // 1) REST 우선 (body 의 {".sv":"timestamp"} 는 REST 가 그대로 인식)
    var ok = await restWrite(path, body, method, opts.restMs);
    if (ok) return true;
    // 2) SDK 폴백
    if (c.sdk && c.sdk.ref && (c.sdk.set || c.sdk.update)) {
      var sdkBody = _svToSdk(body, c.sdk.serverTimestamp);
      var op = (mode === "update")
        ? (c.sdk.update ? c.sdk.update(c.sdk.ref(c.db, path), sdkBody) : null)
        : (c.sdk.set ? c.sdk.set(c.sdk.ref(c.db, path), sdkBody) : null);
      if (op) {
        var res = await withTimeout(op, opts.sdkMs || DEFAULTS.sdkWrite, "__lp_timeout__");
        if (res !== "__lp_timeout__") return true;
      }
    }
    return false;
  }

  /**
   * body 안의 {".sv":"timestamp"} 를 SDK serverTimestamp() 로 재귀 치환(SDK 폴백용).
   */
  function _svToSdk(obj, serverTimestampFn) {
    if (!serverTimestampFn) return obj;
    if (obj && typeof obj === "object") {
      if (obj[".sv"] === "timestamp") return serverTimestampFn();
      if (Array.isArray(obj)) return obj.map(function (x) { return _svToSdk(x, serverTimestampFn); });
      var out = {};
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          out[k] = _svToSdk(obj[k], serverTimestampFn);
        }
      }
      return out;
    }
    return obj;
  }

  global.LPRTDB = {
    init: init,
    withTimeout: withTimeout,
    restGet: restGet,
    restWrite: restWrite,
    readNode: readNode,
    writeNode: writeNode,
    isMobile: IS_MOBILE,
    DEFAULTS: DEFAULTS,
    REST_FAIL: REST_FAIL,
    version: "PR#200"
  };
})(typeof window !== "undefined" ? window : this);
