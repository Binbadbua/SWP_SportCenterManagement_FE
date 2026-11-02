// Live UI smoke audit. No mocks or third-party browser dependency.
// Default: navigation + real form sign-in only. --payment adds one fixture package checkout/cancel.
// --payment-only runs only that member payment flow after the API suite has finished.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ROOT } from './api-audit.mjs';
const PASSWORD='Test@1234';

const flags = new Set(process.argv.slice(2));
const PAYMENT = flags.has('--payment') || flags.has('--payment-only');
const PAYMENT_ONLY = flags.has('--payment-only');
const BASE = (process.env.QA_UI_BASE || 'http://127.0.0.1:5182').replace(/\/$/, '');
const CHROME = process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN = new Date().toISOString().replace(/[:.]/g, '-');
const OUT=path.join(ROOT,'artifacts/web-review-2026-11-02',RUN);
const SHOTS=path.join(OUT,'screenshots');
const PROFILE = path.join(SHOTS, 'chrome-profile');
const REPORT=path.join(OUT,'report.json');
const report = {
  summary: { startedAt: new Date().toISOString(), baseUrl: BASE, mode: PAYMENT_ONLY ? 'payment-only' : PAYMENT ? 'smoke-and-payment' : 'read-only-smoke', status: 'running' },
  checks: [], routes: [], requests: [], apiFailures: [], runtimeExceptions: [], consoleErrors: [], blockedWrites: [], screenshots: [], dialogs: [], payment: null,
};

