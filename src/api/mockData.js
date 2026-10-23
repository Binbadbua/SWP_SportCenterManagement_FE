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
  { id: id('ca', 1), categoryName: 'Yoga', description: 'Breath-led flows for mobility, balance and recovery. All levels welcome.' },
  { id: id('ca', 2), categoryName: 'Swimming', description: 'Technique and endurance sessions in our 25 m indoor pool.' },
  { id: id('ca', 3), categoryName: 'Strength', description: 'Barbell and dumbbell programmes coached for good form and steady progress.' },
  { id: id('ca', 4), categoryName: 'Badminton', description: 'Footwork, smashes and doubles tactics on sprung courts.' },
  { id: id('ca', 5), categoryName: 'Basketball', description: 'Skills, drills and 5-on-5 scrimmages for teens and adults.' },
  { id: id('ca', 6), categoryName: 'Tennis', description: 'Clay-court coaching from first rally to match play.' },
  { id: id('ca', 7), categoryName: 'HIIT', description: 'Short, hard intervals with ropes, sleds and bodyweight.' },
  { id: id('ca', 8), categoryName: 'Running', description: 'Track sessions and run club for 5K to marathon.' },
].map((c, i) => ({ ...c, createdAt: stamp(-90 + i), updatedAt: null }));

export const rooms = [
  { id: id('r0', 1), roomName: 'Studio A', capacity: 24, status: 1 },
  { id: id('r0', 2), roomName: 'Studio B', capacity: 16, status: 1 },
  { id: id('r0', 3), roomName: 'Pool Hall', capacity: 20, status: 1 },
  { id: id('r0', 4), roomName: 'Court 1', capacity: 12, status: 1 },
  { id: id('r0', 5), roomName: 'Court 2', capacity: 12, status: 2 },
  { id: id('r0', 6), roomName: 'Strength Floor', capacity: 18, status: 1 },
].map((r, i) => ({ ...r, createdAt: stamp(-80 + i), updatedAt: null }));

export const coaches = [
  { id: id('c1', 1), accountId: DEMO_IDS.coachAccountId, fullName: 'Lê Minh Khoa', phone: '0901234001', email: 'khoa@sportcenter.vn', avatar: '', specialization: 'Strength & conditioning', experienceYears: 8 },
  { id: id('c1', 2), accountId: id('ac', 12), fullName: 'Phạm Thu Hà', phone: '0901234002', email: 'ha@sportcenter.vn', avatar: '', specialization: 'Yoga & mobility', experienceYears: 6 },
  { id: id('c1', 3), accountId: id('ac', 13), fullName: 'Trần Quốc Bảo', phone: '0901234003', email: 'bao@sportcenter.vn', avatar: '', specialization: 'Swimming', experienceYears: 11 },
  { id: id('c1', 4), accountId: id('ac', 14), fullName: 'Nguyễn Hải Yến', phone: '0901234004', email: 'yen@sportcenter.vn', avatar: '', specialization: 'Badminton & tennis', experienceYears: 5 },
  { id: id('c1', 5), accountId: id('ac', 15), fullName: 'Đỗ Tuấn Anh', phone: '0901234005', email: 'tuananh@sportcenter.vn', avatar: '', specialization: 'Basketball', experienceYears: 7 },
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
  _enrolled: enrolled, // sample-only: how many members booked (the list API does not return this)
});

