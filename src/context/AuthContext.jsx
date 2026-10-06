import { createContext, useCallback, useContext, useMemo, useState } from 'react';
// Import 'http' hoặc 'api' từ file cấu hình API của bạn để gọi request
import { api } from '../api/endpoints.js'; 

const STORAGE_KEY = 'sportcenter.session';
const TOKEN_KEY = 'sportcenter.token'; // Thêm key để lưu Token bảo mật

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(read);

  const save = useCallback((nextUser, token) => {
    setUser(nextUser);
    try {
      if (nextUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        if (token) localStorage.setItem(TOKEN_KEY, token); // Lưu token vào bộ nhớ
      } else {
        // Đăng xuất thì xóa hết
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      /* private mode: keep in memory only */
    }
  }, []);

  // HÀM ĐĂNG NHẬP THẬT (Đã trang bị bộ phiên dịch Role)
  const signIn = useCallback(async (username, password) => {
    try {
      const response = await api.auth.login({ email: username, password });
      const data = response.data || response;
      const token = data.access_token; 

      if (!token) throw new Error("Không nhận được token từ server");

      const decodeJWT = (t) => {
        try {
          const base64Url = t.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch (e) {
          return {};
        }
      };

      const tokenPayload = decodeJWT(token);
      
      // MÓC DỮ LIỆU TỪ CÁC LINK CỦA .NET VÀ GÁN VÀO CÁC BIẾN NGẮN GỌN
      const normalizedUser = {
        accountId: tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        fullName: tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'User',
        FullName: tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'User', // Đề phòng code cũ dùng FullName
        email: tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        role: tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
      };

      const userData = {
        ...data,
        ...normalizedUser
      };

      save(userData, token);
      return { success: true, role: userData.role || userData.Role };
    } catch (error) {
      console.error('Đăng nhập thất bại:', error);
      return { success: false, error: error.response?.data?.message || 'Sai tài khoản hoặc mật khẩu' };
    }
  }, [save]);

  const signOut = useCallback(() => save(null, null), [save]);
  const updateUser = useCallback((patch) => save({ ...(read() ?? {}), ...patch }, localStorage.getItem(TOKEN_KEY)), [save]);

  const value = useMemo(() => ({ user, signIn, signOut, updateUser }), [user, signIn, signOut, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const isStaff = (user) => {
    if (!user) return false;
    const currentRole = user.role || user.Role;
    return [2, 3, 4, 'Coach', 'Receptionist', 'CenterManager'].includes(currentRole);
  };