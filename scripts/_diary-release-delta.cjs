'use strict';
// Diary release (2026-10-08) and the policy-update notice (2026-10-17) changed exactly these strings
// in pinned boundary files.
// Pinned "unchanged boundary" tests strip ONLY these exact strings and still compare the
// rest byte-for-byte, so any other change to these files keeps failing.
const DELTA = {
  'firebase.json': [['|program-guide|report-guide|diary|diary-guide|terms-2026-05-14|privacy-2026-06-19)', '|program-guide|report-guide)']],
  'index.html': [['<script defer="" src="/assets/js/policy-update-popup.js"></script>', ''], ['<p class="v4-muted"><a class="lp-diary-keep" href="/diary" id="home-diary-link" style="display:inline-flex;align-items:center;min-height:44px;color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:4px">📔 로그인하면 다이어리에 보관됩니다 ↗</a></p>\n', '']],
};
function strip(file, text) {
  for (const [now, was] of DELTA[file] || []) {
    if (text.split(now).length !== 2) throw new Error('diary release delta must appear exactly once in ' + file);
    text = text.replace(now, was);
  }
  return text;
}
module.exports = { strip, DELTA };
