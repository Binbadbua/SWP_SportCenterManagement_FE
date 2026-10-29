// Where a member goes once an order is made (package, class or upgrade). With MoMo (CHANGELOG Part B, B54) an ATM card
// is paid on MoMo's own page, which sends the member back to /payment/result; the wallet's QR code is shown on our
// payment page, which follows the order until MoMo reports it. Before MoMo the order waits there for reception.
import { apiUrl } from '../api/client.js';
import { todayUtcDateString } from './format.js';

export function afterCheckout(res, method, navigate) {
  const payUrl = res?.payUrl ?? res?.paymentUrl;
  if (payUrl && method === 5) return window.location.assign(apiUrl(payUrl));
  if (res?.paymentId) return navigate(`/payment/result?paymentId=${encodeURIComponent(res.paymentId)}`);
  if (payUrl) return window.location.assign(apiUrl(payUrl));
  return null;
}

// A package order the member made on the website that still waits for its money (an inactive card whose invoice is
// pending and has no receptionist): one order at a time, so it is paid or left to expire before the next
export function waitingOrder(cards, invoices, today = todayUtcDateString()) {
  for (const card of cards ?? []) {
    if (card.status !== 2 || String(card.endDate).slice(0, 10) < today) continue;
    const invoice = (invoices ?? []).find((i) => i.memberMembershipId === card.id && i.status === 1 && !i.receptionistId);
    if (invoice) return { card, invoice };
  }
  return null;
}

// mm:ss left until `until`, or null once it has passed
export function timeLeft(until, now = Date.now()) {
  const ms = Date.parse(until) - now;
  if (!(ms > 0)) return null;
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
