'use client'

import { useState } from 'react'
import Link from 'next/link'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { strengthFormDefaults, strengthMovements, type StrengthFormHistory } from '@/lib/assessment/strengthForm'
import '@/components/phone-app/assessments.css'

type ClientData = {
  client_id: string
  full_name?: string
  email?: string
  birthdate?: string
  program?: string
  height_in?: number | string
}

export default function Start2Content({ client, history }: { client: ClientData; history: StrengthFormHistory }) {
  const [formData, setFormData] = useState(() => strengthFormDefaults(client, history))

  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [retrySavedPlan, setRetrySavedPlan] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
    setRetrySavedPlan(false)

    try {
      const res = await fetch('/api/assessment-strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'strength-assessment',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setRetrySavedPlan(data.baselineSaved === true && data.retryRoute === '/dashboard/onboarding/plan')
        throw new Error(data.error || 'Your strength assessment could not be confirmed.')
      }

     window.location.href = '/dashboard'
    } catch (error) {
      console.error('ASSESSMENT 2 ERROR:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Your strength assessment could not be confirmed. Review its status before submitting again.')
    }
  }

  const previous = (key: string, unit: string) => history.unavailable
    ? 'Previous results unavailable.'
    : history.values[key] !== undefined ? `Last: ${history.values[key]} ${unit}` : 'No previous result.'

  return (
    <PhoneAppFrame eyebrow="Strength Assessment" title="Strength Assessment" subtitle="Let’s measure your current capacity.">
      <main className="assessment-content">
        <p className="assessment-history">{history.completedAt
          ? `Last completed: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(history.completedAt))}`
          : history.unavailable ? 'Previous assessment could not be loaded. Your new results remain blank.' : 'Your first completed assessment will become your comparison baseline.'}</p>
        <details className="assessment-notice"><summary>About assessment timing</summary><p>Strength testing is best during your ovulatory window when possible. If you do not know your window, complete what you can. You can still continue today and update your assessment later.</p></details>
        <form onSubmit={handleSubmit} className="assessment-form">
          {['email', 'program', 'fullName', 'client_id'].map(key => <input key={key} type="hidden" name={key} value={formData[key]} readOnly />)}
          <fieldset className="assessment-section">
            <legend>Your details</legend>
            <p>{formData.fullName}<br />{formData.email}</p>
            <div className="assessment-fields">
              <label className="assessment-field" htmlFor="birthdate">Birthdate
                <input id="birthdate" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} readOnly={Boolean(client.birthdate)} />
                {client.birthdate ? <small>From your saved profile</small> : <small>No saved birthdate</small>}
              </label>
              <label className="assessment-field" htmlFor="height_in">Height (inches)
                <input id="height_in" name="height_in" type="number" min="0.1" step="any" required value={formData.height_in} onChange={handleChange} />
                {strengthFormDefaults(client, history).height_in ? <small>From your saved details</small> : <small>No saved height. Enter it here.</small>}
              </label>
              <label className="assessment-field" htmlFor="weight">Current weight (lb)
                <input id="weight" name="weight" type="number" min="0.1" step="any" required value={formData.weight} onChange={handleChange} />
              </label>
              <label className="assessment-field" htmlFor="weight_goal">Weight goal (lb)
                <input id="weight_goal" name="weight_goal" type="number" min="0.1" step="any" value={formData.weight_goal} onChange={handleChange} />
              </label>
              <label className="assessment-field assessment-wide" htmlFor="training_environment">Training environment
                <select id="training_environment" name="training_environment" value={formData.training_environment} onChange={handleChange}><option value="">Select environment</option><option value="gym">Gym</option><option value="home">Home</option></select>
              </label>
            </div>
          </fieldset>
          {(['upper', 'lower'] as const).map(group => <fieldset className="assessment-section" key={group}>
            <legend>{group === 'upper' ? 'Upper body' : 'Lower body'}</legend>
            {strengthMovements.filter(([, , category]) => category === group).map(([key, label]) => <div className="assessment-exercise" key={key}>
              <h3>{label}</h3><div className="assessment-fields">
                {(['weight', 'reps'] as const).map(kind => {
                  const name = `${key}_${kind}`, unit = kind === 'weight' ? 'lb' : 'reps'
                  return <label key={name} className="assessment-field" htmlFor={name}>{kind === 'weight' ? 'Weight (lb)' : 'Reps'}
                    <input id={name} name={name} type="number" min={kind === 'weight' ? 0 : 1} max={kind === 'reps' ? 100 : undefined} step={kind === 'weight' ? 'any' : 1} value={formData[name]} onChange={handleChange} aria-describedby={`${name}-last`} />
                    <small id={`${name}-last`}>{previous(name, unit)}</small>
                  </label>
                })}
              </div>
            </div>)}
          </fieldset>)}
          <fieldset className="assessment-section"><legend>Core</legend>
            <label className="assessment-field" htmlFor="plank_time">Plank hold (seconds)
              <input id="plank_time" name="plank_time" type="number" min="0" step="any" value={formData.plank_time} onChange={handleChange} aria-describedby="plank-last" />
              <small id="plank-last">{previous('plank_time', 'seconds')}</small>
            </label>
          </fieldset>
          <p className="assessment-notice">Record only the movements you tested. Leave untested weight and reps blank.</p>
          <button type="submit" disabled={status === 'submitting'} className="assessment-action">{status === 'submitting' ? 'Submitting…' : 'Submit Assessment'}</button>
          {message ? <p role="alert">{message}</p> : null}
          {retrySavedPlan ? <Link href="/dashboard/onboarding/plan" className="assessment-action">Create Plan From Saved Assessments</Link> : null}
        </form>
      </main>
    </PhoneAppFrame>
  )
}
