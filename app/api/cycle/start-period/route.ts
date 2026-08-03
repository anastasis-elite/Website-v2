import { NextResponse } from 'next/server'

import { getCyclePrediction } from '@/lib/cycle/getCyclePrediction'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_CYCLE_LENGTH = 28
const MINIMUM_CYCLE_LENGTH = 18
const MAXIMUM_CYCLE_LENGTH = 60

type PeriodStartLog = {
  log_date?: string | null
  period_start_date?: string | null
}

function getDateOnly(value: unknown): string | null {
  if (!value) {
    return null
  }

  const rawValue = String(value).trim()

  if (!rawValue) {
    return null
  }

  const datePart = rawValue.split('T')[0]

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null
  }

  const parsedDate = new Date(`${datePart}T00:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return parsedDate.toISOString().split('T')[0]
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getValidFallbackCycleLength(
  value: unknown,
): number {
  const numericValue = Number(value)

  if (
    Number.isFinite(numericValue) &&
    numericValue >= MINIMUM_CYCLE_LENGTH &&
    numericValue <= MAXIMUM_CYCLE_LENGTH
  ) {
    return Math.round(numericValue)
  }

  return DEFAULT_CYCLE_LENGTH
}

function getLatestPeriodStart(
  logs: PeriodStartLog[],
  fallback: string,
): string {
  const dates = logs
    .map((log) =>
      getDateOnly(
        log.log_date ??
          log.period_start_date,
      ),
    )
    .filter(
      (date): date is string =>
        Boolean(date),
    )
    .sort(
      (first, second) =>
        new Date(
          `${first}T00:00:00Z`,
        ).getTime() -
        new Date(
          `${second}T00:00:00Z`,
        ).getTime(),
    )

  return dates[dates.length - 1] ?? fallback
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const { client_id } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 },
      )
    }

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from('clients')
      .select(
        `
          client_id,
          auth_user_id,
          last_period_start,
          average_cycle_length
        `,
      )
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 },
      )
    }

    if (!client) {
      return NextResponse.json(
        {
          error:
            'Client not found for this user',
        },
        { status: 404 },
      )
    }

    const today = getToday()
    const updatedAt = new Date().toISOString()

    const { error: logError } =
      await supabase
        .from('cycle_logs')
        .upsert(
          {
            client_id,
            auth_user_id: user.id,
            log_date: today,
            cycle_day: 1,
            cycle_phase: 'menstrual',
            period_started: true,
            bleeding: true,
            updated_at: updatedAt,
          },
          {
            onConflict:
              'client_id,log_date',
          },
        )

    if (logError) {
      return NextResponse.json(
        { error: logError.message },
        { status: 500 },
      )
    }

    /*
     * Reload every recorded period start so the newly logged
     * period contributes to the calculated average.
     */
    const {
      data: storedPeriodStartLogs,
      error: periodLogsError,
    } = await supabase
      .from('cycle_logs')
      .select(
        `
          log_date,
          period_started
        `,
      )
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .eq('period_started', true)
      .order('log_date', {
        ascending: true,
      })

    if (periodLogsError) {
      return NextResponse.json(
        { error: periodLogsError.message },
        { status: 500 },
      )
    }

    const fallbackAverageCycleLength =
      getValidFallbackCycleLength(
        client.average_cycle_length,
      )

    const fallbackLastPeriodStart =
      getDateOnly(
        client.last_period_start,
      ) ?? today

    const periodStartLogs =
      (storedPeriodStartLogs ??
        []) as PeriodStartLog[]

    const prediction =
      getCyclePrediction({
        periodStartLogs,
        fallbackLastPeriodStart,
        fallbackAverageCycleLength,
      })

    const resolvedLastPeriodStart =
      getLatestPeriodStart(
        periodStartLogs,
        today,
      )

    const resolvedAverageCycleLength =
      prediction.averageCycleLength ??
      fallbackAverageCycleLength

    const { error: clientUpdateError } =
      await supabase
        .from('clients')
        .update({
          cycle_tracking_enabled: true,
          last_period_start:
            resolvedLastPeriodStart,
          average_cycle_length:
            resolvedAverageCycleLength,
          updated_at: updatedAt,
        })
        .eq('client_id', client_id)
        .eq('auth_user_id', user.id)

    if (clientUpdateError) {
      return NextResponse.json(
        {
          error:
            clientUpdateError.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      cycle_day: 1,
      cycle_phase: 'menstrual',
      log_date: today,

      last_period_start:
        resolvedLastPeriodStart,
      average_cycle_length:
        resolvedAverageCycleLength,

      estimated_next_period_start:
        prediction.estimatedNextPeriodStart,
      days_until_expected_period:
        prediction.daysUntilExpectedPeriod,
      cycle_history_confidence:
        prediction.confidence,
      valid_cycle_intervals:
        prediction.recentCycleLengths,
      has_enough_history:
        prediction.hasEnoughHistory,
      prediction_note:
        prediction.note,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not start cycle',
      },
      { status: 500 },
    )
  }
}
