#!/bin/bash
# v3.2 총괄 독립 검증. 사용: verify32.sh <tgz>  (bundle32/ 에 추출)
set -u
TGZ=${1:?tgz}
OUT=/home/user/work/bundle32; rm -rf $OUT; mkdir -p $OUT
tar -xzf "$TGZ" -C $OUT || { echo "FAIL untar"; exit 1; }
B=$(find $OUT -maxdepth 2 -name SHA256SUMS -printf '%h\n' | head -1)
H=$(find $OUT -maxdepth 2 -name run-in-netns.sh -printf '%h\n' | head -1)
echo "bundle=$B harness=$H"
echo "== 1. SHA256SUMS"; (cd $B && sha256sum -c SHA256SUMS --quiet && echo SUMS_OK) || echo SUMS_FAIL
echo "== 2. 요청서 SHA"; sha256sum $B/REQUEST*.md
echo "== 3. exec-plan canonical hash"
node -e '
const fs=require("fs"),c=require("crypto");const o=JSON.parse(fs.readFileSync(process.argv[1]));
const canon=v=>Array.isArray(v)?"["+v.map(canon).join(",")+"]":(v&&typeof v==="object")?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}":JSON.stringify(v);
console.log("plan_canon",c.createHash("sha256").update(canon(o)).digest("hex"));
console.log("plan_raw  ",c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
console.log("gen_count",o.generation_count_so_far,"round1_cap",o.credit_cap&&o.credit_cap.round1_tl_cap,"order",o.order.length);
' $B/exec-plan.json
echo "== 4. harness_code vs 실제 파일 SHA"
node -e '
const fs=require("fs"),c=require("crypto");const o=JSON.parse(fs.readFileSync(process.argv[1]));const H=process.argv[2];let bad=0,n=0;
for(const [f,s] of Object.entries(o.harness_code)){n++;const p=H+"/"+f;if(!fs.existsSync(p)){console.log("MISSING",f);bad++;continue;}
const h=c.createHash("sha256").update(fs.readFileSync(p)).digest("hex");if(h!==s){console.log("MISMATCH",f,h.slice(0,12),s.slice(0,12));bad++;}}
console.log("harness files",n,"bad",bad);' $B/exec-plan.json $H
echo "== 5. v3.1 대비 결박 집합 차이(하네스 SHA 외 불변이어야 함)"
node -e '
const fs=require("fs");const a=JSON.parse(fs.readFileSync("/home/user/work/bundle31/q90-bundle/exec-plan.json"));const b=JSON.parse(fs.readFileSync(process.argv[1]));
const flat=(o,p="",r={})=>{for(const[k,v]of Object.entries(o)){const q=p?p+"."+k:k;if(v&&typeof v==="object"&&!Array.isArray(v))flat(v,q,r);else r[q]=JSON.stringify(v);}return r;};
const A=flat(a),Bf=flat(b);const keys=new Set([...Object.keys(A),...Object.keys(Bf)]);const diff=[];
for(const k of keys){if(A[k]!==Bf[k])diff.push([k,(A[k]||"∅").slice(0,40),(Bf[k]||"∅").slice(0,40)]);}
console.log("diff count",diff.length);for(const d of diff)console.log(" ",d.join(" | "));
const allowed=/^(harness_code\.|credit_cap|disclosures|work\.|schema$|environment\.|holdout\.|dependencies)/;
const sus=diff.filter(d=>!allowed.test(d[0]));console.log("bindings-level diffs(검토 필요):",sus.length);for(const d of sus)console.log(" !!",d[0]);
' $B/exec-plan.json
echo "== 6. argv 결함 수정 확인(28행 패턴)"
grep -n 'const \[,,ud' $H/run-in-netns.sh && echo "STILL_DEFECT" || echo "argv_fixed"
grep -c 'node -e' $H/run-in-netns.sh
echo "== 7. 공개 문구 확인"
for k in "시도 1" "무효" "0600" "리허설" "1층"; do printf "%s: " "$k"; grep -c "$k" $B/REQUEST*.md; done
echo "== 8. 실제 경로 반례 / 시험표"
ls $B | grep -i -E "rehears|real|table|TEST|시험|리허설" || true
grep -l -i "fixture\|합성\|실제 경로" $B/*.md 2>/dev/null
echo "== 9. 리허설 격리(Peer 5725128) — 경로 목록·사전 확인 boolean·폴더 SHA"
grep -n -i -E "rehears|리허설" $B/*.md $B/*.json 2>/dev/null | grep -i -E "sha|path|경로|MANIFEST|lock|잠금|deleted|삭제|read-only|읽기" | head -20
echo "== 10. selftest 분기 부록"
grep -n -i -E "selftest|Q90_SELFTEST" $B/REQUEST*.md | head -10
