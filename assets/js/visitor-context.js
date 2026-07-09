/**
 * visitor-context.js — Life Portfolio (P1 자비스급 UX/UI 스프린트, 작업 기반 모듈)
 * =============================================================================
 * 방문자 컨텍스트 판별 순수 모듈 (Day 0.5 무변경 기반 작업).
 *
 * 역할:
 *   - 리포트 보유/재생성 이력/재방문 여부를 로컬 신호만으로 판별하여
 *     4단계 visitor_state 를 계산한다.
 *   - curation-matrix-v1.json 의 visitor_state_rules 와 1:1 정합:
 *       first_time_visitor / returning_no_report / report_holder / seasoned_holder
 *   - DOM 을 건드리지 않는다(비파괴). 상태만 window.LP_VISITOR 로 노출한다.
 *   - 마지막 방문 축(last_visited_axis)과 방문 횟수만 로컬에 기록한다.
 *
 * 노출 API (window.LP_VISITOR):
 *   .state()          -> 'first_time_visitor' | 'returning_no_report'
 *                        | 'report_holder' | 'seasoned_holder'
 *   .context()        -> { state, isReturning, hasReport, hasRegen,
 *                          visitCount, lastAxis, lastPage, lang }
 *   .rulesFor(state)  -> matrix 의 해당 state rules (matrix 로드 시)
 *   .setLastAxis(ax)  -> 페이지별 축 기록 (returning_no_report 컨텍스트용)
 *   .onReady(cb)      -> 컨텍스트 확정 후 콜백
 *   .refresh()        -> 신호 재평가
 *
 * 저장 키 (기존 lp_ 컨벤션 준수, 신규 키만 추가):
 *   lp_visit_count      방문 세션 횟수 (재방문 판별)
 *   lp_last_visit_at    마지막 방문 시각(ms)
 *   lp_last_axis        마지막 방문 페이지의 4축(자기이해/표현/설계/실행)
 *   lp_last_page        마지막 방문 경로
 *   (읽기 전용 참조: lp_paid, lp_paid_uid, lp_last_uid — 기존 결제/로그인 신호)
 *
 * 리포트 보유/재생성 판별은 "로컬에서 확보 가능한 신호"만 사용한다.
 *   - hasReport  : lp_paid 계열 신호 또는 lp_report_view_pushed 존재
 *   - hasRegen   : lp_regen_seen 로컬 플래그 (report/program 재생성 성공 시 세팅 예정)
 *   RTDB editCount 정밀 판별은 P2(로그인 세션 연동)에서 보강. 현 단계는 UX 힌트용.
 */
