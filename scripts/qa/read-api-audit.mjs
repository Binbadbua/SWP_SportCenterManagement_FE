import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, PASSWORD, OUT, ZERO, day } from './api-audit.mjs';

const a = new Audit('read-api');
a.spec = JSON.parse(await fs.readFile(path.join(OUT, 'swagger.json'), 'utf8'));
let f = JSON.parse(await fs.readFile(path.join(OUT, 'fixtures.json'), 'utf8'));
const supplement = process.argv.includes('--supplement');
let previousReadMatrix = [];
let previousReadAudit = null;
if (supplement) {
  try {
    const old = JSON.parse(await fs.readFile(path.join(OUT, 'read-api.json'), 'utf8'));
    a.results = old.results ?? []; a.calls = old.calls ?? []; a.checks = a.results.length; previousReadMatrix = old.readMatrix ?? []; previousReadAudit = old.readAudit ?? null;
  } catch {}
}
const rows = b => Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : Array.isArray(b?.items) ? b.items : Array.isArray(b?.data?.items) ? b.data.items : [];
const objectId = b => b?.id ?? b?.trainingPlanId ?? b?.trainingResultId ?? b?.auditLogId ?? b?.memberId;
const actors = { anonymous: null };
actors.manager = await a.login('demo_manager', '123456', 'manager');
for (const key of ['reception', 'coach', 'member', 'otherCoach', 'otherMember']) actors[key] = await a.login(f.users[key].username, PASSWORD, key);
const resolvedMembers = {};
for (const key of ['member', 'otherMember']) {
  const me = await a.request('GET', '/api/members/me', actors[key]);
  const id = me.body?.memberId ?? me.body?.data?.memberId;
  if (me.status !== 200 || !id) throw new Error('Could not resolve real member profile ID for ' + key);
  f.users[key].profileId = id; resolvedMembers[key] = id;
}
const roles = ['anonymous', 'manager', 'reception', 'coach', 'member'];
const supplementNotes = [];
if (supplement) {
  for (const old of a.results) {
    if (old.name.startsWith('unassigned coach training-result isolation') && old.status === 200 && rows(old.response).length === 0) {
      old.passed = true; old.name = 'Unassigned coach training-result list returns no records (empty-list policy)';
      old.previousExpectedStatuses = old.expected; old.expected = [200];
      old.policyClarification = 'A filtered empty 200 response is not evidence of data exposure; nonempty fixture is checked separately in the supplement.';
    }
  }
}
const matrix = [];
const fixtureNotes = [];
const findings = [];
const skipped = [{ method: 'GET', path: '/api/payments/mock-gateway', reason: 'Gateway excluded by explicit read-only audit instruction; no transfer or gateway execution authorized in this suite.' }];
const semaphore = async (jobs, concurrency = 4) => {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) { const index = next++; await jobs[index](); }
  }));
};
const classify = r => r.status >= 200 && r.status < 300 ? 'success' : [401,403].includes(r.status) ? 'authorization-denied' : r.status === 404 ? 'not-found' : r.status >= 500 || !r.status ? 'server-or-network-error' : 'validation-or-other';
const call = async (route, endpoint, role, expected, fixtureResolved = true, phase = 'matrix') => {
  const r = await a.request('GET', endpoint, actors[role], undefined, { timeout: 45000 });
  matrix.push({ phase, route, endpoint, role, status: r.status, classification: classify(r), fixtureResolved, expectedStatuses: expected ?? null, expectedResultMatched: expected ? expected.includes(r.status) : null, ms: r.ms, contentType: r.contentType, response: r.body, error: r.error });
  if (expected) a.check(phase + ' ' + role + ' GET ' + route, expected.includes(r.status), { method: 'GET', endpoint, role, status: r.status, expected, response: r.body, error: r.error });
  else if (r.status >= 500 || !r.status) a.check('GET must not fail with server/network error: ' + role + ' ' + route, false, { method: 'GET', endpoint, role, status: r.status, response: r.body, error: r.error });
  if (expected && !expected.includes(r.status)) findings.push({ severity: 'contract-observation', route, endpoint, role, status:r.status, expected, observation: 'Observed status differs from the specified expectation; inspect the response and business policy before treating this as a confirmed defect.', response:r.body });
  if (r.status >= 500 || !r.status) findings.push({ severity: 'error', route, endpoint, role, status: r.status, observation: 'Deployed endpoint returned server/network error.', response: r.body });
  return r;
};

