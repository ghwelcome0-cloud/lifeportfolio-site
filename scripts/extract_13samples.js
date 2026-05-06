#!/usr/bin/env node
/**
 * extract_13samples.js
 *
 * 13대 영역 샘플(report v4.1 + program)을 매뉴얼 PDF 렌더링용
 * samples_extract.json 형식으로 추출.
 *
 * 출력 키 구조 (영역당):
 *   { domain, name, toneKey, toneLabel, fp,
 *     summary{header,submittedAt,typeLine,coreOneLine},
 *     mv{mission,vision,footer},
 *     ep{type,style,drivers,environment,activities,tools},
 *     gm{strengthsLabel,growthLabel,strengths,growth},
 *     ce{careers,education,directions,domainExpansion},
 *     app{job,learning,tasks,firstActionsLabel,firstActions},
 *     program{cover,quarter,weeks,modules,effects,newPaths,nextSteps,risks,closing} }
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIR  = path.join(ROOT, "reports/manual_v1");

// 13대 영역 (인덱스 순서 = 매뉴얼 게재 순서)
const DOMAINS = [
  "정치","경제","교육","예술","기술","복지","종교",
  "스포츠","미디어","법률","환경","농업","의료"
];

const idx = JSON.parse(fs.readFileSync(path.join(DIR, "samples_index.json"), "utf8"));
const idxMap = Object.fromEntries(idx.map(x => [x.domain, x]));

const out = [];

DOMAINS.forEach((dom) => {
  const reportPath = path.join(DIR, `sample_${dom}_report.json`);
  const programPath = path.join(DIR, `sample_${dom}_program.json`);
  if (!fs.existsSync(reportPath) || !fs.existsSync(programPath)) {
    console.warn(`! 파일 없음: ${dom}`);
    return;
  }
  const r = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const p = JSON.parse(fs.readFileSync(programPath, "utf8"));
  const meta = idxMap[dom] || {};

  // sections는 v4 리포트의 12단 섹션 (list 구조 → id로 룩업)
  const sectionsList = Array.isArray(r.sections) ? r.sections : [];
  const sectionMap = {};
  sectionsList.forEach(s => { if (s && s.id) sectionMap[s.id] = s.content || {}; });
  const sec = (id) => sectionMap[id] || {};

  // summary
  const sm = sec("summary");
  const summary = {
    header: sm.header || "",
    submittedAt: meta.submittedAt || "",
    typeLine: sm.typeLine || sm.type || "",
    coreOneLine: sm.coreOneLine || sm.core || ""
  };

  // mission_vision
  const mvSec = sec("mission_vision");
  const mv = {
    mission: mvSec.mission || "",
    vision:  mvSec.vision  || "",
    footer:  mvSec.footer  || ""
  };

  // execution_profile
  const epSec = sec("execution_profile");
  const ep = {
    type:        epSec.type        || "",
    style:       epSec.style       || "",
    drivers:     epSec.drivers     || [],
    environment: epSec.environment || [],
    activities:  epSec.activities  || [],
    tools:       epSec.tools       || []
  };

  // growth_map
  const gmSec = sec("growth_map");
  const gm = {
    strengthsLabel: gmSec.strengthsLabel || "강점",
    growthLabel:    gmSec.growthLabel    || "성장 과제",
    strengths: gmSec.strengths || [],
    growth:    gmSec.growth    || []
  };

  // career_education
  const ceSec = sec("career_education");
  const ce = {
    careers:        ceSec.careers        || [],
    education:      ceSec.education      || [],
    directions:     ceSec.directions     || [],
    domainExpansion: ceSec.domainExpansion || ""
  };

  // application
  const appSec = sec("application");
  const app = {
    job:               appSec.job               || "",
    learning:          appSec.learning          || "",
    tasks:             appSec.tasks             || [],
    firstActionsLabel: appSec.firstActionsLabel || "첫 행동",
    firstActions:      appSec.firstActions      || []
  };

  // program (실행프로그램)
  const program = {
    cover:     p.cover     || {},
    quarter:   p.quarter   || {},
    weeks:     p.weeks     || [],
    modules:   p.modules   || [],
    effects:   p.effects   || {},
    newPaths:  p.newPaths  || [],
    nextSteps: p.nextSteps || [],
    risks:     p.risks     || [],
    closing:   p.closing   || ""
  };

  out.push({
    domain: dom,
    name: meta.name || "",
    toneKey: meta.toneKey || "",
    toneLabel: meta.toneLabel || "",
    fp: meta.fingerprint,
    summary, mv, ep, gm, ce, app, program
  });
});

const outPath = path.join(DIR, "samples_extract.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`✓ ${out.length}개 영역 추출 완료 → ${outPath}`);
console.log("  영역:", out.map(o => o.domain).join(" · "));
