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
    knowsLastSixCycles: false,
    cycleStart1: '',
    cycleStart2: '',
    cycleStart3: '',
    cycleStart4: '',
    cycleStart5: '',
    cycleStart6: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
  setFormData((prev) => ({
    ...prev,
    [e.target.name]: e.target.checked,
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

        <div style={{ display: 'grid', gap: 8 }}>
  <label style={styles.labelStyle}>
    Cycle status over the last 6 months
  </label>

  <p style={{ ...styles.bodyStyle, margin: 0, opacity: 0.78 }}>
    This helps us understand whether your cycle is predictable, irregular,
    absent, changing, heavier, lighter, more painful, or affected by postpartum,
    perimenopause, menopause, stress, medication, or other life changes.
  </p>

  <textarea
    name="sixMonthCycleStatus"
    placeholder="Example: My cycles have been regular, around 28–30 days. Or: They have been irregular and harder to predict."
    value={formData.sixMonthCycleStatus}
    onChange={handleChange}
    style={styles.inputStyle}
  />
</div>

<label
  style={{
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    color: '#d7c7b6',
    lineHeight: 1.5,
  }}
>
  <input
    type="checkbox"
    name="knowsLastSixCycles"
    checked={formData.knowsLastSixCycles}
    onChange={handleCheckboxChange}
    style={{ marginTop: 4 }}
  />

  <span>
    I know the start dates of my last six cycles.
    <br />
    <small style={{ opacity: 0.72 }}>
      If you know them, this helps the system calculate your real cycle average
      instead of relying on a default estimate.
    </small>
  </span>
</label>

{formData.knowsLastSixCycles && (
  <div style={{ display: 'grid', gap: 14 }}>
    <p style={{ ...styles.bodyStyle, margin: 0, opacity: 0.78 }}>
      Enter the first day of bleeding for each of your last six cycles, starting
      with the most recent.
    </p>

    <input
      name="cycleStart1"
      type="date"
      value={formData.cycleStart1}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />

    <input
      name="cycleStart2"
      type="date"
      value={formData.cycleStart2}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />

    <input
      name="cycleStart3"
      type="date"
      value={formData.cycleStart3}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />

    <input
      name="cycleStart4"
      type="date"
      value={formData.cycleStart4}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />

    <input
      name="cycleStart5"
      type="date"
      value={formData.cycleStart5}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />

    <input
      name="cycleStart6"
      type="date"
      value={formData.cycleStart6}
      onChange={handleChange}
      style={styles.inputStyle}
      required={formData.knowsLastSixCycles}
    />
  </div>
)}

<div style={{ display: 'grid', gap: 8 }}>
  <label style={styles.labelStyle}>
    Last period start date
  </label>

  <p style={{ ...styles.bodyStyle, margin: 0, opacity: 0.78 }}>
    This should be the first day of your most recent period. If you entered your
    last six cycle dates above, this should match the most recent one.
  </p>

  <input
    name="lastPeriodStart"
    type="date"
    value={formData.lastPeriodStart}
    onChange={handleChange}
    style={styles.inputStyle}
  />
</div>

<div style={{ display: 'grid', gap: 8 }}>
  <label style={styles.labelStyle}>
    Average cycle length
  </label>

  <p style={{ ...styles.bodyStyle, margin: 0, opacity: 0.78 }}>
    The default is 28 days because that is a common estimate. If your cycle is
    usually shorter or longer, enter your real average so your cycle-aware
    recommendations are more accurate.
  </p>

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
