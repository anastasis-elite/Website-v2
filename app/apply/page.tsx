'use client'
import * as styles from '../styles/globalstyles'
import Button from '../../components/Button'
import { useState } from 'react'

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
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
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
          //remove required

          
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
      address_line_1: formData.addressLine1,
      address_line_2: formData.addressLine2,
      city: formData.city,
      state: formData.state,
      postal_code: formData.postalCode,
      country: formData.country,
      address_verified: false,
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

   const data = await res.json().catch(() => null)

console.log('Response:', data)

if (!res.ok) {
  throw new Error(data?.error || 'Request failed')
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

  setMessage(
    error instanceof Error
      ? error.message
      : JSON.stringify(error)
  )
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
          <div style={styles.gridTwoCol}>
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
          </div>

          <div style={styles.gridTwoCol}>
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="dateOfBirth">
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
    ...styles.inputStyle,
    WebkitAppearance: 'none',
    appearance: 'none',
  }}
/>
            </div>

            <div style={styles.fieldWrap}>
  <label style={styles.labelStyle} htmlFor="cityState">
    City &amp; State
  </label>
  <input
    id="cityState"
    name="cityState"
    type="text"
    required
    value={formData.cityState}
    onChange={handleChange}
    style={styles.inputStyle}
    placeholder="City, State"
  />
</div>
          </div>
<section
  style={{
    border: '1px solid rgba(197,139,87,0.16)',
    borderRadius: '24px',
    padding: '24px',
    background: 'rgba(255,255,255,0.01)',
    display: 'grid',
    gap: '18px',
  }}
>
  <div>
    <p
      style={{
        margin: '0 0 8px',
        color: '#c58b57',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontSize: '0.74rem',
      }}
    >
      Shipping Address
    </p>

    <p
      style={{
        margin: 0,
        color: '#d7c7b6',
        lineHeight: 1.6,
        fontSize: '0.95rem',
      }}
    >
      This is used for program-related shipments, Phoenix supplement fulfillment,
      and future member gifts if applicable.
    </p>
  </div>

  <div style={styles.fieldWrap}>
    <label style={styles.labelStyle} htmlFor="addressLine1">
      Address Line 1
    </label>
    <input
      id="addressLine1"
      name="addressLine1"
      type="text"
      required
      value={formData.addressLine1}
      onChange={handleChange}
      style={styles.inputStyle}
      placeholder="Street address"
      autoComplete="address-line1"
    />
  </div>

  <div style={styles.fieldWrap}>
    <label style={styles.labelStyle} htmlFor="addressLine2">
      Address Line 2
    </label>
    <input
      id="addressLine2"
      name="addressLine2"
      type="text"
      value={formData.addressLine2}
      onChange={handleChange}
      style={styles.inputStyle}
      placeholder="Apartment, suite, unit, etc. optional"
      autoComplete="address-line2"
    />
  </div>

  <div style={styles.gridTwoCol}>
    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle} htmlFor="city">
        City
      </label>
      <input
        id="city"
        name="city"
        type="text"
        required
        value={formData.city}
        onChange={handleChange}
        style={styles.inputStyle}
        autoComplete="address-level2"
      />
    </div>

    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle} htmlFor="state">
        State
      </label>
      <input
        id="state"
        name="state"
        type="text"
        required
        value={formData.state}
        onChange={handleChange}
        style={styles.inputStyle}
        placeholder="TX"
        autoComplete="address-level1"
      />
    </div>
  </div>

  <div style={styles.gridTwoCol}>
    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle} htmlFor="postalCode">
        ZIP / Postal Code
      </label>
      <input
        id="postalCode"
        name="postalCode"
        type="text"
        required
        value={formData.postalCode}
        onChange={handleChange}
        style={styles.inputStyle}
        autoComplete="postal-code"
      />
    </div>

    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle} htmlFor="country">
        Country
      </label>
      <input
        id="country"
        name="country"
        type="text"
        required
        value={formData.country}
        onChange={handleChange}
        style={styles.inputStyle}
        autoComplete="country-name"
      />
    </div>
  </div>
</section>
          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="injuries">
              Do you have any current or past injuries?
            </label>
            <textarea
              id="injuries"
              name="injuries"
              required
              value={formData.injuries}
              onChange={handleChange}
              style={styles.textareaStyle}
              placeholder="Please share anything relevant."
            />
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="conditions">
              Do you have any chronic medical conditions or restrictions?
            </label>
            <textarea
              id="conditions"
              name="conditions"
              required
              value={formData.conditions}
              onChange={handleChange}
              style={styles.textareaStyle}
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
  <div style={styles.fieldWrap}>
    <label style={styles.labelStyle} htmlFor="medicalClearanceFile">
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
      style={styles.inputStyle}
    />
  </div>
)}
          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="supervision">
              Are you currently pregnant, nursing, postpartum, or under medical supervision?
            </label>
            <select
              id="supervision"
              name="supervision"
              required
              value={formData.supervision}
              onChange={handleChange}
              style={styles.inputStyle}
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
            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle} htmlFor="postpartumMonths">
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
                style={styles.inputStyle}
                placeholder="Enter number of months"
              />
            </div>
          )}

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="primaryGoal">
              What are you hoping to change most right now?
            </label>
            <textarea
              id="primaryGoal"
              name="primaryGoal"
              required
              value={formData.primaryGoal}
              onChange={handleChange}
              style={styles.textareaStyle}
              placeholder="Share the main change or outcome you want most right now."
            />
          </div>

          <div style={styles.fieldWrap}>
            <label style={styles.labelStyle} htmlFor="whyNow">
              Why are you looking for support now?
            </label>
            <textarea
              id="whyNow"
              name="whyNow"
              required
              value={formData.whyNow}
              onChange={handleChange}
              style={styles.textareaStyle}
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
    gap: '18px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    marginTop: '8px',
  }}
>
  <button
    type="submit"
    disabled={status === 'submitting'}
    style={{
      ...styles.primaryButtonStyle,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '220px',
      opacity: status === 'submitting' ? 0.65 : 1,
    }}
  >
    {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
  </button>

  <Button href="/program" variant="secondary">
    Return to Program
  </Button>
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
