// DEF-002 (2026-10-08): payment-success.html must never self-record paid; server record → survey, none → verification notice.
// Synthetic Firebase module stubs, no network, no real account. Usage: node scripts/test-payment-success-def002.cjs
const puppeteer=require('puppeteer'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'payment-success.html'),'utf8');
(async()=>{const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});let ok=0,fail=0;
for(const scenario of ['server-paid','no-record']){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.on('console',m=>{if(/Payment|DEF-002|PR#184|pending|TypeError|ReferenceError/i.test(m.text()))console.log('  >',m.text().slice(0,140))});p.on('pageerror',e=>console.log('  !!',String(e).slice(0,140)));await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(r.isNavigationRequest()&&r.frame()===p.mainFrame())console.log('  NAV',u.slice(0,120));
  if(u.includes('firebasejs/')&&u.endsWith('firebase-app.js'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export function initializeApp(){return {}}'});
  if(u.includes('firebase-auth.js'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export function getAuth(){return {currentUser:null}} export function onAuthStateChanged(a,cb){setTimeout(()=>cb({uid:'u1',email:'t@example.invalid',getIdToken:async()=>'tok'}),200)} export function signOut(){}`});
  if(u.includes('firebase-database.js'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`const paid=${scenario==='server-paid'}; export function getDatabase(){return {}} export function ref(d,p){return {p}} export async function get(r){return {exists:()=>paid,val:()=>paid?{paid:true}:null}} export async function set(r,v){window.__CLIENT_SET=(window.__CLIENT_SET||0)+1} export async function update(){window.__CLIENT_SET=(window.__CLIENT_SET||0)+1} export function onValue(){} export function serverTimestamp(){return 0}`});
  if(u.includes('firebase-functions.js'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export function getFunctions(){return {}} export function httpsCallable(){return async()=>({data:{}})}'});
  if(u.includes('firebase-app-check.js'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export function initializeAppCheck(){} export class ReCaptchaEnterpriseProvider{constructor(){}}'});
  if(/^https?:\/\/local\.test\/suvey/.test(u))return r.respond({contentType:'text/html',body:'<html><body>SUVEY</body></html>'});
  if(u.startsWith('http://local.test/'))return r.respond({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'/* stub */'});
  if(u.startsWith('https://')||u.startsWith('http://'))return r.abort();
  r.continue();});
 await p.goto('http://local.test/payment-success',{waitUntil:'domcontentloaded'}).catch(()=>{});
 await p.setContent(html.replace(/src="assets\//g,'src="http://local.test/assets/'),{waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,20000));
 let st;try{st=await p.evaluate(()=>{let lp=null,un=null;try{lp=sessionStorage.getItem('lp_paid');un=localStorage.getItem('lp_paid_until')}catch(_){lp='n/a';un='n/a'}return {url:location.href,clientSet:window.__CLIENT_SET||0,lp_paid:lp,until:un,warn:!!document.querySelector('.status-msg.warn')&&getComputedStyle(document.querySelector('#errorMsg')).display!=='none',startDisabled:document.getElementById('startBtn')?.disabled}});}catch(e){st={url:p.url(),navigated:true,clientSet:0,warn:false};}
 const exp=scenario==='server-paid'?(st.clientSet===0&&!st.warn&&/suvey/.test(st.url)):(st.clientSet===0&&st.warn&&!st.lp_paid&&!st.until&&st.startDisabled===true&&!/suvey/.test(st.url));
 console.log((exp?'PASS ':'FAIL ')+scenario,JSON.stringify(st));exp?ok++:fail++;await ctx.close();}
await b.close();console.log('SUMMARY',ok,'/',ok+fail);process.exit(fail?1:0);})();
