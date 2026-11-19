export const SESSION_KEY = 'sportcenter.session';
export const TOKEN_KEY = 'sportcenter.token';
export const SESSION_EVENT = 'sportcenter:session-changed';

const ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const EMAIL_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const ROLES = { 1: 'Member', 2: 'Coach', 3: 'Receptionist', 4: 'CenterManager' };
let memoryUser = null;

export function normalizeRole(value) {
  if (Array.isArray(value)) return value.length === 1 ? normalizeRole(value[0]) : null;
  return Object.hasOwn(ROLES, value) ? ROLES[value] : (Object.values(ROLES).includes(value) ? value : null);
}

export function tokenClaims(token) {
  try {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const claims = JSON.parse(decodeURIComponent(bytes));
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
  } catch { return null; }
}

export function tokenExpired(token, now = Date.now()) {
  const claims = tokenClaims(token);
  if (!claims) return true;
  return claims.exp != null && (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 <= now);
}

export function normalizeSession(saved, token, now = Date.now()) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) || !token) return null;
  if (saved.access_token && saved.access_token !== token) return null;
  const claims = tokenClaims(token);
  if (!claims || tokenExpired(token, now)) return null;
  const role = normalizeRole(claims[ROLE_CLAIM] ?? claims.role);
  const accountId = claims[ID_CLAIM] ?? claims.sub;
  if (!role || typeof accountId !== 'string' || !accountId.trim()) return null;
  if (saved.accountId && saved.accountId !== accountId) return null;
  const sameRole = normalizeRole(saved.role ?? saved.Role) === role;
  const username = claims[NAME_CLAIM] ?? claims.unique_name ?? claims.name ?? saved.username ?? 'Người dùng';
  const next = {
    accountId,
    role,
    username,
    fullName: saved.fullName || claims.FullName || claims.fullName || username,
    email: saved.email ?? claims[EMAIL_CLAIM] ?? claims.email ?? '',
    access_token: token,
  };
  const profileKey = { Member: 'memberId', Coach: 'coachId', Receptionist: 'receptionistId' }[role];
  if (sameRole && profileKey && saved[profileKey]) next[profileKey] = saved[profileKey];
  return next;
}

export function getSessionToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return memoryUser?.access_token ?? null; }
}

export function readSession() {
  let raw, token;
  try {
    raw = localStorage.getItem(SESSION_KEY);
    token = localStorage.getItem(TOKEN_KEY);
  } catch { return normalizeSession(memoryUser, memoryUser?.access_token); }
  try { return normalizeSession(JSON.parse(raw), token); } catch { return null; }
}

const emit = reason => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { reason } }));
};

export function saveSession(user, token, reason = 'signin') {
  const next = user ? normalizeSession(user, token) : null;
  if (user && !next) throw new Error('Thông tin phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  memoryUser = next;
  try {
    if (next) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {   }
  emit(reason);
  return next;
}

export function expireSession(expectedToken) {
  if (!expectedToken || getSessionToken() !== expectedToken) return false;
  saveSession(null, null, 'expired');
  return true;
}

export function sessionRole(user) {
  return normalizeSession(user, user?.access_token)?.role ?? null;
}
