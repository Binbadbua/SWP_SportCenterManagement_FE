import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Audit, BASE, OUT, PASSWORD, ZERO, rowsOf, idOf, date, day } from './api-audit.mjs';

const a = new Audit('business');
const f = JSON.parse(await fs.readFile(path.join(OUT, 'fixtures.json'), 'utf8'));
a.spec = JSON.parse(await fs.readFile(path.join(OUT, 'swagger.json'), 'utf8'));
const roles = {};
for (const key of Object.keys(f.users)) roles[key] = await a.login(f.users[key].username, PASSWORD, key);
const manager = roles.manager, reception = roles.reception, member = roles.member, other = roles.otherMember, coach = roles.coach;
const uid = (k) => f.users[k].profileId;
const eid = (k) => f.entities[k].id;
const rid = () => crypto.randomUUID();
const note = f.prefix + ' temporary integration audit - no real funds';
const save = async () => { await fs.writeFile(path.join(OUT, 'fixtures.json'), JSON.stringify(f, null, 2)); await a.save(); };
const expect = (...args) => a.expect(...args);
const make = async (key, endpoint, actor, body) => {
  const r = await expect('Create ' + key, 'POST', endpoint, actor, body, [200,201]);
  if ([200,201].includes(r.status)) {
    f.entities[key] = { id: idOf(r.body), body: r.body, request: body };
    await save();
  }
  return r;
};
const attempt = async (name, fn) => {
  try { await fn(); } catch(e) { a.check(name + ' completed without dependency error', false, { error: String(e.stack || e) }); }
  await save();
};
const booking = (who, cls, method = 1) => ({ memberId: uid(who), classId: eid(cls), paymentMethod: method });
const checkout = (cls, method = 2) => ({ classId: eid(cls), paymentMethod: method, returnUrl: 'http://localhost:5173/payment/result' });
const packCheckout = (method = 2) => ({ membershipPackageId: eid('package'), startDate: date(0), paymentMethod: method, returnUrl: 'http://localhost:5173/payment/result' });
const cancelPayment = (id, actor = member) => expect('Cancel fixture pending order', 'POST', '/api/payments/' + id + '/cancel', actor, {}, [200,204]);
const cancelBooking = (b, actor = member, who = 'member') => expect('Cancel fixture booking', 'DELETE', '/api/class-bookings/' + idOf(b) + '/member/' + uid(who), actor, undefined, [200,204]);
const pendingIds = [];
const paidInvoiceIds = [];

await attempt('Authentication and profiles', async () => {
  await expect('Wrong password returns 401 JSON', 'POST', '/api/auth/login', null, { email: f.users.member.username, password: 'wrong-password-qa' }, [401]);
  await expect('Anonymous auth me denied', 'GET', '/api/auth/me', null, undefined, [401]);
  await expect('Invalid bearer rejected', 'GET', '/api/auth/me', { name:'invalid-token', token:'invalid.qa.token' }, undefined, [401]);
  await expect('Profile validates missing fields', 'PUT', '/api/members/me', member, {}, [400]);
  const current = await a.request('GET', '/api/members/me', member);
  const body = { ...current.body, accountId: f.users.member.accountId, fullName: f.users.member.fullName, phone: f.users.member.phone, email: f.users.member.email, dob:'2000-01-01T00:00:00Z', gender:'Other', trainingGoal:note, avatar:'' };
  await expect('Member saves own profile', 'PUT', '/api/members/me', member, body, [200,204]);
  await expect('Reception edits fixture member', 'PUT', '/api/members/' + uid('member'), reception, body, [200,204]);
  await expect('Member cannot edit another member via staff route', 'PUT', '/api/members/' + uid('otherMember'), member, body, [403]);
  await expect('Change password rejects wrong current password', 'POST', '/api/auth/change-password', member, { currentPassword:'wrong-password-qa', newPassword:'Temporary@5678' }, [400]);
  await expect('Change password validates minimum', 'POST', '/api/auth/change-password', member, { currentPassword:PASSWORD, newPassword:'short' }, [400]);
  await expect('Change password rejects unchanged password', 'POST', '/api/auth/change-password', member, { currentPassword:PASSWORD, newPassword:PASSWORD }, [400]);
  await expect('Change fixture password', 'POST', '/api/auth/change-password', member, { currentPassword:PASSWORD, newPassword:'Temporary@5678' }, [200,204]);
  await expect('Old password no longer logs in', 'POST', '/api/auth/login', null, { email:f.users.member.username, password:PASSWORD }, [401]);
  const fresh = await a.login(f.users.member.username, 'Temporary@5678', 'member');
  await expect('Restore fixture password', 'POST', '/api/auth/change-password', fresh, { currentPassword:'Temporary@5678', newPassword:PASSWORD }, [200,204]);
  await expect('Forgot password does not return internal error', 'POST', '/api/auth/forgot-password', null, { email:f.prefix.toLowerCase()+'-not-an-account@example.invalid' }, [200,400,404,429,501]);
  await expect('Reset nonexistent account is a controlled response', 'POST', '/api/auth/reset-password', null, { email:f.prefix.toLowerCase()+'-not-an-account@example.invalid', otp:'000000', newPassword:'Temporary@5678' }, [400,404,429,501]);
  await expect('Logout route responds', 'POST', '/api/auth/logout', other, {}, [200,204]);
});

