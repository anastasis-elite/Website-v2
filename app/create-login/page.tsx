'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as styles from '../styles/globalstyles'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function CreateLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || ''
  const clientId =
  searchParams.get('clientId') ||
  searchParams.get('client_id') ||
  ''
  const birthdate = searchParams.get('birthdate') || ''
  const applicationEmail = searchParams.get('email') || ''
  const invitationToken = searchParams.get('token') || ''

  const [email, setEmail] = useState(applicationEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreateLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (!isValidEmail(email)) {
      setMessage('Please enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords must match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/create-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          program,
          client_id: clientId,
          token: invitationToken,
          birthdate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Login setup could not be confirmed. Use your invitation link to try again.')
        setLoading(false)
        return
      }

      router.push(`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(data.redirect||'/dashboard/onboarding/profile')}`)
    } catch {
      setMessage('Login setup could not be confirmed. Try your invitation link again, or contact support for help.')
      setLoading(false)
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Private Member Access</p>

        <h1 style={styles.heroTitleStyle}>Create your login.</h1>

        <p style={styles.heroTextStyle}>
          Choose a password for your member account. Use this login to return
          to your plan, assessments, and recorded progress.
        </p>

        {!invitationToken ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.bodyStyle}>This link is missing its invitation details. Contact Anastasis support for a complete invitation.</p>
          </section>
        ) : null}

        {invitationToken ? <section style={styles.cartBoxStyle}>
          <form onSubmit={handleCreateLogin}>
            <label style={styles.bodyStyle}>Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              style={styles.inputStyle}
            />

            <p style={styles.bodyStyle}>
              Use the email address on your invitation so this login can be
              connected to the correct member account.
            </p>

            <label style={styles.bodyStyle}>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              minLength={8}
              style={styles.inputStyle}
            />

            <label style={styles.bodyStyle}>Confirm Password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type="password"
              minLength={8}
              style={styles.inputStyle}
            />

            <div style={styles.buttonRowStyle}>
              <button
                type="submit"
                disabled={loading}
                style={styles.primaryButtonStyle}
              >
                {loading ? 'Creating Login...' : 'Continue'}
              </button>
            </div>

            {message && <p style={styles.bodyStyle}>{message}</p>}
          </form>
        </section> : null}
      </div>
    </main>
  )
}

export default function CreateLoginPage() {
  return (
    <Suspense fallback={null}>
      <CreateLoginContent />
    </Suspense>
  )
}
