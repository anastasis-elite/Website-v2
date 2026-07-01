import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import DailyInsightCard from '@/components/DailyInsightCard'
import WorkoutTracker from '@/components/WorkoutTracker'

type DecisionSignals = {
  symptomsElevated?: boolean
  nutritionPriority?: boolean
  photoAssessmentDue?: boolean
}

type PhoenixDashboardProps = {
  client: any
  todaysWorkout?: any
  adjustedExercises?: any[]
  cycleAdjustment?: {
    label: string
    note: string
    cautionActive?: boolean
  }
  phoenixTrackLabel?: string
  insight?: any
  decisionSignals?: DecisionSignals
}

type Directive = 'symptoms' | 'nutrition' | 'photos' | 'training' | 'recovery'

function getFirstName(name?: string | null) {
  return name?.split(' ')[0] || 'Your'
}

function getDirective({
  todaysWorkout,
  signals,
}: {
  todaysWorkout?: any
  signals: DecisionSignals
}): Directive {
  if (signals.symptomsElevated) return 'symptoms'
  if (signals.nutritionPriority) return 'nutrition'
  if (signals.photoAssessmentDue) return 'photos'
  return todaysWorkout ? 'training' : 'recovery'
}

export default function PhoenixDashboard({
  client,
  todaysWorkout,
  adjustedExercises = [],
  cycleAdjustment,
  phoenixTrackLabel,
  insight,
  decisionSignals = {},
}: PhoenixDashboardProps) {
  const directive = getDirective({ todaysWorkout, signals: decisionSignals })
  const copy = getDirectiveCopy(directive, Boolean(cycleAdjustment?.cautionActive))

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>
          Phoenix · {phoenixTrackLabel || 'Personalized'}
        </p>

        <h1 style={styles.heroTitleStyle}>
          {getFirstName(client?.full_name)}, today is already simplified.
        </h1>

        <p style={styles.heroTextStyle}>
          You do not need to manage the whole plan. Just follow the next step.
        </p>

        <section style={primaryCardStyle}>
          <p style={styles.eyebrowStyle}>Today’s Directive</p>
          <h2 style={styles.sectionTitleStyle}>{copy.directive}</h2>
          <p style={styles.bodyStyle}>{copy.reassurance}</p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Why This Matters</p>
          <h2 style={styles.sectionTitleStyle}>{copy.reasonTitle}</h2>
          <p style={styles.bodyStyle}>
            {cycleAdjustment?.note || copy.reason}
          </p>
          {cycleAdjustment?.label ? (
            <p style={signalStyle}>{cycleAdjustment.label}</p>
          ) : null}
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Your One Action</p>
          <h2 style={styles.sectionTitleStyle}>{copy.actionTitle}</h2>
          <PrimaryAction
            directive={directive}
            client={client}
            todaysWorkout={todaysWorkout}
            adjustedExercises={adjustedExercises}
          />
        </section>

        <section style={optionalSectionStyle}>
          <p style={styles.eyebrowStyle}>Optional Support</p>
          <h2 style={styles.sectionTitleStyle}>Only if it would make today easier.</h2>
          <p style={styles.bodyStyle}>These are available, but none of them are extra assignments.</p>

          <div style={styles.buttonRowStyle}>
            <Link href="/dashboard/nutrition" style={styles.secondaryButtonStyle}>Upload Food</Link>
            <Link href="/dashboard/symptoms" style={styles.secondaryButtonStyle}>Log a Body Signal</Link>
            {decisionSignals.photoAssessmentDue ? (
              <Link href="/dashboard/assessment/photos" style={styles.secondaryButtonStyle}>Upload Requested Photos</Link>
            ) : null}
          </div>

          {insight ? (
            <div style={{ marginTop: '28px' }}>
              <DailyInsightCard insight={insight} compact />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function PrimaryAction({
  directive,
  client,
  todaysWorkout,
  adjustedExercises,
}: {
  directive: Directive
  client: any
  todaysWorkout?: any
  adjustedExercises: any[]
}) {
  if (directive === 'training' && todaysWorkout && adjustedExercises.length) {
    return (
      <WorkoutTracker
        clientId={client.client_id}
        authUserId={client.auth_user_id}
        program={client.program || 'phoenix'}
        dayName={todaysWorkout.day_name}
        exercises={adjustedExercises}
      />
    )
  }

  const action = directive === 'symptoms'
    ? { href: '/dashboard/symptoms', label: 'Log Body Signals' }
    : directive === 'nutrition'
      ? { href: '/dashboard/nutrition', label: 'Upload Food' }
      : directive === 'photos'
        ? { href: '/dashboard/assessment/photos', label: 'Upload Photos' }
        : { href: '/dashboard/recovery', label: 'Begin Recovery' }

  return <Link href={action.href} style={styles.primaryButtonStyle}>{action.label}</Link>
}

function getDirectiveCopy(directive: Directive, cycleCaution: boolean) {
  if (directive === 'symptoms') return {
    directive: 'Log symptoms. Your body is asking for adjustment.',
    reassurance: 'Training can wait until the system understands what changed.',
    reasonTitle: 'Your signals take priority today.',
    reason: 'Elevated symptoms are useful information, not something to push through.',
    actionTitle: 'Tell the system what your body is saying.',
  }
  if (directive === 'nutrition') return {
    directive: 'Nourish first. Training can wait.',
    reassurance: 'One supportive meal is enough to move today forward.',
    reasonTitle: 'Fuel is the limiting factor today.',
    reason: 'The system is protecting progress by restoring support before asking for output.',
    actionTitle: 'Upload the next thing you eat.',
  }
  if (directive === 'photos') return {
    directive: 'Upload the requested photos. Nothing else is required.',
    reassurance: 'This gives the system what it needs to adjust the plan for you.',
    reasonTitle: 'A visual check will answer the next question.',
    reason: 'Photos are only requested when they can meaningfully improve the next adjustment.',
    actionTitle: 'Complete the requested photo check.',
  }
  if (directive === 'training') return {
    directive: cycleCaution ? 'Train lighter today, then stop.' : 'Train today, then stop.',
    reassurance: 'The work below is enough. You do not need to add anything.',
    reasonTitle: cycleCaution ? 'The plan has already reduced today’s demand.' : 'Today supports focused training.',
    reason: 'The assigned workout reflects the information the system has today.',
    actionTitle: 'Complete the adjusted workout below.',
  }
  return {
    directive: 'Recover today. Nothing extra is required.',
    reassurance: 'Rest is part of the plan, not a gap in it.',
    reasonTitle: 'Recovery is the productive choice today.',
    reason: 'There is no assigned workout, so the system is protecting adaptation instead of creating more work.',
    actionTitle: 'Choose the recommended recovery step.',
  }
}

const primaryCardStyle = {
  ...styles.cartBoxStyle,
  background: 'linear-gradient(145deg, rgba(181,110,67,0.13), rgba(18,18,18,0.72))',
  border: '1px solid rgba(181,110,67,0.25)',
} as const

const optionalSectionStyle = { ...styles.sectionStyle, marginBottom: '42px' } as const
const signalStyle = { ...styles.eyebrowStyle, margin: '18px 0 0' } as const
