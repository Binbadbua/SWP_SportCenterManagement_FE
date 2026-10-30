import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Audit, OUT, PASSWORD, rowsOf, idOf, date, day } from './api-audit.mjs';
const a=new Audit('followup');
const f=JSON.parse(await fs.readFile(path.join(OUT,'fixtures.json'),'utf8'));
a.spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const R={};for(const key of Object.keys(f.users))R[key]=await a.login(f.users[key].username,PASSWORD,key);
const {member,otherMember:other,coach,otherCoach,reception,manager}=R;
const uid=(key)=>f.users[key].profileId,eid=(key)=>f.entities[key].id;
const note=f.prefix+' QA fixture only - no real payment or refund';
const save=async()=>{await fs.writeFile(path.join(OUT,'fixtures.json'),JSON.stringify(f,null,2));await a.save();};
const expect=(...args)=>a.expect(...args);
async function section(name,fn){try{await fn();}catch(e){a.check(name+' setup completed',false,{error:String(e.stack||e)});}await save();}
async function keep(key,endpoint,role,body){const r=await expect('Create '+key,'POST',endpoint,role,body,[200,201]);if([200,201].includes(r.status)){f.entities[key]={id:idOf(r.body),body:r.body,request:body};await save();}return r;}
async function freeBook(key,who,cls){
 const r=await expect('Member books free class through checkout','POST','/api/payments/class-checkout',R[who],{classId:eid(cls),paymentMethod:2,returnUrl:'http://localhost:5173/payment/result'},[200]);
 process.stdout.write('FREE_CHECKOUT '+JSON.stringify(r.body)+'\n');
 if(r.status===200){const mine=await a.request('GET','/api/members/me/class-bookings',R[who]);const row=rowsOf(mine.body).find((x)=>x.classId===eid(cls)&&x.status!==3);
 a.check('Free checkout creates confirmed booking with zero fee',!!row&&row.status===1&&Number(row.price??0)===0,{response:{checkout:r.body,booking:row}});
 if(row){f.entities[key]={id:row.id,body:row};await save();return row;}}
}
await section('Free checkout and capacity',async()=>{
 const free=await freeBook('freeBooking','member','freeClass');
 await expect('Duplicate confirmed class checkout rejected','POST','/api/payments/class-checkout',member,{classId:eid('freeClass'),paymentMethod:2},[400,409]);
 const full=await freeBook('fullBooking','otherMember','fullClass');
 await expect('No overbooking through free checkout','POST','/api/payments/class-checkout',member,{classId:eid('fullClass'),paymentMethod:2},[400,409]);
 if(full){await expect('Member cancels own free booking','DELETE','/api/class-bookings/'+full.id+'/member/'+uid('otherMember'),other,undefined,[200,204]);const c=await a.request('GET','/api/classes/'+eid('fullClass'));a.check('Cancelled checkout frees capacity',c.body.currentEnrolled===0,{response:c.body});const rows=await a.request('GET','/api/members/me/class-bookings',other);a.check('Cancelled booking remains in history',rowsOf(rows.body).some((b)=>b.id===full.id&&b.status===3),{response:rows.body});}
 const status=await a.request('GET','/api/payments/'+f.packagePayment.paymentId,member);f.expiryObserved=status.body;
 a.check('First SePay order remains pending or has expired naturally',[1,5].includes(status.body.status),{response:status.body});
 const dup=await a.request('POST','/api/payments/checkout',member,{membershipPackageId:eid('package'),startDate:date(0),paymentMethod:2,returnUrl:'http://localhost:5173/payment/result'});
 a.check('Duplicate order includes resumable paymentId or expiry releases hold',dup.status===409&&dup.body.paymentId===f.packagePayment.paymentId||dup.status===200,{status:dup.status,response:dup.body});
 if(dup.status===200&&dup.body.paymentId){f.secondPendingPackage=dup.body;await save();await expect('Cancel second fixture package','POST','/api/payments/'+dup.body.paymentId+'/cancel',member,{},[200,204]);}
});

