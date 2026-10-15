/**
 * 이용약관 · 개인정보처리방침 개정 고지 (제휴 기업 전용 결제 도입) — 단일 출처
 * =====================================================================
 * 이 파일 하나가 이메일 본문, 홈페이지 팝업, 약관·처리방침 페이지의 개정 예고, 운영 대시보드 미리보기의 날짜·문구를 정한다.
 *
 * 일정 (KST, 대표 결정 2026-10-15)
 *   공지 시작 2026-10-18 00:00 (지난 다이어리 개정 팝업이 10-16 밤에 끝난 뒤)
 *   팝업 게시 2026-10-18 00:00 ~ 2026-10-24 23:59:59 (만 7일, 자동 시작·자동 소멸)
 *   이용약관 제4조 ④ 시행 2026-10-25 00:00 (약관 제3조 3항 "적용일자 7일 전부터 공지" 충족: 18일 공지 → 25일 시행)
 *   개인정보처리방침: 2026-10-18 게시와 함께 적용 (지난 개정과 같은 방식, 개인정보 보호법 제30조 공개 의무)
 *   회원 메일: 10-18 이후 대표가 운영 대시보드에서 직접 발송 (그 전에는 서버가 실제 발송을 막는다)
 *
 * 근거: 지난 개정 검토 기록(docs/legal/2026-10-08_약관방침_개정_검토기록.md)의 형식·문장 원칙을 그대로 따름. 변호사 검토 아님.
 */
'use strict';

const CAMPAIGN = 'policy-update-2026-10-25';
const NOTICE_START_KST = '2026-10-18T00:00:00+09:00';
const EFFECTIVE_KST = '2026-10-25T00:00:00+09:00';
const POPUP_END_KST = '2026-10-24T23:59:59+09:00';
const EFFECTIVE_KO = '2026년 10월 25일';
const PRIVACY_EFFECTIVE_KO = '2026년 10월 18일';
const EFFECTIVE_EN = 'October 25, 2026';
const PRIVACY_EFFECTIVE_EN = 'October 18, 2026';

const ART4_4_KO = '회사는 다른 기업·단체와 맺은 제휴 계약에 따라, 그 기업·단체의 회원에게 별도 가격(이하 "제휴가")으로 서비스를 제공할 수 있습니다. 제휴가, 적용 기간, 대상, 이용 인원 및 확인 방법은 해당 제휴 전용 결제 화면에 표시하며, 제휴가는 회원 1인의 첫 결제에 한 번 적용됩니다. 제휴가로 결제한 이용자의 서비스 내용과 청약철회·환불 기준은 일반 결제와 같습니다.';
const ART4_4_EN = 'Under partnership agreements with other companies or organizations, the Company may provide the service to their members at a separate price (the "partner price"). The partner price, period, eligibility, number of seats and verification method are shown on the dedicated partner checkout page, and the partner price applies once, to a member\'s first payment. Members who pay the partner price receive the same service, and the same withdrawal and refund rules apply as for regular payments.';
const S3_7_KO = '제휴 결제 기록(제휴사 이름, 결제 금액, 사용한 제휴 코드를 알아볼 수 없게 바꾼 값): 대금결제 기록과 같이 5년 보관합니다. 제휴사에는 개인을 알 수 있는 정보를 제공하지 않습니다. 환불 계좌 정보(은행명, 계좌번호, 예금주): 결제 취소로 환불할 수 없는 경우에 한해 이용자가 직접 입력하며, 환불 송금 목적으로만 이용하고 송금을 마치면 바로 파기합니다.';
const S3_7_EN = 'Partner payment records (partner name, amount paid, and an unreadable transformed value of the partner code used): kept for 5 years, like other payment records. No personally identifiable information is given to the partner. Refund account details (bank, account number, holder): entered by the user only when a refund cannot be made by cancelling the payment, used only to send the refund, and destroyed as soon as the transfer is done.';
const S10_4_KO = '분석 도구 동의 선택 기록: 같은 브라우저에서 다시 묻지 않도록 선택(동의·거부)과 날짜를 브라우저에 저장하고, 로그인한 회원은 다른 기기에서도 다시 묻지 않도록 회원 정보에 함께 저장합니다. 선택은 1년 동안 유지되며 그 뒤 한 번 다시 여쭙니다. 운영자는 날짜별 동의·거부 합계 숫자만 보며, 누가 선택했는지는 보지 않습니다. 선택은 마이페이지 또는 이 항목의 [선택 바꾸기]로 언제든 바꿀 수 있습니다.';
const S10_4_EN = 'Record of your analytics choice: so we do not ask again in the same browser, your choice (allow or decline) and its date are stored in the browser, and for signed-in members also in the member profile so other devices do not ask again. The choice lasts one year, after which we ask once more. Operators see only daily totals of allow/decline, never who chose what. You can change it anytime in My Page or with [Change choice] in this section.';

