import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { todayCenterDateString, fromDateInput, formatDate } from '../../src/lib/format.js';
import { afterCheckout, timeLeft } from '../../src/lib/payments.js';
import { cancelTerms } from '../../src/lib/classes.js';
import { readNotification } from '../../src/lib/notifications.js';
const results = [];
function test(name, fn) { try { fn(); results.push({name, passed:true}); } catch(e) { results.push({name, passed:false, error:e.message}); } }
test('Vietnam day crosses midnight while UTC still has yesterday', () => {
 assert.equal(todayCenterDateString(new Date('2026-10-29T16:59:59Z')), '2026-10-29');
 assert.equal(todayCenterDateString(new Date('2026-10-29T17:00:00Z')), '2026-10-30');
 assert.equal(formatDate(fromDateInput('2026-10-30')), '30/10/2026');
});
test('SePay image payUrl stays on local authoritative payment result', () => {
 let to;
 afterCheckout({paymentId:'qa-id',payUrl:'https://qr.sepay.vn/img?acc=example'},2,url=>{to=url;});
 assert.equal(to,'/payment/result?paymentId=qa-id');
});
test('Zero-cost checkout has no payment navigation', () => {
 let called=false; assert.equal(afterCheckout({status:2},2,()=>{called=true;}),null); assert.equal(called,false);
});
test('Hold countdown ends without displaying a negative timer', () => {
 const start=Date.parse('2026-10-29T17:00:00Z');
 assert.equal(timeLeft('2026-10-29T17:01:01Z',start),'01:01');
 assert.equal(timeLeft('2026-10-29T17:01:01Z',start+61000),null);
});
test('Refund copy describes manual reception confirmation', () => {
 const terms=cancelTerms({price:10000,status:1},false); assert.match(terms.text,/lễ tân/); assert.match(terms.text,/chờ xác nhận/);
 assert.match(cancelTerms({price:10000,status:1},true).title,/Không được hoàn/);
});
test('Native sender overrides old signature without duplicating it', () => {
 const n=readNotification({senderName:'Coach QA',senderRole:'Coach',message:'Người gửi: Old Coach · HLV\nBuổi tập thay đổi'});
 assert.equal(n.sender,'Coach QA · Huấn luyện viên'); assert.equal(n.message,'Buổi tập thay đổi');
});
test('Old notification sender signatures still render', () => {
 assert.deepEqual(readNotification({message:'Người gửi: Lễ tân QA · Lễ tân\nNội dung'}),{sender:'Lễ tân QA · Lễ tân',message:'Nội dung'});
 assert.deepEqual(readNotification({message:'Thông báo tự động'}),{sender:'Trung tâm SportCenter',message:'Thông báo tự động'});
});
const summary={recordedAt:new Date().toISOString(),checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length};
await fs.writeFile(path.resolve('artifacts/api-audit-2026-10-29/fe-regressions.json'),JSON.stringify({summary,results},null,2));
for(const r of results) process.stdout.write((r.passed?'PASS ':'FAIL ')+r.name+(r.error?' '+r.error:'')+'\n');
process.stdout.write('SUMMARY '+JSON.stringify(summary)+'\n'); if(summary.failed)process.exitCode=1;
