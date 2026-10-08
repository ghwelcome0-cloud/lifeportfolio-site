'use strict';
// Diary release (2026-10-08), the policy-update notice (2026-10-17) and the homepage header (diary shortcut,
// crisper nav text — 2026-10-09) and the DEF-002 payments lock (2026-10-08) changed exactly these strings
// in pinned boundary files.
// Pinned "unchanged boundary" tests strip ONLY these exact strings and still compare the
// rest byte-for-byte, so any other change to these files keeps failing.
const DELTA = {
  // DEF-002 (2026-10-08 ops-audit, owner-approved): payments/$uid client write locked to server-only.
  //   Exactly one string in database.rules.json changes; everything else stays byte-pinned.
  'database.rules.json': [["\".write\": \"false\",\n\n", "\".write\": \"auth != null && auth.uid === $uid && !root.child('b2b_access').child($uid).exists() && !root.child('b2b_locks').child($uid).exists() && (!data.exists() || data.child('paid').val() !== true)\",\n\n"]],
  'firebase.json': [['|program-guide|report-guide|diary|diary-guide|terms-2026-05-14|privacy-2026-06-19)', '|program-guide|report-guide)']],
  'index.html': [['<a aria-label="블로그 글 모아보기" class="lp-shortcut" href="/blog" id="blog-shortcut"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg><span>블로그</span></a><a aria-label="내 다이어리 열기" class="lp-shortcut" href="/diary" id="diary-shortcut"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v18M14 3v6l2-1.5L18 9"/></svg><span>내 다이어리</span></a>', '<a aria-label="블로그 글 모아보기" class="lp-shortcut" href="/blog" id="blog-shortcut"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg><span>블로그</span></a>'], ['<link href="/assets/css/lp-consent.css" rel="stylesheet"/><link href="/assets/css/lp-header.css" rel="stylesheet"/>', '<link href="/assets/css/lp-consent.css" rel="stylesheet"/>'], ['<script defer="" src="/assets/js/policy-update-popup.js"></script>', ''], ['<p class="v4-muted">여기 적은 글은 다이어리로 옮겨지지 않아요. <a class="lp-diary-keep" href="/diary" id="home-diary-link" style="display:inline-flex;align-items:center;min-height:44px;color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:4px">📔 마이페이지의 「나의 다이어리」에서 기록하고 보관할 수 있어요 ↗</a></p>\n', '']],
};
function strip(file, text) {
  for (const [now, was] of DELTA[file] || []) {
    if (text.split(now).length !== 2) throw new Error('diary release delta must appear exactly once in ' + file);
    text = text.replace(now, was);
  }
  return text;
}
module.exports = { strip, DELTA };
