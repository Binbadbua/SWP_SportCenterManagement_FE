

import { formatDate, isSessionOver, todayCenterDateString } from './format.js';

const day = (v) => String(v ?? '').slice(0, 10);
const byStart = (a, b) => `${day(a.date)}${a.startTime}`.localeCompare(`${day(b.date)}${b.startTime}`);

export const cardsOn = (cards, d) =>
  (cards ?? [])
    .filter((m) => m.status === 1 && day(m.startDate) <= d && day(m.endDate) >= d)
    .sort((a, b) => day(b.endDate).localeCompare(day(a.endDate)));

const upcoming = (sessions, classId) =>
  (sessions ?? []).filter((s) => (!classId || s.classId === classId) && !isSessionOver(s)).sort(byStart);
export const nextSession = (sessions, classId) => upcoming(sessions, classId)[0];
export const lastSession = (sessions, classId) => upcoming(sessions, classId).at(-1);

function reasonFor(cards, d) {
  const pending = cards.find((m) => m.status === 2 && day(m.endDate) >= d);
  if (pending) return `${pending.packageName} đang chờ thanh toán.`;
  const later = cards.find((m) => m.status === 1 && day(m.startDate) > d);
  if (later) return `${later.packageName} bắt đầu từ ${formatDate(later.startDate)}, sau buổi học kế tiếp (${formatDate(d)}).`;
  const latest = [...cards].sort((a, b) => day(b.endDate).localeCompare(day(a.endDate)))[0];
  if (!latest) return 'Chưa có thẻ thành viên.';
  if (latest.status === 4) return `${latest.packageName} đã bị hủy.`;
  if (latest.status === 2) return `${latest.packageName} chưa được kích hoạt.`;
  return day(latest.endDate) >= todayCenterDateString()
    ? `${latest.packageName} hết hạn ngày ${formatDate(latest.endDate)}, trước buổi học kế tiếp (${formatDate(d)}).`
    : `${latest.packageName} đã hết hạn ngày ${formatDate(latest.endDate)}.`;
}

export function upgradeTargets(card, packages) {
  const own = (packages ?? []).find((p) => p.id === card?.packageId);
  if (!card || !own) return [];
  return (packages ?? [])
    .filter((p) => p.status === 1 && p.durationDays > own.durationDays && Number(p.price) > Number(own.price))
    .sort((a, b) => a.durationDays - b.durationDays);
}

export function upgradeQuote(card, paid, newPrice, today = todayCenterDateString()) {
  const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  const total = days(day(card.startDate), day(card.endDate)) + 1;
  const unused = Math.min(total, Math.max(0, days(today, day(card.endDate))));
  const credit = total > 0 ? Math.floor((Number(paid ?? 0) * unused) / total / 1000) * 1000 : 0;
  return { total, unused, credit, due: Math.max(0, Number(newPrice ?? 0) - credit) };
}

export function cardCheck(cards, sessions, classId) {
  const next = nextSession(sessions, classId);
  if (!next) return { ok: true };
  const [card] = cardsOn(cards, day(next.date));
  if (!card) return { ok: false, reason: reasonFor(cards ?? [], day(next.date)), nextDate: day(next.date) };
  const last = day(lastSession(sessions, classId)?.date);
  return {
    ok: true,
    card,
    warning: day(card.endDate) < last
      ? `${card.packageName} hết hạn ngày ${formatDate(card.endDate)}, trước buổi cuối của lớp (${formatDate(last)}). Gia hạn để học hết các buổi.`
      : null,
  };
}
