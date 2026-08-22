import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  clearSession,
  getStoredToken,
  getStoredUser,
  setBaseUrl,
  storeSession,
  User,
  Role,
  healthCheck,
} from '../api/client';
import type { ApiInfo } from '../vite-env';
import { getPosBridge } from '../bridge';

type AuthState = {
  ready: boolean;
  user: User | null;
  token: string | null;
  apiInfo: ApiInfo | null;
  serverError: string | null;
  firstRun: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginByPin: (userId: number, pin: string) => Promise<void>;
  completeFirstRun: (store: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshApiInfo: () => Promise<ApiInfo>;
  hasRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [firstRun, setFirstRun] = useState(false);

  const refreshApiInfo = async () => {
    const bridge = getPosBridge();
    const info = await bridge.getApiInfo();
    setBaseUrl(info.baseUrl);
    setApiInfo(info);
    try {
      await healthCheck(info.healthUrl);
      setServerError(null);
    } catch {
      setServerError(
        'Local API server is not responding. Prefer the Electron app window from `npm run dev`.'
      );
    }
    return info;
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshApiInfo();
        try {
          const status = await api.getFirstRun();
          setFirstRun(status.firstRun);
        } catch {
          setFirstRun(false);
        }
        if (!getStoredToken() || !getStoredUser()) {
          return;
        }
        try {
          const fresh = await api.getUser(getStoredUser()!._id);
          setUser(fresh);
          storeSession(getStoredToken()!, fresh);
        } catch {
          clearSession();
          setUser(null);
          setToken(null);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    await refreshApiInfo();
    const result = await api.login(username, password);
    storeSession(result.token, result.user);
    setToken(result.token);
    setUser(result.user);
    setFirstRun(false);
  };

  const loginByPin = async (userId: number, pin: string) => {
    await refreshApiInfo();
    const result = await api.loginByPin(userId, pin);
    storeSession(result.token, result.user);
    setToken(result.token);
    setUser(result.user);
    setFirstRun(false);
  };

  const completeFirstRun = async (store: string, pin: string) => {
    await refreshApiInfo();
    await api.completeFirstRun(store, pin);
    setFirstRun(false);
  };

  const logout = async () => {
    if (user) {
      try {
        await api.logout(user._id);
      } catch {
        /* ignore */
      }
    }
    clearSession();
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value = useMemo(
    () => ({
      ready,
      user,
      token,
      apiInfo,
      serverError,
      firstRun,
      login,
      loginByPin,
      completeFirstRun,
      logout,
      refreshApiInfo,
      hasRole,
    }),
    [ready, user, token, apiInfo, serverError, firstRun]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
