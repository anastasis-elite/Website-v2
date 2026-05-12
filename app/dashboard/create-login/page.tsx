'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

function CreateLoginContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || ''
  const emailFromUrl = searchParams.get('email') || ''
  const clientId = searchParams.get('client_id') || ''

  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreateLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Unable to create login.')
        setLoading(false)
        return
      }

      window.location.href = `/dashboard/assessment/start?program=${encodeURIComponent(
        program
      )}&client_id=${encodeURIComponent(clientId)}&email=${encodeURIComponent(email)}`
    } catch (error) {
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
          This protects your assessment, program, progress, and dashboard access.
        </p>

        <section style={styles.cartBoxStyle}>
          <form onSubmit={handleCreateLogin}>
            <label style={styles.bodyStyle}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              style={styles.inputStyle}
            />

            <label style={styles.bodyStyle}>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                {loading ? 'Creating Login...' : 'Create Login'}
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
