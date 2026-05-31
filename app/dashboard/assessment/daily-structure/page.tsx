import * as styles from '../../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import DailyStructureAssessment from '@/components/DailyStructureAssessment'

export default async function DailyStructureAssessmentPage() {
  const { client } = await getDashboardContext()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Daily Structure</p>

        <h1 style={styles.heroTitleStyle}>
          Build the rhythm your day can actually hold.
        </h1>

        <p style={styles.heroTextStyle}>
          This assessment helps your dashboard understand how you move through
          the day. Some women need exact times. Some need flexible blocks. Some
          need one next step at a time. This is where your system learns how to
          support you without overwhelming you.
        </p>

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
        />
      </div>
    </main>
  )
}
