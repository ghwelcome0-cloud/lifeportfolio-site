// Compare actual outputs to an explicit preserved baseline; never change engines to satisfy old labels.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const candidate=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=process.argv[2];
if(!baseline)throw new Error('Explicit preserved baseline directory required.');
const files=['assets/js/report-engine.js','assets/js/report-engine-v4.js','assets/js/program-engine.js','assets/js/career-engine.js','data/questions.json','data/mapping.json','data/report-rules.json','data/program-rules.json','data/career-rules.json','report.html','report-loading.html','program.html','program-loading.html','suvey.html'];
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const hashes={};
for(const f of files){hashes[f]=digest(fs.readFileSync(path.join(baseline,f)));assert.equal(digest(fs.readFileSync(path.join(candidate,f))),hashes[f],f);}
function engine(root){
 const req=createRequire(path.join(root,'package.json'));
 const R=req('./assets/js/report-engine.js'),V=req('./assets/js/report-engine-v4.js'),P=req('./assets/js/program-engine.js');
 const q=req('./data/questions.json'),mapping=req('./data/mapping.json'),rules=req('./data/report-rules.json'),programRules=req('./data/program-rules.json'),careerRules=req('./data/career-rules.json');
 const fixture=req('./scripts/fixtures/synthetic_assessment.js').buildSyntheticAssessment(q).answers;
 return {fixture,run(answers,lang){const options={questions:q,mapping,rules,careerRules,answers,profile:{name:'합성 보존 검사',email:'synthetic@example.invalid'},lang};const report=V.upgrade(R.build(options),options);return {report,program:P.build({report,rules:programRules,name:'합성 보존 검사',lang})};}};
}
function stable(o){if(Array.isArray(o))return o.map(stable);if(o&&typeof o==='object'){return Object.fromEntries(Object.keys(o).sort().filter(k=>!['generatedAt','publishedAt','submittedAt'].includes(k)).map(k=>[k,stable(o[k])]));}return o;}
const before=engine(baseline),after=engine(candidate);
const domains=['정치','경제','사회','문화','교육','의료','복지','환경','예술','미디어','스포츠','법률','종교'];
const values=[['정직','책임','질서'],['사랑','신뢰','배려'],['사랑','자유','의미 추구'],['성장','도전','성취'],['자유','평화','포용']];
const compass=['의미 / 보람 / 가치','안정성 / 안전 / 예측 가능성','성장 가능성 / 배움의 기회','자유 / 자율성','관계 / 소속감 / 인정','결과 / 성과 / 효율성','재미 / 흥미 / 몰입감','신념 / 원칙 / 종교적 기준','책임 / 도리 / 역할 충실'];
let cases=0;const sections=new Set();const aggregate=crypto.createHash('sha256');
for(const domain of domains)for(const value of values)for(const direction of compass)for(const lang of ['ko','en']){
 const answers=structuredClone(before.fixture);answers.Q75=[domain];answers.Q13=value;answers.Q63=[direction];
 const a=stable(before.run(answers,lang)),b=stable(after.run(answers,lang)),repeat=stable(after.run(answers,lang));
 assert.deepEqual(b,a,'Baseline output difference');assert.deepEqual(repeat,b,'Nondeterministic output');
 sections.add(digest(JSON.stringify(b.report.sections)));aggregate.update(JSON.stringify(b));cases++;
}
console.log(JSON.stringify({suite:'report_program_preservation',cases,mismatches:0,repeat_mismatches:0,source_files_unchanged:files.length,distinct_report_section_payloads:sections.size,aggregate_sha256:aggregate.digest('hex'),source_hashes:hashes,limits:'Parity and reproducibility, not a new quality score or proof of one unique headline per person.'},null,2));
