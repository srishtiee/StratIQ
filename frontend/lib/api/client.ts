import { getAuthSnapshot } from '@/lib/auth/store'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/**
 * Read the current authenticated org/user. Returns empty strings when signed out.
 * Used by non-React callers (like the SSE stream) that can't subscribe to the store.
 * React code should prefer `useAuth()` from `@/lib/auth/store`.
 */
export function getOrgId(): string {
  return getAuthSnapshot()?.orgId ?? ''
}

export function getUserId(): string {
  return getAuthSnapshot()?.userId ?? ''
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json() as T
}
