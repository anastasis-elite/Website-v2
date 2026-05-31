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
    primaryGoal: client.onboarding_data?.primaryGoal || '',
    whyNow: client.onboarding_data?.whyNow || '',
    currentStruggle: client.onboarding_data?.currentStruggle || '',
    trainingHistory: client.onboarding_data?.trainingHistory || '',
    nutritionHistory: client.onboarding_data?.nutritionHistory || '',
    injuriesOrLimitations: client.onboarding_data?.injuriesOrLimitations || '',
    preferredSupport: client.onboarding_data?.preferredSupport || '',
    readinessLevel: client.onboarding_data?.readinessLevel || '',
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
        <div style={{ display: 'grid', gap: 16 }}>
  <label style={styles.labelStyle}>
    What are you hoping to change most right now?
  </label>
  <textarea
    name="primaryGoal"
    value={formData.primaryGoal}
    onChange={handleChange}
    required
    style={styles.inputStyle}
    placeholder="Tell us what you most want support with."
  />

  <label style={styles.labelStyle}>
    Why are you looking for support now?
  </label>
  <textarea
    name="whyNow"
    value={formData.whyNow}
    onChange={handleChange}
    required
    style={styles.inputStyle}
    placeholder="What made this feel important now?"
  />

  <label style={styles.labelStyle}>
    What feels hardest right now?
  </label>
  <textarea
    name="currentStruggle"
    value={formData.currentStruggle}
    onChange={handleChange}
    style={styles.inputStyle}
    placeholder="Energy, consistency, food, workouts, confidence, stress, symptoms, etc."
  />

  <label style={styles.labelStyle}>
    Training history
  </label>
  <textarea
    name="trainingHistory"
    value={formData.trainingHistory}
    onChange={handleChange}
    style={styles.inputStyle}
    placeholder="Tell us what your training has looked like recently."
  />

  <label style={styles.labelStyle}>
    Nutrition history
  </label>
  <textarea
    name="nutritionHistory"
    value={formData.nutritionHistory}
    onChange={handleChange}
    style={styles.inputStyle}
    placeholder="Tell us what your nutrition has looked like recently."
  />

  <label style={styles.labelStyle}>
    Injuries, limitations, or medical considerations
  </label>
  <textarea
    name="injuriesOrLimitations"
    value={formData.injuriesOrLimitations}
    onChange={handleChange}
    style={styles.inputStyle}
    placeholder="Include anything that may affect exercise, nutrition, recovery, or cycle tracking."
  />

  <label style={styles.labelStyle}>
    What kind of support helps you most?
  </label>
  <select
    name="preferredSupport"
    value={formData.preferredSupport}
    onChange={handleChange}
    style={styles.inputStyle}
  >
    <option value="">Select one</option>
    <option value="gentle_accountability">Gentle accountability</option>
    <option value="direct_structure">Direct structure</option>
    <option value="high_accountability">High accountability</option>
    <option value="education_first">Education first</option>
    <option value="emotional_support">Emotional support</option>
    <option value="not_sure">Not sure yet</option>
  </select>

  <label style={styles.labelStyle}>
    How ready do you feel to begin?
  </label>
  <select
    name="readinessLevel"
    value={formData.readinessLevel}
    onChange={handleChange}
    required
    style={styles.inputStyle}
  >
    <option value="">Select one</option>
    <option value="curious">Curious, but nervous</option>
    <option value="ready">Ready to begin</option>
    <option value="very_ready">Very ready</option>
    <option value="all_in">All in</option>
  </select>
</div>
        
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
