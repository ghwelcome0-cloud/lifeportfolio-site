'use strict';
// The emulator now loads the complete source rules, without test substitutions.
// Keep this exact-copy check: scoped-only rules are insufficient for deployment.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'database.rules.json'),'utf8');
JSON.parse(source);
fs.mkdirSync(path.join(root,'dist/b2b-audit'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/b2b-audit/rtdb.rules.json'),source);
console.log('RTDB test scope: full source rules, byte-identical copy (no substitutions).');
