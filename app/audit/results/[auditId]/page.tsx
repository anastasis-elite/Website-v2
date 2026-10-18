import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import * as styles from '@/app/styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export const runtime = 'nodejs'


type Program = 'ember' | 'ignite' | 'phoenix'

type Application = {
  id: string
  full_name: string | null
  capacity_score: number | null
  recommended_program: Program | null
  energy_level: string | null
  overwhelm_level: string | null
  time_available: string | null
  support_level: string | null
  current_season: string | null
}

function getProgramContent(program: Program) {
  if (program === 'ember') {
    return {
      label: 'Ember',
      title: 'Your current capacity points toward Ember.',
      body:
        'Your answers suggest exploring Ember as a starting point. Review its training guidance, macro targets, water logging, and daily check-ins, then decide whether that level of support fits your life.',
      button: 'Explore Ember',
    }
  }

  if (program === 'phoenix') {
    return {
      label: 'Phoenix',
      title: 'Your current capacity points toward Phoenix.',
      body:
        'Your answers suggest exploring Phoenix. Compare its current included features, support, and billing terms with the other tiers. Your answers offer a starting point; the choice remains yours.',
      button: 'Explore Phoenix',
    }
  }

  return {
    label: 'Ignite',
    title: 'Your current capacity points toward Ignite.',
    body:
      'Your answers suggest exploring Ignite. Review how its food logging, micronutrient tracking, and recovery guidance compare with Ember, and choose the level of support that feels useful to you.',
    button: 'Explore Ignite',
  }
}

function formatAnswer(value: string | null) {
  if (!value) return 'Not provided'

  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default async function CapacityAuditResultsPage({
  params,
}: {
  params: Promise<{ auditId: string }>
}) {
  const { auditId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auditId)) notFound()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('applications')
    .select(
      `
      id,
      full_name,
      capacity_score,
      recommended_program,
      energy_level,
      overwhelm_level,
      time_available,
      support_level,
      current_season
    `
    )
      .eq('id', auditId)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const audit = data as Application
  const recommendedProgram = audit.recommended_program || 'ignite'
  const content = getProgramContent(recommendedProgram)

  return (
    
<><TrackEvent event="audit_results_viewed" properties={{ page: 'audit_results' }} />

    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <section style={{ marginBottom: '72px' }}>
          <p style={styles.eyebrowStyle}>Capacity Audit Results</p>

          <h1 style={styles.heroTitleStyle}>
            {audit.full_name ? `${audit.full_name}, ` : ''}
            here is where
            <br />
            we begin.
          </h1>

          <p style={styles.heroTextStyle}>
            This is not a diagnosis, a label, or a final answer. This is a
            suggested starting program based on the five broad answers you saved. Members complete a separate assessment before their training and nutrition plan is created.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Recommended Path</p>

          <h2 style={styles.sectionTitleStyle}>{content.title}</h2>

          <p style={styles.bodyStyle}>{content.body}</p>

          <div style={{ ...styles.buttonRowStyle, marginTop: '32px' }}>
            <Link
              href={`/program/${recommendedProgram}`}
              style={styles.primaryButtonStyle}
            >
              {content.button}
            </Link>

            <Link href="/program" style={styles.secondaryButtonStyle}>
              Compare support levels
            </Link>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Your Capacity Snapshot</p>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Energy</h3>
              <p style={styles.cardTextStyle}>
                {formatAnswer(audit.energy_level)}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Overwhelm</h3>
              <p style={styles.cardTextStyle}>
                {formatAnswer(audit.overwhelm_level)}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Time Available</h3>
              <p style={styles.cardTextStyle}>
                {formatAnswer(audit.time_available)}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Support</h3>
              <p style={styles.cardTextStyle}>
                {formatAnswer(audit.support_level)}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Current Season</h3>
              <p style={styles.cardTextStyle}>
                {formatAnswer(audit.current_season)}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Capacity Score</h3>
              <p style={styles.cardTextStyle}>
                {audit.capacity_score ?? 'Not available'}
              </p>
            </div>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>What This Means</p>

          <h2 style={styles.sectionTitleStyle}>
            You do not need to force your way forward.
          </h2>

          <p style={styles.bodyStyle}>
            Your answers offer a place to begin, not a judgment about how much
            you can handle. Compare the available support, review what each
            tier includes, and choose the next step that fits your circumstances.
          </p>
        </section>
      </div>
    </main>
</>
  )
}
