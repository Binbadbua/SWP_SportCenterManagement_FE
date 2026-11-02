// Actual chat widget browser checks. ALL API responses are simulated; no real inference/business writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {ROOT} from './api-audit.mjs';
const BASE=(process.env.QA_UI_BASE || 'http://127.0.0.1:5182').replace(/\/$/,'');
const CHROME=process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN=new Date().toISOString().replace(/[:.]/g,'-');
const OUT=path.join(ROOT,'artifacts/web-review-2026-11-02/chat-ui',RUN);
const SHOTS=path.join(OUT,'screenshots'),PROFILE=path.join(SHOTS,'chrome-profile'),REPORT=path.join(OUT,'report.json');
const report={summary:{startedAt:new Date().toISOString(),baseUrl:BASE,mode:'Actual widget + fully simulated APIs',status:'running'},checks:[],routes:[],requests:[],chatCalls:[],optionsCalls:0,runtimeExceptions:[],consoleErrors:[],blockedWrites:[],screenshots:[],expectedMockDrops:[]};
const clean=value=>{if(Array.isArray(value))return value.map(clean);if(typeof value==='string')return value.replace(/Bearer\s+[A-Za-z0-9_.-]+/gi,'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]');if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([k])=>!/^(password|token|access_token|accessToken|authorization|cookie)$/i.test(k)).map(([k,v])=>[k,clean(v)]));};
const check=(name,passed,detail={})=>{const item=clean({id:'chat-'+String(report.checks.length+1).padStart(3,'0'),name,passed:!!passed,...detail});report.checks.push(item);console.log((passed?'PASS ':'FAIL ')+item.id+' '+name);return item;};
const save=async()=>{Object.assign(report.summary,{updatedAt:new Date().toISOString(),checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,failed:report.checks.filter(x=>!x.passed).length,requests:report.requests.length,chatRequests:report.chatCalls.length,runtimeExceptions:report.runtimeExceptions.length,screenshots:report.screenshots.length});await fs.writeFile(REPORT,JSON.stringify(clean(report),null,2));};
const psQuote=text=>"'"+String(text).replaceAll("'","''")+"'";
const relative=file=>path.relative(ROOT,file).replaceAll('\\','/');
const actorOf=name=>({name,role:name==='coach'?'Coach':'Member',accountId:name==='member-two'?'00000000-0000-4000-8000-000000000002':name==='coach'?'00000000-0000-4000-8000-000000000003':'00000000-0000-4000-8000-000000000001',profileId:name==='member-two'?'00000000-0000-4000-8000-000000000012':name==='coach'?'00000000-0000-4000-8000-000000000013':'00000000-0000-4000-8000-000000000011'});
const tokenOf=actor=>{const claims={'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier':actor.accountId,'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':actor.name,'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress':actor.name+'@example.invalid','http://schemas.microsoft.com/ws/2008/06/identity/claims/role':actor.role,FullName:'Demo '+actor.name,exp:Math.floor(Date.now()/1000)+3600};return [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify(claims)).toString('base64url'),Buffer.from('synthetic-ui-signature').toString('base64url')].join('.');};
const success=reply=>({status:200,body:{reply,provider:'Gemini',disclaimer:'Phản hồi mô phỏng để kiểm thử giao diện; không phải câu trả lời Gemini thật.'}});
class CDP {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', ({ data }) => {
      const item = JSON.parse(data);
      if (item.id) {
        const pending = this.pending.get(item.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(item.id);
        if (item.error) pending.reject(new Error(item.error.message)); else pending.resolve(item.result ?? {});
      } else {
        for (const fn of this.handlers.get(item.method) ?? []) Promise.resolve(fn(item.params ?? {})).catch((error) => { process.stderr.write('CDP event: ' + clean(String(error)) + '\n'); });
      }
    });
    ws.addEventListener('close', () => { for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('CDP connection closed')); } this.pending.clear(); });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timed out')), 10000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket error')); }, { once: true });
    });
    return new CDP(ws);
  }
  on(event, fn) { const list = this.handlers.get(event) ?? []; list.push(fn); this.handlers.set(event, list); }
  send(method, params = {}, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}


