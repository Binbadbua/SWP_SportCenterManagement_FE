import { useEffect, useState } from 'react';
import { api, isMissingRoute } from '../api/endpoints.js';
import { useApi } from './useApi.js';
import { hasClassPrices } from '../lib/pricing.js';

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
        billedAsking = undefined;
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

export function usePaymentOptionsState() {
  return useApi(loadPaymentOptions, []);
}

export function usePaymentOptions() {
  return usePaymentOptionsState().data ?? undefined;
}