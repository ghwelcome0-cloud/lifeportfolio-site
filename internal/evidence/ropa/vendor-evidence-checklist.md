# External vendor and console evidence checklist

Use this checklist only to record non-secret facts needed to move ROPA fields from `unknown` to `confirmed`. Evidence capture must not contain personal data, tokens, IDs tied to customers, private keys, raw logs, full URLs with query strings, or vendor exports.

## Safe capture standard

1. Use a dedicated synthetic account and synthetic order where a functional example is necessary.
2. Crop to the setting name, status, region, retention period, or contract version. Remove account email, project number, billing data, user IDs, IPs, URLs, event samples, and recipient lists.
3. Prefer a text evidence record: vendor, console section, setting key, value, observed-at UTC, observer role, source URL host only, and screenshot SHA-256.
4. Store screenshots outside Git. In Git, record only a sanitized filename, hash, capture date, and reviewer decision.
5. Never capture Secrets, IAM key material, OAuth credentials, API tokens, service-account JSON, webhook bodies, raw analytics events, payment transaction details, or customer messages.
6. Require a second-person privacy review before an evidence record changes `unknown` to `confirmed`.

## Firebase / Google Cloud

- [ ] Firebase Auth data location/tenant setting and enabled providers (values only; no client secrets).
- [ ] RTDB instance region and actual deployed Rules SHA.
- [ ] Firestore database location, PITR/backup settings, TTL policies and actual status.
- [ ] Cloud Functions deployed regions and Cloud Logging retention.
- [ ] Hosting/CDN log availability and retention.
- [ ] Backup/export destinations, encryption, retention and deletion process.
- [ ] DPA version, subprocessors, international-transfer mechanism and contract owner.
- [ ] Account deletion evidence for Auth, RTDB, Firestore, logs and backups using synthetic data.
- Safe method: sanitized settings screenshot + CLI output containing only resource type, region, policy state and config hash. Do not include project credentials or document samples.

## Payple

- [ ] Contracting entity and service used for card/transfer confirmation.
- [ ] Exact fields transmitted for initial/additional confirmation and fields returned.
- [ ] Processing/storage countries, retention, subprocessors, DPA/transfer mechanism.
- [ ] Server-confirmation support for each payment route, refund/dispute records and deletion constraints.
- [ ] Sandbox evidence for owner/amount/currency/order validation and duplicate callback behavior.
- Safe method: redact merchant IDs, auth keys, payer IDs, order IDs and response bodies. Record field names and pass/fail assertions only.

## PayPal

- [ ] Contracting entity, live/sandbox product and account data-sharing configuration.
- [ ] Request/response field inventory for create/capture/refund.
- [ ] Processing/storage countries, retention, subprocessors, DPA/transfer mechanism.
- [ ] Sandbox evidence for custom_id owner check, amount/currency and idempotency.
- Safe method: synthetic sandbox order; retain test case ID and redacted assertion summary, not transaction payload.

## Resend

- [ ] Contracting entity, region, email body/recipient/log retention and deletion API/process.
- [ ] Subprocessors, DPA/transfer mechanism and support-access controls.
- [ ] Domain, sender and suppression-list behavior without addresses.
- [ ] Synthetic deletion test for recipient/body/log copies.
- Safe method: synthetic `example.invalid` recipient; screenshot only setting labels and durations. Never include API key, actual recipient, message body or delivery event IDs.

## GA4 / GTM

- [ ] GA property owner, retention, data sharing, advertising signals, Google Signals and user-data collection settings.
- [ ] Consent Mode default and update behavior; region-specific defaults.
- [ ] BigQuery export/link status and destination retention.
- [ ] GTM live container version, tags/triggers/variables, custom HTML, URL/referrer variables and consent requirements.
- [ ] Duplicate pageview/event assessment for direct gtag plus GTM.
- [ ] Data deletion request process and account access list by role count (no names).
- Safe method: export a sanitized tag inventory containing tag type, trigger name, consent requirement and parameter keys only. Remove IDs, custom code values, URLs, event samples and user properties.

## Microsoft Clarity

- [ ] Whether a project ID is actually configured and production traffic is received.
- [ ] Consent mode, masking settings, retention, region, subprocessors and DPA/transfer mechanism.
- [ ] Session recordings/heatmaps deletion process.
- Safe method: settings-only screenshot with project/customer identifiers cropped; do not capture recordings, heatmaps with text, visitor IDs or URLs.

## Evidence record template

```json
{
  "evidence_id": "vendor-setting-YYYYMMDD-NNN",
  "vendor": "",
  "setting": "",
  "value": "",
  "observed_at": "YYYY-MM-DDTHH:mm:ssZ",
  "observer_role": "",
  "source_host": "",
  "sanitized_artifact_sha256": "",
  "contains_secrets": false,
  "contains_personal_data": false,
  "review_status": "pending_second_review",
  "notes": ""
}
```