class Page {
 constructor(cdp,browser,contextId,targetId,role){Object.assign(this,{cdp,browser,contextId,targetId,role,route:'',actor:actorOf('member-one'),queue:[],activeChats:new Set(),maxActive:0,options:{provider:'Gemini',enabled:true,configured:true,configurationIssues:[],providerVerified:false,chatAccess:'Authenticated',exerciseAccess:'Coach'}});}
 async init(){
  this.cdp.on('Log.entryAdded',e=>{if(e.entry.level==='error')report.consoleErrors.push({browserLog:e.entry.text,url:e.entry.url});});
  this.cdp.on('Runtime.exceptionThrown',({exceptionDetails:e})=>report.runtimeExceptions.push(clean({text:e.exception?.description??e.text,url:e.url,line:e.lineNumber})));
  this.cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')report.consoleErrors.push(clean({text:e.args.map(a=>a.value??a.description??'').join(' ')}));});
  this.cdp.on('Page.javascriptDialogOpening',async()=>this.cdp.send('Page.handleJavaScriptDialog',{accept:false}));
  this.cdp.on('Network.requestWillBeSent',e=>{const u=new URL(e.request.url);if(u.pathname.startsWith('/api/'))report.requests.push({method:e.request.method,endpoint:u.pathname+u.search,startedAt:Date.now()});});
  this.cdp.on('Network.loadingFailed',e=>{for(const entry of this.activeChats)if(entry.networkId===e.requestId){entry.cancelled=true;this.activeChats.delete(entry);}});
  this.cdp.on('Fetch.requestPaused',async e=>{
   const u=new URL(e.request.url),method=e.request.method;
   if(!u.pathname.startsWith('/api/')){await this.cdp.send('Fetch.continueRequest',{requestId:e.requestId});return;}
   const fulfill=async(status,body)=>this.cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
   if(u.pathname==='/api/auth/login'&&method==='POST'){let body={};try{body=JSON.parse(e.request.postData??'{}');}catch{}this.actor=actorOf(body.email==='member-two'?'member-two':body.email==='coach'?'coach':'member-one');await fulfill(200,{access_token:tokenOf(this.actor),userId:this.actor.accountId});return;}
   if(u.pathname==='/api/ai/options'&&method==='GET'){report.optionsCalls++;await fulfill(200,this.options);return;}
   if(u.pathname==='/api/ai/chat'&&method==='POST'){
    const entry={id:report.chatCalls.length+1,networkId:e.networkId,request:JSON.parse(e.request.postData??'{}'),startedAt:Date.now(),actor:this.actor.name};
    const mock=this.queue.shift()??success('Phản hồi mặc định mô phỏng.');entry.httpStatus=mock.status??200;report.chatCalls.push(entry);this.activeChats.add(entry);this.maxActive=Math.max(this.maxActive,this.activeChats.size);
    try{if(mock.delay)await sleep(mock.delay);await fulfill(mock.status??200,mock.body??{});}catch(error){entry.fulfillDropped=true;report.expectedMockDrops.push({request:entry.id,message:String(error)});}finally{entry.finishedAt=Date.now();this.activeChats.delete(entry);}return;
   }
   if(!['GET','HEAD','OPTIONS'].includes(method)){report.blockedWrites.push({method,endpoint:u.pathname});await fulfill(409,{message:'Blocked: no business write permitted in chat UI test.'});return;}
   if(u.pathname==='/api/members/me'){await fulfill(200,{id:this.actor.profileId,memberId:this.actor.profileId,fullName:'Demo '+this.actor.name});return;}
   if(u.pathname==='/api/coaches/me'){await fulfill(200,{id:this.actor.profileId,coachId:this.actor.profileId,fullName:'Demo coach'});return;}
   if(u.pathname==='/api/payments/options'){await fulfill(200,{provider:'SePay',methods:[2],holdMinutes:15,upgrade:true});return;}
   if(u.pathname.startsWith('/api/dashboard/')){await fulfill(200,{totalRevenue:0,paidInvoiceCount:0,revenueByMonth:[],data:[]});return;}
   await fulfill(200,[]);
  });
  await this.cdp.send('Page.enable');await this.cdp.send('Runtime.enable');await this.cdp.send('Log.enable');await this.cdp.send('Network.enable');await this.cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await this.cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});await this.viewport(1440,1000);return this;
 }
 async evaluate(expression){const r=await this.cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;}
 async waitFor(expression,timeout=10000){const stop=Date.now()+timeout;while(Date.now()<stop){try{if(await this.evaluate('Boolean('+expression+')'))return true;}catch{}await sleep(100);}return false;}
 async viewport(width,height){await this.cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});}
 async visit(route){this.route=route;report.routes.push(route);await this.cdp.send('Page.navigate',{url:BASE+route});if(!await this.waitFor("document.querySelector('.ai-chat__launcher')",20000)){report.startupFailure=await this.evaluate("({body:document.body.innerText,html:document.querySelector('#root')?.innerHTML?.slice(-12000)})");await this.screenshot('startup-failure');throw new Error('Chat launcher missing on '+route);}}
 async navigate(route){this.route=route;report.routes.push(route);await this.evaluate(`history.pushState({},'',${JSON.stringify(route)});window.dispatchEvent(new PopStateEvent('popstate'));true`);await sleep(150);}
 async type(selector,value){return this.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);}
 async click(selector){return this.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)return false;el.click();return true;})()`);}
 async clickText(text){return this.evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!el||el.disabled)return false;el.click();return true;})()`);}
 async key(key,modifiers=0){const code=key==='Enter'?13:key==='Escape'?27:9;await this.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,modifiers,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await this.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,modifiers});}
 async open(){await this.click('.ai-chat__launcher');if(!await this.waitFor("document.querySelector('#sportcenter-ai-panel')",5000))throw new Error('Chat panel did not open');await sleep(100);}
 async reset(){await this.click('[aria-label="Bắt đầu cuộc trò chuyện mới"]');await sleep(150);}
 async login(name){await this.navigate('/login?next='+encodeURIComponent(name==='coach'?'/staff':'/'));await this.waitFor("document.querySelector('input[name=username]')");await this.type('input[name="username"]',name);await this.type('input[name="password"]','Synthetic@123');await this.evaluate("document.querySelector('.login__form').requestSubmit();true");const account=actorOf(name);if(!await this.waitFor(`(()=>{const u=JSON.parse(localStorage.getItem('sportcenter.session')||'null');return u?.accountId===${JSON.stringify(account.accountId)}&&location.pathname!=='/login';})()`,10000))throw new Error('Synthetic login failed '+name);await this.waitFor("document.querySelector('.ai-chat__launcher')");}
 async submit(question,mock){if(mock)this.queue.push(mock);await this.type('#sportcenter-ai-message',question);await this.click('[aria-label="Gửi câu hỏi"]');}
 async done(text,timeout=10000){return this.waitFor(`document.querySelector('.ai-chat__log')?.textContent.includes(${JSON.stringify(text)})&&!document.querySelector('.ai-chat__pending')`,timeout);}
 async screenshot(name){const r=await this.cdp.send('Page.captureScreenshot',{format:'png'});const file=path.join(SHOTS,name+'.png');await fs.writeFile(file,Buffer.from(r.data,'base64'));report.screenshots.push({name,path:relative(file)});}
 async close(){this.cdp.close();await this.browser.send('Target.disposeBrowserContext',{browserContextId:this.contextId});}
}
let browser, browserPid, browserPort;
const pages = [];
async function startBrowser() {
  await fs.mkdir(PROFILE, { recursive: true });
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--window-size=1440,1000', '--user-data-dir="' + PROFILE + '"', 'about:blank'];
  const command = '$p = Start-Process -FilePath ' + psQuote(CHROME) + ' -ArgumentList @(' + args.map(psQuote).join(',') + ') -WindowStyle Hidden -PassThru; $p.Id';
  browserPid = await new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = ''; ps.stdout.on('data', (d) => { out += d; }); ps.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => reject(new Error('Start-Process did not finish in 20s')), 20000);
    ps.on('error', (e) => { clearTimeout(timer); reject(e); });
    ps.on('close', (code) => { clearTimeout(timer); if (code !== 0) reject(new Error('Chrome launch failed: ' + err)); else resolve(Number(out.trim())); });
  });
  let active;
  for (let n = 0; n < 80 && !active; n++) { try { active = (await fs.readFile(path.join(PROFILE, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); } catch { await sleep(250); } }
  if (!active?.[0] || !active?.[1]) throw new Error('Chrome did not expose DevToolsActivePort');
  browserPort = Number(active[0]); browser = await CDP.connect('ws://127.0.0.1:' + browserPort + active[1]);
  report.summary.browser = { executable: CHROME, pid: browserPid, ...(await browser.send('Browser.getVersion')) };
}
async function newPage(role) {
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const targets = await (await fetch('http://127.0.0.1:' + browserPort + '/json/list', { signal: AbortSignal.timeout(10000) })).json();
  const target = targets.find((t) => t.id === targetId); if (!target) throw new Error('New Chrome target missing');
  const page = await new Page(await CDP.connect(target.webSocketDebuggerUrl), browser, browserContextId, targetId, role).init(); pages.push(page); return page;
}


async function run(){
 await fs.mkdir(SHOTS,{recursive:true});await save();await startBrowser();const p=await newPage('simulated');
 await p.visit('/');await p.open();
 check('Guest sees sign-in CTA',await p.evaluate("!!document.querySelector('.ai-chat__guest a[href^=\"/login\"]')"));
 check('Guest opening chat sends no AI request',report.chatCalls.length===0&&report.optionsCalls===0);
 await p.screenshot('guest-sign-in');
 await p.login('member-one');await p.open();
 check('Member options load without claiming provider verification',await p.waitFor("document.querySelector('#sportcenter-ai-message')&&!document.querySelector('.ai-chat__toolbar').textContent.includes('Đang kiểm tra')"));
 check('Opening focuses the question field',await p.evaluate("document.activeElement?.id==='sportcenter-ai-message'"));
 check('Empty question is not sendable',await p.evaluate("document.querySelector('[aria-label=\"Gửi câu hỏi\"]').disabled"));
 const q1='Thẻ thành viên khác lớp có HLV thế nào?',a1='Phản hồi mô phỏng: thẻ dành cho tự tập, lớp có HLV được đăng ký riêng.';
 const start=report.chatCalls.length;await p.submit(q1,{...success(a1),delay:700});
 check('Sending shows progress and disables editing',await p.waitFor("!!document.querySelector('.ai-chat__pending')&&document.querySelector('#sportcenter-ai-message').disabled"));
 await p.evaluate("document.querySelector('.ai-chat__form').requestSubmit();document.querySelector('.ai-chat__form').requestSubmit();true");
 check('Repeated submit shares one inference',await p.done(a1)&&report.chatCalls.length===start+1,{requests:report.chatCalls.length-start});
 check('Real reply text and disclaimer rendered',await p.evaluate(`document.querySelector('.ai-chat__message--assistant')?.textContent.includes(${JSON.stringify(a1)})&&document.querySelector('.ai-chat__disclaimer').textContent.includes('mô phỏng')`));
 await p.submit('Còn lịch tập thì xem ở đâu?',success('Mở Tài khoản của tôi → Lịch tập.'));await p.done('Mở Tài khoản');
 check('Next question sends only completed history pairs',JSON.stringify(report.chatCalls.at(-1).request.history)===JSON.stringify([{role:'user',content:q1},{role:'assistant',content:a1}]));
 await p.screenshot('member-conversation-desktop');
 const failed='Câu hỏi cần thử lại';await p.submit(failed,{status:503,body:{message:'Gemini đang quá tải hoặc hết hạn mức.'},delay:100});
 check('503 is actionable and keeps input',await p.waitFor("document.querySelector('.ai-chat__failure')?.textContent.includes('đang bận')&&document.querySelector('#sportcenter-ai-message').value==='Câu hỏi cần thử lại'"));
 const userBubbles=await p.evaluate("document.querySelectorAll('.ai-chat__message--user').length");p.queue.push(success('Đã thử lại thành công bằng phản hồi mô phỏng.'));await p.click('[aria-label="Thử lại câu hỏi"]');await p.done('Đã thử lại thành công');
 check('Retry replaces the failed turn without duplicate bubble',await p.evaluate(`document.querySelectorAll('.ai-chat__message--user').length===${userBubbles}`));
 check('Failed turn was not leaked into provider history',!report.chatCalls.at(-1).request.history.some(m=>m.content===failed));
 await p.submit('Kiểm tra giới hạn câu hỏi',{status:429,body:{message:'Too many requests'}});
 check('429 asks user to wait instead of auto-retrying',await p.waitFor("document.querySelector('.ai-chat__log').textContent.includes('gửi quá nhiều câu hỏi')"));
 const beforeWait=report.chatCalls.length;await sleep(500);check('429 does not trigger an automatic inference loop',report.chatCalls.length===beforeWait);
 await p.reset();await p.submit('Không coi error thành reply',{status:200,body:{message:'raw-error-must-not-be-an-answer'}});
 check('HTTP200 error object is rejected as answer',await p.waitFor("document.querySelector('.ai-chat__failure')?.textContent.includes('Chưa nhận được nội dung trả lời')")&&await p.evaluate("!document.querySelector('.ai-chat__message--assistant')&&!document.querySelector('.ai-chat__log').textContent.includes('raw-error-must-not-be-an-answer')"));
 await p.reset();await p.submit('Hủy yêu cầu chậm',{...success('STALE_CANCELLED_REPLY'),delay:1800});await p.waitFor("!!document.querySelector('.ai-chat__pending')");await p.clickText('Dừng chờ');
 check('Cancel restores input and permits another question',await p.waitFor("!document.querySelector('#sportcenter-ai-message').disabled&&document.querySelector('#sportcenter-ai-message').value==='Hủy yêu cầu chậm'"));await sleep(2000);
 check('A cancelled late answer cannot appear',await p.evaluate("!document.querySelector('.ai-chat__log').textContent.includes('STALE_CANCELLED_REPLY')"));
 await p.reset();await p.submit('Xóa trong lúc đang chờ',{...success('STALE_CLEARED_REPLY'),delay:1300});await p.waitFor("!!document.querySelector('.ai-chat__pending')");await p.reset();await sleep(1500);
 check('New conversation aborts and ignores pending response',await p.evaluate("document.querySelectorAll('.ai-chat__turn').length===0&&!document.querySelector('.ai-chat__log').textContent.includes('STALE_CLEARED_REPLY')"));
 await p.submit('Kiểm tra timeout35giây',{...success('STALE_TIMEOUT_REPLY'),delay:37000});const timeoutStarted=Date.now();
 check('Slow request has a readable waiting message',await p.waitFor("document.querySelector('.ai-chat__pending')?.textContent.includes('có thể dừng chờ')",11000));
 check('35second deadline releases the form with retry message',await p.waitFor("document.querySelector('.ai-chat__failure')?.textContent.includes('phản hồi quá lâu')&&!document.querySelector('#sportcenter-ai-message').disabled",29000),{elapsedMs:Date.now()-timeoutStarted});
 await p.reset();
 check('Question field enforces maxLength2000',await p.evaluate("document.querySelector('#sportcenter-ai-message').maxLength===2000"));
 await p.type('#sportcenter-ai-message','');await p.evaluate("document.querySelector('#sportcenter-ai-message').focus();true");await p.cdp.send('Input.insertText',{text:'a'.repeat(2010)});
 check('Browser typing cannot exceed2000characters',await p.evaluate("document.querySelector('#sportcenter-ai-message').value.length===2000"));
 p.queue.push(success('Đã nhận câu hỏi đúng2000ký tự.'));await p.key('Enter');await p.done('Đã nhận câu hỏi đúng2000');
 check('Exactly2000characters are sent successfully',report.chatCalls.at(-1).request.message.length===2000);
 await p.reset();await p.type('#sportcenter-ai-message','Đang gõ tiếng Việt');const beforeIme=report.chatCalls.length;
 await p.evaluate("(()=>{const el=document.querySelector('#sportcenter-ai-message');el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'Việt'}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));return true;})()");await sleep(200);
 check('IME Enter does not submit unfinished Vietnamese input',report.chatCalls.length===beforeIme);
 await p.evaluate("document.querySelector('#sportcenter-ai-message').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));true");
 await p.type('#sportcenter-ai-message','Dòng thứ nhất');await p.evaluate("const el=document.querySelector('#sportcenter-ai-message');el.focus();el.setSelectionRange(el.value.length,el.value.length);true");await p.key('Enter',8);
 check('ShiftEnter inserts a newline without sending',report.chatCalls.length===beforeIme&&await p.evaluate("document.querySelector('#sportcenter-ai-message').value.includes('\\n')"));
 const html='<img src=x onerror="window.__aiInjected=true">';await p.reset();await p.submit('Hiển thị nội dung như văn bản',success(html));await p.done(html);
 check('Reply HTML remains inert plain text',await p.evaluate(`document.querySelector('.ai-chat__message--assistant p')?.textContent===${JSON.stringify(html)}&&!document.querySelector('.ai-chat__log img')&&window.__aiInjected!==true`));
 await p.reset();await p.submit('PRIVATE_ACCOUNT_ONE',{...success('PRIVATE_LATE_ANSWER'),delay:1600});await p.waitFor("!!document.querySelector('.ai-chat__pending')");await p.login('member-two');await p.open();await sleep(1800);
 check('Account switch clears conversation and pending private response',await p.evaluate("document.querySelectorAll('.ai-chat__turn').length===0&&!document.querySelector('.ai-chat__log').textContent.includes('PRIVATE_ACCOUNT_ONE')&&!document.querySelector('.ai-chat__log').textContent.includes('PRIVATE_LATE_ANSWER')"));
 await p.submit('Câu đầu của tài khoản hai',success('Phản hồi mới chỉ cho tài khoản hai.'));await p.done('Phản hồi mới');
 check('New account starts with empty provider history',report.chatCalls.at(-1).actor==='member-two'&&report.chatCalls.at(-1).request.history.length===0);
 check('Conversation is not persisted in browser storage',await p.evaluate("![...Object.keys(localStorage)].some(k=>String(localStorage.getItem(k)).includes('PRIVATE_ACCOUNT_ONE'))"));
 // Simulate the storage events emitted by a different browser tab.
 await p.submit('PRIVATE_STORAGE_PENDING',{...success('PRIVATE_STORAGE_LATE'),delay:1600});await p.waitFor("!!document.querySelector('.ai-chat__pending')");
 p.actor=actorOf('member-one');const storageToken=tokenOf(p.actor),storageSession={...p.actor,username:p.actor.name,fullName:'Demo member-one',memberId:p.actor.profileId,access_token:storageToken};
 await p.evaluate(`(()=>{const old=localStorage.getItem('sportcenter.session'),value=${JSON.stringify(JSON.stringify(storageSession))};localStorage.setItem('sportcenter.token',${JSON.stringify(storageToken)});localStorage.setItem('sportcenter.session',value);window.dispatchEvent(new StorageEvent('storage',{key:'sportcenter.session',oldValue:old,newValue:value,storageArea:localStorage,url:location.href}));return true;})()`);
 check('Cross-tab storage identity change resets private UI',await p.waitFor("!document.querySelector('#sportcenter-ai-panel')&&document.querySelector('.utility-bar').textContent.includes('member-one')"));await p.open();await sleep(1800);
 check('Cross-tab account change rejects an old pending reply',await p.evaluate("document.querySelectorAll('.ai-chat__turn').length===0&&!document.querySelector('.ai-chat__log').textContent.includes('PRIVATE_STORAGE_LATE')"));
 await p.evaluate("localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null,storageArea:localStorage,url:location.href}));true");
 check('Cross-tab storage clear signs out and clears chat',await p.waitFor("!document.querySelector('#sportcenter-ai-panel')&&document.querySelector('.utility-bar').textContent.includes('Đăng nhập')"));await p.open();
 check('Cross-tab signout shows guest gate without private messages',await p.evaluate("!!document.querySelector('.ai-chat__guest')&&!document.querySelector('.ai-chat__turn')"));
 await p.login('member-two');await p.open();
 await p.viewport(375,812);await sleep(250);
 check('375px panel fits viewport without horizontal overflow',await p.evaluate("(()=>{const r=document.querySelector('#sportcenter-ai-panel').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth+1;})()"));await p.screenshot('member-chat-mobile-375');
 await p.viewport(375,480);await sleep(150);
 check('Reduced viewport keeps composer and controls visible',await p.evaluate("(()=>{const r=document.querySelector('#sportcenter-ai-panel').getBoundingClientRect(),t=document.querySelector('#sportcenter-ai-message').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&t.bottom<=innerHeight&&t.top>=0;})()"));await p.screenshot('member-chat-small-height');
 await p.viewport(1440,1000);await p.evaluate("document.querySelector('#sportcenter-ai-message').focus();true");await p.key('Escape');
 check('Escape closes panel and returns keyboard focus',await p.waitFor("!document.querySelector('#sportcenter-ai-panel')&&document.activeElement?.classList.contains('ai-chat__launcher')"));
 await p.open();await p.cdp.send('Emulation.setEmulatedMedia',{media:'print'});
 check('Chat does not appear in print output',await p.evaluate("getComputedStyle(document.querySelector('.ai-chat')).display==='none'"));await p.cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
 await p.navigate('/print/invoices/00000000-0000-4000-8000-000000000099');
 check('Invoice print route unmounts chat entirely',await p.waitFor("!document.querySelector('.ai-chat')"));
 await p.navigate('/');await p.waitFor("document.querySelector('.ai-chat__launcher')");await p.login('coach');await p.open();await p.submit('Câu hỏi từ coach',success('Coach cũng dùng trợ lý theo contract Authenticated.'));check('Staff coach can use the same widget',await p.done('Coach cũng dùng trợ lý'));
 await p.click('button[aria-label="Đăng xuất"]');
 check('Signout removes stored session and closes private chat',await p.waitFor("!localStorage.getItem('sportcenter.session')&&!document.querySelector('#sportcenter-ai-panel')"));await p.open();
 check('After signout only guest CTA is shown',await p.evaluate("!!document.querySelector('.ai-chat__guest')&&!document.querySelector('.ai-chat__turn')"));
 check('No unexpected business writes were attempted',report.blockedWrites.length===0);
 check('No uncaught runtime exceptions',report.runtimeExceptions.length===0,{exceptions:report.runtimeExceptions});
 report.summary.status='completed';await save();
}
try{await run();}catch(error){report.summary.status='interrupted';check('Chat UI run completes',false,{error:String(error.stack??error)});}
finally{
 for(const page of pages.reverse()){try{await page.close();}catch{}}
 if(browser){try{await browser.send('Browser.close',{},5000);}catch{}browser.close();}
 const resolved=path.resolve(PROFILE),owner=path.resolve(SHOTS)+path.sep;
 if(resolved.startsWith(owner)&&path.basename(resolved)==='chrome-profile'){for(let i=0;i<10;i++){try{await fs.rm(resolved,{recursive:true,force:true});break;}catch{await sleep(300);}}}
 await save();console.log('REPORT '+REPORT);console.log('SUMMARY '+JSON.stringify(report.summary));if(report.summary.status!=='completed'||report.summary.failed)process.exitCode=1;
}