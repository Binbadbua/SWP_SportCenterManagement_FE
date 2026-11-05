import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/endpoints.js';
import { isMember, useAuth } from '../context/AuthContext.jsx';
import { todayCenterDateString } from '../lib/format.js';
import { discountFor } from '../lib/pricing.js';
import { useApi } from './useApi.js';

// One pair of reads per page, never one request per class card; no sample personal prices.
export function useMemberDiscount({ enabled = true } = {}) {
  const { user } = useAuth();
  const member = isMember(user);
  const [day, setDay] = useState(todayCenterDateString);
  const lastChecked = useRef(0);
  const benefits = useApi(async () => {
    lastChecked.current = Date.now();
    const [cards, packages] = await Promise.all([api.memberships.mine(), api.packages.list()]);
    return { cards, packages };
  }, [user?.accountId, user?.access_token, day], { skip: !member || !enabled });
  const { reload } = benefits;
  useEffect(() => {
    if (!member || !enabled) return undefined;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      const today = todayCenterDateString();
      setDay(today);
      if (today === day && Date.now() - lastChecked.current >= 30000) reload();
    };
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') setDay(todayCenterDateString());
    }, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [member, enabled, day, reload]);
  const ready = member && enabled && !benefits.loading && !benefits.error && !!benefits.data;
  const deal = ready ? discountFor(benefits.data.cards, benefits.data.packages, day) : { percent: 0 };
  const nextDeal = ready ? (benefits.data.cards ?? [])
    .filter(card => card.status === 1 && String(card.startDate).slice(0, 10) > day)
    .map(card => ({ card, pkg: benefits.data.packages.find(pkg => pkg.id === card.packageId) }))
    .map(item => ({ ...item, percent: Number(item.pkg?.discountPercent ?? 0) }))
    .filter(item => Number.isFinite(item.percent) && item.percent > deal.percent && item.percent <= 100)
    .sort((a, b) => String(a.card.startDate).localeCompare(String(b.card.startDate)))[0] : null;
  const retry = useCallback(() => reload(), [reload]);
  return { member, deal, nextDeal, loading: member && enabled && benefits.loading, error: benefits.error, reload: retry };
}