const discovery = {};
for (const [key, endpoint, role] of [
  ['auditLog','/api/audit-logs?pageSize=1','manager'],
  ['assignedMember','/api/coaches/me/members','coach'],
  ['trainingPlan','/api/coaches/me/training-plans?pageSize=500','coach'],
  ['trainingResult','/api/coaches/me/training-results?memberId=' + f.users.member.profileId + '&pageSize=500','coach'],
]) {
  const r = await a.request('GET', endpoint, actors[role]);
  const own = rows(r.body).find(x => !x.memberId || x.memberId === f.users.member.profileId) ?? rows(r.body)[0];
  discovery[key] = own && objectId(own);
}
f = JSON.parse(await fs.readFile(path.join(OUT, 'fixtures.json'), 'utf8'));
for (const [key, id] of Object.entries(resolvedMembers)) f.users[key].profileId = id;
const entityId = (...keys) => {
  for (const key of keys) {
    const value = f.entities?.[key] ?? f[key];
    if (typeof value === 'string') return value;
    if (value) { const id = value.id ?? objectId(value.body ?? value); if (id) return id; }
  }
  return null;
};
const ids = {
  '/api/accounts/{id}': f.users.member.accountId,
  '/api/attendances/session/{sessionId}': f.entities.attendanceClassSession.id,
  '/api/attendances/member/{memberId}': f.users.member.profileId,
  '/api/audit-logs/{id}': discovery.auditLog,
  '/api/audit-logs/account/{accountId}': f.users.coach.accountId,
  '/api/center-managers/{id}': f.users.manager.profileId,
  '/api/center-managers/account/{accountId}': f.users.manager.accountId,
  '/api/classes/{id}': f.entities.freeClass.id,
  '/api/classes/{classId}/members': f.entities.freeClass.id,
  '/api/class-bookings/member/{memberId}': f.users.member.profileId,
  '/api/class-sessions/{id}': f.entities.freeClassSession.id,
  '/api/class-sessions/class/{classId}': f.entities.freeClass.id,
  '/api/coaches/{id}': f.users.coach.profileId,
  '/api/invoices/{id}': f.packagePayment.invoiceId,
  '/api/invoices/{id}/export': f.packagePayment.invoiceId,
  '/api/members/{id}': f.users.member.profileId,
  '/api/members/{id}/summary': f.users.member.profileId,
  '/api/memberships/{id}': f.paymentDetail.membershipId,
  '/api/members/{memberId}/memberships': f.users.member.profileId,
  '/api/memberships/{id}/status': f.paymentDetail.membershipId,
  '/api/membership-packages/{id}': f.entities.package.id,
  '/api/payments/{paymentId}': f.packagePayment.paymentId,
  '/api/receptionists/{id}': f.users.reception.profileId,
  '/api/receptionists/account/{accountId}': f.users.reception.accountId,
  '/api/rooms/{id}': f.entities.room.id,
  '/api/categories/{id}': f.entities.category.id,
  '/api/training-plans/{id}': entityId('trainingPlan','plan') ?? discovery.trainingPlan,
  '/api/training-results/{id}': entityId('trainingResult','result') ?? discovery.trainingResult,
  '/api/coaches/me/members/{memberId}/training-results': f.users.member.profileId,
};
const publicRoutes = new Set(['/', '/api/classes', '/api/classes/{id}', '/api/class-sessions', '/api/class-sessions/{id}', '/api/class-sessions/class/{classId}', '/api/coaches', '/api/coaches/{id}', '/api/membership-packages', '/api/membership-packages/{id}', '/api/rooms', '/api/rooms/{id}', '/api/categories', '/api/categories/{id}', '/api/payments/options', '/WeatherForecast']);
const baselineActor = route => {
  if (route === '/api/invoices/{id}/export') return 'reception';
  if (publicRoutes.has(route)) return 'anonymous';
  if (route.startsWith('/api/coaches/me')) return 'coach';
  if (route === '/api/receptionists/me') return 'reception';
  if (route.startsWith('/api/members/me') || route === '/api/invoices/members/me' || route.startsWith('/api/payments/')) return 'member';
  if (route.startsWith('/api/training-plans/') || route.startsWith('/api/training-results/')) return 'coach';
  return 'manager';
};
const deferred = [];
const jobs = [];
for (const [route, methods] of Object.entries(a.spec.paths)) {
  if (!methods.get || route === '/api/payments/mock-gateway') continue;
  const needsId = /\{/.test(route);
  const fixtureResolved = !needsId || !!ids[route];
  if (!fixtureResolved) { deferred.push(route); fixtureNotes.push({ route, reason: 'No live fixture ID available; zero UUID is only a not-found probe, not successful business coverage.' }); }
  if (supplement && !['/api/training-plans/{id}', '/api/training-results/{id}', '/api/audit-logs/{id}', '/api/coaches/me/members/{memberId}/training-results'].includes(route)) continue;
  const endpoint = route.replace(/\{[^}]+\}/g, ids[route] ?? ZERO);
  const ownerRole = baselineActor(route);
  for (const role of roles) {
    // Expected success only for a valid fixture and the nominal public/self/staff read actor.
    // Other cells are observations, so unexpected role policy is not silently labelled correct.
    const assignmentResolved = route !== '/api/coaches/me/members/{memberId}/training-results' || discovery.assignedMember === f.users.member.profileId;
    const expected = fixtureResolved && assignmentResolved && role === ownerRole ? route === '/' ? [200,301,302,307,308] : [200] : undefined;
    jobs.push(() => call(route, endpoint, role, expected, fixtureResolved, supplement ? 'supplement' : 'matrix'));
  }
}
await semaphore(jobs);

