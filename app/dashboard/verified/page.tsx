'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

export default function CreateLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const emailFromUrl = searchParams.get('email') || ''
  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''
  const birthdate = searchParams.get('birthdate') || ''

  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/create-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          client_id: clientId,
          birthdate,
          program,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create account')
      }

      router.push(
        `/dashboard/assessment/start?program=${program}&client_id=${clientId}`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Secure Account Setup</p>

        <h1 style={styles.heroTitleStyle}>
          Create your login.
        </h1>

        <p style={styles.heroTextStyle}>
          Your dashboard, assessment progress, program updates,
          and future check-ins will stay connected to this account.
        </p>

        <section style={styles.cartBoxStyle}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label>Email Address</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.inputStyle}
              />

              <p style={{ opacity: 0.7, marginTop: '8px' }}>
                We recommend using the same email used during checkout.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Password</label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.inputStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Confirm Password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={styles.inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: '#ff8080', marginBottom: '20px' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={styles.primaryButtonStyle}
            >
              {loading ? 'Creating Account...' : 'Continue'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
