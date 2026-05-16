/**
 * 21-Day Companion D22 Reminder Email — English Template
 * ===========================================================
 *
 * Send time: purchase_date + 21 days (D22 = the 22nd day), 09:00 KST
 * Recipients: checkin21_preorders with status='pending' (currently free beta)
 *
 * Tone decisions (mirror KO):
 *   - "You lived through 21 days — that itself is the outcome" (no guilt)
 *   - "Beta access + $5 additional discount at launch" (transparent)
 *   - 4 mirrors framing — consistent with landing page copy
 *   - Self check-in form: placeholder (Week 3 activation)
 *
 * Usage:
 *   const { buildD22EmailEn } = require('./emails/d22-en');
 *   const { subject, html, text } = buildD22EmailEn({
 *     name: 'Jane Doe',
 *     purchaseDateIso: '2026-04-25',
 *     formUrl: 'https://lifeportfolio.co.kr/checkin-21-en.html',
 *     replyTo: 'faise@lifeportfolio.co.kr',
 *   });
 */

'use strict';

function safeGreetingName(name) {
  const trimmed = (name || '').toString().trim();
  const safe = trimmed.length > 0 ? trimmed : 'there';
  return escapeHtml(safe);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format ISO date (YYYY-MM-DD) into English — "April 25, 2026"
 */
function formatEnglishDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.toString());
  if (!m) return '';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return '';
  return `${months[mi]} ${parseInt(m[3], 10)}, ${m[1]}`;
}

/**
 * D22 English email builder
 *
 * @param {Object} params
 * @param {string} params.name              Recipient name
 * @param {string} params.purchaseDateIso   Report received date (YYYY-MM-DD)
 * @param {string} params.formUrl           Self check-in form URL (Week 3)
 * @param {string} [params.replyTo]         Reply-to email
 * @returns {{subject: string, html: string, text: string}}
 */
