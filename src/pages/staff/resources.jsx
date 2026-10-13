// Configuration for every list/edit page in the staff area (rendered by CrudPage.jsx).
//
//   source: api.xxx      -> real back-end endpoint
//   source: preview.xxx  -> UI-ONLY, no back-end yet (shows a "UI preview" notice)
//
// To connect a preview page once its API exists: add the endpoint to src/api/endpoints.js
// and change `source: preview.members` to `source: api.members`. Nothing else needs to change.
import { api } from '../../api/endpoints.js';
import { preview } from '../../api/previewStore.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import {
  AccountRole, AccountStatus, BookingStatus, ClassStatus, InvoiceStatus, MembershipStatus, PaymentMethod, RoomStatus,
} from '../../lib/enums.js';
import {
  formatDate, formatDateTime, formatMoney, formatTimeRange, formatWeekday, todayUtcDateString,
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
  members: { load: () => preview.members.list(), sample: mock.members },
  packages: { load: () => preview.packages.list(), sample: mock.packages },
  accounts: { load: () => api.accounts.list(), sample: mock.accounts },
};

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
            <thead><tr><th>Member</th><th>Phone</th><th>Email</th><th>Booked</th><th>Status</th></tr></thead>
            <tbody>
              {roster.data.map((m) => (
                <tr key={m.memberId}>
                  <td className="cell-strong">{m.fullName}</td>
                  <td className="num">{m.phone}</td>
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
    description: 'Sessions for each class. The server blocks double-booked rooms and dates outside the class period.',
    source: api.schedules, sample: mock.sessions, lookups: () => ({ classes: L.classes, rooms: L.rooms }),
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
    rowActions: [{ label: 'Attendance', to: (r) => `/staff/attendance?session=${r.id}` }],
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
    lookups: () => ({ accounts: L.accounts }),
    searchText: (r) => `${r.fullName} ${r.email} ${r.phone} ${r.specialization}`,
    sort: (a, b) => a.fullName.localeCompare(b.fullName),
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'specialization', label: 'Specialization', render: (r) => r.specialization || '—' },
      { key: 'experienceYears', label: 'Years', className: 'num' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      { name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true, optionsFrom: (l) => opt((l.accounts || []).filter((a) => a.role === 1 || a.role === 3), 'id', (a) => `${a.username}`), help: 'The account must already exist and have the Coach role.' },
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'specialization', label: 'Specialization' },
      { name: 'experienceYears', label: 'Years of experience', type: 'number', min: 0, max: 50, defaultValue: () => '0' },
      { name: 'avatar', label: 'Photo URL', type: 'url', full: true, help: 'Optional. Leave empty to show initials.' },
    ],
  },

  managers: {
    key: 'managers', title: 'Managers', singular: 'Manager',
    description: 'Center manager profiles, linked to accounts with the Center manager role.',
    source: api.managers, sample: mock.managers, canWrite: isManager, nameOf: (r) => r.fullName,
    lookups: () => ({ accounts: L.accounts }),
    searchText: (r) => `${r.fullName} ${r.email} ${r.phone}`,
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      { name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true, optionsFrom: (l) => opt((l.accounts || []).filter((a) => a.role === 4), 'id', (a) => `${a.username}`), help: 'The account must have the Center manager role.' },
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
    ],
  },

  invoices: {
    key: 'invoices', title: 'Invoices', singular: 'Invoice',
    description: 'One invoice per membership purchase. Paid invoices can’t be deleted.',
    source: api.invoices, sample: mock.invoices, canWrite: isFrontDesk, nameOf: (r) => `${r.memberName} · ${r.packageName}`,
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
      { name: 'memberMembershipId', label: 'Membership ID', required: true, full: true, createOnly: true, help: 'The member_membership record this invoice pays for. Each membership can have only one invoice.' },
      { name: 'receptionistId', label: 'Receptionist ID', required: true, full: true, createOnly: true, defaultValue: (u) => u?.receptionistId ?? '' },
      { name: 'amount', label: 'Amount (VND)', type: 'number', required: true, min: 1, createOnly: true },
      { name: 'paymentMethod', label: 'Payment method', type: 'select', numeric: true, required: true, options: PaymentMethod.options },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: InvoiceStatus.options, defaultValue: () => '1' },
    ],
  },

  auditLog: {
    key: 'auditLog', title: 'Audit log', singular: 'Entry',
    description: 'Important actions recorded by the system. Read-only.',
    source: { list: () => api.auditLogs.list() }, sample: mock.auditLogs,
    searchText: (r) => `${r.username} ${r.actionType} ${r.description}`,
    columns: [
      { key: 'timestamp', label: 'When', className: 'num', render: (r) => formatDateTime(r.timestamp) },
      { key: 'username', label: 'Who', className: 'cell-strong' },
      { key: 'actionType', label: 'Action', render: (r) => <code className="code">{r.actionType}</code> },
      { key: 'description', label: 'Details' },
    ],
    emptyHint: 'Entries appear here as staff make changes.',
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
     UI-ONLY pages (no API yet)
     ==================================================================== */
  members: {
    key: 'members', title: 'Members', singular: 'Member',
    description: 'Search and register members at the front desk.',
    source: api.members, sample: mock.members, canWrite: isFrontDesk, canDelete: isManager, nameOf: (r) => r.fullName,
    searchText: (r) => `${r.fullName} ${r.phone} ${r.email}`,
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
      { key: 'trainingGoal', label: 'Goal', render: (r) => <span className="clamp">{r.trainingGoal || '—'}</span> },
      { key: 'createdAt', label: 'Joined', className: 'num', render: (r) => formatDate(r.createdAt) },
      { key: 'status', label: 'Account', render: (r) => tag(AccountStatus)(r.status) },
    ],
    fields: [
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }] },
      { name: 'status', label: 'Account status', type: 'select', numeric: true, options: AccountStatus.options, defaultValue: () => '1' },
      { name: 'trainingGoal', label: 'Training goal', type: 'textarea' },
    ],
  },

  receptionists: {
    key: 'receptionists', title: 'Receptionists', singular: 'Receptionist',
    source: api.receptionists, sample: mock.receptionists, canWrite: isManager, nameOf: (r) => r.fullName,
    lookups: () => ({ accounts: L.accounts }),
    searchText: (r) => `${r.fullName} ${r.phone} ${r.email}`,
    columns: [
      { key: 'fullName', label: 'Name', className: 'cell-strong' },
      { key: 'workingShift', label: 'Shift' },
      { key: 'phone', label: 'Phone', className: 'num' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      { name: 'accountId', label: 'Account ID', type: 'select', required: true, full: true, createOnly: true, optionsFrom: (l) => opt((l.accounts || []).filter((a) => a.role === 3), 'id', (a) => `${a.username}`), help: 'The account must have the Receptionist role.' },
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
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: MembershipStatus.options, defaultValue: () => '1' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },

  memberships: {
    key: 'memberships', title: 'Memberships', singular: 'Membership',
    description: 'Which member holds which package, and until when.',
    source: api.memberships, sample: mock.memberships, canWrite: isFrontDesk, canDelete: isManager,
    lookups: () => ({ members: L.members, packages: L.packages }),
    nameOf: (r) => `${r.memberName} · ${r.packageName}`,
    searchText: (r) => `${r.memberName} ${r.packageName}`,
    sort: (a, b) => b.startDate.localeCompare(a.startDate),
    columns: [
      { key: 'memberName', label: 'Member', className: 'cell-strong' },
      { key: 'packageName', label: 'Package' },
      { key: 'startDate', label: 'From', className: 'num', render: (r) => formatDate(r.startDate) },
      { key: 'endDate', label: 'Until', className: 'num', render: (r) => formatDate(r.endDate) },
      { key: 'status', label: 'Status', render: (r) => tag(MembershipStatus)(r.status) },
    ],
    fields: [
      { name: 'memberId', label: 'Member', type: 'select', required: true, optionsFrom: (l) => opt(l.members, 'id', 'fullName') },
      { name: 'packageId', label: 'Package', type: 'select', required: true, optionsFrom: (l) => opt(l.packages, 'id', (p) => `${p.packageName} · ${p.durationDays} days`) },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'endDate', label: 'End date', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: MembershipStatus.options, defaultValue: () => '1' },
    ],
    validate: endAfterStart,
    toRequest: (b, { lookups }) => ({
      ...b,
      memberName: lookups.members?.find((m) => m.id === b.memberId)?.fullName,
      packageName: lookups.packages?.find((p) => p.id === b.packageId)?.packageName,
    }),
  },

  accounts: {
    key: 'accounts', title: 'Accounts', singular: 'Account',
    description: 'Sign-in accounts and their roles. Lock an account to block sign-in.',
    source: api.accounts, sample: mock.accounts, canWrite: isManager, nameOf: (r) => r.username,
    searchText: (r) => `${r.username} ${AccountRole.label(r.role)}`,
    columns: [
      { key: 'fullName', label: 'Full name' }, 
      { key: 'username', label: 'Username', className: 'cell-strong' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', render: (r) => AccountRole.label(r.role) },
      { key: 'status', label: 'Status', render: (r) => tag(AccountStatus)(r.status) },
      { key: 'createdAt', label: 'Created', className: 'num', render: (r) => formatDate(r.createdAt) },
    ],
    fields: [
      { name: 'fullName', label: 'Full name', required: true, full: true },
      { name: 'username', label: 'Username', required: true, full: true },
      { name: 'email', label: 'Email', type: 'email', required: true, full: true },
      { name: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true, full: true, help: 'The user changes it at first sign-in.' },
      { name: 'role', label: 'Role', type: 'select', numeric: true, required: true, options: AccountRole.options },
      { name: 'status', label: 'Status', type: 'select', numeric: true, required: true, options: AccountStatus.options, defaultValue: () => '1' },
    ],
    toRequest: ({ password, ...rest }) => rest, // never keep passwords in the preview store
  },

  trainingPlans: {
    key: 'trainingPlans', title: 'Training plans', singular: 'Plan',
    description: 'Plans you write for members in your classes.',
    source: preview.trainingPlans, sample: mock.trainingPlans,
    lookups: (u) => ({
      members: { load: () => api.coaches.members(u.coachId), sample: mock.coachMembers },
      classes: { load: () => api.coaches.classes(u.coachId), sample: mock.coachClasses },
    }),
    nameOf: (r) => r.title,
    searchText: (r) => `${r.title} ${r.memberName} ${r.className}`,
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
    toRequest: (b, { lookups, user }) => ({
      ...b,
      coachId: user.coachId,
      coachName: user.fullName,
      memberName: lookups.members?.find((m) => m.memberId === b.memberId)?.fullName,
      className: lookups.classes?.find((c) => c.classId === b.classId)?.className,
    }),
  },

  trainingResults: {
    key: 'trainingResults', title: 'Training results', singular: 'Result',
    description: 'Score each member’s progress against their plan and leave a comment.',
    source: preview.trainingResults, sample: mock.trainingResults,
    lookups: () => ({ plans: { load: () => preview.trainingPlans.list(), sample: mock.trainingPlans } }),
    nameOf: (r) => `${r.memberName} · ${r.planTitle}`,
    searchText: (r) => `${r.memberName} ${r.planTitle} ${r.coachComment}`,
    sort: (a, b) => b.evaluationDate.localeCompare(a.evaluationDate),
    columns: [
      { key: 'evaluationDate', label: 'Date', className: 'num', render: (r) => formatDate(r.evaluationDate) },
      { key: 'memberName', label: 'Member', className: 'cell-strong' },
      { key: 'planTitle', label: 'Plan' },
      { key: 'performanceScore', label: 'Score', className: 'num', render: (r) => `${r.performanceScore}/10` },
      { key: 'coachComment', label: 'Comment', render: (r) => <span className="clamp">{r.coachComment}</span> },
    ],
    fields: [
      { name: 'planId', label: 'Plan', type: 'select', required: true, full: true, optionsFrom: (l) => opt(l.plans, 'id', (p) => `${p.title} — ${p.memberName}`) },
      { name: 'performanceScore', label: 'Score (0–10)', type: 'number', required: true, min: 0, max: 10, step: 0.5 },
      { name: 'evaluationDate', label: 'Date', type: 'date', required: true, defaultValue: todayUtcDateString },
      { name: 'coachComment', label: 'Comment', type: 'textarea' },
    ],
    toRequest: (b, { lookups, user }) => {
      const plan = lookups.plans?.find((p) => p.id === b.planId);
      return { ...b, planTitle: plan?.title, memberId: plan?.memberId, memberName: plan?.memberName, coachId: user.coachId, coachName: user.fullName };
    },
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
