import { NextResponse } from 'next/server'

import { getCyclePrediction } from '@/lib/cycle/getCyclePrediction'
import { createClient } from '@/lib/supabase/server'

type CycleHistoryItem = {
  period_start_date?: string | null
  bleeding_length?: number | string | null
  cycle_length?: number | string | null
}

type PeriodStartLog = {
  log_date?: string | null
  period_start_date?: string | null
  period_started?: boolean | null
}

const DEFAULT_CYCLE_LENGTH = 28
const MINIMUM_CYCLE_LENGTH = 18
const MAXIMUM_CYCLE_LENGTH = 60

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

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const millisecondsPerDay = 1000 * 60 * 60 * 24

  return Math.floor(
    (endDate.getTime() - startDate.getTime()) /
      millisecondsPerDay,
  )
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

function getCycleDayAndPhase({
  lastPeriodStart,
  averageCycleLength,
  today,
}: {
  lastPeriodStart: string | null
  averageCycleLength: number
  today: string
}) {
  if (!lastPeriodStart) {
    return {
      cycleDay: null,
      cyclePhase: null,
    }
  }

  const daysSinceStart =
    daysBetween(lastPeriodStart, today) + 1

  if (daysSinceStart < 1) {
    return {
      cycleDay: null,
      cyclePhase: null,
    }
  }

  const cycleLength = getValidFallbackCycleLength(
    averageCycleLength,
  )

  /*
   * Ovulation is estimated approximately 14 days before
   * the next expected period. The ovulatory phase is treated
   * as a five-day window centered around that estimated day.
   */
  const estimatedOvulationDay = Math.max(
    8,
    cycleLength - 14,
  )

  const ovulatoryWindowStart = Math.max(
    6,
    estimatedOvulationDay - 2,
  )

  const ovulatoryWindowEnd =
    estimatedOvulationDay + 2

  let cyclePhase:
    | 'menstrual'
    | 'follicular'
    | 'ovulatory'
    | 'luteal'
    | 'extended_cycle'

  if (daysSinceStart > cycleLength + 3) {
    cyclePhase = 'extended_cycle'
  } else if (daysSinceStart <= 5) {
    cyclePhase = 'menstrual'
  } else if (
    daysSinceStart >= ovulatoryWindowStart &&
    daysSinceStart <= ovulatoryWindowEnd
  ) {
    cyclePhase = 'ovulatory'
  } else if (
    daysSinceStart < ovulatoryWindowStart
  ) {
    cyclePhase = 'follicular'
  } else {
    cyclePhase = 'luteal'
  }

  return {
    cycleDay: daysSinceStart,
    cyclePhase,
  }
}

function getUniquePeriodStartDates({
  cycleHistory,
  submittedLastPeriodStart,
}: {
  cycleHistory: CycleHistoryItem[]
  submittedLastPeriodStart: unknown
}): string[] {
  const dates = cycleHistory
    .map((cycle) =>
      getDateOnly(cycle?.period_start_date),
    )
    .filter(
      (date): date is string => Boolean(date),
    )

  const submittedStart = getDateOnly(
    submittedLastPeriodStart,
  )

  if (submittedStart) {
    dates.push(submittedStart)
  }

  return Array.from(new Set(dates)).sort(
    (first, second) =>
      new Date(`${first}T00:00:00Z`).getTime() -
      new Date(`${second}T00:00:00Z`).getTime(),
  )
}

function getLatestPeriodStart(
  logs: PeriodStartLog[],
  fallback: string | null,
): string | null {
  const dates = logs
    .map((log) =>
      getDateOnly(
        log.log_date ??
          log.period_start_date,
      ),
    )
    .filter(
      (date): date is string => Boolean(date),
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
    const body = await req.json()
    const supabase = await createClient()

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

    const {
      client_id,
      cycle_tracking_enabled,
      last_period_start,
      average_cycle_length,
      cycle_history,
      bleeding,
      cramps,
      headache,
      fatigue,
      mood_sensitivity,
      notes,
    } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 },
      )
    }

    const {
      data: client,
      error: clientLookupError,
    } = await supabase
      .from('clients')
      .select(
        `
          id,
          client_id,
          auth_user_id,
          last_period_start,
          average_cycle_length
        `,
      )
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientLookupError) {
      return NextResponse.json(
        { error: clientLookupError.message },
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

    const submittedCycleHistory: CycleHistoryItem[] =
      Array.isArray(cycle_history)
        ? cycle_history
        : []

    const submittedPeriodStartDates =
      getUniquePeriodStartDates({
        cycleHistory: submittedCycleHistory,
        submittedLastPeriodStart:
          last_period_start,
      })

    /*
     * Save every submitted period-start date as a permanent
     * period-start record. Duplicate dates are removed before
     * the upsert.
     */
    if (submittedPeriodStartDates.length > 0) {
      const historicalPeriodRows =
        submittedPeriodStartDates.map(
          (periodStartDate) => ({
            client_id,
            auth_user_id: user.id,
            log_date: periodStartDate,
            cycle_day: 1,
            cycle_phase: 'menstrual',
            period_started: true,
            bleeding: true,
            updated_at:
              new Date().toISOString(),
          }),
        )

      const {
        error: historySaveError,
      } = await supabase
        .from('cycle_logs')
        .upsert(historicalPeriodRows, {
          onConflict:
            'client_id,log_date',
        })

      if (historySaveError) {
        return NextResponse.json(
          {
            error:
              historySaveError.message,
          },
          { status: 500 },
        )
      }
    }

    /*
     * Load every stored period-start log. This becomes the
     * source of truth for the average and predictions.
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
        average_cycle_length ??
          client.average_cycle_length,
      )

    const fallbackLastPeriodStart =
      getDateOnly(
        last_period_start ??
          client.last_period_start,
      )

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
        fallbackLastPeriodStart,
      )

    const resolvedAverageCycleLength =
      prediction.averageCycleLength ??
      fallbackAverageCycleLength

    const { cycleDay, cyclePhase } =
      getCycleDayAndPhase({
        lastPeriodStart:
          resolvedLastPeriodStart,
        averageCycleLength:
          resolvedAverageCycleLength,
        today,
      })

    /*
     * Keep the client summary fields synchronized so existing
     * cycle consumers receive the calculated values.
     */
    const { error: clientUpdateError } =
      await supabase
        .from('clients')
        .update({
          cycle_tracking_enabled:
            Boolean(
              cycle_tracking_enabled,
            ),
          last_period_start:
            resolvedLastPeriodStart,
          average_cycle_length:
            resolvedAverageCycleLength,
          updated_at:
            new Date().toISOString(),
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

    /*
     * Save today's current symptoms separately. Do not send
     * period_started here, because doing so could erase or
     * fabricate period-start status on today's existing row.
     */
    const { error: logError } =
      await supabase
        .from('cycle_logs')
        .upsert(
          {
            client_id,
            auth_user_id: user.id,
            log_date: today,
            cycle_day: cycleDay,
            cycle_phase: cyclePhase,
            bleeding: Boolean(bleeding),
            cramps: Boolean(cramps),
            headache: Boolean(headache),
            fatigue: Boolean(fatigue),
            mood_sensitivity: Boolean(
              mood_sensitivity,
            ),
            notes: notes || null,
            updated_at:
              new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      cycle_day: cycleDay,
      cycle_phase: cyclePhase,

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
      prediction_note: prediction.note,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Cycle save failed',
      },
      { status: 500 },
    )
  }
}
