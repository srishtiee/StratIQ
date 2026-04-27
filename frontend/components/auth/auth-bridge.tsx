'use client'

import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { useAuthStore } from '@/lib/auth/store'

/**
 * Mounts once at the root. On mount and on every Supabase auth change:
 *  1. Reads the current session.
 *  2. If signed in, looks up the user's `org_id` from `user_profiles`.
 *  3. Hydrates the Zustand auth store, which the rest of the app reads from.
 *
 * Renders nothing.
 */
export function AuthBridge() {
  const { setSession, setLoading, clear } = useAuthStore()

  useEffect(() => {
    const sb = getSupabaseBrowser()
    let mounted = true

    async function hydrate(userId: string, email: string) {
      const { data, error } = await sb
        .from('user_profiles')
        .select('id, org_id, name')
        .eq('id', userId)
        .maybeSingle()
      if (!mounted) return
      if (error || !data) {
        clear()
        return
      }
      setSession({
        userId: data.id as string,
        orgId: data.org_id as string,
        email,
        name: (data.name as string | null) ?? null,
      })
    }

    sb.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const session = res.data.session
      if (!mounted) return
      if (session?.user) {
        void hydrate(session.user.id, session.user.email ?? '')
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = sb.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!mounted) return
      if (session?.user) {
        void hydrate(session.user.id, session.user.email ?? '')
      } else {
        clear()
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [setSession, setLoading, clear])

  return null
}