const CHANGES = [
  {
    doc: 'terms', no: '제4조 ④ (신설)',
    en: { no: 'Art. 4(4) (new)', title: 'Partner price for members of partner companies', before: '(none)', after: '(4) ' + ART4_4_EN },
    title: '제휴 기업 회원 전용 가격(제휴가) 근거 신설',
    before: '(없음)',
    after: '④ ' + ART4_4_KO,
  },
  {
    doc: 'privacy', no: '3. 처리 및 보유기간 (항목 추가)',
    en: { no: '§3 Retention (item added)', title: 'Partner payment records and refund account details', before: '(none)', after: S3_7_EN },
    title: '제휴 결제 기록과 환불 계좌 정보의 보관·파기',
    before: '(없음)',
    after: S3_7_KO,
  },
  {
    doc: 'privacy', no: '10. 쿠키 및 자동 수집 도구 (10-4 신설)',
    en: { no: '§10 Cookies and automatic tools (10-4 new)', title: 'How your analytics choice is remembered', before: 'Your choice is stored only in the browser.', after: S10_4_EN },
    title: '분석 도구 동의 선택의 저장 방식',
    before: '선택은 브라우저에만 저장됩니다.',
    after: S10_4_KO,
  },
];

// 개정 사유 (약관규제법 제3조·약관 제3조 3항: 적용일자와 개정 사유를 명시)
const REASON_KO = '제휴 기업 회원이 제휴 전용 결제 화면에서 제휴가로 서비스를 이용할 수 있도록 근거를 마련하고, 그에 필요한 기록의 보관 기준과 분석 도구 동의 선택의 저장 방식을 알려 드리기 위해 개정합니다.';
const REASON_EN = 'We are adding the basis for members of partner companies to use the service at a partner price on a dedicated checkout page, and explaining how the related records are kept and how your analytics choice is remembered.';

const SUMMARY_KO = [
  '제휴 기업 회원은 제휴 전용 결제 화면에서 제휴가로 결제할 수 있습니다. 제휴가는 회원 1인의 첫 결제에 한 번 적용됩니다. (이용약관 제4조)',
  '제휴가로 결제해도 서비스 내용과 청약철회·환불 기준은 일반 결제와 같습니다. 일반 가격(19,900원·$14.99)은 그대로입니다.',
  '제휴 결제 기록은 5년 보관하며 제휴사에는 개인을 알 수 있는 정보를 주지 않습니다. 환불 계좌 정보는 송금 후 바로 파기합니다. (개인정보처리방침 3항)',
  '방문 통계 동의 선택은 로그인한 회원의 경우 다른 기기에서도 다시 묻지 않도록 회원 정보에 저장하고, 1년 동안 유지합니다. (개인정보처리방침 10항)',
];
const SUMMARY_EN = [
  'Members of partner companies can pay a partner price on a dedicated checkout page. It applies once, to a member\'s first payment. (Terms, Art. 4)',
  'With the partner price, the service and the withdrawal and refund rules are the same as for regular payments. Regular prices (KRW 19,900 / $14.99) do not change.',
  'Partner payment records are kept for 5 years and no personally identifiable information is given to partners. Refund account details are destroyed right after the transfer. (Privacy Policy §3)',
  'For signed-in members, your analytics choice is saved to your profile so other devices do not ask again, and it lasts one year. (Privacy Policy §10)',
];

