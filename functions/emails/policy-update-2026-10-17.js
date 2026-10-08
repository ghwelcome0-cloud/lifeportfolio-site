/**
 * 이용약관 · 개인정보처리방침 개정 고지 (디지털 다이어리 출시) — 단일 출처
 * =====================================================================
 * 이 파일 하나가 이메일 본문, 홈페이지 팝업, 운영 대시보드 미리보기의 문구를 정한다.
 * 약관·처리방침 본문(terms.html / privacy.html / assets/i18n)은 같은 문장을 쓴다.
 *
 * 일정 (KST)
 *   이용약관        : 공지 2026-10-09 00:00 → 시행 2026-10-17 00:00 (시행 8일 전 공지 — 약관 제3조 3항 '7일 전부터' 충족)
 *   개인정보처리방침: 2026-10-09 게시와 함께 적용 (개인정보 보호법 제30조 공개 의무, 동의 대상 아님)
 *   팝업 게시 2026-10-09 00:00  ~  2026-10-16 23:59:59  (만 8일, 지나면 자동 소멸)
 *
 * 근거 (AI 법률 고문 내부 검토 — 변호사 검토 아님: GenTeam lp-quality-gate 5737233 스레드의 5737371·5739187·5739220,
 *       기록 docs/legal/2026-10-08_약관방침_개정_검토기록.md)
 *   - 약관규제법 제3조(명시·설명), 약관 제3조 3항(시행 7일 전 공지)
 *   - 개인정보 보호법 제30조(처리방침 변경 시 변경 전·후 비교 공개)
 *   - 광고성 정보 아님: 법정 고지(정보통신망법 제50조의 광고성 정보에 해당하지 않음) → 수신동의 여부와 무관하게 발송
 *
 * 날짜: 실제 배포일에 맞춰 공지일·시행일을 하루씩 미룸(대표 지시 2026-10-08, 원안 10-09 공지 / 10-16 시행).
 *       이후 다이어리 배포가 끝나 공지 시작만 10-09 00:00으로 당김(대표 지시 2026-10-09). 시행일 10-17은 그대로 → 8일 전 공지.
 *
 * 형식 벤치마크: 우리 2026-06-19 개인정보처리방침 개정 메일(privacy-update-2026-06-19.js)과
 *   네이버페이·카카오 약관 개정 고지의 공통 구조 — 인사 → 개정 사유 → 변경 전/후 대조 → 시행일자 → 이의제기 및 문의,
 *   한국어 → 구분선 → English 순 병기(가입 회원에 영문 이용자가 섞여 있음).
 */
'use strict';

const CAMPAIGN = 'policy-update-2026-10-17';
const NOTICE_START_KST = '2026-10-09T00:00:00+09:00';
const EFFECTIVE_KST = '2026-10-17T00:00:00+09:00';
const POPUP_END_KST = '2026-10-16T23:59:59+09:00';
const EFFECTIVE_KO = '2026년 10월 17일';          // 이용약관 시행일
const PRIVACY_EFFECTIVE_KO = '2026년 10월 9일';   // 개인정보처리방침: 동의 대상이 아닌 공개 사항이라 게시와 함께 적용(법률 고문 권고)
const EFFECTIVE_EN = 'October 17, 2026';
const PRIVACY_EFFECTIVE_EN = 'October 9, 2026';

