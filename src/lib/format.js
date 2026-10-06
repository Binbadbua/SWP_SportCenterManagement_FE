// Dates from the API are ISO strings. Date-only fields (class start, session date)
// are stored as UTC midnight, so they are formatted in UTC to avoid showing the day before.

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const toDate = (v) => (v instanceof Date ? v : new Date(v));
const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1;

export const formatDate = (v) => (v && isValid(toDate(v)) ? dayFmt.format(toDate(v)) : '—');
export const formatShortDate = (v) => (v && isValid(toDate(v)) ? shortDayFmt.format(toDate(v)) : '—');
export const formatWeekday = (v) => (v && isValid(toDate(v)) ? weekdayFmt.format(toDate(v)) : '');
export const formatDateTime = (v) => (v && isValid(toDate(v)) ? dateTimeFmt.format(toDate(v)) : '—');
export const formatMoney = (v) => (v === null || v === undefined || v === '' ? '—' : vnd.format(Number(v)));

// "07:00:00" -> "07:00"
export const formatTime = (v) => (v ? String(v).slice(0, 5) : '—');
export const formatTimeRange = (a, b) => `${formatTime(a)}–${formatTime(b)}`;

export const formatDateRange = (a, b) => `${formatShortDate(a)} – ${formatDate(b)}`;

// Value for <input type="date"> from an ISO string
export const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');
// Value for <input type="time"> from "HH:mm:ss"
export const toTimeInput = (v) => (v ? String(v).slice(0, 5) : '');
// "07:30" -> "07:30:00" (TimeSpan format expected by the API)
export const fromTimeInput = (v) => (v && v.length === 5 ? `${v}:00` : v);

export const todayUtcDateString = () => new Date().toISOString().slice(0, 10);

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export const daysUntil = (v) => {
  if (!v) return null;
  const start = Date.parse(String(v).slice(0, 10) + 'T00:00:00Z');
  const today = Date.parse(todayUtcDateString() + 'T00:00:00Z');
  return Math.round((start - today) / 86400000);
};
