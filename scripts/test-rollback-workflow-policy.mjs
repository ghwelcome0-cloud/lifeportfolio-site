#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const body=fs.readFileSync(".github/workflows/firebase-hosting-rollback.yml","utf8");
assert.match(body,/options: \[rehearsal, live\]/);
assert.match(body,/environment: protected-preview/);
assert.match(body,/environment: production-live/);
assert.match(body,/verify-workflow-artifact\.mjs/);
assert.match(body,/verify-rollback-artifact\.mjs/);
assert.match(body,/verify-downloaded-hosting-artifact\.mjs/);
assert.match(body,/secrets\.FIREBASE_PRODUCTION_SERVICE_ACCOUNT/);
const live=body.slice(body.indexOf("  live:"));
assert.doesNotMatch(live,/secrets\.FIREBASE_SERVICE_ACCOUNT\b/);
assert.match(body,/test -n "\$APPROVAL_MESSAGE_ID"/);
assert.match(body,/public:\"rollback\/hosting\"/);
console.log("Verified rollback workflow policy passed");
