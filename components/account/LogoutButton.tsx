'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return <button type="button" className="account-setting-row account-logout" onClick={logout} disabled={loading}><span className="account-setting-icon" aria-hidden="true">↪</span><span><strong>{loading ? 'Signing Out…' : 'Log Out'}</strong><small>Sign out of your account</small></span><span aria-hidden="true">›</span></button>
}
