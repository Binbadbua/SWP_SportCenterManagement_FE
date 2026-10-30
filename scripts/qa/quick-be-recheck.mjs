import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT, PASSWORD, idOf, rowsOf, date, day } from './api-audit.mjs';
const run=new Date().toISOString().replace(/\D/g,'').slice(2,14), prefix='QA_RECHECK_'+run;
const OUT=path.join(ROOT,'artifacts','be-recheck-2026-10-30-'+run.slice(-6));
const a=new Audit('be-recheck'), R={}, U={}, E={}, cleanup=[], notes=[];
const rows=b=>Array.isArray(b)?b:Array.isArray(b?.data)?b.data:b?.items??b?.data?.items??[];
const ok=r=>r.status>=200&&r.status<300;
const save=async()=>{await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary:{baseUrl:BASE,recordedAt:new Date().toISOString(),run,prefix,checks:a.results.length,passed:a.results.filter(x=>x.passed).length,failed:a.results.filter(x=>!x.passed).length,requests:a.calls.length},results:a.results,calls:a.calls,fixtures:{users:U,entities:E},cleanup,notes},null,2));};
async function make(key,url,actor,body){const r=await a.request('POST',url,actor,body);if(!ok(r))throw new Error('Setup '+key+' HTTP '+r.status+' '+JSON.stringify(r.body));E[key]={id:idOf(r.body),body:r.body,request:body,url};await save();return E[key];}
async function expect(name,method,url,actor,body,statuses,predicate){const r=await a.expect(name,method,url,actor,body,statuses,predicate);await save();return r;}
async function clean(method,url,actor,body){const r=await a.request(method,url,actor,body);cleanup.push({method,url,status:r.status,response:r.body});return r;}
try {
 const swagger=await a.request('GET','/swagger/v1/swagger.json');
 if(swagger.status!==200)throw new Error('Swagger HTTP '+swagger.status);
 a.spec=swagger.body;await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'swagger.json'),JSON.stringify(swagger.body,null,2));
 R.manager=await a.login('demo_manager','123456','Manager');
 R.reception=await a.login('nguyen.thu.trang',PASSWORD,'Receptionist');
 const rp=await a.request('GET','/api/receptionists/me',R.reception);
 if(rp.status!==200)throw new Error('Receptionist profile unavailable');
 U.reception={profileId:idOf(rp.body)};
 const original=await a.request('GET','/api/classes',R.manager);
 E.demoPricesBefore=rows(original.body).filter(c=>!c.className?.startsWith('QA')).map(c=>({id:c.id,price:c.price}));
 for(const [index,key]of ['coach','otherCoach','member','otherMember'].entries()){
  const username=(prefix+'_'+key).toLowerCase(),phone='08'+run.slice(-6)+String(index+1).padStart(2,'0');
  const common={username,email:username+'@example.invalid',password:PASSWORD,fullName:prefix+' '+key,phone};
  if(key.includes('Coach')||key==='coach'){
   const acc=await a.request('POST','/api/accounts',R.manager,{...common,role:2,status:1});
   if(!ok(acc))throw new Error('Coach account HTTP '+acc.status);
   U[key]={username,accountId:idOf(acc.body)};
   const list=await a.request('GET','/api/coaches?pageSize=500',R.manager);
   let p=rows(list.body).find(c=>c.accountId===U[key].accountId);
   if(!p){const pr=await a.request('POST','/api/coaches',R.manager,{accountId:U[key].accountId,fullName:common.fullName,email:common.email,phone,specialization:'Temporary QA recheck',experienceYears:1});if(!ok(pr))throw new Error('Coach profile HTTP '+pr.status);p=pr.body;}
   U[key].profileId=idOf(p);
  }else{
   const reg=await a.request('POST','/api/auth/register',null,{...common,dob:'2000-01-01T00:00:00Z',gender:'Other',trainingGoal:'QA temporary'});
   if(!ok(reg))throw new Error('Member account HTTP '+reg.status);
  }
  R[key]=await a.login(username,PASSWORD,key);
  if(!U[key]){const me=await a.request('GET','/api/members/me',R[key]);if(me.status!==200)throw new Error('Member profile HTTP '+me.status);U[key]={username,accountId:R[key].accountId,profileId:me.body.memberId??me.body.id};}
  await save();
 }
 await make('category','/api/categories',R.manager,{categoryName:prefix+' sport',description:'Temporary BE fix verification'});
 await make('room','/api/rooms',R.manager,{roomName:prefix+' room',capacity:20,status:1});
 await make('package','/api/membership-packages',R.manager,{packageName:prefix+' package',durationDays:30,price:10000,discountPercent:10,benefits:'QA only',description:'Temporary verification',categoryIds:[],status:1});
 const classBody=(name,price)=>({className:prefix+' '+name,categoryId:E.category.id,coachId:U.coach.profileId,maxCapacity:5,price,startDate:date(-4),endDate:date(20),status:1});
 await make('trainingClass','/api/classes',R.manager,classBody('training',0));
 await make('trainingSession','/api/class-sessions',R.manager,{classId:E.trainingClass.id,roomId:E.room.id,date:date(3),startTime:'06:00:00',endTime:'06:30:00'});
 const booked=await expect('Free checkout positive control','POST','/api/payments/class-checkout',R.member,{classId:E.trainingClass.id,paymentMethod:2},[200],b=>b.status===2&&b.amount===0);
 if(!ok(booked))throw new Error('Enrollment positive control failed');
 E.trainingBooking={id:booked.body.bookingId,invoiceId:booked.body.invoiceId};
 await expect('Move only QA session to yesterday','PUT','/api/class-sessions/'+E.trainingSession.id,R.manager,{...E.trainingSession.request,date:date(-1)},[200,204]);
 await expect('Set training class ongoing for attendance','PUT','/api/classes/'+E.trainingClass.id,R.manager,{...E.trainingClass.request,status:2},[200,204]);
 const planBody={coachId:U.coach.profileId,memberId:U.member.profileId,classId:E.trainingClass.id,title:prefix+' plan',contentDescription:'QA verification only',createdDate:date(0)};
 await make('plan','/api/training-plans',R.coach,planBody);
 await expect('B61 owner can read own plan','GET','/api/training-plans/'+E.plan.id,R.coach,undefined,[200]);
 await expect('B61 foreign coach cannot read plan','GET','/api/training-plans/'+E.plan.id,R.otherCoach,undefined,[403,404]);
 await expect('Result requires present attendance before recording','POST','/api/training-results',R.coach,{planId:E.plan.id,memberId:U.member.profileId,coachId:U.coach.profileId,sessionId:E.trainingSession.id,performanceScore:7,coachComment:'QA missing attendance control',evaluationDate:date(0)},[400]);
 await make('attendance','/api/attendances',R.coach,{sessionId:E.trainingSession.id,memberId:U.member.profileId,status:1,recordedBy:R.coach.accountId});
 await make('result','/api/training-results',R.coach,{planId:E.plan.id,memberId:U.member.profileId,coachId:U.coach.profileId,sessionId:E.trainingSession.id,performanceScore:7,coachComment:'QA verification only',evaluationDate:date(0)});
 await expect('B61 owner can read own result','GET','/api/training-results/'+E.result.id,R.coach,undefined,[200]);
 await expect('B61 foreign coach cannot read result','GET','/api/training-results/'+E.result.id,R.otherCoach,undefined,[403,404]);
 const outsider=await expect('B62 reject plan for member not booked in class','POST','/api/training-plans',R.coach,{...planBody,title:prefix+' unrelated member',memberId:U.otherMember.profileId},[400,403]);
 if(ok(outsider))E.unexpectedPlan={id:idOf(outsider.body)};
 await make('paidClass','/api/classes',R.manager,classBody('paid',10000));
 await make('paidSession','/api/class-sessions',R.manager,{classId:E.paidClass.id,roomId:E.room.id,date:date(3),startTime:'07:00:00',endTime:'07:30:00'});
 const pay=await expect('B60 create isolated SePay pending class order','POST','/api/payments/class-checkout',R.otherMember,{classId:E.paidClass.id,paymentMethod:2},[200],b=>b.provider==='SePay'&&b.status===1);
 if(ok(pay)){
  E.payment=pay.body;
  await expect('B60 reject legacy confirm for SePay order','POST','/api/payments/'+pay.body.paymentId+'/confirm',R.reception,{},[400,403,409]);
  await expect('B60 denied confirm leaves SePay payment pending','GET','/api/payments/'+pay.body.paymentId,R.otherMember,undefined,[200],b=>b.status===1);
 }
 await make('pastClass','/api/classes',R.manager,classBody('past first session',0));
 await make('pastSession','/api/class-sessions',R.manager,{classId:E.pastClass.id,roomId:E.room.id,date:date(-2),startTime:'08:00:00',endTime:'08:30:00'});
 const del=await expect('B58 reject delete after first session while class status is 1','DELETE','/api/classes/'+E.pastClass.id,R.manager,undefined,[400,409]);
 if(ok(del))E.pastClass.deleted=true;
 await expect('B58 blocked deletion keeps class readable','GET','/api/classes/'+E.pastClass.id,R.manager,undefined,[200]);
 await make('card','/api/memberships',R.reception,{memberId:U.member.profileId,packageId:E.package.id,startDate:date(1),endDate:date(30),status:2});
 await make('invoice','/api/invoices',R.reception,{receptionistId:U.reception.profileId,memberMembershipId:E.card.id,amount:10000,paymentMethod:1,status:1});
 await expect('B65 delete pending desk invoice','DELETE','/api/invoices/'+E.invoice.id,R.reception,undefined,[200,204]);
 await expect('B65 deleted invoice detail is absent','GET','/api/invoices/'+E.invoice.id,R.reception,undefined,[404]);
 const inv=await a.request('GET','/api/invoices',R.reception);
 a.check('B65 deleted invoice is absent from list',inv.status===200&&!rows(inv.body).some(x=>x.id===E.invoice.id),{status:inv.status,invoiceId:E.invoice.id});
 const email=prefix.toLowerCase()+'-missing@example.invalid';
 await expect('B63 forgot-password returns controlled response','POST','/api/auth/forgot-password',null,{email},[200,202,400,404,429]);
 await expect('B63 reset-password returns controlled response','POST','/api/auth/reset-password',null,{email,otp:'000000',newPassword:'Temporary@5678'},[400,404,429]);
 const oversized=new FormData();const bytes=Buffer.alloc(6*1024*1024);Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq1kAAAAASUVORK5CYII=','base64').copy(bytes);
 oversized.append('file',new Blob([bytes],{type:'image/png'}),prefix+'-oversize.png');
 await expect('B64 oversize upload is a controlled validation error','POST','/api/media/images',R.manager,oversized,[400,413]);
 await expect('B48 member AI chat configured','POST','/api/ai/chat',R.member,{message:'Trung tâm có những môn thể thao nào?'},[200]);
 await expect('B48 coach AI suggestions configured','POST','/api/ai/exercise-suggestions',R.coach,{memberId:U.member.profileId,goal:'Tang suc ben',durationMinutes:20,equipment:'bodyweight',level:'beginner'},[200]);
 await expect('B58 manager cannot record a desk check-in','POST','/api/check-ins',R.manager,{memberId:U.otherMember.profileId},[403]);
 notes.push('Quick check: did not wait through a new 15-minute expiry (B59), send real bank transfers, authenticate a provider webhook or test delivery of a real password-reset email.');
}catch(error){notes.push(String(error.stack??error));a.check('Recheck fixture setup and execution completed',false,{error:String(error.message??error)});}
finally {
 try {
  for(const key of ['result','unexpectedPlan','plan'])if(E[key]?.id)await clean('DELETE','/api/'+(key==='result'?'training-results':'training-plans')+'/'+E[key].id,R.coach);
  if(E.payment){const p=await a.request('GET','/api/payments/'+E.payment.paymentId,R.otherMember);if(p.body?.status===1)await clean('POST','/api/payments/'+E.payment.paymentId+'/cancel',R.otherMember,{});else if(p.body?.status===2&&p.body.bookingId){await clean('DELETE','/api/class-bookings/'+p.body.bookingId+'/member/'+U.otherMember.profileId,R.otherMember);const r=await a.request('GET','/api/payments/'+E.payment.paymentId,R.reception);if(r.body?.refundPending)await clean('POST','/api/payments/'+E.payment.paymentId+'/refund-confirm',R.reception,{reference:prefix+' synthetic QA; no real funds'});}}
  if(E.trainingBooking?.id)await clean('DELETE','/api/class-bookings/'+E.trainingBooking.id+'/member/'+U.member.profileId,R.member);
  if(E.invoice?.id){const c=await a.request('GET','/api/invoices/'+E.invoice.id,R.reception);if(c.status===200&&c.body.status===1)await clean('DELETE','/api/invoices/'+E.invoice.id,R.reception);}
  if(E.card?.id)await clean('DELETE','/api/memberships/'+E.card.id,R.reception);
  for(const key of ['pastSession','paidSession','trainingSession'])if(E[key]?.id)await clean('DELETE','/api/class-sessions/'+E[key].id,R.manager);
  for(const key of ['pastClass','paidClass','trainingClass'])if(E[key]?.id&&!E[key].deleted){const x=await a.request('GET','/api/classes/'+E[key].id,R.manager);if(x.status===200){await clean('PUT','/api/classes/'+E[key].id,R.manager,{...E[key].request,status:4});await clean('DELETE','/api/classes/'+E[key].id,R.manager);}}
  for(const [key,url]of [['package','membership-packages'],['room','rooms'],['category','categories']])if(E[key]?.id)await clean('DELETE','/api/'+url+'/'+E[key].id,R.manager);
  for(const key of ['member','otherMember','coach','otherCoach'])if(U[key]){await clean('DELETE','/api/'+(key.toLowerCase().includes('coach')?'coaches':'members')+'/'+U[key].profileId,R.manager);await clean('DELETE','/api/accounts/'+U[key].accountId,R.manager);}
  const demo=await a.request('GET','/api/classes',R.manager);
  if(E.demoPricesBefore)a.check('Previously assigned demo class prices remain unchanged',E.demoPricesBefore.every(x=>rows(demo.body).some(y=>y.id===x.id&&y.price===x.price)),{classes:E.demoPricesBefore.length});
 }catch(error){notes.push('Cleanup interrupted: '+String(error.stack??error));}
 await save();
 process.stdout.write('REPORT '+OUT+'\n');
 process.stdout.write('SUMMARY '+JSON.stringify({checks:a.results.length,passed:a.results.filter(x=>x.passed).length,failed:a.results.filter(x=>!x.passed).length,requests:a.calls.length,cleanup:cleanup.length,cleanupConstraints:cleanup.filter(c=>c.status>=400&&c.status!==404).length})+'\n');
}