await section('Attendance and training',async()=>{
 const b=await freeBook('attendanceBooking','member','attendanceClass');if(!b)return;
 const session={...f.entities.attendanceClassSession.request,date:date(-1)};
 await expect('Move QA session into past','PUT','/api/class-sessions/'+eid('attendanceClassSession'),manager,session,[200,204]);
 f.entities.attendanceClassSession.request=session;await save();
 await expect('Member cannot book started class','POST','/api/payments/class-checkout',other,{classId:eid('attendanceClass'),paymentMethod:2},[400]);
 await expect('Reception cannot book started class','POST','/api/class-bookings',reception,{memberId:uid('otherMember'),classId:eid('attendanceClass'),paymentMethod:1},[400]);
 await expect('Manager cannot delete running class','DELETE','/api/classes/'+eid('attendanceClass'),manager,undefined,[400]);
 const body={sessionId:eid('attendanceClassSession'),memberId:uid('member'),status:1,recordedBy:f.users.manager.accountId};
 await expect('Reception attendance denied','POST','/api/attendances',reception,body,[403]);
 await expect('Unassigned coach attendance denied','POST','/api/attendances',otherCoach,body,[403]);
 const marked=await keep('attendance','/api/attendances',coach,body);
 if(marked.status===200||marked.status===201){
 a.check('Attendance actor cannot be forged',marked.body.recordedBy===f.users.coach.accountId,{response:marked.body});
 await expect('Attendance duplicate rejected','POST','/api/attendances',coach,body,[400,409]);
 await expect('Coach updates attendance','PUT','/api/attendances/'+idOf(marked.body),coach,{status:2,recordedBy:f.users.manager.accountId},[200,204]);
 await expect('Coach restores present','PUT','/api/attendances/'+idOf(marked.body),coach,{status:1,recordedBy:f.users.coach.accountId},[200,204]);
 await expect('Other coach update denied','PUT','/api/attendances/'+idOf(marked.body),otherCoach,{status:2,recordedBy:f.users.otherCoach.accountId},[403]);
 }
 const planBody={coachId:uid('coach'),memberId:uid('member'),classId:eid('attendanceClass'),title:f.prefix+' plan',contentDescription:note,createdDate:date(0)};
 const p=await keep('plan','/api/training-plans',coach,planBody);
 if(p.status===200||p.status===201){
 const id=idOf(p.body);
 await expect('Coach edits own plan','PUT','/api/training-plans/'+id,coach,{...planBody,title:f.prefix+' plan updated'},[200,204]);
 await expect('Other coach cannot edit plan','PUT','/api/training-plans/'+id,otherCoach,{...planBody,coachId:uid('otherCoach')},[403]);
 const rb={planId:id,memberId:uid('member'),coachId:uid('coach'),sessionId:eid('attendanceClassSession'),performanceScore:7.5,coachComment:note,evaluationDate:date(-1)};
 const r=await keep('trainingResult','/api/training-results',coach,rb);
 if(r.status===200||r.status===201){
 a.check('Training result persists sessionId',r.body.sessionId===eid('attendanceClassSession'),{response:r.body});
 await expect('Coach edits result','PUT','/api/training-results/'+idOf(r.body),coach,{...rb,performanceScore:8},[200,204]);
 await expect('Other coach cannot edit result','PUT','/api/training-results/'+idOf(r.body),otherCoach,{...rb,performanceScore:5},[403]);
 }
 await expect('Score limit enforced','POST','/api/training-results',coach,{...rb,performanceScore:11},[400]);
 await expect('Result rejects session from wrong class','POST','/api/training-results',coach,{...rb,sessionId:eid('freeClassSession')},[400]);
 }
 const bulk=await expect('Whole class plan API works','POST','/api/training-plans/class/'+eid('attendanceClass'),coach,{title:f.prefix+' bulk plan',contentDescription:note,createdDate:date(0)},[200,201]);f.bulkPlanResult=bulk.body;await save();
 await expect('Other coach cannot create whole class plan','POST','/api/training-plans/class/'+eid('attendanceClass'),otherCoach,{title:f.prefix+' forbidden plan'},[403]);
 await expect('Plan rejects unrelated student','POST','/api/training-plans',coach,{...planBody,memberId:uid('otherMember')},[400,403]);
 await expect('Coach AI after valid roster membership','POST','/api/ai/exercise-suggestions',coach,{memberId:uid('member'),goal:'Bai tap nhe tang suc ben',durationMinutes:20,equipment:'bodyweight',level:'beginner'},[200],(x)=>!!x&&JSON.stringify(x).length>30);
});

await section('Sender identity and support access',async()=>{
 const sent=await expect('Coach sends notice to own student','POST','/api/notifications',coach,{accountIds:[f.users.member.accountId],title:f.prefix+' sender check',message:note},[200,201]);
 const inbox=await a.request('GET','/api/notifications/me?pageSize=100',member);const n=rowsOf(inbox.body).find((x)=>x.title===f.prefix+' sender check');
 a.check('Notification carries real sender name and role',!!n?.senderName&&n.senderRole==='Coach'&&n.senderAccountId===f.users.coach.accountId,{response:n});
 if(n){f.notificationId=n.id;await save();await expect('Other member cannot mark this notification','PUT','/api/notifications/'+n.id+'/read',other,{},[403,404]);await expect('Owner marks notification','PUT','/api/notifications/'+n.id+'/read',member,{},[200,204]);await expect('Owner marks all read','PUT','/api/notifications/read-all',member,{},[200,204]);await expect('Owner deletes test notice','DELETE','/api/notifications/'+n.id,member,undefined,[200,204]);}
});

