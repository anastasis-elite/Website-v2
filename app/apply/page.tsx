'use client'

import { useState } from 'react'
import * as styles from '../styles/globalstyles'
import Button from '../../components/Button'

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

type FormData = {
  email: string
  fullName: string
  dateOfBirth: string
  cityState: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string

  energyLevel: string
  sleepQuality: string
  stressLevel: string
  overwhelmLevel: string
  recoveryLevel: string
  motivationLevel: string

  caregiverLoad: string
  workLoad: string
  decisionFatigue: string
  currentMovementLevel: string
  trainingConsistency: string
  nutritionConsistency: string
  cycleStatus: string
  cycleSymptoms: string
  desiredSupportLevel: string
  primaryCapacityGap: string
  auditNotes: string

  injuries: string
  conditions: string
  supervision: string
  postpartumMonths: string

  primaryGoal: string
  whyNow: string

  agreement: boolean
  researchConsent: boolean
  medicalClearance: boolean
  medicalClearanceFile: File | null
}

function scoreCapacityAudit(data: FormData) {
  let score = 0

  const energy = Number(data.energyLevel || 0)
  const sleep = Number(data.sleepQuality || 0)
  const stress = Number(data.stressLevel || 0)
  const overwhelm = Number(data.overwhelmLevel || 0)
  const recovery = Number(data.recoveryLevel || 0)
  const motivation = Number(data.motivationLevel || 0)

  score += 10 - energy
  score += 10 - sleep
  score += stress
  score += overwhelm
  score += 10 - recovery
  score += 10 - motivation

  if (data.caregiverLoad === 'high') score += 6
  if (data.caregiverLoad === 'moderate') score += 3

  if (data.workLoad === 'high') score += 5
  if (data.workLoad === 'moderate') score += 3

  if (data.decisionFatigue === 'high') score += 6
  if (data.decisionFatigue === 'moderate') score += 3

  if (data.trainingConsistency === 'none') score += 6
  if (data.trainingConsistency === 'inconsistent') score += 4
  if (data.trainingConsistency === 'consistent') score -= 2

  if (data.nutritionConsistency === 'none') score += 6
  if (data.nutritionConsistency === 'inconsistent') score += 4
  if (data.nutritionConsistency === 'consistent') score -= 2

  if (data.cycleSymptoms === 'severe') score += 5
  if (data.cycleSymptoms === 'moderate') score += 3

  if (score <= 22) return { score, recommendedProgram: 'ember' }
  if (score <= 42) return { score, recommendedProgram: 'ignite' }

  return { score, recommendedProgram: 'phoenix' }
}

