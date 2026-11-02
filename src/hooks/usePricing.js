import { useEffect, useState } from 'react';
import { api, isMissingRoute } from '../api/endpoints.js';
import { useApi } from './useApi.js';
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

async function loadPaymentOptions() {
  if (optionsKnown !== undefined) return optionsKnown;
  optionsAsking ??= api.payments.options().then(
    (o) => {
      if (!o?.provider || !Array.isArray(o.methods) || !o.methods.length) {
        throw new Error('Máy chủ chưa trả đủ thông tin thanh toán. Vui lòng tải lại.');
      }
      optionsKnown = {
        online: true, provider: o.provider, methods: o.methods,
        holdMinutes: o.holdMinutes ?? 15, upgrade: !!o.upgrade,
      };
      return optionsKnown;
    },
    (error) => {
      if (isMissingRoute(error)) return (optionsKnown = DESK_CONFIRMED);
      throw error;
    },
  ).finally(() => { optionsAsking = undefined; });
  return optionsAsking;
}

// Checkout needs the failure/retry state; an outage must not look like a legacy desk transfer.
export function usePaymentOptionsState() {
  return useApi(loadPaymentOptions, []);
}

// Existing informational pages only need the resolved capabilities.
export function usePaymentOptions() {
  return usePaymentOptionsState().data ?? undefined;
}