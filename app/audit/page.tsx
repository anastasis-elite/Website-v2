'use client'

import { useState } from 'react'
import * as styles from '../styles/globalstyles'
import Button from '../../components/Button'
import TrackEvent from '@/components/TrackEvent'

type Program = 'ember' | 'ignite' | 'phoenix'

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

const questionOptions: Record<string, Option[]> = {
  energyLevel: [
    { value: 'exhausted', label: 'Exhausted', score: 5 },
    { value: 'drained', label: 'Drained', score: 4 },
    { value: 'managing', label: 'Managing', score: 3 },
    { value: 'good', label: 'Good', score: 2 },
    { value: 'thriving', label: 'Thriving', score: 1 },
  ],
  overwhelmLevel: [
    { value: 'constantly', label: 'Constantly', score: 5 },
    { value: 'most_days', label: 'Most Days', score: 4 },
    { value: 'sometimes', label: 'Sometimes', score: 3 },
    { value: 'rarely', label: 'Rarely', score: 2 },
    { value: 'almost_never', label: 'Almost Never', score: 1 },
  ],
  timeAvailable: [
    { value: 'almost_none', label: 'Almost None', score: 5 },
    { value: '15_minutes', label: '15 Minutes', score: 4 },
    { value: '30_minutes', label: '30 Minutes', score: 3 },
    { value: '1_hour', label: '1 Hour', score: 2 },
    { value: 'more_than_1_hour', label: 'More Than 1 Hour', score: 1 },
  ],
  supportLevel: [
    { value: 'alone', label: 'Completely Alone', score: 5 },
    { value: 'limited', label: 'Limited Support', score: 4 },
    { value: 'some', label: 'Some Support', score: 3 },
    { value: 'good', label: 'Good Support', score: 2 },
    { value: 'strong', label: 'Strong Support', score: 1 },
  ],
  currentSeason: [
    { value: 'surviving', label: 'Surviving', score: 5 },
    { value: 'regaining_consistency', label: 'Regaining Consistency', score: 4 },
    { value: 'building_momentum', label: 'Building Momentum', score: 3 },
    { value: 'optimizing', label: 'Optimizing', score: 2 },
    { value: 'performing', label: 'Performing Higher', score: 1 },
  ],
}

function getOptionScore(field: keyof typeof questionOptions, value: string) {
  return questionOptions[field].find((option) => option.value === value)?.score || 0
}

function scoreCapacityAudit(data: FormData): {
  score: number
  recommendedProgram: Program
} {
  const score =
    getOptionScore('energyLevel', data.energyLevel) +
    getOptionScore('overwhelmLevel', data.overwhelmLevel) +
    getOptionScore('timeAvailable', data.timeAvailable) +
    getOptionScore('supportLevel', data.supportLevel) +
    getOptionScore('currentSeason', data.currentSeason)

  if (score <= 10) return { score, recommendedProgram: 'ember' }
  if (score <= 17) return { score, recommendedProgram: 'ignite' }

  return { score, recommendedProgram: 'phoenix' }
}

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
    setStatus('submitting')
    setMessage('')

    try {
      const auditResult = scoreCapacityAudit(formData)

      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,

          energy_level: formData.energyLevel,
          overwhelm_level: formData.overwhelmLevel,
          time_available: formData.timeAvailable,
          support_level: formData.supportLevel,
          current_season: formData.currentSeason,

          email_consent: formData.emailConsent,
          agreement: formData.agreement,

          capacity_score: auditResult.score,
          recommended_program: auditResult.recommendedProgram,
          audit_version: 'capacity_snapshot_v1',

          submitted: 'capacity_audit',
          timestamp: new Date().toISOString(),

          dateOfBirth: '',
          cityState: '',
          address_line_1: '',
          address_line_2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          address_verified: false,
          injuries: '',
          conditions: '',
          supervision: '',
          postpartumMonths: '',
          primaryGoal: '',
          whyNow: '',
          researchConsent: false,
          medicalClearance: false,
          medicalClearanceFileName: '',
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || data?.details || 'Request failed')
      }

      if (data.redirect) {
        window.location.href = data.redirect
        return
      }

      window.location.href = `/program/${auditResult.recommendedProgram}`
    } catch (error) {
      console.error('CAPACITY AUDIT ERROR:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
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
            This takes less than one minute. No long application. No perfect
            answers. Just enough information to help Anastasis recommend the
            starting path that fits your current season.
          </p>

          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              You do not need to have everything figured out.
            </h2>

            <p style={styles.bodyStyle}>
              Answer from where you are today. The goal is not to judge your
              capacity. The goal is to understand what level of support would
              help you move forward without adding more pressure.
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
