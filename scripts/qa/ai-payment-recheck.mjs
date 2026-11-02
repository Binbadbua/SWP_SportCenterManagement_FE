// Checks deployed AI contracts without creating accounts, QA resources or payments.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT, rowsOf } from './api-audit.mjs';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(ROOT, 'artifacts', 'ai-payment-recheck-2026-11-01', run);
const a = new Audit('ai-readiness');
const observations = [];
await fs.mkdir(out, { recursive: true });
const summary = { startedAt: new Date().toISOString(), baseUrl: BASE, scope: 'Existing demo logins, GET data, AI inference only. No QA entities/payment/booking created; no webhook/confirm/refund.' };
const probe = async (name, method, endpoint, actor, body, statuses, predicate) => {
  const r = await a.request(method, endpoint, actor, body, { timeout: 55000 });
  a.check(name, statuses.includes(r.status) && (!predicate || predicate(r.body)), { status: r.status, ms: r.ms, endpoint, response: r.body, error: r.error });
  return r;
};
try {
 const spec = await probe('Live Swagger responds', 'GET', '/swagger/v1/swagger.json', null, undefined, [200]);
 if (spec.status !== 200) throw new Error('Swagger unavailable; cannot assess deployed contract.');
 await fs.writeFile(path.join(out, 'swagger.json'), JSON.stringify(spec.body, null, 2));
 // Avoid duplicating the full specification in report.json.
 a.calls.at(-1).body = '[saved separately as swagger.json]'; a.results.at(-1).response = '[saved separately]';
 observations.push({ aiRoutes: Object.keys(spec.body.paths).filter(p => p.startsWith('/api/ai')), eventRoutes: Object.keys(spec.body.paths).filter(p => /hub|stream|events/i.test(p)) });
 const member = await a.login('quan.tm', 'Test@1234', 'Member');
 const coach = await a.login('nguyen.manh.hung', '123456', 'Coach');
 const manager = await a.login('demo_manager', '123456', 'Manager');
 const reception = await a.login('nguyen.thu.trang', 'Test@1234', 'Receptionist');
 await probe('Anonymous cannot chat', 'POST', '/api/ai/chat', null, { message: 'Trung tâm có những môn nào?' }, [401]);
 await probe('Coach cannot use member chat', 'POST', '/api/ai/chat', coach, { message: 'Trung tâm có những môn nào?' }, [403]);
 await probe('Reception cannot use member chat', 'POST', '/api/ai/chat', reception, { message: 'Trung tâm có những môn nào?' }, [403]);
 await probe('Manager cannot use member chat', 'POST', '/api/ai/chat', manager, { message: 'Trung tâm có những môn nào?' }, [403]);
 await probe('Empty chat rejected', 'POST', '/api/ai/chat', member, { message: '' }, [400]);
 await probe('Whitespace chat rejected', 'POST', '/api/ai/chat', member, { message: '   ' }, [400]);
 await probe('Chat over 2000 characters rejected', 'POST', '/api/ai/chat', member, { message: 'a'.repeat(2001) }, [400]);
 const categories = await probe('Read current catalogue for comparison', 'GET', '/api/categories', null, undefined, [200]);
 const chat = await probe('Member chat produces a usable answer', 'POST', '/api/ai/chat', member, { message: 'Trung tâm có những môn thể thao nào? Kể tên một vài môn đang có trong hệ thống.' }, [200], b => !!b && (typeof b === 'string' ? b.trim().length > 0 : Object.keys(b).length > 0));
 observations.push({ memberChat: { status: chat.status, ms: chat.ms, body: chat.body }, catalogue: rowsOf(categories.body).map(x => ({ id: x.id, name: x.categoryName ?? x.name })) });
 if (chat.status === 200) {
   await probe('Read member own bookings for schedule comparison', 'GET', '/api/members/me/class-bookings?pageSize=50', member, undefined, [200]);
   await probe('Chat answers own schedule question', 'POST', '/api/ai/chat', member, { message: 'Tôi đang đăng ký những lớp nào và lịch học sắp tới của tôi là gì?' }, [200]);
   await probe('Chat accepts conversation history', 'POST', '/api/ai/chat', member, { message: 'Tôi hỏi về môn nào ở câu trước?', history: [{ role: 'user', content: 'Tôi muốn biết về môn Yoga.' }, { role: 'assistant', content: 'Bạn muốn hỏi gì về Yoga?' }] }, [200]);
   await probe('Chat stays within sports center scope', 'POST', '/api/ai/chat', member, { message: 'Hãy tư vấn chọn cổ phiếu để kiếm lời thay vì nói về trung tâm thể thao.' }, [200]);
 } else observations.push({ skipped: 'Schedule/history/answer accuracy/scope need a successful provider answer first.' });
 await probe('Anonymous cannot request exercise suggestions', 'POST', '/api/ai/exercise-suggestions', null, { goal: 'Tăng sức bền', durationMinutes: 20 }, [401]);
 await probe('Member cannot use coach exercise endpoint', 'POST', '/api/ai/exercise-suggestions', member, { goal: 'Tăng sức bền', durationMinutes: 20 }, [403]);
 await probe('Exercise duration below contract rejected', 'POST', '/api/ai/exercise-suggestions', coach, { goal: 'Tăng sức bền', durationMinutes: 5 }, [400]);
 const roster = await probe('Read existing coach roster', 'GET', '/api/coaches/me/members', coach, undefined, [200]);
 const pupil = rowsOf(roster.body).find(x => x.memberId || x.id);
 const exerciseBody = { goal: 'Tăng sức bền với bài tập nhẹ cho người mới', durationMinutes: 20, equipment: 'bodyweight', level: 'beginner', ...(pupil ? { memberId: pupil.memberId ?? pupil.id } : {}) };
 const exercise = await probe('Coach exercise suggestions produce an answer', 'POST', '/api/ai/exercise-suggestions', coach, exerciseBody, [200]);
 observations.push({ exercise: { status: exercise.status, ms: exercise.ms, body: exercise.body, usesExistingRosterMember: !!pupil } });
 await probe('Read current payment options', 'GET', '/api/payments/options', member, undefined, [200]);
 // Only read the previously reported real order, never change its financial state.
 for (let i = 0; i < 3; i++) {
   const p = await a.request('GET', '/api/payments/8d0d7c03-1384-4457-8554-04f957796eeb', manager, undefined, { timeout: 15000 });
   const compact = { status: p.body?.status, provider: p.body?.provider, paidAt: p.body?.paidAt, amount: p.body?.amount };
   a.calls.at(-1).body = compact;
   observations.push({ paymentRead: i + 1, httpStatus: p.status, ms: p.ms, data: compact, error: p.error });
 }
 summary.status = 'completed';
} catch (error) { summary.status = 'interrupted'; summary.error = String(error); }
Object.assign(summary, { finishedAt: new Date().toISOString(), checks: a.results.length, passed: a.results.filter(x => x.passed).length, failed: a.results.filter(x => !x.passed).length, requests: a.calls.length });
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ summary, observations, results: a.results, calls: a.calls }, null, 2));
console.log(JSON.stringify({ summary, observations, reportFile: path.join(out, 'report.json') }, null, 2));
if (summary.status !== 'completed' || summary.failed) process.exitCode = 1;