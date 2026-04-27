'use client'
import {
  pageStyle,
  containerStyle,
  eyebrowStyle,
  heroTitleStyle,
  heroTextStyle,
  sectionStyle,
  sectionTitleStyle,
  bodyStyle,
  cardGridStyle,
  cardStyle,
  cardTitleStyle,
  cardTextStyle,
  cartBoxStyle,
  buttonRowStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  quietLinkStyle,
} from '../styles/globalStyles'

import { useState } from 'react'
import type { CSSProperties } from 'react'

function hasRelevantHealthInfo(value: string) {
  const cleaned = value.trim().toLowerCase()

  const negativeAnswers = [
    '',
    'no',
    'none',
    'n/a',
    'na',
    'nope',
    'not at this time',
    'nothing',
    'no injuries',
    'no conditions',
    'none at this time',
  ]

  return !negativeAnswers.includes(cleaned)
}

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    dateOfBirth: '',
    cityState: '',
    injuries: '',
    conditions: '',
    supervision: '',
    postpartumMonths: '',
    primaryGoal: '',
    whyNow: '',
    agreement: false,
    mediaConsent: false,
    researchConsent: false,
    medicalClearance: false,
    medicalClearanceFile: null as File | null,
  })


  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }

      if (name === 'supervision' && value !== 'Yes - postpartum') {
        updated.postpartumMonths = ''
      }

      return updated
    })
  }
        const needsMedicalClearanceQuestion =
          hasRelevantHealthInfo(formData.injuries) ||
          hasRelevantHealthInfo(formData.conditions)
        async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
          e.preventDefault()
          setStatus('submitting')
          setMessage('')

  try {
    console.log('Submitting:', formData)

    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  email: formData.email,
  fullName: formData.fullName,
  dateOfBirth: formData.dateOfBirth,
  cityState: formData.cityState,
  injuries: formData.injuries,
  conditions: formData.conditions,
  supervision: formData.supervision,
  postpartumMonths: formData.postpartumMonths,
  primaryGoal: formData.primaryGoal,
  whyNow: formData.whyNow,
  agreement: formData.agreement,
  mediaConsent: formData.mediaConsent,
  researchConsent: formData.researchConsent,
  medicalClearance: formData.medicalClearance,
  medicalClearanceFileName: formData.medicalClearanceFile?.name || '',
  timestamp: new Date().toISOString(),
  source: 'apply',
  submitted: 'website',
}),
    })

   const data = await res.json()
console.log('Response:', data)

if (!res.ok) {
  throw new Error(data.error || 'Request failed')
}

if (data.redirect) {
  window.location.href = data.redirect
  return
}

alert('No redirect received. Response was: ' + JSON.stringify(data))

setStatus('success')
setMessage('Application submitted successfully.')

  } catch (error) {
    console.error('SUBMIT ERROR:', error)
    setStatus('error')
    setMessage('Something went wrong. Please try again.')
  }
}

  return (
    <main
      style={{
        background: '#000',
        color: '#f5f0e8',
        minHeight: '100vh',
        padding: '120px 24px',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <section style={{ marginBottom: '72px' }}>
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '24px',
              textTransform: 'uppercase',
            }}
          >
            Apply
          </p>

          <h1
            style={{
              fontSize: 'clamp(2.8rem, 5vw, 5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '0 0 28px 0',
              maxWidth: '900px',
            }}
          >
            Start the process.
          </h1>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.9,
              color: '#d7c7b6',
              maxWidth: '780px',
              marginBottom: '0',
            }}
          >
            This application is here to create clarity, fit, and alignment. It is not
            rushed, generic, or impersonal.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gap: '22px',
            border: '1px solid rgba(197,139,87,0.22)',
            borderRadius: '32px',
            padding: '40px 32px',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          <div style={gridTwoCol}>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={gridTwoCol}>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="dateOfBirth">
                Date of Birth
              </label>
              <input
  id="dateOfBirth"
  name="dateOfBirth"
  type="date"
  required
  value={formData.dateOfBirth}
  onChange={handleChange}
  style={{
    ...inputStyle,
    WebkitAppearance: 'none',
    appearance: 'none',
  }}
