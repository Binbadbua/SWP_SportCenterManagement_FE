import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const BASE = process.env.QA_API_BASE || 'https://sportcenter-deploy-latest-1.onrender.com';
export const ROOT = path.resolve(import.meta.dirname, '../..');
export const OUT = path.join(ROOT, 'artifacts', 'api-audit-2026-10-29');
export const ZERO = '00000000-0000-0000-0000-000000000000';
export const PASSWORD = process.env.QA_FIXTURE_PASSWORD || 'Test@1234';
export const rowsOf = (b) => Array.isArray(b) ? b : b?.data ?? b?.items ?? [];
export const idOf = (b) => b?.id ?? b?.membershipPackageId ?? b?.membershipId ?? b?.trainingPlanId ?? b?.trainingResultId ?? b?.memberId ?? b?.accountId ?? b?.userId;
export const day = (offset = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const parts = today.split(/[/-]/);
  const iso = parts[0].length === 4 ? parts.join('-') : [parts[2], parts[0], parts[1]].join('-');
  return new Date(Date.parse(iso + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
};
export const date = (n) => day(n) + 'T00:00:00Z';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !/^(access_token|accessToken|token|password|currentPassword|newPassword|secret|apiKey|apiSecret|authorization)$/i.test(k)).map(([k, v]) => [k, redact(v)]));
}

export class Audit {
  constructor(name) { this.name = name; this.results = []; this.calls = []; this.spec = null; this.checks = 0; }
  async request(method, endpoint, role, body, extra = {}) {
    const start = Date.now();
    const headers = { Accept: 'application/json', ...extra.headers };
    if (role?.token) headers.Authorization = 'Bearer ' + role.token;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res, raw = '', data = null, error = null;
    try {
      res = await fetch(BASE + endpoint, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(extra.timeout ?? 45000) });
      raw = await res.text();
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 3000); }
    } catch (e) { error = String(e); }
    const result = { method, endpoint, role: role?.name ?? 'anonymous', status: res?.status ?? 0, ms: Date.now() - start, body: data, error, contentType: res?.headers.get('content-type') };
    this.calls.push({ ...redact(result), request: body instanceof FormData ? '[multipart]' : redact(body) });
    return result;
  }
  check(name, condition, detail = {}) {
    this.checks++;
    const item = { id: this.name + '-' + String(this.checks).padStart(3, '0'), name, passed: !!condition, ...redact(detail) };
    this.results.push(item);
    process.stdout.write((condition ? 'PASS ' : 'FAIL ') + item.id + ' ' + name + (detail.status ? ' HTTP ' + detail.status : '') + '\n');
    return item;
  }
  async expect(name, method, endpoint, role, body, expected = [200], predicate) {
    const r = await this.request(method, endpoint, role, body);
    this.check(name, expected.includes(r.status) && (!predicate || predicate(r.body, r)), { method, endpoint, role: r.role, status: r.status, response: redact(r.body), error: r.error });
    return r;
  }
  async login(username, password, name) {
    const r = await this.request('POST', '/api/auth/login', null, { email: username, password });
    const data = r.body?.data ?? r.body;
    if (r.status !== 200 || !data?.access_token) throw new Error('Login failed for ' + name + ': ' + r.status + ' ' + JSON.stringify(redact(r.body)));
    return { name, token: data.access_token, username, accountId: data.userId };
  }
  async save(manifest) {
    await fs.mkdir(OUT, { recursive: true });
    const coverage = [];
    if (this.spec) {
      for (const [route, ops] of Object.entries(this.spec.paths)) {
        for (const method of Object.keys(ops).filter((m) => ['get','post','put','delete','patch'].includes(m))) {
          const re = new RegExp('^' + route.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '$');
          const calls = this.calls.filter((c) => c.method.toLowerCase() === method && re.test(c.endpoint.split('?')[0]));
          coverage.push({ method: method.toUpperCase(), path: route, calls: calls.length, statuses: [...new Set(calls.map((c) => c.status))], success: calls.some((c) => c.status >= 200 && c.status < 300) });
        }
      }
    }
    const summary = { name: this.name, baseUrl: BASE, recordedAt: new Date().toISOString(), timezone: 'Asia/Bangkok', checks: this.results.length, passed: this.results.filter((r) => r.passed).length, failed: this.results.filter((r) => !r.passed).length, requests: this.calls.length, documentedOperations: coverage.length, operationsCalled: coverage.filter((r) => r.calls).length, operationsWithSuccess: coverage.filter((r) => r.success).length };
    await fs.writeFile(path.join(OUT, this.name + '.json'), JSON.stringify({ summary, results: this.results, calls: this.calls, coverage }, null, 2));
    if (manifest) await fs.writeFile(path.join(OUT, 'fixtures.json'), JSON.stringify(redact(manifest), null, 2));
    process.stdout.write('SUMMARY ' + JSON.stringify(summary) + '\n');
    return summary;
  }
}

