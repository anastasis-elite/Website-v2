export default function ApplyPage() {
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
        <section style={{ marginBottom: '110px' }}>
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
              marginBottom: '36px',
            }}
          >
            This is not a rushed checkout and it is not a mass-market intake. The
            application exists to make sure the work is aligned, the fit is right,
            and the structure supports the woman entering it.
          </p>

          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.85,
              color: '#d7c7b6',
              maxWidth: '780px',
              marginBottom: '48px',
            }}
          >
            If you are here, you are not being asked to prove your worth. You are
            simply stepping into a more intentional process.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="#application-form"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Begin Application
            </a>

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
        </section>

        <section style={{ marginBottom: '110px' }}>
          <div
            style={{
              display: 'grid',
              gap: '28px',
            }}
          >
            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What applying means
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Applying means we are looking at fit, readiness, needs, and alignment.
                It means this is being treated with care instead of being pushed through
                a generic funnel.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What you can expect
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                You can expect questions that clarify where you are, what you need,
                and whether this is the right structure for you. The process is meant
                to create clarity, not pressure.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What happens next
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Once your application is submitted, the next step is review and
                response. From there, you will either be guided into the next phase
                or redirected with honesty and care.
              </p>
            </div>
          </div>
        </section>

        <section
          id="application-form"
          style={{
            border: '1px solid rgba(197,139,87,0.22)',
            borderRadius: '32px',
            padding: '42px 32px',
            background: 'rgba(255,255,255,0.01)',
            marginBottom: '80px',
          }}
        >
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '20px',
              textTransform: 'uppercase',
            }}
          >
            Application
          </p>

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
      // Temporary placeholder.
      // Later this will post to your n8n webhook or internal API route.
      console.log('Application submitted:', formData)

      setStatus('success')
      setMessage('Application submitted successfully.')
      // Optional reset:
      // setFormData({
      //   email: '',
      //   fullName: '',
      //   dateOfBirth: '',
      //   cityState: '',
      //   injuries: '',
      //   conditions: '',
      //   supervision: '',
      //   agreement: false,
      //   programSelection: '',
      // })
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

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="mailto:hello@anastasiselite.com?subject=Application%20Inquiry"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Submit via Email
            </a>

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
              Review Program Again
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
