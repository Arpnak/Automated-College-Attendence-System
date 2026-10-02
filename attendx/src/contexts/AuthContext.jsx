import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';

export const AuthContext = createContext(null);
const STORAGE_KEY = 'classroll.auth';

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track active session (professor mid-session guard)
  const [activeSession, setActiveSession] = useState(null); // { sessionId, courseId, courseName }

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored?.user && stored?.token) {
      setUser(stored.user);
      setToken(stored.token);
    }
    setLoading(false);
  }, []);

  const persist = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    if (nextUser && nextToken) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = useCallback(async (credentials) => {
    const { user: nextUser, token: nextToken } = await authService.login(credentials);
    persist(nextUser, nextToken);
    return nextUser;
  }, []);

  // Open registration with role selection
  const register = useCallback(async (payload) => {
    const { user: nextUser, token: nextToken } = await authService.register(payload);
    persist(nextUser, nextToken);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    persist(null, null);
    setActiveSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      activeSession,
      setActiveSession,
    }),
    [user, token, loading, login, register, logout, activeSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