export async function bootstrap() {
  const a = new Audit('bootstrap');
  const run = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  const f = { run, prefix: 'QA' + run, createdAt: new Date().toISOString(), users: {}, entities: {}, cleanupNotes: [] };
  await fs.mkdir(OUT, { recursive: true });
  const spec = await a.request('GET', '/swagger/v1/swagger.json');
  if (spec.status !== 200) throw new Error('Swagger not reachable');
  a.spec = spec.body;
  await fs.writeFile(path.join(OUT, 'swagger.json'), JSON.stringify(spec.body, null, 2));
  const manager = await a.login(process.env.QA_MANAGER_USER || 'demo_manager', process.env.QA_MANAGER_PASSWORD || '123456', 'manager');
  const opts = await a.expect('Payment options use SePay bank transfer', 'GET', '/api/payments/options', null, undefined, [200], (b) => b.provider === 'SePay' && b.methods?.join(',') === '2');
  f.options = opts.body;
  let n = 0;
  const phone = () => '09' + run.slice(-6) + String(++n).padStart(2, '0');
  for (const [key, role] of [['coach',2], ['otherCoach',2], ['reception',3], ['manager',4]]) {
    const username = ('qa_' + run + '_' + key).toLowerCase();
    const input = { username, email: username + '@example.invalid', password: PASSWORD, fullName: f.prefix + ' ' + key, phone: phone(), role, status: 1 };
    const r = await a.expect('Create isolated ' + key + ' account', 'POST', '/api/accounts', manager, input, [200,201]);
    if (![200,201].includes(r.status)) throw new Error('Could not create fixture ' + key);
    const accountId = idOf(r.body);
    f.users[key] = { username, accountId, email: input.email, fullName: input.fullName, phone: input.phone, role };
    const profilePath = role === 2 ? '/api/coaches' : role === 3 ? '/api/receptionists' : '/api/center-managers';
    let profile = await a.request('POST', profilePath, manager, { accountId, fullName: input.fullName, phone: input.phone, email: input.email, specialization: 'QA integration', experienceYears: 2, workingShift: 'QA temporary' });
    if (![200,201].includes(profile.status)) {
      const list = await a.request('GET', profilePath, manager);
      const own = rowsOf(list.body).find((x) => x.accountId === accountId);
      if (!own) throw new Error('Fixture profile failed ' + key + ': ' + profile.status + ' ' + JSON.stringify(profile.body));
      profile = { ...profile, status: 200, body: own };
    }
    f.users[key].profileId = idOf(profile.body);
    a.check('Fixture ' + key + ' profile exists', !!f.users[key].profileId, { status: profile.status, response: profile.body });
    await a.save(f);
  }
  for (const key of ['member','otherMember']) {
    const username = ('qa_' + run + '_' + key).toLowerCase();
    const input = { username, email: username + '@example.invalid', password: PASSWORD, fullName: f.prefix + ' ' + key, phone: phone(), dob: '2000-01-01T00:00:00Z', gender: 'Other', trainingGoal: 'Temporary integration QA' };
    const r = await a.expect('Register isolated ' + key, 'POST', '/api/auth/register', null, input, [200,201]);
    if (![200,201].includes(r.status)) throw new Error('Fixture member registration failed');
    const auth = await a.login(username, PASSWORD, key);
    const me = await a.expect('Resolve ' + key + ' profile', 'GET', '/api/members/me', auth, undefined, [200]);
    f.users[key] = { username, accountId: idOf(r.body) ?? auth.accountId, profileId: idOf(me.body), email: input.email, fullName: input.fullName, phone: input.phone, role: 1 };
    await a.save(f);
  }
  const reception = await a.login(f.users.reception.username, PASSWORD, 'reception');
  const member = await a.login(f.users.member.username, PASSWORD, 'member');
  const make = async (key, endpoint, body, actor = manager) => {
    const r = await a.expect('Create fixture ' + key, 'POST', endpoint, actor, body, [200,201]);
    if (![200,201].includes(r.status)) throw new Error('Fixture ' + key + ' failed: ' + JSON.stringify(r.body));
    f.entities[key] = { id: idOf(r.body), body: r.body, request: body };
    await a.save(f);
    return f.entities[key].id;
  };
  await make('category', '/api/categories', { categoryName: f.prefix + ' Sport', description: 'Temporary API audit fixture' });
  await make('room', '/api/rooms', { roomName: f.prefix + ' Room', capacity: 30, status: 1 });
  await make('unavailableRoom', '/api/rooms', { roomName: f.prefix + ' Closed', capacity: 10, status: 2 });
  await make('package', '/api/membership-packages', { packageName: f.prefix + ' 30 days', description: 'Temporary API audit fixture', benefits: 'QA only', durationDays: 30, price: 10000, discountPercent: 20, status: 1, categoryIds: [] });
  await make('longPackage', '/api/membership-packages', { packageName: f.prefix + ' 90 days', description: 'Temporary API audit fixture', benefits: 'QA only', durationDays: 90, price: 100000, discountPercent: 30, status: 1, categoryIds: [] });
  for (const [key, price, capacity] of [['paidClass',10000,5],['freeClass',0,5],['fullClass',0,1],['attendanceClass',0,5]]) {
    await make(key, '/api/classes', { className: f.prefix + ' ' + key, categoryId: f.entities.category.id, coachId: f.users.coach.profileId, maxCapacity: capacity, price, startDate: date(-3), endDate: date(35), status: 1 });
    const slot = { paidClass:'10', freeClass:'12', fullClass:'14', attendanceClass:'16' }[key];
    await make(key + 'Session', '/api/class-sessions', { classId: f.entities[key].id, roomId: f.entities.room.id, date: date(2), startTime: slot + ':00:00', endTime: slot + ':45:00' });
  }
  const checkout = await a.expect('SePay checkout returns real contract', 'POST', '/api/payments/checkout', member, { membershipPackageId: f.entities.package.id, startDate: date(0), paymentMethod: 2, returnUrl: 'http://localhost:5173/payment/result' }, [200]);
  if (checkout.status === 200) {
    f.packagePayment = checkout.body;
    const detail = await a.expect('Read SePay pending order', 'GET', '/api/payments/' + checkout.body.paymentId, member, undefined, [200]);
    f.paymentDetail = detail.body;
    process.stdout.write('SEPAY_CONTRACT ' + JSON.stringify(redact(detail.body)) + '\n');
  }
  await a.save(f);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  bootstrap().catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exitCode = 1; });
}

