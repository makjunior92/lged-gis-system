import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { login as apiLogin, getMe } from '@/api/auth';
import { tokenStorage } from '@/lib/api';
import type { Role, User } from '@/types/user';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  hasAnyRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUser<User>());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(tokenStorage.getAccess()) && !tokenStorage.getUser());

  // On mount, if we have a token but no cached user, refresh from /auth/me.
  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (user) return;
    let cancelled = false;
    setIsLoading(true);
    getMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        tokenStorage.setUser(u);
      })
      .catch(() => {
        // Token invalid — clear and bounce.
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await apiLogin({ username, password });
    tokenStorage.set(res.access_token, res.refresh_token);
    tokenStorage.setUser(res.user);
    setUser(res.user);
  }, []);

  const signOut = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const hasAnyRole = useCallback(
    (roles: Role[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signOut,
      hasAnyRole,
    }),
    [user, isLoading, signIn, signOut, hasAnyRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
