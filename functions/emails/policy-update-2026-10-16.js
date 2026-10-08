/**
 * 이용약관 · 개인정보처리방침 개정 고지 (디지털 다이어리 출시) — 단일 출처
 * =====================================================================
 * 이 파일 하나가 이메일 본문, 홈페이지 팝업, 운영 대시보드 미리보기의 문구를 정한다.
 * 약관·처리방침 본문(terms.html / privacy.html / assets/i18n)은 같은 문장을 쓴다.
 *
 * 일정 (KST)
 *   이용약관        : 공지 2026-10-09 00:00 → 시행 2026-10-16 00:00 (시행 7일 전 공지: 약관 제3조 3항)
 *   개인정보처리방침: 2026-10-09 게시와 함께 적용 (개인정보 보호법 제30조 공개 의무, 동의 대상 아님)
 *   팝업 게시 2026-10-09 00:00  ~  2026-10-15 23:59:59  (만 7일, 지나면 자동 소멸)
 *
 * 근거 (AI 법률 고문 내부 검토 — 변호사 검토 아님: GenTeam lp-quality-gate 5737233 스레드의 5737371·5739187·5739220,
 *       기록 docs/legal/2026-10-08_약관방침_개정_검토기록.md)
 *   - 약관규제법 제3조(명시·설명), 약관 제3조 3항(시행 7일 전 공지)
 *   - 개인정보 보호법 제30조(처리방침 변경 시 변경 전·후 비교 공개)
 *   - 광고성 정보 아님: 법정 고지(정보통신망법 제50조의 광고성 정보에 해당하지 않음) → 수신동의 여부와 무관하게 발송
 *
 * 영문 서비스는 한국어판 출시 범위가 아니므로(대표 결정 2026-10-08) 영문은 이메일 하단 요약만 병기한다.
 */
'use strict';

const CAMPAIGN = 'policy-update-2026-10-16';
const NOTICE_START_KST = '2026-10-09T00:00:00+09:00';
const EFFECTIVE_KST = '2026-10-16T00:00:00+09:00';
const POPUP_END_KST = '2026-10-15T23:59:59+09:00';
const EFFECTIVE_KO = '2026년 10월 16일';          // 이용약관 시행일
const PRIVACY_EFFECTIVE_KO = '2026년 10월 9일';   // 개인정보처리방침: 동의 대상이 아닌 공개 사항이라 게시와 함께 적용(법률 고문 권고)
const EFFECTIVE_EN = 'October 16, 2026';

