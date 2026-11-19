
const PREFIX = 'sportcenter.write-guard.v1:';
const noop = () => {};
const policies = {
  support: { limit: 5, windowMs: 600000, gapMs: 30000, onAttempt: true },
  notifications: { limit: 10, windowMs: 60000, gapMs: 5000, onAttempt: true },
  ai: { limit: 10, windowMs: 60000, gapMs: 3000, onAttempt: true },
  login: { limit: 5, windowMs: 60000, gapMs: 1000, onAttempt: true },
  register: { limit: 3, windowMs: 600000, gapMs: 10000, onAttempt: true },
  recovery: { limit: 3, windowMs: 600000, gapMs: 20000, onAttempt: true },
  checkout: { limit: 10, windowMs: 60000, gapMs: 2000, onAttempt: true },
  upload: { limit: 10, windowMs: 60000, gapMs: 1000 },
  writes: { limit: 120, windowMs: 60000, gapMs: 0 },
};
export function mutationPolicy(method, path) {
  const p = path.split('?')[0].replace(/\/$/, '');
  if (method === 'GET' || method === 'HEAD') return null;
  let group = 'writes';
  if (method === 'POST' && p === '/api/support-requests') group = 'support';
  else if (method === 'POST' && p === '/api/notifications') group = 'notifications';
  else if (p.startsWith('/api/ai/')) group = 'ai';
  else if (p === '/api/auth/login') group = 'login';
  else if (p === '/api/auth/register') group = 'register';
  else if (/\/api\/auth\/(?:forgot-password|reset-password)/.test(p)) group = 'recovery';
  else if (method === 'POST' && /\/api\/payments\/(?:checkout|class-checkout|upgrade-checkout)$/.test(p)) group = 'checkout';
  else if (method === 'POST' && p === '/api/media/images') group = 'upload';
  return { group, ...policies[group] };
}
const digest = value => {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
};
export function mutationScope(token) {
  if (!token) return 'anonymous';
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part));
    const id = claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? claims.sub;
    if (id) return 'account-' + digest(String(id));
  } catch {   }
  return 'session-' + digest(token);
}
const signature = (method, path, body) => {

  if (path.startsWith('/api/auth/')) return method + ':' + path;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return method + ':' + path + ':' + digest([...body.entries()].map(([k,v]) => k + ':' + (typeof v === 'string' ? v : [v.name,v.size,v.lastModified].join(':'))).join('|'));
  }
  return method + ':' + path + ':' + digest(JSON.stringify(body ?? {}));
};
export class MutationLimitError extends Error {
  constructor(wait, duplicate = false) {
    const seconds = Math.max(1, Math.ceil(wait / 1000));
    super(duplicate ? 'Yêu cầu này đang được xử lý. Vui lòng chờ kết quả.' : 'Bạn thao tác quá nhanh. Vui lòng chờ ' + seconds + ' giây rồi thử lại.');
    this.name = 'MutationLimitError'; this.status = 429;
    this.code = duplicate ? 'FE_DUPLICATE_REQUEST' : 'FE_RATE_LIMIT';
    this.retryAfterMs = wait; this.localRateLimit = true;
  }
}
export function createMutationGuard({ now = Date.now, storage = () => { try { return globalThis.localStorage; } catch { return null; } } } = {}) {
  const memory = new Map(), pending = new Set(), duplicates = new Map();
  const keyOf = (scope, group) => PREFIX + scope + ':' + group;
  const read = (scope, policy) => {
    const key = keyOf(scope, policy.group);
    let value = memory.get(key);
    try { const raw = storage()?.getItem(key); if (raw) value = JSON.parse(raw); } catch {   }
    const attempts = Array.isArray(value?.attempts) ? value.attempts.filter(t => Number.isFinite(t) && t > now() - policy.windowMs && t <= now()) : [];
    return { attempts, until: Number.isFinite(value?.until) ? value.until : 0 };
  };
  const save = (scope, policy, value) => {
    const key = keyOf(scope, policy.group); memory.set(key, value);
    try { storage()?.setItem(key, JSON.stringify(value)); } catch {   }
  };
  const wait = (method, path, scope = 'anonymous', body) => {
    const policy = mutationPolicy(method, path); if (!policy) return 0;
    const state = read(scope, policy);
    const rateUntil = state.attempts.length >= policy.limit ? state.attempts[0] + policy.windowMs : 0;
    const id = scope + ':' + signature(method, path, body);
    return Math.max(0, state.until - now(), rateUntil - now(), (duplicates.get(id) ?? 0) - now(), pending.has(id) ? 1000 : 0);
  };
  return {
    wait,
    begin(method, path, body, scope = 'anonymous') {
      const policy = mutationPolicy(method, path); if (!policy) return { success: noop, release: noop };
      const id = scope + ':' + signature(method, path, body);
      if (pending.has(id)) throw new MutationLimitError(1000, true);
      const remaining = wait(method, path, scope, body);
      if (remaining > 0) throw new MutationLimitError(remaining);
      if (duplicates.size > 1000) for (const [key, until] of duplicates) if (until <= now()) duplicates.delete(key);
      const state = read(scope, policy); state.attempts.push(now());
      if (policy.onAttempt) state.until = Math.max(state.until, now() + policy.gapMs);
      save(scope, policy, state); pending.add(id);
      return {
        success() {
          const fresh = read(scope, policy);
          fresh.until = Math.max(fresh.until, now() + policy.gapMs);
          save(scope, policy, fresh); duplicates.set(id, now() + 2000);
        },
        release() { pending.delete(id); },
      };
    },
    defer(method, path, scope, milliseconds) {
      const policy = mutationPolicy(method, path);
      if (!policy || !(milliseconds > 0)) return;
      const state = read(scope, policy); state.until = Math.max(state.until, now() + milliseconds); save(scope, policy, state);
    },
  };
}
export const mutationGuard = createMutationGuard();
export function retryAfterMilliseconds(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - now) || 0;
}
