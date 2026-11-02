// Actual checkout React components with local API mocks; writes and fetch are blocked.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'vite';
import {ROOT} from './api-audit.mjs';
const run=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(ROOT,'artifacts/ui-stability-2026-11-02/checkout',run);
const profile=path.join(out,'chrome-profile');
const report={summary:{startedAt:new Date().toISOString(),mode:'Actual checkout and class-detail components with in-memory fixtures; no external API or financial writes.'},checks:[],runtimeErrors:[]};
const htmlRoute='/__qa/checkout/login';
const appRoute='/__qa/checkout-app.js';
const virtual='\0qa-checkout-app.js';
const browserCode="\nimport React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {MemoryRouter,Routes,Route} from 'react-router-dom';\nimport {AuthProvider} from '/src/context/AuthContext.jsx';\nimport {ToastProvider} from '/src/components/Toast.jsx';\nimport {api} from '/src/api/endpoints.js';\nimport {todayCenterDateString,addDaysToDateInput} from '/src/lib/format.js';\nimport Checkout from '/src/pages/store/Checkout.jsx';\nimport ClassCheckout from '/src/pages/store/ClassCheckout.jsx';\nimport UpgradeCheckout from '/src/pages/store/UpgradeCheckout.jsx';\nimport ClassDetail from '/src/pages/store/ClassDetail.jsx';\nimport '/src/styles/base.css';\nimport '/src/styles/components.css';\nimport '/src/styles/store.css';\nconst scenario=new URLSearchParams(location.search).get('scenario')||'class-delay';\nconst qa=window.qa={scenario,writes:[],networkAttempts:0,rosterReads:0,cardsPending:false,bookingsPending:false,optionsFailure:scenario==='options-error',cardsFailure:scenario==='upgrade-error',releasedCards:false,releasedBookings:false};\nwindow.fetch=()=>{qa.networkAttempts++;return Promise.reject(new Error('External API fetch is forbidden in checkout regression.'));};\nconst ids={account:'00000000-0000-4000-8000-000000000001',member:'00000000-0000-4000-8000-000000000002',coach:'00000000-0000-4000-8000-000000000003',class:'00000000-0000-4000-8000-000000000004',category:'00000000-0000-4000-8000-000000000005',package:'00000000-0000-4000-8000-000000000006',target:'00000000-0000-4000-8000-000000000007',card:'00000000-0000-4000-8000-000000000008'};\nconst user={accountId:ids.account,memberId:ids.member,coachId:ids.coach,role:scenario==='held-seats'?'Coach':'Member',username:'qa-local-only',fullName:'H?c vi?n m? ph?ng',email:'qa@example.invalid'};\nlocalStorage.setItem('sportcenter.session',JSON.stringify(user));localStorage.setItem('sportcenter.token','qa-not-a-real-token');\nconst day=t=>addDaysToDateInput(todayCenterDateString(),t)+'T00:00:00Z';\nconst packages=[{id:ids.package,membershipPackageId:ids.package,packageName:'G?i m? ph?ng 30 ng?y',durationDays:30,price:10000,discountPercent:10,status:1},{id:ids.target,membershipPackageId:ids.target,packageName:'G?i m? ph?ng 90 ng?y',durationDays:90,price:25000,discountPercent:20,status:1}];\nconst card={id:ids.card,memberId:ids.member,memberName:user.fullName,packageId:ids.package,packageName:packages[0].packageName,status:1,startDate:day(0),endDate:day(29)};\nconst cls={id:ids.class,className:'Yoga m? ph?ng - kh?ng t?o tr?n DB',categoryId:ids.category,categoryName:'Yoga',coachId:ids.coach,coachName:'Coach m? ph?ng',maxCapacity:12,currentEnrolled:scenario==='held-seats'?1:0,price:10000,status:1,startDate:day(3),endDate:day(12)};\nconst sessions=[{id:'00000000-0000-4000-8000-000000000009',classId:ids.class,className:cls.className,roomId:'00000000-0000-4000-8000-000000000010',roomName:'Ph?ng m? ph?ng',coachId:ids.coach,date:day(3),startTime:'18:00:00',endTime:'19:00:00'}];\nconst problem=(message,status)=>Object.assign(new Error(message),{status});\napi.payments.options=async()=>{if(scenario==='legacy-options')throw problem('Route absent',404);if(qa.optionsFailure)throw problem('QA: không tải được phương thức thanh toán',503);return{provider:'SePay',methods:[2],holdMinutes:15,upgrade:true};};\napi.packages.list=async()=>packages;\napi.memberships.mine=async()=>{\n if(qa.cardsFailure)throw problem('QA: không tải được thẻ thành viên',500);\n if(scenario==='class-delay'&&!qa.releasedCards){qa.cardsPending=true;return new Promise(resolve=>{qa.releaseCards=()=>{qa.releasedCards=true;qa.cardsPending=false;resolve([card]);};});}\n return[card];\n};\napi.members.me.get=async()=>({id:ids.member,memberId:ids.member,fullName:user.fullName,email:user.email,phone:'0900000000'});\napi.bookings.mine=async()=>{\n if(scenario==='class-delay'&&!qa.releasedBookings){qa.bookingsPending=true;return new Promise(resolve=>{qa.releaseBookings=()=>{qa.releasedBookings=true;qa.bookingsPending=false;resolve([]);};});}\n return[];\n};\napi.invoices.mine=async()=>[{id:'00000000-0000-4000-8000-000000000011',memberMembershipId:ids.card,status:2,amount:10000,receptionistId:'qa-reception'}];\napi.classes.get=async()=>cls;\napi.classes.list=async()=>[cls];\napi.classes.members=async()=>{qa.rosterReads++;return[];};\napi.schedules.byClass=async()=>sessions;\napi.categories.list=async()=>[{id:ids.category,categoryName:'Yoga'}];\napi.coaches.get=async()=>({id:ids.coach,fullName:'Coach m? ph?ng',specialization:'Yoga',experienceYears:2});\nfor(const method of ['checkout','classCheckout','upgradeCheckout','cancel','confirm','refundConfirm'])api.payments[method]=async()=>{qa.writes.push(method);throw new Error('Business writes blocked by checkout test.');};\napi.bookings.create=async()=>{qa.writes.push('booking.create');throw new Error('Blocked');};\nconst route=scenario==='class-delay'?'/classes/'+ids.class+'/checkout':scenario==='upgrade-error'?'/memberships/upgrade':scenario==='held-seats'?'/classes/'+ids.class:'/memberships/'+ids.package+'/checkout';\nconst routes=React.createElement(Routes,null,\n React.createElement(Route,{path:'/memberships/:id/checkout',element:React.createElement(Checkout)}),\n React.createElement(Route,{path:'/classes/:id/checkout',element:React.createElement(ClassCheckout)}),\n React.createElement(Route,{path:'/memberships/upgrade',element:React.createElement(UpgradeCheckout)}),\n React.createElement(Route,{path:'/classes/:id',element:React.createElement(ClassDetail)})\n);\ncreateRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,routes))));\nqa.ready=true;\n";
const check=(name,passed,detail={})=>{report.checks.push({name,passed:!!passed,...detail});console.log((passed?'PASS ':'FAIL ')+name);};
class CDP{
 constructor(ws){this.ws=ws;this.next=0;this.pending=new Map();this.handlers=new Map();ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result??{});}else for(const f of this.handlers.get(m.method)??[])f(m.params??{});});}
 static async connect(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('CDP connect timeout')),10000);ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(t);reject(new Error('CDP connect error'));},{once:true});});return new CDP(ws);}
 on(name,fn){const list=this.handlers.get(name)??[];list.push(fn);this.handlers.set(name,list);}
 send(method,params={},timeout=15000){return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout '+method));},timeout);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
 close(){this.ws.close();}
}
let server,browser,page;
const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;};
async function waitFor(expression,timeout=5000){const stop=Date.now()+timeout;while(Date.now()<stop){if(await evaluate(expression))return true;await sleep(40);}return false;}
async function newest(){return evaluate('qa.requests.length-1');}
const psQuote=s=>"'"+String(s).replaceAll("'","''")+"'";
try{
 await fs.mkdir(profile,{recursive:true});
 server=await createServer({plugins:[{name:'use-api-regression-only',enforce:'pre',resolveId(id){if(id===appRoute)return virtual;},load(id){if(id===virtual)return browserCode;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!==htmlRoute)return next();try{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(htmlRoute,'<html><body><div id="root"></div><script type="module" src="'+appRoute+'"></script></body></html>'));}catch(error){next(error);}});}}],server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
 await server.listen();
 const address=server.httpServer.address();const base='http://127.0.0.1:'+address.port;
 report.summary.baseUrl=base;
 const chrome=process.env.QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const args=['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir="'+profile+'"','about:blank'];
 const command='$p = Start-Process -FilePath '+psQuote(chrome)+' -ArgumentList @('+args.map(psQuote).join(',')+') -WindowStyle Hidden -PassThru; $p.Id';
 await new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code?reject(new Error(err)):resolve());});
 let active;for(let n=0;n<80&&!active;n++){try{active=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);}catch{await sleep(100);}}
 if(!active?.[0])throw new Error('Chrome DevTools port missing');
 browser=await CDP.connect('ws://127.0.0.1:'+active[0]+active[1]);
 const {browserContextId}=await browser.send('Target.createBrowserContext');
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId});
 const targets=await(await fetch('http://127.0.0.1:'+active[0]+'/json/list')).json();
 page=await CDP.connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
 page.on('Runtime.exceptionThrown',({exceptionDetails:e})=>report.runtimeErrors.push(e.exception?.description??e.text));
 await page.send('Page.enable');await page.send('Runtime.enable');

 const visit=async scenario=>{
  await page.send('Page.navigate',{url:base+htmlRoute+'?scenario='+scenario});
  if(!await waitFor('!!window.qa?.ready',20000))throw new Error('Checkout fixture failed to mount: '+scenario);
 };
 const noWrites=async name=>check(name,await evaluate('qa.writes.length===0&&qa.networkAttempts===0'));
 await visit('class-delay');
 if(!await waitFor('qa.cardsPending&&qa.bookingsPending'))throw new Error('Deferred checkout loads did not start');
 check('Class checkout cannot submit while cards and bookings are unknown',await evaluate("[...document.querySelectorAll('button[type=submit]')].every(b=>b.disabled)"));
 await evaluate('qa.releaseCards()');await sleep(100);
 check('Class checkout still waits for duplicate-booking data after cards load',await evaluate("[...document.querySelectorAll('button[type=submit]')].every(b=>b.disabled)"));
 await evaluate('qa.releaseBookings()');
 check('Resolved class checkout exposes the authoritative discounted total',await waitFor("[...document.querySelectorAll('button[type=submit]')].some(b=>!b.disabled&&b.textContent.includes('9.000'))"));
 await noWrites('Delayed checkout never creates a financial record');
 await visit('options-error');
 check('Payment-options 503 shows a retryable failure',await waitFor("document.body.textContent.includes('QA: không tải được phương thức thanh toán')&&[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Thử lại')"));
 check('Payment outage does not pretend to use the old desk-transfer flow',await evaluate("!document.body.textContent.includes('30 phút')&&!document.body.textContent.includes('lễ tân đối soát')&&[...document.querySelectorAll('button[type=submit]')].every(b=>b.disabled)"));
 await evaluate("qa.optionsFailure=false;[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Thử lại').click()");
 check('Payment options recover through the visible retry action',await waitFor("document.body.textContent.includes('SePay')&&[...document.querySelectorAll('button[type=submit]')].some(b=>!b.disabled)"));
 await noWrites('Payment-options retry never creates a financial record');
 await visit('upgrade-error');
 check('Upgrade card failure is shown as an error rather than an empty account',await waitFor("document.body.textContent.includes('QA: không tải được thẻ thành viên')&&!document.body.textContent.includes('Bạn chưa có thẻ đang dùng')"));
 await evaluate("qa.cardsFailure=false;[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Thử lại').click()");
 check('Upgrade form recovers after cards load on retry',await waitFor("!!document.querySelector('#upgrade-form')&&[...document.querySelectorAll('button[type=submit]')].some(b=>!b.disabled)"));
 await noWrites('Upgrade retry never creates a financial record');
 await visit('legacy-options');
 check('A genuinely missing options route retains the legacy fallback',await waitFor("document.body.textContent.includes('30 phút')&&document.body.textContent.includes('lễ tân đối soát')&&[...document.querySelectorAll('button[type=submit]')].some(b=>!b.disabled)"));
 await noWrites('Legacy capability check creates no financial record');
 await visit('held-seats');
 if(!await waitFor('qa.rosterReads>0&&!!document.querySelector(".spots__row")'))throw new Error('Staff class fixture did not load');
 check('Staff uses held-seat count even when confirmed roster is empty',await waitFor("document.querySelector('.spots__row')?.textContent.includes('Đã đặt 1/12')"));
 await noWrites('Held-seat display check creates no booking');
 // Read the actual resource configurations; no module may call an external API here.
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Network forbidden during resource-default check');};
 try{
  const {resources}=await server.ssrLoadModule('/src/pages/staff/resources.jsx');
  const dateDefaults=Object.entries(resources).flatMap(([name,config])=>(config.fields??[]).filter(field=>field.type==='date'&&typeof field.defaultValue==='function').map(field=>({name,field})));
  check('Date default regression exercises the configured date fields',dateDefaults.length>=4,{count:dateDefaults.length});
  for(const {name,field} of dateDefaults){let value,error;try{value=field.defaultValue({role:'Coach',accountId:'qa'});}catch(e){error=String(e);}check('Staff date default is valid: '+name+'.'+field.name,typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),{value,error});}
 }finally{globalThis.fetch=oldFetch;}
 check('No uncaught browser runtime errors during checkout scenarios',report.runtimeErrors.length===0,{errors:report.runtimeErrors});
 report.summary.status='completed';
}catch(error){report.summary.status='interrupted';check('Regression harness completes',false,{error:String(error.stack??error)});}
finally{
 if(page)page.close();if(browser){try{await browser.send('Browser.close',{},3000);}catch{}browser.close();}
 if(server)await server.close();
 const resolved=path.resolve(profile),owner=path.resolve(out)+path.sep;
 if(resolved.startsWith(owner)&&path.basename(resolved)==='chrome-profile')for(let n=0;n<8;n++){try{await fs.rm(resolved,{recursive:true,force:true});break;}catch{await sleep(150);}}
 Object.assign(report.summary,{finishedAt:new Date().toISOString(),checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,failed:report.checks.filter(x=>!x.passed).length});
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('REPORT '+path.join(out,'report.json'));console.log('SUMMARY '+JSON.stringify(report.summary));
 if(report.summary.status!=='completed'||report.summary.failed)process.exitCode=1;
}