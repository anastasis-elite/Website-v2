import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type AnalyticsRow = {
  event: string
  total: number
}

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

    const query = `
      SELECT
        event,
        count() AS total
      FROM events
      WHERE timestamp >= now() - INTERVAL 7 DAY
        AND event IN (
          'landing_page_viewed',
          'about_page_viewed',
          'why_page_viewed',
          'program_page_viewed',
          'program_viewed',
          'audit_started',
          'audit_completed',
          'audit_results_viewed',
          'checkout_started',
          'checkout_completed',
          'login_created',
          'dashboard_viewed'
        )
      GROUP BY event
      ORDER BY total DESC
    `

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
      return NextResponse.json(
        {
          error: 'PostHog query failed.',
          details: data,
        },
        { status: response.status }
      )
    }

    const rows: AnalyticsRow[] =
      data.results?.map((row: [string, number]) => ({
        event: row[0],
        total: row[1],
      })) || []

    return NextResponse.json({
      success: true,
      period: 'last_7_days',
      rows,
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
