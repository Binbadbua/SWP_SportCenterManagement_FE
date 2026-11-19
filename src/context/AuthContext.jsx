import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/endpoints.js';
import { SESSION_EVENT, SESSION_KEY, TOKEN_KEY, expireSession, getSessionToken, normalizeSession, readSession, saveSession, sessionRole, tokenClaims, tokenExpired } from '../lib/session.js';

const AuthContext = createContext(null);
const PROFILE = {
  Member: { key: 'memberId', load: () => api.members.myId() },
  Coach: { key: 'coachId', load: async () => (await api.coaches.me()).id },
  Receptionist: { key: 'receptionistId', load: async () => (await api.receptionists.me()).id },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const [sessionExpired, setSessionExpired] = useState(() => !!getSessionToken() && tokenExpired(getSessionToken()));
  const [profile, setProfile] = useState({ status: 'idle', error: null });
  const generation = useRef(0);
  const currentUser = useRef(user);
  currentUser.current = user;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const sync = event => {
      if (event.type === 'storage' && event.key !== null && event.key !== SESSION_KEY && event.key !== TOKEN_KEY) return;
      const next = readSession();
      const before = currentUser.current;
      if (before?.access_token !== next?.access_token || before?.accountId !== next?.accountId || before?.role !== next?.role) {
        generation.current += 1;
        setProfile({ status: 'idle', error: null });
      }
      currentUser.current = next;
      setUser(next);
      if (event.detail?.reason === 'expired') setSessionExpired(true);
      else if (next || event.detail?.reason === 'signout') setSessionExpired(false);
    };
    const focus = () => {
      const token = getSessionToken();
      if (token && tokenExpired(token)) expireSession(token);
      else sync({ type: 'focus' });
    };
    const visible = () => { if (!document.hidden) focus(); };
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  useEffect(() => {
    const token = user?.access_token ?? getSessionToken();
    const exp = tokenClaims(token)?.exp;
    if (!token || exp == null) return undefined;
    let timer;
    const schedule = () => {
      const remaining = Number(exp) * 1000 - Date.now();
      if (remaining <= 0) expireSession(token);
      else timer = setTimeout(schedule, Math.min(remaining + 10, 2147483647));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [user?.access_token]);

  const signIn = useCallback(async (username, password) => {
    const call = ++generation.current;
    const previousToken = getSessionToken();
    try {
      const response = await api.auth.login({ email: username, password });
      if (call !== generation.current || previousToken !== getSessionToken()) {
        return { success: false, error: 'Phiên đăng nhập đã thay đổi. Vui lòng thử lại.' };
      }
      const data = response.data || response;
      const token = data.access_token;
      const next = normalizeSession({ ...data, role: sessionRole({ ...data, access_token: token }) }, token);
      if (!next) return { success: false, error: 'Máy chủ trả phiên đăng nhập không hợp lệ hoặc đã hết hạn.' };
      saveSession(next, token);
      setUser(next);
      setSessionExpired(false);
      return { success: true, role: next.role };
    } catch (error) {
      return { success: false, error: error.status || error.offline ? error.message : 'Không thể đăng nhập. Vui lòng kiểm tra tài khoản và thử lại.' };
    }
  }, []);

  const signOut = useCallback(() => {
    generation.current += 1;
    saveSession(null, null, 'signout');
    setUser(null);
    setSessionExpired(false);
    setProfile({ status: 'idle', error: null });
  }, []);
  const updateUser = useCallback(patch => {
    const current = readSession();
    if (!current || current.accountId !== user?.accountId || current.access_token !== user?.access_token) return false;
    const allowed = ['fullName', 'email', PROFILE[current.role]?.key].filter(Boolean);
    const safe = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)));
    const next = saveSession({ ...current, ...safe }, current.access_token, 'profile');
    setUser(next);
    return true;
  }, [user?.accountId, user?.access_token]);

  const role = user?.role;
  const accountId = user?.accountId;
  const hasProfileId = !!(PROFILE[role] && user?.[PROFILE[role].key]);
  useEffect(() => {
    const def = PROFILE[role];
    if (!accountId || !def) { setProfile({ status: 'idle', error: null }); return undefined; }
    if (hasProfileId) { setProfile({ status: 'ready', error: null }); return undefined; }
    let cancelled = false;
    setProfile({ status: 'loading', error: null });
    def.load().then(id => {
      if (cancelled) return;
      if (!id) throw new Error('Không tìm thấy hồ sơ.');
      if (updateUser({ [def.key]: id })) setProfile({ status: 'ready', error: null });
    }).catch(error => { if (!cancelled) setProfile({ status: 'error', error }); });
    return () => { cancelled = true; };
  }, [accountId, role, user?.access_token, hasProfileId, attempt, updateUser]);
  const retryProfile = useCallback(() => setAttempt(n => n + 1), []);
  const acknowledgeExpiry = useCallback(() => setSessionExpired(false), []);
  const validUser = normalizeSession(user, user?.access_token);
  const value = useMemo(() => ({ user: validUser, signIn, signOut, updateUser, profile, retryProfile, sessionExpired, acknowledgeExpiry }), [user, signIn, signOut, updateUser, profile, retryProfile, sessionExpired, acknowledgeExpiry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const isStaff = user => ['Coach', 'Receptionist', 'CenterManager'].includes(sessionRole(user));
export const isMember = user => sessionRole(user) === 'Member';
