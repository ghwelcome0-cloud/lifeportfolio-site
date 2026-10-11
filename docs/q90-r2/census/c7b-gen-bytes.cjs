// C7b r2: gate/dev inputs serialized in the HARNESS INPUT FILE FORMAT (as verified on holdout-01..03.json, PREREGISTRATION.md:
// Q-keys only, keys sorted, compact separators, UTF-8, no trailing LF) -> sha256 of those bytes == `input_sha256` method.
// Also keeps the previous JSON.stringify(answers) hash for cross-reference. Deterministic.
const fs=require('fs'),path=require('path'),c=require('crypto');
const root=process.argv[2]||'/home/user/rq', outDir=process.argv[3]||'/home/user/work/c7b-bytes';
const src=fs.readFileSync(path.join(root,'scripts/test-answer-validation-gate.cjs'),'utf8');
const head=src.slice(0,src.indexOf('// ---------- emulator helpers'));
const m={exports:{}};const pre=head.replace(/for \(const key of \[.*?\n/s,'').replace(/^const results.*$/m,'const results=[];const ok=()=>{};');
new Function('require','module','exports','process','__dirname',pre+'\nmodule.exports={goodAnswers,BAD,HOLDOUT,byId,sha,setSha};')(p=>require(p.startsWith('.')?path.resolve(root,'scripts',p):p),m,m.exports,process,path.join(root,'scripts'));
const {goodAnswers,BAD,HOLDOUT,sha,setSha,byId}=m.exports;
const H=b=>c.createHash('sha256').update(b).digest('hex');
const sortDeep=v=>Array.isArray(v)?v:(v&&typeof v==='object')?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortDeep(v[k])])):v;
const canon=(a,noMeta)=>{const q={};for(const k of Object.keys(a))if(/^Q\d+$/.test(k)&&!(noMeta&&(k==='Q1'||k==='Q2')))q[k]=a[k];return Buffer.from(JSON.stringify(sortDeep(q)),'utf8');};
fs.mkdirSync(outDir,{recursive:true});
const rows=[];let n=0;
const add=(group,id,a,item)=>{const b=canon(a),b2=canon(a,true);const file=`dev-${String(++n).padStart(3,'0')}.json`;fs.writeFileSync(path.join(outDir,file),b);fs.writeFileSync(path.join(outDir,file.replace('.json','.noQ1Q2.json')),b2);rows.push({group,id,file,bytes:b.length,input_sha256:H(b),input_sha256_noQ1Q2:H(b2),bytes_noQ1Q2:b2.length,stringify_sha256:sha(a),item_sha256:item===undefined?null:sha(item)});};
// r3: mirror the fixed gate loop (seed 101..104, other honored). Also keep the rows the DEFECTIVE loop actually produced
// (seeds 100..103, no other) because those inputs were really used in gate runs before the fix (honesty: census = what ran).
for(const [n,opts] of [[1,{}],[2,{other:true}],[3,{}],[4,{other:true}]])add('C7-good','seed'+(100+n)+(opts.other?'-other':''),goodAnswers(100+n,opts));
for(const i of [0,1,2,3])add('C7-good-prefix-defective-loop','seed'+(100+i),goodAnswers(100+i,{}));
add('C7-partial','Q1Q2Q3-in-progress',{Q1:'회원',Q2:'마이페이지에서 확인',Q3:4});
const base=goodAnswers(7);add('C6a-base','seed7',base);
for(const b of [...BAD,...HOLDOUT]){const a={...base};if(b.value===undefined)delete a[b.qid];else a[b.qid]=b.value;add(BAD.includes(b)?'C6a-bad':'C6a-holdout',b.qid+'|'+b.kind,a,b.value);}
for(const [qid,kind,value] of [['Q3','missing_required',undefined],['Q41','multi_not_array',byId.Q41.options[0]],['Q4','likert_out_of_range',9]]){const a={...base};if(value===undefined)delete a[qid];else a[qid]=value;add('C6a-round1-shape',qid+'|'+kind,a);}
for(const s of [31,32,33])add('C10a-good','seed'+s,goodAnswers(s));
add('C10a-in-progress','Q1Q2Q3',{Q1:'회원',Q2:'마이페이지에서 확인',Q3:4});
add('C10a-b2b-minimal','Q1Q2',{Q1:'회원',Q2:'마이페이지에서 확인'});
// self-check: holdout-01..03 canonical form reproduces their registered file bytes (format proof)
const hoDir='/home/user/webapp/docs/q90/holdout';const proof=[];
for(const f of ['holdout-01.json','holdout-02.json','holdout-03.json']){const b=fs.readFileSync(path.join(hoDir,f));proof.push({file:f,registered_sha256:H(b),canon_roundtrip_equal:Buffer.compare(canon(JSON.parse(b)),b)===0});}
const uniq=new Set(rows.map(r=>r.input_sha256)).size,uniq2=new Set(rows.map(r=>r.input_sha256_noQ1Q2)).size;
const out={candidate:'3d3ebb476f36bbd24f65fb709ff4123e38609556',generator_commit:process.argv[4]||null,setSha256:setSha,format:'harness input file format: Q-keys only, sorted keys, JSON compact separators, UTF-8, no trailing LF (verified: holdout-01..03 round-trip byte-equal). Two variants per row: with Q1/Q2 and noQ1Q2 (final 15 carry no Q1/Q2 — Peer 6027388, harness_supplied_profile_meta). development_hashes = union of both.',format_proof:proof,counts:rows.reduce((h,r)=>(h[r.group]=(h[r.group]||0)+1,h),{}),rows:rows.length,unique_input_sha256:uniq,unique_input_sha256_noQ1Q2:uniq2,development_hashes:[...new Set([...rows.map(r=>r.input_sha256),...rows.map(r=>r.input_sha256_noQ1Q2)])].sort(),development_hashes_withQ1Q2:[...new Set(rows.map(r=>r.input_sha256))].sort(),development_hashes_noQ1Q2:[...new Set(rows.map(r=>r.input_sha256_noQ1Q2))].sort(),development_scope:{historical_unrecorded_verified:false,limitations:['개발 census는 게이트·합성 측정 입력만 포함, 사람이 개발 중 열람한 입력은 기록 없음','같은 결함 형태를 합성 seed 위에 재구성(사례 10·11·12 형태 3건)','hold-out 2건은 오입력 세트와 동일 입력이어서 교체(C5, PR #385); 교체 전 입력 2건도 이 목록에 남겨 둠']},rowsDetail:rows};
fs.writeFileSync(path.join(outDir,'c7b-dev-census.json'),JSON.stringify(out,null,1));
console.log(JSON.stringify({rows:rows.length,unique:uniq,uniqueNoQ1Q2:uniq2,setSha:setSha.slice(0,8),proof:proof.map(p=>p.canon_roundtrip_equal)}));
