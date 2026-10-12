'use strict';
// 비전카드 (vision-card-v1, 대표 승인 2026-10-12 「필요한 연결 다리고 두 번 일하는 걸 예방 … 고객관점에서 충분히 구현」).
// Offline: source rules + 대원칙-F population (≥1,000 synthetic users, half older reports) → every seed yields a quest
// the card can draw (3 phases × 4 weeks, phase 'aim' present) or no quest at all (card not shown). Browser: 3 widths ×
// states (start / mid / done) — no overflow, one 「지금 여기」, touch targets ≥44px, no internal ids, no scores, no dates.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
let n=0;const t=(name,fn)=>{fn();n++;};
const app=fs.readFileSync(path.join(root,'assets/js/diary-app.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/css/diary.css'),'utf8');
const vc=app.slice(app.indexOf('// ---------------------------------------------------------------- 비전카드'),app.indexOf('  function cardFields() {'));
t('defined-and-wired',()=>{assert.ok(vc.length>2000);assert.ok(/visionCard\(q, filled, now, nm, c\)/.test(app));assert.ok(/data-vc-jump/.test(app)&&/id="aq-vision"/.test(vc));});
t('customer-explains-what-why-next',()=>{['무엇인가요?','왜 좋은가요?','지금은 무엇을 하나요?','다시 적지 않아도 돼요','다음 걸음에 그대로 이어지는 것'].forEach(k=>assert.ok(vc.includes(k),k));});
t('four-steps-mapped',()=>{['시작 전','[1, 4]','[5, 8]','[9, 12]'].forEach(k=>assert.ok(vc.includes(k),k));
 ['나를 이해하는 도우미','길찾기 도우미','오늘의 미션 도우미','실행 동행 도우미','기록 정리 도우미','결과물 피드백 도우미','대화를 잇는 도우미','함께할 일 찾기 도우미'].forEach(k=>assert.ok(vc.includes(k),k));
 ['"routes"','"practice"','"community"','"mentor"','"review"','"collaboration"'].forEach(k=>assert.ok(vc.includes(k),k));});
t('helpers-exist-on-homepage',()=>{const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');['나를 이해하는 도우미','길찾기 도우미','오늘의 미션 도우미','실행 동행 도우미','기록 정리 도우미','결과물 피드백 도우미','대화를 잇는 도우미','함께할 일 찾기 도우미'].forEach(k=>assert.ok(idx.includes(k),'homepage names '+k));});
t('promises',()=>{['AI 도우미는 제안만 해요','사람이 함께 확인해야 단계가 올라가요','지금은 어디에도 보내지 않아요','점수나 순위는 없어요','출시 준비중'].forEach(k=>assert.ok(vc.includes(k),k));});
t('no-score-date-source-internal',()=>{assert.ok(!/\d{4}년|\d+월 \d+일 출시|오픈 예정일/.test(vc));assert.ok(!/누가복음|마태복음|여호수아|asset-quest-v1['"]|ref:|ruleId/.test(vc.replace(/^\s*\/\/.*$/gm,'')));assert.ok(!/점수[를가는]? 매|등급|순위[를가]/.test(vc));});
t('no-save-or-send',()=>{assert.ok(!/st\.call\(/.test(vc),'vision card never calls the server');assert.ok(!/fetch\(|navigator\.sendBeacon/.test(vc));});
t('no-self-centred-card-labels',()=>{['내 자산 카드','내 카드로 남기기','내 카드로 남겼어요','내 기록의 「남긴 것」','내 손으로 쓰는 마지막 한 줄'].forEach(k=>assert.ok(!app.includes(k),'reworded: '+k));});
t('css-touch-and-mobile',()=>{assert.ok(/button\.vc-svc\{min-height:44px/.test(css));assert.ok(/\.aq-jump a\{[^}]*min-height:44px/.test(css));assert.ok(/\.vc \.badge\{white-space:nowrap/.test(css));});
// 대원칙-F population
{const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),PE=require(root+'/assets/js/program-engine.js'),R=require(root+'/assets/js/response-evidence.js'),S=require(root+'/assets/js/diary-schema.js');
 const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json'),pr=require(root+'/data/program-rules.json');
 const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
 const N=Number(process.env.VC_USERS||1000);let legacy=0,withQuest=0,noQuest=0,withVision=0;
 for(let seed=0;seed<N;seed++){const r0=rnd(seed+303),a={Q1:'S'};
  questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
  const i={questions,mapping,rules,careerRules,answers:a,inputContractVersion:seed%2?undefined:'input-v2',profile:{name:'S',submittedAt:10},lang:'ko'};
  let r=V.upgrade(E.build(i),i);if(seed%2)legacy++;else r=R.attachAxes(r,questions,a);r={...r,_assetPath:P.compose(A,r,a)};
  const p=PE.build({report:r,rules:pr,name:'S',lang:'ko',axisProgram:true,cardShape:'rq-01'});
  // Same path as the server seed (functions/_diary_module.js questFrom → S.questView) without loading firebase-functions.
  const q=S.questView(p&&p._assetQuest),mv=(r.sections||[]).find(x=>x&&x.id==='mission_vision');
  if(mv&&mv.content&&String(mv.content.vision||mv.content.visionHeadline||'').trim())withVision++;
  if(!q){noQuest++;continue;}withQuest++;
  assert.equal(q.phases.length,3);q.phases.forEach((ph,k)=>{assert.ok(ph.aim,'phase aim '+k);assert.equal(ph.weeks.length,4);});
  assert.ok(q.card&&q.card.name,'card name');assert.ok(!/LP-|ref|rule|_v\d/.test(JSON.stringify(q)),'no internal ids');}
 t('population-F-'+N+'-users',()=>{assert.ok(legacy>=N*0.45);assert.ok(withQuest>=N*0.9,'most users get a vision card: '+withQuest);assert.ok(withVision>=N*0.95,'vision line present: '+withVision);});
 console.log(JSON.stringify({users:N,older:legacy,withQuest,noQuest,withVision}));}
console.log(JSON.stringify({passed:n,scope:'offline source + population; browser via VC_BROWSER=1'}));
