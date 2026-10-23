// Configuration for every list/edit page in the staff area (rendered by CrudPage.jsx).
//
//   source: api.xxx (or (user) => ({ list, create?, update?, remove? })) -> the back-end endpoints;
//   edit and delete buttons only appear when the source has update / remove.
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AUDIT_VERBS, describeAction } from '../../lib/audit.js';
import {
  AccountRole, AccountStatus, BookingStatus, ClassStatus, InvoiceStatus, MembershipStatus, PaymentMethod, RoomStatus,
} from '../../lib/enums.js';
import {
  addDaysToDateInput, formatDate, formatDateTime, formatMoney, formatTimeRange, formatWeekday, fromDateInput,
  realPhone, todayUtcDateString,
} from '../../lib/format.js';
import { ErrorNotice, Loading, SampleDataNotice, StatusTag } from '../../components/ui.jsx';

const tag = (E) => (v) => <StatusTag tone={E.tone(v)}>{E.label(v)}</StatusTag>;
const isManager = (u) => u?.role === 'CenterManager';
const isFrontDesk = (u) => u?.role === 'CenterManager' || u?.role === 'Receptionist';
const opt = (rows, value, label) => (rows ?? []).map((r) => ({ value: r[value], label: typeof label === 'function' ? label(r) : r[label] }));

const endAfterStart = (v) =>
  v.startDate && v.endDate && v.endDate <= v.startDate ? { endDate: 'End date must be after the start date.' } : {};

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

// A member's account row (join date, status) from the manager-only account lookup
const accountOf = (l, member) => (l.accounts ?? []).find((a) => a.id === member.accountId);

