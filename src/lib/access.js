import { normalizeRole } from './session.js';

const ALL_STAFF = ['CenterManager', 'Receptionist', 'Coach'];
export const STAFF_ROUTE_ROLES = {
  '/staff': ALL_STAFF,
  '/staff/notifications': ALL_STAFF,
  '/staff/check-ins': ['CenterManager', 'Receptionist'],
  '/staff/bookings': ['Receptionist'],
  '/staff/members': ['CenterManager', 'Receptionist'],
  '/staff/memberships': ['CenterManager', 'Receptionist'],
  '/staff/invoices': ['CenterManager', 'Receptionist'],
  '/staff/support-requests': ['CenterManager', 'Receptionist'],
  '/staff/my-classes': ['Coach'],
  '/staff/my-members': ['Coach'],
  '/staff/attendance': ['Coach'],
  '/staff/training-plans': ['Coach'],
  '/staff/training-results': ['Coach'],
  '/staff/classes': ['CenterManager', 'Receptionist'],
  '/staff/schedule': ALL_STAFF,
  '/staff/rooms': ['CenterManager'],
  '/staff/sports': ['CenterManager'],
  '/staff/packages': ['CenterManager'],
  '/staff/coaches': ['CenterManager'],
  '/staff/receptionists': ['CenterManager'],
  '/staff/managers': ['CenterManager'],
  '/staff/accounts': ['CenterManager'],
  '/staff/audit-log': ['CenterManager'],
};

export function internalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\\\u0000-\u001f]/.test(value)) return null;
  try {
    const base = 'https://sportcenter.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('%')) pathname = decodeURIComponent(pathname);
    if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\\\u0000-\u001f]/.test(pathname)) return null;
    return { value: url.pathname + url.search + url.hash, pathname: pathname.toLowerCase().replace(/\/+$/, '') || '/' };
  } catch { return null; }
}

export function canAccessStaffPath(role, value) {
  const path = internalPath(value)?.pathname;
  const normalized = normalizeRole(role);
  if (!ALL_STAFF.includes(normalized)) return false;
  return !!path && !!STAFF_ROUTE_ROLES[path]?.includes(normalized);
}

export function loginDestination(next, role) {
  const normalized = normalizeRole(role);
  const fallback = ALL_STAFF.includes(normalized) ? '/staff' : '/';
  const path = internalPath(next);
  if (!path || path.pathname === '/login' || path.pathname === '/register') return fallback;
  if (path.pathname === '/staff' || path.pathname.startsWith('/staff/')) {
    return canAccessStaffPath(normalized, next) ? path.value : fallback;
  }
  return path.value;
}
