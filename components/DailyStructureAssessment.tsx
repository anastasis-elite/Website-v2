'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

type Props = {
  clientId: string
  currentExecutionStyle?: string | null
  currentCarouselStyle?: string | null
  wakeTime?: string | null
  bedTime?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  preferredWorkoutTime?: string | null
  schoolDropoffTime?: string | null
  schoolPickupTime?: string | null
  lunchWindowTime?: string | null
  dinnerWindowTime?: string | null
  dailyNonNegotiables?: string[] | null
  dayStructureNotes?: string | null
  workoutDaysAvailable?: number | null
  currentWorkoutDaysPerWeek?: number | null
  currentWorkoutMinutesPerSession?: number | null
  currentTrainingIntensity?: string | null
  workoutSchedulePreference?: string | null
}

const nonNegotiableOptions = [
  'Work',
  'School drop-off',
  'School pickup',
  'Commute',
  'Nursing or pumping',
  'Caregiving',
  'Appointments',
  'Dinner / family time',
  'Bedtime routine',
  'Training window',
  'Recovery window',
  'Other fixed commitments',
]

export default function DailyStructureAssessment({
  clientId,
  currentExecutionStyle,
  currentCarouselStyle,
  wakeTime,
  bedTime,
  workStartTime,
  workEndTime,
  preferredWorkoutTime,
  schoolDropoffTime,
  schoolPickupTime,
  lunchWindowTime,
  dinnerWindowTime,
  dailyNonNegotiables,
  dayStructureNotes,
  workoutDaysAvailable,
  currentWorkoutDaysPerWeek,
  currentWorkoutMinutesPerSession,
  currentTrainingIntensity,
  workoutSchedulePreference,
}: Props) {
  const [executionStyle, setExecutionStyle] = useState(
    currentExecutionStyle || 'flow'
  )

  const [carouselStyle, setCarouselStyle] = useState(
    currentCarouselStyle || 'section'
  )

  const [formData, setFormData] = useState({
    wake_time: wakeTime || '',
    bed_time: bedTime || '',
    work_start_time: workStartTime || '',
    work_end_time: workEndTime || '',
    preferred_workout_time: preferredWorkoutTime || '',
    school_dropoff_time: schoolDropoffTime || '',
    school_pickup_time: schoolPickupTime || '',
    lunch_window_time: lunchWindowTime || '',
    dinner_window_time: dinnerWindowTime || '',
    day_structure_notes: dayStructureNotes || '',
    workout_days_available: workoutDaysAvailable?.toString() || '',
    current_workout_days_per_week:
      currentWorkoutDaysPerWeek?.toString() || '',
    current_workout_minutes_per_session:
      currentWorkoutMinutesPerSession?.toString() || '',
    current_training_intensity: currentTrainingIntensity || '',
    workout_schedule_preference: workoutSchedulePreference || '',
  })

  const [selectedNonNegotiables, setSelectedNonNegotiables] = useState<string[]>(
    dailyNonNegotiables || []
  )

  const [status, setStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle')

  const [message, setMessage] = useState('')

  function updateField(name: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function toggleNonNegotiable(value: string) {
    setSelectedNonNegotiables((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    )
  }

  async function saveStructure() {
    try {
      setStatus('saving')
      setMessage('')

      const response = await fetch('/api/daily-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          execution_style: executionStyle,
          carousel_style:
            executionStyle === 'schedule' ? 'step' : carouselStyle,
          daily_non_negotiables: selectedNonNegotiables,
          ...formData,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Daily structure save failed')
      }

      setStatus('success')
      setMessage('Your daily structure has been saved.')
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Daily structure save failed'
      )
    }
  }

  return (
    <div style={{ display: 'grid', gap: '28px' }}>
      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          How do you want the system to guide you?
        </h2>

        <p style={styles.bodyStyle}>
          Choose the way your brain feels most supported. This controls whether
          your dashboard gives you exact timing, flexible blocks, or one next
          step at a time.
        </p>

        <div style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
          <Choice
            active={executionStyle === 'schedule'}
            title="Structured schedule"
            body="I feel best when things have target times and clear windows."
            onClick={() => {
              setExecutionStyle('schedule')
              setCarouselStyle('step')
            }}
          />

          <Choice
            active={executionStyle === 'flow'}
            title="Flexible rhythm"
            body="I need guidance, but I do not want my day to feel rigid."
            onClick={() => setExecutionStyle('flow')}
          />

          <Choice
            active={executionStyle === 'hybrid'}
            title="Hybrid"
            body="Some things need times, but the rest needs room to breathe."
            onClick={() => setExecutionStyle('hybrid')}
          />
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Dashboard style</h2>

        <p style={styles.bodyStyle}>
          Choose how much of the day you want to see at once.
        </p>

        <div style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
          <Choice
            active={carouselStyle === 'section'}
            title="Morning / Midday / Evening"
            body="Show me the day in larger sections so I can understand the rhythm."
            onClick={() => setCarouselStyle('section')}
          />

          <Choice
            active={carouselStyle === 'step'}
            title="One next step at a time"
            body="Only show me the next thing so I do not feel overloaded."
            onClick={() => setCarouselStyle('step')}
          />
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Time anchors</h2>

        <p style={styles.bodyStyle}>
          These help the system place meals, training, recovery, and check-ins
          where they actually fit.
        </p>

        <div style={styles.gridTwoCol}>
          <Field
            label="Wake time"
            value={formData.wake_time}
            onChange={(value) => updateField('wake_time', value)}
          />

          <Field
            label="Bed time"
            value={formData.bed_time}
            onChange={(value) => updateField('bed_time', value)}
          />

          <Field
            label="Work start time"
            value={formData.work_start_time}
            onChange={(value) => updateField('work_start_time', value)}
          />

          <Field
            label="Work end time"
            value={formData.work_end_time}
            onChange={(value) => updateField('work_end_time', value)}
          />

          <Field
            label="Preferred workout time"
            value={formData.preferred_workout_time}
            onChange={(value) =>
              updateField('preferred_workout_time', value)
            }
          />

          <Field
            label="Lunch window"
            value={formData.lunch_window_time}
            onChange={(value) => updateField('lunch_window_time', value)}
          />

          <Field
            label="Dinner window"
            value={formData.dinner_window_time}
            onChange={(value) => updateField('dinner_window_time', value)}
          />

          <Field
            label="School drop-off"
            value={formData.school_dropoff_time}
            onChange={(value) =>
              updateField('school_dropoff_time', value)
            }
          />

          <Field
            label="School pickup"
            value={formData.school_pickup_time}
            onChange={(value) =>
              updateField('school_pickup_time', value)
            }
          />
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Daily anchors / non-negotiables
        </h2>

        <p style={styles.bodyStyle}>
          These are the fixed pieces of your day — the things your plan needs to
          respect before anything else gets added.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '12px',
            marginTop: '22px',
            justifyItems: 'start',
          }}
        >
          {nonNegotiableOptions.map((option) => (
            <label
              key={option}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                width: 'fit-content',
                maxWidth: '100%',
                color: 'rgba(215,199,182,0.88)',
                lineHeight: 1.6,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selectedNonNegotiables.includes(option)}
                onChange={() => toggleNonNegotiable(option)}
                style={{
                  accentColor: '#b56e43',
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                }}
              />

              <span>{option}</span>
            </label>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
  <h2 style={styles.sectionTitleStyle}>
    Training capacity
  </h2>

  <p style={styles.bodyStyle}>
    This helps the dashboard decide when fitness programming should appear,
    how intense it should be, and whether workouts should be scheduled or
    simply suggested.
  </p>

  <div style={styles.gridTwoCol}>
    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle}>
        How many days per week could your life realistically hold training?
      </label>

      <select
        value={formData.workout_days_available}
        onChange={(e) =>
          updateField('workout_days_available', e.target.value)
        }
        style={styles.inputStyle}
      >
        <option value="">Select one</option>
        <option value="0">0 days right now</option>
        <option value="1">1 day</option>
        <option value="2">2 days</option>
        <option value="3">3 days</option>
        <option value="4">4 days</option>
        <option value="5">5 days</option>
        <option value="6">6 days</option>
        <option value="7">7 days</option>
      </select>
    </div>

    {Number(formData.workout_days_available) > 0 ? (
      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>
          How many days are you currently working out?
        </label>

        <select
          value={formData.current_workout_days_per_week}
          onChange={(e) =>
            updateField('current_workout_days_per_week', e.target.value)
          }
          style={styles.inputStyle}
        >
          <option value="">Select one</option>
          <option value="0">0 days</option>
          <option value="1">1 day</option>
          <option value="2">2 days</option>
          <option value="3">3 days</option>
          <option value="4">4 days</option>
          <option value="5">5 days</option>
          <option value="6">6 days</option>
          <option value="7">7 days</option>
        </select>
      </div>
    ) : null}
  </div>

  {Number(formData.workout_days_available) > 0 ? (
    <div style={styles.gridTwoCol}>
      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>
          How long are your workouts usually?
        </label>

        <select
          value={formData.current_workout_minutes_per_session}
          onChange={(e) =>
            updateField(
              'current_workout_minutes_per_session',
              e.target.value
            )
          }
          style={styles.inputStyle}
        >
          <option value="">Select one</option>
          <option value="15">About 15 minutes</option>
          <option value="30">About 30 minutes</option>
          <option value="45">About 45 minutes</option>
          <option value="60">About 1 hour</option>
          <option value="90">90 minutes or more</option>
        </select>
      </div>

      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>
          How intense do those workouts usually feel?
        </label>

        <select
          value={formData.current_training_intensity}
          onChange={(e) =>
            updateField('current_training_intensity', e.target.value)
          }
          style={styles.inputStyle}
        >
          <option value="">Select one</option>
          <option value="gentle">Gentle</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
          <option value="very-hard">Very hard</option>
        </select>
      </div>

      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>
          How do you want workouts to show up?
        </label>

        <select
          value={formData.workout_schedule_preference}
          onChange={(e) =>
            updateField('workout_schedule_preference', e.target.value)
          }
          style={styles.inputStyle}
        >
          <option value="">Select one</option>
          <option value="scheduled">Schedule them into my day</option>
          <option value="reminder">Remind me when it fits</option>
          <option value="suggested">Suggest them, but keep it flexible</option>
          <option value="hidden-for-now">
            Do not show workouts yet
          </option>
        </select>
      </div>
    </div>
  ) : null}
</section>
      
      <section style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Anything else the system should know?
        </h2>

        <textarea
          value={formData.day_structure_notes}
          onChange={(e) =>
            updateField('day_structure_notes', e.target.value)
          }
          style={styles.textareaStyle}
          placeholder="Example: My mornings are chaotic. I cannot train before school drop-off. I need evenings to be softer. My work schedule changes every week."
        />

        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            marginTop: '24px',
          }}
        >
          <button
            type="button"
            onClick={saveStructure}
            disabled={status === 'saving'}
            style={{
              ...styles.primaryButtonStyle,
              opacity: status === 'saving' ? 0.65 : 1,
            }}
          >
            {status === 'saving' ? 'Saving...' : 'Save Daily Structure'}
          </button>

          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>

        {message ? (
          <p
            style={{
              ...styles.bodyStyle,
              marginTop: '18px',
              color: status === 'error' ? '#ffb4b4' : '#c58b57',
            }}
          >
            {message}
          </p>
        ) : null}
      </section>
    </div>
  )
}

function Choice({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: 'none',
        borderRadius: '24px',
        padding: '22px',
        background: active
          ? 'rgba(181,110,67,0.14)'
          : 'rgba(255,255,255,0.035)',
        color: '#f5f0e8',
        cursor: 'pointer',
        boxShadow: active
          ? '0 18px 50px rgba(181,110,67,0.08)'
          : '0 18px 50px rgba(0,0,0,0.14)',
      }}
    >
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.12rem',
          fontWeight: 500,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: 'rgba(215,199,182,0.78)',
          lineHeight: 1.65,
        }}
      >
        {body}
      </p>
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.labelStyle}>{label}</label>

      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...styles.inputStyle,
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
    </div>
  )
}
