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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const res = await fetch('/api/assessment-strength', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()

    if (data.redirect) {
      window.location.href = data.redirect
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <h1 style={styles.heroTitleStyle}>
          Let’s measure your current capacity.
        </h1>

        <form onSubmit={handleSubmit} style={styles.cartBoxStyle}>

          {/* Hidden identity fields */}
          <input type="hidden" name="email" value={formData.email} />
          <input type="hidden" name="program" value={formData.program} />

          {/* Display only */}
          <p style={styles.bodyStyle}>{formData.fullName}</p>
          <p style={styles.bodyStyle}>{formData.email}</p>

          {/* Body Metrics */}
          <input name="birthdate" type="date" onChange={handleChange} placeholder="Birthdate" style={styles.inputStyle} />
          <input name="height_in" placeholder="Height (inches)" onChange={handleChange} style={styles.inputStyle} />
          <input name="weight" placeholder="Current Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="weight_goal" placeholder="Weight Goal" onChange={handleChange} style={styles.inputStyle} />

          <select name="training_environment" onChange={handleChange} style={styles.inputStyle}>
            <option value="">Environment</option>
            <option value="gym">Gym</option>
            <option value="home">Home</option>
          </select>

          {/* Strength Inputs */}
          <h3>Upper Body</h3>

          <input name="shoulder_press_weight" placeholder="Shoulder Press Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="shoulder_press_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="bench_press_weight" placeholder="Bench Press Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="bench_press_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="close_grip_press_weight" placeholder="Close Grip Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="close_grip_press_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="seated_row_weight" placeholder="Row Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="seated_row_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="bicep_curl_weight" placeholder="Curl Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="bicep_curl_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="lateral_raise_weight" placeholder="Lateral Raise Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="lateral_raise_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <h3>Lower Body</h3>

          <input name="squat_weight" placeholder="Squat Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="squat_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <input name="romanian_deadlift_weight" placeholder="RDL Weight" onChange={handleChange} style={styles.inputStyle} />
          <input name="romanian_deadlift_reps" placeholder="Reps" onChange={handleChange} style={styles.inputStyle} />

          <h3>Core</h3>

          <input name="plank_time" placeholder="Plank Time (seconds)" onChange={handleChange} style={styles.inputStyle} />

          <button type="submit" style={styles.primaryButtonStyle}>
            Submit Assessment
          </button>
        </form>
      </div>
    </main>
  )
}