export const classes = [
  mkClass(1, 'Sunrise Vinyasa', 1, 2, 20, 3, 8, 1, 17),
  mkClass(2, 'Barbell Basics', 3, 1, 12, -10, 6, 2, 12),
  mkClass(3, 'Stroke Clinic', 2, 3, 16, 6, 6, 1, 9),
  mkClass(4, 'Doubles Tactics', 4, 4, 12, 1, 5, 1, 10),
  mkClass(5, 'Hoops After Work', 5, 5, 20, 12, 8, 1, 6),
  mkClass(6, 'Clay Court Foundations', 6, 4, 8, 20, 6, 1, 3),
  mkClass(7, 'Engine Room HIIT', 7, 1, 18, -3, 4, 2, 15),
  mkClass(8, 'Track Tuesdays', 8, 1, 24, 9, 10, 1, 11),
  mkClass(9, 'Yin & Recovery', 1, 2, 16, 15, 6, 1, 4),
  mkClass(10, 'Powerlifting Lab', 3, 1, 10, -60, 8, 3, 10),
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
  { id: DEMO_IDS.memberId, accountId: DEMO_IDS.memberAccountId, fullName: 'Nguyễn Văn An', dob: '2000-04-12T00:00:00Z', gender: 'Male', phone: '0912000001', email: 'an.nguyen@gmail.com', avatar: '', trainingGoal: 'Build strength and run a sub-25 5K', status: 1, createdAt: stamp(-200) },
  { id: id('a1', 2), accountId: id('ac', 22), fullName: 'Trần Thị Bích', dob: '1998-09-03T00:00:00Z', gender: 'Female', phone: '0912000002', email: 'bich.tran@gmail.com', avatar: '', trainingGoal: 'Improve flexibility', status: 1, createdAt: stamp(-150) },
  { id: id('a1', 3), accountId: id('ac', 23), fullName: 'Lê Hoàng Nam', dob: '1995-01-22T00:00:00Z', gender: 'Male', phone: '0912000003', email: 'nam.le@gmail.com', avatar: '', trainingGoal: 'Learn to swim 1 km', status: 1, createdAt: stamp(-120) },
  { id: id('a1', 4), accountId: id('ac', 24), fullName: 'Phạm Mai Linh', dob: '2003-06-30T00:00:00Z', gender: 'Female', phone: '0912000004', email: 'linh.pham@gmail.com', avatar: '', trainingGoal: 'Badminton club team', status: 1, createdAt: stamp(-60) },
  { id: id('a1', 5), accountId: id('ac', 25), fullName: 'Võ Đức Thịnh', dob: '1990-11-11T00:00:00Z', gender: 'Male', phone: '0912000005', email: 'thinh.vo@gmail.com', avatar: '', trainingGoal: 'Lose 6 kg', status: 3, createdAt: stamp(-30) },
  { id: id('a1', 6), accountId: id('ac', 26), fullName: 'Hoàng Gia Hân', dob: '2001-02-14T00:00:00Z', gender: 'Female', phone: '0912000006', email: 'han.hoang@gmail.com', avatar: '', trainingGoal: 'Stay consistent 3x a week', status: 1, createdAt: stamp(-12) },
];

export const receptionists = [
  { id: DEMO_IDS.receptionistId, accountId: DEMO_IDS.receptionistAccountId, fullName: 'Bùi Thanh Tâm', phone: '0933000001', email: 'tam@sportcenter.vn', workingShift: 'Morning (06:00–14:00)' },
  { id: id('e1', 2), accountId: id('ac', 32), fullName: 'Ngô Phương Thảo', phone: '0933000002', email: 'thao@sportcenter.vn', workingShift: 'Evening (14:00–22:00)' },
];

export const managers = [
  { id: id('m1', 1), accountId: DEMO_IDS.managerAccountId, fullName: 'Đặng Quang Huy', phone: '0944000001', email: 'huy@sportcenter.vn' },
];

export const packages = [
  { id: id('pk', 1), packageName: 'Starter', description: 'Try the center for a month: all group classes, off-peak gym access.', durationDays: 30, price: 690000, status: 1 },
  { id: id('pk', 2), packageName: 'Everyday', description: 'Unlimited classes and gym access, any time, plus one coach check-in a month.', durationDays: 90, price: 1790000, status: 1 },
  { id: id('pk', 3), packageName: 'Athlete', description: 'Twelve months of everything, a personal training plan and monthly progress reviews.', durationDays: 365, price: 5990000, status: 1 },
  { id: id('pk', 4), packageName: 'Student Summer', description: 'Summer pass for students with a valid card.', durationDays: 60, price: 890000, status: 2 },
];

export const memberships = [
  { id: id('mm', 1), memberId: members[0].id, memberName: members[0].fullName, packageId: packages[1].id, packageName: 'Everyday', startDate: day(-40), endDate: day(50), status: 1 },
  { id: id('mm', 2), memberId: members[1].id, memberName: members[1].fullName, packageId: packages[0].id, packageName: 'Starter', startDate: day(-25), endDate: day(5), status: 1 },
  { id: id('mm', 3), memberId: members[2].id, memberName: members[2].fullName, packageId: packages[2].id, packageName: 'Athlete', startDate: day(-100), endDate: day(265), status: 1 },
  { id: id('mm', 4), memberId: members[4].id, memberName: members[4].fullName, packageId: packages[0].id, packageName: 'Starter', startDate: day(-70), endDate: day(-40), status: 3 },
  { id: id('mm', 5), memberId: members[3].id, memberName: members[3].fullName, packageId: packages[1].id, packageName: 'Everyday', startDate: day(-2), endDate: day(88), status: 1 },
];

