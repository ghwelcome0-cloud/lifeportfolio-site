#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ReportEngine = require(path.join(ROOT, 'assets/js/report-engine.js'));
const ReportEngineV4 = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));
const ProgramEngine = require(path.join(ROOT, 'assets/js/program-engine.js'));
const { buildSyntheticAssessment } = require(path.join(ROOT, 'scripts/fixtures/synthetic_assessment.js'));

const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const questions = read('data/questions.json');
const mapping = read('data/mapping.json');
const reportRules = read('data/report-rules.json');
const programRules = read('data/program-rules.json');
const VOLATILE_KEYS = new Set(['generatedAt', 'publishedAt', 'submittedAt']);

// 재현 계약: 해시값은 "어떤 입력 파일을 대상으로 계산했는지"와 함께 기록되어야 한다.
// 지문 없이 해시만 공표하면 제3자가 다른 저장소 상태에서 다른 값을 얻고도
// 그 원인을 특정할 수 없다(실측 사례 있음). 따라서 입력 지문을 산출에 병기한다.
const INPUT_FILES = [
  'assets/js/report-engine.js',
  'assets/js/report-engine-v4.js',
  'assets/js/program-engine.js',
  // career-engine.js 는 program-engine 이 호출하고 report-engine-v4 가 3곳에서 참조하므로
  // 산출에 실제로 참여한다(실측). 지문에서 빠지면 이 파일만 바뀐 경우를 설명할 수 없다.
  'assets/js/career-engine.js',
  'data/questions.json',
  'data/mapping.json',
  'data/report-rules.json',
  'data/program-rules.json',
  'scripts/fixtures/synthetic_assessment.js'
];

function inputFingerprint() {
  const perFile = {};
  const parts = [];
  for (const relative of INPUT_FILES) {
    const digest = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, relative)))
      .digest('hex');
    perFile[relative] = digest.slice(0, 16);
    parts.push(`${relative}:${digest}`);
  }
  return {
    combined: crypto.createHash('sha256').update(parts.join('\n')).digest('hex'),
    files: perFile
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (!VOLATILE_KEYS.has(key)) out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function buildOnce() {
  const fixture = buildSyntheticAssessment(questions);
  const ans = fixture.answers;
  const profile = {
    name: fixture.name,
    email: fixture.email,
    recvMethod: fixture.recvMethod,
    submittedAt: fixture.submittedAt
  };
  const v13 = ReportEngine.build({ questions, mapping, rules: reportRules, answers: ans, profile, lang: 'ko' });
  const v41 = ReportEngineV4.upgrade(v13, { questions, mapping, rules: reportRules, answers: ans, profile, lang: 'ko' });
  const program = ProgramEngine.build({ report: v41, rules: programRules, name: profile.name, lang: 'ko' });
  return { report: v41, program };
}

function mutateOneCharacter(value) {
  const clone = JSON.parse(JSON.stringify(value));
  function visit(node) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        if (typeof node[i] === 'string' && node[i].length) {
          node[i] = `${node[i].slice(0, -1)}${node[i].endsWith('가') ? '나' : '가'}`;
          return true;
        }
        if (node[i] && typeof node[i] === 'object' && visit(node[i])) return true;
      }
    } else if (node && typeof node === 'object') {
      for (const key of Object.keys(node).sort()) {
        if (VOLATILE_KEYS.has(key)) continue;
        if (typeof node[key] === 'string' && node[key].length) {
          node[key] = `${node[key].slice(0, -1)}${node[key].endsWith('가') ? '나' : '가'}`;
          return true;
        }
        if (node[key] && typeof node[key] === 'object' && visit(node[key])) return true;
      }
    }
    return false;
  }
  if (!visit(clone)) throw new Error('No mutable output string found');
  return clone;
}

function main() {
  try {
    const first = buildOnce();
    let second = buildOnce();
    if (process.argv.includes('--inject-output-mutation')) {
      second = { ...second, report: mutateOneCharacter(second.report) };
    }
    const hashes = {
      report: [sha256(first.report), sha256(second.report)],
      program: [sha256(first.program), sha256(second.program)]
    };
    const stable = hashes.report[0] === hashes.report[1] && hashes.program[0] === hashes.program[1];

    let negativeControl = { status: 'skipped' };
    if (!process.argv.includes('--skip-negative-control')) {
      const child = spawnSync(process.execPath, [__filename, '--inject-output-mutation', '--skip-negative-control'], {
        encoding: 'utf8'
      });
      negativeControl = {
        status: child.status === 1 ? 'pass' : 'fail',
        mutation: 'one output character changed',
        observedExitCode: child.status
      };
    }

    if (!stable || negativeControl.status !== 'pass') {
      console.error(JSON.stringify({ gate: 'determinism_hash', status: 'fail', hashes, negativeControl }));
      process.exit(1);
    }
    console.log(JSON.stringify({
      gate: 'determinism_hash',
      status: 'pass',
      excludedKeys: [...VOLATILE_KEYS],
      inputFingerprint: inputFingerprint(),
      hashes,
      negativeControl
    }));
  } catch (error) {
    console.error(JSON.stringify({ gate: 'determinism_hash', status: 'fail', error: error.stack || error.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { canonicalize, sha256, buildOnce, mutateOneCharacter };
