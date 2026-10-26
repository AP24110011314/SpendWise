import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

const TOKEN_KEY = 'sw_access_token';

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      const userData = res?.user || res?.data?.user || res;
      setUser(userData);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for stored token on init
    const storedToken = getStoredToken();
    if (storedToken) {
      // Token exists, try to fetch user
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const payload = res?.data || res;
    const userData = payload?.user || payload;
    setUser(userData);
    setStoredToken(payload?.accessToken);
    return payload;
  };

  const register = async (name, email, password) => {
    const res = await authApi.register(name, email, password);
    const payload = res?.data || res;
    const userData = payload?.user || payload;
    setUser(userData);
    setStoredToken(payload?.accessToken);
    return payload;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setStoredToken(null);
  };

  const updateUser = async (updates) => {
    try {
      const res = await authApi.updateMe(updates);
      const userData = res?.user || res?.data?.user || res;
      setUser(userData);
      return userData;
    } catch (err) {
      // Revert optimistic update on error
      setUser(prev => ({ ...prev }));
      throw err;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    return authApi.changePassword(currentPassword, newPassword);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}