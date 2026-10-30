// User-authorized sample course fees. Only PUT /api/classes/{id} can mutate business records.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Audit, BASE, ROOT } from './api-audit.mjs';
const OUT=path.join(ROOT,'artifacts/class-pricing-2026-10-30');
const mode=process.argv.includes('--apply')?'apply':'prepare';
const fees = [
 ['Boxing Đốt Mỡ Cấp Tốc',1500000],['Yoga Chào Mặt Trời',900000],
 ['Bơi Lội Trẻ Em K2',1200000],['Pilates Trị Liệu Cột Sống',1800000],
 ['Zumba Sôi Động Cuối Tuần',800000],['Kickboxing Căn Bản Nữ',1600000],
 ['Cầu Lông Sinh Viên',600000],['Bóng Rổ Thiếu Niên U15',1000000],
 ['Gym Kỹ Thuật Nâng Cao',2000000],['Đạp Xe Cardio Giảm Cân',900000],
 ['Tennis Cơ Bản Cho Người Mới',2400000],['Bóng Bàn Phản Xạ Nhanh',1000000],
 ['Futsal Phong Trào Tối Thứ 3-5',750000],['Chạy Bộ 10K Buổi Sáng',600000],
 ['HIIT Đốt Mỡ 45 Phút',1200000],['Bóng Chuyền Hơi Nam Nữ',650000],
 ['Taekwondo Thiếu Niên',1500000],['Muay Thai Kỹ Thuật Đối Kháng',1800000],
 ['Pickleball Nhập Môn',1600000],['Leo Núi Trong Nhà Cơ Bản',2200000],
];
const fields=['className','categoryId','coachId','maxCapacity','startDate','endDate','status'];
const rowList=b=>Array.isArray(b)?b:Array.isArray(b?.data)?b.data:b?.items??b?.data?.items??[];
const projection=c=>Object.fromEntries(fields.map(k=>[k,c[k]]));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const a=new Audit('class-pricing-'+mode);
const manager=await a.login(process.env.QA_MANAGER_USER||'demo_manager',process.env.QA_MANAGER_PASSWORD||'123456','manager');
await fs.mkdir(OUT,{recursive:true});
async function get(url) {const r=await a.request('GET',url,manager);if(r.status!==200)throw new Error(url+' HTTP '+r.status);return r.body;}
async function financials() {
 const invoices=rowList(await get('/api/invoices')).map(x=>({id:x.id,amount:x.amount,paymentMethod:x.paymentMethod,status:x.status,memberMembershipId:x.memberMembershipId,classBookingId:x.classBookingId})).sort((x,y)=>x.id.localeCompare(y.id));
 const members=rowList(await get('/api/members?pageIndex=1&pageSize=500'));
 if(members.length>=500)throw new Error('Member inventory needs pagination before an accurate booking comparison');
 const bookings=[];
 for(const m of members){
  const id=m.id??m.memberId;
  const list=rowList(await get('/api/class-bookings/member/'+id));
  bookings.push(...list.map(x=>({id:x.id,classId:x.classId,price:x.price,originalPrice:x.originalPrice,discountPercent:x.discountPercent,invoiceId:x.invoiceId,status:x.status})));
 }
 return {invoices,bookings:bookings.sort((x,y)=>x.id.localeCompare(y.id))};
}
const report={baseUrl:BASE,mode,recordedAt:new Date().toISOString(),results:a.results,changes:[],checks:[],limitations:[]};
const save=async()=>{report.recordedAt=new Date().toISOString();report.results=a.results;report.calls=a.calls.map(c=>({...c,body:/^\/api\/classes(\/|$)/.test(c.endpoint)||c.status>=400?c.body:'[response omitted; snapshot contains relevant fields]'}));await fs.writeFile(path.join(OUT,mode+'.json'),JSON.stringify(report,null,2));};
try {
 if(mode==='prepare'){
  const classes=rowList(await get('/api/classes'));
  const plan=fees.map(([name,price])=>{const matches=classes.filter(c=>c.className===name);if(matches.length!==1)throw new Error('Class name must uniquely match: '+name);const c=matches[0];return {id:c.id,className:name,beforePrice:c.price,price,before:c};});
  const other=classes.filter(c=>!fees.some(([name])=>name===c.className));
  const finances=await financials();
  const sessions=rowList(await get('/api/class-sessions'));
  const snapshot={recordedAt:new Date().toISOString(),baseUrl:BASE,manager:{username:manager.username,accountId:manager.accountId},meaning:'Sample fee for the entire course, not per session or a membership price; not a market price survey.',plan,otherClasses:other,sessions,finances};
  await fs.writeFile(path.join(OUT,'before.json'),JSON.stringify(snapshot,null,2),{flag:'wx'});
  report.plan=plan.map(({id,className,beforePrice,price})=>({id,className,beforePrice,price}));
  a.check('Every requested demo class matched exactly once',plan.length===20);
  a.check('All sample fees are positive integer dong values',plan.every(c=>Number.isInteger(c.price)&&c.price>0));
  process.stdout.write('PLAN '+JSON.stringify(report.plan)+'\n');
 } else {
  const before=JSON.parse(await fs.readFile(path.join(OUT,'before.json'),'utf8'));
  if(before.baseUrl!==BASE||before.plan.length!==20)throw new Error('Prepared deployment/plan does not match');
  for(const p of before.plan){
   const current=await get('/api/classes/'+p.id);
   if(!equal(projection(current),projection(p.before)))throw new Error('Another field changed before update: '+p.className);
   if(current.price!==p.beforePrice&&current.price!==p.price)throw new Error('Price changed concurrently for '+p.className);
   const body={...projection(current),price:p.price};
   let status='already-set';
   if(current.price!==p.price){
    const r=await a.request('PUT','/api/classes/'+p.id,manager,body);
    if(![200,204].includes(r.status))throw new Error(p.className+' update HTTP '+r.status+' '+JSON.stringify(r.body));
    status=r.status;
   }
   const check=await get('/api/classes/'+p.id);
   a.check('Saved fee and unchanged class details: '+p.className,check.price===p.price&&equal(projection(check),projection(p.before)),{classId:p.id,price:check.price});
   if(check.price!==p.price||!equal(projection(check),projection(p.before)))throw new Error('Read-back verification failed');
   report.changes.push({id:p.id,className:p.className,oldPrice:p.beforePrice,price:check.price,status});
   await save();
  }
  const classes=rowList(await get('/api/classes'));
  a.check('Public class list exposes all 20 new fees',before.plan.every(p=>classes.some(c=>c.id===p.id&&c.price===p.price)));
  const other=classes.filter(c=>!before.plan.some(p=>p.id===c.id));
  a.check('No other class fee or details changed',equal(other,before.otherClasses));
  const sessions=rowList(await get('/api/class-sessions'));
  a.check('Session dates, rooms and times remain unchanged',equal(sessions,before.sessions));
  const after=await financials();
  const money=b=>({id:b.id,classId:b.classId,price:b.price,originalPrice:b.originalPrice,discountPercent:b.discountPercent,invoiceId:b.invoiceId});
  const existingBookingAmountsUnchanged=before.finances.bookings.every(b=>equal(money(b),money(after.bookings.find(x=>x.id===b.id)??{})));
  a.check('Existing booking prices and discounts remain unchanged',existingBookingAmountsUnchanged,{existingBookings:before.finances.bookings.length});
  a.check('Existing invoice amounts remain unchanged',before.finances.invoices.every(i=>after.invoices.some(j=>j.id===i.id&&j.amount===i.amount)),{existingInvoices:before.finances.invoices.length});
  await fs.writeFile(path.join(OUT,'after.json'),JSON.stringify({recordedAt:new Date().toISOString(),classes,sessions,finances:after},null,2));
  const lines=['# Học phí lớp mẫu — 30/10/2026','','Giá VNĐ cho **cả khóa**, trước giảm theo thẻ thành viên. Đây là dữ liệu mẫu được người dùng yêu cầu, không phải khảo sát giá thị trường.','','Manager có thể sửa tại **Khu vực nhân viên → Lớp học → Sửa → Học phí cả khóa (VND) → Lưu thay đổi**.','','| Lớp | Giá cũ | Giá mẫu/cả khóa |','|---|---:|---:|',...report.changes.map(x=>'| '+x.className+' | '+x.oldPrice.toLocaleString('vi-VN')+' đ | '+x.price.toLocaleString('vi-VN')+' đ |'),'','Đã xác minh GET từng lớp và danh sách công khai sau cập nhật. Chỉ gửi PUT các lớp trong before.json; giữ nguyên tên, môn, HLV, sĩ số, ngày, trạng thái và lịch học. Giá booking/hóa đơn cũ được đọc lại để xác minh không bị tính lại.','','Bằng chứng: before.json, prepare.json, apply.json, after.json và ui.json.'];
  await fs.writeFile(path.join(OUT,'CLASS_PRICES.md'),lines.join('\n')+'\n');
 }
} catch(error){report.error=String(error.stack??error);process.exitCode=1;process.stderr.write(report.error+'\n');}
finally{await save();process.stdout.write('SUMMARY '+JSON.stringify({mode,checks:a.results.length,passed:a.results.filter(r=>r.passed).length,failed:a.results.filter(r=>!r.passed).length,changes:report.changes.length,requests:a.calls.length,error:report.error??null})+'\n');}
