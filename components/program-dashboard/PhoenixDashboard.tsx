import * as styles from '@/app/styles/globalstyles'
import DailyInsightCard from '@/components/DailyInsightCard'
import PhoenixExecutionFlow, { type PhoenixTask } from '@/components/program-dashboard/PhoenixExecutionFlow'
import PhoenixDock from '@/components/program-dashboard/PhoenixDock'

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
  dailyPlan?: any
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
  dailyPlan,
}: PhoenixDashboardProps) {
  const directive = getDirective({ todaysWorkout, signals: decisionSignals })
  const copy = getDirectiveCopy(directive, Boolean(cycleAdjustment?.cautionActive))
  const tasks = buildTasks({ client, todaysWorkout, directive })

  return (
    <main style={styles.pageStyle}>
      <PhoenixDock />
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

        <PhoenixExecutionFlow
          clientId={client.client_id}
          executionStyle={client.execution_style || 'flow'}
          dashboardStyle={client.carousel_style || 'step'}
          tasks={tasks}
        />

        {insight ? (
          <section style={optionalSectionStyle}>
            <DailyInsightCard insight={insight} compact />
          </section>
        ) : null}
      </div>
    </main>
  )
}

function buildTasks({ client, todaysWorkout, directive }: { client: any; todaysWorkout?: any; directive: Directive }): PhoenixTask[] {
  const program = client.program || 'phoenix'
  const wake = cleanTime(client.wake_time, '07:00')
  const workout = cleanTime(client.preferred_workout_time, '09:00')
  const lunch = cleanTime(client.lunch_window_time, '12:00')
  const dinner = cleanTime(client.dinner_window_time, '18:00')
  const bed = cleanTime(client.bed_time, '22:00')
  const tasks: PhoenixTask[] = []

  if (directive === 'symptoms') tasks.push(task('body-signal', 'Log what your body is saying', 'This signal comes before the rest of the plan.', 'morning', wake, '/dashboard/symptoms', 'Log Body Signal'))
  if (directive === 'nutrition') tasks.push(task('nourish-first', 'Nourish first', 'Upload or log one supportive meal. Nothing more is required yet.', 'morning', wake, '/dashboard/nutrition', 'Open Nutrition'))
  if (directive === 'photos') tasks.push(task('requested-photos', 'Complete the requested photo check', 'This gives the system what it needs for the next adjustment.', 'morning', wake, '/dashboard/assessment/photos', 'Upload Photos'))

  tasks.push(task('hydrate', 'Drink water', 'Start with one glass or bottle.', 'morning', wake, '/dashboard/nutrition', 'Log Water'))
  tasks.push(task('first-meal', 'Eat your first supportive meal', 'Keep it simple and protein-forward.', 'morning', later(wake, 90), '/dashboard/nutrition', 'Log Food'))

  if (todaysWorkout && directive !== 'symptoms' && directive !== 'nutrition' && directive !== 'photos') {
    tasks.push(task('workout', 'Complete today’s adjusted workout', 'Do the assigned work, then stop.', blockFor(workout), workout, `/dashboard/program/${program}/workout`, 'Start Workout'))
  }

  tasks.push(task('midday-meal', 'Nourish the middle of your day', 'Log the meal and let the system handle the numbers.', 'midday', lunch, '/dashboard/nutrition', 'Log Food'))
  tasks.push(task('evening-meal', 'Eat your recovery meal', 'Choose the easiest supportive dinner available.', 'evening', dinner, '/dashboard/nutrition', 'Log Food'))
  tasks.push(task('recovery', todaysWorkout ? 'Close the day with recovery' : 'Recovery is the work today', 'Choose one recovery action your body can receive.', 'evening', earlier(bed, 60), '/dashboard/recovery', 'Log Recovery'))

  return tasks
}

function task(id: string, title: string, detail: string, block: PhoenixTask['block'], time: string, href: string, actionLabel: string): PhoenixTask { return { id, title, detail, block, time, href, actionLabel } }
function cleanTime(value: string | null | undefined, fallback: string) { return /^\d{2}:\d{2}/.test(value || '') ? String(value).slice(0, 5) : fallback }
function later(time: string, minutes: number) { const [h, m] = time.split(':').map(Number); const total = Math.min(1439, h * 60 + m + minutes); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
function earlier(time: string, minutes: number) { const [h, m] = time.split(':').map(Number); const total = Math.max(0, h * 60 + m - minutes); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
function blockFor(time: string): PhoenixTask['block'] { const hour = Number(time.split(':')[0]); return hour < 10 ? 'morning' : hour < 15 ? 'midday' : 'evening' }

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
