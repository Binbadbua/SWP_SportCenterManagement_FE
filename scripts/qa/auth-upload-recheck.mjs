// Recheck controlled auth/upload failures; no accounts, mail recipients or media created.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT } from './api-audit.mjs';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(ROOT, 'artifacts/be-recheck-2026-11-02/auth-upload', run);
const a = new Audit('auth-upload-recheck');
const email = 'missing-' + run.toLowerCase() + '@example.invalid';
const summary = { startedAt: new Date().toISOString(), baseUrl: BASE, scope: 'No persisted QA accounts/entities, no real-user reset/mail request, no successful media upload intended. Uses a unique nonexistent @example.invalid address.' };
const notes = [];
await fs.mkdir(out, { recursive: true });
const probe = async (name, endpoint, actor, body, expected, predicate) => {
 const r = await a.request('POST', endpoint, actor, body, { timeout: 55000 });
 a.check(name, expected.includes(r.status) && (!predicate || predicate(r.body)), { endpoint, status: r.status, ms: r.ms, response: r.body, error: r.error });
 return r;
};
try {
 const spec = await a.request('GET', '/swagger/v1/swagger.json', null, undefined, { timeout: 55000 });
 if(spec.status !== 200)throw new Error('Cannot read live Swagger: HTTP ' + spec.status);
 await fs.writeFile(path.join(out, 'swagger.json'), JSON.stringify(spec.body, null, 2));
 a.calls.at(-1).body = '[saved separately as swagger.json]';
 const schemaFor = endpoint => {
   const content = spec.body.paths[endpoint]?.post?.requestBody?.content;
   const schema = content?.['application/json']?.schema;
   return schema?.$ref ? spec.body.components?.schemas[schema.$ref.split('/').at(-1)] : schema;
 };
 notes.push({ authRequestSchemas: { forgotPassword: schemaFor('/api/auth/forgot-password'), resetPassword: schemaFor('/api/auth/reset-password') } });
 await probe('B63 forgot-password nonexistent address is controlled', '/api/auth/forgot-password', null, { email }, [200,202,204,400,404,429]);
 await probe('B63 reset-password invalid OTP/nonexistent address is controlled', '/api/auth/reset-password', null, { email, otp: '000000', newPassword: 'AuditOnly@November2' }, [400,404,409,429]);
 await probe('Forgot-password missing email validates', '/api/auth/forgot-password', null, {}, [400]);
 await probe('Forgot-password malformed email validates', '/api/auth/forgot-password', null, { email: 'not-an-email' }, [400]);
 await probe('Reset-password empty request validates', '/api/auth/reset-password', null, {}, [400]);
 const manager = await a.login('demo_manager', '123456', 'Manager');
 const invalid = new FormData(); invalid.append('file', new Blob(['This is deliberately plain text, never a real image.'], { type: 'text/plain' }), 'recheck-invalid.txt');
 const bad = await probe('B64 invalid upload type is controlled', '/api/media/images', manager, invalid, [400,415]);
 if(bad.status >= 200 && bad.status < 300)notes.push('Unexpected upload acceptance; inspect reported URL before claiming no persisted media.');
 const oversized = new FormData();
 const bytes = Buffer.alloc(6 * 1024 * 1024);
 Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq1kAAAAASUVORK5CYII=', 'base64').copy(bytes);
 oversized.append('file', new Blob([bytes], { type: 'image/png' }), 'recheck-oversized.png');
 const large = await probe('B64 6MiB upload is controlled JSON validation', '/api/media/images', manager, oversized, [400,413], b => typeof b === 'object' && b !== null);
 if(large.status >= 200 && large.status < 300)notes.push('Unexpected oversized upload acceptance; inspect reported URL before claiming no persisted media.');
 summary.status = 'completed';
} catch (error) { summary.status = 'interrupted'; summary.error = String(error); }
Object.assign(summary, { finishedAt: new Date().toISOString(), checks: a.results.length, passed: a.results.filter(x => x.passed).length, failed: a.results.filter(x => !x.passed).length, requests: a.calls.length });
notes.push('Controlled negative responses do not establish delivery of email/OTP or successful real-user password reset. No credentials/tokens retained in report.');
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ summary, results: a.results, calls: a.calls, notes }, null, 2));
console.log(JSON.stringify({ summary, results: a.results, notes, reportFile: path.join(out, 'report.json') }, null, 2));
if(summary.status !== 'completed' || summary.failed)process.exitCode=1;