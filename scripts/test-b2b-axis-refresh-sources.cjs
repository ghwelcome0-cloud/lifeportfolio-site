'use strict';
// B2B-F01: the server copy of the four-axis reader and questions must be byte-identical
// to the public assets, so existing-group refresh and new reports use the same rules.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),h=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
for(const [pub,server] of [['assets/js/response-evidence.js','functions/shared/response-evidence.js'],['data/questions.json','functions/shared/questions.json']]){
  assert.equal(h(server),h(pub),server+' must equal '+pub+' (copy it again after any reader/question change)');
}
// The server module must load without browser globals.
const R=require(path.join(root,'functions/shared/response-evidence.js'));assert.equal(typeof R.attachAxes,'function');
console.log('PASS B2B-F01 server reader/questions are byte-identical to public assets');