// 변경 전 · 후 대조 (개인정보 보호법 제30조 — 정보주체가 비교 확인할 수 있도록)
const CHANGES = [
  {
    doc: 'terms', no: '제2조 6호 (신설)',
    title: '「다이어리」 정의 신설',
    before: '(없음)',
    after: '"다이어리"란 회원이 1년 동안 자신의 기록을 남길 수 있도록 회사가 제공하는 디지털 기록 양식과, 그 안에 회원이 작성하여 저장한 기록을 말합니다.',
  },
  {
    doc: 'terms', no: '제8조 (저작권 및 이용제한)',
    title: '회사 자료와 회원 기록의 권리 구분',
    before: '① 리포트 및 제공 자료의 저작권은 회사에 귀속됩니다. ② 이용자는 회사의 사전 동의 없이 이를 복제, 배포, 전송, 2차저작물 작성 등 영리적 목적으로 이용할 수 없습니다.',
    after: '① 리포트, 다이어리 양식(구성·질문·안내문·해설서) 등 회사가 작성하여 제공하는 자료의 저작권은 회사에 있습니다. 다만 그 안에 담긴 회원의 응답·이름 등 회원 본인의 정보는 회원의 것입니다. ② 회원이 다이어리에 직접 작성한 기록의 권리는 회원에게 있으며, 회사는 서비스 제공에 필요한 범위(저장·표시·내려받기 제공과 이를 위한 백업·보안 조치) 안에서만 이를 처리합니다. ③ 회원은 본인의 리포트와 다이어리(내려받은 파일 포함)를 개인적으로 인쇄·보관하고, 본인의 기록으로 가족·지인 등에게 공유할 수 있습니다. ④ 다만 회원은 회사의 사전 동의 없이 회사 자료를 영리 목적으로 이용할 수 없으며, 다이어리 양식·질문·해설서를 회원의 기록과 분리하여(빈 양식 형태 등으로) 복제·배포·판매·공개 게시하거나 이를 바탕으로 2차적저작물을 작성할 수 없습니다. 본인의 기록을 소개하면서 양식의 일부가 함께 보이는 것은 이 제한에 해당하지 않습니다.',
  },
  {
    doc: 'privacy', no: '1. 처리 목적',
    title: '다이어리 기록 저장 목적 추가',
    before: '인생포트폴리오 검사 응답 수집·리포트 제공, 결제 및 환불 처리, 고객문의 응대, 서비스 품질 개선 및 통계 분석.',
    after: '인생포트폴리오 검사 응답 수집·리포트 제공, 다이어리 기록의 저장·표시 및 본인 내려받기 제공, 결제 및 환불 처리, 고객문의 응대, 서비스 품질 개선 및 통계 분석.',
  },
  {
    doc: 'privacy', no: '2. 처리하는 개인정보 항목',
    title: '다이어리 기록 항목 추가',
    before: '선택: 검사 응답 데이터(문항별 선택·기술)',
    after: '선택: 검사 응답 데이터(문항별 선택·기술), 다이어리 기록(회원이 직접 작성한 글·점수·체크, 시작일 등 작성 정보)',
  },
  {
    doc: 'privacy', no: '3. 처리 및 보유기간',
    title: '다이어리 보유기간 명시',
    before: '검사 응답 · 리포트 · 실행 프로그램: 회원 가입 시점부터 회원 탈퇴 시까지 보관 …',
    after: '검사 응답 · 리포트 · 실행 프로그램 · 다이어리 기록: 회원 가입 시점부터 회원 탈퇴 시까지 보관 … (다이어리는 다이어리 안 「다이어리 비우기」로 언제든 직접 삭제할 수 있습니다)',
  },
  {
    doc: 'privacy', no: '5. 처리 위탁 · 6. 국외 이전',
    title: '데이터 저장 위탁·국외 이전 명시',
    before: '(Firebase Realtime Database 기재 없음)',
    after: '5항: 데이터 저장·처리 — Google LLC (Firebase Realtime Database, Cloud Functions) / 6항: Google LLC (싱가포르 리전 asia-southeast1) – Firebase Realtime Database, 이전 항목: 검사 응답·리포트·실행 프로그램·다이어리 기록, 이전 일시·방법: 서비스 이용 시 실시간·암호화 전송, 보관 기간: 회원 탈퇴 시까지',
  },
  {
    doc: 'privacy', no: '7. 이용자의 권리',
    title: '다이어리 열람·삭제·내려받기 권리 명시',
    before: '삭제권 — 마이페이지에서 개별 리포트를 즉시 삭제하거나 … / 데이터 이동권 — 리포트 PDF 다운로드를 통해 …',
    after: '삭제권 — … 다이어리는 「다이어리 비우기」로 즉시 삭제 … / 데이터 이동권 — 리포트 PDF와 다이어리 기록(내려받기 기능 제공 시)을 통해 본인 데이터를 반출할 수 있습니다.',
  },
  {
    doc: 'privacy', no: '13. 회원 탈퇴 절차 및 데이터 파기',
    title: '탈퇴 시 다이어리도 즉시 삭제',
    before: '탈퇴 즉시 처리: Firebase 인증 계정 삭제 + Realtime Database 내 모든 검사 응답·리포트·실행 프로그램 데이터 삭제',
    after: '탈퇴 즉시 처리: Firebase 인증 계정 삭제 + Realtime Database 내 모든 검사 응답·리포트·실행 프로그램·다이어리 기록 삭제',
  },
  {
    doc: 'privacy', no: '16. 다이어리 기록의 처리 (신설)',
    title: '다이어리 기록 처리 방식 안내',
    before: '(없음)',
    after: '① 열람 범위: 다이어리 기록은 다른 회원에게 보이지 않고 공개 페이지에도 표시되지 않으며, 로그인한 본인만 서비스 화면에서 열람할 수 있습니다. ② 저장 위치: Google LLC Firebase Realtime Database(싱가포르 리전)에 저장됩니다. 자세한 내용은 5항·6항을 참고해 주세요. ③ 이용 제한: 회사는 다이어리 기록을 광고, 인공지능 모델의 학습, 통계 분석에 이용하지 않습니다. 회사 담당자는 회원이 요청한 문의 처리, 장애·보안 대응, 법령에 따른 요청의 경우에 한하여 필요한 최소 범위에서만 기록에 접근하며, 그 밖의 경우에는 열람하지 않습니다. 향후 기록을 활용하는 새 기능은 회원이 따로 켜는 경우에만 적용합니다. ④ 작성 시 유의: 건강·신념 등 민감한 내용이나 다른 사람을 알아볼 수 있는 정보는 적지 않도록 권장합니다. 적으신 경우에도 위 ①~③의 범위에서만 처리합니다. ⑤ 삭제: 다이어리 안 「다이어리 비우기」로 즉시 삭제할 수 있으며, 회원 탈퇴 시 함께 삭제됩니다.',
  },
];