// 변경 전 · 후 대조 (개인정보 보호법 제30조 — 정보주체가 비교 확인할 수 있도록)
const CHANGES = [
  {
    doc: 'terms', no: '제2조 6호 (신설)',
    en: { no: "Art. 2(6) (new)", title: "New definition of the \"Diary\"", before: "(none)", after: "\"Diary\" means the digital journaling forms the Company provides so that members can keep a record of their year, together with the entries the member writes and saves in them." },
    title: '「다이어리」 정의 신설',
    before: '(없음)',
    after: '"다이어리"란 회원이 1년 동안 자신의 기록을 남길 수 있도록 회사가 제공하는 디지털 기록 양식과, 그 안에 회원이 작성하여 저장한 기록을 말합니다.',
  },
  {
    doc: 'terms', no: '제3조 ④·⑤ (신설)',
    en: { no: "Art. 3(4)·(5) (new)", title: "How amendments take effect and your right to refuse", before: "(none)", after: "(4) If, when announcing or notifying amended Terms, the Company clearly informs members that they will be deemed to accept the amendment unless they object before the effective date, and a member does not expressly object, the member is deemed to have accepted the amended Terms. (5) If a member does not accept the amended Terms, the Company may not apply them to that member, and the member may terminate the service agreement (withdraw membership)." },
    title: '개정약관의 동의 간주와 거부 시 처리 명시',
    before: '(없음)',
    after: "④ 회사가 개정약관을 공지 또는 통지하면서 회원에게 적용일자 전까지 거부 의사를 표시하지 않으면 동의한 것으로 본다는 뜻을 명확하게 알렸음에도 회원이 명시적으로 거부 의사를 표시하지 않은 경우, 회원이 개정약관에 동의한 것으로 봅니다. ⑤ 회원이 개정약관에 동의하지 않는 경우 회사는 그 회원에게 개정약관의 내용을 적용할 수 없으며, 이 경우 회원은 이용계약을 해지(회원 탈퇴)할 수 있습니다.",
  },
  {
    doc: 'terms', no: '제8조 (저작권 및 이용제한)',
    en: { no: "Art. 8 (Copyright and use restrictions)", title: "Separating rights in Company materials and members' entries", before: "① The copyright in the report and provided materials belongs to the Company. ② Users may not reproduce, distribute, transmit, create derivative works, or use the materials for commercial purposes without the Company's prior consent.", after: "① Copyright in the materials the Company creates and provides — including reports and the Diary forms (structure, questions, guidance and guide book) — belongs to the Company. Members' own information contained in them, such as their answers and name, belongs to the member. ② Rights in the entries a member writes in the Diary belong to the member; the Company processes them only as needed to provide the service (storage, display and download, and the backup and security measures these require). ③ Members may print and keep their own reports and Diary (including downloaded files) for personal use and share them with family and friends as their own record. ④ However, without the Company's prior consent members may not use Company materials for commercial purposes, and may not copy, distribute, sell or publicly post the Diary forms, questions or guide book separated from the member's own entries (for example as blank forms), or create derivative works based on them. Showing part of a form while presenting one's own entries is not covered by this restriction." },
    title: '회사 자료와 회원 기록의 권리 구분',
    before: '① 리포트 및 제공 자료의 저작권은 회사에 귀속됩니다. ② 이용자는 회사의 사전 동의 없이 이를 복제, 배포, 전송, 2차저작물 작성 등 영리적 목적으로 이용할 수 없습니다.',
    after: '① 리포트, 다이어리 양식(구성·질문·안내문·해설서) 등 회사가 작성하여 제공하는 자료의 저작권은 회사에 있습니다. 다만 그 안에 담긴 회원의 응답·이름 등 회원 본인의 정보는 회원의 것입니다. ② 회원이 다이어리에 직접 작성한 기록의 권리는 회원에게 있으며, 회사는 서비스 제공에 필요한 범위(저장·표시·내려받기 제공과 이를 위한 백업·보안 조치) 안에서만 이를 처리합니다. ③ 회원은 본인의 리포트와 다이어리(내려받은 파일 포함)를 개인적으로 인쇄·보관하고, 본인의 기록으로 가족·지인 등에게 공유할 수 있습니다. ④ 다만 회원은 회사의 사전 동의 없이 회사 자료를 영리 목적으로 이용할 수 없으며, 다이어리 양식·질문·해설서를 회원의 기록과 분리하여(빈 양식 형태 등으로) 복제·배포·판매·공개 게시하거나 이를 바탕으로 2차적저작물을 작성할 수 없습니다. 본인의 기록을 소개하면서 양식의 일부가 함께 보이는 것은 이 제한에 해당하지 않습니다.',
  },
  {
    doc: 'privacy', no: '1. 처리 목적',
    en: { no: "§1 Purposes", title: "Purpose: storing Diary entries", before: "Collecting Life Portfolio diagnostic responses and providing reports; payment and refund processing; customer inquiry handling; service quality improvement and statistical analysis.", after: "Collecting Life Portfolio survey responses and providing reports, storing and displaying Diary entries and providing downloads to the member, processing payments and refunds, responding to inquiries, improving service quality and statistical analysis." },
    title: '다이어리 기록 저장 목적 추가',
    before: '인생포트폴리오 검사 응답 수집·리포트 제공, 결제 및 환불 처리, 고객문의 응대, 서비스 품질 개선 및 통계 분석.',
    after: '인생포트폴리오 검사 응답 수집·리포트 제공, 다이어리 기록의 저장·표시 및 본인 내려받기 제공, 결제 및 환불 처리, 고객문의 응대, 서비스 품질 개선 및 통계 분석.',
  },
  {
    doc: 'privacy', no: '2. 처리하는 개인정보 항목',
    en: { no: "§2 Items processed", title: "Items: Diary entries added", before: "Optional: Diagnostic response data (per-question selections and descriptions)", after: "Optional: survey response data (choices and written answers per question), Diary entries (text, scores and checks written by the member, and writing details such as the start date)" },
    title: '다이어리 기록 항목 추가',
    before: '선택: 검사 응답 데이터(문항별 선택·기술)',
    after: '선택: 검사 응답 데이터(문항별 선택·기술), 다이어리 기록(회원이 직접 작성한 글·점수·체크, 시작일 등 작성 정보)',
  },
  {
    doc: 'privacy', no: '3. 처리 및 보유기간',
    en: { no: "§3 Retention", title: "Retention period for Diary entries", before: "Survey responses · Reports · Action programs: kept from sign-up until membership withdrawal …", after: "Survey responses · Reports · Action programs · Diary entries: kept from sign-up until membership withdrawal … (Diary entries can be deleted at any time with \"Empty diary\")" },
    title: '다이어리 보유기간 명시',
    before: '검사 응답 · 리포트 · 실행 프로그램: 회원 가입 시점부터 회원 탈퇴 시까지 보관 …',
    after: '검사 응답 · 리포트 · 실행 프로그램 · 다이어리 기록: 회원 가입 시점부터 회원 탈퇴 시까지 보관 … (다이어리는 다이어리 안 「다이어리 비우기」로 언제든 직접 삭제할 수 있습니다)',
  },
  {
    doc: 'privacy', no: '5. 처리 위탁 · 6. 국외 이전',
    en: { no: "§5 Processors · §6 Cross-border transfer", title: "Data storage processor and cross-border transfer", before: "(Firebase Realtime Database not listed)", after: "§5: Data storage and processing: Google LLC (Firebase Realtime Database, Cloud Functions) / §6: Google LLC (Singapore region asia-southeast1) – Firebase Realtime Database, Items: survey responses, reports, action programs, Diary entries, When/how: in real time during use, encrypted in transit, Retention: until membership withdrawal" },
    title: '데이터 저장 위탁·국외 이전 명시',
    before: '(Firebase Realtime Database 기재 없음)',
    after: '5항: 데이터 저장·처리 — Google LLC (Firebase Realtime Database, Cloud Functions) / 6항: Google LLC (싱가포르 리전 asia-southeast1) – Firebase Realtime Database, 이전 항목: 검사 응답·리포트·실행 프로그램·다이어리 기록, 이전 일시·방법: 서비스 이용 시 실시간·암호화 전송, 보관 기간: 회원 탈퇴 시까지',
  },
  {
    doc: 'privacy', no: '7. 이용자의 권리',
    en: { no: "§7 Your rights", title: "Rights to view, delete and download Diary entries", before: "Right to erasure — delete individual reports in My Page … / Right to data portability — via report PDF download", after: "Right to erasure — … Diary entries can be deleted immediately with \"Empty diary\" … / Right to data portability — via report PDFs and Diary entries (when the download feature is available)" },
    title: '다이어리 열람·삭제·내려받기 권리 명시',
    before: '삭제권 — 마이페이지에서 개별 리포트를 즉시 삭제하거나 … / 데이터 이동권 — 리포트 PDF 다운로드를 통해 …',
    after: '삭제권 — … 다이어리는 「다이어리 비우기」로 즉시 삭제 … / 데이터 이동권 — 리포트 PDF와 다이어리 기록(내려받기 기능 제공 시)을 통해 본인 데이터를 반출할 수 있습니다.',
  },
  {
    doc: 'privacy', no: '13. 회원 탈퇴 절차 및 데이터 파기',
    en: { no: "§13 Withdrawal and destruction", title: "Diary entries deleted on withdrawal", before: "Immediate action: Firebase authentication account deletion + removal of all survey responses, reports, and action programs from Realtime Database", after: "Immediate action: Firebase authentication account deletion + removal of all survey responses, reports, action programs and Diary entries in the Realtime Database" },
    title: '탈퇴 시 다이어리도 즉시 삭제',
    before: '탈퇴 즉시 처리: Firebase 인증 계정 삭제 + Realtime Database 내 모든 검사 응답·리포트·실행 프로그램 데이터 삭제',
    after: '탈퇴 즉시 처리: Firebase 인증 계정 삭제 + Realtime Database 내 모든 검사 응답·리포트·실행 프로그램·다이어리 기록 삭제',
  },
  {
    doc: 'privacy', no: '16. 다이어리 기록의 처리 (신설)',
    en: { no: "§16 Processing of Diary entries (new)", title: "How Diary entries are processed (new)", before: "(none)", after: "① Who can see them: Diary entries are not visible to other members or on public pages; only the signed-in member can view them in the service. ② Where they are stored: Google LLC Firebase Realtime Database (Singapore region). See §5 and §6. ③ Use limits: the Company does not use Diary entries for advertising, AI model training or statistical analysis. Staff access entries only to the minimum extent needed to handle an inquiry the member requested, to respond to outages or security incidents, or to comply with a legal request, and do not view them otherwise. Any future feature that uses entries applies only if the member turns it on. ④ When writing: we recommend not writing sensitive information such as health or beliefs, or information that identifies other people. If you do, it is processed only within ①–③ above. ⑤ Deletion: delete immediately with \"Empty diary\"; also deleted on withdrawal." },
    title: '다이어리 기록 처리 방식 안내',
    before: '(없음)',
    after: '① 열람 범위: 다이어리 기록은 다른 회원에게 보이지 않고 공개 페이지에도 표시되지 않으며, 로그인한 본인만 서비스 화면에서 열람할 수 있습니다. ② 저장 위치: Google LLC Firebase Realtime Database(싱가포르 리전)에 저장됩니다. 자세한 내용은 5항·6항을 참고해 주세요. ③ 이용 제한: 회사는 다이어리 기록을 광고, 인공지능 모델의 학습, 통계 분석에 이용하지 않습니다. 회사 담당자는 회원이 요청한 문의 처리, 장애·보안 대응, 법령에 따른 요청의 경우에 한하여 필요한 최소 범위에서만 기록에 접근하며, 그 밖의 경우에는 열람하지 않습니다. 향후 기록을 활용하는 새 기능은 회원이 따로 켜는 경우에만 적용합니다. ④ 작성 시 유의: 건강·신념 등 민감한 내용이나 다른 사람을 알아볼 수 있는 정보는 적지 않도록 권장합니다. 적으신 경우에도 위 ①~③의 범위에서만 처리합니다. ⑤ 삭제: 다이어리 안 「다이어리 비우기」로 즉시 삭제할 수 있으며, 회원 탈퇴 시 함께 삭제됩니다.',
  },
];

