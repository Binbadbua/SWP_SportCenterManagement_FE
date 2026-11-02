// Actual React hook lifecycle checks in a local browser, with deferred in-memory loaders only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer } from 'vite';
import { ROOT } from './api-audit.mjs';
const run=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(ROOT,'artifacts/ui-stability-2026-11-02/use-api',run);
const profile=path.join(out,'chrome-profile');
const report={summary:{startedAt:new Date().toISOString(),mode:'Actual React hook; deferred local loaders; no API/business requests.'},checks:[],runtimeErrors:[]};
const htmlRoute='/__qa/use-api/login';
const appRoute='/__qa/use-api-app.js';
const virtual='\0qa-use-api-app.js';
const browserCode=String.raw`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useApi} from '/src/hooks/useApi.js';
const qa=window.qa={requests:[],renders:[],alerts:[],networkAttempts:0};
window.alert=(message)=>qa.alerts.push(message);
window.addEventListener('unhandledrejection',event=>{qa.unhandled??=[];qa.unhandled.push(String(event.reason));});
window.fetch=()=>{qa.networkAttempts++;return Promise.reject(new Error('Network is forbidden by useApi test.'));};
let current,root=createRoot(document.getElementById('root'));
function Harness({owner,skip}){
 const state=useApi(()=>new Promise((resolve,reject)=>qa.requests.push({owner,resolve,reject})),[owner],{skip,sample:()=>({sampleOwner:owner})});
 current=state;
 const snapshot={owner,data:state.data,loading:state.loading,error:state.error?.message??null,usingSample:state.usingSample};
 qa.snapshot=snapshot;qa.renders.push(snapshot);
 return React.createElement('pre',{},JSON.stringify(snapshot));
}
qa.render=(owner,skip=false)=>flushSync(()=>root.render(React.createElement(Harness,{owner,skip})));
qa.reload=()=>{void current.reload();};
qa.resolve=(index,value)=>qa.requests[index].resolve(value);
qa.reject=(index,details)=>qa.requests[index].reject(Object.assign(new Error(details.message),details));
qa.unmount=()=>flushSync(()=>root.unmount());
qa.render('A');
`;
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
 if(!await waitFor('!!window.qa?.requests.length',20000))throw new Error('React test harness did not mount');
 check('Initial load is pending with empty data',await evaluate('qa.snapshot.loading&&qa.snapshot.data===null'));
 await evaluate("qa.resolve(0,{privateOwner:'A'})");
 check('Current request supplies data',await waitFor("qa.snapshot.data?.privateOwner==='A'&&!qa.snapshot.loading"));
 await evaluate('qa.reload()');const manual=await newest();
 check('Manual refresh preserves data while loading',await waitFor("qa.snapshot.loading&&qa.snapshot.data?.privateOwner==='A'"));
 await evaluate('qa.reload()');const newer=await newest();
 await evaluate('qa.resolve('+newer+',{privateOwner:"A-new"})');await waitFor("qa.snapshot.data?.privateOwner==='A-new'");
 await evaluate('qa.resolve('+manual+',{privateOwner:"A-old"})');await sleep(100);
 check('An earlier manual response cannot replace the latest one',await evaluate("qa.snapshot.data?.privateOwner==='A-new'"));
 await evaluate('qa.reload()');const staleA=await newest();
 const firstBIndex=await evaluate('qa.renders.length');await evaluate("qa.render('B')");
 await waitFor("qa.requests.at(-1)?.owner==='B'");const requestB=await newest();
 check('Changed dependencies hide previous private data on first render',await evaluate('qa.renders.slice('+firstBIndex+").filter(x=>x.owner==='B').every(x=>x.data===null)"));
 await evaluate('qa.resolve('+requestB+',{privateOwner:"B"})');await waitFor("qa.snapshot.data?.privateOwner==='B'");
 await evaluate('qa.resolve('+staleA+',{privateOwner:"A-late"})');await sleep(100);
 check('Stale dependency response cannot overwrite the new owner',await evaluate("qa.snapshot.data?.privateOwner==='B'"));
 await evaluate('qa.reload()');const staleB=await newest();
 await evaluate("qa.render('B',true)");
 check('Skip clears old data and loading state',await waitFor('qa.snapshot.data===null&&!qa.snapshot.loading'));
 await evaluate('qa.resolve('+staleB+',{privateOwner:"B-after-skip"})');await sleep(100);
 check('A response after skip cannot restore old data',await evaluate('qa.snapshot.data===null&&!qa.snapshot.loading'));
 await evaluate("qa.render('C')");await waitFor("qa.requests.at(-1)?.owner==='C'");const requestC=await newest();
 await evaluate('qa.resolve('+requestC+',{privateOwner:"C"})');
 check('Resuming after skip loads the next owner',await waitFor("qa.snapshot.data?.privateOwner==='C'&&!qa.snapshot.loading"));
 await evaluate('qa.reload()');const offline=await newest();
 await evaluate('qa.reject('+offline+',{message:"Simulated offline",offline:true})');
 check('Explicit offline sample fallback still works',await waitFor("qa.snapshot.usingSample&&qa.snapshot.data?.sampleOwner==='C'"));
 await evaluate("localStorage.setItem('sportcenter.token','token-A');localStorage.setItem('sportcenter.session','session-A');qa.render('D')");
 await waitFor("qa.requests.at(-1)?.owner==='D'");const oldToken=await newest();
 await evaluate("localStorage.setItem('sportcenter.token','token-B');localStorage.setItem('sportcenter.session','session-B')");
 await evaluate('qa.reject('+oldToken+',{message:"Old token unauthorized",status:401})');await sleep(150);
 check('An old-token401 cannot remove or alert for a newly issued session',await evaluate("localStorage.getItem('sportcenter.token')==='token-B'&&localStorage.getItem('sportcenter.session')==='session-B'&&qa.alerts.length===0"));
 check('An ignored old-session logout still releases its loader',await evaluate("!qa.snapshot.loading&&qa.snapshot.error==='Old token unauthorized'"));
 await evaluate("qa.render('E')");await waitFor("qa.requests.at(-1)?.owner==='E'");const currentToken=await newest();
 await evaluate('qa.reject('+currentToken+',{message:"Current token unauthorized",status:401})');await sleep(150);
 check('A current-token401 clears the matching session and alerts once',await evaluate("!localStorage.getItem('sportcenter.token')&&!localStorage.getItem('sportcenter.session')&&qa.alerts.length===1&&!qa.snapshot.loading"));
 await evaluate("qa.alerts=[];qa.originalGetItem=Storage.prototype.getItem;Storage.prototype.getItem=function(){throw new DOMException('Storage blocked','SecurityError')};qa.render('F')");
 await waitFor("qa.requests.at(-1)?.owner==='F'");const blockedStorage=await newest();
 await evaluate('qa.reject('+blockedStorage+',{message:"Offline with blocked storage",offline:true})');
 check('Blocked storage still permits public offline fallback and finishes loading',await waitFor("qa.snapshot.usingSample&&qa.snapshot.data?.sampleOwner==='F'&&!qa.snapshot.loading"));
 check('Blocked storage does not leave an unhandled rejected loader',await evaluate("!qa.unhandled?.length"));
 await evaluate("Storage.prototype.getItem=qa.originalGetItem;qa.render('G')");await waitFor("qa.requests.at(-1)?.owner==='G'");const unmounted=await newest();
 await evaluate("localStorage.setItem('sportcenter.token','qa-only-not-a-real-token');qa.unmount()");
 await evaluate('qa.reject('+unmounted+',{message:"Simulated unauthorized",status:401})');await sleep(150);
 check('Stale 401 after unmount cannot log out or alert the current session',await evaluate("qa.alerts.length===0&&!!localStorage.getItem('sportcenter.token')"));
 check('No accidental API fetch was attempted',await evaluate('qa.networkAttempts===0'));
 check('No uncaught browser runtime error',report.runtimeErrors.length===0,{errors:report.runtimeErrors});
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