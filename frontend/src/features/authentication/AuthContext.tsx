import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../../services/api';
import type { LoginResponse, UserSummary } from '../../types/api';

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (...perms: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiRequest<UserSummary>('/api/auth/me');
      setUser(me);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<UserSummary> => {
    const res = await apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (...perms: string[]) => {
      if (!user) return false;
      return perms.some((p) => user.permissions.includes(p));
    },
    [user],
  );

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user) return false;
      return roles.some((r) => user.roles.includes(r));
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, hasPermission, hasRole }),
    [user, loading, login, logout, refreshUser, hasPermission, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
