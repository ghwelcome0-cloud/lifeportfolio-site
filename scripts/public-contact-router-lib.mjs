export function canonicalGovernedSet(currentManifest,baseManifest){
  const files=new Set();
  for(const manifest of[baseManifest,currentManifest])for(const f of manifest?.contracts?.public_contact_policy?.files||[])files.add(f);
  for(const f of["contracts/activation.json","scripts/pr-head-selector.mjs","scripts/test-pr-head-selector.mjs","contracts/public-contact-policy.schema.json","scripts/public-contact-router-lib.mjs","scripts/run-public-contact-policy-router.mjs","scripts/test-public-contact-router.mjs","scripts/test-all.mjs","scripts/test-contract-manifest.mjs","scripts/contract-manifest-lib.mjs",".github/workflows/public-contact-policy-activation.yml",".github/workflows/required-checks.yml"])files.add(f);
  return [...files].sort();
}
export function routePolicyContract(changed,currentManifest,baseManifest){
  const governed=new Set(canonicalGovernedSet(currentManifest,baseManifest));
  const unknownPrefix=changed.some(f=>/^(?:contracts\/public-contact-|scripts\/(?:public-contact|.*contact.*(?:router|verifier|policy)|verify-downloaded-hosting-artifact)|\.github\/workflows\/public-contact)/.test(f)&&!governed.has(f));
  const nonMaterial=new Set(["scripts/pr-head-selector.mjs","scripts/test-pr-head-selector.mjs","scripts/test-pr-head-subprocess.mjs","scripts/test-public-contact-policy-governance.mjs","scripts/test-hosting-artifact-verifier.mjs","scripts/test-composed-source.mjs","scripts/public-contact-router-lib.mjs","scripts/run-public-contact-policy-router.mjs","scripts/test-public-contact-router.mjs","scripts/test-steady-current-integration.mjs",".github/workflows/public-contact-policy-activation.yml"]);
  const publicEntryChanged=JSON.stringify(currentManifest?.contracts?.public_contact_policy||null)!==JSON.stringify(baseManifest?.contracts?.public_contact_policy||null);
  const activationMaterial=new Set(["contracts/public-contact-policy.schema.json",...((currentManifest?.contracts?.public_contact_policy?.files)||[]),...((baseManifest?.contracts?.public_contact_policy?.files)||[])].filter(f=>!nonMaterial.has(f)));
  const contractChanged=changed.some(f=>activationMaterial.has(f));
  return contractChanged||unknownPrefix||(changed.includes("contracts/activation.json")&&publicEntryChanged)?"activation":"steady";
}
export async function executePolicyContract({mode,currentHead,policy,deps}){if(!["activation","steady"].includes(mode)||!/^[0-9a-f]{40}$/.test(currentHead))throw Error("Invalid executor input");const sequence=[],call=async(name,...args)=>{if(typeof deps[name]!=="function")throw Error(`Missing dependency: ${name}`);sequence.push(name);return deps[name](...args)};await call("manifest");await call("governance");await call("composedTests");if(mode==="activation"){await call("migration");await call("evidence");if(await call("buildPinned",policy.composed_source.head_sha)!==policy.composed_source.head_sha)throw Error("Pinned worktree SHA mismatch");await call("artifactDlp","pinned");await call("pinnedAssert");}else{if(await call("buildCurrent",currentHead)!==currentHead)throw Error("Current worktree SHA mismatch");await call("artifactDlp","current");}return sequence;}
