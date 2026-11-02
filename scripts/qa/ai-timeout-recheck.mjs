// Bounded live diagnosis: at most one chat and one exercise request, sequentially.
// Existing accounts/roster only. No load generation or business/financial writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT, rowsOf } from './api-audit.mjs';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(ROOT, 'artifacts', 'ai-concurrency-review-2026-11-03', run);
const audit = new Audit('ai-timeout');
const summary = {startedAt:new Date().toISOString(),baseUrl:BASE,status:'running',scope:'Maximum two sequential inference calls; existing accounts and GETs only. No load test, QA creation, financial mutation or BE edits.'};
await fs.mkdir(out, {recursive:true});
const save = async () => fs.writeFile(path.join(out,'report.json'), JSON.stringify({summary,checks:audit.results,calls:audit.calls},null,2));
const replyOf = body => {
 const data=body?.data ?? body;
 return typeof data?.reply === 'string' ? data.reply.trim() : typeof data?.suggestions === 'string' ? data.suggestions.trim() : '';
};
try {
 const member=await audit.login('quan.tm','Test@1234','Member');
 const options=await audit.request('GET','/api/ai/options',member);
 summary.options={status:options.status,ms:options.ms,body:options.body};
 audit.check('AI options available', options.status===200, summary.options);
 await save();
 const chat=await audit.request('POST','/api/ai/chat',member,{message:'Xin chào! Bạn hỗ trợ gì tại SportCenter?',history:[]},{timeout:55000});
 summary.chat={status:chat.status,ms:chat.ms,body:chat.body,error:chat.error,hasReply:!!replyOf(chat.body)};
 audit.check('Member chat returns a real reply',chat.status===200&&replyOf(chat.body).length>0,summary.chat);
 await save();
 const coach=await audit.login('nguyen.manh.hung','123456','Coach');
 const roster=await audit.request('GET','/api/coaches/me/members',coach);
 const pupil=rowsOf(roster.body).find(row=>row.memberId||row.id);
 // Do not retain unrelated roster/profile details in the diagnosis artifact.
 audit.calls.at(-1).body={status:roster.status,rowCount:rowsOf(roster.body).length,validPupilFound:!!pupil};
 if(roster.status===200&&pupil){
  const exercise=await audit.request('POST','/api/ai/exercise-suggestions',coach,{memberId:pupil.memberId??pupil.id,goal:'Tăng sức bền bằng bài tập nhẹ phù hợp cho người mới',durationMinutes:20,equipment:'bodyweight',level:'beginner'},{timeout:55000});
  summary.exercise={status:exercise.status,ms:exercise.ms,body:exercise.body,error:exercise.error,hasReply:!!replyOf(exercise.body)};
  audit.check('Coach exercise returns a real reply',exercise.status===200&&replyOf(exercise.body).length>0,summary.exercise);
 }else summary.exercise={skipped:true,reason:'No current authorized roster member; no test records created.'};
 summary.status='completed';
}catch(error){summary.status='interrupted';summary.error=String(error);}
Object.assign(summary,{finishedAt:new Date().toISOString(),requests:audit.calls.length,checks:audit.results.length,passed:audit.results.filter(c=>c.passed).length,failed:audit.results.filter(c=>!c.passed).length,inferenceRequests:audit.calls.filter(c=>c.method==='POST'&&c.endpoint.startsWith('/api/ai/')).length});
await save();
console.log(JSON.stringify({summary,report:path.join(out,'report.json')},null,2));
if(summary.status!=='completed'||summary.failed)process.exitCode=1;
