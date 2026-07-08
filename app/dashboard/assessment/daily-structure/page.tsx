import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyStructureAssessment from '@/components/DailyStructureAssessment'
import ScheduleBlockEditor from '@/components/ScheduleBlockEditor'

export default async function DailyStructureAssessmentPage() {
  const { client, supabase, user } = await getDashboardContext()
  const { data: scheduleBlocks } = await supabase.from('client_schedule_blocks').select('id,block_type,label,days_of_week,start_time,end_time').eq('client_id', client.client_id).eq('user_id', user.id).eq('active', true).order('start_time')

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
        <p className="aos-eyebrow">Daily Structure</p>
        <h1>Build the rhythm your day can actually hold.</h1>
        <p>
          This assessment helps your dashboard understand how you move through
          the day. Some women need exact times. Some need flexible blocks. Some
          need one next step at a time. This is where your system learns how to
          support you without overwhelming you.
        </p>
        </header>

        <DailyStructureAssessment
          clientId={client.client_id}
          currentExecutionStyle={client.execution_style}
          currentCarouselStyle={client.carousel_style}
          wakeTime={client.wake_time}
          bedTime={client.bed_time}
          workStartTime={client.work_start_time}
          workEndTime={client.work_end_time}
          preferredWorkoutTime={client.preferred_workout_time}
          schoolDropoffTime={client.school_dropoff_time}
          schoolPickupTime={client.school_pickup_time}
          lunchWindowTime={client.lunch_window_time}
          dinnerWindowTime={client.dinner_window_time}
          dailyNonNegotiables={client.daily_non_negotiables}
          dayStructureNotes={client.day_structure_notes}
          workoutDaysAvailable={client.workout_days_available}
          currentWorkoutDaysPerWeek={client.current_workout_days_per_week}
          currentWorkoutMinutesPerSession={client.current_workout_minutes_per_session}
          currentTrainingIntensity={client.current_training_intensity}
          workoutSchedulePreference={client.workout_schedule_preference}
        />
        <ScheduleBlockEditor clientId={client.client_id} initialBlocks={scheduleBlocks || []} />
      </div>
    </main>
  )
}
