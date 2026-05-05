// scripts/generate_5tone_samples.js
// 5톤 샘플 리포트 생성기
//   - 각 톤별 대표 답변 시나리오를 KYS 실데이터 구조로 재구성
//   - report-engine v1.3 + report-engine-v4.1 + program-engine v1.1 풀 파이프라인 실행
//   - 결과 JSON + QA + Cover/MV/Program 핵심 발췌 출력
//
// 사용: node scripts/generate_5tone_samples.js

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const questions = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/questions.json'), 'utf8'));
const mapping   = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/mapping.json'), 'utf8'));
const rules     = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/report-rules.json'), 'utf8'));
const programRules = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/program-rules.json'), 'utf8'));

const ReportEngine   = require(path.join(repoRoot, 'assets/js/report-engine.js'));
const ReportEngineV4 = require(path.join(repoRoot, 'assets/js/report-engine-v4.js'));
const ProgramEngine  = require(path.join(repoRoot, 'assets/js/program-engine.js'));

// ─── 5톤 샘플 시나리오 (각 톤의 대표 입력 패턴) ───
const SAMPLES = [
  {
    tone: 'principled_designer',
    name: '이서준',
    profile: { trait: '원칙 중심 · 깊이형 설계자', summary: '자기 철학을 명확히 하고 그 결로 사람과 조직을 이끄는 유형' },
    answers: {
      Q3: 4, Q4: 5, Q5: 4,
      Q6: ['신중한', '계획적인', '분석적인'],
      Q7: '내 가치관이 흔들리는 상황을 만났을 때',
      Q9: 5, Q10: 5, Q11: 4, Q12: 4,
      Q13: ['정의', '진실', '책임'],
      Q14: '옳다고 믿는 일을 지키고 싶을 때',
      Q16: 5, Q17: 4, Q18: 5,
      Q19: ['종교나 가치관의 변화', '직장이나 진로의 큰 변화'],
      Q21: ['명상', '독서나 글쓰기로 자기 정리'],
      Q23: 5, Q24: 4, Q25: 5,
      Q26: ['생각을 글이나 그림으로 표현하기', '혼자 충분히 생각한 뒤에 정리하기'],
      Q28: ['감정보다 논리적으로 말하는 편이다'],
      Q30: 3, Q31: ['깊이 있게 생각하는 사람', '원칙을 지키는 사람'],
      Q33: ['진정성', '책임감'],
      Q35: 4, Q36: 3, Q37: 4, Q38: 4,
      Q39: ['문제를 분석하고 해결책을 찾는 일', '글이나 자료로 정리하는 일'],
      Q41: ['철학, 종교, 영성', '리더십, 공동체, 관계'],
      Q43: 5, Q44: 5, Q45: 4, Q46: 4,
      Q47: ['정돈된 실내(정리된 내 방, 사무 공간)'],
      Q49: ['아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴'],
      Q51: 4, Q52: 3, Q53: 5, Q54: 5,
      Q55: ['내가 의미 있다고 느끼는 일이기 때문에', '내 신념과 맞기 때문에'],
      Q57: ['내가 만든 규칙이 있어서'],
      Q59: 4, Q60: 5, Q61: 4, Q62: 4,
      Q63: ['신념 / 원칙 / 종교적 기준', '의미 / 보람 / 가치'],
      Q65: '내 안의 옳고 그름의 기준',
      Q67: 4, Q68: 4, Q69: 4, Q70: 3,
      Q71: ['멀리 내다보며 흐름을 설계하기'],
      Q73: '내가 옳다고 믿는 일을 끝까지 해냈을 때',
      Q75: ['철학', '교육'],
      Q77: ['문제를 해결하거나 정책을 만드는 활동']
    }
  },
  {
    tone: 'warm_connector',
    name: '김지영',
    profile: { trait: '관계 중심 · 따뜻한 연결자', summary: '사람의 마음을 듣고 신뢰로 잇는 유형' },
    answers: {
      Q3: 5, Q4: 4, Q5: 4,
      Q6: ['따뜻한', '공감하는', '조용한'],
      Q7: '갈등 상황에서 모두가 마음 상하지 않게 풀어야 할 때',
      Q9: 4, Q10: 4, Q11: 5, Q12: 5,
      Q13: ['사랑', '관계', '의미 추구'],
      Q14: '소중한 사람이 어려움을 겪을 때',
      Q16: 5, Q17: 5, Q18: 5,
      Q19: ['친구', '연인', '가족과의 중요한 관계 변화'],
      Q21: ['감정을 글이나 그림으로 표현하기', '신뢰하는 사람과 이야기 나누기'],
      Q23: 4, Q24: 5, Q25: 4,
      Q26: ['신뢰하는 사람과 이야기 나누기'],
      Q28: ['표정으로 다 드러난다는 말을 듣는다'],
      Q30: 4, Q31: ['사람들을 연결해주는 사람', '마음을 잘 듣는 사람'],
      Q33: ['진정성', '따뜻함'],
      Q35: 4, Q36: 4, Q37: 4, Q38: 4,
      Q39: ['사람들과 깊은 대화 나누기', '누군가의 이야기를 듣고 정리해 주기'],
      Q41: ['교육과 학습 방식', '심리와 감정 탐구'],
      Q43: 4, Q44: 4, Q45: 5, Q46: 5,
      Q47: ['익숙한 카페나 사람이 있는 공간'],
      Q49: ['중간중간 사람과 대화하는 시간이 끼어 있는 하루'],
      Q51: 4, Q52: 4, Q53: 4, Q54: 5,
      Q55: ['누군가에게 도움이 되기 때문에', '함께하는 사람들이 좋기 때문에'],
      Q57: ['주변 사람들이 응원해주기 때문에'],
      Q59: 5, Q60: 4, Q61: 5, Q62: 5,
      Q63: ['관계 / 소속감 / 인정', '의미 / 보람 / 가치'],
      Q65: '곁에 있는 사람들의 마음과 신뢰',
      Q67: 4, Q68: 5, Q69: 4, Q70: 3,
      Q71: ['사람과의 관계 안에서 흐름을 만들어 가기'],
      Q73: '누군가의 마음이 풀렸다는 말을 들었을 때',
      Q75: ['교육', '복지'],
      Q77: ['사람들의 삶을 돕고 지원하는 활동']
    }
  },
  {
    tone: 'visionary_creator',
    name: '박하늘',
    profile: { trait: '몰입 중심 · 비저너리 크리에이터', summary: '아이디어를 작품으로 발행하며 비전을 정련하는 유형' },
    answers: {
      Q3: 4, Q4: 5, Q5: 5,
      Q6: ['창의적인', '도전적인', '열정적인'],
      Q7: '새로운 가능성을 발견했을 때',
      Q9: 4, Q10: 5, Q11: 4, Q12: 5,
      Q13: ['창조', '자유', '도전'],
      Q14: '내 안의 아이디어가 꿈틀거릴 때',
      Q16: 4, Q17: 5, Q18: 4,
      Q19: ['새로운 도전이나 큰 결정', '직장이나 진로의 큰 변화'],
      Q21: ['감정을 글이나 그림으로 표현하기', '몸을 움직이는 활동'],
      Q23: 4, Q24: 5, Q25: 4,
      Q26: ['생각을 글이나 그림으로 표현하기'],
      Q28: ['표정으로 다 드러난다는 말을 듣는다'],
      Q30: 5, Q31: ['새로운 시각을 제시하는 사람', '재미있는 아이디어를 내는 사람'],
      Q33: ['진정성', '활기'],
      Q35: 5, Q36: 5, Q37: 4, Q38: 5,
      Q39: ['새로운 것을 만들거나 시도하기', '사람들과 아이디어를 나누거나 토론하기'],
      Q41: ['예술, 창작, 문화 콘텐츠', '인공지능, 기술, 혁신'],
      Q43: 5, Q44: 4, Q45: 4, Q46: 5,
      Q47: ['카페·공유오피스 같은 외부 공간'],
      Q49: ['몰입 시간과 휴식 시간을 명확히 나누는 하루'],
      Q51: 5, Q52: 4, Q53: 4, Q54: 4,
      Q55: ['새롭게 만들어가는 즐거움이 있기 때문에'],
      Q57: ['새로움이 계속 채워지기 때문에'],
      Q59: 4, Q60: 4, Q61: 5, Q62: 5,
      Q63: ['재미 / 흥미 / 몰입감', '성장 가능성 / 배움의 기회'],
      Q65: '내가 만들어가는 작품과 그 안의 흐름',
      Q67: 5, Q68: 4, Q69: 5, Q70: 4,
      Q71: ['새로운 것을 시도하면서 흐름을 만들기'],
      Q73: '내가 만든 결과물이 누군가에게 가닿았을 때',
      Q75: ['예술', '미디어'],
      Q77: ['창작이나 표현 활동']
    }
  },
  {
    tone: 'pragmatic_achiever',
    name: '최성호',
    profile: { trait: '결과 중심 · 실용적 성취가', summary: '약속한 결과를 측정 가능한 성과로 증명하는 유형' },
    answers: {
      Q3: 5, Q4: 5, Q5: 5,
      Q6: ['성취지향적인', '계획적인', '현실적인'],
      Q7: '약속한 일을 끝내야 할 때',
      Q9: 5, Q10: 4, Q11: 5, Q12: 5,
      Q13: ['성취', '책임', '효율'],
      Q14: '맡은 결과를 무리 없이 마무리해야 할 때',
      Q16: 4, Q17: 4, Q18: 4,
      Q19: ['직장이나 진로의 큰 변화'],
      Q21: ['몸을 움직이는 활동', '일에 더 집중해 잊는다'],
      Q23: 4, Q24: 4, Q25: 4,
      Q26: ['짧게 정리해 결론부터 말하기'],
      Q28: ['감정보다 논리적으로 말하는 편이다'],
      Q30: 4, Q31: ['결과를 책임지는 사람', '추진력이 있는 사람'],
      Q33: ['책임감', '추진력'],
      Q35: 5, Q36: 5, Q37: 5, Q38: 5,
      Q39: ['문제를 분석하고 해결책을 찾는 일', '계획을 세우고 실행하기'],
      Q41: ['경제, 금융, 투자', '스포츠, 건강, 자기관리'],
      Q43: 5, Q44: 5, Q45: 4, Q46: 4,
      Q47: ['정돈된 실내(정리된 내 방, 사무 공간)'],
      Q49: ['몰입 시간과 휴식 시간을 명확히 나누는 하루'],
      Q51: 5, Q52: 5, Q53: 5, Q54: 5,
      Q55: ['결과로 인정받기 때문에'],
      Q57: ['성과나 보상이 있었기 때문에'],
      Q59: 4, Q60: 5, Q61: 5, Q62: 5,
      Q63: ['결과 / 성과 / 효율성', '책임 / 도리 / 역할 충실'],
      Q65: '내가 약속한 결과와 시장의 반응',
      Q67: 5, Q68: 4, Q69: 5, Q70: 4,
      Q71: ['구체적인 계획을 세우는 것'],
      Q73: '약속한 KPI를 끝까지 달성했을 때',
      Q75: ['경제', '경영'],
      Q77: ['문제를 해결하거나 정책을 만드는 활동']
    }
  },
  {
    tone: 'reflective_explorer',
    name: '윤정민',
    profile: { trait: '탐색 중심 · 사색형 탐험가', summary: '자기 질문을 다듬고 작은 실험으로 자기 답을 만드는 유형' },
    answers: {
      Q3: 4, Q4: 4, Q5: 3,
      Q6: ['조용한', '신중한', '느긋한'],
      Q7: '내 안의 질문이 또렷해지는 순간을 만났을 때',
      Q9: 4, Q10: 4, Q11: 4, Q12: 4,
      Q13: ['진리 탐구', '자유', '의미 추구'],
      Q14: '내 질문을 충분히 들여다봐야 할 때',
      Q16: 4, Q17: 3, Q18: 4,
      Q19: ['종교나 가치관의 변화'],
      Q21: ['독서나 글쓰기로 자기 정리', '명상'],
      Q23: 5, Q24: 5, Q25: 5,
      Q26: ['혼자 충분히 생각한 뒤에 정리하기', '생각을 글이나 그림으로 표현하기'],
      Q28: ['잘 숨겨서 감정을 모르겠다는 말을 듣는다'],
      Q30: 3, Q31: ['깊이 있게 생각하는 사람', '관찰력이 좋은 사람'],
      Q33: ['진정성', '깊이'],
      Q35: 4, Q36: 3, Q37: 4, Q38: 4,
      Q39: ['책을 읽거나 글을 쓰는 일', '문제를 분석하고 해결책을 찾는 일'],
      Q41: ['심리와 감정 탐구', '철학, 종교, 영성'],
      Q43: 4, Q44: 4, Q45: 4, Q46: 4,
      Q47: ['조용한 자연이나 여백 있는 공간'],
      Q49: ['혼자 충분히 사색하는 시간이 있는 하루'],
      Q51: 4, Q52: 3, Q53: 4, Q54: 4,
      Q55: ['내가 의미 있다고 느끼는 일이기 때문에'],
      Q57: ['내가 만든 규칙이 있어서'],
      Q59: 4, Q60: 4, Q61: 4, Q62: 4,
      Q63: ['성장 가능성 / 배움의 기회', '자유 / 자율성'],
      Q65: '내 안에서 또렷해진 질문과 답',
      Q67: 3, Q68: 4, Q69: 4, Q70: 4,
      Q71: ['관찰하고 사색하며 흐름을 읽기'],
      Q73: '오랜 질문이 작은 답으로 풀렸을 때',
      Q75: ['철학', '인문학'],
      Q77: ['연구하거나 탐색하는 활동']
    }
  }
];

