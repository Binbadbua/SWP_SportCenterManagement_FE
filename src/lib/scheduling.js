import { addDaysToDateInput, isSessionStarted, todayCenterDateString } from './format.js';

const dayOf = value => String(value ?? '').slice(0, 10);
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const timeOf = value => {
  const text = String(value ?? '');
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) return null;
  const [hour, minute, second = 0] = text.split(':').map(Number);
  return hour < 24 && minute < 60 && second < 60 ? [hour, minute, second].map(n => String(n).padStart(2, '0')).join(':') : null;
};
const centerTime = now => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);

export function validateClassDates(values, mode, { row, now = new Date() } = {}) {
  const errors = {};
  const today = todayCenterDateString(now);
  for (const field of ['startDate', 'endDate']) {
    const value = values[field];
    if (!value) continue;
    if (!validDay(value)) errors[field] = 'Ngày không hợp lệ.';
    else if (value < today && (mode === 'create' || value !== dayOf(row?.[field]))) {
      errors[field] = field === 'startDate' ? 'Không thể tạo hoặc dời lớp về ngày bắt đầu trong quá khứ.' : 'Ngày kết thúc mới không được nằm trong quá khứ.';
    }
  }
  if (validDay(values.startDate) && validDay(values.endDate) && values.endDate <= values.startDate) {
    errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu.';
  }
  return errors;
}

export function scheduleDateMinimum(values, { mode, row, now = new Date(), lookups = {} } = {}) {
  const today = todayCenterDateString(now);
  if (mode === 'edit' && values.date === dayOf(row?.date) && values.date < today) return values.date;
  const cls = (lookups.classes ?? []).find(item => item.id === values.classId);
  const start = dayOf(cls?.startDate);
  return validDay(start) && start > today ? start : today;
}

export function classDateMinimum(field, values, { mode, row, now = new Date() } = {}) {
  const today = todayCenterDateString(now);
  const original = dayOf(row?.[field]);
  if (mode === 'edit' && values[field] === original && original < today) return original;
  return field === 'endDate' && validDay(values.startDate) && values.startDate >= today
    ? addDaysToDateInput(values.startDate, 1) : today;
}

export function sessionStartMinimum(values, { mode, row, now = new Date() } = {}) {
  const today = todayCenterDateString(now);
  if (values.date !== today) return undefined;
  if (mode === 'edit' && values.date === dayOf(row?.date) && timeOf(values.startTime) === timeOf(row?.startTime)) return undefined;
  const next = new Date(now.getTime() + 60000);
  return todayCenterDateString(next) === today ? centerTime(next).slice(0, 5) : '23:59:59';
}

export function validateSessionSlot(values, mode, { row, now = new Date(), lookups = {} } = {}) {
  const errors = {};
  const date = values.date;
  const start = timeOf(values.startTime);
  const end = timeOf(values.endTime);
  if (date && !validDay(date)) errors.date = 'Ngày không hợp lệ.';
  if (values.startTime && !start) errors.startTime = 'Giờ bắt đầu không hợp lệ.';
  if (values.endTime && !end) errors.endTime = 'Giờ kết thúc không hợp lệ.';
  if (start && end && end <= start) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
  const slotChanged = mode === 'create' || values.classId !== row?.classId || date !== dayOf(row?.date) || start !== timeOf(row?.startTime) || end !== timeOf(row?.endTime);
  if (validDay(date) && start && slotChanged && isSessionStarted({ date, startTime: start }, now)) {
    if (date < todayCenterDateString(now)) errors.date = 'Không thể tạo hoặc dời buổi học về ngày trong quá khứ.';
    else errors.startTime = 'Giờ bắt đầu phải sau thời gian hiện tại của trung tâm (Việt Nam).';
  }
  const cls = (lookups.classes ?? []).find(item => item.id === values.classId);
  if (validDay(date) && cls && (date < dayOf(cls.startDate) || date > dayOf(cls.endDate))) {
    errors.date = 'Ngày học phải nằm trong thời gian của lớp đã chọn.';
  }
  return errors;
}

export function validateSessionConflicts(values, mode, { row, lookups = {}, rows, rowsReady = false, lookupsReady = false } = {}) {
  const start = timeOf(values.startTime), end = timeOf(values.endTime), date = values.date;
  if (!values.classId || !values.roomId || !validDay(date) || !start || !end || end <= start) return {};
  const unchanged = mode === 'edit' && row && values.classId === row.classId && values.roomId === row.roomId
    && date === dayOf(row.date) && start === timeOf(row.startTime) && end === timeOf(row.endTime);
  if (unchanged) return {};
  if (!rowsReady || !Array.isArray(rows)) return { startTime: 'Chưa tải đủ lịch học thật để kiểm tra trùng. Hãy tải lại danh sách trước khi lưu.' };
  if (!lookupsReady || !Array.isArray(lookups.classes)) return { classId: 'Chưa tải đủ thông tin lớp và huấn luyện viên để kiểm tra lịch trùng.' };
  const cls = lookups.classes.find(item => item.id === values.classId);
  if (!cls?.coachId) return { classId: 'Chưa xác định được huấn luyện viên của lớp đã chọn. Hãy tải lại dữ liệu trước khi xếp lịch.' };
  for (const existing of rows) {
    if (mode === 'edit' && row?.id && existing.id === row.id) continue;
    const otherDate = dayOf(existing.date);
    if (!validDay(otherDate)) return { startTime: 'Có buổi học thiếu ngày hợp lệ; chưa thể xác nhận lịch không trùng.' };
    if (otherDate !== date) continue;
    const otherStart = timeOf(existing.startTime), otherEnd = timeOf(existing.endTime);
    if (!otherStart || !otherEnd || otherEnd <= otherStart) return { startTime: 'Có buổi học cùng ngày thiếu giờ hợp lệ; hãy kiểm tra lại lịch trước khi lưu.' };
    if (start >= otherEnd || end <= otherStart) continue;
    if (!existing.classId || !existing.roomId) return { startTime: 'Có buổi học trùng giờ thiếu thông tin lớp hoặc phòng; hãy tải lại lịch trước khi lưu.' };
    const hours = otherStart.slice(0, 5) + '–' + otherEnd.slice(0, 5);
    if (existing.roomId === values.roomId) return { roomId: 'Phòng đã có buổi học từ ' + hours + ' trong ngày đã chọn. Hãy đổi phòng hoặc giờ học.' };
    if (existing.classId === values.classId) return { classId: 'Lớp này đã có buổi học từ ' + hours + ' trong ngày đã chọn; không thể xếp hai buổi trùng nhau.' };
    const otherClass = lookups.classes.find(item => item.id === existing.classId);
    if (!otherClass?.coachId) return { startTime: 'Chưa xác định được huấn luyện viên của một buổi học trùng giờ; hãy tải lại thông tin lớp trước khi lưu.' };
    if (otherClass.coachId === cls.coachId) return { classId: 'Huấn luyện viên của lớp đang có buổi dạy từ ' + hours + ' trong ngày đã chọn, kể cả ở phòng khác. Hãy đổi giờ hoặc huấn luyện viên.' };
  }
  return {};
}
