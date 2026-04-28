'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import * as styles from '../../../styles/globalstyles'

export default function Start2Content() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || ''
  const email = searchParams.get('email') || ''
  const fullName = searchParams.get('fullName') || ''

  const [formData, setFormData] = useState({
    program,
    email,
    fullName,
    birthdate: '',
    height_in: '',
    weight: '',
    weight_goal: '',
    training_environment: '',
    shoulder_press_weight: '',
    shoulder_press_reps: '',
    squat_weight: '',
    squat_reps: '',
    bench_press_weight: '',
    bench_press_reps: '',
    close_grip_press_weight: '',
    close_grip_press_reps: '',
    romanian_deadlift_weight: '',
    romanian_deadlift_reps: '',
    seated_row_weight: '',
    seated_row_reps: '',
    bicep_curl_weight: '',
    bicep_curl_reps: '',
    lateral_raise_weight: '',
    lateral_raise_reps: '',
    plank_time: '',
  })

  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const res = await fetch('/api/assessment-strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'dashboard-assessment-strength',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Assessment 2 submission failed')
      }

      if (data.redirect) {
        window.location.href = data.redirect
        return
      }

      window.location.href = `/dashboard/program/${formData.program}/plan?email=${encodeURIComponent(
        formData.email
      )}`
    } catch (error) {
      console.error('ASSESSMENT 2 ERROR:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <h1 style={styles.heroTitleStyle}>Let’s measure your current capacity.</h1>

        <form onSubmit={handleSubmit} style={styles.cartBoxStyle}>
          <input type="hidden" name="email" value={formData.email} readOnly />
          <input type="hidden" name="program" value={formData.program} readOnly />
          <input type="hidden" name="fullName" value={formData.fullName} readOnly />

          <p style={styles.bodyStyle}>{formData.fullName}</p>
          <p style={styles.bodyStyle}>{formData.email}</p>

          <div style={styles.fieldWrap}>
            <input name="birthdate" type="date" onChange={handleChange} style={styles.inputStyle} />
            <input name="height_in" placeholder="Height (inches)" onChange={handleChange} style={styles.inputStyle} />
            <input name="weight" placeholder="Current Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="weight_goal" placeholder="Weight Goal" onChange={handleChange} style={styles.inputStyle} />

            <select name="training_environment" onChange={handleChange} style={styles.inputStyle}>
              <option value="">Environment</option>
              <option value="gym">Gym</option>
              <option value="home">Home</option>
            </select>

            <h3 style={styles.sectionTitleStyle}>Upper Body</h3>

            <input name="shoulder_press_weight" placeholder="Shoulder Press Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="shoulder_press_reps" placeholder="Shoulder Press Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="bench_press_weight" placeholder="Bench Press Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="bench_press_reps" placeholder="Bench Press Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="close_grip_press_weight" placeholder="Close Grip Press Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="close_grip_press_reps" placeholder="Close Grip Press Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="seated_row_weight" placeholder="Seated Row Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="seated_row_reps" placeholder="Seated Row Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="bicep_curl_weight" placeholder="Bicep Curl Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="bicep_curl_reps" placeholder="Bicep Curl Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="lateral_raise_weight" placeholder="Lateral Raise Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="lateral_raise_reps" placeholder="Lateral Raise Reps" onChange={handleChange} style={styles.inputStyle} />

            <h3 style={styles.sectionTitleStyle}>Lower Body</h3>

            <input name="squat_weight" placeholder="Squat Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="squat_reps" placeholder="Squat Reps" onChange={handleChange} style={styles.inputStyle} />

            <input name="romanian_deadlift_weight" placeholder="Romanian Deadlift Weight" onChange={handleChange} style={styles.inputStyle} />
            <input name="romanian_deadlift_reps" placeholder="Romanian Deadlift Reps" onChange={handleChange} style={styles.inputStyle} />

            <h3 style={styles.sectionTitleStyle}>Core</h3>

            <input name="plank_time" placeholder="Plank Time (seconds)" onChange={handleChange} style={styles.inputStyle} />
          </div>

          <div style={styles.buttonRowStyle}>
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={styles.primaryButtonStyle}
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit Assessment'}
            </button>
          </div>

          {message ? (
            <p style={{ ...styles.bodyStyle, color: '#ffb4b4', marginBottom: 0 }}>
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  )
}  
