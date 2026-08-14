import { router, usePathname } from 'expo-router'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './supabase'

const publicRoutes = new Set(['/login'])

export function useProtectedSession() {
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function restore() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(currentSession)
      setLoading(false)

      if (!currentSession && !publicRoutes.has(pathname)) {
        router.replace('/login')
      }
    }

    restore()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)
      setLoading(false)

      if (!nextSession && !publicRoutes.has(pathname)) {
        router.replace('/login')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [pathname])

  return { session, loading }
}
