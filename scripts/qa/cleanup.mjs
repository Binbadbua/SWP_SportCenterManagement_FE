import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, OUT, PASSWORD } from './api-audit.mjs';

const RUN = '261029163854', PREFIX = 'QA' + RUN;
const final = process.argv.includes('--final');
const phase = final ? 'final' : 'independent';
const f = JSON.parse(await fs.readFile(path.join(OUT, 'fixtures.json'), 'utf8'));
if (f.run !== RUN || f.prefix !== PREFIX) throw new Error('Cleanup is restricted to the explicitly authorized QA run.');
const a = new Audit('cleanup');
a.spec = JSON.parse(await fs.readFile(path.join(OUT, 'swagger.json'), 'utf8'));
let prior = null;
try { prior = JSON.parse(await fs.readFile(path.join(OUT, 'cleanup.json'), 'utf8')); } catch {}
if (prior) { a.calls = prior.calls ?? []; a.results = prior.results ?? []; a.checks = a.results.length; }
const steps = [...(prior?.cleanup?.steps ?? [])];
const preserved = [], constraints = [];
const rows = b => Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : Array.isArray(b?.items) ? b.items : Array.isArray(b?.data?.items) ? b.data.items : [];
const eid = k => f.entities[k]?.id;
const idOf = b => b?.id ?? b?.trainingPlanId ?? b?.trainingResultId ?? b?.membershipId ?? b?.membershipPackageId;
const starts = v => typeof v === 'string' && v.startsWith(PREFIX);
const contains = v => typeof v === 'string' && v.includes(PREFIX);
const accountIds = new Set(Object.values(f.users).map(x=>x.accountId));
const memberIds = new Set(['member','otherMember'].map(x=>f.users[x].profileId));
const coachIds = new Set(['coach','otherCoach'].map(x=>f.users[x].profileId));
const packageIds = new Set([eid('package'),eid('longPackage')]);
const R = {};
R.admin = await a.login('demo_manager', '123456', 'demo_manager_cleanup');
for (const key of Object.keys(f.users)) R[key] = await a.login(f.users[key].username, PASSWORD, key);
const roleByMember = id => id === f.users.member.profileId ? R.member : id === f.users.otherMember.profileId ? R.otherMember : null;
const roleByCoach = id => id === f.users.coach.profileId ? R.coach : id === f.users.otherCoach.profileId ? R.otherCoach : null;
const request = (endpoint, actor=R.admin) => a.request('GET',endpoint,actor);
async function list(endpoint,actor=R.admin) {
  const r=await request(endpoint,actor);
  if(r.status!==200) throw new Error('Cleanup inventory failed ' + endpoint + ' HTTP ' + r.status);
  return rows(r.body);
}
function note(kind,id,reason,detail={}) { constraints.push({kind,id,reason,...detail}); }
function hold(kind,id,reason) { preserved.push({kind,id,reason}); }
async function action(label,method,endpoint,actor,body,proof,verifyEndpoint) {
  if (!proof?.synthetic) throw new Error('Synthetic-record guard failed: ' + label);
  const r=await a.request(method,endpoint,actor,body);
  const ok=r.status>=200&&r.status<300;
  const outcome=ok ? method==='DELETE'&&endpoint.includes('/class-bookings/')?'cancelled':method==='DELETE'?'deleted':'updated' : [400,403,409].includes(r.status)?'retained-constraint':r.status===404?'already-absent':'error';
  const step={phase,label,method,endpoint,status:r.status,outcome,proof,response:r.body,error:r.error,at:new Date().toISOString()};
  steps.push(step);
  process.stdout.write('CLEANUP '+outcome+' '+label+' HTTP '+r.status+'\n');
  if(outcome==='retained-constraint'||outcome==='error') note(label,proof.id,'API refused the cleanup operation.',{status:r.status,response:r.body});
  if(ok&&verifyEndpoint) {
    const verified=await request(verifyEndpoint,actor);
    a.check('Deleted fixture is no longer readable: '+label,verified.status===404,{method:'GET',endpoint:verifyEndpoint,status:verified.status,response:verified.body,fixtureId:proof.id});
  }
  return {ok,r};
}
const classes=(await list('/api/classes')).filter(x=>starts(x.className));
const classIds=new Set(classes.map(idOf));
if(!classIds.has(eid('paidClass'))) throw new Error('Protected paidClass missing or not owned by this QA run.');
const protectedClassIds=new Set(final?[]:[eid('paidClass')]);
const selectedClasses=classes.filter(x=>!protectedClassIds.has(idOf(x)));
const selectedIds=new Set(selectedClasses.map(idOf));
const sessions=(await list('/api/class-sessions')).filter(x=>classIds.has(x.classId));
const bookings=[];
for(const who of ['member','otherMember']) for(const b of await list('/api/class-bookings/member/'+f.users[who].profileId,R.reception)) {
  if(memberIds.has(b.memberId)&&classIds.has(b.classId)&&starts(b.className)) bookings.push(b);
}
const plans=[];
for(const who of ['coach','otherCoach']) for(const p of await list('/api/coaches/me/training-plans?pageSize=500',R[who])) {
  if(starts(p.title)&&coachIds.has(p.coachId)&&memberIds.has(p.memberId)&&classIds.has(p.classId)) plans.push(p);
}
const planIds=new Set(plans.map(idOf));
const results=[];
for(const who of ['coach','otherCoach']) for(const r of await list('/api/coaches/me/training-results?pageSize=500',R[who])) {
  if(coachIds.has(r.coachId)&&memberIds.has(r.memberId)&&planIds.has(r.planId)) results.push(r);
}
const supports=(await list('/api/support-requests?pageSize=500',R.reception)).filter(x=>memberIds.has(x.memberId)&&starts(x.content));
const cards=[];
for(const who of ['member','otherMember']) for(const c of await list('/api/members/'+f.users[who].profileId+'/memberships?pageSize=500',R.reception)) {
  if(memberIds.has(c.memberId)&&packageIds.has(c.packageId)) cards.push(c);
}
const invoices=(await list('/api/invoices',R.reception)).filter(x=>starts(x.memberName)&&((x.classId&&classIds.has(x.classId))||packageIds.has(x.packageId)||starts(x.packageName)));
const inventoryBefore={phase,classes,sessions,bookings,plans,results,supports,cards,invoices};