function buildD22EmailEn(params) {
  const name = safeGreetingName(params.name);
  const purchaseDateLabel = formatEnglishDate(params.purchaseDateIso);
  const formUrl = (params.formUrl || 'https://lifeportfolio.co.kr/checkin-21-en.html').toString();
  const replyTo = (params.replyTo || 'faise@lifeportfolio.co.kr').toString();

  const subject = '[Life Portfolio] 21 days have passed — time to meet the mirror';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a2332;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f7f5f0;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 8px 40px;border-bottom:3px solid #c9a961;">
            <div style="font-size:14px;letter-spacing:1px;color:#c9a961;font-weight:700;text-transform:uppercase;">Life Portfolio · D22</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">21-Day Companion Review</div>
          </td>
        </tr>

        <!-- Body opening -->
        <tr>
          <td style="padding:36px 40px 8px 40px;">
            <h1 style="font-size:24px;line-height:1.4;color:#1a2332;margin:0 0 20px 0;font-weight:700;">
              ${name}, you've lived through 21 days.
            </h1>
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 16px 0;">
              ${purchaseDateLabel ? `Since you received your report on ${escapeHtml(purchaseDateLabel)},` : 'Since you received your report,'}
              twenty-one mornings have come and gone.
            </p>
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 16px 0;">
              This isn't about grading whether you did well or fell short.
              <b style="color:#1a2332;">The fact that you lived through these 21 days</b> is already the outcome.
              What we'd like to do together is look at <b style="color:#c9a961;">what shape those 21 days took — honestly, through 4 mirrors</b>.
            </p>
          </td>
        </tr>

        <!-- WHAT — 4 mirrors box -->
        <tr>
          <td style="padding:8px 40px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#faf8f3;border-left:4px solid #c9a961;border-radius:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:13px;font-weight:700;color:#c9a961;letter-spacing:0.5px;margin-bottom:12px;">4 mirrors for looking back at 21 days</div>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">Mirror A</b> · Mission alignment — How often did you sense your mission across these 21 days?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">Mirror B</b> · First-three execution rate — What happened with the first actions your report suggested?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">Mirror C</b> · Next-three-weeks clarity — Can you picture the next three weeks?
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#1a2332;">
                        <b style="color:#c9a961;">Mirror D ⭐</b> · Asset retention — Did the 21 days you lived become an asset that stays with you?
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA box -->
        <tr>
          <td style="padding:28px 40px 8px 40px;">
            <p style="font-size:15px;line-height:1.75;color:#334155;margin:0 0 20px 0;">
              <b style="color:#1a2332;">The 21-Day Companion Review is currently in pre-order beta</b>, and
              ${name}, you're one of the <b style="color:#c9a961;">people receiving the review for free before official launch</b>.
              Once the launch date and self check-in page are ready, we'll
              <b>notify this email address first</b>, and when you do choose to pay later,
              the <b style="color:#c9a961;">$5 pre-order discount</b> will be applied automatically.
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
                    21-Day Companion Page →
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#94a3b8;margin:10px 0 0 0;">
              ※ The self check-in form will be sent in a separate email at official launch.
            </p>
          </td>
        </tr>

        <!-- Soft closing -->
        <tr>
          <td style="padding:20px 40px 32px 40px;">
            <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 12px 0;">
              If there's one line that surfaces when you think back on these 21 days,
              feel free to simply reply to this email.
              When we launch, we'll personally help you find the review format that fits ${name} best.
            </p>
            <p style="font-size:14px;line-height:1.7;color:#1a2332;margin:0;font-weight:600;">
              Thank you — sincerely — for living through these 21 days.<br>
              <span style="color:#c9a961;">— The Life Portfolio team</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px 40px;background:#f7f5f0;border-top:1px solid #e2e8f0;">
            <p style="font-size:11px;line-height:1.7;color:#94a3b8;margin:0 0 6px 0;">
              This email is sent only to <b style="color:#475569;">21-Day Companion pre-order subscribers</b>.
              Reply: <a href="mailto:${escapeHtml(replyTo)}" style="color:#c9a961;text-decoration:none;">${escapeHtml(replyTo)}</a>
            </p>
            <p style="font-size:11px;line-height:1.7;color:#94a3b8;margin:0;">
              Life Portfolio · <a href="https://lifeportfolio.co.kr" style="color:#94a3b8;text-decoration:underline;">lifeportfolio.co.kr</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `${name}, you've lived through 21 days.`,
    '',
    purchaseDateLabel
      ? `Since you received your report on ${purchaseDateLabel}, twenty-one mornings have come and gone.`
      : 'Since you received your report, twenty-one mornings have come and gone.',
    '',
    `This isn't about grading whether you did well or fell short.`,
    'The fact that you lived through these 21 days is already the outcome.',
    `What we'd like to do together is look at what shape those 21 days took —`,
    'honestly, through 4 mirrors.',
    '',
    '─────────────────────────',
    '4 mirrors for looking back at 21 days',
    '─────────────────────────',
    'Mirror A · Mission alignment — How often did you sense your mission across these 21 days?',
    'Mirror B · First-three execution rate — What happened with the first actions your report suggested?',
    'Mirror C · Next-three-weeks clarity — Can you picture the next three weeks?',
    'Mirror D ⭐ Asset retention — Did the 21 days you lived become an asset that stays with you?',
    '',
    '─────────────────────────',
    '',
    'The 21-Day Companion Review is currently in pre-order beta,',
    `and ${name}, you're one of the people receiving the review for free before official launch.`,
    `Once the launch date and self check-in page are ready, we'll notify this email address first,`,
    'and when you do choose to pay later, the $5 pre-order discount will be applied automatically.',
    '',
    `▶ 21-Day Companion Page: ${formUrl}`,
    '',
    '※ The self check-in form will be sent in a separate email at official launch.',
    '',
    '─────────────────────────',
    '',
    `If there's one line that surfaces when you think back on these 21 days,`,
    'feel free to simply reply to this email.',
    `When we launch, we'll personally help you find the review format that fits ${name} best.`,
    '',
    'Thank you — sincerely — for living through these 21 days.',
    '— The Life Portfolio team',
    '',
    '─────────────────────────',
    'This email is sent only to 21-Day Companion pre-order subscribers.',
    `Reply: ${replyTo}`,
    'Life Portfolio · https://lifeportfolio.co.kr',
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildD22EmailEn,
  _internals: { safeGreetingName, escapeHtml, formatEnglishDate },
};
