// Actual FE modules, controlled responses only. No network or business data writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const run=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve('artifacts/web-review-2026-11-02/regressions',run);
const results=[];
const original={fetch:globalThis.fetch,localStorage:globalThis.localStorage,tz:process.env.TZ};
let handler=async()=>{throw new Error('Unexpected mock request')},calls=[];
globalThis.localStorage={getItem:()=> 'unit-token'};
globalThis.fetch=async(url,options)=>{calls.push({url,method:options.method});return handler(url,options)};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const test=async(name,fn)=>{try{calls=[];await fn();results.push({name,passed:true});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:String(error.stack??error)});console.log('FAIL '+name+': '+error.message)}};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try{
 const {request,ApiError}=await server.ssrLoadModule('/src/api/client.js');
 const {api}=await server.ssrLoadModule('/src/api/endpoints.js');
 await test('AI wrapper sends actual endpoint, JSON and bearer header',async()=>{
  handler=async(url,options)=>{assert.equal(url,'/api/ai/chat');assert.equal(options.headers.Authorization,'Bearer unit-token');assert.equal(options.headers['Content-Type'],'application/json');assert.equal(JSON.parse(options.body).message,'Test');return json({reply:'Actual response text',provider:'Gemini'})};
  assert.equal((await api.ai.chat({message:'Test',history:[]})).reply,'Actual response text');assert.equal(calls.length,1);
 });
 await test('JSON ProblemDetails503 preserves provider detail instead of offline sample mode',async()=>{
  handler=async()=>json({title:'AI temporarily unavailable',detail:'Provider response is too slow'},503);
  await assert.rejects(request('GET','/unit'),e=>e instanceof ApiError&&e.status===503&&!e.offline&&e.message==='Provider response is too slow');assert.equal(calls.length,1);
 });
 await test('JSON message503 remains a server error with exact status',async()=>{
  handler=async()=>json({message:'Gemini đang quá tải'},503);
  await assert.rejects(request('GET','/unit'),e=>e.status===503&&!e.offline&&e.message==='Gemini đang quá tải');
 });
 await test('Gateway HTML503 is offline rather than a fake successful API result',async()=>{
  handler=async()=>new Response('<html>Gateway unavailable</html>',{status:503});
  await assert.rejects(request('GET','/unit'),e=>e.status===503&&e.offline);
 });
 await test('Caller cancellation stays AbortError and does not become offline',async()=>{
  const controller=new AbortController();handler=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
  const pending=request('POST','/unit',{}, {signal:controller.signal});controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError'&&!e.offline);
 });
 await test('Explicit deadline releases a stalled request as TimeoutError',async()=>{
  handler=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
  await assert.rejects(request('POST','/unit',{}, {timeoutMs:10}),e=>e.name==='TimeoutError'&&e.timeout&&!e.offline);
 });
 await test('Deadline also covers a stalled response body',async()=>{
  handler=async(url,options)=>({status:200,ok:true,text:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))});
  await assert.rejects(request('GET','/unit',undefined,{timeoutMs:10}),e=>e.name==='TimeoutError'&&e.timeout);
 });
 await test('Reads use45seconds; writes have no automatic retry or deadline',async()=>{
  const old=globalThis.setTimeout,delays=[];globalThis.setTimeout=(fn,ms,...rest)=>{delays.push(ms);return old(fn,ms,...rest)};
  handler=async()=>json({ok:true});
  try{await request('GET','/unit');assert.deepEqual(delays,[45000]);delays.length=0;await request('POST','/unit',{amount:1});assert.equal(delays.length,0);assert.equal(calls.length,2)}finally{globalThis.setTimeout=old}
 });
 await test('Multipart keeps the browser Content-Type boundary',async()=>{
  handler=async(url,options)=>{assert.ok(options.body instanceof FormData);assert.equal(options.headers['Content-Type'],undefined);return json({ok:true})};
  const form=new FormData();form.append('file',new Blob(['unit']),'unit.txt');await request('POST','/unit',form);
 });
 await test('204 is an empty success',async()=>{handler=async()=>new Response(null,{status:204});assert.equal(await request('DELETE','/unit'),null)});
 await test('Blocked browser storage does not crash the fetch wrapper',async()=>{
  globalThis.localStorage={getItem:()=>{throw new Error('Storage unavailable')}};handler=async(url,options)=>{assert.equal(options.headers.Authorization,undefined);return json({public:true})};
  try{assert.equal((await request('GET','/unit')).public,true)}finally{globalThis.localStorage={getItem:()=> 'unit-token'}}
 });
 await test('Network failure is explicit and is not retried',async()=>{handler=async()=>{throw new TypeError('Connection failed')};await assert.rejects(request('GET','/unit'),e=>e.offline);assert.equal(calls.length,1)});
 const format=await server.ssrLoadModule('/src/lib/format.js');
 const classes=await server.ssrLoadModule('/src/lib/classes.js');
 process.env.TZ='America/Los_Angeles';
 await test('Business calendar crosses Vietnam midnight regardless of visitor timezone',async()=>{assert.equal(format.todayLocalDateString(new Date('2026-11-02T17:00:00Z')),'2026-11-03')});
 const session={classId:'class',date:'2026-11-02T00:00:00Z',startTime:'18:00:00',endTime:'19:00:00'};
 await test('Booking/refund cutoff uses the exact Vietnam session start',async()=>{
  assert.equal(format.isSessionStarted(session,new Date('2026-11-02T10:59:59Z')),false);assert.equal(format.isSessionStarted(session,new Date('2026-11-02T11:00:00Z')),true);
  assert.equal(classes.classStarted({id:'class',status:1},[session],new Date('2026-11-02T11:00:00Z')),true);
 });
 await test('Session completion uses the Vietnam end time',async()=>{assert.equal(format.isSessionOver(session,new Date('2026-11-02T11:59:59Z')),false);assert.equal(format.isSessionOver(session,new Date('2026-11-02T12:00:00Z')),true)});
 await test('Class date fallback and deletion guard share the center day',async()=>{
  const now=new Date('2026-11-02T17:00:00Z');assert.equal(classes.classStarted({id:'class',status:1,startDate:'2026-11-02'},[],now),true);assert.equal(classes.classRunning({id:'class',status:1,startDate:'2026-11-01',endDate:'2026-11-02'},[],now),false);
 });
 if(original.tz===undefined)delete process.env.TZ;else process.env.TZ=original.tz;
 const {resources}=await server.ssrLoadModule('/src/pages/staff/resources.jsx');
 await test('All four staff date defaults accept CrudPage(user) invocation',async()=>{
  let count=0;for(const key of ['schedule','memberships','trainingPlans','trainingResults'])for(const field of resources[key].fields)if(field.type==='date'&&typeof field.defaultValue==='function'){assert.match(field.defaultValue({role:'Coach',accountId:'test-user'}),/^\d{4}-\d{2}-\d{2}$/);count++}assert.equal(count,4);
 });
 const ai=await server.ssrLoadModule('/src/lib/ai.js');
 await test('AI accepts real AiReply content and rejects generic HTTP200 error text',async()=>{assert.throws(()=>ai.aiReply({message:'Provider error'}));assert.equal(ai.aiReply({reply:'Valid answer',disclaimer:'Review first'}).text,'Valid answer')});
 await test('AI context excludes pending/failed messages and retains only completed pairs',async()=>{
  const history=ai.aiHistory([{state:'done',question:'one',answer:'two'},{state:'failed',question:'secretfailed'},{state:'pending',question:'pending'}]);assert.deepEqual(history,[{role:'user',content:'one'},{role:'assistant',content:'two'}]);
 });
}finally{await server.close();globalThis.fetch=original.fetch;globalThis.localStorage=original.localStorage;if(original.tz===undefined)delete process.env.TZ;else process.env.TZ=original.tz}
await fs.mkdir(out,{recursive:true});const summary={recordedAt:new Date().toISOString(),checks:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,scope:'Real modules via ViteSSR; controlled fetch; no network/business writes.'};await fs.writeFile(path.join(out,'report.json'),JSON.stringify({summary,results},null,2));console.log('REPORT '+path.join(out,'report.json'));console.log('SUMMARY '+JSON.stringify(summary));if(summary.failed)process.exitCode=1;