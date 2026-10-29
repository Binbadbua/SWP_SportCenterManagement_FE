// Sample data in the SAME shape as the API responses (see SWP_SportCenter.Service/*/Response.cs).
// Used in two cases:
//   1. API-backed pages when the back-end is offline ("Showing sample data" notice).
//   2. Preview pages for features that have no API yet (members, packages, memberships...).

const day = (offset) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().replace('.000Z', 'Z');
};
const stamp = (offset, hour = 9) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, 15, 0, 0);
  return d.toISOString();
};
const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ---- IDs used by the demo sign-in (Login page) ---------------------------
export const DEMO_IDS = {
  memberAccountId: '11111111-1111-1111-1111-111111111111',
  memberId: id('a1', 1),
  coachAccountId: '22222222-2222-2222-2222-222222222222',
  coachId: id('c1', 1),
  receptionistAccountId: '33333333-3333-3333-3333-333333333333',
  receptionistId: id('e1', 1),
  managerAccountId: '44444444-4444-4444-4444-444444444444',
};

export const categories = [
  { id: id('ca', 1), categoryName: 'Yoga', description: 'Chuỗi động tác theo nhịp thở giúp dẻo dai, thăng bằng và phục hồi. Phù hợp mọi trình độ.' },
  { id: id('ca', 2), categoryName: 'Bơi lội', description: 'Buổi tập kỹ thuật và sức bền ở hồ bơi trong nhà 25 m.' },
  { id: id('ca', 3), categoryName: 'Thể hình', description: 'Giáo án tạ đòn, tạ đơn có huấn luyện viên kèm để đúng kỹ thuật và tiến bộ đều.' },
  { id: id('ca', 4), categoryName: 'Cầu lông', description: 'Bộ pháp, đập cầu và chiến thuật đánh đôi trên sân đàn hồi.' },
  { id: id('ca', 5), categoryName: 'Bóng rổ', description: 'Kỹ năng, bài tập và đấu tập 5 đấu 5 cho thiếu niên và người lớn.' },
  { id: id('ca', 6), categoryName: 'Tennis', description: 'Huấn luyện trên sân đất nện, từ những pha đánh đầu tiên đến thi đấu.' },
  { id: id('ca', 7), categoryName: 'HIIT', description: 'Các hiệp ngắn cường độ cao với dây thừng, xe đẩy và trọng lượng cơ thể.' },
  { id: id('ca', 8), categoryName: 'Chạy bộ', description: 'Buổi tập trên đường chạy và câu lạc bộ chạy từ 5K đến marathon.' },
].map((c, i) => ({ ...c, createdAt: stamp(-90 + i), updatedAt: null }));

export const rooms = [
  { id: id('r0', 1), roomName: 'Phòng tập A', capacity: 24, status: 1 },
  { id: id('r0', 2), roomName: 'Phòng tập B', capacity: 16, status: 1 },
  { id: id('r0', 3), roomName: 'Khu hồ bơi', capacity: 20, status: 1 },
  { id: id('r0', 4), roomName: 'Sân 1', capacity: 12, status: 1 },
  { id: id('r0', 5), roomName: 'Sân 2', capacity: 12, status: 2 },
  { id: id('r0', 6), roomName: 'Khu tạ', capacity: 18, status: 1 },
].map((r, i) => ({ ...r, createdAt: stamp(-80 + i), updatedAt: null }));

export const coaches = [
  { id: id('c1', 1), accountId: DEMO_IDS.coachAccountId, fullName: 'Lê Minh Khoa', phone: '0901234001', email: 'khoa@sportcenter.vn', avatar: '', specialization: 'Thể lực và sức mạnh', experienceYears: 8 },
  { id: id('c1', 2), accountId: id('ac', 12), fullName: 'Phạm Thu Hà', phone: '0901234002', email: 'ha@sportcenter.vn', avatar: '', specialization: 'Yoga và linh hoạt', experienceYears: 6 },
  { id: id('c1', 3), accountId: id('ac', 13), fullName: 'Trần Quốc Bảo', phone: '0901234003', email: 'bao@sportcenter.vn', avatar: '', specialization: 'Bơi lội', experienceYears: 11 },
  { id: id('c1', 4), accountId: id('ac', 14), fullName: 'Nguyễn Hải Yến', phone: '0901234004', email: 'yen@sportcenter.vn', avatar: '', specialization: 'Cầu lông và tennis', experienceYears: 5 },
  { id: id('c1', 5), accountId: id('ac', 15), fullName: 'Đỗ Tuấn Anh', phone: '0901234005', email: 'tuananh@sportcenter.vn', avatar: '', specialization: 'Bóng rổ', experienceYears: 7 },
];

