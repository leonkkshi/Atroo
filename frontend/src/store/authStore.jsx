import { createContext, useContext, useState, useEffect } from 'react';
import { initSessionManager, startHeartbeat, stopHeartbeat, logoutAndClear } from '../utils/sessionManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // Khởi động heartbeat nếu đã đăng nhập (ví dụ: reload trang)
  useEffect(() => {
    if (token) {
      initSessionManager();
    }
  }, []);

  const login = (userData, jwt) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', jwt);
    // Bắt đầu heartbeat
    startHeartbeat();
  };

  const logout = () => {
    stopHeartbeat();
    // Gọi API logout (fire-and-forget)
    logoutAndClear().catch(() => {});
    setUser(null);
    setToken(null);
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