await attempt('Resource validation and updates', async () => {
  const cat = f.entities.category.request;
  await expect('Update fixture sport', 'PUT', '/api/categories/' + eid('category'), manager, { ...cat, description:note }, [200,204]);
  await expect('Duplicate sport rejected', 'POST', '/api/categories', manager, cat, [400,409]);
  await expect('Invalid room capacity rejected', 'POST', '/api/rooms', manager, { roomName:f.prefix+' invalid', capacity:0, status:1 }, [400]);
  await expect('Update fixture room', 'PUT', '/api/rooms/' + eid('room'), manager, { ...f.entities.room.request, capacity:31 }, [200,204]);
  await expect('Package discounts validated', 'POST', '/api/membership-packages', manager, { ...f.entities.package.request, packageName:f.prefix+' bad-discount', discountPercent:101 }, [400]);
  await expect('Update package discount and benefits', 'PUT', '/api/membership-packages/' + eid('package'), manager, f.entities.package.request, [200,204]);
  await expect('Reception cannot edit packages', 'PUT', '/api/membership-packages/' + eid('package'), reception, f.entities.package.request, [403]);
  await expect('Invalid class capacity rejected', 'POST', '/api/classes', manager, { ...f.entities.freeClass.request, className:f.prefix+' invalid', maxCapacity:0 }, [400]);
  await expect('Invalid class price rejected', 'POST', '/api/classes', manager, { ...f.entities.freeClass.request, className:f.prefix+' negative', price:-1 }, [400]);
  await expect('Update fixture class with fee', 'PUT', '/api/classes/' + eid('paidClass'), manager, f.entities.paidClass.request, [200,204]);
  await expect('Reception cannot edit class', 'PUT', '/api/classes/' + eid('paidClass'), reception, f.entities.paidClass.request, [403]);
  const session = f.entities.paidClassSession.request;
  await expect('Room overlap rejected', 'POST', '/api/class-sessions', manager, { ...session, classId:eid('freeClass') }, [400,409]);
  await expect('Unavailable room rejected', 'POST', '/api/class-sessions', manager, { ...session, roomId:eid('unavailableRoom') }, [400,409]);
  await expect('Session outside class dates rejected', 'POST', '/api/class-sessions', manager, { ...session, date:date(70) }, [400]);
  await expect('Session end before start rejected', 'POST', '/api/class-sessions', manager, { ...session, startTime:'10:45:00', endTime:'10:00:00' }, [400]);
  await expect('Update fixture session', 'PUT', '/api/class-sessions/' + eid('paidClassSession'), manager, session, [200,204]);
  await expect('Coach can edit own profile only through staff policy', 'PUT', '/api/coaches/' + uid('coach'), coach, { ...f.users.coach, email:f.users.coach.email, phone:f.users.coach.phone, fullName:f.users.coach.fullName, specialization:'QA', experienceYears:2, avatar:'' }, [403]);
  await expect('Manager updates fixture coach', 'PUT', '/api/coaches/' + uid('coach'), manager, { fullName:f.users.coach.fullName, phone:f.users.coach.phone, email:f.users.coach.email, specialization:'QA', experienceYears:2, dob:'1990-01-01T00:00:00Z', gender:'Other', avatar:'' }, [200,204]);
  await expect('Manager updates fixture receptionist', 'PUT', '/api/receptionists/' + uid('reception'), manager, { fullName:f.users.reception.fullName, phone:f.users.reception.phone, email:f.users.reception.email, workingShift:'QA temporary' }, [200,204]);
  await expect('Manager updates fixture manager profile', 'PUT', '/api/center-managers/' + uid('manager'), manager, { fullName:f.users.manager.fullName, phone:f.users.manager.phone, email:f.users.manager.email, avatar:'' }, [200,204]);
});

