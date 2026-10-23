import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
// Import 'http' hoặc 'api' từ file cấu hình API của bạn để gọi request
import { api } from "../api/endpoints.js";

const STORAGE_KEY = "sportcenter.session";
const TOKEN_KEY = "sportcenter.token"; // Thêm key để lưu Token bảo mật

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
};

const AuthContext = createContext(null);

// The login token only carries the account ID. Pages also need the ID of the profile behind it
// (bookings use memberId, training plans use coachId, invoices use receptionistId).
const PROFILE = {
  Member: { key: "memberId", load: () => api.members.myId() },
  Coach: { key: "coachId", load: async () => (await api.coaches.me()).id },
  Receptionist: { key: "receptionistId", load: async () => (await api.receptionists.me()).id },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(read);
  // idle | loading | ready | error — whether user[PROFILE[role].key] could be found
  const [profile, setProfile] = useState({ status: "idle", error: null });

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
  const signIn = useCallback(
    async (username, password) => {
      try {
        const response = await api.auth.login({
          email: username,
          password,
        });
        const data = response.data || response;
        const token = data.access_token;

        if (!token) throw new Error("Không nhận được token từ server");

        const decodeJWT = (t) => {
          try {
            const base64Url = t.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const jsonPayload = decodeURIComponent(
              window
                .atob(base64)
                .split("")
                .map(function (c) {
                  return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join(""),
            );
            return JSON.parse(jsonPayload);
          } catch (e) {
            return {};
          }
        };

        const tokenPayload = decodeJWT(token);

        // MÓC DỮ LIỆU TỪ CÁC LINK CỦA .NET VÀ GÁN VÀO CÁC BIẾN NGẮN GỌN
        const normalizedUser = {
          accountId:
            tokenPayload[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            ],
          username:
            tokenPayload[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ] || "User",

          fullName:
            tokenPayload.FullName || "User",
          email:
            tokenPayload[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
            ],
          role: tokenPayload[
            "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
          ],
        };

        const userData = {
          ...data,
          ...normalizedUser,
        };

        save(userData, token);
        return { success: true, role: userData.role || userData.Role };
      } catch (error) {
        console.error("Đăng nhập thất bại:", error);
        return {
          success: false,
          // ApiError carries the server's message ("Invalid username or password", "Account is not active"…)
          error: error.status || error.offline ? error.message : "Sai tài khoản hoặc mật khẩu",
        };
      }
    },
    [save],
  );

  const signOut = useCallback(() => save(null, null), [save]);
  const updateUser = useCallback(
    (patch) =>
      save({ ...(read() ?? {}), ...patch }, localStorage.getItem(TOKEN_KEY)),
    [save],
  );

  // Look up the profile ID once per sign-in; it is saved with the session afterwards.
  const role = user?.role;
  const accountId = user?.accountId;
  const hasProfileId = !!(PROFILE[role] && user?.[PROFILE[role].key]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const def = PROFILE[role];
    if (!accountId || !def) {
      setProfile({ status: "idle", error: null });
      return undefined;
    }
    if (hasProfileId) {
      setProfile({ status: "ready", error: null });
      return undefined;
    }
    let cancelled = false;
    setProfile({ status: "loading", error: null });
    def
      .load()
      .then((id) => {
        if (cancelled) return;
        if (!id) throw new Error("Profile not found.");
        updateUser({ [def.key]: id });
        setProfile({ status: "ready", error: null });
      })
      .catch((error) => {
        if (!cancelled) setProfile({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, role, hasProfileId, attempt, updateUser]);
  const retryProfile = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ user, signIn, signOut, updateUser, profile, retryProfile }),
    [user, signIn, signOut, updateUser, profile, retryProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Roles come from the JWT as the enum names of AccountRole: "Member", "Coach", "Receptionist", "CenterManager".
const roleOf = (user) => user?.role ?? user?.Role;

export const isStaff = (user) => {
  if (!user) return false;
  return [2, 3, 4, "Coach", "Receptionist", "CenterManager"].includes(
    roleOf(user),
  );
};

export const isMember = (user) => [1, "Member"].includes(roleOf(user));
