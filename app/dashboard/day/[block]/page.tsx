import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import DayBlockCompletionForm from '@/components/DayBlockCompletionForm'

const blocks = ['morning', 'midday', 'evening'] as const
type Block = (typeof blocks)[number]

export default async function DayBlockPage({
  params,
}: {
  params: Promise<{ block: string }>
}) {
  const { block: rawBlock } = await params

  if (!blocks.includes(rawBlock as Block)) notFound()
  const block = rawBlock as Block

  const { supabase, client } = await getDashboardContext()
  const dailyPlan = await getDailyExecutionPlan({ supabase, client })
  const card = dailyPlan.cards.find((item: any) => item.id === block)

  if (!card) notFound()

  const { data: recoveryLog } = await supabase
    .from('recovery_logs')
    .select('daily_tasks')
    .eq('client_id', client.client_id)
    .eq('log_date', dailyPlan.date)
    .maybeSingle()

  const completedTasks = Array.isArray(recoveryLog?.daily_tasks) ? recoveryLog.daily_tasks : []
  const blockComplete = completedTasks.includes(`${block}-complete`)

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
          <p className="aos-eyebrow">Today&apos;s Intake</p>
          <h1>{card.title}</h1>
          <p>
            Complete the actions that apply to this part of your day. Saving the
            block updates the dashboard and today&apos;s completion logic.
          </p>
        </header>

        <AOSCard>
          <p className="aos-eyebrow">{card.timing}</p>
          <h2 className="aos-card-title">Your focus for this block</h2>
          <p className="aos-muted-copy">{card.body}</p>

          {card.macroTarget ? (
            <div className="aos-target-grid">
              <Target label="Protein" value={`${card.macroTarget.protein || 0}g`} />
              <Target label="Carbs" value={`${card.macroTarget.carbs || 0}g`} />
              <Target label="Fats" value={`${card.macroTarget.fats || 0}g`} />
              <Target label="Water" value={`${card.macroTarget.water || 0} oz`} />
            </div>
          ) : null}
        </AOSCard>

        <DayBlockCompletionForm
          clientId={client.client_id}
          block={block}
          items={card.items || []}
          initialCompleted={blockComplete}
        />

        {block === 'midday' ? (
          <AOSCard>
            <p className="aos-eyebrow">Training</p>
            <h2 className="aos-card-title">Workout stays accessible.</h2>
            <p className="aos-muted-copy">
              If training belongs in this block, open your workout. If not, use
              this block for food, water, and easy movement.
            </p>
            <Link href={`/dashboard/program/${client.program || 'ignite'}/workout`} className="aos-primary-link">
              Open Workout
            </Link>
          </AOSCard>
        ) : null}

        {block === 'evening' ? (
          <AOSCard>
            <p className="aos-eyebrow">Close the day</p>
            <h2 className="aos-card-title">Log your final signals.</h2>
            <p className="aos-muted-copy">
              Use the daily check-in to update symptoms, sleep, recovery, and
              how your body feels before tomorrow&apos;s plan is calculated.
            </p>
            <Link href="/dashboard/check-in" className="aos-primary-link">
              Evening Check-In
            </Link>
          </AOSCard>
        ) : null}

        <Link href="/dashboard" className="aos-secondary-link">
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}

function Target({ label, value }: { label: string; value: string }) {
  return (
    <div className="aos-target-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}