for(const r of [...new Map(results.map(x=>[idOf(x),x])).values()]) {
  await action('training result '+idOf(r),'DELETE','/api/training-results/'+idOf(r),roleByCoach(r.coachId),undefined,{synthetic:true,id:idOf(r),memberId:r.memberId,coachId:r.coachId,planId:r.planId},'/api/training-results/'+idOf(r));
}
for(const p of [...new Map(plans.map(x=>[idOf(x),x])).values()]) {
  await action('training plan '+idOf(p),'DELETE','/api/training-plans/'+idOf(p),roleByCoach(p.coachId),undefined,{synthetic:true,id:idOf(p),title:p.title,memberId:p.memberId,coachId:p.coachId,classId:p.classId},'/api/training-plans/'+idOf(p));
}
for(const b of bookings) {
  if(protectedClassIds.has(b.classId)){ hold('booking',idOf(b),'paidClass preserved until UI completes');continue; }
  if(b.status===3){note('booking',idOf(b),'Cancelled booking history has no hard-delete route.',{classId:b.classId});continue;}
  await action('booking '+idOf(b),'DELETE','/api/class-bookings/'+idOf(b)+'/member/'+b.memberId,roleByMember(b.memberId),undefined,{synthetic:true,id:idOf(b),memberId:b.memberId,classId:b.classId,className:b.className});
}
for(const s of sessions) {
  if(protectedClassIds.has(s.classId)){hold('session',idOf(s),'paidClass preserved until UI completes');continue;}
  await action('class session '+idOf(s),'DELETE','/api/class-sessions/'+idOf(s),R.admin,undefined,{synthetic:true,id:idOf(s),classId:s.classId,className:s.className},'/api/class-sessions/'+idOf(s));
}
for(const c of selectedClasses) {
  await action('class '+idOf(c),'DELETE','/api/classes/'+idOf(c),R.admin,undefined,{synthetic:true,id:idOf(c),className:c.className},'/api/classes/'+idOf(c));
}
for(const s of supports) note('support request',idOf(s),'Swagger exposes GET/POST/PUT only; no DELETE route. Existing resolved history retained.',{status:s.status});
for(const who of Object.keys(f.users)) {
  const notices=await list('/api/notifications/me?pageSize=500',R[who]);
  for(const n of notices.filter(x=>starts(x.title)||contains(x.message))) {
    await action('notification '+idOf(n),'DELETE','/api/notifications/'+idOf(n),R[who],undefined,{synthetic:true,id:idOf(n),accountId:f.users[who].accountId,title:n.title});
  }
}
if(!final) {
  for(const [key,u]of Object.entries(f.users))hold('account '+key,u.accountId,'All fixture roles/logins preserved for UI.');
  hold('membership',eid('activeCard'),'Primary active card preserved for UI.');
  for(const c of cards)hold('membership',idOf(c),'Membership cleanup deferred until UI completes.');
  for(const inv of invoices)hold('invoice',idOf(inv),'Financial fixture cleanup deferred until UI completes.');
  hold('class',eid('paidClass'),'paidClass preserved until UI completes.');
  hold('room',eid('room'),'Referenced by protected paidClass session.');
  hold('category',eid('category'),'Referenced by protected paidClass.');
  for(const key of ['package','longPackage'])hold('package',eid(key),'Preserved for checkout/upgrade UI.');
} else {
  // The --final mode is only run after root explicitly confirms that UI has finished.
  for(const inv of invoices) {
    const payment=await request('/api/payments/'+idOf(inv),R.reception);
    const pd=payment.body;
    if(payment.status===200&&pd.status===1&&pd.provider==='SePay') {
      const membership=cards.find(x=>idOf(x)===pd.membershipId);
      const booking=bookings.find(x=>idOf(x)===pd.bookingId);
      const ownerId=membership?.memberId??booking?.memberId;
      const actor=roleByMember(ownerId);
      if(actor)await action('pending synthetic payment '+idOf(inv),'POST','/api/payments/'+idOf(inv)+'/cancel',actor,{}, {synthetic:true,id:idOf(inv),memberId:ownerId,packageName:inv.packageName,className:inv.className});
      else note('payment',idOf(inv),'Could not prove payment owner from fixture membership/booking; no mutation attempted.');
    }
  }
  for(const c of cards) {
    const current=await request('/api/memberships/'+idOf(c),R.reception);
    if(current.status===200&&[1,2].includes(current.body.status))await action('membership cancel '+idOf(c),'POST','/api/memberships/'+idOf(c)+'/cancel',R.reception,{}, {synthetic:true,id:idOf(c),memberId:c.memberId,packageId:c.packageId});
    await action('membership '+idOf(c),'DELETE','/api/memberships/'+idOf(c),R.reception,undefined,{synthetic:true,id:idOf(c),memberId:c.memberId,packageId:c.packageId},'/api/memberships/'+idOf(c));
  }
  for(const inv of invoices) {
    const current=await request('/api/invoices/'+idOf(inv),R.reception);
    if(current.status===404)continue;
    if(current.status!==200){note('invoice',idOf(inv),'Could not read current invoice status',{status:current.status});continue;}
    if([2,4].includes(current.body.status)){note('invoice',idOf(inv),'Paid/refunded invoice history is protected; no deletion or forced financial change attempted.',{status:current.body.status});continue;}
    await action('invoice '+idOf(inv),'DELETE','/api/invoices/'+idOf(inv),R.reception,undefined,{synthetic:true,id:idOf(inv),memberName:inv.memberName,packageName:inv.packageName,className:inv.className},'/api/invoices/'+idOf(inv));
  }
  for(const key of ['package','longPackage']) {
    const r=await request('/api/membership-packages/'+eid(key));
    if(r.status===200&&starts(r.body.packageName))await action('package '+key,'DELETE','/api/membership-packages/'+eid(key),R.admin,undefined,{synthetic:true,id:eid(key),packageName:r.body.packageName},'/api/membership-packages/'+eid(key));
  }
  for(const [key,u]of Object.entries(f.users)) {
    const collection=u.role===1?'members':u.role===2?'coaches':u.role===3?'receptionists':'center-managers';
    const current=await request('/api/'+collection+'/'+u.profileId);
    if(current.status===200&&starts(current.body.fullName))await action('profile '+key,'DELETE','/api/'+collection+'/'+u.profileId,R.admin,undefined,{synthetic:true,id:u.profileId,accountId:u.accountId,fullName:current.body.fullName},'/api/'+collection+'/'+u.profileId);
    const account=await request('/api/accounts/'+u.accountId);
    if(account.status===200&&accountIds.has(u.accountId)&&account.body.username?.startsWith('qa_'+RUN+'_'))await action('account '+key,'DELETE','/api/accounts/'+u.accountId,R.admin,undefined,{synthetic:true,id:u.accountId,username:account.body.username},'/api/accounts/'+u.accountId);
  }
}
const rooms=await list('/api/rooms');
for(const key of final?['room','unavailableRoom']:['unavailableRoom']) {
  const room=rooms.find(x=>idOf(x)===eid(key));
  if(room&&starts(room.roomName))await action('room '+key,'DELETE','/api/rooms/'+eid(key),R.admin,undefined,{synthetic:true,id:eid(key),roomName:room.roomName},'/api/rooms/'+eid(key));
}
if(final) {
  const category=await request('/api/categories/'+eid('category'));
  if(category.status===200&&starts(category.body.categoryName))await action('category','DELETE','/api/categories/'+eid('category'),R.admin,undefined,{synthetic:true,id:eid('category'),categoryName:category.body.categoryName},'/api/categories/'+eid('category'));
}
note('check-in',eid('checkIn'),'No DELETE check-in operation in deployed Swagger; attendance/check-in history may retain references.');
note('attendance',eid('attendance'),'No DELETE attendance operation in deployed Swagger; history retained.');
note('audit log',eid('auditLog'),'Audit history has no DELETE route; server audit records retained.');
if(f.uploadedImageUrl)note('uploaded image',f.uploadedImageUrl,'Deployed API exposes upload only; no media-delete route or Cloudinary management credentials used.');
if(!final) {
  const card=await request('/api/memberships/'+eid('activeCard'),R.reception);
  a.check('UI active card remains active',card.status===200&&card.body.status===1,{status:card.status,response:card.body});
  for(const key of ['package','longPackage']) {
    const p=await request('/api/membership-packages/'+eid(key));
    a.check('UI '+key+' remains available',p.status===200,{status:p.status,response:p.body});
  }
  const paid=await request('/api/classes/'+eid('paidClass'));
  a.check('UI paidClass remains available',paid.status===200,{status:paid.status,response:paid.body});
  for(const key of Object.keys(f.users)) {
    const auth=await request('/api/auth/me',R[key]);
    a.check('UI '+key+' session remains valid',auth.status===200,{status:auth.status,response:auth.body});
  }
}
const remainingClasses=(await list('/api/classes')).filter(x=>starts(x.className));
await a.save();
const file=path.join(OUT,'cleanup.json');
const report=JSON.parse(await fs.readFile(file,'utf8'));
report.cleanup={run:RUN,prefix:PREFIX,phase,finishedAt:new Date().toISOString(),finalAuthorized:final,steps,preserved,constraints,inventoryBefore,remainingClasses,counts:{attempts:steps.length,deleted:steps.filter(x=>x.outcome==='deleted').length,cancelled:steps.filter(x=>x.outcome==='cancelled').length,updated:steps.filter(x=>x.outcome==='updated').length,retainedConstraints:steps.filter(x=>x.outcome==='retained-constraint').length,errors:steps.filter(x=>x.outcome==='error').length},interpretation:'Only this exact QA run is eligible. Cancelled booking history, attendance, support, check-ins, audit logs and protected paid invoices may remain because the deployed API has no hard-delete route or enforces retention. No seed/demo record, bank gateway or money transfer was changed.'};
await fs.writeFile(file,JSON.stringify(report,null,2));
process.stdout.write('CLEANUP_SUMMARY '+JSON.stringify({phase,counts:report.cleanup.counts,preserved:preserved.length,constraints:constraints.length,remainingClasses:remainingClasses.map(x=>({id:idOf(x),name:x.className,status:x.status}))})+'\n');

