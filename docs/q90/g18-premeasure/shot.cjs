const pptr=require('/home/user/webapp/node_modules/puppeteer-core');
const EXE='/home/user/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell';
(async()=>{const b=await pptr.launch({executablePath:EXE,headless:'shell',args:['--no-sandbox','--font-render-hinting=none']});const pg=await b.newPage();
await pg.setViewport({width:1600,height:1000,deviceScaleFactor:2});await pg.goto('file://'+process.cwd()+'/out/G17_premeasure.html',{waitUntil:'networkidle0'});
await pg.screenshot({path:'out/G17_premeasure.png',fullPage:true});const h=await pg.evaluate(()=>document.body.scrollHeight);console.log('height',h);await b.close();})();
