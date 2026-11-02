import { NextResponse } from 'next/server'
import { buildLinkedFunnels, LINKED_FUNNEL_EVENTS } from '@/lib/analytics/funnel'

export const runtime = 'nodejs'

type EventRow = {
  event: string
  total: number
}

type SourceRow = {
  source: string
  total: number
}

const trackedEvents = [
  'landing_page_viewed',
  'about_page_viewed',
  'why_page_viewed',
  'program_page_viewed',
  'program_viewed',
  'audit_page_viewed',
  'audit_started',
  'audit_page_completed',
  'audit_results_viewed',
  'checkout_started',
  'pricing_viewed',
  'subscription_activated',
  'subscription_upgraded',
  'subscription_cancelled',
  'onboarding_completed',
  'first_workout_completed',
  'first_nutrition_completed',
  'first_recovery_completed',
  'today_page_viewed',
]

export async function GET() {
  try {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
    const projectId = process.env.POSTHOG_PROJECT_ID
    const host = process.env.POSTHOG_HOST || 'https://us.posthog.com'

    if (!apiKey || !projectId) {
      return NextResponse.json(
        { error: 'Missing PostHog analytics environment variables.' },
        { status: 500 }
      )
    }

    async function runPostHogQuery(query: string) {
      const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query,
          },
        }),
        cache: 'no-store',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(JSON.stringify(data))
      }

      return data.results || []
    }

    const eventList = trackedEvents.map((event) => `'${event}'`).join(',')

    const eventQuery = `
      SELECT
        event,
        count(DISTINCT distinct_id) AS total
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND properties.analytics_environment = 'production'
        AND event IN (${eventList})
      GROUP BY event
      ORDER BY total DESC
    `

    const sourceQuery = `
      SELECT
        properties.source AS source,
        count(DISTINCT distinct_id) AS total
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND properties.analytics_environment = 'production'
        AND event = 'landing_page_viewed'
      GROUP BY source
      ORDER BY total DESC
    `

    // Fetch only explicit safe identifiers and event timestamps. No URL, answer,
    // health, payment or person-property fields are part of this query.
    const linkedQuery = `
      SELECT event, timestamp, properties.journey_id, properties.member_id
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND properties.analytics_environment = 'production'
        AND event IN (${LINKED_FUNNEL_EVENTS.map(event => `'${event}'`).join(',')})
      ORDER BY timestamp ASC
      LIMIT 10000
    `

    const [eventRows, sourceRows, linkedRows] = await Promise.all([
      runPostHogQuery(eventQuery),
      runPostHogQuery(sourceQuery),
      runPostHogQuery(linkedQuery),
    ])
    const linked = buildLinkedFunnels(linkedRows.map((row: [string, string, string | null, string | null]) => ({
      event: row[0], occurredAt: row[1], journeyId: row[2], memberId: row[3],
    })))

    const rows: EventRow[] = eventRows.map((row: [string, number]) => ({
      event: row[0],
      total: row[1],
    }))

    const sources: SourceRow[] = sourceRows.map(
      (row: [string | null, number]) => ({
        source: row[0] || 'direct_or_unknown',
        total: row[1],
      })
    )

    return NextResponse.json({
      success: true,
      period: 'last_7_days',
      rows,
      sources,
      linkedFunnels: linked.funnels,
      linkedQuality: { ...linked.quality, truncated: linkedRows.length >= 10000, limit: 10000 },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load analytics.',
      },
      { status: 500 }
    )
  }
}
