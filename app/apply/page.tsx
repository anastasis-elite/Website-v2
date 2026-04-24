'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

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

  async function handleSubmit(e) {
  e.preventDefault()
  setStatus('submitting')
  setMessage('')

  try {
    console.log('Submitting:', formData)

    const res = await fetch('https://n8n.anastasiselite.com/webhook/apply-intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })

    const text = await res.text()
    console.log('Response:', text)

    if (!res.ok) {
      throw new Error('Request failed')
    }

    setStatus('success')
    setMessage('Application submitted successfully.')

  } catch (error) {
    console.error('SUBMIT ERROR:', error)
    setStatus('error')
    setMessage('Something went wrong. Please try again.')
  }
}

    const text = await response.text()
    let data: { redirect?: string; error?: string } = {}

    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }

    if (!response.ok) {
      throw new Error(data.error || `Webhook failed with status ${response.status}`)
    }

    if (data.redirect) {
      window.location.href = data.redirect
      return
    }

    setStatus('success')
    setMessage('Application submitted successfully.')
  } catch (error) {
    console.error('SUBMIT ERROR:', error)
    setStatus('error')
    setMessage(error instanceof Error ? error.message : 'Something went wrong.')
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
                placeholder="Lumberton, Texas"
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

const gridTwoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: '18px',
}

const fieldWrap: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const labelStyle: React.CSSProperties = {
  color: '#f5f0e8',
  fontSize: '0.96rem',
  lineHeight: 1.5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  background: '#0a0a0a',
  color: '#f5f0e8',
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '16px',
  padding: '14px 16px',
  fontSize: '1rem',
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical',
}
