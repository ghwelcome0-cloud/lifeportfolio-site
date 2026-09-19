'use strict';
// The legacy users/$uid/email regex is rejected by the current RTDB emulator.
// Test only the exact relevant rule subtrees; do NOT claim full-rule validation
// and do NOT rewrite or deploy the production rules to make the test pass.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'database.rules.json'),'utf8')).rules;
const user=original.users.$uid;
const rules={'.read':false,'.write':false,responses:original.responses,reports:original.reports,b2b_access:original.b2b_access,
  users:{$uid:{'.read':user['.read'],'.write':user['.write'],reports:user.reports,'$other':{'.validate':false}}}};
fs.mkdirSync(path.join(root,'dist/b2b-audit'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/b2b-audit/rtdb.rules.json'),JSON.stringify({rules},null,2)+'\n');
console.log('RTDB test scope: exact responses/reports/b2b_access/users-reports subtrees only; full rules not validated.');
