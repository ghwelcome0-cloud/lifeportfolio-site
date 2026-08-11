export const POLICY_GOVERNED_PATHS=[
  "contracts/public-contact-policy.json","contracts/public-contact-policy.approval.json","contracts/public-contact-policy.migrations.json","contracts/activation.json",
  "scripts/hosting-artifact-verifier-lib.mjs","scripts/verify-downloaded-hosting-artifact.mjs","scripts/verify-public-contact-migration.mjs","scripts/composed-source-lib.mjs","scripts/verify-composed-source.mjs","scripts/test-composed-source.mjs",".github/workflows/public-contact-policy-activation.yml"
];
export function routePolicyContract(changed){return changed.some(file=>POLICY_GOVERNED_PATHS.includes(file))?"activation":"steady";}
