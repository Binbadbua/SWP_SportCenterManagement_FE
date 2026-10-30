import { api } from '../api/endpoints.js';
import { useApi } from './useApi.js';
import { waitingOrder } from '../lib/payments.js';

// Invoice/card cancellation can lag behind an expired payment. The payment state decides whether checkout is blocked.
export function usePendingOrder(cards, invoices) {
  const candidates = (cards ?? []).map((card) => waitingOrder([card], invoices)).filter(Boolean);
  const key = candidates.map((x) => x.invoice.id).join(',');
  const state = useApi(async () => {
    const payments = await Promise.all(candidates.map(async (candidate) => ({
      ...candidate, payment: await api.payments.get(candidate.invoice.id),
    })));
    return { key, waiting: payments.find((candidate) => candidate.payment?.status === 1) ?? null };
  }, [key], { skip: !key });
  return { waiting: key && state.data?.key === key ? state.data.waiting : null, checking: !!key && !state.error && (state.loading || state.data?.key !== key), error: key ? state.error : null, reload: state.reload };
}
