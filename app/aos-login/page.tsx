'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import * as styles from '@/app/styles/globalstyles'

export default function AOSLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('anastasis.elite@gmail.com')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage('Missing Supabase public environment variables.')
      setLoading(false)
      return
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setMessage('Login succeeded, but no user session was found.')
      setLoading(false)
      return
    }

    router.replace('/aos')
    router.refresh()
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Anastasis Operating System</p>

        <h1 style={styles.heroTitleStyle}>AOS Login</h1>

        <p style={styles.heroTextStyle}>
          Internal access for Anastasis operations.
        </p>

        <section style={styles.cartBoxStyle}>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '18px' }}>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.inputStyle}
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.primaryButtonStyle,
                opacity: loading ? 0.65 : 1,
              }}
            >
              {loading ? 'Opening AOS...' : 'Enter AOS'}
            </button>

            {message ? <p style={styles.bodyStyle}>{message}</p> : null}
          </form>
        </section>
      </div>
    </main>
  )
}
