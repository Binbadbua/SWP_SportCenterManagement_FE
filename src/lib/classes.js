

import { formatMoney, isSessionStarted, todayCenterDateString } from './format.js';

const day = (v) => String(v ?? '').slice(0, 10);

export function classStarted(c, sessions, now = new Date()) {
  if (!c) return false;
  if (c.status === 2) return true;
  const id = c.id ?? c.classId;
  const own = (sessions ?? []).filter((s) => s.classId === id);
  if (own.length) return own.some((s) => isSessionStarted(s, now));
  return !!c.startDate && day(c.startDate) < todayCenterDateString(now);
}

const validClassDay = (value) => {
  const text = day(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const instant = new Date(text + 'T00:00:00Z');
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === text ? text : null;
};

export function classDisplayStatus(c, sessions, now = new Date()) {
  if (!c) return null;
  const status = Number(c.status);
  if (status === 4 || status === 3) return status;
  if (status !== 1 && status !== 2) return null;
  const today = todayCenterDateString(now);
  const start = validClassDay(c.startDate);
  const end = validClassDay(c.endDate);
  if (end && end < today) return 3;
  const id = c.id ?? c.classId;
  const own = Array.isArray(sessions) ? sessions.filter(s => s.classId === id && validClassDay(s.date) && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(s.startTime ?? ''))) : [];
  if (status === 2 || c.started === true || own.some(s => isSessionStarted(s, now)) || (start && start < today)) return 2;
  if (status !== 1 || !start || (end && end < start)) return null;
  if (start > today || (start === today && own.length)) return 1;
  return null;
}

export function classScheduleKnown(c, sessions) {
  const id = c?.id ?? c?.classId;
  return Array.isArray(sessions) && sessions.some(s => s.classId === id && validClassDay(s.date) && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(s.startTime ?? '')));
}

export function cancelTerms(booking, started) {
  const fee = Number(booking?.price ?? 0);
  if (booking?.status === 4) {
    return { tone: 'info', title: null, text: 'Lượt đặt đang chờ thanh toán: chưa có khoản tiền nào bị trừ, chỗ giữ cho bạn được trả lại.' };
  }
  if (started) {
    return fee > 0
      ? {
          tone: 'danger',
          title: 'Không được hoàn học phí',
          text: `Lớp đã bắt đầu nên bạn không được hoàn lại ${formatMoney(fee)} đã trả. Sau khi hủy, bạn cũng không đặt lại được lớp này.`,
        }
      : {
          tone: 'danger',
          title: 'Không đặt lại được',
          text: 'Lớp đã bắt đầu nên sau khi hủy, bạn không đặt lại được lớp này: lớp không nhận đặt thêm.',
        };
  }
  return fee > 0
    ? {
        tone: 'info',
        title: 'Được hoàn đủ học phí',
        text: `Lớp chưa bắt đầu nên ${formatMoney(fee)} được hoàn qua lễ tân bằng chuyển khoản hoặc tiền mặt. Yêu cầu sẽ chờ xác nhận sau khi lễ tân đã trả tiền.`,
      }
    : { tone: 'info', title: null, text: 'Lớp chưa bắt đầu nên bạn có thể đặt lại sau nếu lớp còn chỗ.' };
}

export function classRunning(c, sessions, now = new Date()) {
  if (!c || c.status === 3 || c.status === 4) return false;
  if (c.status === 2) return true;
  const started = c.started ?? classStarted(c, sessions, now);
  return started && !(c.endDate && day(c.endDate) < todayCenterDateString(now));
}
