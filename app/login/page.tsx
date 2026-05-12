'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as styles from '../styles/globalstyles'
import { createClient } from '../../lib/supabase/client'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirect =
    searchParams.get('redirect') ||
    '/dashboard'

  const emailFromUrl =
    searchParams.get('email') || ''

  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      router.push(redirect)
      router.refresh()
    } catch {
      setMessage('Unable to login.')
      setLoading(false)
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>
          Client Login
        </p>

        <h1 style={styles.heroTitleStyle}>
          Welcome back.
        </h1>

        <p style={styles.heroTextStyle}>
          Login to access your dashboard,
          assessment, program updates,
          and progress tracking.
        </p>

        <section style={styles.cartBoxStyle}>
          <form onSubmit={handleLogin}>
            <label style={styles.bodyStyle}>
              Email Address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              style={styles.inputStyle}
            />

            <label style={styles.bodyStyle}>
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              style={styles.inputStyle}
            />

            <div style={styles.buttonRowStyle}>
              <button
                type="submit"
                disabled={loading}
                style={styles.primaryButtonStyle}
              >
                {loading
                  ? 'Logging In...'
                  : 'Login'}
              </button>
            </div>

            {message && (
              <p style={styles.bodyStyle}>
                {message}
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
