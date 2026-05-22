'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const pathname = usePathname()
  const insideDashboard = pathname.startsWith('/dashboard')

  const menuRef = useRef<HTMLDivElement | null>(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function closeMenu() {
    setOpen(false)
  }

  if (loading) return null

  return (
    <div className="dashboard-menu" ref={menuRef}>
      <button
        type="button"
        className="dashboard-menu-trigger"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {insideDashboard ? (
          <img
            src="/Logo.png"
            alt=""
            className="dashboard-menu-logo"
          />
        ) : (
          <span className="dashboard-menu-dot" />
        )}
      </button>

      {open ? (
        <nav className="dashboard-dropdown" aria-label="Main navigation">
          {loggedIn && insideDashboard ? (
            <>
              <Link href="/dashboard" onClick={closeMenu}>Dashboard</Link>
              <Link href="/dashboard/program" onClick={closeMenu}>Program</Link>
              <Link href="/dashboard/nutrition" onClick={closeMenu}>Nutrition</Link>
              <Link href="/dashboard/cycle" onClick={closeMenu}>Cycle</Link>
              <Link href="/dashboard/assessment/daily-structure" onClick={closeMenu}>Daily Structure</Link>
              <Link href="/program" onClick={closeMenu}>Explore Programs</Link>
              <Link href="/about" onClick={closeMenu}>About</Link>
              <Link href="/why" onClick={closeMenu}>Why</Link>

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
              <Link href="/dashboard" onClick={closeMenu}>Dashboard</Link>
              <Link href="/dashboard/program" onClick={closeMenu}>Program</Link>
              <Link href="/dashboard/nutrition" onClick={closeMenu}>Nutrition</Link>
              <Link href="/program" onClick={closeMenu}>Explore Programs</Link>
              <Link href="/about" onClick={closeMenu}>About</Link>
              <Link href="/why" onClick={closeMenu}>Why</Link>
              <Link href="/apply" onClick={closeMenu}>Apply</Link>

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
              <Link href="/" onClick={closeMenu}>Home</Link>
              <Link href="/about" onClick={closeMenu}>About</Link>
              <Link href="/why" onClick={closeMenu}>Why</Link>
              <Link href="/program" onClick={closeMenu}>Programs</Link>
              <Link href="/apply" onClick={closeMenu}>Apply</Link>
              <Link href="/login" onClick={closeMenu}>Login</Link>
            </>
          )}
        </nav>
      ) : null}
    </div>
  )
}
