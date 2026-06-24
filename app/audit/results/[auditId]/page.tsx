import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import * as styles from '@/app/styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type Program = 'ember' | 'ignite' | 'phoenix'

type Application = {
  id: string
  full_name: string | null
  email: string | null
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
        'You appear to have enough current capacity for a structured, sustainable starting point. Ember is designed to help you rebuild rhythm, consistency, and trust without overcomplicating the process.',
      button: 'Explore Ember',
    }
  }

  if (program === 'phoenix') {
    return {
      label: 'Phoenix',
      title: 'Your current capacity points toward Phoenix.',
      body:
        'Your responses suggest that you may be carrying more than your current systems can comfortably support. Phoenix is designed to reduce friction, support decision fatigue, and give you the highest level of guidance.',
      button: 'Explore Phoenix',
    }
  }

  return {
    label: 'Ignite',
    title: 'Your current capacity points toward Ignite.',
    body:
      'Your responses suggest that you may not need the highest level of support, but you would benefit from more adaptive structure, deeper guidance, and clearer feedback as you rebuild momentum.',
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
  params: { auditId: string }
}) {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase server environment variables.')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('applications')
    .select(
      `
      id,
      full_name,
      email,
      capacity_score,
      recommended_program,
      energy_level,
      overwhelm_level,
      time_available,
      support_level,
      current_season
    `
    )
    .eq('id', params.auditId)
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
            starting point based on what your current capacity appears to need
            most right now.
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
              Compare All Paths
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
            The purpose of Anastasis is to meet your current capacity, support
            what is under-resourced, and help you build from there. Your
            recommended path is simply the starting point that appears most
            aligned with the level of support your system may need right now.
          </p>
        </section>
      </div>
    </main>
</>
  )
}
