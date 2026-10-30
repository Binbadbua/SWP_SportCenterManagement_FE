import fs from 'node:fs/promises';
import path from 'node:path';
import {OUT} from './api-audit.mjs';
const spec=JSON.parse(await fs.readFile(path.join(OUT,'swagger.json'),'utf8'));
const names=['bootstrap','business','followup','training-recovery','read-api','initial-confirm-probe','confirm-bypass','class-expiry','policy-final','additional-api','ui-refund-setup','cleanup','cleanup-tail'];
const reports=[];
for(const name of names){try{reports.push({...JSON.parse(await fs.readFile(path.join(OUT,name+'.json'),'utf8')),name});}catch(e){if(e.code!=='ENOENT')throw e;}}
const calls=reports.flatMap(r=>(r.calls??[]).map(c=>({...c,report:r.name})));
const escape=s=>s.replace(/[.*+?^{}()|[\]\\]/g,'\\$&');
const operations=Object.entries(spec.paths).flatMap(([p,methods])=>Object.keys(methods).filter(m=>['get','post','put','delete','patch'].includes(m)).map(m=>({method:m.toUpperCase(),path:p,literals:p.replace(/\{[^}]+\}/g,'').length,params:(p.match(/\{/g)||[]).length,re:new RegExp('^'+p.split('/').map(s=>/^\{.+\}$/.test(s)?'[^/]+':escape(s)).join('/')+'$'),calls:[]}))).sort((a,b)=>a.params-b.params||b.literals-a.literals);
for(const c of calls){const op=operations.find(o=>o.method===c.method&&o.re.test(c.endpoint.split('?')[0]));if(op)op.calls.push(c);}
const coverage=operations.map(({method,path,calls})=>({method,path,requests:calls.length,statuses:[...new Set(calls.map(c=>c.status))].sort((a,b)=>a-b),roles:[...new Set(calls.map(c=>c.role))],success:calls.some(c=>c.status>=200&&c.status<300)})).sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
const summary={baseUrl:'https://sportcenter-deploy-latest-1.onrender.com',generatedAt:new Date().toISOString(),timezone:'Asia/Bangkok',requests:calls.length,operations:coverage.length,operationsCalled:coverage.filter(c=>c.requests).length,operationsWithSuccess:coverage.filter(c=>c.success).length,missing:coverage.filter(c=>!c.requests),sourceReports:reports.map(r=>({...r.summary,name:r.name}))};
await fs.writeFile(path.join(OUT,'coverage.json'),JSON.stringify({summary,coverage},null,2));
const lines=['# SportCenter API audit — 29–30/10/2026','','API: '+summary.baseUrl,'','Recorded at '+summary.generatedAt+'; local timezone Asia/Bangkok.','',summary.requests+' requests across '+summary.operationsCalled+'/'+summary.operations+' documented operations. '+summary.operationsWithSuccess+' operations returned at least one 2xx.','',
'Coverage means a request reached the documented operation; authentication/validation/not-found cases do not prove a successful business flow. A bank transfer and authenticated SePay webhook were not performed. No real payment or refund was sent.','',
'The first business attempt used an account ID where a member ID was required; affected cases were rerun with /members/me IDs. Training cases after deliberately probing class deletion were replaced by a separate training fixture. Raw reports retain their original checks; a FAIL may be a changed policy/contract, a blocked external service, or a confirmed defect. Consult the dated project changelog for adjudicated findings.','',
'| Method | Endpoint | Requests | HTTP statuses | 2xx observed |','|---|---|---:|---|---|',
...coverage.map(c=>'| '+c.method+' | '+c.path+' | '+c.requests+' | '+c.statuses.join(', ')+' | '+(c.success?'yes':'no')+' |')];
await fs.writeFile(path.join(OUT,'API_COVERAGE.md'),lines.join('\n')+'\n');
process.stdout.write('COVERAGE '+JSON.stringify(summary)+'\n');

