// Q90-RETENTION — deterministic source patches applied to the frozen b03e219 blobs.
//
// Every patch is an exact-string replacement with a uniqueness contract: the
// anchor must appear exactly once in the source or the build fails closed.
// No regex, no line numbers, no partial matches. The legacy bundle applies no
// patches at all (byte-identical to the frozen SHA).
//
// This module is data only; it never touches the shared files under
// assets/js or data/. It is consumed by build-bundles.mjs and bundle_manifest_gate.mjs.

export const FROZEN_SOURCE_COMMIT = "b03e21901e0c1449a14ce092d0c4676d7ccf5401";

export const ENGINE_FILES = [
  "report-engine.js",
  "report-engine-v4.js",
  "program-engine.js",
  "career-engine.js",
];

export const DATA_FILES = [
  "questions.json",
  "mapping.json",
  "report-rules.json",
  "career-rules.json",
  "program-rules.json",
];

// Two real entry points exist at b03e219 for the SAME engine bytes. They are
// recorded separately because they produce different section bytes
// (career_education, summary_close) for identical answers.
export const ENTRYPOINTS = {
  "initial-generation": {
    sourcePage: "report-loading.html",
    engines: ["report-engine.js", "report-engine-v4.js"],
    data: ["questions.json", "mapping.json", "report-rules.json"],
    careerEngineLoaded: false,
    careerRulesInjected: false,
    programStage: null,
  },
  "regeneration": {
    sourcePage: "report.html",
    engines: ["report-engine.js", "report-engine-v4.js", "career-engine.js"],
    data: ["questions.json", "mapping.json", "report-rules.json", "career-rules.json"],
    careerEngineLoaded: true,
    careerRulesInjected: true,
    programStage: null,
  },
  "program-generation": {
    sourcePage: "program-loading.html",
    engines: ["program-engine.js", "career-engine.js"],
    data: ["program-rules.json", "career-rules.json", "mapping.json"],
    careerEngineLoaded: true,
    careerRulesInjected: true,
    programStage: "from-saved-report",
  },
};

// engineVersion strings must stay <= 20 chars (database.rules.json contract on
// the legacy node; kept for parity even though new instances live elsewhere).
export const MAX_ENGINE_VERSION_LENGTH = 20;

export const BUNDLES = {
  "legacy-b03e219": {
    description: "Byte-identical copy of the b03e219 engines and data. No patches.",
    reportEngineVersion: "v4.1",
    patches: {},
  },
  "q90-input-and-wording-v2": {
    description:
      "b03e219 + (1) otherId free-text fields excluded from axis/section scoring, " +
      "unregistered mapping ids fail closed; (2) KO/EN self_understanding.deep tier " +
      "sentence restated as an observation about responses, not a claim about ability.",
    reportEngineVersion: "v4.1-q90-w2",
    patches: {
      "report-engine.js": [
        {
          id: "RE-01-otherid-index",
          before:
            "    var qReverse = {};\n" +
            "    (questions.sections || []).forEach(function(sec){\n" +
            "      (sec.questions || []).forEach(function(q){\n" +
            "        qTypes[q.id] = q.type;\n" +
            "        qReverse[q.id] = !!q.reverse;\n" +
            "      });\n" +
            "    });\n",
          after:
            "    var qReverse = {};\n" +
            "    // Q90: free-text 'other' inputs are never scored. They are declared\n" +
            "    //      on the parent question (hasOther/otherId), not as questions.\n" +
            "    var qOther = Object.create(null);\n" +
            "    (questions.sections || []).forEach(function(sec){\n" +
            "      (sec.questions || []).forEach(function(q){\n" +
            "        qTypes[q.id] = q.type;\n" +
            "        qReverse[q.id] = !!q.reverse;\n" +
            "        if (q.hasOther && q.otherId) qOther[q.otherId] = q.id;\n" +
            "      });\n" +
            "    });\n",
        },
        {
          id: "RE-02-type-resolution",
          before: '      var type = qTypes[qid] || "likert";\n',
          after:
            "      // Q90: explicit exclusion + fail-closed on unknown ids. The b03e219\n" +
            "      //      behaviour (unknown id -> likert) let numeric/blank free text\n" +
            "      //      leak into axisPct/sectionPct.\n" +
            "      if (Object.prototype.hasOwnProperty.call(qOther, qid)) {\n" +
            "        perQ[qid] = { raw: null, type: \"other_text\", axes: axes, sections: secs, weight: weight, parent: qOther[qid] };\n" +
            "        return;\n" +
            "      }\n" +
            "      var type = Object.prototype.hasOwnProperty.call(qTypes, qid) ? qTypes[qid] : undefined;\n" +
            "      if (type !== \"likert\" && type !== \"multi_choice\" && type !== \"single_choice\") {\n" +
            "        throw new Error(\"ReportEngine.computeScores: unregistered or unsupported question type for \" + qid + \" (\" + type + \")\");\n" +
            "      }\n",
        },
      ],
      "report-engine-v4.js": [
        {
          id: "V4-01-ko-self-understanding-deep",
          before:
            '      deep:     "자신을 깊이 이해합니다. 다른 사람의 성찰까지 도울 수 있습니다.",\n',
          after:
            '      deep:     "자기이해를 위해 돌아보려는 응답이 높게 나타났습니다. 실제 이해 수준이나 다른 사람을 도울 능력을 확인한 것은 아닙니다.",\n',
        },
        {
          id: "V4-02-en-self-understanding-deep",
          before:
            "      deep:     \"Your self-understanding is deeply matured — you are at a stage where you can help others' self-reflection.\",\n",
          after:
            '      deep:     "Your responses show a strong intention to reflect on yourself. They do not establish your actual level of self-understanding or your ability to guide others.",\n',
        },
        {
          id: "V4-03-top-level-engine-version",
          before: '    report.engineVersion = "v4.1";\n',
          after: '    report.engineVersion = "v4.1-q90-w2";\n',
        },
        {
          id: "V4-04-meta-engine-version",
          before:
            '    report._v4Meta = { fingerprint: fp, fingerprint64: fp64, generatedAt: new Date().toISOString(), engineVersion: "v4.1" };\n',
          after:
            '    report._v4Meta = { fingerprint: fp, fingerprint64: fp64, generatedAt: new Date().toISOString(), engineVersion: "v4.1-q90-w2" };\n',
        },
        {
          id: "V4-05-module-version",
          before: '    version: "v4.1"\n  };\n});\n',
          after: '    version: "v4.1-q90-w2"\n  };\n});\n',
        },
      ],
    },
  },
};

export function applyPatches(source, patches, label) {
  let out = source;
  for (const p of patches) {
    const parts = out.split(p.before);
    if (parts.length !== 2) {
      throw new Error(
        `${label}: patch ${p.id} anchor matched ${parts.length - 1} times (must be exactly 1)`,
      );
    }
    out = parts[0] + p.after + parts[1];
  }
  return out;
}
