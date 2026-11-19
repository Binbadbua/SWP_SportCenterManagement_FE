

const VERBS = {
  CREATE: { label: 'Thêm', tone: 'success' },
  UPDATE: { label: 'Sửa', tone: 'info' },
  DELETE: { label: 'Xóa', tone: 'danger' },
  RENEW: { label: 'Gia hạn', tone: 'info' },
  CANCEL: { label: 'Hủy', tone: 'warning' },
  LOCK: { label: 'Khóa', tone: 'warning' },
  UNLOCK: { label: 'Mở khóa', tone: 'success' },
  SEND: { label: 'Gửi', tone: 'neutral' },
};

export const AUDIT_VERBS = Object.entries(VERBS).map(([value, v]) => ({ value, label: v.label }));

const SERVER_VERBS = { Added: 'CREATE', Modified: 'UPDATE', Deleted: 'DELETE' };

const ENTITIES = {
  Account: 'tài khoản', Attendance: 'điểm danh', Class: 'lớp học', ClassBooking: 'lượt đặt lớp',
  ClassSession: 'buổi học', Coach: 'huấn luyện viên', CenterManager: 'quản lý', Invoice: 'hóa đơn',
  Member: 'học viên', Membership: 'thẻ thành viên', MembershipPackage: 'gói tập', Notification: 'thông báo',
  Receptionist: 'lễ tân', Room: 'phòng tập', SportCategory: 'môn thể thao', SupportRequest: 'yêu cầu hỗ trợ',
  TrainingPlan: 'kế hoạch tập luyện', TrainingResult: 'kết quả tập luyện',
};
const OLD_ENTITIES = {
  account: 'tài khoản', class: 'lớp học', session: 'buổi học', room: 'phòng tập', sport: 'môn thể thao',
  package: 'gói tập', membership: 'thẻ thành viên', invoice: 'hóa đơn', member: 'học viên', coach: 'huấn luyện viên',
  receptionist: 'lễ tân', manager: 'quản lý', notification: 'thông báo', plan: 'kế hoạch tập luyện', result: 'kết quả tập luyện',
};

const FIELDS = {
  FullName: 'họ tên', Phone: 'số điện thoại', Email: 'email', Dob: 'ngày sinh', Gender: 'giới tính',
  TrainingGoal: 'mục tiêu tập luyện', Avatar: 'ảnh', Status: 'trạng thái', Role: 'vai trò', Username: 'tên đăng nhập',
  Password: 'mật khẩu', ClassName: 'tên lớp', CategoryId: 'môn', CoachId: 'huấn luyện viên', MaxCapacity: 'sĩ số tối đa',
  StartDate: 'ngày bắt đầu', EndDate: 'ngày kết thúc', ClassId: 'lớp', RoomId: 'phòng', Date: 'ngày',
  StartTime: 'giờ bắt đầu', EndTime: 'giờ kết thúc', RoomName: 'tên phòng', Capacity: 'sức chứa',
  CategoryName: 'tên môn', Description: 'mô tả', PackageName: 'tên gói', DurationDays: 'số ngày', Price: 'giá',
  Amount: 'số tiền', PaymentMethod: 'hình thức thanh toán', PaymentDate: 'ngày thanh toán', IsRead: 'đã đọc',
  Title: 'tiêu đề', Message: 'nội dung', Specialization: 'chuyên môn', ExperienceYears: 'số năm kinh nghiệm',
  WorkingShift: 'ca làm', Resolution: 'câu trả lời', Content: 'nội dung', CheckInTime: 'giờ check-in',
  RecordedBy: 'người ghi', PerformanceScore: 'điểm', CoachComment: 'nhận xét', ContentDescription: 'nội dung tập',
};

const QUIET_FIELDS = ['UpdatedAt', 'CreatedAt', 'IsDeleted'];

const NAME_FIELDS = ['FullName', 'ClassName', 'RoomName', 'CategoryName', 'PackageName', 'Username', 'Title'];

const norm = (v) => {
  if (v === '' || v === undefined) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(v) ? v : `${v}Z`);
  return v;
};
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

const words = (pascal) => pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const json = (text) => {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

export function readEntry(row) {
  const [state, type] = String(row.actionType ?? '').split(':');
  if (SERVER_VERBS[state] && type) {
    const d = json(row.description) ?? {};
    const logged = d.changes && typeof d.changes === 'object' ? d.changes : null;
    let verb = SERVER_VERBS[state];
    let fields;
    let changes = [];
    if (logged) {

      if (state === 'Modified' && logged.IsDeleted?.old === false && logged.IsDeleted?.new === true) verb = 'DELETE';
      changes = Object.entries(logged)
        .filter(([f, c]) => !QUIET_FIELDS.includes(f) && (verb !== 'UPDATE' || !same(c?.old, c?.new)))
        .map(([f, c]) => ({ field: f, label: FIELDS[f] ?? words(f), old: c?.old ?? null, new: c?.new ?? null }));
      fields = verb === 'UPDATE' ? changes.map((c) => c.label) : [];
    } else {

      const changed = d.changedFields ?? [];
      if (state === 'Modified' && changed.includes('IsDeleted')) verb = 'DELETE';
      fields = changed.filter((f) => !QUIET_FIELDS.includes(f)).map((f) => FIELDS[f] ?? words(f));
    }
    const named = logged && NAME_FIELDS.map((f) => logged[f]).find((c) => c && (c.new ?? c.old));
    const entity = ENTITIES[type] ?? words(type);
    return {
      verb, entity, type, label: `${VERBS[verb].label} ${entity}`, tone: VERBS[verb].tone,
      entityId: d.entityId, fields, changes, recordName: named ? String(named.new ?? named.old) : null,
      summary: '', lines: [], source: 'server',
    };
  }
  const [verb, ...rest] = String(row.actionType ?? '').split('_');
  const [summary, ...lines] = String(row.description ?? '').replace(/^\[client\]\s*/, '').split('\n');
  const known = VERBS[verb];
  const old = rest.join(' ').toLowerCase();
  const entity = known && rest.length ? OLD_ENTITIES[old] ?? old : '';
  return {
    verb: entity ? verb : 'OTHER', entity, type: '', label: entity ? `${known.label} ${entity}` : row.actionType || '—',
    tone: entity ? known.tone : 'neutral', entityId: null, fields: [], changes: [], recordName: null, summary, lines,
    source: 'client',
  };
}

export function groupEntries(rows) {
  const groups = new Map();
  for (const row of rows) {
    const entry = readEntry(row);
    const key = entry.source === 'server'
      ? `${row.accountId}|${row.actionType}|${String(row.timestamp).slice(0, 19)}`
      : row.id;
    const group = groups.get(key);
    if (group) {
      group.entityIds.push(entry.entityId);
      for (const f of entry.fields) if (!group.entry.fields.includes(f)) group.entry.fields.push(f);
    } else {
      groups.set(key, { ...row, entry, entityIds: entry.entityId ? [entry.entityId] : [] });
    }
  }
  return [...groups.values()];
}
