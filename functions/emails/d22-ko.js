/**
 * 21일 점검 D22 안내 이메일 — 한국어 템플릿
 * ===========================================================
 *
 * 발송 시점: purchase_date + 21일 (D22 = 22일째 되는 날) 오전 09:00 KST
 * 발송 대상: checkin21_preorders 의 status='pending' 사전 신청자 (현재 베타 무료)
 *
 * 메시지 톤 결정 기록:
 *   - "21일 동안 살아내신 것 자체가 결과" — 죄책감 없이 환영
 *   - "베타 점검 + 향후 결제 시 ₩5,000 추가 할인" — 현재 단계 정직 명시
 *   - WHAT 4가지 거울 — 랜딩페이지 카피와 일관 유지
 *   - 자가 점검 폼은 Sprint Week 3에서 활성화 — 현재는 "곧 안내" placeholder
 *
 * 사용 예시:
 *   const { buildD22EmailKo } = require('./emails/d22-ko');
 *   const { subject, html, text } = buildD22EmailKo({
 *     name: '홍길동',
 *     purchaseDateIso: '2026-04-25',
 *     formUrl: 'https://lifeportfolio.co.kr/checkin-21.html',
 *     replyTo: 'faise@lifeportfolio.co.kr',
 *   });
 */

'use strict';

/**
 * 이름을 안전하게 인사말로 변환
 * - 공백 제거 후 비어있으면 "선생님"으로 폴백
 * - HTML 이스케이프 (XSS 방지)
 */
function safeGreetingName(name) {
  const trimmed = (name || '').toString().trim();
  const safe = trimmed.length > 0 ? trimmed : '선생님';
  return escapeHtml(safe);
}

/**
 * HTML 이스케이프
 */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ISO 날짜(YYYY-MM-DD)를 한국어로 포맷 — "2026년 4월 25일"
 */
function formatKoreanDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.toString());
  if (!m) return '';
  return `${m[1]}년 ${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
}

/**
 * D22 한국어 이메일 빌더
 *
 * @param {Object} params
 * @param {string} params.name              사용자 이름
 * @param {string} params.purchaseDateIso   리포트 받은 날짜 (YYYY-MM-DD)
 * @param {string} params.formUrl           자가 점검 폼 URL (Week 3 활성화 예정)
 * @param {string} [params.replyTo]         회신 이메일 (CTA 백업용)
 * @returns {{subject: string, html: string, text: string}}
 */
function buildD22EmailKo(params) {
  const name = safeGreetingName(params.name);
  const purchaseDateLabel = formatKoreanDate(params.purchaseDateIso);
  const formUrl = (params.formUrl || 'https://lifeportfolio.co.kr/checkin-21.html').toString();
  const replyTo = (params.replyTo || 'faise@lifeportfolio.co.kr').toString();

  const subject = '[Life Portfolio] 21일이 지났습니다 — 거울 앞으로 와주세요';

  // ---------- HTML 버전 (이메일 클라이언트 호환) ----------
  // 이메일 클라이언트 호환을 위해 table-based layout 사용
  // Inline CSS 우선 (Gmail/Outlook 호환)
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a2332;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f7f5f0;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);">

        <!-- 헤더 -->
        <tr>
          <td style="padding:32px 40px 8px 40px;border-bottom:3px solid #c9a961;">
            <div style="font-size:14px;letter-spacing:1px;color:#c9a961;font-weight:700;text-transform:uppercase;">Life Portfolio · D22</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">21일 점검 동행 · 인생포트폴리오</div>
          </td>
        </tr>

        <!-- 본문 시작 -->
        <tr>
          <td style="padding:36px 40px 8px 40px;">
            <h1 style="font-size:24px;line-height:1.4;color:#1a2332;margin:0 0 20px 0;font-weight:700;">
              ${name}님, 21일을 살아내셨군요.
            </h1>
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 16px 0;">
              ${purchaseDateLabel ? `${escapeHtml(purchaseDateLabel)}에 리포트를 받으신 뒤,` : '리포트를 받으신 뒤,'}
              스물한 번의 아침이 지났습니다.
            </p>
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 16px 0;">
              잘 살았는지, 부족했는지를 따지자는 게 아닙니다.
              <b style="color:#1a2332;">21일을 살아내신 것 자체</b>가 이미 결과입니다.
              저희가 함께하고 싶은 건, 그 21일이 어떤 모양이었는지
              <b style="color:#c9a961;">4가지 거울로 정직하게 들여다보는 일</b>입니다.
            </p>
          </td>
        </tr>

        <!-- WHAT — 4가지 거울 박스 -->
        <tr>
          <td style="padding:8px 40px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#faf8f3;border-left:4px solid #c9a961;border-radius:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:13px;font-weight:700;color:#c9a961;letter-spacing:0.5px;margin-bottom:12px;">21일을 되돌아보는 4가지 거울</div>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">축 A</b> · 사명 일치도 — 21일 동안 사명을 몇 번 의식했나요?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">축 B</b> · 첫 행동 3개 실행률 — 리포트가 제안한 첫 행동들은 어떻게 되었나요?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">축 C</b> · 다음 3주 명확도 — 다음 3주가 머릿속에 그려지나요?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">축 D ⭐</b> · 자산화 수준 — 살아낸 21일이 삶의 자산으로 남았나요?
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA 박스 -->
        <tr>
          <td style="padding:28px 40px 8px 40px;">
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 20px 0;">
              <b style="color:#1a2332;">현재 21일 점검 동행은 사전 신청 베타 단계</b>이며,
              ${name}님은 <b style="color:#c9a961;">정식 출시 이전 무료로 점검을 받으실 수 있는 분</b>이십니다.
              정식 출시일과 자가 점검 페이지가 준비되는 대로
              <b>이 메일 주소로 우선 안내</b>드리며,
              결제하시는 시점에 <b style="color:#c9a961;">사전 신청자 ₩5,000 추가 할인</b>이 자동 적용됩니다.
            </p>
          </td>
        </tr>

        <!-- Primary CTA Button -->
        <tr>
          <td align="center" style="padding:8px 40px 12px 40px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="background:#c9a961;border-radius:8px;">
                  <a href="${escapeHtml(formUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                    21일 점검 안내 페이지 →
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#94a3b8;margin:10px 0 0 0;">
              ※ 자가 점검 폼은 정식 출시와 함께 별도 메일로 안내드립니다.
            </p>
          </td>
        </tr>

        <!-- 부드러운 클로징 -->
        <tr>
          <td style="padding:20px 40px 32px 40px;">
            <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 12px 0;">
              혹시 21일을 떠올리며 떠오르는 한 줄이 있다면,
              이 메일에 그대로 회신해주세요.
              정식 출시 시 ${name}님께 가장 어울리는 점검 방식을 함께 정리해드리겠습니다.
            </p>
            <p style="font-size:14px;line-height:1.7;color:#1a2332;margin:0;font-weight:600;">
              살아내신 21일에, 진심으로 감사드립니다.<br>
              <span style="color:#c9a961;">— Life Portfolio 드림</span>
            </p>
          </td>
        </tr>

        <!-- 푸터 -->
        <tr>
          <td style="padding:20px 40px 28px 40px;background:#f7f5f0;border-top:1px solid #e2e8f0;">
            <p style="font-size:11px;line-height:1.7;color:#94a3b8;margin:0 0 6px 0;">
              본 메일은 <b style="color:#475569;">21일 점검 동행 사전 신청자</b>에게만 발송됩니다.
              회신: <a href="mailto:${escapeHtml(replyTo)}" style="color:#c9a961;text-decoration:none;">${escapeHtml(replyTo)}</a>
            </p>
            <p style="font-size:11px;line-height:1.7;color:#94a3b8;margin:0;">
              Life Portfolio · 인생포트폴리오 · <a href="https://lifeportfolio.co.kr" style="color:#94a3b8;text-decoration:underline;">lifeportfolio.co.kr</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // ---------- Plain text 버전 (스팸 점수 ↓, 텍스트 클라이언트용) ----------
  const text = [
    `${name}님, 21일을 살아내셨군요.`,
    '',
    purchaseDateLabel
      ? `${purchaseDateLabel}에 리포트를 받으신 뒤, 스물한 번의 아침이 지났습니다.`
      : '리포트를 받으신 뒤, 스물한 번의 아침이 지났습니다.',
    '',
    '잘 살았는지, 부족했는지를 따지자는 게 아닙니다.',
    '21일을 살아내신 것 자체가 이미 결과입니다.',
    '저희가 함께하고 싶은 건, 그 21일이 어떤 모양이었는지',
    '4가지 거울로 정직하게 들여다보는 일입니다.',
    '',
    '─────────────────────────',
    '21일을 되돌아보는 4가지 거울',
    '─────────────────────────',
    '축 A · 사명 일치도 — 21일 동안 사명을 몇 번 의식했나요?',
    '축 B · 첫 행동 3개 실행률 — 리포트가 제안한 첫 행동들은 어떻게 되었나요?',
    '축 C · 다음 3주 명확도 — 다음 3주가 머릿속에 그려지나요?',
    '축 D ⭐ 자산화 수준 — 살아낸 21일이 삶의 자산으로 남았나요?',
    '',
    '─────────────────────────',
    '',
    `현재 21일 점검 동행은 사전 신청 베타 단계이며,`,
    `${name}님은 정식 출시 이전 무료로 점검을 받으실 수 있는 분이십니다.`,
    `정식 출시일과 자가 점검 페이지가 준비되는 대로`,
    `이 메일 주소로 우선 안내드리며,`,
    `결제하시는 시점에 사전 신청자 ₩5,000 추가 할인이 자동 적용됩니다.`,
    '',
    `▶ 21일 점검 안내 페이지: ${formUrl}`,
    '',
    '※ 자가 점검 폼은 정식 출시와 함께 별도 메일로 안내드립니다.',
    '',
    '─────────────────────────',
    '',
    '혹시 21일을 떠올리며 떠오르는 한 줄이 있다면,',
    '이 메일에 그대로 회신해주세요.',
    `정식 출시 시 ${name}님께 가장 어울리는 점검 방식을 함께 정리해드리겠습니다.`,
    '',
    '살아내신 21일에, 진심으로 감사드립니다.',
    '— Life Portfolio 드림',
    '',
    '─────────────────────────',
    '본 메일은 21일 점검 동행 사전 신청자에게만 발송됩니다.',
    `회신: ${replyTo}`,
    'Life Portfolio · 인생포트폴리오 · https://lifeportfolio.co.kr',
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildD22EmailKo,
  // 테스트/유닛 테스트용 노출
  _internals: { safeGreetingName, escapeHtml, formatKoreanDate },
};
