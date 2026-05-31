import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as styles from '../../../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'

export default async function DayBlockPage({
  params,
}: {
  params: Promise<{ block: string }>
}) {
  const { block } = await params

  if (!['morning', 'midday', 'evening'].includes(block)) {
    notFound()
  }

  const { supabase, client } = await getDashboardContext()

  const dailyPlan = await getDailyExecutionPlan({
    supabase,
    client,
  })

  const card = dailyPlan.cards.find((item: any) => item.id === block)

  if (!card) {
    notFound()
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Today’s Flow</p>

        <h1 style={styles.heroTitleStyle}>{card.title}</h1>

        <p style={styles.heroTextStyle}>
          This is the part of the day you are in. Complete what fits, leave what
          does not, and let the system support the next best step.
        </p>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>{card.timing}</p>

          <h2 style={styles.sectionTitleStyle}>
            Your focus for this block
          </h2>

          <p style={styles.bodyStyle}>{card.body}</p>

          {card.macroTarget ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '14px',
                marginTop: '28px',
              }}
            >
              <Target label="Protein" value={`${card.macroTarget.protein || 0}g`} />
              <Target label="Carbs" value={`${card.macroTarget.carbs || 0}g`} />
              <Target label="Fats" value={`${card.macroTarget.fats || 0}g`} />
              <Target label="Water" value={`${card.macroTarget.water || 0} oz`} />
            </div>
          ) : null}
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Block Checklist</h2>

          <div
            style={{
              display: 'grid',
              gap: '16px',
              marginTop: '18px',
            }}
          >
            {card.items?.map((item: string, index: number) => (
              <label
                key={index}
                style={{
                  ...styles.bodyStyle,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  style={{
                    marginTop: '7px',
                    accentColor: '#b56e43',
                  }}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        {block === 'midday' ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Training</h2>

            <p style={styles.bodyStyle}>
              If training belongs in this part of your day, open your workout.
              If not, use this block for food, water, and easy movement.
            </p>

            <Link
              href={`/dashboard/program/${client.program || 'ignite'}/plan`}
              style={styles.primaryButtonStyle}
            >
              Open Workout
            </Link>
          </section>
        ) : null}

        {block === 'evening' ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Close the Day</h2>

            <p style={styles.bodyStyle}>
              If you completed your core targets today, let it count. If you did
              not get to everything, your effort was not lost. Tomorrow is a new
              day.
            </p>

            <Link href="/dashboard/check-in" style={styles.primaryButtonStyle}>
              Evening Check-In
            </Link>
          </section>
        ) : null}

        <div style={styles.buttonRowStyle}>
          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

function Target({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.035)',
        borderRadius: '20px',
        padding: '16px',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          color: 'rgba(215,199,182,0.68)',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: 0,
          color: '#f5f0e8',
          fontSize: '1.12rem',
        }}
      >
        {value}
      </p>
    </div>
  )
}
