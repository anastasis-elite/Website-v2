'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import * as styles from '../../styles/globalstyles'

export default function DashboardSignupPage() {
  const searchParams = useSearchParams()
  const program = searchParams.get('program') || ''

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    program,
  })

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const res = await fetch('/api/dashboard-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'dashboard-signup',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Dashboard setup failed')
      }

      setStatus('success')
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('DASHBOARD SIGNUP ERROR:', error)
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Dashboard Setup</p>

        <h1 style={styles.heroTitleStyle}>
          Create your access point.
        </h1>

        <p style={styles.heroTextStyle}>
          This is where your program begins to become personal. Set up your dashboard
          so your assessment and execution plan can be built around you.
        </p>

        <form onSubmit={handleSubmit} style={styles.cartBoxStyle}>
          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="fullName">
              Full Name
            </label>

            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={formData.fullName}
              onChange={handleChange}
              style={styles.inputStyle}
            />
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              style={styles.inputStyle}
            />
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="program">
              Program
            </label>

            <select
              id="program"
              name="program"
              required
              value={formData.program}
              onChange={handleChange}
              style={styles.inputStyle}
            >
              <option value="">Select program</option>
              <option value="ember">Ember</option>
              <option value="ignite">Ignite</option>
              <option value="phoenix">Phoenix</option>
            </select>
          </div>

          <div style={styles.buttonRowStyle}>
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={styles.primaryButtonStyle}
            >
              {status === 'submitting' ? 'Setting up...' : 'Continue to Dashboard'}
            </button>
          </div>

          {message ? (
            <p
              style={{
                ...styles.bodyStyle,
                color: status === 'success' ? '#c58b57' : '#ffb4b4',
                marginBottom: 0,
              }}
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  )
}