await attempt('SePay ownership and authenticity', async () => {
  const p = f.packagePayment;
  if (!p?.paymentId) throw new Error('No pending SePay fixture payment');
  const detail = f.paymentDetail;
  a.check('SePay QR is an image endpoint, not QR text', detail.provider === 'SePay' && /^https:\/\/qr\.sepay\.vn\/img\?/.test(detail.qrCodeUrl), { response:detail });
  const qr = new URL(detail.qrCodeUrl);
  a.check('QR binds amount, account and exact transfer reference', Number(qr.searchParams.get('amount')) === detail.amount && qr.searchParams.get('acc') === detail.bankAccountNumber && qr.searchParams.get('des') === detail.paymentReference);
  const image = await fetch(detail.qrCodeUrl, { signal:AbortSignal.timeout(30000) });
  a.check('SePay renders the actual bank QR image', image.ok && image.headers.get('content-type')?.startsWith('image/'), { status:image.status, contentType:image.headers.get('content-type') });
  await expect('Other member cannot read SePay payment', 'GET', '/api/payments/' + p.paymentId, other, undefined, [403,404]);
  await expect('Other member cannot cancel SePay payment', 'POST', '/api/payments/' + p.paymentId + '/cancel', other, {}, [403,404]);
  await expect('Anonymous cannot read SePay payment', 'GET', '/api/payments/' + p.paymentId, null, undefined, [401]);
  await expect('Duplicate package order is rejected', 'POST', '/api/payments/checkout', member, packCheckout(), [409], (b) => !!b.paymentId || !!b.detail || !!b.message);
  await expect('Legacy MoMo wallet is rejected', 'POST', '/api/payments/class-checkout', member, checkout('paidClass',4), [400]);
  await expect('Legacy MoMo ATM is rejected', 'POST', '/api/payments/upgrade-checkout', member, { membershipId:rid(), membershipPackageId:eid('longPackage'), paymentMethod:5 }, [400]);
  await expect('SePay accepts no arbitrary payment success query', 'GET', '/api/payments/' + p.paymentId + '?status=2&resultCode=0', member, undefined, [200], (b) => b.status === 1);
  const webhook = { id:Date.now(), content:detail.paymentReference, code:detail.paymentReference, transferAmount:detail.amount, referenceCode:f.prefix+'-spoof', transactionDate:day()+' 23:00:00', gateway:'Vietcombank', transferType:'in', accountNumber:detail.bankAccountNumber };
  await expect('SePay webhook requires provider authentication', 'POST', '/api/sepay/webhook', null, webhook, [401,403]);
  const forged = await a.request('POST', '/api/sepay/webhook', null, { ...webhook, id:Date.now()+1 }, { headers:{ Authorization:'Apikey invalid-qa-key' } });
  a.check('SePay webhook rejects invalid API key', [401,403].includes(forged.status), { status:forged.status, response:forged.body });
  await expect('Rejected callbacks leave order pending', 'GET', '/api/payments/' + p.paymentId, member, undefined, [200], (b) => b.status === 1);
  const badReturn = await a.request('POST', '/api/payments/checkout', other, { ...packCheckout(), returnUrl:'https://not-sportcenter.example.invalid/payment' });
  a.check('SePay does not redirect to an untrusted return origin', badReturn.status === 400 || (badReturn.status === 200 && badReturn.body?.provider === 'SePay' && /^https:\/\/qr\.sepay\.vn\/img\?/.test(badReturn.body.qrCodeUrl ?? '')), { status:badReturn.status, response:badReturn.body });
  if (badReturn.status === 200 && badReturn.body?.paymentId) await cancelPayment(badReturn.body.paymentId,other);
  await expect('Closed mock gateway cannot confirm payment', 'GET', '/api/payments/mock-gateway', reception, undefined, [400,404,410]);
  await expect('Member cannot manually confirm SePay payment', 'POST', '/api/payments/' + p.paymentId + '/confirm', member, {}, [403]);
  await expect('Anonymous cannot manually confirm payment', 'POST', '/api/payments/' + p.paymentId + '/confirm', null, {}, [401]);
});