// Training plans/results must carry the signed-in coach's ID (the API checks it)
const coachIdOf = async (u) => u?.coachId ?? (await api.coaches.me()).id;

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
  const { user } = useAuth();
  // The class roster endpoint is for managers and coaches; reception gets it from members' bookings
  const fromBookings = user?.role === 'Receptionist';
  const roster = useApi(
    () => (fromBookings ? api.classes.membersFromBookings(classId) : api.classes.members(classId)),
    [classId, fromBookings],
    { sample: mock.classMembers },
  );
  if (roster.loading) return <Loading />;
  return (
    <>
      {roster.usingSample && <SampleDataNotice onRetry={roster.reload} />}
      <ErrorNotice error={!roster.usingSample ? roster.error : null} onRetry={roster.reload} />
      {roster.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Member</th><th>Phone</th><th>Email</th><th>Booked</th><th>Status</th></tr></thead>
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
        !roster.error && <p className="muted">Nobody has booked this class yet.</p>
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

// The description is a summary line, then one line per field (see lib/audit.js)
function AuditDetail({ row, accounts }) {
  const a = accountOfLog(accounts, row);
  const action = describeAction(row.actionType);
  const [summary, ...lines] = String(row.description ?? '').split('\n');
  return (
    <dl className="detail-list">
      <div><dt>When</dt><dd className="num">{formatDateTime(row.timestamp)}</dd></div>
      <div><dt>Who</dt><dd>{row.username}{a && ` · ${personOf(a)}`}</dd></div>
      <div><dt>Action</dt><dd><StatusTag tone={action.tone}>{action.label}</StatusTag></dd></div>
      <div><dt>What</dt><dd>{summary || '—'}</dd></div>
      {lines.length > 0 && (
        <div>
          <dt>Details</dt>
          <dd><ul>{lines.map((line, i) => <li key={i}>{line}</li>)}</ul></dd>
        </div>
      )}
    </dl>
  );
}

/* ======================================================================
   API-backed pages
   ====================================================================== */
export const resources = {
  classes: {
    key: 'classes', title: 'Classes', singular: 'Class',
    description: 'Every class on the programme. Members book a class once and attend all of its sessions.',
    source: api.classes, sample: mock.classes, lookups: () => ({ categories: L.categories, coaches: L.coaches }),
    canWrite: isManager, nameOf: (r) => r.className,
    searchText: (r) => `${r.className} ${r.categoryName} ${r.coachName}`,
    sort: (a, b) => a.startDate.localeCompare(b.startDate),
    columns: [
      { key: 'className', label: 'Class', className: 'cell-strong' },
      { key: 'categoryName', label: 'Sport' },
      { key: 'coachName', label: 'Coach' },
      { key: 'maxCapacity', label: 'Size', className: 'num' },
      { key: 'dates', label: 'Runs', className: 'num', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'status', label: 'Status', render: (r) => tag(ClassStatus)(r.status) },
    ],
    fields: [
      { name: 'className', label: 'Class name', required: true, full: true, max: 150 },
      { name: 'categoryId', label: 'Sport', type: 'select', required: true, optionsFrom: (l) => opt(l.categories, 'id', 'categoryName') },
      { name: 'coachId', label: 'Coach', type: 'select', required: true, optionsFrom: (l) => opt(l.coaches, 'id', 'fullName') },
      { name: 'maxCapacity', label: 'Max people', type: 'number', required: true, min: 1, max: 1000 },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: ClassStatus.options, defaultValue: () => '1' },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date', required: true },
    ],
    validate: endAfterStart,
    rowActions: [{ label: 'Roster', modal: { title: (r) => `${r.className} — roster`, render: (r) => <ClassRoster classId={r.id} /> } }],
    emptyHint: 'Add a sport and a coach first, then create the class.',
    toRequest: (data) => ({
      ...data,
      startDate: data.startDate ? `${data.startDate}T00:00:00Z` : data.startDate,
      endDate: data.endDate ? `${data.endDate}T00:00:00Z` : data.endDate,
    })
  },

  schedule: {
    key: 'schedule', title: 'Schedule', singular: 'Session',
    description: (u) => (u?.role === 'Coach'
      ? 'Sessions of the classes you coach. Open one to take attendance.'
      : 'Sessions for each class. The server blocks double-booked rooms and dates outside the class period.'),
    // A coach sees only the sessions of the classes they teach
    source: (u) => (u?.role === 'Coach' ? { list: api.schedules.forCoach } : api.schedules), sample: mock.sessions,
    lookups: (u) => (isManager(u) ? { classes: L.classes, rooms: L.rooms } : {}),
    canWrite: isManager, nameOf: (r) => `${r.className} on ${formatDate(r.date)}`,
    searchText: (r) => `${r.className} ${r.roomName} ${formatDate(r.date)}`,
    sort: (a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime),
    columns: [
      { key: 'date', label: 'Date', className: 'num', render: (r) => <><span className="muted">{formatWeekday(r.date)}</span> {formatDate(r.date)}</> },
      { key: 'time', label: 'Time', className: 'num', render: (r) => formatTimeRange(r.startTime, r.endTime) },
      { key: 'className', label: 'Class', className: 'cell-strong' },
      { key: 'roomName', label: 'Room' },
    ],
    fields: [
      { name: 'classId', label: 'Class', type: 'select', required: true, full: true, optionsFrom: (l) => opt(l.classes, 'id', 'className') },
      { name: 'roomId', label: 'Room', type: 'select', required: true, optionsFrom: (l) => opt(l.rooms, 'id', (r) => `${r.roomName} · ${r.capacity} people${r.status === 2 ? ' (unavailable)' : ''}`) },
      { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'startTime', label: 'Starts', type: 'time', required: true },
      { name: 'endTime', label: 'Ends', type: 'time', required: true },
    ],
    validate: (v) => (v.startTime && v.endTime && v.endTime <= v.startTime ? { endTime: 'End time must be after the start time.' } : {}),
    // Only the coach takes (and corrects) attendance; their list holds only their own classes
    rowActions: [{
      label: 'Attendance',
      to: (r) => `/staff/attendance?session=${r.id}`,
      hidden: (r, u) => u?.role !== 'Coach',
    }],
    emptyHint: 'Create a class first, then add its sessions here.',
  },

  rooms: {
    key: 'rooms', title: 'Rooms', singular: 'Room',
    description: 'Studios, courts and halls. Unavailable rooms can’t be scheduled.',
    source: api.rooms, sample: mock.rooms, canWrite: isManager, nameOf: (r) => r.roomName,
    searchText: (r) => r.roomName,
    sort: (a, b) => a.roomName.localeCompare(b.roomName),
    columns: [
      { key: 'roomName', label: 'Room', className: 'cell-strong' },
      { key: 'capacity', label: 'Capacity', className: 'num' },
      { key: 'status', label: 'Status', render: (r) => tag(RoomStatus)(r.status) },
      { key: 'createdAt', label: 'Added', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'roomName', label: 'Room name', required: true, full: true },
      { name: 'capacity', label: 'Capacity', type: 'number', required: true, min: 1 },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: RoomStatus.options, defaultValue: () => '1' },
    ],
  },

  sports: {
    key: 'sports', title: 'Sports', singular: 'Sport',
    description: 'Sport categories shown on the website. A sport with classes can’t be deleted.',
    source: api.categories, sample: mock.categories, canWrite: isManager, nameOf: (r) => r.categoryName,
    searchText: (r) => `${r.categoryName} ${r.description}`,
    sort: (a, b) => a.categoryName.localeCompare(b.categoryName),
    columns: [
      { key: 'categoryName', label: 'Sport', className: 'cell-strong' },
      { key: 'description', label: 'Description', render: (r) => <span className="clamp">{r.description || '—'}</span> },
      { key: 'createdAt', label: 'Added', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'categoryName', label: 'Name', required: true, full: true },
      { name: 'description', label: 'Description', type: 'textarea', help: 'Shown on class pages under “About”.' },
    ],
  },

  coaches: {
    key: 'coaches', title: 'Coaches', singular: 'Coach',
    description: 'Coach profiles. Each profile is linked to an account with the Coach role.',
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
      if (values.avatar && !/^https?:\/\/\S+$/i.test(values.avatar)) {
        errors.avatar = 'This is not a link. Paste a photo link that starts with https://, or clear the field.';
      } else if (values.avatar && values.avatar.length > 500) {
        errors.avatar = 'The link is too long (max 500 characters).';
      }
      return errors;
    },
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'specialization', label: 'Specialization', render: (r) => r.specialization || '—' },
      { key: 'experienceYears', label: 'Years', className: 'num' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.coaches || []).map((c) => c.accountId || c.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 2 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'No name'})`);
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
        help: 'The account must already exist and have the Coach role.'
      },
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'specialization', label: 'Specialization' },
      { name: 'experienceYears', label: 'Years of experience', type: 'number', min: 0, max: 50, defaultValue: () => '0' },
      // The API stores the photo as a link (max 500 characters); it has no file upload
      { name: 'avatar', label: 'Photo link', type: 'url', full: true, placeholder: 'https://…/coach.jpg', help: 'Link to a .jpg / .png / .webp photo (upload it to an image host first). Leave empty for initials.' },
    ],
  },

  managers: {
    key: 'managers', title: 'Managers', singular: 'Manager',
    description: 'Center manager profiles, linked to accounts with the Center manager role.',
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
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.managers || []).map((m) => m.accountId || m.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 4 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'No name'})`);
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
        }, help: 'The account must have the Center manager role.' },
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
    ],
  },

  invoices: {
    key: 'invoices', title: 'Invoices', singular: 'Invoice',
    description: 'One invoice per membership purchase. Paid invoices can’t be deleted.',
    source: api.invoices, sample: mock.invoices, canWrite: isFrontDesk, nameOf: (r) => `${r.memberName} · ${r.packageName}`,
    lookups: (u) => ({
      memberships: L.memberships,
      packages: L.packages,
      // Only managers may list receptionists; a receptionist takes payments as themself
      receptionists: u?.role === 'Receptionist'
        ? { load: async () => [await api.receptionists.me()], sample: mock.receptionists.slice(0, 1) }
        : L.receptionists,
    }),
    searchText: (r) => `${r.memberName} ${r.packageName} ${r.receptionistName}`,
    sort: (a, b) => b.paymentDate.localeCompare(a.paymentDate),
    columns: [
      { key: 'paymentDate', label: 'Date', className: 'num', render: (r) => formatDate(r.paymentDate) },
      { key: 'memberName', label: 'Member', className: 'cell-strong' },
      { key: 'packageName', label: 'Membership' },
      { key: 'amount', label: 'Amount', className: 'num', render: (r) => formatMoney(r.amount) },
      { key: 'paymentMethod', label: 'Method', render: (r) => PaymentMethod.label(r.paymentMethod) },
      { key: 'status', label: 'Status', render: (r) => tag(InvoiceStatus)(r.status) },
      { key: 'receptionistName', label: 'Taken by' },
    ],
    fields: [
      {
        name: 'memberMembershipId', label: 'Membership', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => opt(l.memberships, 'id', (m) => `${m.memberName} · ${m.packageName} · from ${formatDate(m.startDate)}`),
        // Fill the amount in from the package price
        onChange: (value, { lookups, setFormValues }) => {
          const membership = (lookups.memberships ?? []).find((m) => m.id === value);
          const price = (lookups.packages ?? []).find((p) => p.id === membership?.packageId)?.price;
          if (price !== undefined) setFormValues((prev) => ({ ...prev, amount: String(price) }));
        },
        help: 'The membership this invoice pays for. Each membership can have only one invoice.',
      },
      {
        name: 'receptionistId', label: 'Taken by', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => opt(l.receptionists, 'id', 'fullName'), defaultValue: (u) => u?.receptionistId ?? '',
      },
      { name: 'amount', label: 'Amount (VND)', type: 'number', required: true, min: 1, createOnly: true },
      { name: 'paymentMethod', label: 'Payment method', type: 'select', numeric: true, required: true, options: PaymentMethod.options },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: InvoiceStatus.options, defaultValue: () => '1' },
    ],
  },

  myClasses: {
    key: 'myClasses', title: 'My classes', singular: 'Class',
    description: 'Classes you coach and how full they are.',
    source: (u) => ({ list: () => api.coaches.classes(u.coachId) }), sample: mock.coachClasses,
    searchText: (r) => `${r.className} ${r.categoryName}`,
    columns: [
      { key: 'className', label: 'Class', className: 'cell-strong' },
      { key: 'categoryName', label: 'Sport' },
      { key: 'fill', label: 'Booked', className: 'num', render: (r) => <FillBar value={r.currentEnrolled} max={r.maxCapacity} /> },
      { key: 'dates', label: 'Runs', className: 'num', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'status', label: 'Status', render: (r) => tag(ClassStatus)(r.status) },
    ],
    rowActions: [{ label: 'Roster', modal: { title: (r) => `${r.className} — roster`, render: (r) => <ClassRoster classId={r.classId} /> } }],
    emptyHint: 'When a manager assigns you a class, it shows up here.',
  },

  myMembers: {
    key: 'myMembers', title: 'My members', singular: 'Member',
    description: 'Everyone booked into your classes.',
    source: (u) => ({ list: () => api.coaches.members(u.coachId) }), sample: mock.coachMembers,
    searchText: (r) => `${r.fullName} ${r.className} ${r.email}`,
    columns: [
      { key: 'fullName', label: 'Member', className: 'cell-strong' },
      { key: 'className', label: 'Class' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
  },

  /* ====================================================================
     Members, packages, memberships, accounts, training
     (these used to be UI-only previews; all of them call the API now)
     ==================================================================== */
  // MemberResponse has no join date or account status: those come from the account list, which only
  // a manager may read, so the two columns are manager-only. A new member is registered like on the
  // website (POST /api/auth/register creates the account and the profile; POST /api/members would need
  // an existing account). Only a manager may edit a member (PUT /api/members/{id}).
  members: {
    key: 'members', title: 'Members', singular: 'Member',
    description: 'Search and register members at the front desk.',
    source: (u) => ({
      list: api.members.list,
      create: (body) => api.auth.register(body),
      ...(isManager(u) ? { update: api.members.update, remove: api.members.remove } : {}),
    }),
    sample: mock.members, canWrite: isFrontDesk, canDelete: isManager, nameOf: (r) => r.fullName,
    lookups: (u) => (isManager(u) ? { accounts: L.accounts } : {}),
    searchText: (r) => `${r.fullName} ${r.phone} ${r.email}`,
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'phone', label: 'Phone', className: 'num', render: (r) => realPhone(r.phone) || '—' },
      { key: 'email', label: 'Email' },
      { key: 'gender', label: 'Gender', render: (r) => r.gender || '—' },
      { key: 'dob', label: 'Born', className: 'num', render: (r) => formatDate(r.dob) },
      { key: 'trainingGoal', label: 'Goal', render: (r) => <span className="clamp">{r.trainingGoal || '—'}</span> },
      { key: 'createdAt', label: 'Joined', className: 'num', hidden: (u) => !isManager(u), render: (r, l) => formatDate(accountOf(l, r)?.createdAt) },
      { key: 'status', label: 'Account', hidden: (u) => !isManager(u), render: (r, l) => (accountOf(l, r) ? tag(AccountStatus)(accountOf(l, r).status) : '—') },
    ],
    fields: [
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'username', label: 'Username', required: true, createOnly: true },
      { name: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true, help: 'At least 8 characters. Give it to the member to sign in.' },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }] },
      { name: 'trainingGoal', label: 'Training goal', type: 'textarea' },
    ],
    validate: (v, mode) => {
      const e = {};
      if (v.phone && !/^0\d{9}$/.test(v.phone)) e.phone = 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0.';
      if (mode === 'create' && v.password && v.password.length < 8) e.password = 'Use at least 8 characters.';
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
    key: 'receptionists', title: 'Receptionists', singular: 'Receptionist',
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
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'workingShift', label: 'Shift' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      {
        name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true,
        optionsFrom: (l) => {
          const addedAccountIds = new Set((l.receptionists || []).map((r) => r.accountId || r.id));
          const availableAccounts = (l.accounts || []).filter(
            (a) => a.role === 3 && !addedAccountIds.has(a.id)
          );
          return opt(availableAccounts, 'id', (a) => `${a.username} (${a.fullName || 'No name'})`);
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
        help: 'The account must have the Receptionist role.'
      },
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'workingShift', label: 'Working shift', full: true, placeholder: 'Morning (06:00–14:00)' },
    ],
  },

  packages: {
    key: 'packages', title: 'Packages', singular: 'Package',
    description: 'Membership plans sold on the website and at reception.',
    source: api.packages, sample: mock.packages, canWrite: isManager, nameOf: (r) => r.packageName,
    searchText: (r) => `${r.packageName} ${r.description}`,
    idOf: (r) => r.membershipPackageId,
    columns: [
      { key: 'packageName', label: 'Package', className: 'cell-strong' },
      { key: 'durationDays', label: 'Days', className: 'num' },
      { key: 'price', label: 'Price', className: 'num', render: (r) => formatMoney(r.price) },
      { key: 'status', label: 'Status', render: (r) => tag(MembershipStatus)(r.status) },
    ],
    fields: [
      { name: 'packageName', label: 'Name', required: true, full: true },
      { name: 'durationDays', label: 'Duration (days)', type: 'number', required: true, min: 1 },
      { name: 'price', label: 'Price (VND)', type: 'number', required: true, min: 0 },
      // "Cancelled" only applies to a member's membership, not to a package on sale
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: MembershipStatus.options.filter((o) => o.value !== 4), defaultValue: () => '1' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },

  // Editing changes only the dates and status (PUT /api/memberships/{id}); member and package are
  // fixed once sold. Renew and Cancel have their own endpoints.
  memberships: {
    key: 'memberships', title: 'Memberships', singular: 'Membership',
    description: 'Which member holds which package, and until when. Renew extends a membership by one package period.',
    source: api.memberships, sample: mock.memberships, canWrite: isFrontDesk, canDelete: isManager,
    lookups: () => ({ members: L.members, packages: L.packages }),
    nameOf: (r) => `${r.memberName} · ${r.packageName}`,
    searchText: (r) => `${r.memberName} ${r.packageName}`,
    sort: (a, b) => String(b.startDate).localeCompare(String(a.startDate)),
    columns: [
      { key: 'memberName', label: 'Member', className: 'cell-strong' },
      { key: 'packageName', label: 'Package' },
      { key: 'startDate', label: 'From', className: 'num', render: (r) => formatDate(r.startDate) },
      { key: 'endDate', label: 'Until', className: 'num', render: (r) => formatDate(r.endDate) },
      { key: 'status', label: 'Status', render: (r) => tag(MembershipStatus)(r.status) },
    ],
    fields: [
      { name: 'memberId', label: 'Member', type: 'select', required: true, full: true, createOnly: true, optionsFrom: (l) => opt(l.members, 'id', (m) => (m.email ? `${m.fullName} · ${m.email}` : m.fullName)) },
      {
        name: 'packageId', label: 'Package', type: 'select', required: true, createOnly: true,
        optionsFrom: (l) => opt((l.packages ?? []).filter((p) => p.status === 1), 'id', (p) => `${p.packageName} · ${p.durationDays} days · ${formatMoney(p.price)}`),
        // A package of N days that starts on day 1 ends on day N
        onChange: (value, { lookups, setFormValues }) => {
          const days = (lookups.packages ?? []).find((p) => p.id === value)?.durationDays;
          if (days) setFormValues((prev) => ({ ...prev, endDate: addDaysToDateInput(prev.startDate, days - 1) || prev.endDate }));
        },
      },
      {
        name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: todayUtcDateString,
        onChange: (value, { lookups, setFormValues }) =>
          setFormValues((prev) => {
            const days = (lookups.packages ?? []).find((p) => p.id === prev.packageId)?.durationDays;
            return days ? { ...prev, endDate: addDaysToDateInput(value, days - 1) || prev.endDate } : prev;
          }),
      },
      { name: 'endDate', label: 'End date', type: 'date', required: true, help: 'Filled in from the package length.' },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: MembershipStatus.options, defaultValue: () => '1' },
    ],
    validate: (v) => (v.startDate && v.endDate && v.endDate < v.startDate ? { endDate: 'End date can’t be before the start date.' } : {}),
    toRequest: (b, { mode }) => ({
      ...(mode === 'create' ? { memberId: b.memberId, packageId: b.packageId } : {}),
      startDate: fromDateInput(b.startDate),
      endDate: fromDateInput(b.endDate),
      status: b.status,
    }),
    rowActions: [
      {
        label: 'Renew',
        run: (r) => api.memberships.renew(r.id),
        confirm: (r) => `Renew ${r.memberName}’s ${r.packageName} membership for one more package period?`,
        done: (r) => `${r.memberName}’s membership was renewed.`,
      },
      {
        label: 'Cancel',
        run: (r) => api.memberships.cancel(r.id),
        confirm: (r) => `Cancel ${r.memberName}’s ${r.packageName} membership?`,
        done: (r) => `${r.memberName}’s membership was cancelled.`,
        hidden: (r) => r.status !== 1,
      },
    ],
    emptyHint: 'Add a member and a package first, then sell the membership here.',
  },

  accounts: {
    key: 'accounts', title: 'Accounts', singular: 'Account',
    description: 'Sign-in accounts and their roles. Lock an account to block sign-in.',
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
      { key: 'fullName', label: 'Full name' }, 
      { key: 'username', label: 'Username', className: 'cell-strong' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone', className: 'num', render: (r) => r.phone || '—' },
      { key: 'role', label: 'Role', render: (r) => AccountRole.label(r.role) },
      { key: 'status', label: 'Status', render: (r) => tag(AccountStatus)(r.status) },
      { key: 'createdAt', label: 'Created', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'username', label: 'Username', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true, full: true, help: 'The user changes it at first sign-in.' },
      { name: 'role', label: 'Role', type: 'select', numeric: true, required: true, options: AccountRole.options, createOnly: true },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: AccountStatus.options, defaultValue: () => '1' },
    ],
    toRequest: (data) => data,
    // Locking or unlocking an account is logged as its own action
    audit: (mode, before, after, name) => {
      const LOCKED = '3'; // AccountStatus "Locked", as the form holds it
      if (mode !== 'edit' || before.status === after.status) return null;
      if (after.status === LOCKED) return { verb: 'LOCK', text: `Locked account “${name}”` };
      if (before.status === LOCKED) return { verb: 'UNLOCK', text: `Unlocked account “${name}”` };
      return null;
    },
  },

  trainingPlans: {
    key: 'trainingPlans', title: 'Training plans', singular: 'Plan',
    description: 'Plans you write for members in your classes.',
    source: (u) => ({
      list: async () => {
        const [plans, names] = await Promise.all([api.trainingPlans.forCoach(), coachNames()]);
        return plans.map((p) => ({ ...p, memberName: names.member(p.memberId), className: names.className(p.classId) }));
      },
      create: async (body) => api.trainingPlans.create({ ...body, coachId: await coachIdOf(u) }),
      update: async (id, body) => api.trainingPlans.update(id, { ...body, coachId: await coachIdOf(u) }),
      remove: (id) => api.trainingPlans.remove(id),
    }),
    sample: mock.trainingPlans,
    lookups: () => ({ members: L.coachMembers, classes: L.coachClasses }),
    nameOf: (r) => r.title,
    searchText: (r) => `${r.title} ${r.memberName} ${r.className}`,
    sort: (a, b) => String(b.createdDate).localeCompare(String(a.createdDate)),
    columns: [
      { key: 'title', label: 'Plan', className: 'cell-strong' },
      { key: 'memberName', label: 'Member' },
      { key: 'className', label: 'Class' },
      { key: 'createdDate', label: 'Created', className: 'num', render: (r) => formatDate(r.createdDate) },
    ],
    fields: [
      { name: 'memberId', label: 'Member', type: 'select', required: true, optionsFrom: (l) => opt(uniqueBy(l.members, 'memberId'), 'memberId', 'fullName') },
      { name: 'classId', label: 'Class', type: 'select', required: true, optionsFrom: (l) => opt(l.classes, 'classId', 'className') },
      { name: 'title', label: 'Title', required: true, full: true },
      { name: 'contentDescription', label: 'What to do', type: 'textarea' },
      { name: 'createdDate', label: 'Date', type: 'date', required: true, defaultValue: todayUtcDateString },
    ],
    toRequest: (b) => ({
      memberId: b.memberId,
      classId: b.classId,
      title: b.title,
      contentDescription: b.contentDescription ?? '',
      createdDate: fromDateInput(b.createdDate),
    }),
    emptyHint: 'Members appear in the form once they book one of your classes.',
  },

  trainingResults: {
    key: 'trainingResults', title: 'Training results', singular: 'Result',
    description: 'Score each member’s progress against their plan and leave a comment.',
    source: (u) => ({
      list: async () => {
        const [results, plans, names] = await Promise.all([
          api.trainingResults.forCoach(), api.trainingPlans.forCoach(), coachNames(),
        ]);
        return results.map((r) => ({
          ...r,
          memberName: r.memberName || names.member(r.memberId),
          planTitle: r.planTitle || (plans.find((p) => p.id === r.planId)?.title ?? '—'),
        }));
      },
      create: async (body) => api.trainingResults.create({ ...body, coachId: await coachIdOf(u) }),
      update: async (id, body) => api.trainingResults.update(id, { ...body, coachId: await coachIdOf(u) }),
      remove: (id) => api.trainingResults.remove(id),
    }),
    sample: mock.trainingResults,
    lookups: () => ({ plans: L.coachPlans, members: L.coachMembers }),
    nameOf: (r) => `${r.memberName} · ${r.planTitle}`,
    searchText: (r) => `${r.memberName} ${r.planTitle} ${r.coachComment}`,
    sort: (a, b) => String(b.evaluationDate).localeCompare(String(a.evaluationDate)),
    columns: [
      { key: 'evaluationDate', label: 'Date', className: 'num', render: (r) => formatDate(r.evaluationDate) },
      { key: 'memberName', label: 'Member', className: 'cell-strong' },
      { key: 'planTitle', label: 'Plan' },
      { key: 'performanceScore', label: 'Score', className: 'num', render: (r) => `${r.performanceScore}/10` },
      { key: 'coachComment', label: 'Comment', render: (r) => <span className="clamp">{r.coachComment}</span> },
    ],
    fields: [
      {
        name: 'planId', label: 'Plan', type: 'select', required: true, full: true,
        optionsFrom: (l) => opt(l.plans, 'id', (p) => {
          const member = (l.members ?? []).find((m) => m.memberId === p.memberId)?.fullName;
          return member ? `${p.title} — ${member}` : p.title;
        }),
      },
      { name: 'performanceScore', label: 'Score (0–10)', type: 'number', required: true, min: 0, max: 10, step: 0.5 },
      { name: 'evaluationDate', label: 'Date', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'coachComment', label: 'Comment', type: 'textarea', required: true },
    ],
    // The member must be the plan's member (the API checks it)
    toRequest: (b, { lookups }) => ({
      planId: b.planId,
      memberId: lookups.plans?.find((p) => p.id === b.planId)?.memberId,
      performanceScore: b.performanceScore,
      coachComment: b.coachComment ?? '',
      evaluationDate: fromDateInput(b.evaluationDate),
    }),
    emptyHint: 'Write a training plan first, then score the member against it here.',
  },

  // Read-only history of changes made in the staff area (lib/audit.js says what is logged and why)
  auditLog: {
    key: 'auditLog', title: 'Audit log', singular: 'Entry',
    description: 'Changes made in the staff area, newest first: who did what, and when.',
    source: { list: api.auditLogs.list }, sample: mock.auditLogs,
    lookups: () => ({ accounts: L.accounts }),
    nameOf: (r) => describeAction(r.actionType).label,
    searchText: (r) => `${r.username} ${describeAction(r.actionType).label} ${r.description}`,
    sort: (a, b) => String(b.timestamp).localeCompare(String(a.timestamp)),
    filters: [
      {
        key: 'account', label: 'Filter by person', all: 'Everyone',
        options: (rows) => uniqueBy(rows, 'accountId')
          .map((r) => ({ value: r.accountId, label: r.username || r.accountId }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        match: (r, v) => r.accountId === v,
      },
      {
        key: 'verb', label: 'Filter by action', all: 'All actions',
        options: (rows) => [...AUDIT_VERBS, { value: 'OTHER', label: 'Other' }]
          .filter((o) => rows.some((r) => describeAction(r.actionType).verb === o.value)),
        match: (r, v) => describeAction(r.actionType).verb === v,
      },
      {
        key: 'entity', label: 'Filter by record', all: 'All records',
        options: (rows) => [...new Set(rows.map((r) => describeAction(r.actionType).entity).filter(Boolean))]
          .sort()
          .map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) })),
        match: (r, v) => describeAction(r.actionType).entity === v,
      },
    ],
    columns: [
      { key: 'timestamp', label: 'When', className: 'num', render: (r) => formatDateTime(r.timestamp) },
      { key: 'username', label: 'Who', render: (r, l) => <AuditWho row={r} accounts={l.accounts} /> },
      {
        key: 'actionType', label: 'Action',
        render: (r) => { const a = describeAction(r.actionType); return <StatusTag tone={a.tone}>{a.label}</StatusTag>; },
      },
      // The summary and its field lines on one line here; View shows them one per line
      { key: 'description', label: 'Details', render: (r) => <span className="clamp">{String(r.description ?? '').split('\n').join(' · ') || '—'}</span> },
    ],
    rowActions: [{
      label: 'View',
      modal: { title: (r) => describeAction(r.actionType).label, render: (r, l) => <AuditDetail row={r} accounts={l.accounts} /> },
    }],
    emptyHint: 'When a manager adds, edits or deletes a record, renews or cancels a membership, locks an account or sends a notification, it is listed here.',
  },
};

function uniqueBy(rows, key) {
  const seen = new Set();
  return (rows ?? []).filter((r) => (seen.has(r[key]) ? false : seen.add(r[key])));
}

function FillBar({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="fill">
      <span className="fill__bar"><span style={{ width: `${pct}%` }} /></span>
      <span>{value}/{max}</span>
    </span>
  );
}
