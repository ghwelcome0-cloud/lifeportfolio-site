#!/usr/bin/env node
import fs from "node:fs";import path from "node:path";import Ajv2020 from "ajv/dist/2020.js";import addFormats from "ajv-formats";

const ROOT=path.resolve(import.meta.dirname,".."),DIR=path.join(ROOT,"internal/evidence/legal-authorities");
const r=JSON.parse(fs.readFileSync(path.join(DIR,"registry.v0.2.json"),"utf8")),fail=[];
const schema=JSON.parse(fs.readFileSync(path.join(DIR,"schema.v0.2.json"),"utf8")),ajv=new Ajv2020({allErrors:true,strict:true});addFormats(ajv);const validate=ajv.compile(schema);if(!validate(r))fail.push(`schema: ${ajv.errorsText(validate.errors)}`);
const issueIds=Array.from({length:10},(_,i)=>`LP-LGL-${String(i+1).padStart(3,"0")}`);
if(r.status!=="issue_index_draft"||r.schema_version!=="legal-authority-registry.v0.2")fail.push("registry status/schema drift");
if(JSON.stringify(r.issues.map(x=>x.issue_id))!==JSON.stringify(issueIds))fail.push("LP-LGL exact issue set/order mismatch");
const sourceIds=new Set(r.sources.map(x=>x.source_id));
for(const i of r.issues){if(i.legal_analysis_status!=="not_approved"||i.analysis_visibility!=="nonpublic_internal")fail.push(`${i.issue_id}: analysis state`);if(!/^[0-9a-f]{40}$/.test(i.verified_main_sha))fail.push(`${i.issue_id}: main SHA`);}
for(const s of r.sources){
  for(const k of ["jurisdiction","name","article","promulgation_date","effective_from","official_url","retrieved_at","verification_status","hash","retrieval_method","source_verification_status","publication_status","training_eligibility","license_review_status"])if(!(k in s))fail.push(`${s.source_id}: missing ${k}`);
  if(!/^https:\/\/(?:www\.)?(?:law\.go\.kr|privacy\.go\.kr)\//.test(s.official_url))fail.push(`${s.source_id}: source host`);
  if(s.training_eligibility!==false||s.training_approval!=="not_approved"||s.retrieval_approved!==false||s.external_qa_approved!==false)fail.push(`${s.source_id}: default-use state`);
  if(s.publication_status!=="not_approved"||s.approval_actor!==null||s.approval_at!==null||s.approval_source_hash!==null)fail.push(`${s.source_id}: approval immutability`);
  if(s.license_review_status!=="not_reviewed")fail.push(`${s.source_id}: licence state`);
  if(s.verification_status==="unverified_placeholder"){
    if(!s.blocking_reason||s.hash.value!==null||s.hash.scope!==null||s.retrieved_at!==null||s.minimum_quote!==null||s.verified_by!==null||s.verified_at!==null)fail.push(`${s.source_id}: placeholder completeness`);
  } else if(!s.effective_from||!s.hash.value||!s.hash.scope||!s.snapshot_path||!s.retrieval_method||!s.minimum_quote||!s.verified_by||!s.verified_at)fail.push(`${s.source_id}: invalid verified promotion`);
  if(s.authority_type==="court_decision"&&(!s.case_metadata||s.case_metadata.direct_precedent_for_service!==false||!/not direct precedent/i.test(s.case_metadata.application_limit)))fail.push(`${s.source_id}: case limitation`);
}
for(const l of r.issue_authority_links){if(!issueIds.includes(l.issue_id)||!sourceIds.has(l.source_id)||!l.application_scope||!l.limitations)fail.push(`bad link ${l.issue_id}/${l.source_id}`);}
for(const id of issueIds)if(!r.issue_authority_links.some(x=>x.issue_id===id))fail.push(`${id}: unlinked`);
for(const [name,mutate] of [["unknown",x=>x.sources[0].unknown=true],["type",x=>x.sources[0].training_eligibility="false"],["enum",x=>x.sources[0].publication_status="approved"],["required",x=>delete x.sources[0].official_url],["date",x=>x.sources[0].effective_from="not-a-date"]]){const f=structuredClone(r);mutate(f);if(validate(f))fail.push(`mutation accepted: ${name}`);}
const exact=[["전자상거래 등에서의 소비자보호에 관한 법률",["제13조","제17조","제18조"]],["전자상거래 등에서의 소비자보호에 관한 법률 시행령",["제21조의2"]],["약관의 규제에 관한 법률",["제3조"]],["약관의 규제에 관한 법률 시행령",["제3조"]]];
for(const [name,articles] of exact)for(const article of articles)if(!r.sources.some(x=>x.name===name&&x.article===article))fail.push(`missing atomic source ${name} ${article}`);
const text=fs.readdirSync(DIR).map(n=>fs.readFileSync(path.join(DIR,n),"utf8")).join("\n");for(const p of [/ghwelcome0@gmail\.com/i,/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/"private_key_id"\s*:/,/[?&](?:email|sig|token)=/i])if(p.test(text))fail.push(`forbidden ${p}`);
if(fail.length){console.error(fail.join("\n"));process.exit(1);}console.log("Legal issue/source/link atomicity, placeholder, case and approval immutability passed");
