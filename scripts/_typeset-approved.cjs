'use strict';
// typeset-v1 (owner-approved 2026-10-12: 「모든 글과 문장이 어절 단위, 의미 단위, 시각적 안정감이 실현되도록」).
// Exact additions to report.html / program.html. strip() removes them (each must appear exactly once), so every other
// byte stays pinned by the existing boundary tests. rendered() maps a typeset page body back to the untypeset form so
// "this page must not change" checks still compare everything except the approved typesetting.
const assert=require('node:assert/strict');
const T=require('../assets/js/typeset.js');
const ADD=[
 '  <script src="assets/js/typeset.js?v=typeset-v1"></script>\n',
 "// typeset-v1 (2026-10-12): 어절 · 의미 단위 · 시각 안정 — 지면을 다 만든 뒤, 크기 맞춤(pfFit) 전에 한 번. 저장된 글은 바꾸지 않는다.\n'try{if(window.LPTypeset)window.LPTypeset.apply(document.getElementById(\"book\"));}catch(e){}',\n",
 "          (window.LPTypeset&&window.LPTypeset.SRC?'<script>'+window.LPTypeset.SRC+'<\\/script>':'')+\n",
 ["+(window.LPTypeset?window.LPTypeset.CSS_BOOK:'')+'</style></head><body>'+","+'</style></head><body>'+"]
];
function strip(file,src){
 for(const a of ADD){const [now,old]=Array.isArray(a)?a:[a,''];assert.equal(src.split(now).length,2,'typeset-v1 addition once in '+file+': '+now.slice(0,50));src=src.replace(now,old);}
 return src;}
// innerHTML after typeset → before typeset: drop the two line-shape classes, undo no-break glue, and run the same
// fixText over the baseline text so approved text repairs (마침표 띄어쓰기 · 겹친 어절 · 따옴표 · 가운뎃점) compare equal.
function rendered(html){return html.replace(/ class="ts-(?:short|long)"/g,'').replace(/ ts-(?:short|long)(?=")/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/\u2060/g,'');}
function baseline(html){return rendered(html.replace(/>([^<]+)</g,(m,t)=>'>'+T.fixText(t.replace(/&nbsp;/g,'\u00a0'))+'<'));}
module.exports={strip,rendered,baseline,ADD};
