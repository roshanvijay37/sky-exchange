"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  username: string;
  balance: number;
  token: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sky_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const save = (u: User) => {
    setUser(u);
    localStorage.setItem("sky_user", JSON.stringify(u));
  };

  const authCall = async (endpoint: string, username: string, password: string) => {
    const res = await fetch(`${API}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    save({ id: data.id, username: data.username, balance: data.balance, token: data.token, isAdmin: data.isAdmin });
  };

  const login = (u: string, p: string) => authCall("login", u, p);
  const register = (u: string, p: string) => authCall("register", u, p);
  const logout = () => { setUser(null); localStorage.removeItem("sky_user"); };

  const refreshBalance = async () => {
    if (!user) return;
    const res = await fetch(`${API}/user/me`, { headers: { Authorization: `Bearer ${user.token}` } });
    if (!res.ok) return;
    const data = await res.json();
    save({ ...user, balance: data.balance });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshBalance }}>
      {children}
    </AuthContext.Provider>
  );
}