(function (w) {
  'use strict';

  var LS = null;
  try { LS = w.localStorage; } catch (e) { LS = null; }

  function get(k) { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (LS) LS.setItem(k, v); } catch (e) { /* private mode */ } }

  var STATE = {
    FIRST: 'first_time_visitor',
    RETURN_NO_REPORT: 'returning_no_report',
    HOLDER: 'report_holder',
    SEASONED: 'seasoned_holder'
  };

  // ---- 로컬 신호 수집 -------------------------------------------------------
  function readSignals() {
    // 결제/보유 신호: 기존 결제 플로우가 세팅하는 키들 중 하나라도 유효하면 보유로 간주
    var paid = get('lp_paid');
    var paidUid = get('lp_paid_uid');
    var paidUntil = get('lp_paid_until');
    var reportViewed = get('lp_report_view_pushed');

    var hasReport = false;
    if (paid && paid !== '0' && paid !== 'false') hasReport = true;
    if (paidUid) hasReport = true;
    if (reportViewed) hasReport = true;
    // paid_until 이 미래면 유효 보유
    if (paidUntil) {
      var until = parseInt(paidUntil, 10);
      if (!isNaN(until) && until > Date.now()) hasReport = true;
    }

    // 재생성 이력 신호 (로컬 힌트). report/program 재생성 성공 시 lp_regen_seen='1'.
    var regen = get('lp_regen_seen');
    var hasRegen = !!(regen && regen !== '0' && regen !== 'false');

    // 방문 횟수 (이번 진입 반영 전 값)
    var vc = parseInt(get('lp_visit_count') || '0', 10);
    if (isNaN(vc)) vc = 0;

    var lang = get('lp_lang') || (w.LP_I18N && w.LP_I18N.lang) || 'ko';

    return {
      hasReport: hasReport,
      hasRegen: hasRegen,
      priorVisits: vc,
      lastAxis: get('lp_last_axis') || null,
      lastPage: get('lp_last_page') || null,
      lang: lang
    };
  }

  // ---- 상태 판별 -----------------------------------------------------------
  function computeState(sig) {
    if (sig.hasReport) {
      return sig.hasRegen ? STATE.SEASONED : STATE.HOLDER;
    }
    // 미보유
    return sig.priorVisits > 0 ? STATE.RETURN_NO_REPORT : STATE.FIRST;
  }

  // ---- 방문 세션 기록 (재방문 판별용) --------------------------------------
  // 30분 이상 간격이면 새 세션 방문으로 카운트.
  var SESSION_GAP_MS = 30 * 60 * 1000;
  function recordVisit() {
    var now = Date.now();
    var lastAt = parseInt(get('lp_last_visit_at') || '0', 10);
    if (isNaN(lastAt)) lastAt = 0;
    if (now - lastAt > SESSION_GAP_MS) {
      var vc = parseInt(get('lp_visit_count') || '0', 10);
      if (isNaN(vc)) vc = 0;
      set('lp_visit_count', String(vc + 1));
    }
    set('lp_last_visit_at', String(now));
  }

  // ---- 매트릭스 rules 연동 (선택적) ----------------------------------------
  var _matrix = null;
  var _rulesByState = {};
  function attachMatrix(matrix) {
    if (!matrix || !Array.isArray(matrix.visitor_state_rules)) return;
    _matrix = matrix;
    matrix.visitor_state_rules.forEach(function (r) {
      if (r && r.visitor_state) _rulesByState[r.visitor_state] = r.rules || {};
    });
  }

  // ---- 컨텍스트 확정 -------------------------------------------------------
  var _ctx = null;
  var _readyCbs = [];
  var _ready = false;

  // 이번 페이지 진입 시점의 방문 횟수(직전까지의 세션 수)를 고정 저장.
  // recordVisit() 로 lp_visit_count 가 증가한 뒤에도 판별 기준이 흔들리지 않게 한다.
  var _entryPriorVisits = null;

  function build() {
    var sig = readSignals();
    // 진입 시점 값 고정: 최초 build 에서 캡처, 이후 refresh 는 이 값을 유지.
    if (_entryPriorVisits === null) _entryPriorVisits = sig.priorVisits;
    sig.priorVisits = _entryPriorVisits;
    var state = computeState(sig);
    _ctx = {
      state: state,
      isReturning: sig.priorVisits > 0,
      hasReport: sig.hasReport,
      hasRegen: sig.hasRegen,
      visitCount: sig.priorVisits,       // 이번 진입 반영 전(직전까지) 세션 수
      lastAxis: sig.lastAxis,
      lastPage: sig.lastPage,
      lang: sig.lang
    };
    return _ctx;
  }

  function fireReady() {
    _ready = true;
    var cbs = _readyCbs.slice();
    _readyCbs.length = 0;
    cbs.forEach(function (cb) { try { cb(_ctx); } catch (e) { /* noop */ } });
  }

  // ---- 공개 API ------------------------------------------------------------
  var API = {
    STATES: STATE,

    state: function () { return (_ctx || build()).state; },
    context: function () { return _ctx || build(); },

    refresh: function () { build(); return _ctx; },

    rulesFor: function (state) {
      var s = state || (_ctx && _ctx.state);
      return s ? (_rulesByState[s] || null) : null;
    },

    // 페이지에서 자신의 4축을 기록 (returning_no_report 컨텍스트 큐레이션용)
    setLastAxis: function (axis, pagePath) {
      if (axis) set('lp_last_axis', String(axis));
      set('lp_last_page', pagePath || (w.location && w.location.pathname) || '');
      if (_ctx) { _ctx.lastAxis = axis || _ctx.lastAxis; }
    },

    // 재생성 성공 시 report/program 에서 호출 → seasoned_holder 승격 신호
    markRegenerated: function () { set('lp_regen_seen', '1'); if (_ctx) { _ctx.hasRegen = true; build(); } },

    attachMatrix: attachMatrix,

    onReady: function (cb) {
      if (typeof cb !== 'function') return;
      if (_ready) { try { cb(_ctx); } catch (e) {} }
      else _readyCbs.push(cb);
    }
  };

  // ---- 초기화 --------------------------------------------------------------
  function init() {
    // 판별 신호는 "이번 진입 반영 전" 값 기준이어야 하므로 build()를 먼저 수행한다.
    // recordVisit()가 lp_visit_count 를 증가시키기 전에 상태를 확정해야
    // 최초 방문자가 returning 으로 오분류되지 않는다.
    build();
    recordVisit();   // 세션 방문 기록 (다음 진입부터 재방문 신호로 사용)
    fireReady();
  }

  w.LP_VISITOR = API;

  if (w.document && w.document.readyState === 'loading') {
    w.document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
