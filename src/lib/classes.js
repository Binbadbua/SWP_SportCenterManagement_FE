// When a class stops taking bookings (team rule, 28/10/2026): once it is marked "Đang diễn ra" or its first session
// has begun, members can no longer book it, and cancelling a paid booking then gives no refund.
import { formatMoney, isSessionStarted, todayLocalDateString } from './format.js';

const day = (v) => String(v ?? '').slice(0, 10);

// `sessions` may hold every class's sessions; without any, the class's start date stands in for its first session
export function classStarted(c, sessions) {
  if (!c) return false;
  if (c.status === 2) return true;
  const id = c.id ?? c.classId;
  const own = (sessions ?? []).filter((s) => s.classId === id);
  if (own.length) return own.some((s) => isSessionStarted(s));
  return !!c.startDate && day(c.startDate) < todayLocalDateString();
}

// What cancelling a member's booking means (CHANGELOG Part B, B55): a place waiting for payment is just freed; before
// the class starts a paid booking is refunded in full; once it has started nothing is refunded, and the member cannot
// book it again because a started class takes no bookings. `booking.price` is what the member paid.
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

// A manager may delete a class only before it starts, or once it has ended or been cancelled: deleting a running
// class would leave its members to be refunded and told by hand. `c.started` (set by the staff class list from the
// sessions) or `sessions` says whether it has begun, the same way as for bookings.
export function classRunning(c, sessions) {
  if (!c || c.status === 3 || c.status === 4) return false;
  if (c.status === 2) return true;
  const started = c.started ?? classStarted(c, sessions);
  return started && !(c.endDate && day(c.endDate) < todayLocalDateString());
}
