"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "approver" | "viewer";

interface CurrentUser {
  username: string;
  name: string;
  email: string;
  role: UserRole;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true });

function decodeTokenUser(token: string): CurrentUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.sub || !payload.role) return null;
    return {
      username: payload.sub,
      name: payload.name ?? payload.sub,
      email: payload.email ?? "",
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      localStorage.getItem("stratiq_token") ??
      document.cookie.match(/(?:^|; )stratiq_token=([^;]*)/)?.[1] ??
      null;
    setUser(token ? decodeTokenUser(token) : null);
    setLoading(false);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}

/** Returns true if the current user has at least one of the given roles. */
export function useHasRole(...roles: UserRole[]) {
  const { user } = useCurrentUser();
  return user ? roles.includes(user.role) : false;
}
