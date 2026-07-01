import { redirect } from 'next/navigation'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import WorkoutTracker from '@/components/WorkoutTracker'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function ProgramWorkoutPage({ params }: { params: { program: string } }) {
  if (!supportedPrograms.includes(params.program)) redirect('/dashboard')

  const { supabase, client } = await getDashboardContext()
  const program = client.program || 'ignite'
  if (program !== params.program) redirect(`/dashboard/program/${program}/workout`)

  const { data: output } = await supabase
    .from('program_outputs').select('*')
    .eq('client_id', client.client_id).eq('program', program)
    .order('generated_at', { ascending: false }).limit(1).maybeSingle()
  const { todaysWorkout, adjustedExercises, cycleAdjustment } = getProgramWorkout({ client, output })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>{program} · Today’s Workout</p>
        <h1 style={styles.heroTitleStyle}>{todaysWorkout ? todaysWorkout.day_name : 'Recovery day'}</h1>
        <p style={styles.heroTextStyle}>{cycleAdjustment.label}: {cycleAdjustment.note}</p>
        <section style={styles.cartBoxStyle}>
          {todaysWorkout && adjustedExercises.length ? (
            <WorkoutTracker clientId={client.client_id} authUserId={client.auth_user_id} program={output?.program || program} dayName={todaysWorkout.day_name} exercises={adjustedExercises} />
          ) : <p style={styles.bodyStyle}>There is no assigned workout today. Nourish, hydrate, and recover.</p>}
        </section>
        <Link href={`/dashboard/program/${program}`} style={styles.secondaryButtonStyle}>Back to Dashboard</Link>
      </div>
    </main>
  )
}
