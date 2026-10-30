import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, OUT, rowsOf } from './api-audit.mjs';
const a=new Audit('cleanup-tail');
a.spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const admin=await a.login('demo_manager','123456','manager_cleanup');
const PREFIX='QA261029163854';
const classId='ce37f5d3-bc88-4de8-95e5-a3186c2a1c1a';
const c=await a.request('GET','/api/classes/'+classId,admin);
if(c.status===200 && c.body.className?.startsWith(PREFIX)){
 const x=c.body;
 const closed=await a.expect('Close the only remaining synthetic QA class','PUT','/api/classes/'+classId,admin,{className:x.className,categoryId:x.categoryId,coachId:x.coachId,maxCapacity:x.maxCapacity,price:x.price,startDate:x.startDate,endDate:x.endDate,status:4},[200,204]);
 if([200,204].includes(closed.status))await a.expect('Delete cancelled synthetic QA class','DELETE','/api/classes/'+classId,admin,undefined,[200,204]);
}
const invoiceId='99c3136e-4e84-4735-87c0-c38b5e071251';
const detail=await a.request('GET','/api/invoices/'+invoiceId,admin);
const list=await a.request('GET','/api/invoices',admin);
a.check('Record post-delete invoice visibility',true,{invoiceId,detailStatus:detail.status,detail:detail.body,inList:rowsOf(list.body).some(x=>x.id===invoiceId)});
for(const [collection,id,key] of [['coaches','53698bc7-76dc-4e09-85bb-775040b90870','fullName'],['categories','88a8990c-0afe-4f96-9384-48ce49884531','categoryName']]){
 const p=await a.request('GET','/api/'+collection+'/'+id,admin);
 if(p.status===200 && p.body[key]?.startsWith(PREFIX))await a.expect('Try removing now unreferenced QA '+collection,'DELETE','/api/'+collection+'/'+id,admin,undefined,[200,204,400,409]);
}
const classes=await a.request('GET','/api/classes',admin);
a.check('No active visible class from this QA run remains',classes.status===200&&!rowsOf(classes.body).some(x=>x.className?.startsWith(PREFIX)&&[1,2].includes(x.status)),{remaining:rowsOf(classes.body).filter(x=>x.className?.startsWith(PREFIX))});
await a.save();