const cat = (n) => categories[n - 1];
const coach = (n) => coaches[n - 1];
const mkClass = (n, name, c, k, max, start, weeks, status, enrolled) => ({
  id: id('cl', n),
  className: name,
  categoryId: cat(c).id,
  categoryName: cat(c).categoryName,
  coachId: coach(k).id,
  coachName: coach(k).fullName,
  maxCapacity: max,
  startDate: day(start),
  endDate: day(start + weeks * 7),
  status,
  createdAt: stamp(-30 + n),
  updatedAt: null,
  _enrolled: enrolled, // sample-only: how many members booked
});

export const classes = [
  mkClass(1, 'Yoga Bình Minh', 1, 2, 20, 3, 8, 1, 17),
  mkClass(2, 'Tạ Đòn Căn Bản', 3, 1, 12, -10, 6, 2, 12),
  mkClass(3, 'Sửa Kỹ Thuật Bơi', 2, 3, 16, 6, 6, 1, 9),
  mkClass(4, 'Chiến Thuật Đánh Đôi', 4, 4, 12, 1, 5, 1, 10),
  mkClass(5, 'Bóng Rổ Sau Giờ Làm', 5, 5, 20, 12, 8, 1, 6),
  mkClass(6, 'Tennis Sân Đất Nện Cơ Bản', 6, 4, 8, 20, 6, 1, 3),
  mkClass(7, 'HIIT Tăng Tốc', 7, 1, 18, -3, 4, 2, 15),
  mkClass(8, 'Chạy Bộ Thứ Ba', 8, 1, 24, 9, 10, 1, 11),
  mkClass(9, 'Yoga Phục Hồi', 1, 2, 16, 15, 6, 1, 4),
  mkClass(10, 'Phòng Lab Powerlifting', 3, 1, 10, -60, 8, 3, 10),
];

const mkSession = (n, classIndex, roomIndex, offset, start, end) => {
  const c = classes[classIndex];
  const r = rooms[roomIndex];
  return {
    id: id('se', n), classId: c.id, className: c.className, roomId: r.id, roomName: r.roomName,
    date: day(offset), startTime: start, endTime: end,
  };
};

export const sessions = [];
{
  let n = 1;
  const plan = [
    [0, 0, 3, '06:30:00', '07:30:00'], [1, 5, -10, '18:00:00', '19:15:00'], [2, 2, 6, '19:00:00', '20:00:00'],
    [3, 3, 1, '17:30:00', '19:00:00'], [4, 3, 12, '19:00:00', '20:30:00'], [5, 3, 20, '08:00:00', '09:30:00'],
    [6, 1, -3, '12:15:00', '12:45:00'], [7, 0, 9, '18:30:00', '19:45:00'], [8, 1, 15, '20:00:00', '21:00:00'],
  ];
  for (const [ci, ri, start, s, e] of plan) {
    for (let w = 0; w < 6; w++) sessions.push(mkSession(n++, ci, ri, start + w * 7, s, e));
  }
  // Two sessions this week for "today" views
  sessions.push(mkSession(n++, 1, 5, 0, '18:00:00', '19:15:00'));
  sessions.push(mkSession(n++, 6, 1, 0, '12:15:00', '12:45:00'));
}

export const members = [
  { id: DEMO_IDS.memberId, accountId: DEMO_IDS.memberAccountId, fullName: 'Nguyễn Văn An', dob: '2000-04-12T00:00:00Z', gender: 'Male', phone: '0912000001', email: 'an.nguyen@gmail.com', avatar: '', trainingGoal: 'Tăng sức mạnh và chạy 5K dưới 25 phút', status: 1, createdAt: stamp(-200) },
  { id: id('a1', 2), accountId: id('ac', 22), fullName: 'Trần Thị Bích', dob: '1998-09-03T00:00:00Z', gender: 'Female', phone: '0912000002', email: 'bich.tran@gmail.com', avatar: '', trainingGoal: 'Cải thiện độ dẻo dai', status: 1, createdAt: stamp(-150) },
  { id: id('a1', 3), accountId: id('ac', 23), fullName: 'Lê Hoàng Nam', dob: '1995-01-22T00:00:00Z', gender: 'Male', phone: '0912000003', email: 'nam.le@gmail.com', avatar: '', trainingGoal: 'Học bơi được 1 km', status: 1, createdAt: stamp(-120) },
  { id: id('a1', 4), accountId: id('ac', 24), fullName: 'Phạm Mai Linh', dob: '2003-06-30T00:00:00Z', gender: 'Female', phone: '0912000004', email: 'linh.pham@gmail.com', avatar: '', trainingGoal: 'Vào đội cầu lông của câu lạc bộ', status: 1, createdAt: stamp(-60) },
  { id: id('a1', 5), accountId: id('ac', 25), fullName: 'Võ Đức Thịnh', dob: '1990-11-11T00:00:00Z', gender: 'Male', phone: '0912000005', email: 'thinh.vo@gmail.com', avatar: '', trainingGoal: 'Giảm 6 kg', status: 3, createdAt: stamp(-30) },
  { id: id('a1', 6), accountId: id('ac', 26), fullName: 'Hoàng Gia Hân', dob: '2001-02-14T00:00:00Z', gender: 'Female', phone: '0912000006', email: 'han.hoang@gmail.com', avatar: '', trainingGoal: 'Duy trì tập đều 3 buổi mỗi tuần', status: 1, createdAt: stamp(-12) },
];

