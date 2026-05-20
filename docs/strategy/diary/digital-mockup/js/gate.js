/* ============================================================
   인생포트폴리오 맞춤형 다이어리 — 디지털 목업 v1.3
   gate.js — 시안 보안 게이트 (비밀번호 단일 입력 + sessionStorage)

   🔒 보안 모델:
   - SHA-256 해시 비교 (평문 PW 코드 내 미저장)
   - sessionStorage = 탭 닫을 때까지만 인증 유지
   - 1차 차단 — URL을 알아도 비밀번호 없이 접근 불가
   - 비밀번호는 별도 채널로 제조사에 전달

   비밀번호: dlstodvhxmvhffldh zjtmxja
     (= "인생포트폴리오 커스텀" 한글 키보드 입력의 영문 표기)
   ============================================================ */

(function () {
  'use strict';

  // sha256("dlstodvhxmvhffldh zjtmxja")
  const PW_HASH = '75ab6fd892bcc151a5d7e38241cc6b89ea322de38763f88bfad8a83d48b01dca';
  const SESSION_KEY = 'lp_diary_mockup_authed_v13';

  // SHA-256 (Web Crypto API)
  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function buildGate() {
    const gate = document.createElement('div');
    gate.id = 'security-gate';
    gate.innerHTML = `
      <div class="gate-box">
        <div class="gate-brand">LIFE · PORTFOLIO</div>
        <div class="gate-onlyone">Only One</div>
        <h1 class="gate-title">시안 검토 권한 확인</h1>
        <p class="gate-desc">
          본 시안은 <strong>제조사 검토 및 사내 리뷰 전용</strong>입니다.<br>
          안내받은 비밀번호를 입력해 주세요.
        </p>
        <form id="gate-form" class="gate-form">
          <input type="text" name="username" autocomplete="username" value="diary-mockup" aria-hidden="true" tabindex="-1" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;left:-9999px;">
          <label class="gate-label">
            <span>Password</span>
            <input type="password" id="gate-pw" autocomplete="current-password" placeholder="비밀번호 입력" required>
          </label>
          <button type="submit" class="gate-btn">확인 ▶</button>
          <div id="gate-error" class="gate-error" hidden>비밀번호가 일치하지 않습니다.</div>
        </form>
        <div class="gate-footer">
          <small>비밀번호를 모르시는 경우 Life Portfolio 담당자에게 문의해 주세요.</small>
        </div>
      </div>
    `;
    return gate;
  }

  function showGate() {
    document.body.classList.add('gate-locked');
    const gate = buildGate();
    document.body.appendChild(gate);

    document.getElementById('gate-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('gate-pw').value;
      const errEl = document.getElementById('gate-error');

      const pwH = await sha256(pw);

      if (pwH === PW_HASH) {
        sessionStorage.setItem(SESSION_KEY, '1');
        gate.classList.add('fade-out');
        setTimeout(() => {
          gate.remove();
          document.body.classList.remove('gate-locked');
        }, 400);
      } else {
        errEl.hidden = false;
        document.getElementById('gate-pw').value = '';
        document.getElementById('gate-pw').focus();
        setTimeout(() => { errEl.hidden = true; }, 4000);
      }
    });

    setTimeout(() => {
      const pwEl = document.getElementById('gate-pw');
      if (pwEl) pwEl.focus();
    }, 100);
  }

  if (sessionStorage.getItem(SESSION_KEY) !== '1') {
    if (document.body) {
      showGate();
    } else {
      document.addEventListener('DOMContentLoaded', showGate);
    }
  }
})();