export default function ApplyPage() {
  const [formData, setFormData] = useState<FormData>({
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

    energyLevel: '',
    sleepQuality: '',
    stressLevel: '',
    overwhelmLevel: '',
    recoveryLevel: '',
    motivationLevel: '',

    caregiverLoad: '',
    workLoad: '',
    decisionFatigue: '',
    currentMovementLevel: '',
    trainingConsistency: '',
    nutritionConsistency: '',
    cycleStatus: '',
    cycleSymptoms: '',
    desiredSupportLevel: '',
    primaryCapacityGap: '',
    auditNotes: '',

    injuries: '',
    conditions: '',
    supervision: '',
    postpartumMonths: '',

    primaryGoal: '',
    whyNow: '',

    agreement: false,
    researchConsent: false,
    medicalClearance: false,
    medicalClearanceFile: null,
  })

  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState('')

  const needsMedicalClearanceQuestion =
    hasRelevantHealthInfo(formData.injuries) ||
    hasRelevantHealthInfo(formData.conditions)

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

          energy_level: Number(formData.energyLevel),
          sleep_quality: Number(formData.sleepQuality),
          stress_level: Number(formData.stressLevel),
          overwhelm_level: Number(formData.overwhelmLevel),
          recovery_level: Number(formData.recoveryLevel),
          motivation_level: Number(formData.motivationLevel),

          caregiver_load: formData.caregiverLoad,
          work_load: formData.workLoad,
          decision_fatigue: formData.decisionFatigue,
          current_movement_level: formData.currentMovementLevel,
          training_consistency: formData.trainingConsistency,
          nutrition_consistency: formData.nutritionConsistency,
          cycle_status: formData.cycleStatus,
          cycle_symptoms: formData.cycleSymptoms,
          desired_support_level: formData.desiredSupportLevel,
          primary_capacity_gap: formData.primaryCapacityGap,
          audit_notes: formData.auditNotes,

          capacity_score: auditResult.score,
          recommended_program: auditResult.recommendedProgram,
          audit_version: 'capacity_audit_v1',

          injuries: formData.injuries,
          conditions: formData.conditions,
          supervision: formData.supervision,
          postpartumMonths: formData.postpartumMonths,

          primaryGoal: formData.primaryGoal,
          whyNow: formData.whyNow,

          agreement: formData.agreement,
          researchConsent: formData.researchConsent,
          medicalClearance: formData.medicalClearance,
          medicalClearanceFileName: formData.medicalClearanceFile?.name || '',

          timestamp: new Date().toISOString(),
          submitted: 'capacity_audit',
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          [
            data?.error,
            data?.details,
            data?.code ? `Code: ${data.code}` : '',
            data?.hint ? `Hint: ${data.hint}` : '',
          ]
            .filter(Boolean)
            .join(' — ') || 'Request failed'
        )
      }

      if (data.redirect) {
        window.location.href = data.redirect
        return
      }

      window.location.href = `/program/${auditResult.recommendedProgram}`
    } catch (error) {
      console.error('CAPACITY AUDIT ERROR:', error)
      setStatus('error')
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong.'
      )
    }
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <section style={{ marginBottom: '72px' }}>
          <p style={styles.eyebrowStyle}>Capacity Audit</p>

          <h1 style={styles.heroTitleStyle}>
            Let’s understand
            <br />
            where your capacity is going.
          </h1>

          <p style={styles.heroTextStyle}>
            You do not need to have everything figured out before you begin.
            This audit helps Anastasis understand your current energy, stress,
            recovery, responsibilities, body needs, and support level so the
            system can recommend the right starting path.
          </p>

          <div style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              This is not a test you pass or fail.
            </h2>

            <p style={styles.bodyStyle}>
              Simply answer honestly. The goal is not to judge your starting
              point. The goal is to identify what needs support first so your
              plan can meet your actual life, not an ideal version of it.
            </p>
          </div>

          <div style={styles.cardGridStyle}>
            {[
              {
                title: '1. We assess your current load.',
                body:
                  'Energy, sleep, stress, recovery, responsibilities, and consistency give us your current capacity picture.',
              },
              {
                title: '2. We identify your support need.',
                body:
                  'Lower support need points toward Ember. Moderate support need points toward Ignite. Higher support need points toward Phoenix.',
              },
              {
                title: '3. You begin from the right place.',
                body:
                  'The goal is to build capacity without overwhelming the woman who is already carrying too much.',
              },
            ].map((item) => (
              <div key={item.title} style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>{item.title}</h3>
                <p style={styles.cardTextStyle}>{item.body}</p>
              </div>
            ))}
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

            <div style={{ ...styles.gridTwoCol, marginTop: '18px' }}>
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
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Current Capacity</p>

            <div style={styles.cardGridStyle}>
              {[
                ['energyLevel', 'Energy today'],
                ['sleepQuality', 'Sleep quality'],
                ['stressLevel', 'Stress level'],
                ['overwhelmLevel', 'Overwhelm level'],
                ['recoveryLevel', 'Recovery level'],
                ['motivationLevel', 'Motivation level'],
              ].map(([name, label]) => (
                <div key={name} style={styles.fieldWrap}>
                  <label style={styles.labelStyle} htmlFor={name}>
                    {label} / 10
                  </label>
                  <input
                    id={name}
                    name={name}
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={formData[name as keyof FormData] as string}
                    onChange={handleChange}
                    style={styles.inputStyle}
                  />
                </div>
              ))}
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Life Load</p>

            <div style={styles.gridTwoCol}>
              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Caregiver load</label>
                <select
                  name="caregiverLoad"
                  required
                  value={formData.caregiverLoad}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Work / responsibility load</label>
                <select
                  name="workLoad"
                  required
                  value={formData.workLoad}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
              <label style={styles.labelStyle}>Decision fatigue</label>
              <select
                name="decisionFatigue"
                required
                value={formData.decisionFatigue}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="low">Low — I can usually make decisions easily</option>
                <option value="moderate">Moderate — I feel decision fatigue sometimes</option>
                <option value="high">High — I feel mentally overloaded often</option>
              </select>
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Movement + Nourishment</p>

            <div style={styles.gridTwoCol}>
              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Current movement level</label>
                <select
                  name="currentMovementLevel"
                  required
                  value={formData.currentMovementLevel}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="minimal">Minimal movement</option>
                  <option value="some">Some daily movement</option>
                  <option value="active">Active most days</option>
                  <option value="training">Structured training currently</option>
                </select>
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Training consistency</label>
                <select
                  name="trainingConsistency"
                  required
                  value={formData.trainingConsistency}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="none">Not currently consistent</option>
                  <option value="inconsistent">Inconsistent</option>
                  <option value="consistent">Consistent</option>
                </select>
              </div>
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
              <label style={styles.labelStyle}>Nutrition consistency</label>
              <select
                name="nutritionConsistency"
                required
                value={formData.nutritionConsistency}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="none">No current structure</option>
                <option value="inconsistent">Some structure, inconsistent execution</option>
                <option value="consistent">Consistent structure</option>
              </select>
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Cycle + Recovery Context</p>

            <div style={styles.gridTwoCol}>
              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Cycle status</label>
                <select
                  name="cycleStatus"
                  required
                  value={formData.cycleStatus}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="regular">Regular cycle</option>
                  <option value="irregular">Irregular cycle</option>
                  <option value="postpartum">Postpartum</option>
                  <option value="perimenopause">Perimenopause</option>
                  <option value="menopause">Menopause</option>
                  <option value="birth_control">Hormonal birth control</option>
                  <option value="unknown">Unsure</option>
                </select>
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.labelStyle}>Cycle symptoms</label>
                <select
                  name="cycleSymptoms"
                  required
                  value={formData.cycleSymptoms}
                  onChange={handleChange}
                  style={styles.inputStyle}
                >
                  <option value="">Select one</option>
                  <option value="low">Low / manageable</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe / disruptive</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </div>
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Support Path</p>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>Where do you feel the biggest capacity gap?</label>
              <select
                name="primaryCapacityGap"
                required
                value={formData.primaryCapacityGap}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="energy">Energy</option>
                <option value="consistency">Consistency</option>
                <option value="recovery">Recovery</option>
                <option value="nutrition">Nutrition</option>
                <option value="stress">Stress / nervous system</option>
                <option value="strength">Strength</option>
                <option value="identity">Self-trust / identity</option>
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
              <label style={styles.labelStyle}>What level of support feels most helpful?</label>
              <select
                name="desiredSupportLevel"
                required
                value={formData.desiredSupportLevel}
                onChange={handleChange}
                style={styles.inputStyle}
              >
                <option value="">Select one</option>
                <option value="structure">I mostly need structure</option>
                <option value="adaptation">I need more adaptive guidance</option>
                <option value="high_support">I need the most support and least friction possible</option>
                <option value="unsure">I am not sure yet</option>
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
              <label style={styles.labelStyle} htmlFor="auditNotes">
                Anything else you want us to understand?
              </label>
              <textarea
                id="auditNotes"
                name="auditNotes"
                value={formData.auditNotes}
                onChange={handleChange}
                style={styles.textareaStyle}
                placeholder="Optional notes."
              />
            </div>
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Health Context</p>

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

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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
              <div style={{ ...styles.innerCardStyle, marginTop: '18px' }}>
                <label style={styles.checkboxRowStyle}>
                  <input
                    name="medicalClearance"
                    type="checkbox"
                    checked={formData.medicalClearance}
                    onChange={handleChange}
                    style={styles.checkboxInputStyle}
                  />
                  <span>
                    I have medical clearance to participate in a structured fitness and nutrition program.
                  </span>
                </label>
              </div>
            )}

            {formData.medicalClearance && (
              <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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
              <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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
          </section>

          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Shipping Address</p>

            <p style={{ ...styles.bodyStyle, marginBottom: '22px' }}>
              This is used for program-related shipments, Phoenix supplement fulfillment,
              and future member gifts if applicable.
            </p>

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

            <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
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

            <div style={{ ...styles.gridTwoCol, marginTop: '18px' }}>
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

            <div style={{ ...styles.gridTwoCol, marginTop: '18px' }}>
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

            <div style={{ marginTop: '18px' }}>
              <label style={styles.checkboxRowStyle}>
                <input
                  name="researchConsent"
                  type="checkbox"
                  checked={formData.researchConsent}
                  onChange={handleChange}
                  style={styles.checkboxInputStyle}
                />
                <span>
                  I authorize the use of approved, non-public personal data for research
                  purposes according to the{' '}
                  <a href="/consent/research" style={styles.quietLinkStyle}>
                    Research Consent
                  </a>.
                </span>
              </label>
            </div>
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
                : 'Complete Capacity Audit'}
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
