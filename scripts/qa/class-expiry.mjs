import fs from 'node:fs/promises';
import path from 'node:path';
import {Audit,OUT,PASSWORD,rowsOf,sleep} from './api-audit.mjs';
const a=new Audit('class-expiry'),f=JSON.parse(await fs.readFile(path.join(OUT,'fixtures.json'),'utf8'));
a.spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const member=await a.login(f.users.otherMember.username,PASSWORD,'otherMember');
const reception=await a.login(f.users.reception.username,PASSWORD,'reception');
const classId=f.entities.paidClass.id;
const before=await a.request('GET','/api/classes/'+classId);
const p=await a.expect('Create isolated class hold for expiry test','POST','/api/payments/class-checkout',member,{classId,paymentMethod:2,returnUrl:'http://localhost:5173/payment/result'},[200]);
if(p.status!==200){await a.save();process.exit(1);}
const id=p.body.paymentId;
await fs.writeFile(path.join(OUT,'expiry-hold.json'),JSON.stringify({payment:p.body,classId,memberId:f.users.otherMember.profileId,createdAt:new Date().toISOString()},null,2));
const held=await a.request('GET','/api/classes/'+classId);
a.check('Pending class payment holds one seat',held.body.currentEnrolled===before.body.currentEnrolled+1,{response:held.body});
// The legacy confirm route is tested separately: never settle this expiry fixture.
const detail=await a.request('GET','/api/payments/'+id,member);
a.check('Unpaid SePay order remains pending',detail.body.status===1,{response:detail.body});
await a.save();
const stop=Date.parse(detail.body.expiresAt)+90000;
process.stdout.write('CLASS_EXPIRY_WAIT '+JSON.stringify({paymentId:id,expiresAt:detail.body.expiresAt})+'\n');
if(detail.body.status===1){
 while(Date.now()<stop){await sleep(Math.min(30000,Math.max(1000,stop-Date.now())));const r=await a.request('GET','/api/payments/'+id,member);if(r.body?.status!==1)break;}
}
const final=await a.request('GET','/api/payments/'+id,member);
a.check('Class payment becomes Expired after hold',final.body.status===5,{response:final.body});
await sleep(30000); await sleep(35000);
const cls=await a.request('GET','/api/classes/'+classId);
const bookings=await a.request('GET','/api/members/me/class-bookings',member);
const own=rowsOf(bookings.body).find(x=>x.id===final.body.bookingId);
const invoice=await a.request('GET','/api/invoices/'+id,reception);
a.check('Expired class hold releases capacity',cls.body.currentEnrolled===before.body.currentEnrolled,{response:cls.body});
a.check('Expired class booking is cancelled',own?.status===3,{response:own});
a.check('Expired class invoice is cancelled',invoice.body.status===3,{response:invoice.body});
await a.save();process.stdout.write('CLASS_EXPIRY_DONE\n');

