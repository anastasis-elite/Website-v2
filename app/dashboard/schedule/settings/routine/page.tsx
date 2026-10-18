import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyStructureAssessment from '@/components/DailyStructureAssessment'
import { getCommitmentWeekdays } from '@/lib/assessment/commitmentWeekdays'
import { getClientTimeZone } from '@/lib/timezone'

export default async function EditRoutinePage() {
  const { client } = await getDashboardContext()
  return <main className="aos-flow-page"><div className="aos-flow-shell">
    <nav aria-label="Schedule settings"><Link href="/dashboard/schedule">Schedule</Link> · <Link href="/dashboard/schedule/settings">Settings</Link> · Edit My Routine</nav>
    <header className="aos-flow-hero"><p className="aos-eyebrow">Your daily rhythm</p><h1>Edit My Routine</h1><p>Make room for the life you have today. Your saved assessment remains available to review.</p><Link href="/dashboard/assessment/daily-structure">Review Schedule Structure Assessment</Link></header>
    <DailyStructureAssessment key={Number(client.onboarding_data?.routinePreferences?.revision || 0)} mode="routine"
      routineRevision={Number(client.onboarding_data?.routinePreferences?.revision || 0)} clientId={client.client_id}
      scheduleTimezone={getClientTimeZone(client)}
      currentExecutionStyle={client.execution_style} currentCarouselStyle={client.carousel_style}
      wakeTime={client.wake_time} bedTime={client.bed_time} workStartTime={client.work_start_time} workEndTime={client.work_end_time}
      workDaysOfWeek={getCommitmentWeekdays(client, 'work_days_of_week')}
      preferredWorkoutTime={client.preferred_workout_time} schoolDropoffTime={client.school_dropoff_time} schoolPickupTime={client.school_pickup_time}
      schoolDropoffDaysOfWeek={getCommitmentWeekdays(client, 'school_dropoff_days_of_week')}
      schoolPickupDaysOfWeek={getCommitmentWeekdays(client, 'school_pickup_days_of_week')}
      lunchWindowTime={client.lunch_window_time} dinnerWindowTime={client.dinner_window_time} dailyNonNegotiables={client.daily_non_negotiables}
      dayStructureNotes={client.day_structure_notes} workoutDaysAvailable={client.workout_days_available}
      currentWorkoutDaysPerWeek={client.current_workout_days_per_week} currentWorkoutMinutesPerSession={client.current_workout_minutes_per_session}
      currentTrainingIntensity={client.current_training_intensity} workoutSchedulePreference={client.workout_schedule_preference} />

  </div></main>
}
