
import { todayCenterDateString } from './format.js';

export function afterCheckout(res, _method, navigate) {
  if (res?.paymentId) return navigate('/payment/result?paymentId=' + encodeURIComponent(res.paymentId));
  return null;
}

export function waitingOrder(cards, invoices, today = todayCenterDateString()) {
  for (const card of cards ?? []) {
    if (card.status !== 2 || String(card.endDate).slice(0, 10) < today) continue;
    const invoice = (invoices ?? []).find((i) => i.memberMembershipId === card.id && i.status === 1 && !i.receptionistId);
    if (invoice) return { card, invoice };
  }
  return null;
}

export function timeLeft(until, now = Date.now()) {
  const ms = Date.parse(until) - now;
  if (!(ms > 0)) return null;
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