export const receptionists = [
  { id: DEMO_IDS.receptionistId, accountId: DEMO_IDS.receptionistAccountId, fullName: 'Bùi Thanh Tâm', phone: '0933000001', email: 'tam@sportcenter.vn', workingShift: 'Ca sáng (06:00–14:00)' },
  { id: id('e1', 2), accountId: id('ac', 32), fullName: 'Ngô Phương Thảo', phone: '0933000002', email: 'thao@sportcenter.vn', workingShift: 'Ca chiều (14:00–22:00)' },
];

export const managers = [
  { id: id('m1', 1), accountId: DEMO_IDS.managerAccountId, fullName: 'Đặng Quang Huy', phone: '0944000001', email: 'huy@sportcenter.vn' },
];

export const packages = [
  { id: id('pk', 1), packageName: 'Gói 1 tháng', description: 'Giá chuẩn, dùng cho mọi môn trong 30 ngày.\n- Tự tập không giới hạn ở khu gym, cardio và hồ bơi\n- Tủ đồ dùng trong ngày\n- Đo thể trạng khi bắt đầu', durationDays: 30, price: 800000, status: 1, categoryIds: [] },
  { id: id('pk', 2), packageName: 'Gói 6 tháng', description: 'Rẻ hơn 15% so với 6 lần gói 1 tháng, tặng thêm 1 tuần.\n- Mọi quyền lợi của Gói 1 tháng\n- Tặng 7 ngày tập (187 ngày)\n- Đo thể trạng mỗi tháng\n- Khăn tập mỗi buổi', durationDays: 187, price: 4080000, status: 1, categoryIds: [] },
  { id: id('pk', 3), packageName: 'Gói 1 năm', description: 'Rẻ hơn 30% so với 12 lần gói 1 tháng, tặng thêm 1 tháng.\n- Mọi quyền lợi của Gói 6 tháng\n- Tặng 30 ngày tập (395 ngày)\n- Tủ đồ riêng cả năm\n- 2 buổi tập 1-1 với huấn luyện viên', durationDays: 395, price: 6720000, status: 1, categoryIds: [] },
  { id: id('pk', 4), packageName: 'Gói Hè Sinh Viên', description: 'Gói cũ, đã ngừng bán.', durationDays: 60, price: 890000, status: 2, categoryIds: [] },
];

export const memberships = [
  { id: id('mm', 1), memberId: members[0].id, memberName: members[0].fullName, packageId: packages[1].id, packageName: 'Gói 6 tháng', startDate: day(-40), endDate: day(50), status: 1 },
  { id: id('mm', 2), memberId: members[1].id, memberName: members[1].fullName, packageId: packages[0].id, packageName: 'Gói 1 tháng', startDate: day(-25), endDate: day(5), status: 1 },
  { id: id('mm', 3), memberId: members[2].id, memberName: members[2].fullName, packageId: packages[2].id, packageName: 'Gói 1 năm', startDate: day(-100), endDate: day(265), status: 1 },
  { id: id('mm', 4), memberId: members[4].id, memberName: members[4].fullName, packageId: packages[0].id, packageName: 'Gói 1 tháng', startDate: day(-70), endDate: day(-40), status: 3 },
  { id: id('mm', 5), memberId: members[3].id, memberName: members[3].fullName, packageId: packages[1].id, packageName: 'Gói 6 tháng', startDate: day(-2), endDate: day(88), status: 1 },
];

