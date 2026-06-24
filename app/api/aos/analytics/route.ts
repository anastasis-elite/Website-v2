import { NextResponse } from 'next/server'

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
  'audit_submit_clicked',
  'audit_page_completed',
  'audit_results_viewed',
  'checkout_started',
  'checkout_completed',
  'login_created',
  'dashboard_viewed',
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
        count() AS total
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND event IN (${eventList})
      GROUP BY event
      ORDER BY total DESC
    `

    const sourceQuery = `
      SELECT
        properties.$utm_source AS source,
        count() AS total
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND event = 'landing_page_viewed'
      GROUP BY source
      ORDER BY total DESC
    `

    const [eventRows, sourceRows] = await Promise.all([
      runPostHogQuery(eventQuery),
      runPostHogQuery(sourceQuery),
    ])

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
