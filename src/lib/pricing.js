// Class fees and package discounts (business rule of 27/10/2026, CHANGELOG Part B, B53): a class has one fee for the
// whole course, and a member's card takes its package's discount off it; without a card the member pays the full fee.
// The API works out the amount it bills; these helpers only show the same figure beforehand.
import { todayLocalDateString } from './format.js';
import { cardsOn } from './membership.js';

// Does the API carry class fees / package discounts yet? Until it does, the 27/10 rule stays (lib/membership.js).
export const hasClassPrices = (classes) => (classes ?? []).some((c) => typeof c.price === 'number');
export const hasPackageDiscounts = (packages) => (packages ?? []).some((p) => typeof p.discountPercent === 'number');

// The best discount a member's cards give today: { percent, card, pkg } (percent 0 = no discount)
export function discountFor(cards, packages, day = todayLocalDateString()) {
  let best = { percent: 0, card: null, pkg: null };
  for (const card of cardsOn(cards, day)) {
    const pkg = (packages ?? []).find((p) => p.id === card.packageId);
    const percent = Number(pkg?.discountPercent ?? 0);
    if (percent > best.percent) best = { percent, card, pkg };
  }
  return best;
}

// The fee after a discount, rounded to the đồng as the API does
export const priceAfter = (price, percent) => Math.round((Number(price) * (100 - Number(percent || 0))) / 100);

// The largest discount on sale, for "members save up to N%"
export const maxDiscount = (packages) =>
  Math.max(0, ...(packages ?? []).filter((p) => p.status === 1).map((p) => Number(p.discountPercent ?? 0)));

// The services a package lists, one per line
export const benefitsOf = (pkg) =>
  String(pkg?.benefits ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
