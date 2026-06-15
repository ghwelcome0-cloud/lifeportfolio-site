/* 전 영역(리포트+프로그램) 고유성 다양성 종합 측정
 *   목적: 사용자 질문 "리포트 12개 목차 + 프로그램 모든 목차 고유성 개선 진행됐나?" 검증.
 *   방식: 무작위 응답 N명 → 각 섹션 핵심 텍스트의 고유 패턴 수(distinct) 측정.
 *   실행: node tools/section_diversity_check.cjs [N]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PE = require(path.join(ROOT, 'assets/js/program-engine.js'));
const V4 = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));
const programRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/program-rules.json'), 'utf8'));
const careerRules  = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/career-rules.json'), 'utf8'));
const mapping      = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mapping.json'), 'utf8'));
const I = V4._internals;

const TONES = ['warm_connector','principled_designer','visionary_creator','pragmatic_achiever','reflective_explorer'];
const COMPASS = ['관계 / 소속감 / 인정','신념 / 원칙 / 종교적 기준','성장 가능성 / 배움의 기회','자유 / 자율성','의미 / 보람 / 가치'];
const AXES = ['self_understanding','self_expression','self_design','self_execution'];
const DOMAINS = ['교육','문화 콘텐츠','경제','의료','환경','예술','스포츠','법률','미디어','복지','정치','사회','종교'];
const Q1JOBS = ['교사','연구원','창업가','PD','간호사','공무원','디자이너','코치','기획자','작가'];
const TRAITS = ['따뜻함','정확함','지속성','호기심','추진력','공감','분석력','창의성','책임감','표현력'];

function ri(a){ return a[Math.floor(Math.random()*a.length)]; }
function riN(a,n){ const s=new Set(); while(s.size<n) s.add(ri(a)); return [...s]; }
function rndPct(){ return Math.floor(Math.random()*100); }

function makeAnswers(){
  return {
    Q1: [ri(Q1JOBS)], Q3: riN(TRAITS,2), Q13: riN(TRAITS,2),
    Q41: riN(['신뢰','감사','자유','정직','용기','배움'],2),
    Q63: [ri(COMPASS)], Q73: riN(TRAITS,1), Q75: riN(DOMAINS,2)
  };
}
function makeAxisPct(){ const o={}; AXES.forEach(a=>o[a]=rndPct()); return o; }

const N = parseInt(process.argv[2]||'1500',10);

// 측정 버킷
const buckets = {
  fingerprint:        new Set(),  // 입력 고유성 기준
  '①요약(시그니처)':  new Set(),
  '②사명헤드':         new Set(),
  '②사명종합':         new Set(),
  '②비전헤드':         new Set(),
  '②비전종합':         new Set(),
  '⑤진로(직업3개)':    new Set(),
  '⑤교육(3개)':        new Set(),
  '⑥확장방향':         new Set(),
  '⑦자기이해축':       new Set(),
  '⑩자기실행스타일':   new Set(),
  '11_고유한결(전체)': new Set(),
  '11_고유한결tagline':new Set(),
  'P_여는길(직업)':    new Set(),
  'P_직무적합성':      new Set(),
  'P_직업확장성':      new Set(),
  'P_분기테마':        new Set(),
  'P_3주루틴':         new Set(),
  'P_다음단계':        new Set()
};

function add(k,v){ if(v!==undefined&&v!==null&&v!=='') buckets[k].add(typeof v==='string'?v:JSON.stringify(v)); }

for(let i=0;i<N;i++){
  const ans = makeAnswers();
  const axisPct = makeAxisPct();
  const toneKey = ri(TONES);
  const fp = I.fullAnswerFingerprint(ans, mapping);
  buckets.fingerprint.add(fp);

  // ── 리포트 섹션 (report-engine-v4 합성 함수 직접 호출) ──
  try {
    const mvSlots = {
      values_raw: ans.Q63, compass_raw: ans.Q63,
      primary_domain: ans.Q75[0], secondary_domain: ans.Q75[1],
      values_primary_category: '성장'
    };
    const traits = ans.Q3.concat(ans.Q13);
    const sv = I.buildSignatureVars(toneKey, mvSlots, axisPct, traits, fp, 'ko');
    // 시그니처 변수(요약/실행스타일의 핵심 재료)는 sv 자체가 응답기반 → sv 종합으로 측정
    add('①요약(시그니처)', sv.valueAnchor+'|'+sv.compassPhrase+'|'+sv.axisLeadVerb+'|'+sv.traitColor);
    add('⑩자기실행스타일', sv.axisLeadVerb+'|'+sv.axisSig+'|'+sv.topAxis+'|'+sv.weakAxis);
    add('11_고유한결tagline', I.synthToneLabel ? I.synthToneLabel(sv,'ko') : '');
  } catch(e){ if(i===0) console.log('sv err:', e.message); }

  // 사명/비전
  try {
    const mv = I.synthMissionVisionFromResponses(ans, fp, 'ko', axisPct);
    if(mv){
      add('②사명헤드', mv.missionCore||mv.mission);
      add('②사명종합', (mv.missionCore||'')+'|'+(mv.missionDetail||''));
      add('②비전헤드', mv.visionCore||mv.vision);
      add('②비전종합', (mv.visionCore||'')+'|'+(mv.visionDetail||''));
    }
  } catch(e){ if(i===0) console.log('mv err:', e.message); }

  // 진로/교육/확장 (CareerEngine 직접)
  try {
    const ce = require(path.join(ROOT,'assets/js/career-engine.js'));
    const c = ce.build(ans, mapping, careerRules, fp, {lang:'ko', toneKey:toneKey});
    if(c){
      add('⑤진로(직업3개)', (c.careers||[]).join('·'));
      add('⑤교육(3개)', (c.education||[]).join('·'));
      add('⑥확장방향', (c.directions||[]).join('·'));
    }
  } catch(e){ if(i===0) console.log('ce err:', e.message); }

  // 자기이해 축 카드
  try {
    const card = { id:'self_understanding', content:{ pct: axisPct.self_understanding, keywords: ans.Q3 } };
    const enh = I.enhanceAxisCardV2 ? I.enhanceAxisCardV2(card,'ko',ans.Q3.concat(ans.Q13),fp) : null;
    if(enh && enh.content) add('⑦자기이해축', (enh.content.comment||enh.content.lead||enh.content.tierLabel||'').toString().slice(0,150));
  } catch(e){ if(i===0) console.log('axis err:', e.message); }

  // ── 프로그램 섹션 (program-engine.build 전체) ──
  try {
    // 실제처럼 tone.label은 응답기반(synthToneLabel) 결과를 주입 → 고유한 결 앞부분 변별
    let _label='테스트결';
    try {
      const _mvSlots={values_raw:ans.Q63,compass_raw:ans.Q63,primary_domain:ans.Q75[0],secondary_domain:ans.Q75[1],values_primary_category:'성장'};
      const _sv=I.buildSignatureVars(toneKey,_mvSlots,axisPct,ans.Q3.concat(ans.Q13),fp,'ko');
      _label=I.synthToneLabel(_sv,'ko')||_label;
    } catch(_e){}
    const report = {
      profile:{name:'X'}, name:'X', lang:'ko', tone:{key:toneKey, label:_label}, toneKey:toneKey,
      _v4Meta:{fingerprint:fp},
      axes: axisPct, answers: ans,
      sections:[{ id:'mission_vision', content:{ headline:'사명', missionHeadline:'사명', visionHeadline:'비전',
        _slots:{ values_primary_category:'성장', compass_raw:ans.Q63, primary_domain:ans.Q75[0], secondary_domain:ans.Q75[1] } } }],
      growth_map:{ keywords:ans.Q3 }
    };
    const p = PE.build({ report, rules:programRules, careerRules, mapping, name:'X', lang:'ko' });
    add('11_고유한결(전체)', p.cover && p.cover.typeLine);
    const eff = p.effects || (p.program && p.program.effects) || {};
    add('P_직무적합성', eff.fitJob);
    add('P_직업확장성', eff.expansion);
    add('P_여는길(직업)', (eff.newPaths||[]).join('·'));
    // [v1.4] subline(응답 종합 2단)을 측정에 포함 — 화면에 실제 노출되는 직관 한 줄
    add('P_분기테마', p.quarter && ((p.quarter.subline||'') + '##' + (p.quarter.theme || (p.quarter.paragraphs||[]).join('|'))));
    add('P_3주루틴', (p.program && p.program.weeks || []).map(w=>((w.subline||'')+'/'+(w.actions||[]).join('|'))).join('||'));
    add('P_다음단계', (p.nextSteps||[]).map(s=>s.task).join('||'));
  } catch(e){ if(i===0) console.log('PE err:', e.message); }
}

function pct(s){ return (s.size/N*100).toFixed(1)+'%'; }
console.log(`\n========= 전 영역 고유성 다양성 (무작위 응답 ${N}명) =========`);
console.log(`기준) fingerprint(입력) 고유: ${buckets.fingerprint.size} (${pct(buckets.fingerprint)})\n`);
console.log('── 리포트 12목차 ──');
const order = ['①요약(시그니처)','②사명헤드','②사명종합','②비전헤드','②비전종합',
  '⑤진로(직업3개)','⑤교육(3개)','⑥확장방향','⑦자기이해축','⑩자기실행스타일',
  '11_고유한결(전체)','11_고유한결tagline'];
order.forEach(k=>{ const s=buckets[k]; console.log(`  ${k.padEnd(20)}: ${String(s.size).padStart(5)}종 (${pct(s)})`); });
console.log('\n── 실행프로그램 ──');
['P_여는길(직업)','P_직무적합성','P_직업확장성','P_분기테마','P_3주루틴','P_다음단계'].forEach(k=>{
  const s=buckets[k]; console.log(`  ${k.padEnd(20)}: ${String(s.size).padStart(5)}종 (${pct(s)})`); });
