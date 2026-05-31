'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

export default function GiftClientPage() {
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    adminSecret: '',
    fullName: '',
    email: '',
    phone: '',
    program: 'ignite',
    durationMonths: '12',
    temporaryPassword: '',
  })

  const [responseMessage, setResponseMessage] = useState('')
  const [createLoginLink, setCreateLoginLink] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setResponseMessage('')
    setCreateLoginLink('')

    try {
      const res = await fetch('/api/admin/gift-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Gift client failed')
      }

      setResponseMessage('Gifted client created successfully.')

      if (data?.createLoginLink) {
        setCreateLoginLink(data.createLoginLink)
      }
    } catch (error) {
      setResponseMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Admin Access</p>

        <h1 style={styles.heroTitleStyle}>
          Gift Client Access
        </h1>

        <p style={styles.heroTextStyle}>
          Create a gifted client account without Stripe checkout.
        </p>

        <form
          onSubmit={handleSubmit}
          style={styles.cartBoxStyle}
        >
          <div
  style={{
    display: 'grid',
    gap: 16,
    width: '100%',
  }}
>
            <input
              type="password"
              name="adminSecret"
              placeholder="Admin Secret"
              value={formData.adminSecret}
              onChange={handleChange}
              required
              style={{
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'white',
}}
            />

            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleChange}
              required
              style={{
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'white',
}}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'white',
}}
            />

            <input
  type="text"
  name="temporaryPassword"
  placeholder="Temporary Password"
  value={formData.temporaryPassword}
  onChange={handleChange}
  required
  style={{
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'white',
  }}
/>
            <input
              type="text"
              name="phone"
              placeholder="Phone"
              value={formData.phone}
              onChange={handleChange}
              style={{
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'white',
}}
            />

            <select
              name="program"
              value={formData.program}
              onChange={handleChange}
              style={{
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'white',
}}
            >
              <option value="ember">Ember</option>
              <option value="ignite">Ignite</option>
              <option value="phoenix">Phoenix</option>
            </select>

            <select
              name="durationMonths"
              value={formData.durationMonths}
              onChange={handleChange}
              style={styles.inputStyle}
            >
              <option value="1">1 Month</option>
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={styles.primaryButtonStyle}
          >
            {loading ? 'Creating Gift Access...' : 'Create Gift Access'}
          </button>

          {responseMessage ? (
            <p style={styles.bodyStyle}>
              {responseMessage}
            </p>
          ) : null}

          {createLoginLink ? (
            <div style={{ marginTop: 20 }}>
              <a
                href={createLoginLink}
                style={styles.primaryButtonStyle}
              >
                Open Create Login
              </a>
            </div>
          ) : null}
        </form>
      </div>
    </main>
  )
}
