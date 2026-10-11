'use strict';
// READ-ONLY production audit (TL 6030573 residual risk): count report/program nodes whose response status is not
// submitted/completed. Prints COUNTS ONLY — never customer values, never writes. Requires GOOGLE_APPLICATION_CREDENTIALS.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.RTDB_URL || 'https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app' });
const db = admin.database();
(async () => {
  const [reports, programs, responses] = await Promise.all(['reports', 'programs', 'responses'].map(p => db.ref(p).get().then(s => s.val() || {})));
  const out = { users_with_reports: 0, report_nodes: 0, program_nodes: 0, blocked_reports: 0, blocked_programs: 0, missing_response: 0, status_values: {} };
  for (const [uid, byS] of Object.entries(reports)) { out.users_with_reports++; for (const sid of Object.keys(byS || {})) { out.report_nodes++; const st = responses[uid] && responses[uid][sid] ? responses[uid][sid].status : undefined; const k = st === undefined ? '(none)' : String(st); out.status_values[k] = (out.status_values[k] || 0) + 1; if (!responses[uid] || !responses[uid][sid]) out.missing_response++; if (!['submitted', 'completed'].includes(st)) out.blocked_reports++; } }
  for (const [uid, byS] of Object.entries(programs)) for (const sid of Object.keys(byS || {})) { out.program_nodes++; const st = responses[uid] && responses[uid][sid] ? responses[uid][sid].status : undefined; if (!['submitted', 'completed'].includes(st)) out.blocked_programs++; }
  console.log(JSON.stringify(out));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
