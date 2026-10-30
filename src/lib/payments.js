// Checkout stays on SportCenter. SePay returns a bank VietQR image and reports receipt through the backend.
import { todayCenterDateString } from './format.js';

export function afterCheckout(res, _method, navigate) {
  if (res?.paymentId) return navigate('/payment/result?paymentId=' + encodeURIComponent(res.paymentId));
  return null;
}

// A package order the member made on the website that still waits for its money (an inactive card whose invoice is
// pending and has no receptionist): one order at a time, so it is paid or left to expire before the next
export function waitingOrder(cards, invoices, today = todayCenterDateString()) {
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
