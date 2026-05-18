'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const pathname = usePathname()
  const insideDashboard = pathname.startsWith('/dashboard')

  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function checkUser() {
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

  return (
    <div className="dashboard-menu">
      <details>
        <summary>◌</summary>

        <div className="dashboard-dropdown">
          {insideDashboard ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/dashboard/program">Program</Link>
              <Link href="/dashboard/nutrition">Nutrition</Link>
              <Link href="/dashboard/assessment/start">Assessments</Link>

              <button
                type="button"
                onClick={handleLogout}
                className="dashboard-logout"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/">Home</Link>
              <Link href="/about">About</Link>
              <Link href="/why">Why</Link>
              <Link href="/program">Programs</Link>
              <Link href="/apply">Apply</Link>

              {loggedIn ? (
                <Link href="/dashboard">Dashboard</Link>
              ) : (
                <Link href="/login">Login</Link>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  )
}
