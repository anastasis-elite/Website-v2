'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase/client'

export default function AuthAwareCta() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setLoggedIn(!!session)
      setLoading(false)
    }

    checkSession()
  }, [])

  if (loading) return null

  return loggedIn ? (
    <Link href="/dashboard" className="button primary">
      Continue Your Program
    </Link>
  ) : (
    <Link href="/apply" className="button primary">
      Apply Now
    </Link>
  )
}
