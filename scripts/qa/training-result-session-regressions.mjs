// Exercise the actual staff resource configuration with in-memory API responses only.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const results = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network is forbidden in this regression test.'); };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const test = async (name, fn) => {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
};
try {
  const { resources } = await server.ssrLoadModule('/src/pages/staff/resources.jsx');
  const { api } = await server.ssrLoadModule('/src/api/endpoints.js');
  const config = resources.trainingResults;
  const coach = { role: 'Coach', coachId: 'coach-test' };
  const plan = { id: 'plan-test', memberId: 'member-test', classId: 'class-test', title: 'Kế hoạch mô phỏng' };
  const morning = { id: 'session-am', classId: plan.classId, date: '2026-11-01T00:00:00Z', startTime: '08:00:00', endTime: '09:00:00' };
  const evening = { ...morning, id: 'session-pm', startTime: '18:00:00', endTime: '19:00:00' };
  const baseResult = { id: 'result-test', planId: plan.id, memberId: plan.memberId, evaluationDate: morning.date, performanceScore: 8 };
  let resultRows = [], sessionRows = [], planRows = [plan], scheduleError = false;
  api.trainingResults.forCoach = async () => resultRows;
  api.trainingPlans.forCoach = async () => planRows;
  api.coaches.members = async () => [{ memberId: plan.memberId, fullName: 'Học viên mô phỏng' }];
  api.coaches.classes = async () => [{ classId: plan.classId, className: 'Lớp mô phỏng' }];
  api.schedules.forCoach = async () => { if (scheduleError) throw new Error('Simulated unavailable schedule'); return sessionRows; };
  const list = async (result, sessions, plans = [plan]) => {
    resultRows = [result]; sessionRows = sessions; planRows = plans;
    const rows = await config.source(coach).list();
    assert.equal(rows.length, 1);
    return rows[0];
  };
  await test('API sessionId selects the correct one of two sessions on the same day', async () => {
    const row = await list({ ...baseResult, sessionId: evening.id }, [morning, evening]);
    assert.equal(row.sessionId, evening.id);
    assert.match(row.sessionText, /18:00/);
    assert.doesNotMatch(row.sessionText, /08:00/);
  });
  await test('Unavailable linked session is retained without guessing another session', async () => {
    const row = await list({ ...baseResult, sessionId: 'session-not-loaded' }, [morning]);
    assert.equal(row.sessionId, 'session-not-loaded');
    assert.equal(row.sessionText, '');
  });
  await test('An explicit API session link works even when its plan is not loaded', async () => {
    const row = await list({ ...baseResult, sessionId: evening.id }, [morning, evening], []);
    assert.equal(row.sessionId, evening.id);
    assert.match(row.sessionText, /18:00/);
  });
  await test('Legacy result infers a session only from a unique class and day', async () => {
    const row = await list({ ...baseResult, sessionId: null }, [morning, { ...morning, id: 'other-class-session', classId: 'other-class' }]);
    assert.equal(row.sessionId, morning.id);
    assert.match(row.sessionText, /08:00/);
  });
  await test('Legacy result with two matching sessions stays unlinked', async () => {
    const row = await list(baseResult, [morning, evening]);
    assert.equal(row.sessionId, '');
    assert.equal(row.sessionText, '');
  });
  await test('Legacy result without a loaded plan does not guess a session', async () => {
    const row = await list(baseResult, [morning], []);
    assert.equal(row.sessionId, '');
    assert.equal(row.sessionText, '');
  });
  await test('A failed schedule lookup cannot erase the API sessionId', async () => {
    scheduleError = true;
    try {
      const row = await list({ ...baseResult, sessionId: evening.id }, [morning, evening]);
      assert.equal(row.sessionId, evening.id);
      assert.equal(row.sessionText, '');
    } finally { scheduleError = false; }
  });
  const form = { planId: plan.id, sessionId: evening.id, performanceScore: 8, coachComment: 'Kết quả mô phỏng', evaluationDate: '2026-11-01' };
  await test('Create and update mapping sends the selected sessionId and the plan member', async () => {
    const body = config.toRequest(form, { lookups: { plans: [plan] } });
    assert.equal(body.sessionId, evening.id);
    assert.equal(body.memberId, plan.memberId);
    assert.equal(body.evaluationDate, '2026-11-01T00:00:00Z');
    const calls = [];
    api.trainingResults.create = async payload => { calls.push({ method: 'create', payload }); return payload; };
    api.trainingResults.update = async (id, payload) => { calls.push({ method: 'update', id, payload }); return payload; };
    await config.source(coach).create(body);
    await config.source(coach).update(baseResult.id, body);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.payload.sessionId, evening.id);
      assert.equal(call.payload.coachId, coach.coachId);
    }
    assert.equal(calls[1].id, baseResult.id);
  });
  await test('Clearing an optional session sends null rather than an invalid empty UUID', async () => {
    const body = config.toRequest({ ...form, sessionId: '' }, { lookups: { plans: [plan] } });
    assert.equal(body.sessionId, null);
  });
} finally {
  await server.close();
  globalThis.fetch = originalFetch;
}
for (const result of results) console.log((result.passed ? 'PASS ' : 'FAIL ') + result.name + (result.error ? ': ' + result.error : ''));
const summary = { checks: results.length, passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, mode: 'Actual Vite-loaded resource config; in-memory API mocks; no network or business data writes.' };
console.log('SUMMARY ' + JSON.stringify(summary));
if (summary.failed) process.exitCode = 1;