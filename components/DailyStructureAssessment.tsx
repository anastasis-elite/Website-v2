'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import { SCHEDULE_STRUCTURE_VERSION } from '@/lib/assessment/scheduleStructure'
import { validateScheduleStructure } from '@/lib/assessment/validateScheduleStructure'
import { announceCalendarChange } from '@/lib/calendar/client'
import { ALL_COMMITMENT_WEEKDAYS, COMMITMENT_WEEKDAYS, type CommitmentDayField } from '@/lib/assessment/commitmentWeekdays'

type Props = {
  clientId: string
  eventId?: string
  assessmentVersion?: number
  completedAt?: string
  mode?: 'assessment' | 'routine'
  routineRevision?: number
  scheduleTimezone?: string
  currentExecutionStyle?: string | null
  currentCarouselStyle?: string | null
  wakeTime?: string | null
  bedTime?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  workDaysOfWeek?: number[] | null
  preferredWorkoutTime?: string | null
  schoolDropoffTime?: string | null
  schoolPickupTime?: string | null
  schoolDropoffDaysOfWeek?: number[] | null
  schoolPickupDaysOfWeek?: number[] | null
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
  eventId,
  assessmentVersion = SCHEDULE_STRUCTURE_VERSION,
  completedAt,
  mode = 'assessment',
  routineRevision = 0,
  scheduleTimezone,
  currentExecutionStyle,
  currentCarouselStyle,
  wakeTime,
  bedTime,
  workStartTime,
  workEndTime,
  workDaysOfWeek,
  preferredWorkoutTime,
  schoolDropoffTime,
  schoolPickupTime,
  schoolDropoffDaysOfWeek,
  schoolPickupDaysOfWeek,
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
  const router = useRouter()
  const submitting = useRef(false)
  const [executionStyle, setExecutionStyle] = useState(
    currentExecutionStyle || ''
  )

  const [carouselStyle, setCarouselStyle] = useState(
    currentCarouselStyle || ''
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
  const initialDays = (days: number[] | null | undefined, hasTime: boolean) =>
    Array.isArray(days) ? [...days] : hasTime ? [...ALL_COMMITMENT_WEEKDAYS] : []
  const [commitmentDays, setCommitmentDays] = useState<Record<CommitmentDayField, number[]>>(() => ({
    work_days_of_week: initialDays(workDaysOfWeek, Boolean(workStartTime || workEndTime)),
    school_dropoff_days_of_week: initialDays(schoolDropoffDaysOfWeek, Boolean(schoolDropoffTime)),
    school_pickup_days_of_week: initialDays(schoolPickupDaysOfWeek, Boolean(schoolPickupTime)),
  }))
  const hasLegacyCommitmentDays = Boolean(
    ((workStartTime || workEndTime) && !Array.isArray(workDaysOfWeek)) ||
    (schoolDropoffTime && !Array.isArray(schoolDropoffDaysOfWeek)) ||
    (schoolPickupTime && !Array.isArray(schoolPickupDaysOfWeek))
  )
  const commitmentDayGroups = [
    { field: 'work_days_of_week', label: 'Work days', active: Boolean(formData.work_start_time || formData.work_end_time) },
    { field: 'school_dropoff_days_of_week', label: 'School drop-off days', active: Boolean(formData.school_dropoff_time) },
    { field: 'school_pickup_days_of_week', label: 'School pickup days', active: Boolean(formData.school_pickup_time) },
  ] as const

  const [status, setStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle')

  const [message, setMessage] = useState('')
  const editingRoutine = mode === 'routine'
  const isCompleted = (!editingRoutine && Boolean(completedAt)) || status === 'success'

  function clearFeedback() {
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }

  function updateField(name: string, value: string) {
    clearFeedback()
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function toggleNonNegotiable(value: string) {
    clearFeedback()
    setSelectedNonNegotiables((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    )
  }

  function toggleCommitmentDay(field: CommitmentDayField, day: number) {
    clearFeedback()
    setCommitmentDays(current => ({ ...current, [field]: current[field].includes(day)
      ? current[field].filter(value => value !== day)
      : [...current[field], day].sort((left, right) => left - right) }))
  }

  async function submitAssessment() {
    if (isCompleted || submitting.current) return

    const validation = validateScheduleStructure({
      execution_style: executionStyle,
      carousel_style: carouselStyle,
      daily_non_negotiables: selectedNonNegotiables,
      ...formData,
      ...commitmentDays,
    })

    if ('error' in validation) {
      setStatus('error')
      setMessage(validation.error)
      return
    }

    submitting.current = true
    try {
      setStatus('saving')
      setMessage('')

      const response = await fetch(editingRoutine ? '/api/daily-structure/routine' : '/api/daily-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit',
          client_id: clientId,
          assessmentVersion,
          expected_revision: routineRevision,
          ...(eventId ? { eventId } : {}),
          ...validation.answers,
        }),
      })

      const data = await response.json().catch(() => null)
      if (response.status === 409) router.refresh()

      if (editingRoutine) {
        if (!response.ok || data?.success !== true || !data.routine ||
          data.routine.revision !== routineRevision + 1 || !Number.isFinite(Date.parse(data.routine.savedAt))) {
          throw new Error(data?.error || 'Your routine could not be saved. Please try again.')
        }
      } else if (
        !response.ok ||
        data?.success !== true ||
        !data.submission ||
        typeof data.submission !== 'object' ||
        Array.isArray(data.submission) ||
        data.submission.assessmentVersion !== assessmentVersion ||
        (eventId && data.submission.eventId !== eventId) ||
        typeof data.submission.submittedAt !== 'string' ||
        !Number.isFinite(Date.parse(data.submission.submittedAt))
      ) {
        throw new Error(data?.error || 'Your assessment could not be submitted. Please try again.')
      }

      setStatus('success')
      setMessage(editingRoutine ? 'Routine saved. Returning to your schedule…' : 'Assessment completed. Returning to your schedule…')
      announceCalendarChange()
      router.push('/dashboard/schedule')
      router.refresh()
    } catch (error) {
      submitting.current = false
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Your assessment could not be submitted. Please try again.'
      )
    }
  }

  return (
    <form
      className="rhythm-form"
      aria-label={editingRoutine ? 'Edit My Routine' : 'Schedule Structure Assessment'}
      aria-describedby="schedule-structure-guidance"
      aria-busy={status === 'saving'}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submitAssessment()
      }}
      style={{ display: 'grid', gap: '28px' }}
    >
      <p id="schedule-structure-guidance" style={styles.bodyStyle}>
        {isCompleted ? (
          <><strong>Assessment completed.</strong> Your saved answers are shown below. You can return to your dashboard or Schedule to continue.</>
        ) : editingRoutine ? (
          <>Adjust your everyday rhythm, then select Save routine. Your previous assessment responses and completed activities stay saved.</>
        ) : (
          <>Choose your rhythm, dashboard style, wake and bed times, and training capacity. Other anchors and notes are optional. Add both work times for a work window, then select Complete Assessment.</>
        )}
      </p>
      <fieldset
        disabled={isCompleted || status === 'saving'}
        style={{ display: 'grid', gap: '28px', border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
      <section className="rhythm-section" style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Your rhythm
        </h2>

        <p style={styles.bodyStyle}>
          Choose the way your brain feels most supported. This controls whether
          your dashboard gives you exact timing, flexible blocks, or one next
          step at a time.
        </p>

        <div className="rhythm-choices" style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
          <Choice
            active={executionStyle === 'schedule'}
            title="Structured schedule"
            body="Same flow each day."
            onClick={() => {
              clearFeedback()
              setExecutionStyle('schedule')
              setCarouselStyle('step')
            }}
          />

          <Choice
            active={executionStyle === 'flow'}
            title="Flexible rhythm"
            body="Adapt as needed."
            onClick={() => {
              clearFeedback()
              setExecutionStyle('flow')
            }}
          />

          <Choice
            active={executionStyle === 'hybrid'}
            title="Hybrid"
            body="Structure with flexibility."
            onClick={() => {
              clearFeedback()
              setExecutionStyle('hybrid')
            }}
          />
        </div>
      </section>

      <section className="rhythm-section" style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Dashboard style</h2>

        <p style={styles.bodyStyle}>
          Choose how much of the day you want to see at once.
        </p>

        <div className="rhythm-choices" style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
          <Choice
            active={carouselStyle === 'section'}
            title="Morning / Midday / Evening"
            body="See your whole day at a glance."
            onClick={() => {
              clearFeedback()
              setCarouselStyle('section')
            }}
          />

          <Choice
            active={carouselStyle === 'step'}
            title="One next step at a time"
            body="Focus on what’s next."
            onClick={() => {
              clearFeedback()
              setCarouselStyle('step')
            }}
          />
        </div>
      </section>

      <section className="rhythm-section" style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>Time anchors</h2>

        <p style={styles.bodyStyle}>
          These help the system place meals, training, recovery, and check-ins
          where they actually fit. Choose the days your fixed time anchors repeat.
        </p>
        {hasLegacyCommitmentDays ? <p style={styles.bodyStyle}>Existing time anchors without saved days repeat every day. Choose days and Save routine to change future occurrences.{isCompleted ? <> <Link href="/dashboard/schedule/settings/routine">Edit my routine</Link></> : null}</p> : null}

        <div style={styles.gridTwoCol}>
          <Field
            label="Wake time"
            required
            value={formData.wake_time}
            onChange={(value) => updateField('wake_time', value)}
          />

          <Field
            label="Bed time"
            required
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
        <div style={{ display: 'grid', gap: 20, marginTop: 24 }}>
          <p style={styles.bodyStyle}>{scheduleTimezone ? `Days and times follow your schedule time zone: ${scheduleTimezone}.` : 'Days and times follow your schedule time zone.'}</p>
          {commitmentDayGroups.map(group => <fieldset key={group.field} aria-label={group.label} disabled={!group.active}
            style={{ border: '1px solid rgba(181,110,67,0.2)', borderRadius: 14, padding: 16, margin: 0, minWidth: 0 }}>
            <legend style={styles.labelStyle}>{group.label}</legend>
            <p style={{ ...styles.bodyStyle, marginTop: 0 }}>{group.active ? 'Choose every day this time anchor repeats.' : 'Add its time above to choose days.'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COMMITMENT_WEEKDAYS.map(day => <label key={day.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 10px', borderRadius: 8, color: '#f5f0e8', background: commitmentDays[group.field].includes(day.value) ? 'rgba(181,110,67,0.14)' : 'rgba(255,255,255,0.035)', cursor: group.active ? 'pointer' : 'default' }}>
                <input type="checkbox" name={group.field} value={day.value} aria-label={day.label}
                  checked={commitmentDays[group.field].includes(day.value)} onChange={() => toggleCommitmentDay(group.field, day.value)}
                  style={{ width: 20, height: 20, accentColor: '#b56e43' }} />
                <span>{day.shortLabel}</span>
              </label>)}
            </div>
          </fieldset>)}
        </div>
      </section>

      <section className="rhythm-section" style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Non-negotiables
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

      <section className="rhythm-section" style={styles.cartBoxStyle}>
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
      <label htmlFor="workout-days-available" style={styles.labelStyle}>
        How many days per week could your life realistically hold training?
      </label>

      <select
        id="workout-days-available"
        required
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
        <label htmlFor="current-workout-days-per-week" style={styles.labelStyle}>
          How many days are you currently working out?
        </label>

        <select
          id="current-workout-days-per-week"
          required
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
        <label htmlFor="current-workout-minutes-per-session" style={styles.labelStyle}>
          How long are your workouts usually?
        </label>

        <select
          id="current-workout-minutes-per-session"
          required
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
        <label htmlFor="current-training-intensity" style={styles.labelStyle}>
          How intense do those workouts usually feel?
        </label>

        <select
          id="current-training-intensity"
          required
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
        <label htmlFor="workout-schedule-preference" style={styles.labelStyle}>
          How do you want workouts to show up?
        </label>

        <select
          id="workout-schedule-preference"
          required
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
      
      <section className="rhythm-section" style={styles.cartBoxStyle}>
        <h2 style={styles.sectionTitleStyle}>
          Anything else the system should know?
        </h2>

        <textarea
          aria-label="Anything else the system should know?"
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
          {!isCompleted ? (
            <button
              type="submit"
              disabled={status === 'saving'}
              style={{
                ...styles.primaryButtonStyle,
                opacity: status === 'saving' ? 0.65 : 1,
              }}
            >
              {editingRoutine ? status === 'saving' ? 'Saving…' : 'Save routine' : status === 'saving' ? 'Completing…' : 'Complete Assessment'}
            </button>
          ) : null}

          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
          <Link href="/dashboard/schedule" style={styles.secondaryButtonStyle}>
            Back to Schedule
          </Link>
        </div>

        {message ? (
          <p
            role={status === 'error' ? 'alert' : 'status'}
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
      </fieldset>
    </form>
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
      className="rhythm-choice"
      aria-pressed={active}
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
  required = false,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.labelStyle}>{label}{required ? ' (required)' : ''}</span>

      <input
        type="time"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...styles.inputStyle,
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
    </label>
  )
}
