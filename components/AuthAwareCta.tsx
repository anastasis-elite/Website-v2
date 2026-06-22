'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'
import Button from './Button'

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
  <Button href="/dashboard">
    Continue Your Program
  </Button>
) : (
  <Button href="/audit">
    Apply Now
  </Button>
)
}
