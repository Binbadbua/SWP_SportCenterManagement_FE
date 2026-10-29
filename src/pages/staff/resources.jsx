// Configuration for every list/edit page in the staff area (rendered by CrudPage.jsx).
//
//   source: api.xxx (or (user) => ({ list, create?, update?, remove? })) -> the back-end endpoints;
//   edit and delete buttons only appear when the source has update / remove.
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { AUDIT_VERBS, groupEntries } from '../../lib/audit.js';
import {
  AccountRole, AccountStatus, BookingStatus, ClassStatus, DESK_METHODS, InvoiceStatus, MembershipStatus, PaymentMethod, RoomStatus,
  Gender, SupportRequestStatus,
} from '../../lib/enums.js';
import {
  addDaysToDateInput, daysUntil, formatDate, formatDateTime, formatMoney, formatTimeRange, formatWeekday, fromDateInput,
  realPhone, todayLocalDateString, todayUtcDateString,
} from '../../lib/format.js';
import { classRunning, classStarted } from '../../lib/classes.js';
import { cardsOn } from '../../lib/membership.js';
import { hasClassPrices, hasPackageDiscounts } from '../../lib/pricing.js';
import { CoachPortrait } from '../../components/cards.jsx';
import { ErrorNotice, FillBar, Loading, SampleDataNotice, StatusTag } from '../../components/ui.jsx';

const tag = (E) => (v) => <StatusTag tone={E.tone(v)}>{E.label(v)}</StatusTag>;
const isManager = (u) => u?.role === 'CenterManager';
const isFrontDesk = (u) => u?.role === 'CenterManager' || u?.role === 'Receptionist';
// Selling at the desk (new members, cards, renewals, invoices, printing) is reception's job alone (team rule,
// 28/10/2026): a manager sees and corrects those lists but does not take money
const isReception = (u) => u?.role === 'Receptionist';
// A package bought on the website: unpaid and no receptionist yet. Staff confirm it within 30 minutes
// (api.payments.confirm); editing it to Paid instead would leave the card inactive (CHANGELOG Part B, B43).
const awaitingOnline = (r) => r.status === 1 && !r.receptionistId;
// What an invoice pays for: a package, or a class with a fee (B53)
const itemOf = (r) => (r.className ? `Lớp ${r.className}` : r.packageName);
const opt = (rows, value, label) => (rows ?? []).map((r) => ({ value: r[value], label: typeof label === 'function' ? label(r) : r[label] }));

// Class fees and package discounts (CHANGELOG Part B, B53): their columns and fields appear once the lists the
// API sends carry them (set when the Classes / Packages pages load)
const carries = { price: false, discount: false };

const endAfterStart = (v) =>
  v.startDate && v.endDate && v.endDate <= v.startDate ? { endDate: 'Ngày kết thúc phải sau ngày bắt đầu.' } : {};

/* ---- Lookups shared by several pages ---------------------------------- */
const L = {
  categories: { load: () => api.categories.list(), sample: mock.categories },
  coaches: { load: () => api.coaches.list(), sample: mock.coaches },
  classes: { load: () => api.classes.list(), sample: mock.classes },
  rooms: { load: () => api.rooms.list(), sample: mock.rooms },
  members: { load: () => api.members.list(), sample: mock.members },
  packages: { load: () => api.packages.list(), sample: mock.packages },
  memberships: { load: () => api.memberships.list(), sample: mock.memberships },
  accounts: { load: () => api.accounts.list(), sample: mock.accounts },
  receptionists: { load: () => api.receptionists.list(), sample: mock.receptionists },
  managers: { load: () => api.managers.list(), sample: mock.managers },
  coachMembers: { load: () => api.coaches.members(), sample: mock.coachMembers },
  coachClasses: { load: () => api.coaches.classes(), sample: mock.coachClasses },
  coachPlans: { load: () => api.trainingPlans.forCoach(), sample: mock.trainingPlans },
};

// Training plans/results must carry the signed-in coach's ID (the API checks it)
const coachIdOf = async (u) => u?.coachId ?? (await api.coaches.me()).id;

// The card reception sees beside a member: the active one valid today, else a web order waiting for
// payment, else the latest one. state: active | expiring (7 days or less left) | pending | none
function cardOf(cards, memberId) {
  const mine = cards.filter((m) => m.memberId === memberId);
  const [active] = cardsOn(mine, todayUtcDateString());
  if (active) return { card: active, state: daysUntil(active.endDate) <= 7 ? 'expiring' : 'active' };
  const pending = mine.find((m) => m.status === 2 && String(m.endDate).slice(0, 10) >= todayUtcDateString());
  if (pending) return { card: pending, state: 'pending' };
  const [latest] = [...mine].sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  return { card: latest, state: 'none' };
}
const CARD_STATES = [
  { value: 'active', label: 'Thẻ còn hiệu lực' },
  { value: 'expiring', label: 'Thẻ sắp hết hạn (7 ngày)' },
  { value: 'pending', label: 'Đơn mua chờ xác nhận' },
  { value: 'none', label: 'Chưa có thẻ còn hiệu lực' },
];
function CardCell({ info }) {
  if (!info) return '—';
  const { card, state } = info;
  if (state === 'active' || state === 'expiring') {
    return (
      <>
        <StatusTag tone={state === 'active' ? 'success' : 'warning'}>
          {state === 'active' ? 'Còn hiệu lực' : `Còn ${daysUntil(card.endDate)} ngày`}
        </StatusTag>
        <span className="cell-sub">{card.packageName} · đến {formatDate(card.endDate)}</span>
      </>
    );
  }
  if (state === 'pending') {
    return (
      <>
        <StatusTag tone="warning">Chờ xác nhận</StatusTag>
        <span className="cell-sub">{card.packageName}</span>
      </>
    );
  }
  return (
    <>
      <StatusTag tone="neutral">Chưa có thẻ</StatusTag>
      {card && <span className="cell-sub">{card.packageName} · {MembershipStatus.label(card.status).toLowerCase()}</span>}
    </>
  );
}

// "T3 21/10/2026 · 18:00–19:30"
const sessionLabel = (s) => `${formatWeekday(s.date)} ${formatDate(s.date)} · ${formatTimeRange(s.startTime, s.endTime)}`;
// A result has no session link (CHANGELOG Part B, B51): it belongs to the session of its plan's class held that day
const sessionOfResult = (sessions, plan, evaluationDate) =>
  plan && (sessions ?? []).find((s) => s.classId === plan.classId && String(s.date).slice(0, 10) === String(evaluationDate).slice(0, 10));

// Plans and results only carry IDs; add the names the table shows and searches
async function coachNames() {
  const [members, classes] = await Promise.all([
    api.coaches.members().catch(() => []),
    api.coaches.classes().catch(() => []),
  ]);
  return {
    member: (id) => members.find((m) => m.memberId === id)?.fullName ?? '—',
    className: (id) => classes.find((c) => c.classId === id)?.className ?? '—',
  };
}

