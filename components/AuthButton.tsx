'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const pathname = usePathname()
  const insideDashboard = pathname.startsWith('/dashboard')

  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      setLoggedIn(!!session)
      setLoading(false)
    }

    checkUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return null

  return (
    <div className="dashboard-menu">
      <details>
        <summary aria-label="Open navigation menu">
  {insideDashboard ? (
    <img
      src="/Logo.png"
      alt="Menu"
      style={{
        width: '22px',
        height: '22px',
        objectFit: 'contain',
        opacity: 0.92,
        filter: 'drop-shadow(0 0 12px rgba(181,110,67,0.18))',
      }}
    />
  ) : (
    <span
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        background: 'rgba(181,110,67,0.88)',
        display: 'block',
        boxShadow: '0 0 14px rgba(181,110,67,0.22)',
      }}
    />
  )}
</summary>

        <div className="dashboard-dropdown">
          {loggedIn && insideDashboard ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/dashboard/program">Program</Link>
              <Link href="/dashboard/nutrition">Nutrition</Link>
              <Link href="/dashboard/assessment/start">Assessment</Link>
              <Link href="/program">Explore Programs</Link>
              <Link href="/about">About</Link>
              <Link href="/why">Why</Link>

              <button
                type="button"
                onClick={handleLogout}
                className="dashboard-logout"
              >
                Logout
              </button>
            </>
          ) : loggedIn ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/dashboard/program">Program</Link>
              <Link href="/dashboard/nutrition">Nutrition</Link>
              <Link href="/program">Explore Programs</Link>
              <Link href="/about">About</Link>
              <Link href="/why">Why</Link>
              <Link href="/apply">Apply</Link>

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
              <Link href="/login">Login</Link>
            </>
          )}
        </div>
      </details>
    </div>
  )
}
