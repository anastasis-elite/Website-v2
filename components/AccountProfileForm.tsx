'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import type { AccountProfileFormData } from '@/lib/dashboard/account/types'

export default function AccountProfileForm({
  client,
  user,
  mode = 'all',
}: {
  client: AccountProfileFormData
  user: { email: string | null }
  mode?: 'all' | 'profile' | 'security'
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
    injuries: client.injuries.join(', '),
    limitations: client.limitations.join(', '),
    equipmentAccess: client.equipment_access.join(', '),
    currentWeight: client.current_weight ? String(client.current_weight) : '',
    primaryGoal: client.primary_goal || '',
    workoutDaysAvailable: client.workout_days_available ? String(client.workout_days_available) : '',
    workoutMinutesAvailable: client.current_workout_minutes_per_session ? String(client.current_workout_minutes_per_session) : '',
    confirmGoalChange: false,
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

  function handleProfileCheckbox(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.checked }))
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
      {mode === 'all' ? <section style={styles.cartBoxStyle}>
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
      </section> : null}

      {mode !== 'security' ? <form onSubmit={saveProfile} style={styles.cartBoxStyle}>
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

          <label style={styles.labelStyle}>Current injuries or pain limitations
            <input name="injuries" value={formData.injuries} onChange={handleChange} placeholder="Separate multiple items with commas" style={styles.inputStyle} />
          </label>
          <label style={styles.labelStyle}>Other movement limitations
            <input name="limitations" value={formData.limitations} onChange={handleChange} placeholder="Separate multiple items with commas" style={styles.inputStyle} />
          </label>
          <label style={styles.labelStyle}>Equipment currently available
            <input name="equipmentAccess" value={formData.equipmentAccess} onChange={handleChange} placeholder="Dumbbells, bands, full gym…" style={styles.inputStyle} />
          </label>
          <label style={styles.labelStyle}>Current weight
            <input name="currentWeight" type="number" min="50" max="700" step="0.1" value={formData.currentWeight} onChange={handleChange} style={styles.inputStyle} />
          </label>
          <label style={styles.labelStyle}>Current primary goal
            <select name="primaryGoal" value={formData.primaryGoal} onChange={handleChange} style={styles.inputStyle}>
              <option value="">Select a goal</option><option value="fat_loss">Fat loss</option><option value="muscle_gain">Muscle gain</option><option value="strength">Strength</option><option value="recomposition">Recomposition</option><option value="endurance">Endurance</option><option value="general_capacity">General capacity</option>
            </select>
          </label>
          {formData.primaryGoal !== (client.primary_goal || '') ? <label style={{ ...styles.bodyStyle, display: 'flex', gap: 10 }}><input type="checkbox" name="confirmGoalChange" checked={formData.confirmGoalChange} onChange={handleProfileCheckbox} /> I understand this changes future recommendations and want to update my primary goal.</label> : null}
          <label style={styles.labelStyle}>Workout days available per week
            <input name="workoutDaysAvailable" type="number" min="0" max="7" value={formData.workoutDaysAvailable} onChange={handleChange} style={styles.inputStyle} />
          </label>
          <label style={styles.labelStyle}>Minutes available per workout
            <input name="workoutMinutesAvailable" type="number" min="5" max="300" value={formData.workoutMinutesAvailable} onChange={handleChange} style={styles.inputStyle} />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.primaryButtonStyle, marginTop: 24 }}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>

        {message ? <p style={styles.bodyStyle}>{message}</p> : null}
      </form> : null}

      {mode !== 'profile' ? <form onSubmit={changePassword} style={styles.cartBoxStyle}>
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
      </form> : null}

      {mode === 'all' ? <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Uploads</p>

        <h2 style={styles.sectionTitleStyle}>Progress uploads coming next.</h2>

        <p style={styles.bodyStyle}>
          This section will hold progress photos, assessment uploads, and other
          private client files once upload storage is connected.
        </p>
      </section> : null}
    </div>
  )
}
