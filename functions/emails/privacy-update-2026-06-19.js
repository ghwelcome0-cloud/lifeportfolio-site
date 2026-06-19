/**
 * 개인정보처리방침 개정 안내 이메일 — 한/영 병기 템플릿
 * =====================================================================
 *
 * 발송 시점: 2026-06-19 개정 시행에 따른 사후/현황 고지
 * 발송 대상: Firebase Authentication 가입 회원 전체 (한·영 서비스 공통)
 *
 * 법적 근거 / 벤치마킹:
 *   - 개인정보 보호법 제30조: 처리방침 변경 시 변경 전·후를 비교하여
 *     정보주체가 확인할 수 있도록 공개
 *   - 일반(불리하지 않은) 변경: 시행 7일 전 고지 — 본 개정은 위탁 현황
 *     정정·축소이므로 7일 룰 적용
 *   - 구조: 네이버/카카오 개정 고지 표준 따름
 *       1) 변경사항 (변경 전 / 변경 후 대조표)
 *       2) 변경(시행)일자
 *       3) 이의제기 및 문의 (문의처 + 미동의 시 안내 + 회원탈퇴권)
 *
 * 한 통의 메일에 한국어 → 구분선 → English 순으로 병기한다.
 * (한·영 서비스를 동시 운영하므로 수신자가 어느 언어든 확인 가능)
 *
 * 사용 예시:
 *   const { buildPrivacyUpdateEmail } = require('./emails/privacy-update-2026-06-19');
 *   const { subject, html, text } = buildPrivacyUpdateEmail({
 *     privacyUrl: 'https://lifeportfolio.co.kr/privacy.html',
 *     b2bPrivacyUrl: 'https://lifeportfolio.co.kr/b2b-privacy.html',
 *     contactEmail: 'faise@lifeportfolio.co.kr',
 *   });
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 개정 메타데이터 (단일 출처 — 본문/팝업이 동일 내용 사용)
// ─────────────────────────────────────────────────────────────────────────────
const EFFECTIVE_DATE_KO = '2026년 6월 19일';
const EFFECTIVE_DATE_EN = 'June 19, 2026';
const COMPANY_KO = '인생포트폴리오 (파이스)';
const COMPANY_EN = 'Life Portfolio (FAISE)';

/**
 * 변경 전·후 대조 항목 (한/영)
 * - before/after 가 핵심. 네이버 표 구조와 동일.
 */
const CHANGES = [
  {
    no: 1,
    ko: {
      title: '웹 호스팅 수탁업체 정정',
      before: '웹 호스팅/배포: GitHub, Inc. (GitHub Pages)',
      after: '웹 호스팅/배포: Google LLC (Firebase Hosting)',
      note: '실제 운영 중인 호스팅 환경에 맞게 위탁처를 정정하였습니다.',
    },
    en: {
      title: 'Correction of web hosting processor',
      before: 'Web hosting/deployment: GitHub, Inc. (GitHub Pages)',
      after: 'Web hosting/deployment: Google LLC (Firebase Hosting)',
      note: 'Updated the processor to reflect the actual hosting environment in operation.',
    },
  },
  {
    no: 2,
    ko: {
      title: '설문 수집(Google Forms) 이용 범위 한정',
      before: '설문 수집: Google LLC (Google Forms) — 상시 이용',
      after: '설문 수집(긴급 시 한정): Google LLC (Google Forms) — 평소에는 자체 진단 검사 기능을 사용하며, 홈페이지 장애 등 긴급 상황에서 임시 수동 운영 시에만 보조적으로 이용',
      note: '평상시 Google Forms를 이용하지 않으므로, 이용 범위를 긴급 상황으로 한정하여 명확히 하였습니다.',
    },
    en: {
      title: 'Limited use of survey collection (Google Forms)',
      before: 'Survey collection: Google LLC (Google Forms) — used routinely',
      after: 'Survey collection (emergency only): Google LLC (Google Forms) — normally we use our own in-house assessment feature; Google Forms is used only as a backup for temporary manual operation in emergencies such as website outages',
      note: 'Since Google Forms is not used in normal operation, we clarified its use as limited to emergency situations.',
    },
  },
  {
    no: 3,
    ko: {
      title: '미사용 광고 추적 도메인 정리',
      before: '광고/분석 관련 외부 도메인에 Meta(Facebook) 픽셀 도메인 포함',
      after: '실제 사용하지 않는 Meta(Facebook) 픽셀 관련 도메인을 정리(삭제)',
      note: '실제로 사용하지 않는 광고 추적 도메인을 정리하여 개인정보 처리 범위를 축소하였습니다.',
    },
    en: {
      title: 'Removal of unused advertising tracking domains',
      before: 'Meta (Facebook) Pixel domains were included among external advertising/analytics domains',
      after: 'Removed Meta (Facebook) Pixel-related domains that are not actually used',
      note: 'We removed unused advertising tracking domains, thereby narrowing the scope of personal data processing.',
    },
  },
  {
    no: 4,
    ko: {
      title: '[기업용(B2B) 처리방침] AI 위탁 삭제 · 위탁 현황 정정 · 보호책임자 명시',
      before: '제5조 처리위탁에 미사용 위탁사 항목 포함(OpenAI/Anthropic 리포트 생성 등) / 보호책임자: "파이스 대표"',
      after: '제5조: 실제 처리에 사용하지 않는 위탁사 항목 정리(삭제) — 진단은 규칙 기반으로 수행하여 외부 AI 위탁이 발생하지 않음 / 제8조: 개인정보 보호책임자 성명·연락처 명시(김영식, 파이스 대표, 010-5179-9206)',
      note: '기업용 서비스 이용 고객에게 해당하는 변경입니다. 당사 진단은 규칙 기반으로 운영됩니다.',
    },
    en: {
      title: '[B2B Privacy Policy] Removal of AI consignment · correction of entrustment · designation of privacy officer',
      before: 'Article 5 listed unused processors (e.g., OpenAI/Anthropic for report generation) / Privacy officer: "CEO of FAISE"',
      after: 'Article 5: removed processors not actually used — diagnosis is rule-based, so no external AI consignment occurs / Article 8: specified the privacy officer\'s name and contact (Youngsik Kim, CEO of FAISE, 010-5179-9206)',
      note: 'This change applies to customers using our B2B services. Our diagnosis runs on a rule-based engine.',
    },
  },
];

