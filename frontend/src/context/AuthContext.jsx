import { createContext, useContext, useState, useEffect } from 'react';
import { api, authStorage } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      const storedToken = authStorage.getToken();
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
        } catch {
          // Token expired or invalid
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
    return data;
  };

  const signup = async (payload) => {
    const data = await api.signup(payload);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
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
