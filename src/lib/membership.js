// A class costs nothing on top of a membership card, but booking one needs a card that is active
// ("Còn hiệu lực") on the day of the class's next session. The API does not check this yet and cannot
// tell which sports a package covers (CHANGELOG Part B, B45–B46), so the website checks the dates only.
import { formatDate, isSessionOver, todayUtcDateString } from './format.js';

const day = (v) => String(v ?? '').slice(0, 10);
const byStart = (a, b) => `${day(a.date)}${a.startTime}`.localeCompare(`${day(b.date)}${b.startTime}`);

// Active cards valid on a day ("YYYY-MM-DD"), the one that lasts longest first
export const cardsOn = (cards, d) =>
  (cards ?? [])
    .filter((m) => m.status === 1 && day(m.startDate) <= d && day(m.endDate) >= d)
    .sort((a, b) => day(b.endDate).localeCompare(day(a.endDate)));

// The first and the last session of a class that have not ended yet
const upcoming = (sessions, classId) =>
  (sessions ?? []).filter((s) => (!classId || s.classId === classId) && !isSessionOver(s)).sort(byStart);
export const nextSession = (sessions, classId) => upcoming(sessions, classId)[0];
export const lastSession = (sessions, classId) => upcoming(sessions, classId).at(-1);

// Why a member's cards do not let them book a class whose next session is on day `d`
function reasonFor(cards, d) {
  const pending = cards.find((m) => m.status === 2 && day(m.endDate) >= d);
  if (pending) return `${pending.packageName} đang chờ lễ tân xác nhận thanh toán.`;
  const later = cards.find((m) => m.status === 1 && day(m.startDate) > d);
  if (later) return `${later.packageName} bắt đầu từ ${formatDate(later.startDate)}, sau buổi học kế tiếp (${formatDate(d)}).`;
  const latest = [...cards].sort((a, b) => day(b.endDate).localeCompare(day(a.endDate)))[0];
  if (!latest) return 'Chưa có thẻ thành viên.';
  if (latest.status === 4) return `${latest.packageName} đã bị hủy.`;
  if (latest.status === 2) return `${latest.packageName} chưa được kích hoạt.`;
  return day(latest.endDate) >= todayUtcDateString()
    ? `${latest.packageName} hết hạn ngày ${formatDate(latest.endDate)}, trước buổi học kế tiếp (${formatDate(d)}).`
    : `${latest.packageName} đã hết hạn ngày ${formatDate(latest.endDate)}.`;
}

// May a member with these cards book a class with these sessions?
// → { ok, card?, reason?, warning? }; ok when no session is left (booking is closed for that reason instead)
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