await attempt('Bookings without a card, capacity and payment holds', async () => {
  const free = await make('freeBooking', '/api/class-bookings', member, booking('member','freeClass'));
  if (![200,201].includes(free.status)) return;
  a.check('Free booking is confirmed immediately without membership', free.body.status === 1 && Number(free.body.price ?? 0) === 0, { response:free.body });
  await expect('Duplicate free booking rejected', 'POST', '/api/class-bookings', member, booking('member','freeClass'), [400,409]);
  await expect('Member cannot bypass checkout for fee class', 'POST', '/api/class-bookings', member, booking('member','paidClass'), [400]);
  const full = await make('fullBooking','/api/class-bookings',member,booking('member','fullClass'));
  await expect('Class capacity enforced for second member', 'POST', '/api/class-bookings', other, booking('otherMember','fullClass'), [400,409]);
  if ([200,201].includes(full.status)) {
    await expect('Other member cannot cancel another booking', 'DELETE', '/api/class-bookings/'+idOf(full.body)+'/member/'+uid('member'), other, undefined,[403,404]);
    await cancelBooking(full.body);
    const remaining = await a.request('GET','/api/classes/'+eid('fullClass'),null);
    a.check('Cancelling frees the occupied class seat', remaining.body.currentEnrolled === 0, { response:remaining.body });
    const cancelled = await a.request('GET','/api/members/me/class-bookings',member);
    a.check('Cancelled booking is retained as status 3', rowsOf(cancelled.body).some((b)=>idOf(b)===idOf(full.body)&&b.status===3),{response:cancelled.body});
  }
  const paid = await expect('Member without card can create paid class order','POST','/api/payments/class-checkout',member,checkout('paidClass'),[200]);
  if(paid.status===200){
    const id=paid.body.paymentId; pendingIds.push(id); f.classPayment=paid.body; await save();
    a.check('Paid class order holds place and amount is computed by BE',paid.body.status===1&&paid.body.amount===10000,{response:paid.body});
    const detail=await a.request('GET','/api/payments/'+id,member);
    a.check('Class payment exposes booking and QR bank fields',detail.body.kind==='Class'&&!!detail.body.bookingId&&!!detail.body.paymentReference&&detail.body.paymentMethod===2,{response:detail.body});
    const cls=await a.request('GET','/api/classes/'+eid('paidClass'));
    a.check('Pending payment counts toward capacity',cls.body.currentEnrolled>=1,{response:cls.body});
    const roster=await a.request('GET','/api/classes/'+eid('paidClass')+'/members',coach);
    a.check('Unpaid booking is excluded from coach roster',!rowsOf(roster.body).some((r)=>r.memberId===uid('member')),{response:roster.body});
    await expect('Duplicate class payment rejected','POST','/api/payments/class-checkout',member,checkout('paidClass'),[400,409]);
    await cancelPayment(id);
    const detailAfter=await a.request('GET','/api/payments/'+id,member);
    a.check('Cancel payment records Cancelled',detailAfter.body.status===4,{response:detailAfter.body});
    await expect('Cancelled order cannot be cancelled again silently','POST','/api/payments/'+id+'/cancel',member,{},[200,400,409]);
    await expect('Cancelled SePay order cannot be confirmed at desk','POST','/api/payments/'+id+'/confirm',reception,{},[400,409]);
  }
});