// 개정 사유 (약관규제법 제3조·약관 제3조 3항: 적용일자와 개정 사유를 명시)
const REASON_KO = '「나의 다이어리」 서비스 출시에 따라, 회원님이 직접 쓰신 기록의 권리와 처리 방식을 분명히 알려 드리기 위해 개정합니다.';
const REASON_EN = 'With the launch of My Diary, we are updating these documents to make clear who owns what you write and how your entries are handled.';

// 핵심 요약 — 회원에게 불리할 수 있는 한 줄(양식만 떼어 배포 제한)을 숨기지 않는다(법률 고문 5739220 B)
const SUMMARY_KO = [
  '다이어리에 직접 쓰신 기록은 회원님의 것입니다. 본인 기록으로 인쇄·보관하고 가족·지인과 나눌 수 있습니다.',
  '다만 다이어리 양식만 따로 떼어 배포하는 것은 제한됩니다. (이용약관 제2조·제8조)',
  '약관이 바뀔 때 동의하지 않으시면 탈퇴하실 수 있고, 그 경우 개정 약관은 회원님께 적용되지 않는다는 점을 약관에 명시했습니다. (이용약관 제3조)',
  '다이어리 기록은 본인만 볼 수 있고, 광고·인공지능 학습·통계에 쓰지 않으며, 탈퇴하면 함께 삭제됩니다. (개인정보처리방침 1·2·3·5·6·7·13·16항)',
];
const SUMMARY_EN = [
  'What you write in your Diary is yours. You may print and keep it, and share it with family and friends as your own record.',
  'However, distributing the Diary forms on their own (e.g. as blank forms) is restricted. (Terms, Art. 2 and 8)',
  'The Terms now state that if you do not accept an amendment you may withdraw, and the amendment will not be applied to you. (Terms, Art. 3)',
  'Only you can see your entries; we never use them for ads, AI training or statistics, and they are deleted when you withdraw. (Privacy Policy §1·2·3·5·6·7·13·16)',
];