/**
 * HTML 이스케이프 (XSS 방지)
 */
function escapeHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 변경사항 HTML 표 1개 생성 (언어별)
 * @param {'ko'|'en'} lang
 */
function buildChangeRowsHtml(lang) {
  const labelBefore = lang === 'ko' ? '변경 전' : 'Before';
  const labelAfter = lang === 'ko' ? '변경 후' : 'After';
  return CHANGES.map((c) => {
    const t = c[lang];
    return `
      <tr>
        <td style="padding:14px 16px;border:1px solid #e5e7eb;vertical-align:top;background:#f9fafb;font-weight:700;color:#111827;width:34px;text-align:center;">${c.no}</td>
        <td style="padding:14px 16px;border:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-weight:700;color:#111827;margin-bottom:8px;">${escapeHtml(t.title)}</div>
          <div style="margin:0 0 6px;"><span style="display:inline-block;min-width:64px;color:#9ca3af;font-weight:600;">${labelBefore}</span> <span style="color:#6b7280;text-decoration:line-through;">${escapeHtml(t.before)}</span></div>
          <div style="margin:0 0 8px;"><span style="display:inline-block;min-width:64px;color:#2563eb;font-weight:700;">${labelAfter}</span> <span style="color:#111827;">${escapeHtml(t.after)}</span></div>
          <div style="font-size:13px;color:#6b7280;">${escapeHtml(t.note)}</div>
        </td>
      </tr>`;
  }).join('');
}

/**
 * 변경사항 텍스트 버전 (언어별)
 */
function buildChangeRowsText(lang) {
  const labelBefore = lang === 'ko' ? '변경 전' : 'Before';
  const labelAfter = lang === 'ko' ? '변경 후' : 'After';
  return CHANGES.map((c) => {
    const t = c[lang];
    return `${c.no}. ${t.title}\n   - ${labelBefore}: ${t.before}\n   - ${labelAfter}: ${t.after}\n   (${t.note})`;
  }).join('\n\n');
}

/**
 * 개정 고지 이메일 본문 생성 (한/영 병기)
 * @param {object} opts
 * @param {string} opts.privacyUrl     개인정보처리방침 URL
 * @param {string} opts.b2bPrivacyUrl  B2B 처리방침 URL
 * @param {string} opts.contactEmail   문의 이메일
 * @returns {{subject:string, html:string, text:string}}
 */
