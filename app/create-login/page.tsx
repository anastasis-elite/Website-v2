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
  console.log('CREATE LOGIN PARAMS:', Object.fromEntries(searchParams.entries()))
console.log('CLIENT ID:', clientId)
  const birthdate = searchParams.get('birthdate') || ''
  const applicationEmail = searchParams.get('email') || ''

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
          birthdate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Unable to create login.')
        setLoading(false)
        return
      }

      router.push(
  `/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(
    `/dashboard/assessment/start?program=${program}&client_id=${clientId}&birthdate=${birthdate}`
  )}`
)
    } catch {
      setMessage('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Private Client Access</p>

        <h1 style={styles.heroTitleStyle}>Create your login.</h1>

        <p style={styles.heroTextStyle}>
          This login protects your assessment, program, dashboard, and future
          progress updates.
        </p>

        <section style={styles.cartBoxStyle}>
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
              We recommend using the same email address from your application so
              your payment, dashboard, and assessment stay connected.
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
        </section>
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