// ─── 출력 디렉터리 준비 ───
const outDir = path.join(repoRoot, 'reports/v4_test/samples_5tone');
fs.mkdirSync(outDir, { recursive: true });

// ─── 각 샘플 처리 ───
const summary = [];

SAMPLES.forEach(function(sample, idx){
  console.log('\n' + '='.repeat(72));
  console.log('[' + (idx+1) + '/5] tone=' + sample.tone + ' / name=' + sample.name);
  console.log('='.repeat(72));

  const profile = {
    name: sample.name,
    email: '',
    recvMethod: 'email',
    submittedAt: Date.now()
  };

  // ── v1.3 raw build
  const rawReport = ReportEngine.build({
    questions, mapping, rules,
    answers: sample.answers,
    profile: profile,
    lang: 'ko'
  });

  // ── v4.1 upgrade
  const upgraded = ReportEngineV4.upgrade(rawReport, {
    questions, mapping, rules,
    answers: sample.answers,
    profile: profile,
    lang: 'ko'
  });

  // ── QA
  const qa = ReportEngineV4.validateReport(upgraded);
  console.log('  QA: ' + qa.passed + '/' + qa.total + ' (score=' + qa.score + ')');

  // ── 핵심 발췌
  const mvSec = upgraded.sections.find(function(s){ return s.id === 'mission_vision'; });
  const mv = mvSec.content;
  console.log('  ── Mission 3-Tier ──');
  console.log('    🎯 ' + mv.headline);
  console.log('       ' + mv.subline);
  console.log('    📓 ' + mv.diaryMission);
  console.log('  ── Vision 3-Tier ──');
  console.log('    🌅 ' + mv.visionHeadline);
  console.log('       ' + mv.visionSubline);
  console.log('    📓 ' + mv.diaryVision);

  const toneRes = upgraded._v4Meta && upgraded._v4Meta.toneResolution;
  console.log('  toneResolution: chosen=' + (toneRes && toneRes.toneKey) + ' / topAxis=' + (toneRes && toneRes.topAxis));

  // ── Custom Execution Program 생성
  let program = null;
  try {
    program = ProgramEngine.build({
      report: upgraded,
      rules: programRules,
      profile: profile,
      lang: 'ko'
    });
  } catch (e) {
    console.log('  ⚠ ProgramEngine.build failed: ' + e.message);
  }

  if (program) {
    console.log('  ── Cover ──');
    if (program.cover) {
      if (program.cover.quote) console.log('    quote: ' + program.cover.quote);
      if (program.cover.arrowLine) console.log('    arrow: ' + program.cover.arrowLine);
    }
    if (program.year1) {
      console.log('  ── Year-1 Vision ──');
      const visions = program.year1.visions || program.year1.vision || [];
      (Array.isArray(visions) ? visions : [visions]).forEach(function(v){ if (v) console.log('    • ' + v); });
      const ms = program.year1.milestones || [];
      console.log('  ── Year-1 Milestones ──');
      ms.forEach(function(m){ console.log('    • ' + m); });
    }
    if (program.closing) {
      console.log('  ── Closing ──');
      const cl = Array.isArray(program.closing) ? program.closing : [program.closing];
      cl.forEach(function(c){ if (c) console.log('    • ' + c); });
    }
  }

  // ── 저장
  const slug = sample.tone;
  fs.writeFileSync(path.join(outDir, slug + '_v13_raw.json'), JSON.stringify(rawReport, null, 2));
  fs.writeFileSync(path.join(outDir, slug + '_v41_upgraded.json'), JSON.stringify(upgraded, null, 2));
  fs.writeFileSync(path.join(outDir, slug + '_v41_qa.json'), JSON.stringify(qa, null, 2));
  if (program) {
    fs.writeFileSync(path.join(outDir, slug + '_program.json'), JSON.stringify(program, null, 2));
  }

  summary.push({
    tone: sample.tone,
    name: sample.name,
    qa_passed: qa.passed,
    qa_total: qa.total,
    qa_score: qa.score,
    mission_headline: mv.headline,
    mission_subline: mv.subline,
    vision_headline: mv.visionHeadline,
    vision_subline: mv.visionSubline,
    chosen_tone: toneRes && toneRes.toneKey,
    program_built: !!program
  });
});

