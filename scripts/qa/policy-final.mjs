import fs from 'node:fs/promises';
import path from 'node:path';
import {Audit,OUT,PASSWORD} from './api-audit.mjs';
const a=new Audit('policy-final'),f=JSON.parse(await fs.readFile(path.join(OUT,'fixtures.json'),'utf8'));
a.spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const manager=await a.login(f.users.manager.username,PASSWORD,'manager'),desk=await a.login(f.users.reception.username,PASSWORD,'reception');
const card=f.entities.activeCard;
await a.expect('Manager can correct dates of fixture membership','PUT','/api/memberships/'+card.id,manager,{startDate:card.request.startDate,endDate:card.request.endDate,status:1},[200,204]);
await a.expect('Reception missing membership delete is controlled','DELETE','/api/memberships/00000000-1111-4111-8111-000000000001',desk,undefined,[400,404]);
const p=await a.request('GET','/api/payments/'+f.packagePayment.paymentId,desk);
const inv=await a.request('GET','/api/invoices/'+f.packagePayment.paymentId,desk);
const m=await a.request('GET','/api/memberships/'+f.packagePayment.membershipId,desk);
a.check('Expired order synchronizes invoice and membership',p.body.status===5&&inv.body.status===3&&m.body.status===4,{response:{payment:p.body,invoice:inv.body,membership:m.body}});
await a.save();