export const invoices = [
  { id: id('iv', 1), receptionistId: receptionists[0].id, receptionistName: receptionists[0].fullName, memberMembershipId: memberships[0].id, memberName: memberships[0].memberName, packageName: 'Gói 6 tháng', amount: 4080000, paymentMethod: 2, paymentDate: stamp(-40), status: 2 },
  { id: id('iv', 2), receptionistId: receptionists[0].id, receptionistName: receptionists[0].fullName, memberMembershipId: memberships[1].id, memberName: memberships[1].memberName, packageName: 'Gói 1 tháng', amount: 800000, paymentMethod: 1, paymentDate: stamp(-25), status: 2 },
  { id: id('iv', 3), receptionistId: receptionists[1].id, receptionistName: receptionists[1].fullName, memberMembershipId: memberships[2].id, memberName: memberships[2].memberName, packageName: 'Gói 1 năm', amount: 6720000, paymentMethod: 3, paymentDate: stamp(-100), status: 2 },
  { id: id('iv', 4), receptionistId: receptionists[1].id, receptionistName: receptionists[1].fullName, memberMembershipId: memberships[4].id, memberName: memberships[4].memberName, packageName: 'Gói 6 tháng', amount: 4080000, paymentMethod: 2, paymentDate: stamp(-2), status: 1 },
];

export const bookings = [
  { id: id('bk', 1), memberId: members[0].id, memberName: members[0].fullName, classId: classes[1].id, className: classes[1].className, classStartDate: classes[1].startDate, bookingDate: stamp(-14), status: 2 },
  { id: id('bk', 2), memberId: members[0].id, memberName: members[0].fullName, classId: classes[7].id, className: classes[7].className, classStartDate: classes[7].startDate, bookingDate: stamp(-2), status: 1 },
  { id: id('bk', 3), memberId: members[0].id, memberName: members[0].fullName, classId: classes[0].id, className: classes[0].className, classStartDate: classes[0].startDate, bookingDate: stamp(-1), status: 1 },
];

export const classMembers = members.slice(0, 5).map((m, i) => ({
  memberId: m.id, fullName: m.fullName, phone: m.phone, email: m.email, bookingStatus: i < 2 ? 2 : 1, bookingDate: stamp(-10 + i),
}));

export const attendance = [
  { id: id('at', 1), sessionId: sessions[6].id, sessionDate: sessions[6].date, sessionStartTime: sessions[6].startTime, memberId: members[0].id, memberName: members[0].fullName, recordedBy: DEMO_IDS.coachAccountId, checkInTime: stamp(-10, 11), status: 1 },
  { id: id('at', 2), sessionId: sessions[7].id, sessionDate: sessions[7].date, sessionStartTime: sessions[7].startTime, memberId: members[0].id, memberName: members[0].fullName, recordedBy: DEMO_IDS.coachAccountId, checkInTime: stamp(-3, 11), status: 3 },
];

export const coachClasses = classes
  .filter((c) => c.coachId === coaches[0].id)
  .map((c) => ({
    classId: c.id, className: c.className, categoryName: c.categoryName, maxCapacity: c.maxCapacity,
    currentEnrolled: c._enrolled, startDate: c.startDate, endDate: c.endDate, status: c.status,
  }));

export const coachMembers = members.slice(0, 4).map((m, i) => ({
  memberId: m.id, fullName: m.fullName, phone: m.phone, email: m.email,
  classId: coachClasses[i % coachClasses.length].classId, className: coachClasses[i % coachClasses.length].className,
}));

export const trainingPlans = [
  { id: id('tp', 1), coachId: coaches[0].id, coachName: coaches[0].fullName, memberId: members[0].id, memberName: members[0].fullName, classId: classes[1].id, className: classes[1].className, title: 'Tiến độ squat 6 tuần', contentDescription: 'Tuần 1–2: 3×8 ở 60%. Tuần 3–4: 4×6 ở 70%. Tuần 5–6: 5×5 ở 75–80%. Khởi động linh hoạt trước mỗi buổi.', createdDate: day(-12) },
  { id: id('tp', 2), coachId: coaches[0].id, coachName: coaches[0].fullName, memberId: members[1].id, memberName: members[1].fullName, classId: classes[6].id, className: classes[6].className, title: 'Nền tảng thể lực', contentDescription: 'Hai lớp HIIT mỗi tuần và một buổi chạy nhẹ 30 phút. Giữ nhịp tim dưới 150 vào ngày tập nhẹ.', createdDate: day(-5) },
];

