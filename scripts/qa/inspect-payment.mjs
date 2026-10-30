import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, ROOT, BASE } from './api-audit.mjs';
const input=process.argv[2]??'';
const raw=input.replace(/^SWP/i,'').replaceAll('-','');
if(!/^[a-f0-9]{32}$/i.test(raw))throw new Error('Expected a payment UUID or SWP reference');
const id=[raw.slice(0,8),raw.slice(8,12),raw.slice(12,16),raw.slice(16,20),raw.slice(20)].join('-').toLowerCase();
const a=new Audit('payment-read-only');
const manager=await a.login('demo_manager','123456','Manager');
const payment=await a.request('GET','/api/payments/'+id,manager);
const invoice=await a.request('GET','/api/invoices/'+id,manager);
const out=path.join(ROOT,'artifacts','payment-investigation-2026-10-30',id);
await fs.mkdir(out,{recursive:true});
const report={recordedAt:new Date().toISOString(),baseUrl:BASE,reference:'SWP'+raw.toUpperCase(),paymentId:id,payment:{httpStatus:payment.status,data:payment.body},invoice:{httpStatus:invoice.status,data:invoice.body},scope:'Read only. No confirm, cancel, refund, webhook or bank operation performed.'};
try { await fs.copyFile(path.join(out,'snapshot.json'),path.join(out,'snapshot-initial.json'),fs.constants?.COPYFILE_EXCL ?? 1); } catch (error) { if (!['ENOENT','EEXIST'].includes(error.code)) throw error; }
await fs.writeFile(path.join(out,'snapshot-'+report.recordedAt.replace(/[:.]/g,'-')+'.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(out,'snapshot.json'),JSON.stringify(report,null,2));
const p=payment.body;
process.stdout.write(JSON.stringify({recordedAt:report.recordedAt,reference:report.reference,paymentId:id,httpStatus:payment.status,payment:p?{provider:p.provider,kind:p.kind,status:p.status,amount:p.amount,paymentReference:p.paymentReference,expiresAt:p.expiresAt,paidAt:p.paidAt,refundPending:p.refundPending,classId:p.classId,className:p.className,bankBin:p.bankBin,bankAccountEnding:p.bankAccountNumber?.slice(-4)}:null,invoice:{httpStatus:invoice.status,status:invoice.body?.status,paymentDate:invoice.body?.paymentDate,amount:invoice.body?.amount},reportFile:path.join(out,'snapshot.json')},null,2)+'\n');
