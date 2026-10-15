'use client'

import { useState } from 'react'
import * as styles from '../styles/globalstyles'
import Button from '../../components/Button'
import TrackEvent from '@/components/TrackEvent'
import { trackEvent } from '@/lib/analytics'
import { capacityQuestions, CAPACITY_AUDIT_TIME } from '@/lib/capacityAudit'

type Option = {
  value: string
  label: string
  score: number
}

type FormData = {
  fullName: string
  email: string
  energyLevel: string
  overwhelmLevel: string
  timeAvailable: string
  supportLevel: string
  currentSeason: string
  emailConsent: boolean
  agreement: boolean
}

const questionOptions = capacityQuestions

function ScrollChoice({
  name,
  label,
  value,
  options,
  onSelect,
}: {
  name: keyof FormData
  label: string
  value: string
  options: Option[]
  onSelect: (name: keyof FormData, value: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <label style={styles.labelStyle}>{label}</label>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '10px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {options.map((option) => {
          const selected = value === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(name, option.value)}
              style={{
                minWidth: '170px',
                minHeight: '74px',
                scrollSnapAlign: 'center',
                borderRadius: '22px',
                border: selected
                  ? '1px solid rgba(197,139,87,0.72)'
                  : '1px solid rgba(197,139,87,0.18)',
                background: selected
                  ? 'rgba(197,139,87,0.18)'
                  : 'rgba(255,255,255,0.025)',
                color: '#f5f0e8',
                padding: '18px 20px',
                cursor: 'pointer',
                fontSize: '0.98rem',
                lineHeight: 1.4,
                boxShadow: selected
                  ? '0 14px 40px rgba(197,139,87,0.12)'
                  : '0 12px 34px rgba(0,0,0,0.12)',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ApplyPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    energyLevel: '',
    overwhelmLevel: '',
    timeAvailable: '',
    supportLevel: '',
    currentSeason: '',
    emailConsent: false,
    agreement: false,
  })

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  )
  const [message, setMessage] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target
    const checked = e.target.checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleSelect(name: keyof FormData, value: string) {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()

  if (status === 'submitting') {
    return
  }

  const requiredAnswers = [
    formData.energyLevel,
    formData.overwhelmLevel,
    formData.timeAvailable,
    formData.supportLevel,
    formData.currentSeason,
  ]

  if (requiredAnswers.some((answer) => !answer)) {
    setStatus('error')
    setMessage('Please answer every Capacity Audit question before continuing.')
    return
  }

  if (!formData.fullName.trim() || !formData.email.trim()) {
    setStatus('error')
    setMessage('Please enter your name and email address.')
    return
  }

  if (!formData.agreement) {
    setStatus('error')
    setMessage('Please agree to the Terms of Use and Health Disclaimer.')
    return
  }

  setStatus('submitting')
  setMessage('')

  try {
    const response = await fetch('/api/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        energy_level: formData.energyLevel,
        overwhelm_level: formData.overwhelmLevel,
        time_available: formData.timeAvailable,
        support_level: formData.supportLevel,
        current_season: formData.currentSeason,
        email_consent: formData.emailConsent,
        agreement: formData.agreement,
        audit_version: 'capacity_snapshot_v1',
        submitted: 'capacity_audit',
        timestamp: new Date().toISOString(),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.details ||
          'Your Capacity Audit could not be submitted. Please try again.'
      )
    }

    if (!data?.auditId) {
      throw new Error(
        'Your audit was saved, but the results page could not be prepared.'
      )
    }

    trackEvent('audit_page_completed', {
      page: 'audit',
      recommended_program: data.recommendedProgram,
      capacity_score: data.capacityScore,
      audit_id: data.auditId,
    })

    window.location.assign(
      data.redirect || `/audit/results/${data.auditId}`
    )
  } catch (error) {
    console.error('CAPACITY AUDIT ERROR:', error)

    setStatus('error')
    setMessage(
      error instanceof Error
        ? error.message
        : 'Something went wrong while submitting your audit.'
    )
  }
}

  return (
    <><TrackEvent event="audit_page_viewed" properties={{ page: 'audit' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <section style={{ marginBottom: '72px' }}>
          <p style={styles.eyebrowStyle}>Capacity Audit</p>

          <h1 style={styles.heroTitleStyle}>
            Find your current
            <br />
            capacity.
          </h1>

          <p style={styles.heroTextStyle}>
            {CAPACITY_AUDIT_TIME}. Five questions about energy, overwhelm, available time, support, and your current season. Your answers suggest a starting program to explore.
          </p>

          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              You do not need to have everything figured out.
            </h2>

            <p style={styles.bodyStyle}>
              Answer from where you are today. This brief public audit does not collect detailed nutrition, movement, symptoms, or a daily schedule. Members complete a separate, fuller onboarding assessment before their plan is created.
            </p>
          </div>
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
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Your Information</p>

            <div style={styles.gridTwoCol}>
              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle} htmlFor="fullName">
                  Name
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

            <div style={{ ...styles.innerCardStyle, marginTop: '20px' }}>
              <label style={styles.checkboxRowStyle}>
                <input
                  name="emailConsent"
                  type="checkbox"
                  checked={formData.emailConsent}
                  onChange={handleChange}
                  style={styles.checkboxInputStyle}
                />
                <span>
                  Yes, send me personalized insights, resources, and support
                  based on my Capacity Audit results.
                </span>
              </label>
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Capacity Snapshot</p>

            <div style={{ display: 'grid', gap: '32px' }}>
              <ScrollChoice
                name="energyLevel"
                label="How does your energy feel most days?"
                value={formData.energyLevel}
                options={questionOptions.energyLevel}
                onSelect={handleSelect}
              />

              <ScrollChoice
                name="overwhelmLevel"
                label="How often do you feel overwhelmed?"
                value={formData.overwhelmLevel}
                options={questionOptions.overwhelmLevel}
                onSelect={handleSelect}
              />

              <ScrollChoice
                name="timeAvailable"
                label="How much uninterrupted time do you have for yourself most days?"
                value={formData.timeAvailable}
                options={questionOptions.timeAvailable}
                onSelect={handleSelect}
              />

              <ScrollChoice
                name="supportLevel"
                label="How supported do you currently feel?"
                value={formData.supportLevel}
                options={questionOptions.supportLevel}
                onSelect={handleSelect}
              />

              <ScrollChoice
                name="currentSeason"
                label="Which statement feels most true today?"
                value={formData.currentSeason}
                options={questionOptions.currentSeason}
                onSelect={handleSelect}
              />
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <label style={styles.checkboxRowStyle}>
              <input
                name="agreement"
                type="checkbox"
                required
                checked={formData.agreement}
                onChange={handleChange}
                style={styles.checkboxInputStyle}
              />
              <span>
                By submitting this Capacity Audit, I confirm that I have read,
                understand, and agree to the{' '}
                <a href="/terms" style={styles.quietLinkStyle}>
                  Terms of Use
                </a>{' '}
                and{' '}
                <a href="/conditions" style={styles.quietLinkStyle}>
                  Health Disclaimer &amp; Liability Waiver
                </a>.
              </span>
            </label>
          </section>

          <div style={styles.buttonRowStyle}>
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                ...styles.primaryButtonStyle,
                minWidth: '220px',
                opacity: status === 'submitting' ? 0.65 : 1,
              }}
            >
              {status === 'submitting'
                ? 'Submitting...'
                : 'See My Recommended Path'}
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
  </>
  )
}