const SUMMARY_KO = [
  '「다이어리」 정의를 새로 두었습니다. (이용약관 제2조)',
  '회사 자료와 회원 기록의 권리를 나누었습니다. 직접 쓰신 기록은 회원님의 것이며, 본인 기록으로 인쇄·보관·공유할 수 있습니다. 다만 다이어리 양식만 따로 떼어 배포하는 것은 제한됩니다. (이용약관 제8조)',
  '다이어리 기록의 처리 목적·항목·저장 위치·보관·삭제를 명시했습니다. 광고·인공지능 학습·통계에 쓰지 않으며, 탈퇴 시 함께 삭제됩니다. (개인정보처리방침 1·2·3·5·6·7·13·16항)',
];
const SUMMARY_EN = [
  'Added a definition of the "Diary" (Terms, Art. 2).',
  'Separated rights: the forms are ours, what you write is yours and may be printed, kept and shared as your own record; distributing the blank forms on their own is restricted (Terms, Art. 8).',
  'Stated how Diary entries are stored (Singapore region), used and deleted — never used for ads, AI training or statistics, and removed on withdrawal (Privacy Policy §1·2·3·5·6·7·13·16).',
];

const URLS = {
  terms: 'https://lifeportfolio.co.kr/terms',
  privacy: 'https://lifeportfolio.co.kr/privacy',
  contact: 'faise@lifeportfolio.co.kr',
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildPolicyUpdateEmail(opts) {
  const o = Object.assign({}, URLS, opts || {});
  const subject = '[인생포트폴리오] 이용약관 및 개인정보처리방침 개정 안내 (이용약관 ' + EFFECTIVE_KO + ' 시행)';
  const rows = CHANGES.map((c) =>
    '<tr><td style="padding:10px;border:1px solid #e5e0d3;vertical-align:top;font-size:13px;color:#0A3D2A;white-space:nowrap"><b>' + esc(c.doc === 'terms' ? '이용약관' : '개인정보처리방침') + '</b><br>' + esc(c.no) + '</td>' +
    '<td style="padding:10px;border:1px solid #e5e0d3;vertical-align:top;font-size:13px;color:#666">' + esc(c.before) + '</td>' +
    '<td style="padding:10px;border:1px solid #e5e0d3;vertical-align:top;font-size:13px;color:#222">' + esc(c.after) + '</td></tr>').join('');
  const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(subject) + '</title></head>' +
    '<body style="margin:0;background:#f6f3ec;font-family:-apple-system,BlinkMacSystemFont,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;color:#222;word-break:keep-all">' +
    '<div style="max-width:640px;margin:0 auto;padding:24px 16px">' +
    '<div style="background:#0A3D2A;color:#fff;border-radius:14px 14px 0 0;padding:22px 24px"><div style="color:#C9A04F;font-size:12px;letter-spacing:.12em;font-weight:700">약관 · 개인정보처리방침 개정</div>' +
    '<h1 style="margin:8px 0 0;font-size:20px;line-height:1.4">이용약관 및 개인정보처리방침<br>개정 안내</h1></div>' +
    '<div style="background:#fff;border:1px solid #e5e0d3;border-top:0;border-radius:0 0 14px 14px;padding:22px 24px">' +
    '<p style="font-size:15px;line-height:1.7;margin:0 0 14px">안녕하세요, 인생포트폴리오입니다.<br>「나의 다이어리」 서비스 출시에 맞추어 이용약관과 개인정보처리방침을 아래와 같이 개정합니다.</p>' +
    '<p style="font-size:15px;font-weight:700;margin:18px 0 6px">1. 주요 변경 내용</p><ul style="margin:0 0 6px;padding-left:20px;font-size:14px;line-height:1.7">' + SUMMARY_KO.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>' +
    '<p style="font-size:15px;font-weight:700;margin:18px 0 8px">2. 변경 전 · 후 비교</p>' +
    '<table role="presentation" style="width:100%;border-collapse:collapse"><tr><th style="padding:8px;border:1px solid #e5e0d3;background:#faf7f0;font-size:12px">항목</th><th style="padding:8px;border:1px solid #e5e0d3;background:#faf7f0;font-size:12px">변경 전</th><th style="padding:8px;border:1px solid #e5e0d3;background:#faf7f0;font-size:12px">변경 후</th></tr>' + rows + '</table>' +
    '<p style="font-size:15px;font-weight:700;margin:18px 0 6px">3. 시행일</p><p style="font-size:14px;line-height:1.7;margin:0">이용약관: <b style="color:#0A3D2A">' + esc(EFFECTIVE_KO) + '</b>부터 적용됩니다.<br>개인정보처리방침: <b style="color:#0A3D2A">' + esc(PRIVACY_EFFECTIVE_KO) + '</b>부터 적용됩니다(처리 현황을 알리는 안내 사항).</p>' +
    '<p style="font-size:15px;font-weight:700;margin:18px 0 6px">4. 이의 제기 및 문의</p><p style="font-size:14px;line-height:1.7;margin:0">개정 이용약관에 동의하지 않으시면 시행일 전까지 문의처로 알려 주시거나 회원 탈퇴(이용계약 해지)를 하실 수 있습니다. 시행일(2026년 10월 16일)까지 거부 의사를 밝히지 않으시면 개정 이용약관에 동의하신 것으로 봅니다. 개인정보처리방침은 동의 대상이 아닌 안내 사항입니다. 문의: <a href="mailto:' + esc(o.contact) + '" style="color:#0A3D2A">' + esc(o.contact) + '</a></p>' +
    '<p style="margin:20px 0 0"><a href="' + esc(o.terms) + '" style="display:inline-block;padding:11px 16px;background:#0A3D2A;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:0 8px 8px 0">이용약관 전문</a><a href="' + esc(o.privacy) + '" style="display:inline-block;padding:11px 16px;border:1px solid #0A3D2A;color:#0A3D2A;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">개인정보처리방침 전문</a></p>' +
    '<hr style="border:0;border-top:1px solid #e5e0d3;margin:24px 0 14px"><p style="font-size:12px;color:#666;line-height:1.7;margin:0"><b>English summary</b> — Terms effective ' + esc(EFFECTIVE_EN) + ', Privacy Policy effective October 9, 2026: ' + SUMMARY_EN.map(esc).join(' ') + '</p>' +
    '<p style="font-size:12px;color:#666;line-height:1.7;margin:14px 0 0">본 메일은 약관·개인정보처리방침 변경을 알려드리는 법정 고지이며, 광고성 정보가 아닙니다. 수신 동의 여부와 관계없이 회원님께 발송됩니다.<br>파이스 · 대표 김영식 · 사업자등록번호 656-12-02589 · 서울특별시 서초구 매헌로 16, 오피스동 3층 371호</p>' +
    '</div></div></body></html>';
  const text = [
    subject, '',
    '안녕하세요, 인생포트폴리오입니다.',
    '「나의 다이어리」 서비스 출시에 맞추어 이용약관과 개인정보처리방침을 아래와 같이 개정합니다.', '',
    '1. 주요 변경 내용', ...SUMMARY_KO.map((s) => '- ' + s), '',
    '2. 변경 전 · 후 비교',
    ...CHANGES.flatMap((c) => ['[' + (c.doc === 'terms' ? '이용약관' : '개인정보처리방침') + ' ' + c.no + '] ' + c.title, '  변경 전: ' + c.before, '  변경 후: ' + c.after]), '',
    '3. 시행일: 이용약관 ' + EFFECTIVE_KO + ' / 개인정보처리방침 ' + PRIVACY_EFFECTIVE_KO + '(안내 사항)', '',
    '4. 이의 제기 및 문의: 개정 이용약관에 동의하지 않으시면 시행일 전까지 문의처로 알려 주시거나 회원 탈퇴(이용계약 해지)를 하실 수 있습니다. 시행일(2026년 10월 16일)까지 거부 의사를 밝히지 않으시면 개정 이용약관에 동의하신 것으로 봅니다. 개인정보처리방침은 동의 대상이 아닌 안내 사항입니다. 문의: ' + o.contact, '',
    '이용약관: ' + o.terms, '개인정보처리방침: ' + o.privacy, '',
    'English summary — Terms effective ' + EFFECTIVE_EN + ', Privacy Policy effective October 9, 2026: ' + SUMMARY_EN.join(' '), '',
    '본 메일은 약관·개인정보처리방침 변경을 알려드리는 법정 고지이며, 광고성 정보가 아닙니다.',
    '파이스 · 대표 김영식 · 사업자등록번호 656-12-02589',
  ].join('\n');
  return { subject, html, text };
}

module.exports = { CAMPAIGN, NOTICE_START_KST, EFFECTIVE_KST, POPUP_END_KST, EFFECTIVE_KO, PRIVACY_EFFECTIVE_KO, EFFECTIVE_EN, CHANGES, SUMMARY_KO, SUMMARY_EN, URLS, buildPolicyUpdateEmail };