const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === 'string') return value.replaceAll(PASSWORD, '[REDACTED]').replaceAll('123456','[REDACTED]').replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED JWT]');
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(password|token|access_token|accessToken|authorization|cookie|set-cookie)$/i.test(key)).map(([key, val]) => [key, clean(val)]));
};
const check = (name, passed, detail = {}) => {
  const item = clean({ id: 'ui-' + String(report.checks.length + 1).padStart(3, '0'), name, passed: !!passed, ...detail });
  report.checks.push(item);
  process.stdout.write((passed ? 'PASS ' : 'FAIL ') + item.id + ' ' + name + '\n');
  return item;
};
const save = async () => {
  Object.assign(report.summary, { updatedAt: new Date().toISOString(), checks: report.checks.length, passed: report.checks.filter((r) => r.passed).length, failed: report.checks.filter((r) => !r.passed).length, routes: report.routes.length, requests: report.requests.length, apiFailures: report.apiFailures.length, runtimeExceptions: report.runtimeExceptions.length, screenshots: report.screenshots.length });
  await fs.writeFile(REPORT, JSON.stringify(clean(report), null, 2));
};
const relative = (file) => path.relative(ROOT, file).replaceAll('\\', '/');
const endpoint = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return String(url); } };
const psQuote = (text) => "'" + String(text).replaceAll("'", "''") + "'";

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
  constructor(cdp, browser, contextId, targetId, role) {
    Object.assign(this, { cdp, browser, contextId, targetId, role, route: '', pending: new Set(), byId: new Map(), activity: Date.now(), acceptNextDialog: false, allowPayment: false });
  }
  async init() {
    const origin = () => ({ role: this.role, route: this.route });
    this.cdp.on('Runtime.exceptionThrown', ({ exceptionDetails: e }) => report.runtimeExceptions.push(clean({ ...origin(), text: e.exception?.description ?? e.text, url: e.url, line: e.lineNumber })));
    this.cdp.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') report.consoleErrors.push(clean({ ...origin(), text: e.args.map((arg) => arg.value ?? arg.description ?? '').join(' ').slice(0, 2000) })); });
    this.cdp.on('Page.javascriptDialogOpening', async (e) => {
      const accept = this.acceptNextDialog; this.acceptNextDialog = false;
      report.dialogs.push({ ...origin(), type: e.type, message: e.message, accepted: accept });
      await this.cdp.send('Page.handleJavaScriptDialog', { accept });
    });
    this.cdp.on('Network.requestWillBeSent', (e) => {
      if (!new URL(e.request.url).pathname.startsWith('/api/')) return;
      const item = { ...origin(), id: e.requestId, method: e.request.method, endpoint: endpoint(e.request.url), startedAt: Date.now() };
      report.requests.push(item); this.byId.set(e.requestId, item); this.pending.add(e.requestId); this.activity = Date.now();
    });
    this.cdp.on('Network.responseReceived', (e) => {
      const item = this.byId.get(e.requestId); if (!item) return;
      Object.assign(item, { status: e.response.status, mimeType: e.response.mimeType });
      if (item.status >= 400) report.apiFailures.push({ ...item });
    });
    this.cdp.on('Network.loadingFinished', (e) => { const item = this.byId.get(e.requestId); if (item) item.ms = Date.now() - item.startedAt; this.pending.delete(e.requestId); this.activity = Date.now(); });
    this.cdp.on('Network.loadingFailed', (e) => {
      const item = this.byId.get(e.requestId); if (item) { Object.assign(item, { error: e.errorText, cancelled: !!e.canceled, ms: Date.now() - item.startedAt }); report.apiFailures.push({ ...item }); }
      this.pending.delete(e.requestId); this.activity = Date.now();
    });
    this.cdp.on('Fetch.requestPaused', async (e) => {
      const url = new URL(e.request.url), method = e.request.method;
      const permitted = ['GET', 'HEAD', 'OPTIONS'].includes(method) || (method === 'POST' && url.pathname === '/api/auth/login');
      if (permitted) await this.cdp.send('Fetch.continueRequest', { requestId: e.requestId });
      else { report.blockedWrites.push({ ...origin(), method, endpoint: url.pathname }); await this.cdp.send('Fetch.failRequest', { requestId: e.requestId, errorReason: 'BlockedByClient' }); }
    });
    await this.cdp.send('Page.enable'); await this.cdp.send('Runtime.enable'); await this.cdp.send('Network.enable');
    await this.cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await this.cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
    await this.viewport(1440, 1000);
    return this;
  }
  async evaluate(expression) {
    const r = await this.cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(clean(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result?.value;
  }
  async waitFor(expression, timeout = 30000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) { try { if (await this.evaluate(expression)) return true; } catch { /* context can change while navigating */ } await sleep(250); }
    return false;
  }
  async settle(timeout = 60000) {
    const until = Date.now() + timeout;
    await sleep(350);
    while (Date.now() < until) {
      if (this.pending.size === 0 && Date.now() - this.activity > 500 && await this.evaluate("document.readyState === 'complete' && !!document.querySelector('#root')?.textContent?.trim() && !document.querySelector('.loading')")) return true;
      await sleep(250);
    }
    return false;
  }
  async viewport(width, height) { await this.cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }); }
  async snapshot() {
    return this.evaluate(`(() => ({ path: location.pathname + location.search, headings: [...document.querySelectorAll('h1,h2,.empty__title,.notice__title')].map(x => x.textContent.trim()).slice(0, 12), alerts: [...document.querySelectorAll('.notice--danger,.field__error[role=alert]')].map(x => x.textContent.trim()), fatal: document.body.textContent.includes('Trang này gặp lỗi'), rootLength: document.querySelector('#root')?.textContent?.trim().length ?? 0, loading: document.querySelectorAll('.loading').length, sample: document.body.textContent.includes('Đang hiện dữ liệu mẫu'), overflow: document.documentElement.scrollWidth > innerWidth + 2, width: innerWidth, title: document.title }))()`);
  }
  async visit(route, { shot, checkErrors = true } = {}) {
    this.route = route; this.pending.clear(); this.activity = Date.now();
    const visitStarted=Date.now();
    const start = { exceptions: report.runtimeExceptions.length, errors: report.apiFailures.length };
    await this.cdp.send('Page.navigate', { url: BASE + route });
    const settled = await this.settle();
    const snapshot = await this.snapshot();
    const performanceInfo=await this.evaluate(`(() => {const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return {navigation:n?{responseEndMs:n.responseEnd,domContentLoadedMs:n.domContentLoadedEventEnd,loadEventEndMs:n.loadEventEnd}:null,assets:r.filter(x=>x.initiatorType!=='fetch'&&x.initiatorType!=='xmlhttprequest').map(x=>({path:new URL(x.name).pathname,kind:x.initiatorType,durationMs:Math.round(x.duration),transferBytes:x.transferSize,encodedBytes:x.encodedBodySize})),resourceCount:r.length,totalTransferBytes:r.reduce((s,x)=>s+x.transferSize,0)};})()`);
    const errors = report.apiFailures.slice(start.errors).filter((r) => !r.cancelled);
    const detail = { role: this.role, route, settled, durationMs:Date.now()-visitStarted, performanceInfo, ...snapshot, apiErrors: errors.map(({ method, endpoint, status, error }) => ({ method, endpoint, status, error })) };
    report.routes.push(detail);
    check(this.role + ' ' + route, settled && snapshot.rootLength > 30 && !snapshot.fatal && snapshot.headings.length > 0 && !snapshot.sample && snapshot.alerts.length === 0 && report.runtimeExceptions.length === start.exceptions && (!checkErrors || errors.length === 0), detail);
    if (shot) await this.shot(shot);
    return snapshot;
  }
  async shot(name, full = false) {
    let clip;
    if (full) { const m = await this.cdp.send('Page.getLayoutMetrics'); const s = m.cssContentSize ?? m.contentSize; clip = { x: 0, y: 0, width: s.width, height: Math.min(s.height, 14000), scale: 1 }; }
    const r = await this.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full, ...(clip ? { clip } : {}) });
    const file = path.join(SHOTS, name + '.png'); await fs.writeFile(file, Buffer.from(r.data, 'base64')); report.screenshots.push({ role: this.role, route: this.route, path: relative(file) });
  }
  async mobile(name) { await this.viewport(375, 812); await sleep(450); const snap = await this.snapshot(); check(this.role + ' mobile 375px ' + this.route, !snap.overflow && snap.rootLength > 30, snap); await this.shot(name, true); await this.viewport(1440, 1000); }
  async type(selector, value) {
    return this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  }
  async click(selector) { return this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return false; el.click(); return true; })()`); }
  async clickText(text) { return this.evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)}); if (!el || el.disabled) return false; el.click(); return true; })()`); }
  async login(user, role) {
    await this.visit('/login?next=' + encodeURIComponent(role === 'Member' ? '/account' : '/staff'));
    const filled = await this.type('input[name="username"]', user.username) && await this.type('input[name="password"]', user.password);
    check(this.role + ' login form fields', filled);
    if (!filled) return false;
    await this.evaluate("document.querySelector('.login__form').requestSubmit(); true");
    const ready = await this.waitFor(`(() => { const u = JSON.parse(localStorage.getItem('sportcenter.session') || 'null'); return u?.role === ${JSON.stringify(role)} && u?.username === ${JSON.stringify(user.username)} && location.pathname !== '/login'; })()`, 55000);
    await this.settle();
    check(this.role + ' real form login authenticates expected account/role', ready, { role, username: user.username });
    const key = { Member: 'memberId', Coach: 'coachId', Receptionist: 'receptionistId' }[role];
    if (ready && key && user.profileId) {
      const profileReady = await this.waitFor(`JSON.parse(localStorage.getItem('sportcenter.session') || 'null')?.[${JSON.stringify(key)}] === ${JSON.stringify(user.profileId)}`, 30000);
      check(this.role + ' resolves the correct profile after login', profileReady, { profile: key, expected: user.profileId });
    }
    return ready;
  }
  async paymentBody(paymentId) {
    const requests = report.requests.filter((r) => r.role === this.role && r.method === 'GET' && r.endpoint === '/api/payments/' + paymentId && r.status === 200 && r.ms != null);
    for (const item of requests.reverse()) {
      try { const body = await this.cdp.send('Network.getResponseBody', { requestId: item.id }); return JSON.parse(body.base64Encoded ? Buffer.from(body.body, 'base64').toString() : body.body); } catch { /* earlier navigation may have discarded a response */ }
    }
    return null;
  }
  async close() { this.cdp.close(); await this.browser.send('Target.disposeBrowserContext', { browserContextId: this.contextId }); }
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

