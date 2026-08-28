#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const esprima = require('esprima');

const ROOT = path.resolve(__dirname, '..', '..');
// 검사 대상 엔진 전량.
// 최초 3종만 검사했으나 실측 결과 assets/js/career-engine.js 가 누락되어 있었다
// (ls assets/js/*engine*.js → 4건). 산출 문장 일부가 이 파일의 DOMAIN_ATTR_KO 로
// 조합 생성되므로, 3종만 검사하고 "난수 0회"를 주장하는 것은 거짓 초록불(결함 BT)이다.
// 새 엔진 파일이 추가될 때 이 목록도 함께 갱신해야 한다.
const ENGINE_FILES = [
  'assets/js/report-engine.js',
  'assets/js/report-engine-v4.js',
  'assets/js/program-engine.js',
  'assets/js/career-engine.js'
];

function executableTokens(source, file) {
  try {
    return esprima.tokenize(source, {
      comment: true,
      range: true,
      tolerant: false,
      jsx: false
    }).filter((token) => token.type !== 'LineComment' && token.type !== 'BlockComment');
  } catch (error) {
    throw new Error(`JavaScript parse failed for ${file}: ${error.message}`);
  }
}

// 검사 대상 난수 API. Math.random 만으로는 불충분하므로 Web Crypto 계열도 포함한다.
// member 만으로 판정하는 항목(getRandomValues / randomUUID)은 수신자(crypto·window.crypto·
// self.crypto 등)가 무엇이든 결정론을 깨뜨리므로 수신자 이름을 요구하지 않는다.
const RANDOM_MEMBERS = new Set(['random', 'getRandomValues', 'randomUUID', 'randomBytes', 'randomInt', 'randomFillSync']);
const OBJECT_SCOPED = { random: 'Math' }; // random 은 Math.random 만 난수. obj.random 은 오탐 위험이 있어 수신자를 요구.

function findRandomApiCalls(source, file) {
  const tokens = executableTokens(source, file);
  const findings = [];
  for (let i = 1; i <= tokens.length - 3; i += 1) {
    const [dot, member, open] = tokens.slice(i, i + 3);
    if (!(dot.type === 'Punctuator' && dot.value === '.')) continue;
    if (!(member.type === 'Identifier' && RANDOM_MEMBERS.has(member.value))) continue;
    if (!(open.type === 'Punctuator' && open.value === '(')) continue;

    const receiver = tokens[i - 1];
    const requiredReceiver = OBJECT_SCOPED[member.value];
    if (requiredReceiver) {
      if (!(receiver && receiver.type === 'Identifier' && receiver.value === requiredReceiver)) continue;
    }
    const before = tokens[i - 2];
    if (before && before.type === 'Keyword' && ['function', 'class'].includes(before.value)) continue;

    findings.push({
      file,
      api: `${receiver && receiver.type === 'Identifier' ? receiver.value : '?'}.${member.value}`,
      offset: member.range[0]
    });
  }
  return findings;
}

function scanFiles(root, files = ENGINE_FILES) {
  return files.flatMap((relative) => {
    const absolute = path.join(root, relative);
    return findRandomApiCalls(fs.readFileSync(absolute, 'utf8'), relative);
  });
}

function runNegativeControl() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-random-gate-'));
  try {
    for (const relative of ENGINE_FILES) {
      const destination = path.join(temp, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, relative), destination);
    }
    const mutant = path.join(temp, ENGINE_FILES[0]);
    fs.appendFileSync(mutant, '\n;Math.random(); // LP_NEGATIVE_CONTROL\n');
    const child = spawnSync(process.execPath, [__filename, '--engine-root', temp, '--skip-negative-control'], {
      encoding: 'utf8'
    });
    if (child.status !== 1) throw new Error(`Negative control expected exit 1, got ${child.status}`);
    return { status: 'pass', injected: 'Math.random()', observedExitCode: child.status };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  try {
    const rootIndex = process.argv.indexOf('--engine-root');
    const scanRoot = rootIndex >= 0 ? path.resolve(process.argv[rootIndex + 1]) : ROOT;
    const skipNegative = process.argv.includes('--skip-negative-control');
    const findings = scanFiles(scanRoot);
    const negativeControl = skipNegative ? { status: 'skipped' } : runNegativeControl();
    if (findings.length) {
      console.error(JSON.stringify({ gate: 'determinism_random', status: 'fail', findings, negativeControl }));
      process.exit(1);
    }
    console.log(JSON.stringify({
      gate: 'determinism_random',
      status: 'pass',
      checkedFiles: ENGINE_FILES,
      executableRandomCalls: 0,
      negativeControl
    }));
  } catch (error) {
    console.error(JSON.stringify({ gate: 'determinism_random', status: 'fail', error: error.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { executableTokens, findRandomApiCalls, scanFiles, runNegativeControl };
