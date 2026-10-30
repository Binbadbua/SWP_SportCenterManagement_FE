// Live UI smoke audit. No mocks or third-party browser dependency.
// Default: navigation + real form sign-in only. --payment adds one fixture package checkout/cancel.
// --payment-only runs only that member payment flow after the API suite has finished.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { PASSWORD, OUT, ROOT } from './api-audit.mjs';

const flags = new Set(process.argv.slice(2));
const PAYMENT = flags.has('--payment') || flags.has('--payment-only');
const PAYMENT_ONLY = flags.has('--payment-only');
const BASE = (process.env.QA_UI_BASE || 'http://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN = new Date().toISOString().replace(/[:.]/g, '-');
const SHOTS = path.join(OUT, 'screenshots', 'ui-' + RUN);
const PROFILE = path.join(SHOTS, 'chrome-profile');
const REPORT = path.join(OUT, PAYMENT_ONLY ? 'ui-payment.json' : 'ui-audit.json');
const report = {
  summary: { startedAt: new Date().toISOString(), baseUrl: BASE, mode: PAYMENT_ONLY ? 'payment-only' : PAYMENT ? 'smoke-and-payment' : 'read-only-smoke', status: 'running' },
  checks: [], routes: [], requests: [], apiFailures: [], runtimeExceptions: [], consoleErrors: [], blockedWrites: [], screenshots: [], dialogs: [], payment: null,
};

const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === 'string') return value.replaceAll(PASSWORD, '[REDACTED]').replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED JWT]');
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
      const permitted = ['GET', 'HEAD', 'OPTIONS'].includes(method) || (method === 'POST' && url.pathname === '/api/auth/login') || (this.allowPayment && method === 'POST' && (url.pathname === '/api/payments/checkout' || /^\/api\/payments\/[0-9a-f-]+\/cancel$/i.test(url.pathname)));
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
  async settle(timeout = 30000) {
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
    const start = { exceptions: report.runtimeExceptions.length, errors: report.apiFailures.length };
    await this.cdp.send('Page.navigate', { url: BASE + route });
    const settled = await this.settle();
    const snapshot = await this.snapshot();
    const errors = report.apiFailures.slice(start.errors).filter((r) => !r.cancelled);
    const detail = { role: this.role, route, settled, ...snapshot, apiErrors: errors.map(({ method, endpoint, status, error }) => ({ method, endpoint, status, error })) };
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
    const filled = await this.type('input[name="username"]', user.username) && await this.type('input[name="password"]', PASSWORD);
    check(this.role + ' login form fields', filled);
    if (!filled) return false;
    await this.evaluate("document.querySelector('.login__form').requestSubmit(); true");
    const ready = await this.waitFor(`(() => { const u = JSON.parse(localStorage.getItem('sportcenter.session') || 'null'); return u?.role === ${JSON.stringify(role)} && u?.accountId === ${JSON.stringify(user.accountId)} && location.pathname !== '/login'; })()`, 55000);
    await this.settle();
    check(this.role + ' real form login authenticates expected account/role', ready, { role, accountId: user.accountId });
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

async function paymentFlow(page, fixtures) {
  page.allowPayment = true;
  const packageId = fixtures.entities.package.id;
  await page.visit('/memberships/' + packageId + '/checkout', { shot: 'payment-checkout-desktop' });
  const form = await page.evaluate("!!document.querySelector('#checkout-form')");
  check('SePay fixture checkout form available (no other pending order)', form);
  if (!form) return;
  const before = await page.evaluate('document.body.textContent');
  check('Checkout describes SePay bank transfer without MoMo', /SePay|chuyển khoản/i.test(before) && !/MoMo/i.test(before));
  await page.click('#checkout-form input[type="checkbox"]');
  check('Checkout terms accepted', await page.evaluate("!!document.querySelector('#checkout-form input[type=checkbox]')?.checked"));
  await page.mobile('payment-checkout-mobile-375');
  await page.evaluate("document.querySelector('#checkout-form').requestSubmit(); true");
  const redirected = await page.waitFor("location.pathname === '/payment/result' && new URLSearchParams(location.search).has('paymentId')", 45000);
  check('Package UI checkout stays on SportCenter payment result', redirected);
  if (!redirected) { await page.shot('payment-checkout-failed', true); return; }
  const paymentId = await page.evaluate("new URLSearchParams(location.search).get('paymentId')");
  page.route = '/payment/result?paymentId=' + paymentId;
  report.payment = { paymentId, packageId, createdVia: 'UI', cancellationConfirmed: false };
  try {
    await page.settle();
    const detail = await page.paymentBody(paymentId);
    check('UI receives SePay pending order contract', detail?.provider === 'SePay' && detail?.status === 1 && detail?.paymentMethod === 2 && detail?.amount === fixtures.entities.package.body.price, { paymentId, provider: detail?.provider, status: detail?.status, method: detail?.paymentMethod, amount: detail?.amount });
    const body = await page.evaluate('document.body.textContent');
    const imgReady = await page.waitFor("[...document.images].some(img => img.src.startsWith('https://qr.sepay.vn/img?') && img.complete && img.naturalWidth > 0)", 15000);
    const imgs = await page.evaluate("[...document.images].filter(img => img.src.includes('qr.sepay.vn')).map(img => ({ src: img.src, complete: img.complete, width: img.naturalWidth, alt: img.alt }))");
    check('SePay QR is a loaded image from the provider', imgReady && imgs.some((img) => img.src === detail?.qrCodeUrl), { images: imgs });
    check('Payment page shows exact receiving account and reference', !!detail?.bankAccountNumber && !!detail?.paymentReference && body.includes(detail.bankAccountNumber) && body.includes(detail.paymentReference), { accountVisible: !!detail?.bankAccountNumber && body.includes(detail.bankAccountNumber), referenceVisible: !!detail?.paymentReference && body.includes(detail.paymentReference) });
    check('Payment instructions use SePay and no MoMo', /SePay|chuyển khoản/i.test(body) && !/MoMo/i.test(body));
    const timerBefore = await page.evaluate("document.querySelector('.pay-qr__timer')?.textContent ?? ''");
    await page.shot('payment-pending-desktop', true); await page.mobile('payment-pending-mobile-375');
    await sleep(6500);
    const timerAfter = await page.evaluate("document.querySelector('.pay-qr__timer')?.textContent ?? ''");
    const polls = report.requests.filter((r) => r.role === page.role && r.method === 'GET' && r.endpoint === '/api/payments/' + paymentId && r.status === 200);
    check('Pending payment countdown advances', /\d{1,2}:\d{2}/.test(timerBefore) && timerBefore !== timerAfter, { before: timerBefore, after: timerAfter });
    check('Payment page polls the real API automatically', polls.length >= 2, { successfulReads: polls.length });
  } finally {
    page.acceptNextDialog = true;
    const clicked = await page.clickText('Hủy đơn');
    check('Member can request cancellation from payment UI', clicked);
    if (clicked) {
      const cancelled = await page.waitFor("document.querySelector('.pay-result__title')?.textContent.toLowerCase().includes('hủy')", 35000);
      await page.settle();
      const final = await page.paymentBody(paymentId);
      report.payment.cancellationConfirmed = cancelled && final?.status === 4;
      report.payment.finalStatus = final?.status;
      check('UI cancellation leaves fixture payment cancelled', report.payment.cancellationConfirmed, { paymentId, finalStatus: final?.status });
      await page.shot('payment-cancelled-desktop', true);
    }
    page.allowPayment = false;
  }
}

async function run() {
  const fixtures = JSON.parse(await fs.readFile(path.join(OUT, 'fixtures.json'), 'utf8'));
  await fs.mkdir(SHOTS, { recursive: true });
  await save(); await startBrowser();
  if (!PAYMENT_ONLY) {
    const visitor = await newPage('visitor');
    const routes = ['/', '/classes', '/classes/' + fixtures.entities.paidClass.id, '/classes/' + fixtures.entities.freeClass.id, '/schedule', '/memberships', '/coaches', '/coaches/' + fixtures.users.coach.profileId, '/login', '/register', '/help', '/terms', '/privacy', '/payment/result', '/account', '/staff', '/qa-missing-page'];
    for (const route of routes) {
      await visitor.visit(route, { shot: route === '/' ? 'visitor-home-desktop' : route === '/memberships' ? 'visitor-memberships-desktop' : undefined });
      if (route === '/') await visitor.mobile('visitor-home-mobile-375');
    }
    await save();
  }
  const member = await newPage('Member');
  if (await member.login(fixtures.users.member, 'Member')) {
    if (!PAYMENT_ONLY) {
      for (const tab of ['bookings', 'schedule', 'attendance', 'membership', 'training', 'invoices', 'notifications', 'support', 'profile']) {
        await member.visit('/account?tab=' + tab, { shot: ['membership', 'profile'].includes(tab) ? 'member-' + tab + '-desktop' : undefined });
        check('Member account tab selection ' + tab, await member.evaluate("document.querySelectorAll('.tabs__btn[aria-current=page]').length === 1"));
        if (tab === 'membership') await member.mobile('member-membership-mobile-375');
      }
      await member.visit('/memberships/' + fixtures.entities.package.id + '/checkout', { shot: 'member-package-checkout-desktop' });
      await member.visit('/classes/' + fixtures.entities.paidClass.id + '/checkout', { shot: 'member-class-checkout-desktop' });
      await member.visit('/memberships/upgrade');
    }
    if (PAYMENT) await paymentFlow(member, fixtures);
  }
  await save();
  if (!PAYMENT_ONLY) {
    const roles = [
      { key: 'reception', role: 'Receptionist', routes: ['', 'notifications', 'check-ins', 'bookings', 'members', 'memberships', 'invoices', 'support-requests', 'classes', 'schedule'] },
      { key: 'coach', role: 'Coach', routes: ['', 'notifications', 'attendance', 'my-classes', 'my-members', 'training-plans', 'training-results', 'schedule'] },
      { key: 'manager', role: 'CenterManager', routes: ['', 'notifications', 'check-ins', 'members', 'memberships', 'invoices', 'support-requests', 'classes', 'schedule', 'rooms', 'sports', 'packages', 'coaches', 'receptionists', 'managers', 'accounts', 'audit-log'] },
    ];
    for (const entry of roles) {
      const page = await newPage(entry.role);
      if (await page.login(fixtures.users[entry.key], entry.role)) {
        const expectedNav = entry.routes.map((route) => '/staff' + (route ? '/' + route : '')).sort();
        const actualNav = await page.evaluate("[...document.querySelectorAll('nav[aria-label=\"Menu nhân viên\"] a')].map(a => new URL(a.href).pathname).sort()");
        check(entry.role + ' sidebar matches the authorized role routes', JSON.stringify(expectedNav) === JSON.stringify(actualNav), { expected: expectedNav, actual: actualNav });
        for (const route of entry.routes) await page.visit('/staff' + (route ? '/' + route : ''), { shot: !route ? entry.role + '-dashboard-desktop' : undefined });
        await page.mobile(entry.role + '-staff-mobile-375');
      }
      await save();
    }
  }
  check('No uncaught runtime exceptions', report.runtimeExceptions.length === 0, { exceptions: report.runtimeExceptions });
  check('No failed API requests during authorized UI flows', report.apiFailures.filter((r) => !r.cancelled).length === 0, { failures: report.apiFailures.filter((r) => !r.cancelled) });
  check('No unexpected business writes attempted', report.blockedWrites.length === 0, { blocked: report.blockedWrites });
  check('No browser console errors', report.consoleErrors.length === 0, { errors: report.consoleErrors });
  report.summary.status = 'completed';
}

try { await run(); } catch (error) { report.summary.status = 'interrupted'; check('UI audit finishes successfully', false, { error: clean(String(error.stack ?? error)) }); }
finally {
  for (const page of pages.reverse()) { try { await page.close(); } catch { /* browser can already be closed */ } }
  if (browser) { try { await browser.send('Browser.close', {}, 5000); } catch { /* Chrome closes before acknowledging */ } browser.close(); }
  // Only the temporary profile created by this run can be removed; screenshot artifacts are preserved.
  const resolved = path.resolve(PROFILE), owner = path.resolve(SHOTS) + path.sep;
  if (resolved.startsWith(owner) && path.basename(resolved) === 'chrome-profile') {
    for (let n = 0; n < 10; n++) { try { await fs.rm(resolved, { recursive: true, force: true }); break; } catch { await sleep(350); } }
  }
  await save(); process.stdout.write('SUMMARY ' + JSON.stringify(report.summary) + '\n');
  if (report.summary.status !== 'completed' || report.summary.failed > 0) process.exitCode = 1;
}