export const trainingResults = [
  { id: id('tr', 1), planId: trainingPlans[0].id, planTitle: trainingPlans[0].title, memberId: members[0].id, memberName: members[0].fullName, coachId: coaches[0].id, coachName: coaches[0].fullName, performanceScore: 7.5, coachComment: 'Độ sâu đã ổn định. Giữ đường đi của thanh tạ thẳng trên giữa bàn chân.', evaluationDate: day(-4) },
  { id: id('tr', 2), planId: trainingPlans[0].id, planTitle: trainingPlans[0].title, memberId: members[0].id, memberName: members[0].fullName, coachId: coaches[0].id, coachName: coaches[0].fullName, performanceScore: 6, coachComment: 'Tuần đầu tốt. Siết cơ bụng chắc hơn trước mỗi lần.', evaluationDate: day(-11) },
];

export const notifications = [
  { id: id('nt', 1), title: 'Đổi giờ buổi học', message: 'Lớp Chạy Bộ Thứ Ba tuần này dời sang 18:45 vì đường chạy có sự kiện của trường.', isRead: false, createdAt: stamp(-1, 8) },
  { id: id('nt', 2), title: 'Đã đặt lớp', message: 'Bạn đã đặt lớp Yoga Bình Minh. Buổi đầu tiên bắt đầu sau 3 ngày.', isRead: false, createdAt: stamp(-1, 7) },
  { id: id('nt', 3), title: 'Thẻ sắp hết hạn', message: 'Thẻ Gói 6 tháng của bạn hết hạn sau 50 ngày. Hãy gia hạn ở Tài khoản của tôi → Thẻ thành viên.', isRead: true, createdAt: stamp(-6, 9) },
];

export const accounts = [
  { id: DEMO_IDS.managerAccountId, username: 'manager.huy', role: 4, status: 1, createdAt: stamp(-300) },
  { id: DEMO_IDS.receptionistAccountId, username: 'reception.tam', role: 3, status: 1, createdAt: stamp(-250) },
  { id: DEMO_IDS.coachAccountId, username: 'coach.khoa', role: 2, status: 1, createdAt: stamp(-240) },
  { id: DEMO_IDS.memberAccountId, username: 'an.nguyen', role: 1, status: 1, createdAt: stamp(-200) },
  { id: id('ac', 25), username: 'thinh.vo', role: 1, status: 3, createdAt: stamp(-30) },
];

// SupportResponse (status: 1 Open, 2 In progress, 3 Resolved, 4 Cancelled)
export const supportRequests = [
  { id: id('sr', 1), memberId: id('a1', 1), memberName: 'An Nguyễn', content: 'Tuần sau tôi chuyển sang lớp buổi tối được không?', status: 1, handledByAccountId: null, resolution: null, createdAt: stamp(0, 7), updatedAt: null },
  { id: id('sr', 2), memberId: id('a1', 1), memberName: 'An Nguyễn', content: 'Hóa đơn của tôi ghi sai gói tập.', status: 3, handledByAccountId: DEMO_IDS.receptionistAccountId, resolution: 'Đã sửa tại quầy; hóa đơn mới nằm ở Tài khoản của tôi → Hóa đơn.', createdAt: stamp(-3, 9), updatedAt: stamp(-2, 10) },
];

// AuditLogResponse as the server writes it: "<EF state>:<entity>" + JSON (lib/audit.js)
const serverLog = (n, accountId, username, actionType, entityId, changedFields, timestamp) => ({
  id: id('al', n), accountId, username, actionType, timestamp,
  description: JSON.stringify({ entityId, changedFields, source: 'server' }),
});
export const auditLogs = [
  serverLog(1, DEMO_IDS.managerAccountId, 'manager.huy', 'Modified:ClassSession', id('se', 1), ['StartTime', 'EndTime', 'UpdatedAt'], stamp(0, 8)),
  serverLog(2, DEMO_IDS.receptionistAccountId, 'reception.tam', 'Added:Invoice', id('in', 1), [], stamp(0, 7)),
  serverLog(3, DEMO_IDS.managerAccountId, 'manager.huy', 'Modified:Account', id('ac', 25), ['Status', 'UpdatedAt'], stamp(-1, 16)),
  serverLog(4, DEMO_IDS.coachAccountId, 'coach.khoa', 'Added:Attendance', id('at', 1), [], stamp(-1, 9)),
];

// Report preview (no report API yet)
export const report = {
  totals: { activeMembers: 412, activeMemberships: 356, bookingsThisMonth: 1284, revenueThisMonth: 186400000 },
  revenueByMonth: [
    { month: 'T4', value: 128 }, { month: 'T5', value: 141 }, { month: 'T6', value: 152 },
    { month: 'T7', value: 170 }, { month: 'T8', value: 164 }, { month: 'T9', value: 186 },
  ],
};