await section('Paid late cancellation',async()=>{
 const cls={...f.entities.paidClass.request,className:f.prefix+' Late paid',price:10000,status:1};
 const c=await keep('latePaidClass','/api/classes',manager,cls);if(![200,201].includes(c.status))return;
 await keep('latePaidSession','/api/class-sessions',manager,{classId:eid('latePaidClass'),roomId:eid('room'),date:date(3),startTime:'09:00:00',endTime:'09:45:00'});
 const b=await keep('latePaidBooking','/api/class-bookings',reception,{memberId:uid('member'),classId:eid('latePaidClass'),paymentMethod:1});
 if(![200,201].includes(b.status))return;
 await expect('Set fixture class ongoing','PUT','/api/classes/'+eid('latePaidClass'),manager,{...cls,status:2},[200,204]);
 f.entities.latePaidClass.request={...cls,status:2};await save();
 await expect('Class status ongoing prevents checkout','POST','/api/payments/class-checkout',other,{classId:eid('latePaidClass'),paymentMethod:2},[400]);
 const cancel=await expect('Member can cancel a started paid class','DELETE','/api/class-bookings/'+idOf(b.body)+'/member/'+uid('member'),member,undefined,[200]);
 a.check('Started class cancellation gives no refund',cancel.body?.refunded===false&&Number(cancel.body?.refundAmount??0)===0&&!cancel.body?.refundPending,{response:cancel.body});
 const inv=await a.request('GET','/api/invoices/'+b.body.invoiceId,reception);a.check('Started cancelled class invoice stays Paid',inv.body.status===2,{response:inv.body});
 await expect('Cancelled started class cannot be booked again','POST','/api/payments/class-checkout',member,{classId:eid('latePaidClass'),paymentMethod:2},[400]);
});

await section('Invoice protections and manual refund semantics',async()=>{
 await expect('Reception cannot delete Paid invoice','DELETE','/api/invoices/'+eid('activeCardInvoice'),reception,undefined,[400,409]);
 await expect('Manager cannot change invoice directly','PUT','/api/invoices/'+eid('activeCardInvoice'),manager,{paymentMethod:1,status:1},[403]);
 const pending=f.packagePayment;
 await expect('Direct invoice update does not settle SePay order','PUT','/api/invoices/'+pending.invoiceId,reception,{paymentMethod:2,status:2},[400,409]);
 const refund=await a.request('GET','/api/payments/'+f.deskPaidBooking.invoiceId,reception);
 a.check('Confirmed fixture refund has reference and Refunded status',refund.body.status===6&&!refund.body.refundPending&&!!refund.body.refundReference,{response:refund.body});
 const requests=await a.request('GET','/api/class-bookings/member/'+uid('otherMember'),reception);
 const cancelled=rowsOf(requests.body).find((x)=>x.id===idOf(f.deskPaidBooking));
 a.check('Refunded cancellation retains booking history',cancelled?.status===3,{response:cancelled});
 await expect('Manager cannot confirm a refund','POST','/api/payments/'+f.deskPaidBooking.invoiceId+'/refund-confirm',manager,{reference:note},[403]);
 const oversized=new FormData();oversized.append('file',new Blob([Buffer.alloc(6*1024*1024)],{type:'image/png'}),'qa-size-retry.png');
 const r=await a.request('POST','/api/media/images',manager,oversized,{timeout:60000});a.check('Oversize upload returns controlled validation on retry',[400,413].includes(r.status),{status:r.status,response:r.body});
});

await section('Boundary validation for remaining endpoints',async()=>{
 const fake=crypto.randomUUID();
 await expect('Reception cannot create staff account','POST','/api/accounts',reception,{username:f.prefix+'-deny',email:'deny@example.invalid',password:PASSWORD,role:2,status:1},[403]);
 await expect('Members profile endpoint validates missing data','POST','/api/members',reception,{},[400]);
 await expect('Member cannot create reception profile','POST','/api/receptionists',member,{},[403]);
 await expect('Member cannot create manager profile','POST','/api/center-managers',member,{},[403]);
 await expect('Member cannot create coach profile','POST','/api/coaches',member,{},[403]);
 await expect('Member cannot create category','POST','/api/categories',member,{},[403]);
 await expect('Delete missing training result is controlled','DELETE','/api/training-results/'+fake,coach,undefined,[400,404]);
 await expect('Delete missing training plan is controlled','DELETE','/api/training-plans/'+fake,coach,undefined,[400,404]);
 await expect('Delete missing session is controlled','DELETE','/api/class-sessions/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing class is controlled','DELETE','/api/classes/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing package is controlled','DELETE','/api/membership-packages/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing membership is controlled','DELETE','/api/memberships/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing member is controlled','DELETE','/api/members/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing coach is controlled','DELETE','/api/coaches/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing receptionist is controlled','DELETE','/api/receptionists/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing manager is controlled','DELETE','/api/center-managers/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing account is controlled','DELETE','/api/accounts/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing room is controlled','DELETE','/api/rooms/'+fake,manager,undefined,[400,404]);
 await expect('Delete missing category is controlled','DELETE','/api/categories/'+fake,manager,undefined,[400,404]);
});
f.followupCompletedAt=new Date().toISOString();await save();
process.stdout.write('FOLLOWUP_DONE\n');