// ─── 종합 요약 ───
console.log('\n' + '='.repeat(72));
console.log('[전체 5톤 샘플 요약]');
console.log('='.repeat(72));
summary.forEach(function(s){
  console.log('  ' + s.tone + ' (' + s.name + '): QA=' + s.qa_passed + '/' + s.qa_total + ' / chosen=' + s.chosen_tone + ' / program=' + (s.program_built ? '✅' : '❌'));
});

// ── 잔존 어색어 검증
console.log('\n[잔존 어색어 검증]');
let leakCount = 0;
SAMPLES.forEach(function(sample){
  const slug = sample.tone;
  const json = fs.readFileSync(path.join(outDir, slug + '_v41_upgraded.json'), 'utf8');
  const teukhi = (json.match(/특히\s+특히/g) || []).length;
  const haneunga = (json.match(/하는가를/g) || []).length;
  if (teukhi > 0 || haneunga > 0) {
    console.log('  ❌ ' + slug + ': 특히특히=' + teukhi + ' / 하는가를=' + haneunga);
    leakCount++;
  } else {
    console.log('  ✅ ' + slug + ': clean (특히특히=0, 하는가를=0)');
  }
});
console.log('\n전체 누출: ' + leakCount + '/' + SAMPLES.length);

fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 2));
console.log('\n결과 저장: reports/v4_test/samples_5tone/');
console.log('  - <tone>_v13_raw.json / _v41_upgraded.json / _v41_qa.json / _program.json');
console.log('  - _summary.json');