const OBJECTION_KO = '개정 이용약관에 동의하지 않으시면 시행일 전까지 문의처로 알려 주시거나 회원 탈퇴(이용계약 해지)를 하실 수 있습니다. 시행일(' + EFFECTIVE_KO + ')까지 거부 의사를 밝히지 않으시면 개정 이용약관에 동의하신 것으로 봅니다. 개인정보처리방침은 동의 대상이 아닌 안내 사항입니다.';
const OBJECTION_EN = 'If you do not agree to the revised Terms, you may tell us at the contact below or withdraw your membership (terminate the service agreement) before the effective date. If you do not object by ' + EFFECTIVE_EN + ', you will be deemed to have accepted the revised Terms. The Privacy Policy is a notice, not something you are asked to agree to.';

const URLS = {
  terms: 'https://lifeportfolio.co.kr/terms',
  privacy: 'https://lifeportfolio.co.kr/privacy',
  termsPrev: 'https://lifeportfolio.co.kr/terms-2026-10-17',
  privacyPrev: 'https://lifeportfolio.co.kr/privacy-2026-10-09',
  contact: 'faise@lifeportfolio.co.kr',
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const H2 = 'color:#0f172a;font-size:16px;font-weight:800;margin:26px 0 12px;border-left:4px solid #2563eb;padding-left:10px;';
const P = 'color:#374151;font-size:14px;line-height:1.75;margin:0 0 8px;';
const LINK = 'color:#2563eb;font-weight:700;text-decoration:none;';

function rowsHtml(lang) {
  const isKo = lang === 'ko';
  return CHANGES.map((c, i) => {
    const t = isKo ? c : c.en;
    const doc = isKo ? (c.doc === 'terms' ? '이용약관' : '개인정보처리방침') : (c.doc === 'terms' ? 'Terms' : 'Privacy Policy');
    return '<tr>' +
      '<td style="padding:14px 12px;border:1px solid #e5e7eb;vertical-align:top;background:#f9fafb;font-weight:700;color:#111827;width:28px;text-align:center;">' + (i + 1) + '</td>' +
      '<td style="padding:14px 16px;border:1px solid #e5e7eb;vertical-align:top;">' +
      '<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">' + esc(doc) + ' · ' + esc(t.no) + '</div>' +
      '<div style="font-weight:700;color:#111827;margin-bottom:8px;">' + esc(t.title) + '</div>' +
      '<div style="margin:0 0 6px;"><span style="display:inline-block;min-width:56px;color:#9ca3af;font-weight:600;">' + (isKo ? '변경 전' : 'Before') + '</span> <span style="color:#6b7280;text-decoration:line-through;">' + esc(t.before) + '</span></div>' +
      '<div style="margin:0;"><span style="display:inline-block;min-width:56px;color:#2563eb;font-weight:700;">' + (isKo ? '변경 후' : 'After') + '</span> <span style="color:#111827;">' + esc(t.after) + '</span></div>' +
      '</td></tr>';
  }).join('');
}

function rowsText(lang) {
  const isKo = lang === 'ko';
  return CHANGES.map((c, i) => {
    const t = isKo ? c : c.en;
    const doc = isKo ? (c.doc === 'terms' ? '이용약관' : '개인정보처리방침') : (c.doc === 'terms' ? 'Terms' : 'Privacy Policy');
    return (i + 1) + '. [' + doc + ' ' + t.no + '] ' + t.title + '\n   - ' + (isKo ? '변경 전' : 'Before') + ': ' + t.before + '\n   - ' + (isKo ? '변경 후' : 'After') + ': ' + t.after;
  }).join('\n\n');
}

/**
 * 개정 고지 이메일 (한/영 병기). 법정 고지이므로 이용 권유 문구·버튼을 넣지 않는다(법률 고문 5739187).
 * 링크는 개정 전문 2개 + 이전 전문 2개 + 문의 메일(한·영 각각)만.
 */
function buildPolicyUpdateEmail(opts) {
  const o = Object.assign({}, URLS, opts || {});
  const subject = '[인생포트폴리오/Life Portfolio] 이용약관 및 개인정보처리방침 개정 안내 (이용약관 시행일 ' + EFFECTIVE_KO + ') · Notice of Updates to Terms and Privacy Policy';
  const mail = '<a href="mailto:' + esc(o.contact) + '" style="color:#2563eb;text-decoration:none;">' + esc(o.contact) + '</a>';
  const html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + esc(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Arial,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;word-break:keep-all;">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px 12px;">' +
    '<div style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 28px 22px;text-align:center;">' +
    '<div style="color:#93c5fd;font-size:12px;letter-spacing:2px;font-weight:700;">TERMS &amp; PRIVACY POLICY UPDATE</div>' +
    '<div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:8px;line-height:1.45;">이용약관 및 개인정보처리방침 개정 안내</div>' +
    '<div style="color:#cbd5e1;font-size:14px;margin-top:4px;">Notice of Updates to Terms and Privacy Policy</div></div>' +
    '<div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:28px;">' +
    // ===== 한국어 =====
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 12px;">안녕하세요, <b>인생포트폴리오(파이스)</b>입니다.<br>인생포트폴리오를 이용해 주시는 회원님께 감사드리며, <b>이용약관</b>과 <b>개인정보처리방침</b> 개정 사항을 안내드립니다.</p>' +
    '<p style="' + P + '"><b>개정 사유</b> · ' + esc(REASON_KO) + '</p>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:14px 0 0;"><div style="font-weight:800;color:#0f172a;font-size:14px;margin-bottom:6px;">한눈에 보기</div><ul style="margin:0;padding-left:18px;color:#111827;font-size:14px;line-height:1.75;">' + SUMMARY_KO.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' +
    '<h2 style="' + H2 + '">1. 변경사항</h2>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">' + rowsHtml('ko') + '</table>' +
    '<h2 style="' + H2 + '">2. 시행일자</h2>' +
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 4px;">이용약관: <b>' + esc(EFFECTIVE_KO) + '</b>부터 시행됩니다. 시행일 전까지는 이전 약관이 적용됩니다.</p>' +
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 10px;">개인정보처리방침: <b>' + esc(PRIVACY_EFFECTIVE_KO) + '</b> 게시와 함께 적용됩니다. (처리 현황을 알려 드리는 안내 사항)</p>' +
    '<p style="margin:0 0 4px;"><a href="' + esc(o.terms) + '" style="' + LINK + '">▶ 개정 이용약관 전문 보기</a></p>' +
    '<p style="margin:0 0 4px;"><a href="' + esc(o.privacy) + '" style="' + LINK + '">▶ 개정 개인정보처리방침 전문 보기</a></p>' +
    '<p style="font-size:13px;color:#6b7280;margin:6px 0 0;">이전 전문: <a href="' + esc(o.termsPrev) + '" style="color:#6b7280;">이용약관</a> · <a href="' + esc(o.privacyPrev) + '" style="color:#6b7280;">개인정보처리방침</a></p>' +
    '<h2 style="' + H2 + '">3. 이의제기 및 문의</h2>' +
    '<p style="' + P + '">' + esc(OBJECTION_KO) + '</p>' +
    '<p style="' + P + 'margin:0;">개정 내용에 대한 문의는 ' + mail + '로 보내 주시면 신속히 안내해 드리겠습니다.</p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">' +
    // ===== English =====
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 12px;">Hello from <b>Life Portfolio (FAISE)</b>. Thank you for using Life Portfolio. We are writing to let you know about updates to our <b>Terms of Service</b> and <b>Privacy Policy</b>.</p>' +
    '<p style="' + P + '"><b>Why</b> · ' + esc(REASON_EN) + '</p>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:14px 0 0;"><div style="font-weight:800;color:#0f172a;font-size:14px;margin-bottom:6px;">At a glance</div><ul style="margin:0;padding-left:18px;color:#111827;font-size:14px;line-height:1.75;">' + SUMMARY_EN.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' +
    '<h2 style="' + H2 + '">1. What has changed</h2>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">' + rowsHtml('en') + '</table>' +
    '<h2 style="' + H2 + '">2. Effective date</h2>' +
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 4px;">Terms of Service: effective <b>' + esc(EFFECTIVE_EN) + '</b>. Until then, the previous Terms apply.</p>' +
    '<p style="color:#111827;font-size:15px;line-height:1.75;margin:0 0 10px;">Privacy Policy: applies on publication, <b>' + esc(PRIVACY_EFFECTIVE_EN) + '</b> (a notice of how we process data).</p>' +
    '<p style="margin:0 0 4px;"><a href="' + esc(o.terms) + '?lang=en" style="' + LINK + '">▶ View the updated Terms</a></p>' +
    '<p style="margin:0 0 4px;"><a href="' + esc(o.privacy) + '?lang=en" style="' + LINK + '">▶ View the updated Privacy Policy</a></p>' +
    '<h2 style="' + H2 + '">3. Objections &amp; inquiries</h2>' +
    '<p style="' + P + '">' + esc(OBJECTION_EN) + '</p>' +
    '<p style="' + P + 'margin:0;">For questions, please contact us at ' + mail + '.</p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">' +
    '<p style="color:#9ca3af;font-size:12px;line-height:1.7;margin:0;text-align:center;">본 메일은 이용약관·개인정보처리방침 개정을 알려 드리는 법정 고지이며, 광고성 정보가 아닙니다. 수신 동의 여부와 관계없이 회원님께 발송됩니다.<br>' +
    'This is a required notice about changes to our Terms and Privacy Policy. (Not an advertisement)<br>' +
    '파이스 · 대표 김영식 · 사업자등록번호 656-12-02589 · 서울특별시 서초구 매헌로 16, 오피스동 3층 371호</p>' +
    '</div></div></body></html>';
  const text = [
    '[인생포트폴리오] 이용약관 및 개인정보처리방침 개정 안내', '',
    '안녕하세요, 인생포트폴리오(파이스)입니다.',
    '인생포트폴리오를 이용해 주시는 회원님께 감사드리며, 이용약관과 개인정보처리방침 개정 사항을 안내드립니다.', '',
    '개정 사유: ' + REASON_KO, '',
    '한눈에 보기', ...SUMMARY_KO.map((s) => '- ' + s), '',
    '── 1. 변경사항 ──', rowsText('ko'), '',
    '── 2. 시행일자 ──',
    '이용약관: ' + EFFECTIVE_KO + '부터 시행됩니다. 시행일 전까지는 이전 약관이 적용됩니다.',
    '개인정보처리방침: ' + PRIVACY_EFFECTIVE_KO + ' 게시와 함께 적용됩니다. (처리 현황을 알려 드리는 안내 사항)',
    '개정 이용약관: ' + o.terms, '개정 개인정보처리방침: ' + o.privacy,
    '이전 전문: ' + o.termsPrev + ' / ' + o.privacyPrev, '',
    '── 3. 이의제기 및 문의 ──', OBJECTION_KO, '문의: ' + o.contact, '',
    '본 메일은 이용약관·개인정보처리방침 개정을 알려 드리는 법정 고지이며, 광고성 정보가 아닙니다.', '',
    '======================================================', '',
    '[Life Portfolio] Notice of Updates to Terms and Privacy Policy', '',
    'Hello from Life Portfolio (FAISE). Thank you for using Life Portfolio. We are writing to let you know about updates to our Terms of Service and Privacy Policy.', '',
    'Why: ' + REASON_EN, '',
    'At a glance', ...SUMMARY_EN.map((s) => '- ' + s), '',
    '── 1. What has changed ──', rowsText('en'), '',
    '── 2. Effective date ──',
    'Terms of Service: effective ' + EFFECTIVE_EN + '. Until then, the previous Terms apply.',
    'Privacy Policy: applies on publication, ' + PRIVACY_EFFECTIVE_EN + '.',
    'Terms: ' + o.terms + '?lang=en', 'Privacy Policy: ' + o.privacy + '?lang=en', '',
    '── 3. Objections & inquiries ──', OBJECTION_EN, 'Contact: ' + o.contact, '',
    'This is a required notice about changes to our Terms and Privacy Policy. (Not an advertisement)',
    '파이스 · 대표 김영식 · 사업자등록번호 656-12-02589',
  ].join('\n');
  return { subject, html, text };
}

module.exports = { ART4_4_KO, ART4_4_EN, S3_7_KO, S3_7_EN, S10_4_KO, S10_4_EN, CAMPAIGN, NOTICE_START_KST, EFFECTIVE_KST, POPUP_END_KST, EFFECTIVE_KO, PRIVACY_EFFECTIVE_KO, EFFECTIVE_EN, PRIVACY_EFFECTIVE_EN, REASON_KO, REASON_EN, CHANGES, SUMMARY_KO, SUMMARY_EN, OBJECTION_KO, OBJECTION_EN, URLS, buildPolicyUpdateEmail };
