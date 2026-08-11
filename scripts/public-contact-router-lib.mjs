export function canonicalGovernedSet(currentManifest,baseManifest){
  const files=new Set();
  for(const manifest of[baseManifest,currentManifest])for(const f of manifest?.contracts?.public_contact_policy?.files||[])files.add(f);
  for(const f of["contracts/activation.json","contracts/public-contact-policy.schema.json","scripts/public-contact-router-lib.mjs","scripts/run-public-contact-policy-router.mjs","scripts/test-public-contact-router.mjs","scripts/test-all.mjs","scripts/test-contract-manifest.mjs","scripts/contract-manifest-lib.mjs",".github/workflows/public-contact-policy-activation.yml",".github/workflows/required-checks.yml"])files.add(f);
  return [...files].sort();
}
export function routePolicyContract(changed,currentManifest,baseManifest){
  const governed=new Set(canonicalGovernedSet(currentManifest,baseManifest));
  const unknownPrefix=changed.some(f=>/^(?:contracts\/public-contact-|scripts\/(?:public-contact|.*contact.*(?:router|verifier|policy)|verify-downloaded-hosting-artifact)|\.github\/workflows\/public-contact)/.test(f)&&!governed.has(f));
  return changed.some(f=>governed.has(f))||unknownPrefix?"activation":"steady";
}
export function commandPlan(mode){const common=["manifest","governance","composed-tests"];return mode==="activation"?[...common,"migration","evidence","pinned-build","artifact-dlp","pinned-assert"]:[...common,"current-build","artifact-dlp"];}