await attempt('Cards, invoices, permissions and upgrades',async()=>{
  for(const [key,who]of [['activeCard','member'],['otherActiveCard','otherMember']]){
    const r=await make(key,'/api/memberships',reception,{memberId:uid(who),packageId:eid('package'),startDate:date(-10),endDate:date(19),status:1});
    if(![200,201].includes(r.status))continue;
    const inv=await make(key+'Invoice','/api/invoices',reception,{receptionistId:uid('reception'),memberMembershipId:idOf(r.body),amount:10000,paymentMethod:1,status:2});
    if([200,201].includes(inv.status))paidInvoiceIds.push(idOf(inv.body));
  }
  const membership=f.entities.activeCard;
  if(!membership)throw new Error('Active card fixture unavailable');
  const denied=await a.request('POST','/api/memberships',manager,{memberId:uid('member'),packageId:eid('package'),startDate:date(50),endDate:date(79),status:2});
  a.check('B58 manager cannot sell membership',denied.status===403,{status:denied.status,response:denied.body});
  if([200,201].includes(denied.status))f.entities.managerUnexpectedCard={id:idOf(denied.body),body:denied.body};
  await expect('B58 manager cannot renew card','POST','/api/memberships/'+membership.id+'/renew',manager,{},[403]);
  await expect('B58 manager cannot cancel card','POST','/api/memberships/'+membership.id+'/cancel',manager,{},[403]);
  await expect('Manager cannot add invoice','POST','/api/invoices',manager,{receptionistId:uid('reception'),memberMembershipId:membership.id,amount:10000,paymentMethod:1,status:1},[403]);
  await expect('Manager cannot export desk invoice','GET','/api/invoices/'+eid('activeCardInvoice')+'/export',manager,undefined,[403]);
  await expect('Reception exports fixture invoice','GET','/api/invoices/'+eid('activeCardInvoice')+'/export',reception,undefined,[200]);
  await expect('Duplicate membership invoice rejected','POST','/api/invoices',reception,{receptionistId:uid('reception'),memberMembershipId:membership.id,amount:10000,paymentMethod:1,status:2},[400,409]);
  await expect('Paid invoice cannot be deleted','DELETE','/api/invoices/'+eid('activeCardInvoice'),manager,undefined,[400,409]);
  await expect('Update fixture card dates','PUT','/api/memberships/'+membership.id,reception,{startDate:date(-10),endDate:date(19),status:1},[200,204]);
  const paid=await expect('Active card gets class discount from server','POST','/api/payments/class-checkout',member,checkout('paidClass'),[200]);
  if(paid.status===200){a.check('20 percent discount produces 8000 VND',paid.body.amount===8000&&paid.body.discountPercent===20,{response:paid.body});await cancelPayment(paid.body.paymentId);}
  await expect('Check-in without active card rejected','POST','/api/check-ins',reception,{memberId:rid()},[400,404]);
  await expect('Manager cannot record front-desk check-in','POST','/api/check-ins',manager,{memberId:uid('member')},[403]);
  const ci=await make('checkIn','/api/check-ins',reception,{memberId:uid('member')});
  await expect('Member reads own check-in history','GET','/api/members/me/check-ins',member,undefined,[200],(b)=>rowsOf(b).some((x)=>x.memberId===uid('member')||x.memberName===f.users.member.fullName));
  const upBody={membershipId:eid('otherActiveCard'),membershipPackageId:eid('longPackage'),paymentMethod:2,returnUrl:'http://localhost:5173/payment/result'};
  await expect('Another member cannot upgrade somebody else card','POST','/api/payments/upgrade-checkout',member,upBody,[403,404]);
  const up=await expect('Upgrade creates a SePay payment','POST','/api/payments/upgrade-checkout',other,upBody,[200]);
  if(up.status===200){
    f.upgradePayment=up.body;await save();
    const total=30,unused=19,credit=Math.floor(10000*unused/total/1000)*1000;
    a.check('Upgrade credit is rounded down to 1000 VND',up.body.amount===100000-credit,{response:up.body});
    const details=await a.request('GET','/api/payments/'+up.body.paymentId,other);
    a.check('Upgrade order exposes credit and package names',details.body.kind==='Upgrade'&&details.body.creditAmount===credit&&!!details.body.fromPackageName,{response:details.body});
    await cancelPayment(up.body.paymentId,other);
    const old=await a.request('GET','/api/memberships/'+eid('otherActiveCard'),reception);
    a.check('Cancelling unpaid upgrade preserves original card',old.body.status===1&&String(old.body.endDate).slice(0,10)===day(19),{response:old.body});
  }
  await expect('Same package is not an upgrade','POST','/api/payments/upgrade-checkout',other,{...upBody,membershipPackageId:eid('package')},[400,409]);
  const renewed=await expect('Reception renewal creates a new period and invoice','POST','/api/memberships/'+eid('otherActiveCard')+'/renew',reception,{},[200]);
  if(renewed.status===200){ f.renewal=renewed.body;await save(); }
  await expect('Pre-renewed card cannot upgrade over later period','POST','/api/payments/upgrade-checkout',other,upBody,[400,409]);
  await expect('Reception can cancel fixture current card','POST','/api/memberships/'+eid('otherActiveCard')+'/cancel',reception,{},[200]);
});

