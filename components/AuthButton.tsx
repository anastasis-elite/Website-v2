'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setLoggedIn(!!session)
    }

    checkUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loggedIn) {
    return (
      <button onClick={handleLogout} className="button secondary">
        Logout
      </button>
    )
  }

  return (
    <Link href="/login" className="button secondary">
      Login
    </Link>
  )
}