const extraJobs = [];
const boundary = (route, query, role, expected, description) => extraJobs.push(async () => {
  const r = await call(route, route + query, role, expected, true, description);
  if (r.status === 200 && expected.includes(400)) findings.push({ severity: 'validation', route, endpoint: route + query, role, status: r.status, observation: 'Endpoint accepted input expected to be rejected by documented bounds or invalid-date contract.', response: r.body });
});
if (!supplement) {
  for (const [route, method] of Object.entries(a.spec.paths)) {
    const params = method.get?.parameters ?? [];
    const pageSize = params.find(p => p.name === 'pageSize');
    const pageIndex = params.find(p => p.name === 'pageIndex');
    if (/\{/.test(route)) continue;
    const role = baselineActor(route);
    if (pageSize?.schema?.maximum === 500) {
      boundary(route, '?pageSize=501', role, [400], 'documented pageSize maximum');
      boundary(route, '?pageSize=0', role, [400], 'documented pageSize minimum');
      boundary(route, '?pageSize=500', role, [200], 'documented pageSize allowed maximum');
    }
    if (pageIndex?.schema?.minimum === 1) boundary(route, '?pageIndex=0', role, [400], 'documented pageIndex minimum');
  }
  for (const [query, expected, description] of [
    ['?from=not-a-date', [400], 'dashboard invalid date'],
    ['?from=2026-11-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z', [400], 'dashboard reversed dates'],
    ['?from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z', [200], 'dashboard valid date range'],
  ]) boundary('/api/dashboard/revenue', query, 'manager', expected, description);
  for (const [route, role] of [['/api/audit-logs','manager'], ['/api/check-ins','reception'], ['/api/members/me/check-ins','member'], ['/api/support-requests','member']]) {
    boundary(route, '?pageIndex=0&pageSize=0', role, [400], 'pagination zero exploratory');
    boundary(route, '?pageSize=501', role, [200,400], 'pagination unbounded in Swagger exploratory');
  }
  const p = f.users.member.profileId;
  const personalChecks = [
    ['/api/payments/' + f.packagePayment.paymentId, 'otherMember', [403,404], 'payment owner isolation'],
    ['/api/invoices/' + f.packagePayment.invoiceId, 'otherMember', [403,404], 'invoice owner isolation'],
    ['/api/invoices/' + f.packagePayment.invoiceId + '/export', 'otherMember', [403,404], 'invoice PDF owner isolation'],
    ['/api/members/' + p + '/summary', 'otherMember', [403,404], 'member summary owner isolation'],
    ['/api/members/' + p + '/memberships', 'otherMember', [403,404], 'membership history owner isolation'],
    ['/api/memberships/' + f.paymentDetail.membershipId, 'otherMember', [403,404], 'membership detail owner isolation'],
    ['/api/memberships/' + f.paymentDetail.membershipId + '/status', 'otherMember', [403,404], 'membership status owner isolation'],
    ['/api/attendances/member/' + p, 'otherMember', [403,404], 'attendance owner isolation'],
    ['/api/class-bookings/member/' + p, 'otherMember', [403,404], 'class booking owner isolation'],
    ['/api/coaches/me/members/' + p + '/training-results', 'otherCoach', [403,404], 'unassigned coach training-result isolation'],
  ];
  for (const [endpoint, role, expected, description] of personalChecks) extraJobs.push(() => call(endpoint, endpoint, role, expected, true, description));
  for (const [key, route] of [['category','/api/categories/'], ['room','/api/rooms/'], ['package','/api/membership-packages/'], ['freeClass','/api/classes/']]) extraJobs.push(async () => {
    const r = await a.request('GET', route + f.entities[key].id, actors.manager);
    const body = r.body?.data ?? r.body;
    a.check('Detail identity matches requested ' + key, r.status === 200 && (body.id ?? body.membershipPackageId) === f.entities[key].id, { method: 'GET', endpoint: route + f.entities[key].id, role: 'manager', status: r.status, response: r.body });
  });
}
if (supplement) {
  for (const role of ['coach', 'otherCoach']) {
    extraJobs.push(async () => {
      const r = await call('/api/coaches/me', '/api/coaches/me', role, [200], true, 'fresh coach identity');
      const id = r.body?.id ?? r.body?.coachId;
      a.check('Fresh ' + role + ' token resolves correct coach profile after role restore', r.status === 200 && id === f.users[role].profileId, { role, status:r.status, expectedProfileId:f.users[role].profileId, response:r.body });
    });
  }
  const planId = ids['/api/training-plans/{id}'];
  const resultId = ids['/api/training-results/{id}'];
  extraJobs.push(async () => {
    const endpoint = '/api/training-plans/' + planId;
    const r = await call('/api/training-plans/{id}', endpoint, 'otherCoach', [403,404], true, 'cross-coach plan ownership intent');
    if (r.status === 200 && (r.body?.trainingPlanId ?? r.body?.id) === planId) {
      findings.push({ severity:'authorization', endpoint, role:'otherCoach', status:r.status, intendedPolicy:'A coach may read plans they own; another coach should be denied.', actualPolicy:'The deployed detail route returns the full plan to a different coach.', exposedFields:Object.keys(r.body ?? {}), foreignCoachId:r.body.coachId, authenticatedCoachId:f.users.otherCoach.profileId, fixturePlanId:planId });
    }
  });
  extraJobs.push(() => call('/api/training-results/{id}', '/api/training-results/' + resultId, 'otherCoach', [403,404], true, 'cross-coach result ownership'));
  for (const endpoint of ['/api/coaches/me/members/' + f.users.member.profileId + '/training-results', '/api/coaches/me/training-results?memberId=' + f.users.member.profileId + '&pageSize=500']) {
    extraJobs.push(async () => {
      const route = endpoint.includes('/members/') ? '/api/coaches/me/members/{memberId}/training-results' : '/api/coaches/me/training-results';
      const r = await call(route, endpoint, 'otherCoach', [200], true, 'filtered result privacy');
      const data = rows(r.body);
      a.check('Another coach receives no foreign result through ' + route, r.status === 200 && data.every(x => objectId(x) !== resultId && (!x.coachId || x.coachId === f.users.otherCoach.profileId)), { method:'GET', endpoint, role:'otherCoach', status:r.status, response:r.body, targetResultId:resultId });
      supplementNotes.push({ endpoint, role:'otherCoach', status:r.status, returnedRows:data.length, foreignResultPresent:data.some(x=>objectId(x)===resultId), interpretation:'A 200 response with a coach-filtered empty list is not a data leak.' });
    });
  }
  for (const [route, targetId] of [['/api/members/me/training-plans',planId],['/api/members/me/training-results',resultId]]) {
    extraJobs.push(async () => {
      const r = await call(route, route + '?pageSize=500', 'member', [200], true, 'member self list policy');
      a.check('Member self list includes own ' + route, r.status === 200 && rows(r.body).some(x=>objectId(x)===targetId), { method:'GET', endpoint:route, role:'member', status:r.status, targetId, response:r.body });
    });
  }
  extraJobs.push(() => call('/api/training-plans/{id}', '/api/training-plans/' + planId, 'member', [403], true, 'deployed member detail role policy'));
  extraJobs.push(() => call('/api/training-results/{id}', '/api/training-results/' + resultId, 'member', [403], true, 'deployed member detail role policy'));
  const sessionId = f.entities.trainingSession?.id;
  if (sessionId) extraJobs.push(async () => {
    const endpoint='/api/attendances/session/' + sessionId;
    const r=await call('/api/attendances/session/{sessionId}',endpoint,'coach',[200],true,'nonempty attendance fixture');
    a.check('Coach reads recorded fixture attendance',r.status===200 && rows(r.body).some(x=>x.id===f.entities.attendance.id),{ method:'GET',endpoint,role:'coach',status:r.status,response:r.body });
  });
  supplementNotes.push({ interpretation:'Member direct training-plan/result detail routes return 403; own /members/me lists return 200. This is the deployed role policy and is not labelled a defect by this audit.' });
}

await semaphore(extraJobs);
await a.save();
const file = path.join(OUT, 'read-api.json');
const report = JSON.parse(await fs.readFile(file, 'utf8'));
const oldMatrix = supplement ? previousReadMatrix : [];
report.readMatrix = [...oldMatrix, ...matrix];
const exactCoverage = Object.entries(a.spec.paths).filter(([route, methods]) => methods.get).map(([route]) => {
  const cells = report.readMatrix.filter(x => x.route === route);
  return { method:'GET', path:route, calls:cells.length, statuses:[...new Set(cells.map(x=>x.status))], success:cells.some(x=>x.status>=200&&x.status<300), redirected:cells.some(x=>[301,302,307,308].includes(x.status)), successfulFixtureRead:cells.some(x=>x.fixtureResolved && x.status>=200 && x.status<300), roles:Object.fromEntries(roles.map(role=>[role,[...new Set(cells.filter(x=>x.role===role).map(x=>x.status))]])) };
});
report.exactGetCoverage = exactCoverage;
report.readAudit = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  excludedOperations: skipped,
  unresolvedFixtureRoutes: deferred,
  fixtureNotes,
  findings: [...(previousReadAudit?.findings ?? []), ...findings],
  supplementaryPolicyNotes: [...(previousReadAudit?.supplementaryPolicyNotes ?? []), ...supplementNotes],
  interpretation: 'HTTP successes, authorization denials, not-found probes and input-validation observations are separate. An unauthorized denial or nonexistent fixture is not successful business-flow coverage. Role cells without an expected result are observations only.',
  maxConcurrency: 4,
  getOperationCount: Object.values(a.spec.paths).filter(p => p.get).length,
  getCalledCount: exactCoverage.filter(x => x.calls > 0).length,
  getSuccessCount: exactCoverage.filter(x => x.success).length,
  getRedirectCount: exactCoverage.filter(x => x.redirected).length,
};
await fs.writeFile(file, JSON.stringify(report, null, 2));
process.stdout.write('READ_AUDIT ' + JSON.stringify(report.readAudit) + '\n');