await attempt('Paid desk class refund workflow',async()=>{
  const desk=await make('deskPaidBooking','/api/class-bookings',reception,booking('otherMember','paidClass'));
  if(![200,201].includes(desk.status))return;
  const b=desk.body;f.deskPaidBooking=b;await save();
  a.check('Desk payment is immediately confirmed',b.status===1&&Number(b.price)>0&&!!b.invoiceId,{response:b});
  const cancelled=await cancelBooking(b,reception,'otherMember');
  a.check('Before-start cancellation records full refund amount',cancelled.status===200&&Number(cancelled.body?.refundAmount)===Number(b.price),{response:cancelled.body});
  const payment=await a.request('GET','/api/payments/'+b.invoiceId,reception);
  f.refundPayment=payment.body;await save();
  process.stdout.write('REFUND_CONTRACT '+JSON.stringify(payment.body)+'\n');
  await expect('Member cannot confirm refund manually','POST','/api/payments/'+b.invoiceId+'/refund-confirm',other,{reference:note},[403]);
  await expect('Refund confirmation validates reference','POST','/api/payments/'+b.invoiceId+'/refund-confirm',reception,{reference:''},[400]);
  if(payment.body?.refundPending){
    await expect('Reception confirms fixture cash refund','POST','/api/payments/'+b.invoiceId+'/refund-confirm',reception,{reference:note},[200,204]);
    await expect('Refund is no longer pending after confirmation','GET','/api/payments/'+b.invoiceId,reception,undefined,[200],(p)=>p.refundPending===false&&!!p.refundReference);
  }else{
    await expect('Refund confirm rejects an order with no pending refund','POST','/api/payments/'+b.invoiceId+'/refund-confirm',reception,{reference:note},[400,409]);
  }
});

await attempt('Started classes, attendance, training ownership',async()=>{
  const bk=await make('attendanceBooking','/api/class-bookings',member,booking('member','attendanceClass'));
  if(![200,201].includes(bk.status))return;
  const session={...f.entities.attendanceClassSession.request,date:date(-1)};
  await expect('Move fixture session into the past','PUT','/api/class-sessions/'+eid('attendanceClassSession'),manager,session,[200,204]);
  f.entities.attendanceClassSession.request=session;await save();
  await expect('B56 member cannot book class after first session','POST','/api/class-bookings',other,booking('otherMember','attendanceClass'),[400]);
  await expect('B56 receptionist cannot book started class','POST','/api/class-bookings',reception,booking('otherMember','attendanceClass'),[400]);
  await expect('B56 checkout rejects started class','POST','/api/payments/class-checkout',other,checkout('attendanceClass'),[400]);
  await expect('B58 manager cannot delete started class','DELETE','/api/classes/'+eid('attendanceClass'),manager,undefined,[400]);
  const attendance={sessionId:eid('attendanceClassSession'),memberId:uid('member'),status:1,recordedBy:f.users.manager.accountId};
  await expect('Reception cannot record class attendance','POST','/api/attendances',reception,attendance,[403]);
  await expect('Other coach cannot record this class attendance','POST','/api/attendances',roles.otherCoach,attendance,[403]);
  const marked=await make('attendance','/api/attendances',coach,attendance);
  if([200,201].includes(marked.status)){
    a.check('Attendance ignores forged recordedBy and uses current coach account',marked.body.recordedBy===f.users.coach.accountId,{response:marked.body});
    await expect('Duplicate attendance rejected','POST','/api/attendances',coach,attendance,[400,409]);
    await expect('Own coach can update attendance','PUT','/api/attendances/'+idOf(marked.body),coach,{status:2,recordedBy:f.users.manager.accountId},[200,204]);
    await expect('Restore present for training result','PUT','/api/attendances/'+idOf(marked.body),coach,{status:1,recordedBy:f.users.coach.accountId},[200,204]);
    await expect('Other coach cannot edit attendance','PUT','/api/attendances/'+idOf(marked.body),roles.otherCoach,{status:2,recordedBy:f.users.otherCoach.accountId},[403]);
  }
  const planBody={coachId:uid('coach'),memberId:uid('member'),classId:eid('attendanceClass'),title:f.prefix+' Plan',contentDescription:note,createdDate:date(0)};
  const plan=await make('plan','/api/training-plans',coach,planBody);
  if([200,201].includes(plan.status)){
    await expect('Own coach updates training plan','PUT','/api/training-plans/'+idOf(plan.body),coach,{...planBody,title:f.prefix+' Plan updated'},[200,204]);
    await expect('Other coach cannot edit training plan','PUT','/api/training-plans/'+idOf(plan.body),roles.otherCoach,{...planBody,coachId:uid('otherCoach')},[403]);
    const resultBody={planId:idOf(plan.body),memberId:uid('member'),coachId:uid('coach'),sessionId:eid('attendanceClassSession'),performanceScore:7.5,coachComment:note,evaluationDate:date(-1)};
    const result=await make('trainingResult','/api/training-results',coach,resultBody);
    if([200,201].includes(result.status)){
      a.check('Training result persists explicit sessionId',result.body.sessionId===eid('attendanceClassSession'),{response:result.body});
      await expect('Own coach updates training result','PUT','/api/training-results/'+idOf(result.body),coach,{...resultBody,performanceScore:8},[200,204]);
      await expect('Other coach cannot edit training result','PUT','/api/training-results/'+idOf(result.body),roles.otherCoach,{...resultBody,performanceScore:5},[403]);
    }
    await expect('Training result rejects score above 10','POST','/api/training-results',coach,{...resultBody,performanceScore:11},[400]);
    await expect('Training result rejects session outside plan class','POST','/api/training-results',coach,{...resultBody,sessionId:eid('freeClassSession')},[400]);
  }
  const bulk=await expect('B49 coach creates whole class plan atomically','POST','/api/training-plans/class/'+eid('attendanceClass'),coach,{title:f.prefix+' Bulk plan',contentDescription:note,createdDate:date(0)},[200,201]);
  f.bulkPlanResult=bulk.body;
  await expect('Other coach cannot create plan for this class','POST','/api/training-plans/class/'+eid('attendanceClass'),roles.otherCoach,{title:f.prefix+' Forbidden',contentDescription:note,createdDate:date(0)},[403]);
  await expect('Coach cannot plan for student outside class','POST','/api/training-plans',coach,{...planBody,memberId:uid('otherMember')},[400,403]);
});

