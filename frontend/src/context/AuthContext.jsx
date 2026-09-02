import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, authStorage } from '../services/api';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  const logout = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = null;
    api.logout();
    setUser(null);
    setToken(null);
  }, []);

  // Schedule auto-logout based on last activity
  const scheduleSessionExpiry = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    const lastActivity = authStorage.getLastActivity();
    if (!lastActivity) return;

    const elapsed = Date.now() - lastActivity;
    if (elapsed >= SESSION_TIMEOUT_MS) {
      // Already timed out
      logout();
      return;
    }

    const remaining = SESSION_TIMEOUT_MS - elapsed;
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, remaining);
  }, [logout]);

  // Track user activity
  useEffect(() => {
    if (!token) return;

    // Mark activity on events
    const handleActivity = () => {
      authStorage.setLastActivity();
      scheduleSessionExpiry();
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    // Set initial activity timestamp if missing
    if (!authStorage.getLastActivity()) {
      authStorage.setLastActivity();
    }

    // Check for expired session on mount
    const lastActivity = authStorage.getLastActivity();
    if (lastActivity && Date.now() - lastActivity >= SESSION_TIMEOUT_MS) {
      logout();
      return;
    }

    scheduleSessionExpiry();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [token, scheduleSessionExpiry, logout]);

  useEffect(() => {
    async function verifyAuth() {
      const storedToken = authStorage.getToken();
      if (storedToken) {
        // Check idle timeout before hitting API
        const lastActivity = authStorage.getLastActivity();
        if (lastActivity && Date.now() - lastActivity >= SESSION_TIMEOUT_MS) {
          authStorage.clear();
          setLoading(false);
          return;
        }

        try {
          const profile = await api.getMe();
          setUser(profile);
        } catch {
          authStorage.clear();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }

    verifyAuth();
  }, []);

  const login = async (credentials) => {
    const data = await api.login(credentials);
    setUser(data.user);
    setToken(data.token);
    authStorage.setLastActivity();
    return data;
  };

  const signup = async (payload) => {
    const data = await api.signup(payload);
    setUser(data.user);
    setToken(data.token);
    authStorage.setLastActivity();
    return data;
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
