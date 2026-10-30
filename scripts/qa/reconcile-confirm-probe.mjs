import fs from 'node:fs/promises';
import path from 'node:path';
import {Audit,OUT,PASSWORD} from './api-audit.mjs';
const a=new Audit('confirm-bypass'),f=JSON.parse(await fs.readFile(path.join(OUT,'fixtures.json'),'utf8'));
a.spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const h=JSON.parse(await fs.readFile(path.join(OUT,'expiry-hold.json'),'utf8'));
const member=await a.login(f.users.otherMember.username,PASSWORD,'otherMember'),desk=await a.login(f.users.reception.username,PASSWORD,'reception');
const p=await a.request('GET','/api/payments/'+h.payment.paymentId,member);
a.check('Unaudited bank transfer was marked paid by legacy confirm',p.body.status===2&&p.body.provider==='SePay',{response:p.body});
if(p.body.status===2){
 await a.expect('Cancel only the QA booking created by confirm probe','DELETE','/api/class-bookings/'+p.body.bookingId+'/member/'+f.users.otherMember.profileId,member,undefined,[200]);
 const r=await a.request('GET','/api/payments/'+p.body.paymentId,desk);
 if(r.body.refundPending)await a.expect('Reconcile QA-only ledger without moving real funds','POST','/api/payments/'+p.body.paymentId+'/refund-confirm',desk,{reference:f.prefix+' synthetic QA; no actual bank transfer'},[200]);
}
await fs.copyFile(path.join(OUT,'class-expiry.json'),path.join(OUT,'initial-confirm-probe.json'));
await a.save();
const file=path.join(import.meta.dirname,'class-expiry.mjs');
let code=await fs.readFile(file,'utf8');
const start=code.indexOf("const confirm=await a.request("),end=code.indexOf("const detail=await a.request(",start);
if(start<0||end<0)throw new Error('Missing expiry script edit anchor');
code=code.slice(0,start)+"// The legacy confirm route is tested separately: never settle this expiry fixture.\n"+code.slice(end);
code=code.replace("'Denied manual confirm leaves SePay order pending'","'Unpaid SePay order remains pending'");
code=code.replace('await sleep(65000);','await sleep(30000); await sleep(35000);');
await fs.writeFile(file,code);