async function inspect(page,label,{mobile=false,shot=false}={}){
 if(mobile)await page.viewport(375,812);
 await sleep(300);
 const info=await page.evaluate(`(() => {
 const visible=e=>{if(!e.getClientRects().length)return false;for(let x=e;x;x=x.parentElement){const s=getComputedStyle(x);if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0)return false;}return true;};
 const name=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||'').trim();
 const unnamedButtons=[...document.querySelectorAll('button')].filter(visible).filter(e=>!name(e)).map(e=>({tag:e.tagName,class:e.className}));
 const unlabeledInputs=[...document.querySelectorAll('input,textarea,select')].filter(visible).filter(e=>!['hidden','submit','button','checkbox','radio'].includes(e.type)).filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.closest('label')&&!(e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]'))).map(e=>({name:e.name,type:e.type,id:e.id,placeholder:e.placeholder}));
 const brokenVisibleImages=[...document.images].filter(visible).filter(e=>e.getAttribute('src')).filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&e.complete&&e.naturalWidth===0}).map(e=>({src:e.src,alt:e.alt}));
 const overflowing=[...document.querySelectorAll('body *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2&&r.left<innerWidth&&getComputedStyle(e).position!=='fixed'}).slice(0,10).map(e=>({tag:e.tagName,class:e.className,width:Math.round(e.getBoundingClientRect().width),text:(e.textContent||'').slice(0,90)}));
 return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,unnamedButtons,unlabeledInputs,brokenVisibleImages,overflowing,headingCount:document.querySelectorAll('h1').length,dialogCount:document.querySelectorAll('[role=dialog]').length};
 })()`);
 report.ux??=[];report.ux.push({role:page.role,route:page.route,label,...info});
 check(page.role+' '+label+' fits '+info.width+'px',!info.overflow,{role:page.role,route:page.route,...info});
 check(page.role+' '+label+' controls have accessible labels',info.unnamedButtons.length===0&&info.unlabeledInputs.length===0,{role:page.role,route:page.route,unnamedButtons:info.unnamedButtons,unlabeledInputs:info.unlabeledInputs});
 if(info.brokenVisibleImages.length)check(page.role+' '+label+' visible images load',false,{role:page.role,route:page.route,images:info.brokenVisibleImages});
 if(shot)await page.shot(page.role+'-'+label.replace(/[^a-z0-9]+/gi,'-')+(mobile?'-mobile':'-desktop'),true);
 if(mobile)await page.viewport(1440,1000);
 await save();return info;
}
async function formPreview(page,label){
 const clicked=await page.evaluate("(() => {const b=[...document.querySelectorAll('button')].find(b=>/Thêm/.test(b.textContent)&&!b.disabled);if(!b)return false;b.click();return true})()");
 if(!clicked){report.ux??=[];report.ux.push({role:page.role,route:page.route,label,skipped:'No authorized add button'});return;}
 const opened=await page.waitFor("!!document.querySelector('[role=dialog],.modal')",5000);
 check(page.role+' '+label+' add dialog actually opens',opened,{role:page.role,route:page.route});
 if(!opened)return;await sleep(500);
 await inspect(page,label,{mobile:true,shot:true});
 await page.evaluate("(() => {const d=document.querySelector('[role=dialog]')||document;const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='Hủy'||b.getAttribute('aria-label')==='Đóng');if(b)b.click()})()");
 await sleep(150);
}
async function run(){
 report.summary.mode='read-only-full-web-ux-existing-demo-accounts';
 report.summary.performanceScope='Local Chrome+Vite with network cache disabled; measured route/API/resource latency only, not production uptime/load testing or Core Web Vitals certification.';
 report.summary.scope='Navigation/form preview only. Every API write except POST auth/login is blocked. No AI inference, new entities or payment operations.';
 await fs.mkdir(SHOTS,{recursive:true});await save();await startBrowser();
 const visitor=await newPage('visitor');
 await visitor.visit('/',{shot:'visitor-home-desktop'});await inspect(visitor,'home',{mobile:true,shot:true});
 const ids=await visitor.evaluate("Promise.all(['/api/classes','/api/coaches','/api/membership-packages?pageSize=500'].map(p=>fetch(p).then(r=>r.json()))).then(([c,h,p])=>({classId:(Array.isArray(c)?c:c.data??c.items??[]).find(x=>!x.className?.startsWith('QA'))?.id,coachId:(Array.isArray(h)?h:h.data??h.items??[]).find(x=>!x.fullName?.startsWith('QA'))?.id,packageId:(Array.isArray(p)?p:p.data??p.items??[]).find(x=>x.status===1&&!x.packageName?.startsWith('QA'))?.membershipPackageId}))");
 report.summary.existingPublicIds=ids;
 const publicRoutes=['/classes',...(ids.classId?['/classes/'+ids.classId]:[]),'/schedule','/memberships','/coaches',...(ids.coachId?['/coaches/'+ids.coachId]:[]),'/help','/login','/register','/terms','/privacy','/payment/result','/account','/staff','/page-does-not-exist'];
 for(const route of publicRoutes){await visitor.visit(route);await inspect(visitor,route.slice(1)||'home',{mobile:['/classes','/schedule','/memberships','/login','/register','/help'].includes(route),shot:['/register','/memberships'].includes(route)});}
 const member=await newPage('Member');
 if(await member.login({username:'quan.tm',password:'Test@1234'},'Member')){
  for(const tab of ['bookings','schedule','attendance','membership','training','invoices','notifications','support','profile']){
   await member.visit('/account?tab='+tab);await inspect(member,'account-'+tab,{mobile:true,shot:['membership','training','profile'].includes(tab)});
  }
  for(const route of [...(ids.packageId?['/memberships/'+ids.packageId+'/checkout']:[]),...(ids.classId?['/classes/'+ids.classId+'/checkout']:[]),'/memberships/upgrade']){await member.visit(route);await inspect(member,'checkout-'+route.split('/').slice(-1)[0],{mobile:true});}
 }
 for(const entry of [
  {role:'Receptionist',username:'nguyen.thu.trang',password:'Test@1234',routes:['','notifications','check-ins','bookings','members','memberships','invoices','support-requests','classes','schedule']},
  {role:'Coach',username:'nguyen.manh.hung',password:'123456',routes:['','notifications','attendance','my-classes','my-members','training-plans','training-results','schedule']},
  {role:'CenterManager',username:'demo_manager',password:'123456',routes:['','notifications','check-ins','members','memberships','invoices','support-requests','classes','schedule','rooms','sports','packages','coaches','receptionists','managers','accounts','audit-log']}
 ]){
  const page=await newPage(entry.role);
  if(await page.login(entry,entry.role)){
   for(const route of entry.routes){await page.visit('/staff'+(route?'/'+route:''));await inspect(page,'staff-'+(route||'dashboard'),{mobile:['','bookings','training-results','classes','invoices'].includes(route),shot:route===''});if(entry.role==='Coach'&&['training-plans','training-results'].includes(route))await formPreview(page,route+'-add-preview');}
  }
  await save();
 }
 check('No uncaught runtime exceptions',report.runtimeExceptions.length===0,{exceptions:report.runtimeExceptions});
 check('No unexpected business writes attempted',report.blockedWrites.length===0,{blocked:report.blockedWrites});
 check('No non-cancelled API failures on authorized routes',report.apiFailures.filter(x=>!x.cancelled).length===0,{failures:report.apiFailures.filter(x=>!x.cancelled)});
 check('No browser console errors',report.consoleErrors.length===0,{errors:report.consoleErrors});
 report.summary.status='completed';
}
async function runFocus(){
 report.summary.mode='focused-mobile-tab-chat-overlap-and-coach-forms';report.summary.scope='Read-only real logins and GETs; no chat open/inference or business writes.';
 await fs.mkdir(SHOTS,{recursive:true});await save();await startBrowser();
 const member=await newPage('Member');await member.viewport(375,812);
 if(await member.login({username:'quan.tm',password:'Test@1234'},'Member')){
  for(const tab of ['membership','training','profile']){
   await member.viewport(375,812);await member.visit('/account?tab='+tab);await sleep(300);
   const active=await member.evaluate("(() => {const n=document.querySelector('nav.tabs'),a=n?.querySelector('[aria-current=page]');if(!n||!a)return null;const p=n.getBoundingClientRect(),r=a.getBoundingClientRect();return {width:innerWidth,label:a.textContent.trim(),left:r.left,right:r.right,navLeft:p.left,navRight:p.right,visible:innerWidth===375&&r.left>=Math.max(p.left,0)-2&&r.right<=Math.min(p.right,innerWidth)+2}})()");
   check('Mobile direct '+tab+' active tab is fully visible',active?.visible,{active});
   await inspect(member,'focus-account-'+tab,{mobile:true,shot:tab==='membership'});
  }
  const ids=await member.evaluate("Promise.all(['/api/classes','/api/membership-packages?pageSize=500'].map(p=>fetch(p).then(r=>r.json()))).then(([c,p])=>({classId:(Array.isArray(c)?c:c.data??c.items??[]).find(x=>x.status===1&&new Date(x.startDate)>new Date()&&!x.className?.startsWith('QA'))?.id,packageId:(Array.isArray(p)?p:p.data??p.items??[]).find(x=>x.status===1&&!x.packageName?.startsWith('QA'))?.membershipPackageId}))");
  for(const route of [...(ids.classId?['/classes/'+ids.classId]:[]),...(ids.packageId?['/memberships/'+ids.packageId+'/checkout']:[])]){
   await member.viewport(375,812);await member.visit(route);await member.evaluate('window.scrollTo(0,document.documentElement.scrollHeight/2);true');await sleep(300);
   const obstruction=await member.evaluate(`(() => {const l=document.querySelector('.ai-chat__launcher');if(!l)return {launcher:false};const z=l.getBoundingClientRect();const near=[...document.querySelectorAll('button,a.btn')].filter(e=>e!==l&&!e.closest('.ai-chat')&&!e.disabled&&e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();const overlap=Math.max(0,Math.min(r.right,z.right)-Math.max(r.left,z.left))*Math.max(0,Math.min(r.bottom,z.bottom)-Math.max(r.top,z.top));const cx=r.left+r.width/2,cy=r.top+r.height/2,top=document.elementFromPoint(cx,cy);return {text:e.textContent.trim().slice(0,90),overlap,blockedCenter:cx>=0&&cx<innerWidth&&cy>=0&&cy<innerHeight&&!!top&&top.closest('.ai-chat')!==null}}).filter(x=>x.overlap>0);return {width:innerWidth,launcher:true,launcherRect:{left:z.left,right:z.right,top:z.top,bottom:z.bottom},overlappingActions:near};})()`);
   check('Closed chat leaves visible action centers usable on '+route,obstruction.width===375&&obstruction.launcher&&!(obstruction.overlappingActions??[]).some(x=>x.blockedCenter),{route,...obstruction});
   await member.shot('focus-chat-closed-'+(route.includes('checkout')?'checkout':'class')+'-mobile',false);
  }
 }
 const coach=await newPage('Coach');await coach.viewport(375,812);
 if(await coach.login({username:'nguyen.manh.hung',password:'123456'},'Coach'))for(const route of ['training-plans','training-results']){await coach.visit('/staff/'+route);await formPreview(coach,'focus-'+route);}
 check('Focused check has no runtime errors',report.runtimeExceptions.length===0,{exceptions:report.runtimeExceptions});
 check('Focused check has no blocked business writes',report.blockedWrites.length===0,{blocked:report.blockedWrites});
 report.summary.status='completed';
}
try{await (flags.has('--focus-only')?runFocus():run())}catch(error){report.summary.status='interrupted';check('UX audit completes',false,{error:clean(String(error.stack??error))})}
finally{
 for(const page of pages.reverse()){try{await page.close()}catch{}}
 if(browser){try{await browser.send('Browser.close',{},5000)}catch{}browser.close()}
 const resolved=path.resolve(PROFILE),owner=path.resolve(SHOTS)+path.sep;
 if(resolved.startsWith(owner)&&path.basename(resolved)==='chrome-profile')for(let n=0;n<10;n++){try{await fs.rm(resolved,{recursive:true,force:true});break}catch{await sleep(350)}}
 await save();console.log('REPORT '+REPORT);console.log('SUMMARY '+JSON.stringify(report.summary));
 if(report.summary.status!=='completed'||report.summary.failed)process.exitCode=1;
}