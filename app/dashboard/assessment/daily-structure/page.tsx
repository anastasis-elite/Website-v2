import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyStructureAssessment from '@/components/DailyStructureAssessment'
import ScheduleBlockEditor from '@/components/ScheduleBlockEditor'
import Link from 'next/link'
import {
  getScheduleStructureMonth,
  getScheduleStructureSubmission,
  scheduleStructureMonthlyTask,
  scheduleStructureTaskKey,
  SCHEDULE_STRUCTURE_PATH,
  SCHEDULE_STRUCTURE_VERSION,
} from '@/lib/assessment/scheduleStructure'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { getCommitmentWeekdays, type CommitmentDayField } from '@/lib/assessment/commitmentWeekdays'

type SearchParams = {
  eventId?: string | string[]
  assessmentVersion?: string | string[]
}

export default async function DailyStructureAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const query = await searchParams
  const eventId = typeof query.eventId === 'string' ? query.eventId : undefined
  const requestedVersion = typeof query.assessmentVersion === 'string'
    ? Number(query.assessmentVersion)
    : NaN
  const assessmentVersion = Number.isSafeInteger(requestedVersion) && requestedVersion > 0
    ? requestedVersion
    : SCHEDULE_STRUCTURE_VERSION
  const { client, supabase, user } = await getDashboardContext()
  const month = eventId ? getScheduleStructureMonth(eventId) : getClientLocalDate(client).slice(0, 7)
  const task = {
    ...(month ? scheduleStructureMonthlyTask(month) : {
      id: eventId!, event_type: 'assessment', source: 'system',
    }),
    action_route: `${SCHEDULE_STRUCTURE_PATH}?assessmentVersion=${assessmentVersion}`,
  }
  const taskKey = scheduleStructureTaskKey(task)
  const submission = getScheduleStructureSubmission(client.onboarding_data, task)
  // Current-profile defaults may predate this assessment. Reopen its persisted
  // answers rather than replacing them with an older profile's training values.
  const preferences = submission ? { ...client, ...submission.answers } : client
  const completedAt = submission?.submittedAt
  const commitmentDays = (field: CommitmentDayField) => {
    if (!submission) return getCommitmentWeekdays(client, field)
    // Historical assessment days belong to its saved answers. Missing legacy
    // days must not inherit a later routine edit; the form shows all seven.
    const value = submission.answers[field]
    return Array.isArray(value) && value.every(day => typeof day === 'number') ? value as number[] : undefined
  }
  const { data: scheduleBlocks } = await supabase.from('client_schedule_blocks').select('id,block_type,label,days_of_week,start_time,end_time').eq('client_id', client.client_id).eq('user_id', user.id).eq('active', true).order('start_time')

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <nav aria-label="Schedule settings"><Link href="/dashboard/schedule">Schedule</Link> · <Link href="/dashboard/schedule/settings">Settings</Link> · Schedule Structure Assessment</nav>
        <header className="aos-flow-hero">
        <p className="aos-eyebrow">Schedule Structure Assessment</p>
        <h1>Build the rhythm your day can actually hold.</h1>
        <p>
          Choose how you prefer to move through your day: exact times, flexible
          blocks, or one next step at a time. Your saved preferences help shape
          how your dashboard presents the day. {completedAt
            ? 'This assessment is complete. Your saved answers are available below.'
            : 'Select Complete Assessment to save your answers, complete this task, and return to your next step.'}
        </p>
        </header>

        <DailyStructureAssessment
          key={`${assessmentVersion}:${taskKey}:${completedAt || 'pending'}`}
          clientId={client.client_id}
          scheduleTimezone={getClientTimeZone(client)}
          eventId={task.id}
          assessmentVersion={assessmentVersion}
          completedAt={completedAt}
          currentExecutionStyle={preferences.execution_style}
          currentCarouselStyle={preferences.carousel_style}
          wakeTime={preferences.wake_time}
          bedTime={preferences.bed_time}
          workStartTime={preferences.work_start_time}
          workEndTime={preferences.work_end_time}
          workDaysOfWeek={commitmentDays('work_days_of_week')}
          preferredWorkoutTime={preferences.preferred_workout_time}
          schoolDropoffTime={preferences.school_dropoff_time}
          schoolPickupTime={preferences.school_pickup_time}
          schoolDropoffDaysOfWeek={commitmentDays('school_dropoff_days_of_week')}
          schoolPickupDaysOfWeek={commitmentDays('school_pickup_days_of_week')}
          lunchWindowTime={preferences.lunch_window_time}
          dinnerWindowTime={preferences.dinner_window_time}
          dailyNonNegotiables={preferences.daily_non_negotiables}
          dayStructureNotes={preferences.day_structure_notes}
          workoutDaysAvailable={preferences.workout_days_available}
          currentWorkoutDaysPerWeek={preferences.current_workout_days_per_week}
          currentWorkoutMinutesPerSession={preferences.current_workout_minutes_per_session}
          currentTrainingIntensity={preferences.current_training_intensity}
          workoutSchedulePreference={preferences.workout_schedule_preference}
        />
        <section aria-label="Optional recurring commitments">
          <p className="aos-flow-intro">
            Recurring commitments are optional and have their own save action.
            Save any commitment changes here separately from completing your assessment.
            Recurring commitments use their own selected days and replace matching time anchors in your schedule.
          </p>
          <ScheduleBlockEditor clientId={client.client_id} initialBlocks={scheduleBlocks || []} />
        </section>
      </div>
    </main>
  )
}
