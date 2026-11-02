// Actual AuthProvider in two tabs of one browser context; fake JWTs, no external API.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'vite';
import {ROOT} from './api-audit.mjs';
const run=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(ROOT,'artifacts/ui-stability-2026-11-02/auth-session',run);
const profile=path.join(out,'chrome-profile');
const report={summary:{startedAt:new Date().toISOString(),mode:'Actual React AuthProvider; two real same-origin tabs sharing localStorage; fake JWTs and in-memory login only.'},checks:[],runtimeErrors:[]};
const htmlRoute='/__qa/auth-session/login';
const appRoute='/__qa/auth-session-app.js';
const virtual='qa-auth-session-virtual.js';
const browserCode="\nimport React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {AuthProvider,useAuth} from '/src/context/AuthContext.jsx';\nimport {api} from '/src/api/endpoints.js';\nconst qa=window.qa={ready:false,networkAttempts:0,profileReads:0,loginCalls:0};\nwindow.fetch=()=>{qa.networkAttempts++;return Promise.reject(new Error('Network forbidden in auth regression.'));};\nconst fields={id:'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',name:'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',role:'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'};\nconst fixtures={\n a:{accountId:'00000000-0000-4000-8000-000000000001',username:'user-a',fullName:'User A',role:'Member',memberId:'00000000-0000-4000-8000-000000000011'},\n b:{accountId:'00000000-0000-4000-8000-000000000002',username:'user-b',fullName:'User B',role:'Coach',coachId:'00000000-0000-4000-8000-000000000012'}\n};\nconst tokenFor=(fixture,version='one')=>btoa(JSON.stringify({alg:'none',typ:'JWT'})).replaceAll('=','')+'.'+btoa(JSON.stringify({[fields.id]:fixture.accountId,[fields.name]:fixture.username,[fields.role]:fixture.role,FullName:fixture.fullName,version})).replaceAll('=','')+'.qa-only';\napi.auth.login=async({email})=>{qa.loginCalls++;const fixture=fixtures[email==='a2'?'a':email];if(!fixture)throw new Error('Unexpected mock login');return{access_token:tokenFor(fixture,email==='a2'?'two':'one'),userId:fixture.accountId,...(fixture.memberId?{memberId:fixture.memberId}:{coachId:fixture.coachId})};};\napi.members.myId=async()=>{qa.profileReads++;throw new Error('Unexpected member profile read');};\napi.coaches.me=async()=>{qa.profileReads++;throw new Error('Unexpected coach profile read');};\nlet current,captured;\nfunction Probe(){\n const auth=useAuth();current=auth;\n qa.snapshot={accountId:auth.user?.accountId??null,role:auth.user?.role??null,fullName:auth.user?.fullName??null,profile:auth.profile.status};\n return React.createElement('pre',{},JSON.stringify(qa.snapshot));\n}\nqa.signIn=name=>current.signIn(name,'qa-only-password');\nqa.signOut=()=>current.signOut();\nqa.capture=()=>{captured=current.updateUser;};\nqa.applyCaptured=()=>captured?.({fullName:'STALE PATCH'});\nqa.writeMismatch=()=>{localStorage.setItem('sportcenter.session',JSON.stringify({...fixtures.a,access_token:tokenFor(fixtures.a)}));localStorage.setItem('sportcenter.token',tokenFor(fixtures.b));};\nqa.writeSessionOnly=()=>{localStorage.removeItem('sportcenter.token');localStorage.setItem('sportcenter.session',JSON.stringify({...fixtures.a,access_token:tokenFor(fixtures.a)}));};\nqa.stored=()=>{const raw=localStorage.getItem('sportcenter.session');const user=raw?JSON.parse(raw):null;return{accountId:user?.accountId??null,fullName:user?.fullName??null,hasSession:!!raw,hasToken:!!localStorage.getItem('sportcenter.token'),consistent:!!user&&user.access_token===localStorage.getItem('sportcenter.token')};};\ncreateRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(Probe)));\nqa.ready=true;\n";
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

 await page.send('Page.navigate',{url:base+htmlRoute});
 if(!await waitFor('!!window.qa?.ready&&!!qa.snapshot',20000))throw new Error('First auth tab failed to mount');
 const {targetId:peerId}=await browser.send('Target.createTarget',{url:base+htmlRoute,browserContextId});
 const peerTargets=await(await fetch('http://127.0.0.1:'+active[0]+'/json/list')).json();
 const peer=await CDP.connect(peerTargets.find(t=>t.id===peerId).webSocketDebuggerUrl);
 peer.on('Runtime.exceptionThrown',({exceptionDetails:e})=>report.runtimeErrors.push(e.exception?.description??e.text));
 await peer.send('Runtime.enable');
 const onPeer=async expression=>{const r=await peer.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;};
 const waitPeer=async expression=>{const stop=Date.now()+5000;while(Date.now()<stop){try{if(await onPeer(expression))return true;}catch{}await sleep(40);}return false;};
 if(!await waitPeer('!!window.qa?.ready&&!!qa.snapshot'))throw new Error('Second same-origin tab failed to mount');
 check('Two actual tabs start as guests in the isolated shared context',await evaluate('qa.snapshot.accountId===null')&&await onPeer('qa.snapshot.accountId===null'));
 await evaluate("qa.signIn('a')");
 check('Signing in tab A synchronizes the member identity to tab B',await waitPeer("qa.snapshot.accountId==='00000000-0000-4000-8000-000000000001'&&qa.snapshot.role==='Member'"));
 check('Shared stored session matches its token',await onPeer('qa.stored().consistent'));
 await evaluate('qa.capture()');await onPeer('qa.capture()');
 await evaluate("qa.signIn('b')");
 check('Switching account and role in tab A replaces tab B identity',await waitPeer("qa.snapshot.accountId==='00000000-0000-4000-8000-000000000002'&&qa.snapshot.role==='Coach'"));
 await evaluate('qa.applyCaptured()');await onPeer('qa.applyCaptured()');await sleep(80);
 check('Captured updates from account A cannot patch account B',await evaluate("qa.snapshot.fullName==='User B'&&qa.stored().fullName==='User B'")&&await onPeer("qa.snapshot.fullName==='User B'"));
 await evaluate('qa.capture()');await onPeer('qa.capture()');await evaluate('qa.signOut()');
 check('Signout in tab A makes tab B a guest',await waitPeer('qa.snapshot.accountId===null'));
 await evaluate('qa.applyCaptured()');await onPeer('qa.applyCaptured()');await sleep(80);
 check('Captured profile callbacks cannot resurrect a signed-out session',await onPeer('qa.snapshot.accountId===null&&!qa.stored().hasSession&&!qa.stored().hasToken'));
 await evaluate('qa.writeMismatch()');
 check('Mismatched session access_token and current token are rejected',await waitPeer('qa.snapshot.accountId===null')&&await onPeer('!qa.stored().consistent'));
 await evaluate("qa.signIn('a')");
 if(!await waitPeer("qa.snapshot.accountId==='00000000-0000-4000-8000-000000000001'"))throw new Error('Consistent session did not recover');
 await onPeer('qa.capture()');await evaluate("qa.signIn('a2')");
 if(!await waitPeer('qa.stored().consistent'))throw new Error('Renewed same-account session did not settle');
 await sleep(80);await onPeer('qa.applyCaptured()');await sleep(80);
 check('An old same-account token callback cannot overwrite a renewed session',await onPeer("qa.snapshot.fullName==='User A'&&qa.stored().fullName==='User A'"));
 await evaluate('localStorage.clear()');
 check('localStorage.clear propagates guest state to the peer tab',await waitPeer('qa.snapshot.accountId===null&&!qa.stored().hasSession&&!qa.stored().hasToken'));
 await evaluate('qa.writeSessionOnly()');
 check('A saved user without a token remains a guest',await waitPeer('qa.snapshot.accountId===null')&&await onPeer('!qa.stored().hasToken'));
 check('Preset profile IDs avoid all profile and external API requests',await evaluate('qa.profileReads===0&&qa.networkAttempts===0')&&await onPeer('qa.profileReads===0&&qa.networkAttempts===0'));
 check('No uncaught browser errors occurred across both tabs',report.runtimeErrors.length===0,{errors:report.runtimeErrors});
 peer.close();
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