/>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cityState">
                City &amp; State
              </label>
              <input
                id="cityState"
                name="cityState"
                type="text"
                required
                value={formData.cityState}
                onChange={handleChange}
                style={inputStyle}
                placeholder="City, State"
              />
            </div>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="injuries">
              Do you have any current or past injuries?
            </label>
            <textarea
              id="injuries"
              name="injuries"
              required
              value={formData.injuries}
              onChange={handleChange}
              style={textareaStyle}
              placeholder="Please share anything relevant."
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="conditions">
              Do you have any chronic medical conditions or restrictions?
            </label>
            <textarea
              id="conditions"
              name="conditions"
              required
              value={formData.conditions}
              onChange={handleChange}
              style={textareaStyle}
              placeholder="Please share anything relevant."
            />
          </div>

         {needsMedicalClearanceQuestion && (
  <div
    style={{
      border: '1px solid rgba(197,139,87,0.16)',
      borderRadius: '22px',
      padding: '20px',
      background: 'rgba(255,255,255,0.01)',
    }}
  >
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        lineHeight: 1.7,
        color: '#d7c7b6',
        fontSize: '0.98rem',
        cursor: 'pointer',
      }}
    >
      <input
        name="medicalClearance"
        type="checkbox"
        checked={formData.medicalClearance}
        onChange={handleChange}
        style={{
          marginTop: '4px',
          accentColor: '#c58b57',
        }}
      />
      <span>
        I have medical clearance to participate in a structured fitness and nutrition program.
      </span>
    </label>
  </div>
)}

          {formData.medicalClearance && (
  <div style={fieldWrap}>
    <label style={labelStyle} htmlFor="medicalClearanceFile">
      Upload medical clearance documentation
    </label>
    <input
      id="medicalClearanceFile"
      name="medicalClearanceFile"
      type="file"
      accept="image/*,.pdf"
      required
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          medicalClearanceFile: e.target.files?.[0] || null,
        }))
      }
      style={inputStyle}
    />
  </div>
)}
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="supervision">
              Are you currently pregnant, nursing, postpartum, or under medical supervision?
            </label>
            <select
              id="supervision"
              name="supervision"
              required
              value={formData.supervision}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Select one</option>
              <option value="No">No</option>
              <option value="Yes - pregnant">Yes - pregnant</option>
              <option value="Yes - nursing">Yes - nursing</option>
              <option value="Yes - postpartum">Yes - postpartum</option>
              <option value="Yes - under medical supervision">Yes - under medical supervision</option>
              <option value="Other / needs discussion">Other / needs discussion</option>
            </select>
          </div>

          {formData.supervision === 'Yes - postpartum' && (
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="postpartumMonths">
                How many months postpartum are you?
              </label>
              <input
                id="postpartumMonths"
                name="postpartumMonths"
                type="number"
                min="0"
                required
                value={formData.postpartumMonths}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Enter number of months"
              />
            </div>
          )}

          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="primaryGoal">
              What are you hoping to change most right now?
            </label>
            <textarea
              id="primaryGoal"
              name="primaryGoal"
              required
              value={formData.primaryGoal}
              onChange={handleChange}
              style={textareaStyle}
              placeholder="Share the main change or outcome you want most right now."
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="whyNow">
              Why are you looking for support now?
            </label>
            <textarea
              id="whyNow"
              name="whyNow"
              required
              value={formData.whyNow}
              onChange={handleChange}
              style={textareaStyle}
              placeholder="What makes this the right time for you to begin?"
            />
          </div>

          <div
            style={{
              border: '1px solid rgba(197,139,87,0.16)',
              borderRadius: '22px',
              padding: '20px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                lineHeight: 1.7,
                color: '#d7c7b6',
                fontSize: '0.98rem',
                cursor: 'pointer',
              }}
            >
              <input
                name="agreement"
                type="checkbox"
                required
                checked={formData.agreement}
                onChange={handleChange}
                style={{
                  marginTop: '4px',
                  accentColor: '#c58b57',
                }}
              />
              <span>
                By submitting this application, I confirm that I have read, understand,
                and agree to the{' '}
                <a
                  href="/terms"
                  style={{
                    color: '#c58b57',
                    textDecoration: 'underline',
                  }}
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href="/conditions"
                  style={{
                    color: '#c58b57',
                    textDecoration: 'underline',
                  }}
                >
                  Health Disclaimer &amp; Liability Waiver
                </a>.
              </span>
            </label>
          </div>

          <div
            style={{
              border: '1px solid rgba(197,139,87,0.16)',
              borderRadius: '22px',
              padding: '20px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                lineHeight: 1.7,
                color: '#d7c7b6',
                fontSize: '0.98rem',
                cursor: 'pointer',
              }}
            >
              <input
                name="mediaConsent"
                type="checkbox"
                checked={formData.mediaConsent}
                onChange={handleChange}
                style={{
                  marginTop: '4px',
                  accentColor: '#c58b57',
                }}
              />
              <span>
                I authorize the use of my transformation photos, progress photos, or related
                visual media according to the{' '}
                <a
                  href="/consent/media"
                  style={{
                    color: '#c58b57',
                    textDecoration: 'underline',
                  }}
                >
                  Media Consent
                </a>.
              </span>
            </label>
          </div>

          <div
            style={{
              border: '1px solid rgba(197,139,87,0.16)',
              borderRadius: '22px',
              padding: '20px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                lineHeight: 1.7,
                color: '#d7c7b6',
                fontSize: '0.98rem',
                cursor: 'pointer',
              }}
            >
              <input
                name="researchConsent"
                type="checkbox"
                checked={formData.researchConsent}
                onChange={handleChange}
                style={{
                  marginTop: '4px',
                  accentColor: '#c58b57',
                }}
              />
              <span>
                I authorize the use of approved, non-public personal data for research
                purposes according to the{' '}
                <a
                  href="/consent/research"
                  style={{
                    color: '#c58b57',
                    textDecoration: 'underline',
                  }}
                >
                  Research Consent
                </a>.
              </span>
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: '8px',
            }}
          >
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
            </button>

            <a
              href="/program"
              style={{
                border: '1px solid #c58b57',
                color: '#f5f0e8',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 500,
                opacity: 0.85,
              }}
            >
              Return to Program
            </a>
          </div>

          {message ? (
            <p
              style={{
                margin: 0,
                color: status === 'success' ? '#c58b57' : '#ffb4b4',
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

