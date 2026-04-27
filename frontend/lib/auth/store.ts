'use client'

import { create } from 'zustand'

export type AuthSession = {
  userId: string
  orgId: string
  email: string
  name: string | null
}

type AuthState = {
  session: AuthSession | null
  loading: boolean
  setSession: (session: AuthSession | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  loading: true,
  setSession: session => set({ session, loading: false }),
  setLoading: loading => set({ loading }),
  clear: () => set({ session: null, loading: false }),
}))

/** Convenience hook that returns just the live session (or null if signed out). */
export function useAuth() {
  return useAuthStore(s => s.session)
}

/** Read the auth state synchronously from outside React (e.g. inside fetch closures). */
export function getAuthSnapshot(): AuthSession | null {
  return useAuthStore.getState().session
}
