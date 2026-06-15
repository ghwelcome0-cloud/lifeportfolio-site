/* 고유성 다양성 시뮬레이션 — 무작위 응답 N명에 대한 출력 고유 패턴 수 측정 */
global.__VSAMP = [];   // 사명/비전 2단 구조 샘플 수집용
const fs = require("fs");
const path = require("path");

const V4 = require(path.join(__dirname, "../assets/js/report-engine-v4.js"));
const I = V4._internals;

// 실제 선택지 (questions.json 기반)
const Q6  = ["조용한","열정적인","계획적인","창의적인","신중한","따뜻한","현실적인","도전적인","공감적인","성취지향적인","자유로운","호기심많은"];
const Q13 = ["정직","정의","사랑","신뢰","창의","책임","성장","자유","행복","건강","지혜","평화","효율","열정","겸손","용기","성실","감사","배려","도전"];
const Q39 = ["새로운 정보를 탐색하거나 정리하기","사람들과 아이디어를 나누거나 토론하기","감정을 표현하거나 공감하는 활동","계획을 세우고 실행하는 일","문제를 분석하고 해결책을 찾는 일","디자인, 창작, 콘텐츠 제작 등 창의 작업","몸을 움직이는 활동, 스포츠, 체험 등","봉사, 돌봄, 의미 있는 영향력 행사","혼자 몰입해 탐구하기"];
const Q55 = ["내가 의미 있다고 느끼는 일이기 때문에","누군가에게 도움이 되기 때문에","경쟁이나 목표 달성이 자극이 되기 때문에","내가 좋아하거나 재미를 느껴서","새로운 것을 배우고 성장할 수 있어서","결과에 대한 보상이나 성취감 때문","주변의 기대나 인정을 받고 싶어서","루틴이 무너지지 않게 유지하기 위해"];
const Q63 = ["의미 / 보람 / 가치","안정성 / 안전 / 예측 가능성","성장 가능성 / 배움의 기회","자유 / 자율성","관계 / 소속감 / 인정","결과 / 성과 / 효율성","재미 / 흥미 / 몰입감","신념 / 원칙 / 종교적 기준","책임 / 도리 / 역할 충실"];
const Q73 = ["내가 정한 목표를 달성했을 때","다른 사람의 인정이나 칭찬을 받을 때","문제를 해결하고 결과가 나왔을 때","배움이나 성장감을 느낄 때","내가 의미 있다고 여긴 일을 마쳤을 때","누군가에게 좋은 영향을 미쳤을 때","비교를 통해 나의 성장을 확인할 때","실패했지만 끝까지 해낸 자신을 봤을 때"];
const Q75 = ["정치","경제","사회","문화","교육","예술","체육","기술","의료","복지","환경","미디어","스포츠","법률","종교","과학","금융","외교","농업","관광"];

function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rndN(arr,n){ const c=arr.slice(); const out=[]; for(let i=0;i<n&&c.length;i++){ const k=Math.floor(Math.random()*c.length); out.push(c.splice(k,1)[0]); } return out; }

function makeAnswers(){
  return {
    Q3: rndN(Q39,2),     // 강점(활동성)
    Q6: rndN(Q6,2),
    Q13: rndN(Q13,2),
    Q39: [rnd(Q39)],
    Q41: [rnd(["사회 문제나 정의 이슈","인공지능, 기술, 혁신","사람의 마음과 관계","예술과 창작","교육과 성장"])],
    Q55: rndN(Q55,2),
    Q63: [rnd(Q63)],
    Q73: rnd(Q73),
    Q75: rndN(Q75,2)
  };
}

// axisPct 무작위 (4축 0~100)
function makeAxisPct(){
  return {
    self_understanding: Math.floor(Math.random()*100),
    self_expression:    Math.floor(Math.random()*100),
    self_design:        Math.floor(Math.random()*100),
    self_execution:     Math.floor(Math.random()*100)
  };
}

const N = parseInt(process.argv[2]||"2000",10);
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname,"../data/mapping.json"),"utf8"));