export const invoices = [
  { id: id('iv', 1), receptionistId: receptionists[0].id, receptionistName: receptionists[0].fullName, memberMembershipId: memberships[0].id, memberName: memberships[0].memberName, packageName: 'Everyday', amount: 1790000, paymentMethod: 2, paymentDate: stamp(-40), status: 2 },
  { id: id('iv', 2), receptionistId: receptionists[0].id, receptionistName: receptionists[0].fullName, memberMembershipId: memberships[1].id, memberName: memberships[1].memberName, packageName: 'Starter', amount: 690000, paymentMethod: 1, paymentDate: stamp(-25), status: 2 },
  { id: id('iv', 3), receptionistId: receptionists[1].id, receptionistName: receptionists[1].fullName, memberMembershipId: memberships[2].id, memberName: memberships[2].memberName, packageName: 'Athlete', amount: 5990000, paymentMethod: 3, paymentDate: stamp(-100), status: 2 },
  { id: id('iv', 4), receptionistId: receptionists[1].id, receptionistName: receptionists[1].fullName, memberMembershipId: memberships[4].id, memberName: memberships[4].memberName, packageName: 'Everyday', amount: 1790000, paymentMethod: 2, paymentDate: stamp(-2), status: 1 },
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
  { id: id('tp', 1), coachId: coaches[0].id, coachName: coaches[0].fullName, memberId: members[0].id, memberName: members[0].fullName, classId: classes[1].id, className: classes[1].className, title: '6-week squat progression', contentDescription: 'Week 1–2: 3×8 at 60%. Week 3–4: 4×6 at 70%. Week 5–6: 5×5 at 75–80%. Mobility warm-up before every session.', createdDate: day(-12) },
  { id: id('tp', 2), coachId: coaches[0].id, coachName: coaches[0].fullName, memberId: members[1].id, memberName: members[1].fullName, classId: classes[6].id, className: classes[6].className, title: 'Conditioning base', contentDescription: 'Two HIIT classes a week plus one easy 30-minute run. Keep heart rate under 150 on easy days.', createdDate: day(-5) },
];

export const trainingResults = [
  { id: id('tr', 1), planId: trainingPlans[0].id, planTitle: trainingPlans[0].title, memberId: members[0].id, memberName: members[0].fullName, coachId: coaches[0].id, coachName: coaches[0].fullName, performanceScore: 7.5, coachComment: 'Depth is consistent now. Keep the bar path over mid-foot.', evaluationDate: day(-4) },
  { id: id('tr', 2), planId: trainingPlans[0].id, planTitle: trainingPlans[0].title, memberId: members[0].id, memberName: members[0].fullName, coachId: coaches[0].id, coachName: coaches[0].fullName, performanceScore: 6, coachComment: 'Good first week. Brace harder before each rep.', evaluationDate: day(-11) },
];

export const notifications = [
  { id: id('nt', 1), title: 'Session moved', message: 'Track Tuesdays on Tuesday moves to 18:45 because of a school event on the track.', isRead: false, createdAt: stamp(-1, 8) },
  { id: id('nt', 2), title: 'Booking confirmed', message: 'You are booked into Sunrise Vinyasa. First session starts in 3 days.', isRead: false, createdAt: stamp(-1, 7) },
  { id: id('nt', 3), title: 'Membership ends soon', message: 'Your Everyday membership ends in 50 days. Renew at reception or online.', isRead: true, createdAt: stamp(-6, 9) },
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
  { id: id('sr', 1), memberId: id('a1', 1), memberName: 'An Nguyễn', content: 'Can I move my booking to the evening class next week?', status: 1, handledByAccountId: null, resolution: null, createdAt: stamp(0, 7), updatedAt: null },
  { id: id('sr', 2), memberId: id('a1', 1), memberName: 'An Nguyễn', content: 'My invoice shows the wrong package.', status: 3, handledByAccountId: DEMO_IDS.receptionistAccountId, resolution: 'Fixed at the desk; the new invoice is under My account → Invoices.', createdAt: stamp(-3, 9), updatedAt: stamp(-2, 10) },
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
    { month: 'Apr', value: 128 }, { month: 'May', value: 141 }, { month: 'Jun', value: 152 },
    { month: 'Jul', value: 170 }, { month: 'Aug', value: 164 }, { month: 'Sep', value: 186 },
  ],
};
