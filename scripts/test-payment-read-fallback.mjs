// Execute the real callback reader with deterministic time and synthetic dependencies.
// No provider, Firebase network or customer data access.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('payment-success.html','utf8');
const start=html.indexOf('async function persistPaidToRtdb(uid) {');
const end=html.indexOf('    const infoBox =',start);
assert.ok(start>0 && end>start);
const source=html.slice(start,end);
assert.ok(!/\b(?:set|update|writeNode|restWrite)\s*\(/.test(source),'Reader must not call write APIs');
assert.ok(html.includes('sdk: { ref: ref, get: get }'),'Callback injects read-only SDK capabilities');
async function scenario(name,config,expected) {
 let clock=0,id=0,done=false,result,error;
 const tasks=new Map(),counts={shared:0,sdk:0,rest:0,writes:0},paths=[];
 const auth={currentUser:{uid:'owner'}};
 if(config.initialUser!==undefined)auth.currentUser=config.initialUser;
 const schedule=(fn,delay)=>{const key=++id;tasks.set(key,{at:clock+Math.max(0,delay),fn});return key;};
 const wait=(delay,value)=>new Promise(resolve=>schedule(()=>resolve(value),delay));
 const never=()=>new Promise(()=>{});
 function shared() {
  counts.shared++;
  switch(config.shared){
   case 'paid':return {exists:true,val:{paid:true}};
   case 'negative':return {exists:false,val:null};
   case 'inconsistent':return {exists:false,val:{paid:true}};
   case 'string':return {exists:true,val:{paid:'true'}};
   case 'error':throw new Error('synthetic transport failure');
   case 'failed':return {exists:true,val:{paid:true},__failed:true};
   case 'malformed':return {val:{paid:true}};
   case 'stall':return never();
   case 'late':return wait(6000,{exists:true,val:{paid:true}});
   case 'switch':auth.currentUser={uid:'other'};return {exists:true,val:{paid:true}};
   case 'retry':return {exists:counts.shared>1,val:{paid:counts.shared>1}};
   default:throw new Error('Unexpected shared reader');
  }
 }
 const window={};
 if(config.shared)window.LPRTDB={readNode(path,opts){paths.push(path);assert.equal(opts.restMs,2000);assert.equal(opts.sdkMs,2000);return shared();},writeNode(){counts.writes++;throw new Error('forbidden');}};
 const context={window,auth,db:{},ref:(_db,p)=>p,Date:{now:()=>clock},setTimeout:schedule,clearTimeout:key=>tasks.delete(key),_LPRTDB_READY:config.loader==='stall'?never():config.loader==='delay'?wait(300,true):Promise.resolve(true),get(path){
  counts.sdk++;paths.push(path);
  if(config.sdk==='stall')return never();
  if(config.sdk==='error')throw new Error('synthetic SDK error');
  if(config.sdk==='switch')auth.currentUser={uid:'other'};
  return Promise.resolve({exists:()=>config.sdk==='paid',val:()=>({paid:true})});
 }};
 if(config.actualModule) {
  context.navigator={userAgent:'Synthetic test browser'};
  context.console={warn(){},log(){}};
  context.AbortController=AbortController;
  auth.currentUser.getIdToken=async()=> 'SYNTHETIC_TOKEN';
  context.fetch=async(url,options)=>{
   counts.rest++;
   assert.equal(url,'https://synthetic-db.invalid/payments/owner.json?auth=SYNTHETIC_TOKEN');
   assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');
   if(config.rest==='error')throw new Error('synthetic REST failure');
   if(config.rest==='switch')auth.currentUser={uid:'other'};
   return {ok:true,status:200,json:async()=>config.rest==='negative'?null:{paid:true}};
  };
  vm.runInNewContext(fs.readFileSync('assets/lp-rtdb.js','utf8'),context);
  context.window.LPRTDB.init({auth,db:context.db,databaseURL:'https://synthetic-db.invalid',sdk:{ref:context.ref,get:context.get}});
  const read=context.window.LPRTDB.readNode;
  context.window.LPRTDB.readNode=(path,opts)=>{counts.shared++;paths.push(path);return read(path,opts);};
 }
 vm.runInNewContext('let serverVerifiedUid=null;\n'+source+'\nthis.read=persistPaidToRtdb;this.verified=()=>serverVerifiedUid;',context);
 context.read(config.uid===undefined?'owner':config.uid).then(x=>{done=true;result=x;},e=>{done=true;error=e;});
 for(let turns=0;!done && turns<200;turns++){
  await new Promise(resolve=>setImmediate(resolve));
  if(done)break;
  assert.ok(tasks.size,`${name}: unresolved without deadline`);
  const [key,task]=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];tasks.delete(key);clock=task.at;task.fn();
 }
 assert.ok(done,`${name}: completion`);assert.ifError(error);assert.equal(result,expected.paid,name);
 assert.equal(context.verified(),expected.paid?'owner':null,`${name}: verified identity`);
 assert.equal(counts.writes,0);assert.ok(clock<=12000,`${name}: bounded overall wait`);
 assert.ok(paths.every(p=>p==='payments/owner'));
 if(expected.shared!==undefined)assert.equal(counts.shared,expected.shared,`${name}: shared reads`);
 if(expected.sdk!==undefined)assert.equal(counts.sdk,expected.sdk,`${name}: SDK reads`);
 // Drain late callbacks: a timed-out positive result cannot grant a right afterwards.
 for(let i=0;tasks.size && i<100;i++){
  const [key,task]=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];tasks.delete(key);clock=task.at;task.fn();await new Promise(resolve=>setImmediate(resolve));
 }
 assert.equal(context.verified(),expected.paid?'owner':null,`${name}: no late grant`);
 return {name,passed:true,...counts};
}
const specs=[
 ['no-user',{initialUser:null,shared:'paid',sdk:'paid'},{paid:false,shared:0,sdk:0}],
 ['mismatched-user',{initialUser:{uid:'other'},shared:'paid',sdk:'paid'},{paid:false,shared:0,sdk:0}],
 ['missing-uid',{uid:'',shared:'paid',sdk:'paid'},{paid:false,shared:0,sdk:0}],
 ['helper-missing-sdk-paid',{sdk:'paid'},{paid:true,sdk:1}],
 ['shared-paid-sdk-stalled',{shared:'paid',sdk:'stall'},{paid:true,shared:1,sdk:0}],
 ['negative-does-not-fallback-to-stale-sdk',{shared:'negative',sdk:'paid'},{paid:false,shared:3,sdk:0}],
 ['inconsistent-negative',{shared:'inconsistent',sdk:'paid'},{paid:false,sdk:0}],
 ['strict-boolean-paid',{shared:'string',sdk:'paid'},{paid:false,sdk:0}],
 ['shared-error-sdk-paid',{shared:'error',sdk:'paid'},{paid:true,sdk:1}],
 ['failed-sentinel-not-authoritative',{shared:'failed',sdk:'paid'},{paid:true,sdk:1}],
 ['malformed-shared-result',{shared:'malformed',sdk:'paid'},{paid:true,sdk:1}],
 ['both-stalled-deadline',{shared:'stall',sdk:'stall'},{paid:false}],
 ['loader-stalled-sdk-paid',{loader:'stall',sdk:'paid'},{paid:true,sdk:1}],
 ['late-shared-positive-ignored',{shared:'late',sdk:'negative'},{paid:false}],
 ['switch-during-shared-read',{shared:'switch',sdk:'paid'},{paid:false,sdk:0}],
 ['switch-during-sdk-read',{sdk:'switch'},{paid:false}],
 ['delayed-loader-shared-paid',{loader:'delay',shared:'paid',sdk:'stall'},{paid:true,shared:1,sdk:0}],
 ['shared-retry-becomes-paid',{shared:'retry',sdk:'paid'},{paid:true,shared:2,sdk:0}],
 ['sdk-errors-stay-unconfirmed',{sdk:'error'},{paid:false,sdk:3}],
 ['actual-module-rest-paid-sdk-stall',{actualModule:true,rest:'paid',sdk:'stall'},{paid:true,shared:1,sdk:0}],
 ['actual-module-rest-negative',{actualModule:true,rest:'negative',sdk:'paid'},{paid:false,shared:3,sdk:0}],
 ['actual-module-rest-error-sdk-paid',{actualModule:true,rest:'error',sdk:'paid'},{paid:true,shared:1,sdk:1}],
 ['actual-module-user-switch',{actualModule:true,rest:'switch',sdk:'paid'},{paid:false,sdk:0}]
];
const cases=[];for(const spec of specs)cases.push(await scenario(...spec));
console.log(JSON.stringify({suite:'payment_read_fallback',passed:cases.length,failed:0,scope:'Actual callback reader with fake time and mocked reads; NOT real PSP/device/atomicity validation',provider_network_requests:0,cases},null,2));
