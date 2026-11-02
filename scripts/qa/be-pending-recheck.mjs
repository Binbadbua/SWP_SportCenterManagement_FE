// Focused deployment recheck. Financial data stays read-only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, ROOT, BASE, rowsOf, idOf, date, day, ZERO } from './api-audit.mjs';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(ROOT, 'artifacts', 'be-recheck-2026-11-02', 'business', run);
const prefix = 'QA_DELETE_GUARD_' + run.replace(/\D/g, '').slice(0, 14);
const flags = new Set(process.argv.slice(2));
const a = new Audit('pending-be');
const observations = [], unverified = [], cleanup = [], fixtures = {};
const role = {};
const rows = b => rowsOf(b);
const key = x => x?.id ?? x?.classId ?? x?.sessionId ?? x?.memberId ?? x?.membershipId ?? x?.membershipPackageId;
let initialClasses = [], createdPlanId;
const summary = { startedAt: new Date().toISOString(), baseUrl: BASE, scope: 'Existing data reads; optional single empty class/session guard and reversible rejected-plan probe. No new accounts, memberships, invoices, bookings, check-ins or bank operations.' };
await fs.mkdir(out, { recursive: true });
const save = async () => {
 Object.assign(summary, { updatedAt: new Date().toISOString(), checks: a.results.length, passed: a.results.filter(x => x.passed).length, failed: a.results.filter(x => !x.passed).length, requests: a.calls.length });
 await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ summary, observations, unverified, results: a.results, calls: a.calls, fixtures, cleanup }, null, 2));
};
async function get(endpoint, actor, timeout = 35000) { return a.request('GET', endpoint, actor, undefined, { timeout }); }
async function check(name, method, endpoint, actor, body, statuses, pred) {
 const r = await a.request(method, endpoint, actor, body, { timeout: 35000 });
 a.check(name, statuses.includes(r.status) && (!pred || pred(r.body)), { method, endpoint, role: r.role, status: r.status, ms: r.ms, response: r.body, error: r.error });
 await save(); return r;
}
async function clean(method, endpoint, actor, body) {
 const r = await a.request(method, endpoint, actor, body);
 cleanup.push({ method, endpoint, status: r.status, response: r.body }); await save(); return r;
}
const qaPrefixes = ['QA261029163854', 'QA_RECHECK_261030060103', 'QA_RECHECK_261030060850'];
const qaName = value => qaPrefixes.some(p => String(value ?? '').toUpperCase().startsWith(p.toUpperCase()));
try {
 let spec = await get('/swagger/v1/swagger.json', null, 55000);
 if (!spec.status) spec = await get('/swagger/v1/swagger.json', null, 55000);
 if (spec.status !== 200) throw new Error('Live Swagger unavailable: ' + spec.status + ' ' + spec.error);
 await fs.writeFile(path.join(out, 'swagger.json'), JSON.stringify(spec.body, null, 2));
 a.calls.at(-1).body = '[saved in swagger.json]';
 const old = JSON.parse(await fs.readFile(path.join(ROOT, 'artifacts/be-recheck-2026-10-30-060850/swagger.json'), 'utf8'));
 const ops = s => Object.entries(s.paths).flatMap(([p, v]) => Object.keys(v).filter(m => /^(get|post|put|patch|delete)$/.test(m)).map(m => m.toUpperCase() + ' ' + p));
 const oldOps = new Set(ops(old)), newOps = new Set(ops(spec.body));
 observations.push({ swagger: { operations: newOps.size, added: [...newOps].filter(x => !oldOps.has(x)), removed: [...oldOps].filter(x => !newOps.has(x)), exportRoutes: [...newOps].filter(x => /invoices.*export/.test(x)) } });
 role.manager = await a.login('demo_manager', '123456', 'Manager');
 role.reception = await a.login('nguyen.thu.trang', 'Test@1234', 'Receptionist');
 role.coach = await a.login('nguyen.manh.hung', '123456', 'Coach');
 role.foreignCoach = await a.login('tran.thanh.binh', '123456', 'OtherCoach');
 role.member = await a.login('quan.tm', 'Test@1234', 'Member');
 const profiles = {};
 for (const [r, ep] of [['reception', '/api/receptionists/me'], ['coach', '/api/coaches/me'], ['foreignCoach', '/api/coaches/me'], ['member', '/api/members/me']]) {
   const p = await check('Profile available: ' + r, 'GET', ep, role[r], undefined, [200]); profiles[r] = p.body;
 }
 const datasets = {};
 for (const [label, endpoint, actor] of [
  ['categories','/api/categories',null],['rooms','/api/rooms',role.manager],['classes','/api/classes',null],['coaches','/api/coaches?pageSize=500',role.manager],['packages','/api/membership-packages?pageSize=500',null],['sessions','/api/class-sessions',role.manager],['invoices','/api/invoices?pageSize=500',role.reception],['memberships','/api/memberships?pageSize=500',role.reception],['members','/api/members?pageSize=500',role.manager],['plans','/api/coaches/me/training-plans?pageSize=500',role.coach],['results','/api/coaches/me/training-results?pageSize=500',role.coach],['notifications','/api/notifications/me?pageSize=100',role.member],['bookings','/api/members/me/class-bookings?pageSize=100',role.member],['memberInvoices','/api/members/me/invoices?pageSize=100',role.member],['memberCards','/api/members/me/memberships?pageSize=100',role.member],['memberPlans','/api/members/me/training-plans?pageSize=100',role.member],['memberResults','/api/members/me/training-results?pageSize=100',role.member],['memberAttendance','/api/members/me/attendances?pageSize=100',role.member],['checkins','/api/check-ins?pageSize=100',role.manager],['support','/api/support-requests?pageSize=100',role.reception],['audit','/api/audit-logs?pageSize=100',role.manager]
 ]) {
  const d = await check('GET regression: ' + label, 'GET', endpoint, actor, undefined, [200]); datasets[label] = rows(d.body);
 }
 initialClasses = datasets.classes;
 observations.push({ qaInventory: Object.fromEntries(['categories','rooms','classes','coaches','packages'].map(label => [label, datasets[label].filter(x => qaName(x.categoryName ?? x.roomName ?? x.className ?? x.fullName ?? x.packageName)).map(x => ({ id: key(x), name: x.categoryName ?? x.roomName ?? x.className ?? x.fullName ?? x.packageName, status: x.status }))])), qaInvoices: datasets.invoices.filter(x => qaName(x.memberName) || qaName(x.className) || qaName(x.packageName)).map(x => ({ id: key(x), memberName: x.memberName, className: x.className, packageName: x.packageName, status: x.status, amount: x.amount })) });
 const existingPlan = datasets.plans.find(x => x.classId && x.memberId);
 const existingResult = datasets.results.find(x => x.trainingResultId ?? x.id);
 for (const [label, item, base] of [['plan',existingPlan,'training-plans'],['result',existingResult,'training-results']]) {
  if (!item) { unverified.push('B61 ' + label + ': no positive existing record found.'); continue; }
  const id = idOf(item);
  const p = await check('B61 owner reads existing ' + label, 'GET', '/api/' + base + '/' + id, role.coach, undefined, [200]);
  if (p.status === 200) await check('B61 foreign coach denied same existing ' + label, 'GET', '/api/' + base + '/' + id, role.foreignCoach, undefined, [403,404]);
 }
 if (flags.has('--plan-guard') && existingPlan) {
  const roster = await get('/api/classes/' + existingPlan.classId + '/members', role.manager);
  const enrolled = new Set(rows(roster.body).map(x => x.memberId ?? x.id)); enrolled.add(existingPlan.memberId);
  const outsider = datasets.members.find(x => !enrolled.has(x.memberId ?? x.id) && !qaName(x.fullName));
  if (roster.status === 200 && outsider) {
   const body = { coachId: profiles.coach?.coachId ?? profiles.coach?.id, memberId: outsider.memberId ?? outsider.id, classId: existingPlan.classId, title: prefix + ' rejected-plan-control', contentDescription: 'Temporary enrollment validation check; remove if unexpectedly accepted.', createdDate: date(0) };
   fixtures.planGuard = { request: body };
   const p = await check('B62 reject plan for a member not enrolled in class', 'POST', '/api/training-plans', role.coach, body, [400,403]);
   if (p.status >= 200 && p.status < 300) { createdPlanId = idOf(p.body); fixtures.planGuard.unexpectedId = createdPlanId; }
  } else unverified.push('B62 no reliable non-enrolled existing member available.');
 } else unverified.push('B62 fresh creation guard not run; previous fixed result retained.');
 const mine = datasets.memberInvoices.find(x => !qaName(x.memberName));
 if (mine) await check('B11 canonical receptionist invoice export works', 'GET', '/api/invoices/' + key(mine) + '/export', role.reception, undefined, [200]);
 const options = await check('SePay options remain available', 'GET', '/api/payments/options', role.member, undefined, [200], b => b.provider === 'SePay' && b.methods?.includes(2));
 observations.push({ paymentOptions: options.body });
 for (const [issue,id] of [['B66 real 8000 order','8d0d7c03-1384-4457-8554-04f957796eeb'],['B59 historical membership expiry','e3109ca0-04f6-4d79-9da0-4021a92660a4'],['Historical class expiry','de22213d-e69e-4c75-aca5-05e19efe0634']]) {
  const p = await get('/api/payments/' + id, role.manager, 20000);
  const inv = await get('/api/invoices/' + id, role.reception, 20000);
  observations.push({ issue, paymentId: id, payment: { httpStatus: p.status, ms: p.ms, status: p.body?.status, kind: p.body?.kind, amount: p.body?.amount, paidAt: p.body?.paidAt, expiresAt: p.body?.expiresAt, membershipId: p.body?.membershipId, bookingId: p.body?.bookingId }, invoice: { httpStatus: inv.status, ms: inv.ms, status: inv.body?.status, paymentDate: inv.body?.paymentDate }, errors: [p.error, inv.error].filter(Boolean) });
  // Do not retain bank account details in this recheck report.
  a.calls.findLast(x => x.endpoint === '/api/payments/' + id).body = { status: p.body?.status, amount: p.body?.amount, paidAt: p.body?.paidAt, expiresAt: p.body?.expiresAt, membershipId: p.body?.membershipId, bookingId: p.body?.bookingId };
 }
 const card = await get('/api/memberships/f493e9bd-1ccc-4c6c-aa7f-16fbbbc03e93', role.reception);
 observations.push({ issue: 'B59 historical linked membership', httpStatus: card.status, status: card.body?.status });
 const removedInvoice = await get('/api/invoices/99c3136e-4e84-4735-87c0-c38b5e071251', role.reception);
 observations.push({ issue: 'B65 old deleted pending invoice', httpStatus: removedInvoice.status, presentInList: datasets.invoices.some(x => key(x) === '99c3136e-4e84-4735-87c0-c38b5e071251') });
 // ZERO cannot identify a real member, so this policy observation cannot create a check-in.
 const checkInPolicy = await a.request('POST', '/api/check-ins', role.manager, { memberId: ZERO });
 observations.push({ issue: 'Manager check-in policy observation', httpStatus: checkInPolicy.status, body: checkInPolicy.body });
 unverified.push('B59 new deadline timing not exercised: no new retained payment/invoice created on the shared demo DB.');
 unverified.push('B60/B43 pending SePay confirm/invoice-write bypass and B65 new pending invoice deletion require disposable financial fixtures; previous fixes not freshly proved by terminal records. No real order was mutated.');
 unverified.push('B27 profile restoration, B32 automatic notification causality/timers and B12/B42 provider-secret rotation need staging/provider evidence.');
 unverified.push('New bank-transfer latency, authenticated webhook idempotency/matching, actual upgrade activation and external refund need provider logs and a controlled real transaction; not proved by GET or UI mocks.');
 if (flags.has('--class-probe')) {
  const c = datasets.classes.find(x => !qaName(x.className) && x.categoryId && x.coachId);
  const room = datasets.rooms.find(x => x.status === 1 && !qaName(x.roomName));
  if (!c || !room) throw new Error('No existing active room/coach/category for isolated class guard.');
  const request = { className: prefix, categoryId: c.categoryId, coachId: c.coachId, maxCapacity: 1, price: 0, startDate: date(-3), endDate: date(3), status: 1 };
  const made = await a.request('POST', '/api/classes', role.manager, request);
  if (![200,201].includes(made.status) || !key(made.body)) throw new Error('Isolated class creation failed: ' + made.status + ' ' + JSON.stringify(made.body));
  fixtures.class = { id: key(made.body), request }; await save();
  let slot;
  for (let h = 6; h <= 21 && !slot; h++) {
    const start = String(h).padStart(2,'0') + ':15:00', end = String(h).padStart(2,'0') + ':30:00';
    if (!datasets.sessions.some(s => String(s.date).slice(0,10) === day(-2) && (s.roomId === key(room) || s.coachId === c.coachId) && s.startTime < end && s.endTime > start)) slot = { startTime: start, endTime: end };
  }
  if (!slot) throw new Error('No non-overlapping temporary session slot; cleanup only.');
  const sr = { classId: fixtures.class.id, roomId: key(room), date: date(-2), ...slot };
  const session = await a.request('POST', '/api/class-sessions', role.manager, sr);
  if (![200,201].includes(session.status) || !key(session.body)) throw new Error('Isolated past session failed: ' + session.status + ' ' + JSON.stringify(session.body));
  fixtures.session = { id: key(session.body), request: sr }; await save();
  const before = await get('/api/classes/' + fixtures.class.id, role.manager);
  const sessions = await get('/api/class-sessions/class/' + fixtures.class.id, role.manager);
  a.check('B58 positive fixture is status1 with an existing past session', before.body?.status === 1 && rows(sessions.body).some(s => key(s) === fixtures.session.id && String(s.date).slice(0,10) < day(0)), { class: before.body, sessionCount: rows(sessions.body).length });
  await check('B58 reject delete once first session has passed', 'DELETE', '/api/classes/' + fixtures.class.id, role.manager, undefined, [400,409]);
  await check('B58 denied delete keeps class available', 'GET', '/api/classes/' + fixtures.class.id, role.manager, undefined, [200]);
 }
 summary.status = 'completed';
} catch (error) { summary.status = 'interrupted'; summary.error = String(error.stack ?? error); }
finally {
 try {
  if (createdPlanId) { await clean('DELETE','/api/training-plans/'+createdPlanId,role.coach); const p=await get('/api/training-plans/'+createdPlanId,role.coach); a.check('Unexpected plan probe was removed',p.status===404,{status:p.status}); }
  if (fixtures.session) await clean('DELETE','/api/class-sessions/'+fixtures.session.id,role.manager);
  if (fixtures.class) {
   const p = await get('/api/classes/' + fixtures.class.id,role.manager);
   if (p.status===200) {
    // Only this owned fixture may have dates reset after the actual guard was tested.
    await clean('PUT','/api/classes/'+fixtures.class.id,role.manager,{...fixtures.class.request,startDate:date(3),endDate:date(6),status:1});
    await clean('DELETE','/api/classes/'+fixtures.class.id,role.manager);
   }
   const q=await get('/api/classes/'+fixtures.class.id,role.manager);
   const list=await get('/api/classes',role.manager);
   a.check('Temporary class is absent from detail and active list',q.status===404&&list.status===200&&!rows(list.body).some(x=>key(x)===fixtures.class.id),{detailStatus:q.status,listStatus:list.status,fixtureId:fixtures.class.id});
   a.check('Original demo class fees and IDs preserved',initialClasses.every(x=>rows(list.body).some(y=>key(y)===key(x)&&y.price===x.price)),{classes:initialClasses.length});
   if(fixtures.session){const ss=await get('/api/class-sessions/'+fixtures.session.id,role.manager);a.check('Temporary session is absent',ss.status===404,{status:ss.status});}
  }
 } catch(error) { cleanup.push({error:String(error)}); }
 await save();
 console.log('REPORT '+path.join(out,'report.json'));
 console.log('SUMMARY '+JSON.stringify(summary));
 console.log('OBSERVATIONS '+JSON.stringify(observations));
 if(summary.status!=='completed'||summary.failed)process.exitCode=1;
}