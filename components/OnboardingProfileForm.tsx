'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'

export default function OnboardingProfileForm({ client }: { client: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [formData, setFormData] = useState({
    birthdate: client.birthdate || '',
    addressLine1: client.address_line_1 || '',
    addressLine2: client.address_line_2 || '',
    city: client.city || '',
    state: client.state || '',
    postalCode: client.postal_code || '',
    country: client.country || 'US',
    reproductiveStatus: client.reproductive_status || 'cycling',
    sixMonthCycleStatus: client.six_month_cycle_status || '',
    lastPeriodStart: client.last_period_start || '',
    averageCycleLength: String(client.average_cycle_length || 28),
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Profile update failed')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.cartBoxStyle}>
      <div style={{ display: 'grid', gap: 16 }}>
        <input
          name="birthdate"
          type="date"
          required
          value={formData.birthdate}
          onChange={handleChange}
          style={styles.inputStyle}
        />

        <input
          name="addressLine1"
          placeholder="Address Line 1"
          required
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
          required
          value={formData.city}
          onChange={handleChange}
          style={styles.inputStyle}
        />

        <input
          name="state"
          placeholder="State"
          required
          value={formData.state}
          onChange={handleChange}
          style={styles.inputStyle}
        />

        <input
          name="postalCode"
          placeholder="ZIP / Postal Code"
          required
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

        <textarea
          name="sixMonthCycleStatus"
          placeholder="Over the last 6 months, have your cycles been regular, irregular, absent, heavier, lighter, painful, or changing?"
          value={formData.sixMonthCycleStatus}
          onChange={handleChange}
          style={styles.inputStyle}
        />

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
        {loading ? 'Saving...' : 'Complete Profile'}
      </button>

      {message ? <p style={styles.bodyStyle}>{message}</p> : null}
    </form>
  )
}