await attempt('Notifications, support, audit and AI',async()=>{
  const sent=await make('notification','/api/notifications',coach,{accountIds:[f.users.member.accountId],title:f.prefix+' notice',message:note});
  if([200,201].includes(sent.status)){
    const inbox=await a.request('GET','/api/notifications/me?pageSize=100',member);
    const n=rowsOf(inbox.body).find((x)=>x.title===f.prefix+' notice');
    a.check('B57 notification carries server sender identity',!!n?.senderName&&n.senderRole==='Coach'&&n.senderAccountId===f.users.coach.accountId,{response:n});
    if(n){
      f.notificationId=n.id;await save();
      await expect('Other account cannot read-mark notification','PUT','/api/notifications/'+n.id+'/read',other,{},[403,404]);
      await expect('Member marks own notification read','PUT','/api/notifications/'+n.id+'/read',member,{},[200,204]);
      await expect('Member marks own inbox read','PUT','/api/notifications/read-all',member,{},[200,204]);
      await expect('Member deletes own test notification','DELETE','/api/notifications/'+n.id,member,undefined,[200,204]);
    }
  }
  await expect('Coach cannot notify unrelated account','POST','/api/notifications',coach,{accountIds:[f.users.reception.accountId],title:f.prefix+' forbidden',message:note},[403]);
  await expect('Notification requires recipients','POST','/api/notifications',manager,{accountIds:[],title:f.prefix+' empty',message:note},[400]);
  await expect('Member cannot send staff notifications','POST','/api/notifications',member,{accountIds:[f.users.otherMember.accountId],title:f.prefix+' forbidden',message:note},[403]);
  const support=await make('support','/api/support-requests',member,{content:note});
  if([200,201].includes(support.status)){
    await expect('Reception resolves fixture support request','PUT','/api/support-requests/'+idOf(support.body),reception,{status:3,resolution:note},[200,204]);
    await expect('Member cannot resolve support request','PUT','/api/support-requests/'+idOf(support.body),member,{status:3,resolution:note},[403]);
    const otherRequests=await a.request('GET','/api/support-requests',other);
    a.check('Support data is scoped to owner',!rowsOf(otherRequests.body).some((x)=>idOf(x)===idOf(support.body)),{response:otherRequests.body});
  }
  const log=await make('auditLog','/api/audit-logs',manager,{accountId:f.users.coach.accountId,actionType:'QA_AUDIT',description:note});
  if([200,201].includes(log.status))a.check('Manual audit actor comes from JWT, not client spoof',log.body.accountId===f.users.manager.accountId,{response:log.body});
  await expect('Member AI chat endpoint returns useful answer','POST','/api/ai/chat',member,{message:'Trung tam co nhung goi tap nao?',history:[]},[200],(b)=>!!b&&JSON.stringify(b).length>30);
  await expect('Coach AI exercise suggestions','POST','/api/ai/exercise-suggestions',coach,{memberId:uid('member'),goal:'Tang suc ben, bai tap nhe',durationMinutes:20,equipment:'bodyweight',level:'beginner'},[200],(b)=>!!b&&JSON.stringify(b).length>30);
  await expect('AI suggestions reject unrelated member','POST','/api/ai/exercise-suggestions',coach,{memberId:uid('otherMember'),goal:'QA scope test',durationMinutes:20},[403,404]);
  await expect('Member cannot use coach AI endpoint','POST','/api/ai/exercise-suggestions',member,{goal:'QA scope test',durationMinutes:20},[403]);
  await expect('AI chat validates message','POST','/api/ai/chat',member,{message:''},[400]);
  await expect('AI suggestions validate duration','POST','/api/ai/exercise-suggestions',coach,{goal:'QA',durationMinutes:1},[400]);
});