function buildPrivacyUpdateEmail(opts) {
  const o = opts || {};
  const privacyUrl = o.privacyUrl || 'https://lifeportfolio.co.kr/privacy.html';
  const b2bPrivacyUrl = o.b2bPrivacyUrl || 'https://lifeportfolio.co.kr/b2b-privacy.html';
  const contactEmail = o.contactEmail || 'faise@lifeportfolio.co.kr';

  const subject = `[인생포트폴리오/Life Portfolio] 개인정보처리방침 개정 안내 (시행일 ${EFFECTIVE_DATE_KO}) · Privacy Policy Update Notice`;

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 12px;">
    <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 28px 22px;text-align:center;">
      <div style="color:#93c5fd;font-size:12px;letter-spacing:2px;font-weight:700;">PRIVACY POLICY UPDATE</div>
      <div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:8px;">개인정보처리방침 개정 안내</div>
      <div style="color:#cbd5e1;font-size:14px;margin-top:4px;">Notice of Privacy Policy Update</div>
    </div>

    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:28px;">

      <!-- ===== 한국어 ===== -->
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;"><b>${escapeHtml(COMPANY_KO)}</b>는 「개인정보 보호법」 제30조에 따라 <b>개인정보처리방침 개정</b> 사항을 다음과 같이 안내드립니다.</p>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">1. 변경사항</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
        ${buildChangeRowsHtml('ko')}
      </table>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">2. 시행일자</h2>
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 8px;">개정된 개인정보처리방침은 <b>${EFFECTIVE_DATE_KO}</b>부터 시행됩니다.</p>
      <p style="margin:0 0 4px;"><a href="${escapeHtml(privacyUrl)}" style="color:#2563eb;font-weight:700;text-decoration:none;">▶ 개인정보처리방침 전문 보기</a></p>
      <p style="margin:0 0 4px;"><a href="${escapeHtml(b2bPrivacyUrl)}" style="color:#2563eb;font-weight:700;text-decoration:none;">▶ 기업용(B2B) 개인정보처리방침 보기</a></p>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">3. 이의제기 및 문의</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 8px;">개정 내용에 대한 문의사항이 있으신 경우 <a href="mailto:${escapeHtml(contactEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(contactEmail)}</a>로 접수해 주시면 신속히 안내해 드리겠습니다.</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">본 개정은 위탁 현황 정정 및 처리 범위 축소에 해당하며, 이용자에게 불리한 변경이 아닙니다. 다만 변경 내용에 동의하지 않으시는 경우 언제든지 문의 또는 회원 탈퇴를 요청하실 수 있습니다.</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">

      <!-- ===== English ===== -->
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;"><b>${escapeHtml(COMPANY_EN)}</b> hereby notifies you of the following <b>updates to our Privacy Policy</b>, pursuant to Article 30 of the Personal Information Protection Act (Korea).</p>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">1. What has changed</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
        ${buildChangeRowsHtml('en')}
      </table>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">2. Effective date</h2>
      <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 8px;">The updated Privacy Policy takes effect on <b>${EFFECTIVE_DATE_EN}</b>.</p>
      <p style="margin:0 0 4px;"><a href="${escapeHtml(privacyUrl)}" style="color:#2563eb;font-weight:700;text-decoration:none;">▶ View the full Privacy Policy</a></p>
      <p style="margin:0 0 4px;"><a href="${escapeHtml(b2bPrivacyUrl)}" style="color:#2563eb;font-weight:700;text-decoration:none;">▶ View the B2B Privacy Policy</a></p>

      <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin:24px 0 12px;border-left:4px solid #2563eb;padding-left:10px;">3. Objections & inquiries</h2>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 8px;">If you have any questions about these changes, please contact us at <a href="mailto:${escapeHtml(contactEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(contactEmail)}</a>.</p>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">These changes correct our list of processors and narrow the scope of data processing; they are not disadvantageous to users. If you do not agree with the changes, you may contact us or request account withdrawal at any time.</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;text-align:center;">
        본 메일은 개인정보처리방침 개정 고지를 위한 안내 메일입니다. (광고성 정보 아님)<br>
        This is a notification email regarding the Privacy Policy update. (Not an advertisement)<br>
        ${escapeHtml(COMPANY_EN)} · <a href="mailto:${escapeHtml(contactEmail)}" style="color:#9ca3af;">${escapeHtml(contactEmail)}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  // ── TEXT (plain) ────────────────────────────────────────────────────────────
  const text = [
    '[인생포트폴리오] 개인정보처리방침 개정 안내',
    '',
    `${COMPANY_KO}는 「개인정보 보호법」 제30조에 따라 개인정보처리방침 개정 사항을 다음과 같이 안내드립니다.`,
    '',
    '── 1. 변경사항 ──',
    buildChangeRowsText('ko'),
    '',
    `── 2. 시행일자 ── 개정된 개인정보처리방침은 ${EFFECTIVE_DATE_KO}부터 시행됩니다.`,
    `개인정보처리방침: ${privacyUrl}`,
    `B2B 개인정보처리방침: ${b2bPrivacyUrl}`,
    '',
    `── 3. 이의제기 및 문의 ── ${contactEmail}`,
    '본 개정은 이용자에게 불리한 변경이 아닙니다. 동의하지 않으실 경우 문의 또는 회원 탈퇴를 요청하실 수 있습니다.',
    '',
    '본 메일은 개인정보처리방침 개정 고지를 위한 안내 메일입니다. (광고성 정보 아님)',
    '',
    '======================================================',
    '',
    '[Life Portfolio] Notice of Privacy Policy Update',
    '',
    `${COMPANY_EN} hereby notifies you of the following updates to our Privacy Policy, pursuant to Article 30 of the Personal Information Protection Act (Korea).`,
    '',
    '── 1. What has changed ──',
    buildChangeRowsText('en'),
    '',
    `── 2. Effective date ── The updated Privacy Policy takes effect on ${EFFECTIVE_DATE_EN}.`,
    `Privacy Policy: ${privacyUrl}`,
    `B2B Privacy Policy: ${b2bPrivacyUrl}`,
    '',
    `── 3. Objections & inquiries ── ${contactEmail}`,
    'These changes are not disadvantageous to users. If you do not agree, you may contact us or request account withdrawal at any time.',
    '',
    'This is a notification email regarding the Privacy Policy update. (Not an advertisement)',
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildPrivacyUpdateEmail,
  // 팝업/관리자 페이지가 동일 데이터를 쓸 수 있도록 노출
  _meta: {
    EFFECTIVE_DATE_KO,
    EFFECTIVE_DATE_EN,
    CHANGES,
  },
};
