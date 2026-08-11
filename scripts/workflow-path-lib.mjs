export const HOSTING_WORKFLOW_PATH = ".github/workflows/firebase-hosting-pr-build.yml";
export function assertWorkflowPath(actual, expected = HOSTING_WORKFLOW_PATH) {
  if (actual !== expected || !actual.startsWith(".github/workflows/")) throw new Error(`Workflow path mismatch: ${actual}`);
}