await attempt('Account permissions and no-op audit',async()=>{
  const before=await a.request('GET','/api/audit-logs?pageSize=500',manager);
  const r=f.entities.room.request;
  await expect('Save unchanged room for no-op audit check','PUT','/api/rooms/'+eid('room'),manager,{...r,capacity:31},[200,204]);
  const after=await a.request('GET','/api/audit-logs?pageSize=500',manager);
  const oldIds=new Set(rowsOf(before.body).map((x)=>x.id));
  const added=rowsOf(after.body).filter((x)=>!oldIds.has(x.id)&&String(x.description).includes(eid('room')));
  a.check('B40 unchanged save produces no additional entity audit entry',added.length===0,{response:added});
  const u=f.users.otherCoach;
  const account={username:u.username,email:u.email,fullName:u.fullName,phone:u.phone,role:2,status:1};
  await expect('Manager updates fixture account','PUT','/api/accounts/'+u.accountId,manager,account,[200,204]);
  await expect('Reception cannot edit accounts','PUT','/api/accounts/'+u.accountId,reception,account,[403]);
  await expect('B50 prevent changing own manager role','PUT','/api/accounts/'+f.users.manager.accountId,manager,{username:f.users.manager.username,email:f.users.manager.email,fullName:f.users.manager.fullName,phone:f.users.manager.phone,role:3,status:1},[400,403,409]);
  const prohibited={username:('qa_'+f.run+'_managerregister').toLowerCase(),email:('qa_'+f.run+'_managerregister').toLowerCase()+'@example.invalid',password:PASSWORD,fullName:f.prefix+' forbidden manager register',phone:'08'+f.run.slice(-6)+'99',dob:'2000-01-01T00:00:00Z',gender:'Other',trainingGoal:note};
  const reg=await a.request('POST','/api/auth/register',manager,prohibited);
  a.check('B58 manager cannot register member at desk',reg.status===403,{status:reg.status,response:reg.body});
  if(reg.status===200){f.unexpectedRegisteredUser={...prohibited,accountId:idOf(reg.body)};delete f.unexpectedRegisteredUser.password;await save();}
});

await attempt('Media upload validation',async()=>{
  const bad=new FormData();bad.append('file',new Blob(['QA not an image'],{type:'text/plain'}),'qa.txt');
  const res=await a.request('POST','/api/media/images',manager,bad);
  a.check('Upload rejects text masquerading as image',res.status===400,{status:res.status,response:res.body});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5sAAAAASUVORK5CYII=','base64');
  const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'qa-1px.png');
  const image=await a.request('POST','/api/media/images',member,form,{timeout:60000});
  a.check('Signed-in member can upload actual PNG',image.status===200&&/^https:\/\//.test(image.body?.url),{status:image.status,response:image.body});
  if(image.body?.url)f.uploadedImageUrl=image.body.url;
  const huge=new FormData();huge.append('file',new Blob([Buffer.alloc(6*1024*1024)],{type:'image/png'}),'qa-large.png');
  const large=await a.request('POST','/api/media/images',manager,huge,{timeout:60000});
  a.check('Upload enforces 5 MiB limit',[400,413].includes(large.status),{status:large.status,response:large.body});
});

f.businessCompletedAt=new Date().toISOString();
f.pendingIds=pendingIds;f.paidInvoiceIds=paidInvoiceIds;
await save();
process.stdout.write('BUSINESS_DONE\n');