/* ---- Class roster shown in a modal ------------------------------------ */
function ClassRoster({ classId }) {
  const roster = useApi(() => api.classes.members(classId), [classId], { sample: mock.classMembers });
  if (roster.loading) return <Loading />;
  return (
    <>
      {roster.usingSample && <SampleDataNotice onRetry={roster.reload} />}
      <ErrorNotice error={!roster.usingSample ? roster.error : null} onRetry={roster.reload} />
      {roster.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Học viên</th><th>Số điện thoại</th><th>Email</th><th>Ngày đặt</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {roster.data.map((m) => (
                <tr key={m.memberId}>
                  <td className="cell-strong">{m.fullName}</td>
                  <td className="num">{realPhone(m.phone) || '—'}</td>
                  <td>{m.email}</td>
                  <td className="num">{formatDate(m.bookingDate)}</td>
                  <td>{tag(BookingStatus)(m.bookingStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !roster.error && <p className="muted">Chưa có ai đặt lớp này.</p>
      )}
    </>
  );
}

/* ---- Audit log cells and detail ---------------------------------------- */
// An entry carries the username; the account list adds the person's name and role
const accountOfLog = (accounts, row) => (accounts ?? []).find((a) => a.id === row.accountId);
const personOf = (a) => [a.fullName, AccountRole.label(a.role)].filter(Boolean).join(' · ');

function AuditWho({ row, accounts }) {
  const a = accountOfLog(accounts, row);
  return (
    <>
      <span className="cell-strong">{row.username || a?.username || '—'}</span>
      {a && <span className="cell-sub">{personOf(a)}</span>}
    </>
  );
}

// The server logs only an entity ID; the lists the page already loads give most of them a name
const RECORD_NAMES = {
  Account: (l, id) => l.accounts?.find((x) => x.id === id)?.username,
  Member: (l, id) => l.members?.find((x) => x.id === id)?.fullName,
  Coach: (l, id) => l.coaches?.find((x) => x.id === id)?.fullName,
  Receptionist: (l, id) => l.receptionists?.find((x) => x.id === id)?.fullName,
  CenterManager: (l, id) => l.managers?.find((x) => x.id === id)?.fullName,
  Class: (l, id) => l.classes?.find((x) => x.id === id)?.className,
  Room: (l, id) => l.rooms?.find((x) => x.id === id)?.roomName,
  SportCategory: (l, id) => l.categories?.find((x) => x.id === id)?.categoryName,
  MembershipPackage: (l, id) => l.packages?.find((x) => x.id === id)?.packageName,
};
// A deleted record is gone from the lists; its name then comes from the values the log kept
const recordNames = (row, l) => {
  const names = row.entityIds.map((id) => RECORD_NAMES[row.entry.type]?.(l, id)).filter(Boolean);
  return names.length || row.entityIds.length > 1 || !row.entry.recordName ? names : [row.entry.recordName];
};

// A logged value as people read it: names for IDs, enum labels for numbers, dates the Vietnamese way
const REFERENCES = {
  CategoryId: (l, id) => l.categories?.find((x) => x.id === id)?.categoryName,
  CoachId: (l, id) => l.coaches?.find((x) => x.id === id)?.fullName,
  RoomId: (l, id) => l.rooms?.find((x) => x.id === id)?.roomName,
  ClassId: (l, id) => l.classes?.find((x) => x.id === id)?.className,
  MemberId: (l, id) => l.members?.find((x) => x.id === id)?.fullName,
  PackageId: (l, id) => l.packages?.find((x) => x.id === id)?.packageName,
  AccountId: (l, id) => l.accounts?.find((x) => x.id === id)?.username,
  ReceptionistId: (l, id) => l.receptionists?.find((x) => x.id === id)?.fullName,
};
const STATUS_OF = {
  Room: RoomStatus, Class: ClassStatus, Membership: MembershipStatus, MembershipPackage: MembershipStatus,
  Invoice: InvoiceStatus, Account: AccountStatus, ClassBooking: BookingStatus, SupportRequest: SupportRequestStatus,
};
const ENUM_FIELDS = { PaymentMethod, Role: AccountRole, Gender };
function showValue(type, field, v, l) {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'Status' && STATUS_OF[type]) return STATUS_OF[type].label(v);
  if (ENUM_FIELDS[field]) return ENUM_FIELDS[field].label(v);
  if (REFERENCES[field]) return REFERENCES[field](l, v) ?? `#${String(v).slice(0, 8)}`;
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return /T00:00:00(\.0+)?(Z|\+00:00)?$/.test(v) ? formatDate(v) : formatDateTime(v);
  }
  if (typeof v === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
  const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}
const changeText = (row, c, l) =>
  `${c.label} ${showValue(row.entry.type, c.field, c.old, l)} → ${showValue(row.entry.type, c.field, c.new, l)}`;

// "Phòng A · đổi sức chứa 20 → 25" / "Dương Tuấn Kiệt · đổi số điện thoại" / "21 thông báo" / old FE text
function auditDetails(row, l) {
  const e = row.entry;
  if (e.source === 'client') return [e.summary, ...e.lines].filter(Boolean).join(' · ');
  const names = recordNames(row, l);
  // A deleted record (or a kind with no list here) has no name left: show the start of its ID
  const what = row.entityIds.length > 1
    ? `${row.entityIds.length} ${e.entity}`
    : names[0] ?? (row.entityIds[0] ? `#${String(row.entityIds[0]).slice(0, 8)}` : '');
  // A save that changed nothing still logs a row whose only change is UpdatedAt (CHANGELOG Part B, B40)
  const changed = e.changes.length && e.changes.length <= 2 && row.entityIds.length <= 1 && e.verb === 'UPDATE'
    ? `đổi ${e.changes.map((c) => changeText(row, c, l)).join(', ')}`
    : e.fields.length ? `đổi ${e.fields.join(', ')}` : e.verb === 'UPDATE' ? 'lưu lại, không đổi gì' : '';
  return [what, changed].filter(Boolean).join(' · ');
}

function AuditDetail({ row, lookups }) {
  const a = accountOfLog(lookups.accounts, row);
  const e = row.entry;
  const names = recordNames(row, lookups);
  return (
    <dl className="detail-list">
      <div><dt>Thời điểm</dt><dd className="num">{formatDateTime(row.timestamp)}</dd></div>
      <div><dt>Người thực hiện</dt><dd>{row.username}{a && ` · ${personOf(a)}`}</dd></div>
      <div><dt>Thao tác</dt><dd><StatusTag tone={e.tone}>{e.label}</StatusTag></dd></div>
      {e.source === 'server' ? (
        <>
          <div>
            <dt>{row.entityIds.length > 1 ? `Bản ghi (${row.entityIds.length})` : 'Bản ghi'}</dt>
            <dd>{names.length ? names.join(', ') : <span className="num muted">{row.entityIds.join(', ') || '—'}</span>}</dd>
          </div>
          {e.changes.length > 0 && row.entityIds.length <= 1 ? (
            <div>
              <dt>{e.verb === 'UPDATE' ? 'Thay đổi' : e.verb === 'CREATE' ? 'Giá trị lúc tạo' : 'Giá trị trước khi xóa'}</dt>
              <dd>
                <ul>
                  {e.changes.map((c) => (
                    <li key={c.field}>
                      {e.verb === 'UPDATE'
                        ? changeText(row, c, lookups)
                        : `${c.label}: ${showValue(e.type, c.field, e.verb === 'CREATE' ? c.new : c.old, lookups)}`}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : (
            <div>
              <dt>Trường đã đổi</dt>
              <dd>{e.fields.length ? <ul>{e.fields.map((f) => <li key={f}>{f}</li>)}</ul> : '—'}</dd>
            </div>
          )}
          <div><dt>Ghi bởi</dt><dd>Máy chủ, ngay khi thay đổi được lưu</dd></div>
        </>
      ) : (
        <>
          <div><dt>Nội dung</dt><dd>{e.summary || '—'}</dd></div>
          {e.lines.length > 0 && (
            <div><dt>Chi tiết</dt><dd><ul>{e.lines.map((line, i) => <li key={i}>{line}</li>)}</ul></dd></div>
          )}
          <div><dt>Ghi bởi</dt><dd>Trang web (các mục có từ trước khi máy chủ tự ghi nhật ký)</dd></div>
        </>
      )}
    </dl>
  );
}

/* ======================================================================
   API-backed pages
   ====================================================================== */
export const resources = {
  classes: {
    key: 'classes', title: 'Lớp học', singular: 'Lớp học',
    description: () => (carries.price
      ? 'Mọi lớp học trong chương trình. Học viên trả học phí cả khóa một lần là tham gia được tất cả các buổi; thẻ thành viên được giảm theo gói.'
      : 'Mọi lớp học trong chương trình. Học viên đặt lớp một lần là tham gia được tất cả các buổi.'),
    source: {
      ...api.classes,
      list: async () => {
        const [rows, sessions] = await Promise.all([api.classes.list(), api.schedules.list().catch(() => null)]);
        carries.price = hasClassPrices(rows);
        // Whether each class has begun, as members see it (lib/classes.js): the delete lock below
        return sessions ? rows.map((c) => ({ ...c, started: classStarted(c, sessions) })) : rows;
      },
    },
    sample: mock.classes, lookups: () => ({ categories: L.categories, coaches: L.coaches }),
    canWrite: isManager, nameOf: (r) => r.className,
    // Deleting a running class would leave its members to be refunded and told by hand (team rule, 28/10/2026)
    deleteLocked: (r) => (classRunning(r)
      ? 'Lớp đang diễn ra nên không xóa được. Chỉ xóa lớp chưa bắt đầu, đã kết thúc hoặc đã hủy.'
      : null),
    searchText: (r) => `${r.className} ${r.categoryName} ${r.coachName}`,
    sort: (a, b) => a.startDate.localeCompare(b.startDate),
    columns: [
      { key: 'className', label: 'Lớp', className: 'cell-strong' },
      { key: 'categoryName', label: 'Môn' },
      { key: 'coachName', label: 'Huấn luyện viên' },
      // The class list carries currentEnrolled (bookings that hold a place) next to the capacity
      {
        key: 'maxCapacity', label: 'Đã đặt / sĩ số',
        render: (r) => (r.currentEnrolled == null ? <span className="num">{r.maxCapacity}</span> : <FillBar value={r.currentEnrolled} max={r.maxCapacity} />),
      },
      {
        key: 'price', label: 'Học phí', className: 'num', hidden: () => !carries.price,
        render: (r) => (r.price > 0 ? formatMoney(r.price) : 'Miễn phí'),
      },
      { key: 'dates', label: 'Thời gian', className: 'num', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(ClassStatus)(r.status) },
    ],
    fields: [
      { name: 'className', label: 'Tên lớp', required: true, full: true, max: 150 },
      { name: 'categoryId', label: 'Môn', type: 'select', required: true, optionsFrom: (l) => opt(l.categories, 'id', 'categoryName') },
      { name: 'coachId', label: 'Huấn luyện viên', type: 'select', required: true, optionsFrom: (l) => opt(l.coaches, 'id', 'fullName') },
      { name: 'maxCapacity', label: 'Sĩ số tối đa', type: 'number', required: true, min: 1, max: 1000 },
      {
        name: 'price', label: 'Học phí cả khóa (VND)', type: 'number', required: true, min: 0, defaultValue: () => '0',
        shown: () => carries.price, help: '0 = lớp miễn phí. Thành viên có thẻ còn hiệu lực được giảm theo mức của gói.',
      },
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: ClassStatus.options, defaultValue: () => '1' },
      { name: 'startDate', label: 'Ngày bắt đầu', type: 'date', required: true },
      { name: 'endDate', label: 'Ngày kết thúc', type: 'date', required: true },
    ],
    validate: endAfterStart,
    rowActions: [{ label: 'Danh sách', modal: { title: (r) => `${r.className} — danh sách học viên`, render: (r) => <ClassRoster classId={r.id} /> } }],
    emptyHint: 'Hãy thêm môn thể thao và huấn luyện viên trước, rồi tạo lớp học.',
    toRequest: (data) => ({
      ...data,
      startDate: data.startDate ? `${data.startDate}T00:00:00Z` : data.startDate,
      endDate: data.endDate ? `${data.endDate}T00:00:00Z` : data.endDate,
    })
  },

  schedule: {
    key: 'schedule', title: 'Lịch học', singular: 'Buổi học',
    description: (u) => (u?.role === 'Coach'
      ? 'Các buổi học của những lớp bạn dạy. Mở một buổi để điểm danh.'
      : 'Các buổi học của từng lớp. Máy chủ chặn xếp trùng phòng và ngày nằm ngoài thời gian của lớp.'),
    // A coach sees only the sessions of the classes they teach
    source: (u) => (u?.role === 'Coach' ? { list: api.schedules.forCoach } : api.schedules), sample: mock.sessions,
    lookups: (u) => (isManager(u) ? { classes: L.classes, rooms: L.rooms } : {}),
    canWrite: isManager, nameOf: (r) => `${r.className} ngày ${formatDate(r.date)}`,
    searchText: (r) => `${r.className} ${r.roomName} ${formatDate(r.date)}`,
    sort: (a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime),
    columns: [
      { key: 'date', label: 'Ngày', className: 'num', render: (r) => <><span className="muted">{formatWeekday(r.date)}</span> {formatDate(r.date)}</> },
      { key: 'time', label: 'Giờ', className: 'num', render: (r) => formatTimeRange(r.startTime, r.endTime) },
      { key: 'className', label: 'Lớp', className: 'cell-strong' },
      { key: 'roomName', label: 'Phòng' },
    ],
    fields: [
      { name: 'classId', label: 'Lớp', type: 'select', required: true, full: true, optionsFrom: (l) => opt(l.classes, 'id', 'className') },
      { name: 'roomId', label: 'Phòng', type: 'select', required: true, optionsFrom: (l) => opt(l.rooms, 'id', (r) => `${r.roomName} · ${r.capacity} người${r.status === 2 ? ' (tạm ngưng)' : ''}`) },
      { name: 'date', label: 'Ngày', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'startTime', label: 'Bắt đầu', type: 'time', required: true },
      { name: 'endTime', label: 'Kết thúc', type: 'time', required: true },
    ],
    validate: (v) => (v.startTime && v.endTime && v.endTime <= v.startTime ? { endTime: 'Giờ kết thúc phải sau giờ bắt đầu.' } : {}),
    // Only the coach takes (and corrects) attendance; their list holds only their own classes
    rowActions: [{
      label: 'Điểm danh',
      to: (r) => `/staff/attendance?session=${r.id}`,
      hidden: (r, u) => u?.role !== 'Coach',
    }],
    emptyHint: 'Hãy tạo lớp học trước, rồi thêm các buổi học ở đây.',
  },

  rooms: {
    key: 'rooms', title: 'Phòng tập', singular: 'Phòng tập',
    description: 'Phòng tập, sân và sảnh. Phòng đang tạm ngưng thì không xếp lịch được.',
    source: api.rooms, sample: mock.rooms, canWrite: isManager, nameOf: (r) => r.roomName,
    searchText: (r) => r.roomName,
    sort: (a, b) => a.roomName.localeCompare(b.roomName),
    columns: [
      { key: 'roomName', label: 'Phòng', className: 'cell-strong' },
      { key: 'capacity', label: 'Sức chứa', className: 'num' },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(RoomStatus)(r.status) },
      { key: 'createdAt', label: 'Ngày thêm', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'roomName', label: 'Tên phòng', required: true, full: true },
      { name: 'capacity', label: 'Sức chứa', type: 'number', required: true, min: 1 },
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: RoomStatus.options, defaultValue: () => '1' },
    ],
  },

  sports: {
    key: 'sports', title: 'Môn thể thao', singular: 'Môn thể thao',
    description: 'Các môn thể thao hiện trên trang web. Môn đã có lớp học thì không xóa được.',
    source: api.categories, sample: mock.categories, canWrite: isManager, nameOf: (r) => r.categoryName,
    searchText: (r) => `${r.categoryName} ${r.description}`,
    sort: (a, b) => a.categoryName.localeCompare(b.categoryName),
    columns: [
      { key: 'categoryName', label: 'Môn', className: 'cell-strong' },
      { key: 'description', label: 'Mô tả', render: (r) => <span className="clamp">{r.description || '—'}</span> },
      { key: 'createdAt', label: 'Ngày thêm', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'categoryName', label: 'Tên môn', required: true, full: true },
      { name: 'description', label: 'Mô tả', type: 'textarea', help: 'Hiện trên trang lớp học, ở mục “Giới thiệu”.' },
    ],
  },

  coaches: {
    key: 'coaches', title: 'Huấn luyện viên', singular: 'Huấn luyện viên',
    description: 'Hồ sơ huấn luyện viên. Mỗi hồ sơ gắn với một tài khoản có vai trò Huấn luyện viên.',
    source: api.coaches, sample: mock.coaches, canWrite: isManager, nameOf: (r) => r.fullName,
    lookups: () => ({ accounts: L.accounts, coaches: L.coaches }),
    searchText: (r) => `${r.fullName} ${r.email} ${r.phone} ${r.specialization}`,
    sort: (a, b) => a.fullName.localeCompare(b.fullName),
    validate: (values, mode) => {
      const errors = {};
      const phoneRegex = /^0\d{9}$/; 
      if (values.phone && !phoneRegex.test(values.phone)) {
        errors.phone = "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.";
      }
      return errors;
    },
    columns: [
      {
        key: 'fullName', label: 'Họ tên', className: 'cell-strong',
        render: (r) => <span className="person-cell"><CoachPortrait coach={r} size="xs" />{r.fullName}</span>,
      },
      { key: 'specialization', label: 'Chuyên môn', render: (r) => r.specialization || '—' },
      { key: 'experienceYears', label: 'Kinh nghiệm (năm)', className: 'num' },
      { key: 'dob', label: 'Ngày sinh', className: 'num', render: (r) => formatDate(r.dob) },
      { key: 'gender', label: 'Giới tính', render: (r) => (r.gender ? Gender.label(r.gender) : '—') },
      { key: 'phone', label: 'Số điện thoại', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Tài khoản', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.coaches || []).map((c) => c.accountId || c.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 2 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'Chưa có tên'})`);
        },
        onChange: (value, { lookups, setFormValues }) => {
          const selectedAccount = (lookups.accounts || []).find((a) => a.id === value);
          if (selectedAccount) {
            setFormValues((prev) => ({
              ...prev,
              accountId: value,
              fullName: selectedAccount.fullName || '',
              email: selectedAccount.email || '',
              phone: selectedAccount.phone || '',
            }));
          }
        },
        help: 'Tài khoản phải có sẵn và mang vai trò Huấn luyện viên.'
      },
      { name: 'fullName', label: 'Họ và tên', required: true, full: true },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'specialization', label: 'Chuyên môn' },
      { name: 'experienceYears', label: 'Số năm kinh nghiệm', type: 'number', min: 0, max: 50, defaultValue: () => '0' },
      { name: 'dob', label: 'Ngày sinh', type: 'date', help: 'Hiện trên trang huấn luyện viên.' },
      { name: 'gender', label: 'Giới tính', type: 'select', options: Gender.options },
      // The photo is uploaded as soon as it is picked (api.media); the coach keeps only its link
      { name: 'avatar', label: 'Ảnh đại diện', type: 'image', help: 'Chọn ảnh JPG, PNG, WebP hoặc GIF trong máy, tối đa 5 MB; ảnh hiện trên thẻ và trang huấn luyện viên. Không có ảnh thì hiện chữ viết tắt của tên.' },
    ],
    // Date columns are timestamptz: send midnight UTC, never a bare day
    toRequest: (b) => (b.dob ? { ...b, dob: fromDateInput(b.dob) } : b),
  },

  managers: {
    key: 'managers', title: 'Quản lý', singular: 'Quản lý',
    description: 'Hồ sơ quản lý trung tâm, gắn với tài khoản có vai trò Quản lý trung tâm.',
    source: api.managers, sample: mock.managers, canWrite: isManager, nameOf: (r) => r.fullName,
    lookups: () => ({ accounts: L.accounts, managers: L.managers }),
    searchText: (r) => `${r.fullName} ${r.email} ${r.phone}`,
    validate: (values, mode) => {
      const errors = {};
      const phoneRegex = /^0\d{9}$/; 
      if (values.phone && !phoneRegex.test(values.phone)) {
        errors.phone = "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.";
      }
      return errors;
    },
    columns: [
      { key: 'fullName', label: 'Họ tên', className: 'cell-strong' },
      { key: 'phone', label: 'Số điện thoại', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Tài khoản', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.managers || []).map((m) => m.accountId || m.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 4 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'Chưa có tên'})`);
        },
        onChange: (value, { lookups, setFormValues }) => {
          const selectedAccount = (lookups.accounts || []).find((a) => a.id === value);
          if (selectedAccount) {
            setFormValues((prev) => ({
              ...prev,
              accountId: value,
              fullName: selectedAccount.fullName || '',
              email: selectedAccount.email || '',
              phone: selectedAccount.phone || '',
            }));
          }
        }, help: 'Tài khoản phải mang vai trò Quản lý trung tâm.' },
      { name: 'fullName', label: 'Họ và tên', required: true, full: true },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
    ],
  },

  invoices: {
    key: 'invoices', title: 'Hóa đơn', singular: 'Hóa đơn',
    description: (u) => `Mỗi lần mua thẻ thành viên hoặc đặt lớp có học phí có một hóa đơn; hóa đơn đã thanh toán thì không xóa được. Đơn thanh toán qua MoMo tự xác nhận khi MoMo báo đã nhận tiền; đơn chuyển khoản trên web được giữ 30 phút: nhận tiền xong bấm “Xác nhận đã nhận tiền”, quá hạn thì máy chủ tự hủy đơn.${isReception(u) ? ' “In” mở hóa đơn để in hoặc lưu PDF.' : ' Lễ tân lập và in hóa đơn tại quầy.'}`,
    source: (u) => (isReception(u) ? api.invoices : { list: api.invoices.list, update: api.invoices.update, remove: api.invoices.remove }),
    sample: mock.invoices, canWrite: isFrontDesk, nameOf: (r) => `${r.memberName} · ${itemOf(r)}`,
    // A class's invoice follows its booking (B53) and a MoMo invoice follows MoMo (B54): they change through confirm,
    // cancel and refund, not by hand
    canEditRow: (r) => !awaitingOnline(r) && !r.classBookingId && r.paymentMethod !== 4 && r.paymentMethod !== 5,
    rowActions: [
      {
        label: 'Xác nhận đã nhận tiền',
        hidden: (r) => !awaitingOnline(r),
        confirm: (r) => `Xác nhận đã nhận ${formatMoney(r.amount)} của ${r.memberName} cho ${itemOf(r)}? ${r.className ? 'Học viên có chỗ trong lớp ngay.' : 'Thẻ sẽ được kích hoạt ngay.'}`,
        run: (r) => api.payments.confirm(r.id),
        done: (r) => (r.className
          ? `Đã xác nhận thanh toán: ${r.memberName} đã có chỗ trong lớp ${r.className}.`
          : `Đã xác nhận thanh toán: ${r.packageName} của ${r.memberName} đã được kích hoạt.`),
      },
      // Opens in a new tab so the list stays where it was (pages/InvoicePrint.jsx)
      { label: 'In', to: (r) => `/print/invoices/${r.id}`, newTab: true, hidden: (r, u) => !isReception(u) },
    ],
    lookups: (u) => ({
      memberships: L.memberships,
      packages: L.packages,
      // Only managers may list receptionists; a receptionist takes payments as themself
      receptionists: u?.role === 'Receptionist'
        ? { load: async () => [await api.receptionists.me()], sample: mock.receptionists.slice(0, 1) }
        : L.receptionists,
    }),
    searchText: (r) => `${r.memberName} ${r.packageName ?? ''} ${r.className ?? ''} ${r.receptionistName}`,
    // Unpaid invoices have no payment date (null) and come first, then the newest payments
    sort: (a, b) =>
      !a.paymentDate || !b.paymentDate
        ? (a.paymentDate ? 1 : 0) - (b.paymentDate ? 1 : 0)
        : b.paymentDate.localeCompare(a.paymentDate),
    columns: [
      { key: 'paymentDate', label: 'Ngày thanh toán', className: 'num', render: (r) => formatDate(r.paymentDate) },
      { key: 'memberName', label: 'Học viên', className: 'cell-strong' },
      { key: 'packageName', label: 'Nội dung', render: (r) => itemOf(r) },
      { key: 'amount', label: 'Số tiền', className: 'num', render: (r) => formatMoney(r.amount) },
      { key: 'paymentMethod', label: 'Hình thức', render: (r) => PaymentMethod.label(r.paymentMethod) },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(InvoiceStatus)(r.status) },
      {
        key: 'receptionistName', label: 'Người thu',
        render: (r) => r.receptionistName || (awaitingOnline(r) ? 'Mua trên web · chờ xác nhận' : 'Mua trên web'),
      },
    ],
    fields: [
      {
        name: 'memberMembershipId', label: 'Thẻ thành viên', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => opt(l.memberships, 'id', (m) => `${m.memberName} · ${m.packageName} · từ ${formatDate(m.startDate)}`),
        // Fill the amount in from the package price
        onChange: (value, { lookups, setFormValues }) => {
          const membership = (lookups.memberships ?? []).find((m) => m.id === value);
          const price = (lookups.packages ?? []).find((p) => p.id === membership?.packageId)?.price;
          if (price !== undefined) setFormValues((prev) => ({ ...prev, amount: String(price) }));
        },
        help: 'Thẻ thành viên mà hóa đơn này thanh toán. Mỗi thẻ chỉ có một hóa đơn.',
      },
      {
        name: 'receptionistId', label: 'Người thu', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => opt(l.receptionists, 'id', 'fullName'), defaultValue: (u) => u?.receptionistId ?? '',
      },
      { name: 'amount', label: 'Số tiền (VND)', type: 'number', required: true, min: 1, createOnly: true },
      { name: 'paymentMethod', label: 'Hình thức thanh toán', type: 'select', numeric: true, required: true, options: DESK_METHODS },
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: InvoiceStatus.options, defaultValue: () => '1' },
    ],
  },

  myClasses: {
    key: 'myClasses', title: 'Lớp của tôi', singular: 'Lớp học',
    description: 'Các lớp bạn dạy và số học viên đã đặt.',
    source: (u) => ({ list: () => api.coaches.classes(u.coachId) }), sample: mock.coachClasses,
    searchText: (r) => `${r.className} ${r.categoryName}`,
    columns: [
      { key: 'className', label: 'Lớp', className: 'cell-strong' },
      { key: 'categoryName', label: 'Môn' },
      { key: 'fill', label: 'Đã đặt', className: 'num', render: (r) => <FillBar value={r.currentEnrolled} max={r.maxCapacity} /> },
      { key: 'dates', label: 'Thời gian', className: 'num', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(ClassStatus)(r.status) },
    ],
    rowActions: [{ label: 'Danh sách', modal: { title: (r) => `${r.className} — danh sách học viên`, render: (r) => <ClassRoster classId={r.classId} /> } }],
    emptyHint: 'Khi quản lý giao lớp cho bạn, lớp sẽ hiện ở đây.',
  },

  myMembers: {
    key: 'myMembers', title: 'Học viên của tôi', singular: 'Học viên',
    description: 'Những học viên đã đặt các lớp của bạn, kèm mục tiêu tập luyện của họ.',
    source: (u) => ({ list: () => api.coaches.members(u.coachId) }), sample: mock.coachMembers,
    searchText: (r) => `${r.fullName} ${r.className} ${r.email} ${r.trainingGoal ?? ''}`,
    columns: [
      { key: 'fullName', label: 'Học viên', className: 'cell-strong' },
      { key: 'className', label: 'Lớp' },
      { key: 'trainingGoal', label: 'Mục tiêu', render: (r) => <span className="clamp">{r.trainingGoal || '—'}</span> },
      { key: 'gender', label: 'Giới tính', render: (r) => (r.gender ? Gender.label(r.gender) : '—') },
      { key: 'dob', label: 'Ngày sinh', className: 'num', render: (r) => formatDate(r.dob) },
      { key: 'phone', label: 'Số điện thoại', className: 'num', render: (r) => realPhone(r.phone) || '—' },
      { key: 'email', label: 'Email' },
    ],
  },

  /* ====================================================================
     Members, packages, memberships, accounts, training
     (these used to be UI-only previews; all of them call the API now)
     ==================================================================== */
  // MemberResponse carries the account's join date and status. A new member is registered like on the
  // website (POST /api/auth/register creates the account and the profile; POST /api/members would need
  // an existing account). Reception and managers edit a member; only a manager may delete one.
  members: {
    key: 'members', title: 'Học viên', singular: 'Học viên',
    description: (u) => (isReception(u)
      ? 'Tìm kiếm, đăng ký và cập nhật thông tin học viên tại quầy. Cột Thẻ thành viên cho biết học viên có đặt lớp được không.'
      : 'Tìm kiếm và cập nhật thông tin học viên; lễ tân đăng ký học viên mới tại quầy. Cột Thẻ thành viên cho biết học viên có đặt lớp được không.'),
    source: (u) => ({
      // Each member gets their card from the card list (reception and managers may read it)
      list: async () => {
        const [members, cards] = await Promise.all([api.members.list(), api.memberships.list().catch(() => null)]);
        return cards ? members.map((m) => ({ ...m, card: cardOf(cards, m.id) })) : members;
      },
      ...(isReception(u) ? { create: (body) => api.auth.register(body) } : {}),
      update: api.members.update,
      ...(isManager(u) ? { remove: api.members.remove } : {}),
    }),
    sample: mock.members, canWrite: isFrontDesk, canDelete: isManager, nameOf: (r) => r.fullName,
    searchText: (r) => `${r.fullName} ${r.phone} ${r.email} ${r.card?.card?.packageName ?? ''}`,
    filters: [{
      key: 'card', label: 'Lọc theo thẻ thành viên', all: 'Mọi học viên',
      options: () => CARD_STATES,
      match: (r, v) => r.card?.state === v,
    }],
    columns: [
      { key: 'fullName', label: 'Họ tên', className: 'cell-strong' },
      { key: 'phone', label: 'Số điện thoại', className: 'num', render: (r) => realPhone(r.phone) || '—' },
      { key: 'email', label: 'Email' },
      { key: 'card', label: 'Thẻ thành viên', render: (r) => <CardCell info={r.card} /> },
      { key: 'gender', label: 'Giới tính', render: (r) => (r.gender ? Gender.label(r.gender) : '—') },
      { key: 'dob', label: 'Ngày sinh', className: 'num', render: (r) => formatDate(r.dob) },
      { key: 'trainingGoal', label: 'Mục tiêu', render: (r) => <span className="clamp">{r.trainingGoal || '—'}</span> },
      { key: 'createdAt', label: 'Ngày tham gia', className: 'num', render: (r) => formatDate(r.createdAt) },
      { key: 'accountStatus', label: 'Tài khoản', render: (r) => (r.accountStatus ? tag(AccountStatus)(r.accountStatus) : '—') },
    ],
    fields: [
      { name: 'fullName', label: 'Họ và tên', required: true, full: true },
      { name: 'username', label: 'Tên đăng nhập', required: true, createOnly: true },
      { name: 'password', label: 'Mật khẩu tạm', type: 'password', required: true, createOnly: true, help: 'Ít nhất 8 ký tự. Đưa mật khẩu này cho học viên để đăng nhập.' },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'dob', label: 'Ngày sinh', type: 'date', required: true },
      { name: 'gender', label: 'Giới tính', type: 'select', options: Gender.options },
      { name: 'trainingGoal', label: 'Mục tiêu tập luyện', type: 'textarea' },
    ],
    validate: (v, mode) => {
      const e = {};
      if (v.phone && !/^0\d{9}$/.test(v.phone)) e.phone = 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.';
      if (mode === 'create' && v.password && v.password.length < 8) e.password = 'Mật khẩu cần ít nhất 8 ký tự.';
      return e;
    },
    // Edit keeps the account and photo the API would otherwise overwrite
    toRequest: (b, { mode, row }) => ({
      ...b,
      dob: fromDateInput(b.dob),
      gender: b.gender ?? '',
      trainingGoal: b.trainingGoal ?? '',
      ...(mode === 'edit' ? { accountId: row.accountId, avatar: row.avatar ?? '' } : {}),
    }),
  },

  receptionists: {
    key: 'receptionists', title: 'Lễ tân', singular: 'Lễ tân',
    source: api.receptionists, sample: mock.receptionists, canWrite: isManager, nameOf: (r) => r.fullName,
    lookups: () => ({ accounts: L.accounts, receptionists: L.receptionists }),
    searchText: (r) => `${r.fullName} ${r.phone} ${r.email}`,
    validate: (values, mode) => {
      const errors = {};
      const phoneRegex = /^0\d{9}$/; 
      if (values.phone && !phoneRegex.test(values.phone)) {
        errors.phone = "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.";
      }
      return errors;
    },
    columns: [
      { key: 'fullName', label: 'Họ tên', className: 'cell-strong' },
      { key: 'workingShift', label: 'Ca làm' },
      { key: 'phone', label: 'Số điện thoại', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Tài khoản', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.receptionists || []).map((r) => r.accountId || r.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 3 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'Chưa có tên'})`);
        },
        onChange: (value, { lookups, setFormValues }) => {
          const selectedAccount = (lookups.accounts || []).find((a) => a.id === value);
          if (selectedAccount) {
            setFormValues((prev) => ({
              ...prev,
              accountId: value,
              fullName: selectedAccount.fullName || '',
              email: selectedAccount.email || '',
              phone: selectedAccount.phone || '',
            }));
          }
        },
        help: 'Tài khoản phải mang vai trò Lễ tân.'
      },
      { name: 'fullName', label: 'Họ và tên', required: true, full: true },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'workingShift', label: 'Ca làm việc', full: true, placeholder: 'Ca sáng (06:00–14:00)' },
    ],
  },

  packages: {
    key: 'packages', title: 'Gói tập', singular: 'Gói tập',
    description: () => (carries.discount
      ? 'Các gói tập bán trên trang web và tại quầy lễ tân. Mỗi gói dùng cho mọi môn, giảm học phí mọi lớp theo mức của gói và kèm các dịch vụ ghi ở đây.'
      : 'Các gói tập bán trên trang web và tại quầy lễ tân.'),
    source: {
      ...api.packages,
      list: async () => {
        const rows = await api.packages.list();
        carries.discount = hasPackageDiscounts(rows);
        return rows;
      },
    },
    sample: mock.packages, canWrite: isManager, nameOf: (r) => r.packageName,
    searchText: (r) => `${r.packageName} ${r.description} ${r.benefits ?? ''}`,
    idOf: (r) => r.membershipPackageId,
    columns: [
      { key: 'packageName', label: 'Gói tập', className: 'cell-strong' },
      { key: 'durationDays', label: 'Số ngày', className: 'num' },
      { key: 'price', label: 'Giá', className: 'num', render: (r) => formatMoney(r.price) },
      {
        key: 'discountPercent', label: 'Giảm học phí', className: 'num', hidden: () => !carries.discount,
        render: (r) => `${r.discountPercent ?? 0}%`,
      },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(MembershipStatus)(r.status) },
    ],
    fields: [
      { name: 'packageName', label: 'Tên gói', required: true, full: true },
      { name: 'durationDays', label: 'Thời hạn (ngày)', type: 'number', required: true, min: 1 },
      { name: 'price', label: 'Giá (VND)', type: 'number', required: true, min: 0 },
      {
        name: 'discountPercent', label: 'Giảm học phí mọi lớp (%)', type: 'number', required: true, min: 0, max: 100,
        defaultValue: () => '0', shown: () => carries.discount,
      },
      // "Cancelled" only applies to a member's membership, not to a package on sale
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: MembershipStatus.options.filter((o) => o.value !== 4), defaultValue: () => '1' },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      {
        name: 'benefits', label: 'Dịch vụ đi kèm', type: 'textarea', shown: () => carries.discount,
        help: 'Mỗi dòng một dịch vụ, vd. “Khu gym tự do”, “Tủ đồ riêng”. Hiện trên trang Gói tập; nhân viên phục vụ tại trung tâm.',
      },
    ],
  },

  // Editing changes only the dates and status (PUT /api/memberships/{id}); member and package are
  // fixed once sold. Renew and Cancel have their own endpoints.
  memberships: {
    key: 'memberships', title: 'Thẻ thành viên', singular: 'Thẻ thành viên',
    description: (u) => (isReception(u)
      ? 'Học viên nào đang dùng gói nào và đến ngày nào. Gia hạn tạo một kỳ mới nối tiếp kỳ cũ cùng một hóa đơn chờ thanh toán.'
      : 'Học viên nào đang dùng gói nào và đến ngày nào. Lễ tân bán, gia hạn và hủy thẻ tại quầy.'),
    source: (u) => (isReception(u)
      ? api.memberships
      : { list: api.memberships.list, update: api.memberships.update, remove: api.memberships.remove }),
    sample: mock.memberships, canWrite: isFrontDesk, canDelete: isManager,
    lookups: () => ({ members: L.members, packages: L.packages }),
    nameOf: (r) => `${r.memberName} · ${r.packageName}`,
    searchText: (r) => `${r.memberName} ${r.packageName}`,
    sort: (a, b) => String(b.startDate).localeCompare(String(a.startDate)),
    columns: [
      { key: 'memberName', label: 'Học viên', className: 'cell-strong' },
      { key: 'packageName', label: 'Gói tập' },
      { key: 'startDate', label: 'Từ ngày', className: 'num', render: (r) => formatDate(r.startDate) },
      { key: 'endDate', label: 'Đến ngày', className: 'num', render: (r) => formatDate(r.endDate) },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(MembershipStatus)(r.status) },
    ],
    fields: [
      { name: 'memberId', label: 'Học viên', type: 'select', required: true, full: true, createOnly: true, optionsFrom: (l) => opt(l.members, 'id', (m) => (m.email ? `${m.fullName} · ${m.email}` : m.fullName)) },
      {
        name: 'packageId', label: 'Gói tập', type: 'select', required: true, createOnly: true,
        optionsFrom: (l) => opt((l.packages ?? []).filter((p) => p.status === 1), 'id', (p) => `${p.packageName} · ${p.durationDays} ngày · ${formatMoney(p.price)}`),
        // A package of N days that starts on day 1 ends on day N
        onChange: (value, { lookups, setFormValues }) => {
          const days = (lookups.packages ?? []).find((p) => p.id === value)?.durationDays;
          if (days) setFormValues((prev) => ({ ...prev, endDate: addDaysToDateInput(prev.startDate, days - 1) || prev.endDate }));
        },
      },
      {
        name: 'startDate', label: 'Ngày bắt đầu', type: 'date', required: true, defaultValue: todayUtcDateString,
        onChange: (value, { lookups, setFormValues }) =>
          setFormValues((prev) => {
            const days = (lookups.packages ?? []).find((p) => p.id === prev.packageId)?.durationDays;
            return days ? { ...prev, endDate: addDaysToDateInput(value, days - 1) || prev.endDate } : prev;
          }),
      },
      { name: 'endDate', label: 'Ngày kết thúc', type: 'date', required: true, help: 'Tự điền theo số ngày của gói.' },
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: MembershipStatus.options, defaultValue: () => '1' },
    ],
    validate: (v) => (v.startDate && v.endDate && v.endDate < v.startDate ? { endDate: 'Ngày kết thúc không được trước ngày bắt đầu.' } : {}),
    toRequest: (b, { mode }) => ({
      ...(mode === 'create' ? { memberId: b.memberId, packageId: b.packageId } : {}),
      startDate: fromDateInput(b.startDate),
      endDate: fromDateInput(b.endDate),
      status: b.status,
    }),
    rowActions: [
      {
        label: 'Gia hạn',
        run: (r) => api.memberships.renew(r.id),
        // Package names already start with "Thẻ …", so the messages name the package alone
        confirm: (r) => `Gia hạn ${r.packageName} của ${r.memberName} thêm một chu kỳ? Hệ thống tạo kỳ mới và một hóa đơn chờ thanh toán.`,
        done: (r) => `Đã gia hạn thẻ của ${r.memberName}; hóa đơn chờ thanh toán đã được tạo.`,
        hidden: (r, u) => !isReception(u),
      },
      {
        label: 'Hủy thẻ',
        run: (r) => api.memberships.cancel(r.id),
        confirm: (r) => `Hủy ${r.packageName} của ${r.memberName}?`,
        done: (r) => `Đã hủy thẻ của ${r.memberName}.`,
        hidden: (r, u) => r.status !== 1 || !isReception(u),
      },
    ],
    emptyHint: 'Hãy có học viên và gói tập trước, rồi bán thẻ thành viên ở đây.',
  },

  accounts: {
    key: 'accounts', title: 'Tài khoản', singular: 'Tài khoản',
    description: 'Tài khoản đăng nhập và vai trò của từng người. Khóa tài khoản để chặn đăng nhập.',
    source: api.accounts, sample: mock.accounts, canWrite: isManager, nameOf: (r) => r.username,
    searchText: (r) => `${r.username} ${AccountRole.label(r.role)}`,
    validate: (values, mode) => {
      const errors = {};
      const phoneRegex = /^0\d{9}$/; 
      if (values.phone && !phoneRegex.test(values.phone)) {
        errors.phone = "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.";
      }
      return errors;
    },
    columns: [
      { key: 'fullName', label: 'Họ và tên' }, 
      { key: 'username', label: 'Tên đăng nhập', className: 'cell-strong' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Số điện thoại', className: 'num', render: (r) => r.phone || '—' },
      { key: 'role', label: 'Vai trò', render: (r) => AccountRole.label(r.role) },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(AccountStatus)(r.status) },
      { key: 'createdAt', label: 'Ngày tạo', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'fullName', label: 'Họ và tên', required: true },
      { name: 'username', label: 'Tên đăng nhập', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true },
      { name: 'password', label: 'Mật khẩu tạm', type: 'password', required: true, createOnly: true, full: true, help: 'Người dùng sẽ đổi mật khẩu ở lần đăng nhập đầu tiên.' },
      { name: 'role', label: 'Vai trò', type: 'select', numeric: true, required: true, options: AccountRole.options, createOnly: true },
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: AccountStatus.options, defaultValue: () => '1' },
    ],
    toRequest: (data) => data,
  },

  // A plan belongs to one member (the API takes one memberId), so a plan "for the whole class" is one copy
  // for each member booked into the class (CHANGELOG Part B, B49).
  trainingPlans: {
    key: 'trainingPlans', title: 'Kế hoạch tập luyện', singular: 'Kế hoạch',
    description: 'Kế hoạch bạn lập cho học viên trong lớp của mình. Chọn “Cả lớp” để lập cùng một kế hoạch cho mọi học viên đã đặt lớp.',
    source: (u) => ({
      list: async () => {
        const [plans, names] = await Promise.all([api.trainingPlans.forCoach(), coachNames()]);
        return plans.map((p) => ({ ...p, memberName: names.member(p.memberId), className: names.className(p.classId) }));
      },
      create: async ({ scope, ...plan }) => {
        const coachId = await coachIdOf(u);
        if (scope !== 'class') return api.trainingPlans.create({ ...plan, coachId });
        const booked = uniqueBy((await api.coaches.members()).filter((m) => m.classId === plan.classId), 'memberId');
        if (!booked.length) throw new Error('Lớp này chưa có học viên nào đặt, nên chưa lập được kế hoạch cho cả lớp.');
        const results = await Promise.allSettled(
          booked.map((m) => api.trainingPlans.create({ ...plan, memberId: m.memberId, coachId })),
        );
        const failed = booked.filter((_, i) => results[i].status === 'rejected');
        if (failed.length) {
          const done = booked.length - failed.length;
          const why = results.find((r) => r.status === 'rejected').reason?.message ?? '';
          const err = new Error(
            `Đã lập kế hoạch cho ${done}/${booked.length} học viên. Chưa lập được cho ${failed.map((m) => m.fullName).join(', ')}${why ? `: ${why}` : '.'}`,
          );
          err.partial = done > 0;
          throw err;
        }
        return { count: booked.length };
      },
      update: async (id, body) => api.trainingPlans.update(id, { ...body, coachId: await coachIdOf(u) }),
      remove: (id) => api.trainingPlans.remove(id),
    }),
    doneMessage: (mode, result) => (result?.count ? `Đã lập kế hoạch cho ${result.count} học viên của lớp.` : undefined),
    sample: mock.trainingPlans,
    lookups: () => ({ members: L.coachMembers, classes: L.coachClasses }),
    nameOf: (r) => r.title,
    searchText: (r) => `${r.title} ${r.memberName} ${r.className}`,
    sort: (a, b) => String(b.createdDate).localeCompare(String(a.createdDate)),
    columns: [
      { key: 'title', label: 'Kế hoạch', className: 'cell-strong' },
      { key: 'memberName', label: 'Học viên' },
      { key: 'className', label: 'Lớp' },
      { key: 'createdDate', label: 'Ngày tạo', className: 'num', render: (r) => formatDate(r.createdDate) },
    ],
    fields: [
      {
        name: 'classId', label: 'Lớp', type: 'select', required: true, optionsFrom: (l) => opt(l.classes, 'classId', 'className'),
        // A member picked for another class does not carry over
        onChange: (value, { lookups, setFormValues }) =>
          setFormValues((prev) => ((lookups.members ?? []).some((m) => m.classId === value && m.memberId === prev.memberId)
            ? prev
            : { ...prev, memberId: '' })),
      },
      {
        name: 'scope', label: 'Lập cho', type: 'select', required: true, createOnly: true, defaultValue: () => 'one',
        options: [{ value: 'one', label: 'Một học viên' }, { value: 'class', label: 'Cả lớp (mỗi học viên một bản)' }],
      },
      {
        name: 'memberId', label: 'Học viên', type: 'select', required: true,
        shown: (v, mode) => mode === 'edit' || v.scope !== 'class',
        optionsFrom: (l, _u, v) => {
          const inClass = (l.members ?? []).filter((m) => !v?.classId || m.classId === v.classId);
          const options = opt(uniqueBy(inClass, 'memberId'), 'memberId', 'fullName');
          // A plan kept for someone who has since left the class still shows its member
          if (v?.memberId && !options.some((o) => o.value === v.memberId)) {
            const m = (l.members ?? []).find((x) => x.memberId === v.memberId);
            options.push({ value: v.memberId, label: m?.fullName ?? 'Học viên của kế hoạch này' });
          }
          return options;
        },
        help: 'Những học viên đã đặt lớp đã chọn.',
      },
      { name: 'title', label: 'Tiêu đề', required: true, full: true },
      { name: 'contentDescription', label: 'Nội dung tập', type: 'textarea' },
      { name: 'createdDate', label: 'Ngày', type: 'date', required: true, defaultValue: todayUtcDateString },
    ],
    toRequest: (b, { mode }) => ({
      memberId: b.memberId,
      classId: b.classId,
      title: b.title,
      contentDescription: b.contentDescription ?? '',
      createdDate: fromDateInput(b.createdDate),
      ...(mode === 'create' ? { scope: b.scope } : {}),
    }),
    emptyHint: 'Học viên sẽ có trong biểu mẫu sau khi họ đặt một lớp của bạn.',
  },

  trainingResults: {
    key: 'trainingResults', title: 'Kết quả tập luyện', singular: 'Kết quả',
    description: 'Sau mỗi buổi, chấm điểm tiến độ của từng học viên theo kế hoạch và ghi nhận xét.',
    source: (u) => ({
      list: async () => {
        const [results, plans, names, sessions] = await Promise.all([
          api.trainingResults.forCoach(), api.trainingPlans.forCoach(), coachNames(),
          api.schedules.forCoach().catch(() => []),
        ]);
        return results.map((r) => {
          const plan = plans.find((p) => p.id === r.planId);
          const session = sessionOfResult(sessions, plan, r.evaluationDate);
          return {
            ...r,
            memberName: r.memberName || names.member(r.memberId),
            planTitle: r.planTitle || (plan?.title ?? '—'),
            sessionId: session?.id ?? '',
            sessionText: session ? sessionLabel(session) : '',
          };
        });
      },
      create: async (body) => api.trainingResults.create({ ...body, coachId: await coachIdOf(u) }),
      update: async (id, body) => api.trainingResults.update(id, { ...body, coachId: await coachIdOf(u) }),
      remove: (id) => api.trainingResults.remove(id),
    }),
    sample: mock.trainingResults,
    lookups: () => ({
      plans: L.coachPlans, members: L.coachMembers,
      sessions: { load: () => api.schedules.forCoach(), sample: mock.sessions },
    }),
    nameOf: (r) => `${r.memberName} · ${r.planTitle}`,
    searchText: (r) => `${r.memberName} ${r.planTitle} ${r.coachComment} ${r.sessionText ?? ''}`,
    sort: (a, b) => String(b.evaluationDate).localeCompare(String(a.evaluationDate)),
    columns: [
      {
        key: 'evaluationDate', label: 'Buổi học', className: 'num',
        render: (r) => r.sessionText || formatDate(r.evaluationDate),
      },
      { key: 'memberName', label: 'Học viên', className: 'cell-strong' },
      { key: 'planTitle', label: 'Kế hoạch' },
      { key: 'performanceScore', label: 'Điểm', className: 'num', render: (r) => `${r.performanceScore}/10` },
      { key: 'coachComment', label: 'Nhận xét', render: (r) => <span className="clamp">{r.coachComment}</span> },
    ],
    fields: [
      {
        name: 'planId', label: 'Kế hoạch', type: 'select', required: true, full: true,
        optionsFrom: (l) => opt(l.plans, 'id', (p) => {
          const member = (l.members ?? []).find((m) => m.memberId === p.memberId)?.fullName;
          return member ? `${p.title} — ${member}` : p.title;
        }),
        onChange: (_, { setFormValues }) => setFormValues((prev) => ({ ...prev, sessionId: '' })),
      },
      {
        // Sessions of the plan's class that have taken place, newest first; picking one sets the date
        name: 'sessionId', label: 'Buổi học', type: 'select', full: true, placeholder: 'Không chọn buổi (tự nhập ngày)',
        optionsFrom: (l, _u, v) => {
          const plan = (l.plans ?? []).find((p) => p.id === v?.planId);
          return (l.sessions ?? [])
            .filter((s) => plan && s.classId === plan.classId && String(s.date).slice(0, 10) <= todayLocalDateString())
            .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
            .map((s) => ({ value: s.id, label: sessionLabel(s) }));
        },
        onChange: (value, { lookups, setFormValues }) => {
          const s = (lookups.sessions ?? []).find((x) => x.id === value);
          if (s) setFormValues((prev) => ({ ...prev, evaluationDate: String(s.date).slice(0, 10) }));
        },
        help: 'Chọn kế hoạch trước; danh sách gồm các buổi của lớp đó đã diễn ra.',
      },
      { name: 'performanceScore', label: 'Điểm (0–10)', type: 'number', required: true, min: 0, max: 10, step: 0.5 },
      { name: 'evaluationDate', label: 'Ngày', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'coachComment', label: 'Nhận xét', type: 'textarea', required: true },
    ],
    // The member must be the plan's member (the API checks it)
    toRequest: (b, { lookups }) => ({
      planId: b.planId,
      memberId: lookups.plans?.find((p) => p.id === b.planId)?.memberId,
      performanceScore: b.performanceScore,
      coachComment: b.coachComment ?? '',
      evaluationDate: fromDateInput(b.evaluationDate),
    }),
    emptyHint: 'Hãy lập kế hoạch tập luyện trước, rồi chấm điểm học viên theo kế hoạch ở đây.',
  },

  // Requests members send from My account → Support. Reception and managers answer them here; the API
  // records who handled each one. There is no create here (only a member may open a request).
  supportRequests: {
    key: 'supportRequests', title: 'Yêu cầu hỗ trợ', singular: 'Yêu cầu',
    description: 'Câu hỏi và vấn đề học viên gửi từ tài khoản của họ. Cập nhật trạng thái và ghi lại cách bạn đã xử lý.',
    source: { list: api.supportRequests.list, update: api.supportRequests.update },
    sample: mock.supportRequests, canWrite: isFrontDesk, nameOf: (r) => `Yêu cầu của ${r.memberName}`,
    searchText: (r) => `${r.memberName} ${r.content} ${r.resolution ?? ''}`,
    sort: (a, b) => (a.status === b.status ? String(b.createdAt).localeCompare(String(a.createdAt)) : a.status - b.status),
    filters: [{
      key: 'status', label: 'Lọc theo trạng thái', all: 'Mọi trạng thái',
      options: () => SupportRequestStatus.options.map((o) => ({ value: String(o.value), label: o.label })),
      match: (r, v) => String(r.status) === v,
    }],
    columns: [
      { key: 'createdAt', label: 'Gửi lúc', className: 'num', render: (r) => formatDateTime(r.createdAt) },
      { key: 'memberName', label: 'Học viên', className: 'cell-strong' },
      { key: 'content', label: 'Yêu cầu', render: (r) => <span className="clamp">{r.content}</span> },
      { key: 'status', label: 'Trạng thái', render: (r) => tag(SupportRequestStatus)(r.status) },
      { key: 'resolution', label: 'Câu trả lời', render: (r) => <span className="clamp">{r.resolution || '—'}</span> },
    ],
    fields: [
      { name: 'status', label: 'Trạng thái', type: 'select', numeric: true, required: true, options: SupportRequestStatus.options },
      { name: 'resolution', label: 'Câu trả lời cho học viên', type: 'textarea', help: 'Học viên sẽ thấy câu trả lời này dưới yêu cầu của họ.' },
    ],
    validate: (v) => (v.resolution?.length > 2000 ? { resolution: 'Câu trả lời tối đa 2000 ký tự.' } : {}),
    toRequest: (b) => ({ status: b.status, resolution: b.resolution ?? '' }),
    rowActions: [{
      label: 'Xem',
      modal: {
        title: (r) => `Yêu cầu của ${r.memberName}`,
        render: (r) => (
          <dl className="detail-list">
            <div><dt>Gửi lúc</dt><dd className="num">{formatDateTime(r.createdAt)}</dd></div>
            <div><dt>Trạng thái</dt><dd>{tag(SupportRequestStatus)(r.status)}</dd></div>
            <div><dt>Yêu cầu</dt><dd className="pre-wrap">{r.content}</dd></div>
            <div><dt>Câu trả lời</dt><dd className="pre-wrap">{r.resolution || '—'}</dd></div>
          </dl>
        ),
      },
    }],
    emptyHint: 'Khi học viên gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ, yêu cầu sẽ hiện ở đây.',
  },

  // Read-only history the API keeps of every change staff save (lib/audit.js reads its entries)
  auditLog: {
    key: 'auditLog', title: 'Nhật ký hoạt động', singular: 'Mục nhật ký',
    description: 'Mọi thay đổi do nhân viên lưu, mới nhất ở trên: ai đã làm gì, vào lúc nào.',
    source: { list: async () => groupEntries(await api.auditLogs.list()) },
    sample: groupEntries(mock.auditLogs),
    lookups: () => ({
      accounts: L.accounts, members: L.members, coaches: L.coaches, receptionists: L.receptionists,
      managers: L.managers, classes: L.classes, rooms: L.rooms, categories: L.categories, packages: L.packages,
    }),
    nameOf: (r) => r.entry.label,
    searchText: (r) => `${r.username} ${r.entry.label} ${r.entry.fields.join(' ')} ${r.entry.summary} ${r.entry.lines.join(' ')}`,
    sort: (a, b) => String(b.timestamp).localeCompare(String(a.timestamp)),
    filters: [
      {
        key: 'account', label: 'Lọc theo người', all: 'Mọi người',
        options: (rows) => uniqueBy(rows, 'accountId')
          .map((r) => ({ value: r.accountId, label: r.username || r.accountId }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        match: (r, v) => r.accountId === v,
      },
      {
        key: 'verb', label: 'Lọc theo thao tác', all: 'Mọi thao tác',
        options: (rows) => [...AUDIT_VERBS, { value: 'OTHER', label: 'Khác' }]
          .filter((o) => rows.some((r) => r.entry.verb === o.value)),
        match: (r, v) => r.entry.verb === v,
      },
      {
        key: 'entity', label: 'Lọc theo loại dữ liệu', all: 'Mọi loại dữ liệu',
        options: (rows) => [...new Set(rows.map((r) => r.entry.entity).filter(Boolean))]
          .sort()
          .map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) })),
        match: (r, v) => r.entry.entity === v,
      },
    ],
    columns: [
      { key: 'timestamp', label: 'Thời điểm', className: 'num', render: (r) => formatDateTime(r.timestamp) },
      { key: 'username', label: 'Người thực hiện', render: (r, l) => <AuditWho row={r} accounts={l.accounts} /> },
      { key: 'actionType', label: 'Thao tác', render: (r) => <StatusTag tone={r.entry.tone}>{r.entry.label}</StatusTag> },
      { key: 'description', label: 'Chi tiết', render: (r, l) => <span className="clamp">{auditDetails(r, l) || '—'}</span> },
    ],
    rowActions: [{
      label: 'Xem',
      modal: { title: (r) => r.entry.label, render: (r, l) => <AuditDetail row={r} lookups={l} /> },
    }],
    emptyHint: 'Mỗi khi huấn luyện viên, lễ tân hoặc quản lý lưu một thay đổi, máy chủ sẽ ghi lại ở đây.',
  },
};

function uniqueBy(rows, key) {
  const seen = new Set();
  return (rows ?? []).filter((r) => (seen.has(r[key]) ? false : seen.add(r[key])));
}
