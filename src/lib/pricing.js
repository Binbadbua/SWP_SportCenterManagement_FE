

import { todayLocalDateString } from './format.js';
import { cardsOn } from './membership.js';

export const hasClassPrices = (classes) => (classes ?? []).some((c) => typeof c.price === 'number');
export const hasPackageDiscounts = (packages) => (packages ?? []).some((p) => typeof p.discountPercent === 'number');

export function discountFor(cards, packages, day = todayLocalDateString()) {
  let best = { percent: 0, card: null, pkg: null };
  for (const card of cardsOn(cards, day)) {
    const pkg = (packages ?? []).find((p) => p.id === card.packageId);
    const percent = Number(pkg?.discountPercent ?? 0);
    if (Number.isFinite(percent) && percent > best.percent && percent <= 100) best = { percent, card, pkg };
  }
  return best;
}

export const priceAfter = (price, percent) => Math.round((Number(price) * (100 - Number(percent || 0))) / 100);

export const maxDiscount = (packages) =>
  Math.max(0, ...(packages ?? []).filter((p) => p.status === 1).map((p) => Number(p.discountPercent ?? 0)));

const linesOf = (text) =>
  String(text ?? '').split('\n').map((line) => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
export const benefitsOf = (pkg) => (pkg?.benefits ? linesOf(pkg.benefits) : linesOf(pkg?.description).slice(1));

export const summaryOf = (pkg) => (pkg?.benefits ? String(pkg.description ?? '') : linesOf(pkg?.description)[0] ?? '');
