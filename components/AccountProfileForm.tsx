'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

export default function AccountProfileForm({
  client,
  user,
}: {
  client: any
  user: any
}) {
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const birthdateLocked = Boolean(client.birthdate_updated_once)

  const [formData, setFormData] = useState({
    birthdate: client.birthdate || '',
    addressLine1: client.address_line_1 || '',
    addressLine2: client.address_line_2 || '',
    city: client.city || '',
    state: client.state || '',
    postalCode: client.postal_code || '',
    country: client.country || 'US',
    reproductiveStatus: client.reproductive_status || 'cycling',
    lastPeriodStart: client.last_period_start || '',
    averageCycleLength: String(client.average_cycle_length || 28),
  })

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasswordData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Profile update failed')
      }

      setMessage('Profile updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordMessage('')

    try {
      if (passwordData.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters.')
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('Passwords do not match.')
      }

      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: passwordData.newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Password update failed')
      }

      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      })

      setPasswordMessage('Password updated.')
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : 'Something went wrong.'
      )
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Identity</p>

        <p style={styles.bodyStyle}>
          <strong>Name:</strong> {client.full_name || '—'}
        </p>

        <p style={styles.bodyStyle}>
          <strong>Email:</strong> {client.email || user.email || '—'}
        </p>

        <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
          Name and email are locked to protect your account identity.
        </p>
      </section>

      <form onSubmit={saveProfile} style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Profile</p>

        <div style={{ display: 'grid', gap: 16 }}>
          <label style={styles.labelStyle}>
            Birthdate
            <input
              name="birthdate"
              type="date"
              value={formData.birthdate}
              onChange={handleChange}
              disabled={birthdateLocked}
              style={styles.inputStyle}
            />
          </label>

          {birthdateLocked ? (
            <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
              Birthdate can only be changed once from the account page. Contact
              support if this needs correction again.
            </p>
          ) : (
            <p style={{ ...styles.bodyStyle, opacity: 0.72 }}>
              You may correct your birthdate one time here.
            </p>
          )}

          <input
            name="addressLine1"
            placeholder="Address Line 1"
            value={formData.addressLine1}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <input
            name="addressLine2"
            placeholder="Address Line 2"
            value={formData.addressLine2}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <input
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <input
            name="state"
            placeholder="State"
            value={formData.state}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <input
            name="postalCode"
            placeholder="ZIP / Postal Code"
            value={formData.postalCode}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <select
            name="reproductiveStatus"
            value={formData.reproductiveStatus}
            onChange={handleChange}
            style={styles.inputStyle}
          >
            <option value="cycling">Currently Cycling</option>
            <option value="irregular_cycles">Irregular Cycles</option>
            <option value="perimenopause">Perimenopause</option>
            <option value="menopause">Menopause</option>
            <option value="postpartum">Postpartum</option>
            <option value="pregnant">Pregnant</option>
            <option value="not_tracking">Not Tracking</option>
          </select>

          <input
            name="lastPeriodStart"
            type="date"
            value={formData.lastPeriodStart}
            onChange={handleChange}
            style={styles.inputStyle}
          />

          <input
            name="averageCycleLength"
            type="number"
            min="18"
            max="60"
            value={formData.averageCycleLength}
            onChange={handleChange}
            style={styles.inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.primaryButtonStyle, marginTop: 24 }}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>

        {message ? <p style={styles.bodyStyle}>{message}</p> : null}
      </form>

      <form onSubmit={changePassword} style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Password</p>

        <div style={{ display: 'grid', gap: 16 }}>
          <input
            name="newPassword"
            type="password"
            placeholder="New Password"
            value={passwordData.newPassword}
            onChange={handlePasswordChange}
            style={styles.inputStyle}
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm New Password"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            style={styles.inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={passwordLoading}
          style={{ ...styles.primaryButtonStyle, marginTop: 24 }}
        >
          {passwordLoading ? 'Updating...' : 'Update Password'}
        </button>

        {passwordMessage ? (
          <p style={styles.bodyStyle}>{passwordMessage}</p>
        ) : null}
      </form>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Uploads</p>

        <h2 style={styles.sectionTitleStyle}>Progress uploads coming next.</h2>

        <p style={styles.bodyStyle}>
          This section will hold progress photos, assessment uploads, and other
          private client files once upload storage is connected.
        </p>
      </section>
    </div>
  )
}