// 이의제기 문구 — 법률 고문 권고 문장(5739187·5739220 C). 동의 간주는 이용약관에만, 처리방침은 안내 사항.
const OBJECTION_KO = '개정 이용약관에 동의하지 않으시면 시행일 전까지 문의처로 알려 주시거나 회원 탈퇴(이용계약 해지)를 하실 수 있습니다. 시행일(' + EFFECTIVE_KO + ')까지 거부 의사를 밝히지 않으시면 개정 이용약관에 동의하신 것으로 봅니다. 개인정보처리방침은 동의 대상이 아닌 안내 사항입니다.';
const OBJECTION_EN = 'If you do not agree to the revised Terms, you may tell us at the contact below or withdraw your membership (terminate the service agreement) before the effective date. If you do not object by ' + EFFECTIVE_EN + ', you will be deemed to have accepted the revised Terms. The Privacy Policy is a notice, not something you are asked to agree to.';

const URLS = {
  terms: 'https://lifeportfolio.co.kr/terms',
  privacy: 'https://lifeportfolio.co.kr/privacy',
  termsPrev: 'https://lifeportfolio.co.kr/terms-2026-05-14',
  privacyPrev: 'https://lifeportfolio.co.kr/privacy-2026-06-19',
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

module.exports = { CAMPAIGN, NOTICE_START_KST, EFFECTIVE_KST, POPUP_END_KST, EFFECTIVE_KO, PRIVACY_EFFECTIVE_KO, EFFECTIVE_EN, PRIVACY_EFFECTIVE_EN, REASON_KO, REASON_EN, CHANGES, SUMMARY_KO, SUMMARY_EN, OBJECTION_KO, OBJECTION_EN, URLS, buildPolicyUpdateEmail };
