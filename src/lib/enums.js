// Mirrors SWP_SportCenter.Repository/Enum/*.cs — the API sends enums as numbers.
// `tone` drives the colour of the status tag in the UI.

const enumOf = (entries) => {
  const byValue = Object.fromEntries(entries.map((e) => [e.value, e]));
  return {
    options: entries,
    label: (v) => byValue[v]?.label ?? String(v ?? ''),
    tone: (v) => byValue[v]?.tone ?? 'neutral',
  };
};

export const AccountRole = enumOf([
  { value: 1, key: 'member', label: 'Member' },
  { value: 2, key: 'coach', label: 'Coach' },
  { value: 3, key: 'receptionist', label: 'Receptionist' },
  { value: 4, key: 'manager', label: 'Center manager' },
]);

export const AccountStatus = enumOf([
  { value: 1, label: 'Active', tone: 'success' },
  { value: 2, label: 'Inactive', tone: 'neutral' },
  { value: 3, label: 'Locked', tone: 'danger' },
]);

export const AttendanceStatus = enumOf([
  { value: 1, label: 'Present', tone: 'success' },
  { value: 2, label: 'Absent', tone: 'danger' },
  { value: 3, label: 'Late', tone: 'warning' },
]);

export const BookingStatus = enumOf([
  { value: 1, label: 'Booked', tone: 'info' },
  { value: 2, label: 'Attended', tone: 'success' },
  { value: 3, label: 'Cancelled', tone: 'neutral' },
]);

export const ClassStatus = enumOf([
  { value: 1, label: 'Scheduled', tone: 'info' },
  { value: 2, label: 'Ongoing', tone: 'success' },
  { value: 3, label: 'Completed', tone: 'neutral' },
  { value: 4, label: 'Cancelled', tone: 'danger' },
]);

export const InvoiceStatus = enumOf([
  { value: 1, label: 'Pending', tone: 'warning' },
  { value: 2, label: 'Paid', tone: 'success' },
  { value: 3, label: 'Cancelled', tone: 'neutral' },
]);

export const MembershipStatus = enumOf([
  { value: 1, label: 'Active', tone: 'success' },
  { value: 2, label: 'Inactive', tone: 'neutral' },
  { value: 3, label: 'Expired', tone: 'danger' },
  { value: 4, label: 'Cancelled', tone: 'neutral' },
]);

export const PaymentMethod = enumOf([
  { value: 1, label: 'Cash' },
  { value: 2, label: 'Bank transfer' },
  { value: 3, label: 'Card' },
]);

export const RoomStatus = enumOf([
  { value: 1, label: 'Available', tone: 'success' },
  { value: 2, label: 'Unavailable', tone: 'danger' },
]);
