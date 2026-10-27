// Dates from the API are ISO strings. Date-only fields (class start, session date)
// are stored as UTC midnight, so they are formatted in UTC to avoid showing the day before.

// Dates read the Vietnamese way: 23/10/2026, 23/10, T6, 23/10/2026 08:46
const pad2 = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayFmt = { format: (d) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` };
const shortDayFmt = { format: (d) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}` };
const weekdayFmt = { format: (d) => WEEKDAYS[d.getUTCDay()] };
// Timestamps (check-in, payment, audit) are shown on the visitor's clock
const dateTimeFmt = {
  format: (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
};
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

// A session's date comes without a time zone ("2026-10-15T00:00:00", CHANGELOG Part B, B52). The browser would
// read that on its own clock (15/10 00:00 in Vietnam = 14/10 17:00 UTC) and the UTC formats would show the
// day before, so a value without a zone is read as UTC like every other date-only value.
const NO_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const toDate = (v) => (v instanceof Date ? v : new Date(NO_ZONE.test(String(v)) ? `${v}Z` : v));
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
// "2026-10-22" -> "2026-10-22T00:00:00Z". Date columns are timestamptz, so the API only accepts UTC values.
export const fromDateInput = (v) => (v ? `${String(v).slice(0, 10)}T00:00:00Z` : v);
// "2026-10-22" + 30 days -> "2026-11-20" (a 30-day plan ends on its 30th day)
export const addDaysToDateInput = (v, days) => {
  const d = new Date(`${v}T00:00:00Z`);
  if (!v || Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
// Value for <input type="time"> from "HH:mm:ss"
export const toTimeInput = (v) => (v ? String(v).slice(0, 5) : '');
// "07:30" -> "07:30:00" (TimeSpan format expected by the API)
export const fromTimeInput = (v) => (v && v.length === 5 ? `${v}:00` : v);

export const todayUtcDateString = () => new Date().toISOString().slice(0, 10);

// The API stores "pending-…" / "legacy-…" as the phone of members who never entered one
// (the phone column must be unique). Show those as empty.
export const realPhone = (p) => (/^(pending|legacy)-/i.test(p ?? '') ? '' : (p ?? ''));

// Today on the visitor's clock, "YYYY-MM-DD" — the calendar day the center's sessions use
export const todayLocalDateString = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// A session has ended once its date (stored as UTC midnight) is before today, or it is today and
// its end time ("HH:mm:ss", the center's local time) has passed. Compared on the visitor's clock.
export const isSessionOver = (s, now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const today = todayLocalDateString(now);
  const day = String(s.date).slice(0, 10);
  if (day !== today) return day < today;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return String(s.endTime ?? '').padEnd(8, ':00').slice(0, 8) <= time;
};

// 2100000 -> "Hai triệu một trăm nghìn đồng", the "amount in words" line of a printed invoice
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
// One group of three digits; `full` reads the zeros a group in the middle of a number needs ("không trăm linh năm")
const readGroup = (n, full) => {
  const [h, t, u] = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
  const words = [];
  if (full || h) words.push(DIGITS[h], 'trăm');
  if (t === 1) words.push('mười');
  else if (t > 1) words.push(DIGITS[t], 'mươi');
  else if (u && (full || h)) words.push('linh');
  if (u === 1 && t > 1) words.push('mốt');
  else if (u === 4 && t > 1) words.push('tư');
  else if (u === 5 && t > 0) words.push('lăm');
  else if (u) words.push(DIGITS[u]);
  return words;
};
export const moneyInWords = (value) => {
  let n = Math.round(Math.abs(Number(value) || 0));
  const groups = [];
  for (; n > 0; n = Math.floor(n / 1000)) groups.push(n % 1000); // lowest group first
  const text = groups
    .map((g, i) => (g ? [...readGroup(g, i < groups.length - 1), SCALES[i]].filter(Boolean).join(' ') : ''))
    .filter(Boolean)
    .reverse()
    .join(' ');
  return text ? `${text[0].toUpperCase()}${text.slice(1)} đồng` : 'Không đồng';
};

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
