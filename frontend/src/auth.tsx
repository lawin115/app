import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, User, Role } from "./api";
import { tokenStore } from "./token-store";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: { email: string; password: string; name: string; role: Role; admin_code?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.me();
      setUser(me);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const resp = await api.login({ email, password });
    await tokenStore.set(resp.access_token);
    setUser(resp.user);
    return resp.user;
  };

  const register = async (body: { email: string; password: string; name: string; role: Role; admin_code?: string }) => {
    const resp = await api.register(body);
    await tokenStore.set(resp.access_token);
    setUser(resp.user);
    return resp.user;
  };

  const logout = async () => {
    await tokenStore.clear();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      await tokenStore.clear();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
