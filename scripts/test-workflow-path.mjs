#!/usr/bin/env node
import assert from "node:assert/strict";
import { assertWorkflowPath, HOSTING_WORKFLOW_PATH } from "./workflow-path-lib.mjs";
assert.throws(() => assertWorkflowPath("firebase-hosting-pr-build.yml"));
assert.doesNotThrow(() => assertWorkflowPath(HOSTING_WORKFLOW_PATH));
console.log("Full workflow path contract passed");
