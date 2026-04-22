'use client'

import { useState } from 'react'

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    dateOfBirth: '',
    cityState: '',
    injuries: '',
    conditions: '',
    supervision: '',
    agreement: false,
    programSelection: '',
  })

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      console.log('Application submitted:', formData)

      setStatus('success')
      setMessage('Application submitted successfully.')
    } catch (error) {
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
                style={inputStyle}
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
              Are you currently pregnant, nursing, or under medical supervision?
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
              <option value="Yes - under medical supervision">Yes - under medical supervision</option>
              <option value="Other / needs discussion">Other / needs discussion</option>
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="programSelection">
              Program Selection
            </label>
            <select
              id="programSelection"
              name="programSelection"
              required
              value={formData.programSelection}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Select a program</option>
              <option value="Ember">Ember</option>
              <option value="Ignite">Ignite</option>
              <option value="Phoenix">Phoenix</option>
              <option value="Not Sure Yet">Not Sure Yet</option>
            </select>
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
                and agree to the terms and disclaimer above.
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '18px',
}

const fieldWrap: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const labelStyle: React.CSSProperties = {
  color: '#f5f0e8',
  fontSize: '0.96rem',
  lineHeight: 1.5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
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