const setMission = new Set();      // 사명 헤드라인 단독(압축 → 의도적으로 소수형)
const setVision  = new Set();      // 비전 헤드라인 단독(압축)
const setMissionFull = new Set();  // 사명 헤드+디테일 종합(= 고객 체감 고유성)
const setVisionFull  = new Set();  // 비전 헤드+디테일 종합
const setToneLabel = new Set();
const setExpandLine = new Set();   // 확장방향 첫줄(pathLine)
const setSubDir = new Set();       // 확장방향 톤문장
const setFingerprint = new Set();

for(let i=0;i<N;i++){
  const ans = makeAnswers();
  const axisPct = makeAxisPct();
  const fp = I.fullAnswerFingerprint(ans, mapping);
  setFingerprint.add(fp);

  // 사명/비전
  try {
    const mv = I.synthMissionVisionFromResponses(ans, fp, "ko", axisPct);
    if(mv){
      setMission.add(mv.missionCore||mv.mission||"");
      setVision.add(mv.visionCore||mv.vision||"");
      setMissionFull.add((mv.missionCore||"")+"|"+(mv.missionDetail||""));
      setVisionFull.add((mv.visionCore||"")+"|"+(mv.visionDetail||""));
      if(global.__VSAMP&&__VSAMP.length<10) __VSAMP.push({h:mv.visionCore||mv.vision||"", d:mv.visionDetail||"", mh:mv.missionCore||"", md:mv.missionDetail||""});
    }
  } catch(e){ if(i===0) console.log("MV err:", e.message); }

  // tone + 고유한 결 라벨
  let tone="warm_connector";
  try {
    tone = I.resolveTone({axisPct}, ans.Q13, ans) || tone;
  } catch(e){ if(i===0) console.log("tone err:", e.message); }

  // 확장 방향
  try {
    const de = I.buildDomainExpansion(ans, fp, "ko", mapping, tone);
    if(de){ setExpandLine.add(de.pathLine); (de.subDirections||[]).forEach(d=>setSubDir.add(d)); }
  } catch(e){ if(i===0) console.log("expand err:", e.message); }
}

function pct(s){ return (s.size/N*100).toFixed(1)+"%"; }
console.log(`\n===== 다양성 시뮬레이션 (무작위 응답 ${N}명) =====`);
console.log(`fingerprint 고유:   ${setFingerprint.size} / ${N}  (${pct(setFingerprint)})`);
console.log(`사명 헤드라인 단독(압축): ${setMission.size} / ${N}  (${pct(setMission)})  ← 직관적 소수형(의도)`);
console.log(`비전 헤드라인 단독(압축): ${setVision.size} / ${N}  (${pct(setVision)})  ← 직관적 소수형(의도)`);
console.log(`사명 헤드+디테일 종합:    ${setMissionFull.size} / ${N}  (${pct(setMissionFull)})  ← 고객 체감 고유성`);
console.log(`비전 헤드+디테일 종합:    ${setVisionFull.size} / ${N}  (${pct(setVisionFull)})  ← 고객 체감 고유성`);
console.log(`확장방향 첫줄 고유: ${setExpandLine.size}  (서로 다른 문장 종류 수)`);
console.log(`확장방향 톤문장 고유: ${setSubDir.size}  (서로 다른 문장 종류 수)`);
console.log(`\n[샘플 사명 5개]`);
[...setMission].slice(0,5).forEach((m,i)=>console.log(`  ${i+1}. ${String(m).slice(0,90)}`));
console.log(`\n[샘플 사명/비전 2단 구조 8개]`);
(global.__VSAMP||[]).slice(0,8).forEach((s,i)=>{
  console.log(`  ${i+1}) 사명H: ${s.mh}`);
  console.log(`     사명D: ${s.md}`);
  console.log(`     비전H: ${s.h}`);
  console.log(`     비전D: ${s.d}`);
});
console.log(`\n[확장방향 첫줄 전체 종류]`);
[...setExpandLine].slice(0,12).forEach((m,i)=>console.log(`  ${i+1}. ${m}`));
