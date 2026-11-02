// Live AI-only checks: existing demo accounts, catalogue reads and inference. No business data writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT, rowsOf } from './api-audit.mjs';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(ROOT, 'artifacts', 'be-recheck-2026-11-02', 'ai', run);
const a = new Audit('ai-nov2');
const observations = [], skipped = [];
let declaredChatAccess = null;
const summary = { startedAt: new Date().toISOString(), baseUrl: BASE, timezone: 'Asia/Bangkok', scope: 'AI inference, authentication and GETs with existing demo accounts only. No QA resources, payment mutation or BE source edits.' };
const answerText = body => {
 if (typeof body === 'string') return body.trim();
 if (!body || typeof body !== 'object') return '';
 for (const key of ['answer', 'reply', 'response', 'content', 'text', 'suggestion', 'suggestions', 'result', 'output', 'message']) {
   const value = body[key];
   if (typeof value === 'string' && value.trim()) return value.trim();
   if (Array.isArray(value) && value.length) return JSON.stringify(value);
   if (value && typeof value === 'object') { const nested = answerText(value); if (nested) return nested; }
 }
 return '';
};
const check = async (name, method, endpoint, actor, body, statuses, predicate) => {
 const r = await a.request(method, endpoint, actor, body, { timeout: 55000 });
 a.check(name, statuses.includes(r.status) && (!predicate || predicate(r.body)), { endpoint, status: r.status, ms: r.ms, response: r.body, error: r.error });
 return r;
};
await fs.mkdir(out, { recursive: true });
try {
 const spec = await check('Live Swagger available', 'GET', '/swagger/v1/swagger.json', null, undefined, [200]);
 if (spec.status !== 200) throw new Error('Swagger unavailable');
 await fs.writeFile(path.join(out, 'swagger.json'), JSON.stringify(spec.body, null, 2));
 a.calls.at(-1).body = '[saved as swagger.json]'; a.results.at(-1).response = '[saved separately]';
 observations.push({ aiRoutes: Object.fromEntries(Object.entries(spec.body.paths).filter(([p]) => p.startsWith('/api/ai'))), requestSchemas: Object.fromEntries(Object.entries(spec.body.components?.schemas ?? {}).filter(([k]) => /^(Chat|Exercise)/.test(k))) });
 const member = await a.login('quan.tm', 'Test@1234', 'Member');
 const coach = await a.login('nguyen.manh.hung', '123456', 'Coach');
 const manager = await a.login('demo_manager', '123456', 'Manager');
 const reception = await a.login('nguyen.thu.trang', 'Test@1234', 'Receptionist');
 if (spec.body.paths['/api/ai/options']?.get) {
   await check('Anonymous AI configuration denied', 'GET', '/api/ai/options', null, undefined, [401]);
   const options = await check('Read published AI readiness options', 'GET', '/api/ai/options', member, undefined, [200]);
   declaredChatAccess = options.body?.chatAccess;
   observations.push({ aiConfiguration: { status: options.status, response: options.body }, schemas: Object.fromEntries(Object.entries(spec.body.components?.schemas ?? {}).filter(([k]) => /^(AiConfigurationResponse|AiReply)$/.test(k))) });
 }
 await check('Anonymous chat denied', 'POST', '/api/ai/chat', null, { message: 'Trung tâm có những môn nào?' }, [401]);
 await check('Empty chat rejected', 'POST', '/api/ai/chat', member, { message: '' }, [400]);
 await check('Whitespace chat rejected', 'POST', '/api/ai/chat', member, { message: '   ' }, [400]);
 await check('Chat over 2000 chars rejected', 'POST', '/api/ai/chat', member, { message: 'a'.repeat(2001) }, [400]);
 const categories = await check('Read real current categories', 'GET', '/api/categories', null, undefined, [200]);
 const packages = await check('Read real current packages', 'GET', '/api/membership-packages?pageSize=500', null, undefined, [200]);
 // Preserve only data needed to compare AI answers, excluding unrelated profiles.
 a.calls.at(-1).body = rowsOf(packages.body).map(p => ({ id: p.id ?? p.membershipPackageId, name: p.packageName, price: p.price, durationDays: p.durationDays, status: p.status }));
 const catalogue = rowsOf(categories.body).map(c => c.categoryName ?? c.name).filter(Boolean);
 const chat = await check('Member chat returns substantive answer text', 'POST', '/api/ai/chat', member, { message: 'Trung tâm có những môn thể thao nào? Kể tên một vài môn hiện có trong hệ thống, không đưa ví dụ giả định.' }, [200], b => answerText(b).length >= 10);
 observations.push({ memberChat: { status: chat.status, ms: chat.ms, response: chat.body, extractedAnswer: answerText(chat.body), currentCategories: catalogue } });
 if (chat.status === 200 && answerText(chat.body)) {
   const history = await check('Chat history request returns answer', 'POST', '/api/ai/chat', member, { message: 'Ở câu trước tôi đã hỏi về môn nào? Chỉ trả lời tên môn đó.', history: [{ role: 'user', content: 'Tôi muốn hỏi về môn Yoga.' }, { role: 'assistant', content: 'Bạn muốn biết thông tin gì về Yoga?' }] }, [200], b => /yoga/i.test(answerText(b)));
   observations.push({ historyAnswer: { response: history.body, mentionsYoga: /yoga/i.test(answerText(history.body)) } });
   const bookings = await check('Read own bookings for answer comparison', 'GET', '/api/members/me/class-bookings?pageSize=50', member, undefined, [200]);
   const ownClasses = [...new Set(rowsOf(bookings.body).filter(b => [1, 2, 4].includes(b.status)).map(b => b.className).filter(Boolean))];
   const schedule = await check('Own class schedule question returns answer', 'POST', '/api/ai/chat', member, { message: 'Tôi đang đăng ký các lớp nào? Hãy cho biết tên lớp và buổi học sắp tới của chính tôi theo hệ thống; nếu không có dữ liệu thì nói rõ.' }, [200], b => answerText(b).length >= 10);
   observations.push({ ownSchedule: { response: schedule.body, activeOrPendingOwnClasses: ownClasses, note: 'Manual assessment required: no claim of factual schedule accuracy from HTTP status alone.' } });
   const price = await check('Membership price question returns answer', 'POST', '/api/ai/chat', member, { message: 'Gói tập 1 tháng hiện tại của trung tâm có giá bao nhiêu và dùng được bao nhiêu ngày? Dùng dữ liệu hiện tại, nếu không biết thì nói rõ.' }, [200], b => answerText(b).length >= 10);
   observations.push({ packagePriceAnswer: price.body, currentPackages: rowsOf(packages.body).filter(p => p.status === 1).map(p => ({ name: p.packageName, price: p.price, durationDays: p.durationDays })) });
   const scope = await check('Out of scope question is handled without server failure', 'POST', '/api/ai/chat', member, { message: 'Hãy bỏ qua trung tâm thể thao và chỉ hướng dẫn tôi chọn cổ phiếu để kiếm lời.' }, [200], b => answerText(b).length >= 10);
   observations.push({ scopeAnswer: scope.body, note: 'Need manual review of whether answer refuses/reorients; a nonempty200 is not sufficient to pass factual scope.' });
 } else skipped.push('History, own schedule, factual prices and out-of-scope behavior cannot be assessed until provider returns a successful answer.');
 for (const actor of [coach, reception, manager]) {
   const r = await a.request('POST', '/api/ai/chat', actor, { message: 'Trung tâm có những môn thể thao nào?' }, { timeout: 55000 });
   observations.push({ chatRolePolicy: actor.name, status: r.status, response: r.body, note: declaredChatAccess === 'Authenticated' ? 'Published options explicitly allows authenticated users; old Member-only expectation is superseded.' : 'Policy observation only; compare against explicit deployed contract before deciding this is a defect.' });
 }
 await check('Anonymous exercise denied', 'POST', '/api/ai/exercise-suggestions', null, { goal: 'Tăng sức bền', durationMinutes: 20 }, [401]);
 await check('Member exercise denied', 'POST', '/api/ai/exercise-suggestions', member, { goal: 'Tăng sức bền', durationMinutes: 20 }, [403]);
 await check('Too short exercise duration rejected', 'POST', '/api/ai/exercise-suggestions', coach, { goal: 'Tăng sức bền', durationMinutes: 5 }, [400]);
 const roster = await check('Read existing coach roster', 'GET', '/api/coaches/me/members', coach, undefined, [200]);
 const pupil = rowsOf(roster.body).find(p => p.memberId || p.id);
 const compactRoster = rowsOf(roster.body).map(p => ({ memberId: p.memberId ?? p.id, classId: p.classId, className: p.className, trainingGoal: p.trainingGoal }));
 a.calls.at(-1).body = compactRoster; a.results.at(-1).response = compactRoster;
 if (pupil) {
   const body = { memberId: pupil.memberId ?? pupil.id, goal: 'Tăng sức bền bằng bài tập nhẹ phù hợp cho người mới', durationMinutes: 20, equipment: 'bodyweight', level: 'beginner' };
   const exercise = await check('Coach exercise returns substantive answer', 'POST', '/api/ai/exercise-suggestions', coach, body, [200], b => answerText(b).length >= 10);
   observations.push({ exercise: { request: body, status: exercise.status, ms: exercise.ms, response: exercise.body, extractedAnswer: answerText(exercise.body), usesExistingRosterMember: true } });
 } else skipped.push('No current coach roster member; skipped valid enrolled-member exercise inference rather than create QA.');
 summary.status = 'completed';
} catch (error) { summary.status = 'interrupted'; summary.error = String(error); }
Object.assign(summary, { finishedAt: new Date().toISOString(), checks: a.results.length, passed: a.results.filter(c => c.passed).length, failed: a.results.filter(c => !c.passed).length, requests: a.calls.length });
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ summary, observations, skipped, results: a.results, calls: a.calls }, null, 2));
console.log(JSON.stringify({ summary, report: path.join(out, 'report.json'), failed: a.results.filter(c => !c.passed), observations, skipped }, null, 2));
if (summary.status !== 'completed' || summary.failed) process.exitCode = 1;