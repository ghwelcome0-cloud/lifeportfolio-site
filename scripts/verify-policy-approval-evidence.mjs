#!/usr/bin/env node
const token=process.env.GH_TOKEN,repo=process.env.GITHUB_REPOSITORY,pr=process.env.CONTRACT_PR_NUMBER,head=process.env.PR_HEAD_SHA;
if(!token||!repo||!pr||!head)throw new Error("Policy approval inputs missing");
const res=await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`,{headers:{authorization:`Bearer ${token}`,accept:"application/vnd.github+json"}});if(!res.ok)throw new Error(`PR API ${res.status}`);const data=await res.json();if(data.head.sha!==head)throw new Error("PR head mismatch");
const match=/<!-- policy-approval-evidence\n([\s\S]*?)\n-->/m.exec(data.body||"");if(!match)throw new Error("policy approval evidence missing");const evidence=JSON.parse(match[1]);if(evidence.head_sha!==head)throw new Error("stale policy approval evidence");
for(const role of["owner","tech_lead","code_reviewer"]){const x=evidence.approvals?.[role];if(!x||x.head_sha!==head||x.decision!=="approved"||!/^\d+$/.test(String(x.message_id))||!/^https:\/\//.test(x.message_link)||!/^\d{4}-\d{2}-\d{2}T/.test(x.timestamp))throw new Error(`${role} approval missing/invalid`);}
console.log(`Same-head policy approval evidence passed: ${head}`);
