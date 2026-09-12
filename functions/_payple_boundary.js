'use strict';
// Pure validation boundary. Never fetches, logs secrets, or issues purchase rights.
function fail(ErrorType, code, message) { throw new ErrorType(code, message); }
function testMode(environment, requested, projectId, ErrorType) {
  if (!['live', 'sandbox', 'test'].includes(environment)) fail(ErrorType, 'failed-precondition', 'Invalid server payment environment.');
  const test = environment !== 'live';
  if (test && (!projectId || projectId === 'lifeporfolio')) fail(ErrorType, 'failed-precondition', 'Sandbox payments require an identified non-production project.');
  if (requested !== undefined && requested !== test) fail(ErrorType, 'invalid-argument', 'Client/server payment environment mismatch.');
  return test;
}
function requestIdentity(uid, injectedUid, oid, ErrorType) {
  if (!injectedUid || injectedUid !== uid) fail(ErrorType, 'permission-denied', 'Payment user does not match authenticated user.');
  if (typeof oid !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(oid)) fail(ErrorType, 'invalid-argument', 'Invalid payment order identifier.');
}
function confirmUrl(payType, callbackUrl, endpoints, ErrorType) {
  const expected = payType === 'card' ? endpoints.cardConfirmFallback : endpoints.bankConfirm;
  let url, trusted;
  try { url = new URL(payType === 'card' && callbackUrl ? callbackUrl : expected); trusted = new URL(expected); }
  catch (_) { fail(ErrorType, 'invalid-argument', 'Invalid payment confirmation URL.'); }
  if (url.protocol !== 'https:' || url.origin !== trusted.origin || url.username || url.password || url.hash) {
    fail(ErrorType, 'permission-denied', 'Untrusted payment confirmation destination.');
  }
  return url.href;
}
function receipt(data, uid, oid, amount, ErrorType) {
  if (String(data.PCD_PAY_RST || '').toLowerCase() !== 'success') fail(ErrorType, 'failed-precondition', 'Payment was not confirmed.');
  // Only provider response fields count. Never substitute browser callback fields.
  const value = String(data.PCD_PAY_TOTAL ?? '');
  if (!/^\d+(?:\.0+)?$/.test(value) || Number(value) !== amount) fail(ErrorType, 'failed-precondition', 'Confirmed payment amount mismatch.');
  if (String(data.PCD_USER_DEFINE1 || '').trim() !== uid) fail(ErrorType, 'permission-denied', 'Confirmed payment user mismatch.');
  if (String(data.PCD_PAY_OID || '').trim() !== oid) fail(ErrorType, 'permission-denied', 'Confirmed payment order mismatch.');
  return Number(value);
}
module.exports = { testMode, requestIdentity, confirmUrl, receipt };
