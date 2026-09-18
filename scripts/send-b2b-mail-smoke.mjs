#!/usr/bin/env node
// Manual provider smoke test, NOT the production quote/signup/report E2E.
// No Firebase SDK, no DB access, no deployment; only two fixed synthetic messages.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const RECIPIENT_SHA = '277ac0b898769ab76d158642db546fedb51e149ac68620c51c8821e2a9d9a549';
export const FIXTURE_SHA = '5fcc528c6524cb663dcaa7a0b9938059d1d97fd4ecde85069c9ccb74333f7af2';
const FROM = 'Life Portfolio <faise@lifeportfolio.co.kr>';
export function loadMessages(recipient = 'not-sent@example.invalid') {
  const raw = fs.readFileSync(new URL('./fixtures/b2b-mail-smoke.json', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'), FIXTURE_SHA, 'Unreviewed fixture');
  const fixture = JSON.parse(raw);
  assert.equal(fixture.messages.length, 2);
  return fixture.messages.map((m, i) => {
    assert.equal(m.kind, i ? 'codes' : 'quote');
    assert.match(m.subject, /^\[시험 발송 · 입금 금지\]/);
    for (const text of [m.html, m.text]) {
      assert.ok(text.includes('실제 주문·청구·참여 권한이 없습니다'));
      assert.ok(!text.includes('3333-31-6566369'));
      assert.ok(!text.includes('/b2b-checkout?'));
    }
    assert.equal(m.attachments.length, i ? 1 : 0);
    for (const a of m.attachments) {
      assert.match(a.filename, /^AccessCode_LP-TEST-NOT-AN-ORDER_10codes\.xlsx$/);
      assert.ok(a.content.length < 100000);
      assert.equal(Buffer.from(a.content, 'base64').subarray(0, 2).toString(), 'PK');
    }
    return { from: FROM, to: [recipient], reply_to: 'faise@lifeportfolio.co.kr',
      subject: m.subject, html: m.html, text: m.text,
      ...(m.attachments.length ? { attachments: m.attachments } : {}) };
  });
}
export async function sendMessages(apiKey, recipient, request = fetch, wait = ms => new Promise(r => setTimeout(r, ms))) {
  assert.equal(createHash('sha256').update(recipient || '').digest('hex'), RECIPIENT_SHA, 'Recipient is not approved');
  assert.ok(apiKey && apiKey.trim(), 'Missing provider credential');
  const receipt = { fixtureSha: FIXTURE_SHA, recipientSha: RECIPIENT_SHA, scope: 'synthetic-template/provider-only', inboxConfirmed: false, messages: [] };
  for (const [i, body] of loadMessages(recipient).entries()) {
    const item = { kind: i ? 'codes' : 'quote', acceptance: 'unknown', providerEvent: null, messageId: null };
    receipt.messages.push(item);
    try {
      const res = await request('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `lp-smoke-${FIXTURE_SHA}-${i}` }, body: JSON.stringify(body),
      });
      item.httpStatus = res.status;
      if (res.ok) {
        const value = await res.json();
        if (typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value.id)) {
          item.acceptance = 'provider_accepted'; item.messageId = value.id;
        }
      } else if (res.status < 500) item.acceptance = 'not_accepted';
    } catch { item.acceptance = 'unknown'; }
    // Do not automatically retry POST: response loss can occur after acceptance.
    await wait(1200);
  }
  // Poll only IDs created above. A sending-only key may not permit GET; mark unknown.
  for (let attempt = 0; attempt < 3; attempt++) {
    await wait(10000);
    for (const item of receipt.messages.filter(m => m.messageId)) {
      if (['delivered', 'bounced', 'failed', 'complained'].includes(item.providerEvent)) continue;
      try {
        const res = await request(`https://api.resend.com/emails/${item.messageId}`, {
          method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        item.deliveryLookupHttpStatus = res.status;
        if (res.ok) {
          const value = await res.json();
          const event = value.last_event;
          if (['sent', 'delivered', 'delivery_delayed', 'bounced', 'failed', 'complained', 'opened', 'clicked', 'scheduled', 'queued'].includes(event)) item.providerEvent = event;
        }
      } catch { item.deliveryLookupHttpStatus = null; }
      await wait(1200);
    }
  }
  return receipt;
}
async function main() {
  loadMessages();
  if (process.argv.includes('--dry-run')) { console.log('PASS: two fixed synthetic messages; zero network requests'); return; }
  assert.deepEqual(process.argv.slice(2), ['--send']);
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_REPOSITORY, 'ghwelcome0-cloud/lifeportfolio-site');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Automatic/re-run sending prohibited');
  assert.equal(process.env.B2B_MAIL_APPROVED, 'true');
  let apiKey;
  try {
    apiKey = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=RESEND_API_KEY', '--project=lifeporfolio', '--quiet'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { throw Error('Protected Secret Manager access unavailable; no email sent'); }
  const receipt = await sendMessages(apiKey, process.env.B2B_MAIL_TEST_RECIPIENT);
  apiKey = '';
  fs.writeFileSync(`${process.env.RUNNER_TEMP}/b2b-mail-smoke-receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt)); // Only statuses/IDs, no credential/body/attachment.
  if (receipt.messages.some(m => m.acceptance !== 'provider_accepted')) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Test stopped; inspect sanitized receipt if present. No automatic resend.'); process.exitCode = 1; });
