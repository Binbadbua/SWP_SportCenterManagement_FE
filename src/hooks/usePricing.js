import { useEffect, useState } from 'react';
import { api } from '../api/endpoints.js';
import { hasClassPrices } from '../lib/pricing.js';

// Capabilities the API gains with the new business rules, asked once per page load and shared by every page.

// Whether the API bills classes yet (CHANGELOG Part B, B53), for pages that show no class themselves (help, terms,
// packages); undefined while unknown, false if it can't tell.
let billedKnown;
let billedAsking;

export function useClassPricing() {
  const [billed, setBilled] = useState(billedKnown);
  useEffect(() => {
    if (billedKnown !== undefined) return undefined;
    let live = true;
    billedAsking ??= api.classes.list().then(
      (rows) => (billedKnown = hasClassPrices(rows)),
      () => {
        billedAsking = undefined; // ask again on the next page
        return false;
      },
    );
    billedAsking.then((value) => live && setBilled(value));
    return () => {
      live = false;
    };
  }, []);
  return billed;
}

// How members pay online (B54). Before the API takes SePay it answers 404 and orders made on the website wait 30
// minutes for reception to confirm a bank transfer (no paying at the desk for a web order).
export const DESK_CONFIRMED = { online: false, provider: 'BankTransfer', methods: [2], holdMinutes: 30, upgrade: false };
let optionsKnown;
let optionsAsking;

export function usePaymentOptions() {
  const [options, setOptions] = useState(optionsKnown);
  useEffect(() => {
    if (optionsKnown !== undefined) return undefined;
    let live = true;
    optionsAsking ??= api.payments.options().then(
      (o) => (optionsKnown = {
        online: true,
        provider: o?.provider ?? 'SePay',
        methods: o?.methods?.length ? o.methods : [2],
        holdMinutes: o?.holdMinutes ?? 15,
        upgrade: !!o?.upgrade,
      }),
      (e) => {
        if (e?.status === 404 || e?.status === 405) return (optionsKnown = DESK_CONFIRMED);
        optionsAsking = undefined; // unreachable for now: ask again on the next page
        return DESK_CONFIRMED;
      },
    );
    optionsAsking.then((value) => live && setOptions(value));
    return () => {
      live = false;
    };
  }, []);
  return options;
}
