

const pad2 = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayFmt = { format: (d) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` };
const shortDayFmt = { format: (d) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}` };
const weekdayFmt = { format: (d) => WEEKDAYS[d.getUTCDay()] };

const dateTimeFmt = {
  format: (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
};
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const NO_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const toDate = (v) => (v instanceof Date ? v : new Date(NO_ZONE.test(String(v)) ? `${v}Z` : v));
const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1;

export const formatDate = (v) => (v && isValid(toDate(v)) ? dayFmt.format(toDate(v)) : '—');
export const formatShortDate = (v) => (v && isValid(toDate(v)) ? shortDayFmt.format(toDate(v)) : '—');
export const formatWeekday = (v) => (v && isValid(toDate(v)) ? weekdayFmt.format(toDate(v)) : '');
export const formatDateTime = (v) => (v && isValid(toDate(v)) ? dateTimeFmt.format(toDate(v)) : '—');

export const formatClock = (v) =>
  v && isValid(toDate(v)) ? `${pad2(toDate(v).getHours())}:${pad2(toDate(v).getMinutes())}` : '—';
export const formatMoney = (v) => (v === null || v === undefined || v === '' ? '—' : vnd.format(Number(v)));

export const formatTime = (v) => (v ? String(v).slice(0, 5) : '—');
export const formatTimeRange = (a, b) => `${formatTime(a)}–${formatTime(b)}`;

export const formatDateRange = (a, b) => `${formatShortDate(a)} – ${formatDate(b)}`;

export const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

export const fromDateInput = (v) => (v ? `${String(v).slice(0, 10)}T00:00:00Z` : v);

export const addDaysToDateInput = (v, days) => {
  const d = new Date(`${v}T00:00:00Z`);
  if (!v || Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const toTimeInput = (v) => (v ? String(v).slice(0, 5) : '');

export const fromTimeInput = (v) => (v && v.length === 5 ? `${v}:00` : v);

export const todayCenterDateString = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type) => parts.find((p) => p.type === type).value;
  return value('year') + '-' + value('month') + '-' + value('day');
};

export const todayUtcDateString = () => new Date().toISOString().slice(0, 10);

export const realPhone = (p) => (/^(pending|legacy)-/i.test(p ?? '') ? '' : (p ?? ''));

export const todayLocalDateString = todayCenterDateString;
const centerClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const centerClock = (now) => centerClockFormat.format(now);

export const isSessionOver = (s, now = new Date()) => {
  const today = todayCenterDateString(now);
  const day = String(s.date).slice(0, 10);
  if (day !== today) return day < today;
  const time = centerClock(now);
  return String(s.endTime ?? '').padEnd(8, ':00').slice(0, 8) <= time;
};

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

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
  for (; n > 0; n = Math.floor(n / 1000)) groups.push(n % 1000);
  const text = groups
    .map((g, i) => (g ? [...readGroup(g, i < groups.length - 1), SCALES[i]].filter(Boolean).join(' ') : ''))
    .filter(Boolean)
    .reverse()
    .join(' ');
  return text ? `${text[0].toUpperCase()}${text.slice(1)} đồng` : 'Không đồng';
};

export const isSessionStarted = (s, now = new Date()) => {
  const today = todayCenterDateString(now);
  const day = String(s.date).slice(0, 10);
  if (day !== today) return day < today;
  const time = centerClock(now);
  return String(s.startTime ?? '').padEnd(8, ':00').slice(0, 8) <= time;
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
  const today = Date.parse(todayCenterDateString() + 'T00:00:00Z');
  return Math.round((start - today) / 86400000);
};
