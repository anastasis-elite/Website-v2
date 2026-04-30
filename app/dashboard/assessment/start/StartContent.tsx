'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../../styles/globalstyles'

function AssessmentStartContent() {
  const searchParams = useSearchParams()
  const program = searchParams.get('program') || ''
  const clientId = searchParams.get('client_id') || ''
  
  const [formData, setFormData] = useState({
    program,
    clientId'',
    fullName: '',
    email: '',
    trainingDays: '',
    equipmentAccess: '',
    experienceLevel: '',
    primaryFocus: '',
    currentLimitations: '',
    recoveryCapacity: '',
    sleepQuality: '',
    stressLevel: '',
    cardioPreference: '',
    notes: '',
  })

  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
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
      const res = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'dashboard-assessment',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Assessment submission failed')
      }

      window.location.href = `/dashboard/assessment/start2?program=${formData.program}&clientId=${encodeURIComponent(formData.client_id)}&email=${encodeURIComponent(formData.email)}&fullName=${encodeURIComponent(formData.fullName)}`
    } catch (error) {
      console.error('ASSESSMENT ERROR:', error)
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Assessment</p>

        <h1 style={styles.heroTitleStyle}>
          Let’s build the starting point.
        </h1>

        <p style={styles.heroTextStyle}>
          This assessment gives the system the information it needs to begin shaping
          your execution plan around your body, schedule, recovery, environment, and
          current capacity.
        </p>

        <form onSubmit={handleSubmit} style={styles.cartBoxStyle}>
          <div style={styles.gridTwoCol}>
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

            <input type="hidden" name="client_id" value={formData.client_id} readOnly />
            
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

          <div style={styles.gridTwoCol}>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="trainingDays">
                How many days per week can you realistically train?
              </label>
              <select
                id="trainingDays"
                name="trainingDays"
                required
                value={formData.trainingDays}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="4">4 days</option>
                <option value="5">5 days</option>
                <option value="6">6 days</option>
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="experienceLevel">
                Training experience
              </label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                required
                value={formData.experienceLevel}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="beginner">Beginner</option>
                <option value="some-experience">Some experience</option>
                <option value="consistent">Consistent lifter</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="equipmentAccess">
              What equipment do you have access to?
            </label>
            <select
              id="equipmentAccess"
              name="equipmentAccess"
              required
              value={formData.equipmentAccess}
              onChange={handleChange}
              style={styles.inputStyle}
            >
              <option value="">Select one</option>
              <option value="commercial-gym">Commercial gym</option>
              <option value="home-gym">Home gym</option>
              <option value="dumbbells-bands">Dumbbells / bands only</option>
              <option value="bodyweight">Bodyweight only</option>
            </select>
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="primaryFocus">
              What is the main physical outcome you want this plan to support?
            </label>
            <select
              id="primaryFocus"
              name="primaryFocus"
              required
              value={formData.primaryFocus}
              onChange={handleChange}
              style={styles.inputStyle}
            >
              <option value="">Select one</option>
              <option value="recomposition">Body recomposition</option>
              <option value="fat-loss">Fat loss</option>
              <option value="muscle-building">Muscle building</option>
              <option value="strength">Strength</option>
              <option value="glutes-shape">Glutes / shape</option>
              <option value="stage-prep">Stage or transformation prep</option>
              <option value="energy-regulation">Energy, consistency, and regulation</option>
            </select>
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="currentLimitations">
              Are there any movements, injuries, pain points, or limitations we need to account for?
            </label>
            <textarea
              id="currentLimitations"
              name="currentLimitations"
              required
              value={formData.currentLimitations}
              onChange={handleChange}
              style={styles.textareaStyle}
              placeholder="Share anything relevant. If none, write none."
            />
          </div>

          <div style={styles.gridTwoCol}>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="recoveryCapacity">
                Current recovery capacity
              </label>
              <select
                id="recoveryCapacity"
                name="recoveryCapacity"
                required
                value={formData.recoveryCapacity}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="low">Low — I feel depleted often</option>
                <option value="moderate">Moderate — I can train but need balance</option>
                <option value="high">High — I recover well</option>
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="sleepQuality">
                Sleep quality
              </label>
              <select
                id="sleepQuality"
                name="sleepQuality"
                required
                value={formData.sleepQuality}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="poor">Poor</option>
                <option value="inconsistent">Inconsistent</option>
                <option value="decent">Decent</option>
                <option value="strong">Strong</option>
              </select>
            </div>
          </div>

          <div style={styles.gridTwoCol}>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="stressLevel">
                Current stress load
              </label>
              <select
                id="stressLevel"
                name="stressLevel"
                required
                value={formData.stressLevel}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="very-high">Very high</option>
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="cardioPreference">
                Cardio preference
              </label>
              <select
                id="cardioPreference"
                name="cardioPreference"
                required
                value={formData.cardioPreference}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="walking">Walking</option>
                <option value="incline-walk">Incline walk</option>
                <option value="stair-stepper">Stair stepper</option>
                <option value="bike">Bike</option>
                <option value="running">Running</option>
                <option value="minimal">Minimal cardio</option>
              </select>
            </div>
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="notes">
              Anything else you want the system to consider?
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              style={styles.textareaStyle}
              placeholder="Schedule constraints, preferences, fears, goals, or anything you want considered."
            />
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
            <p
              style={{
                ...styles.bodyStyle,
                color: '#ffb4b4',
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

export default function AssessmentStartPage() {
  return (
    <Suspense fallback={null}>
      <AssessmentStartContent />
    </Suspense>
  )
}
