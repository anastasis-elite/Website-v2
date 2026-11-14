import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'

import { getCyclePrediction } from '@/lib/cycle/getCyclePrediction'
import { cycleTrackingAllowed, readPeriodState, type PeriodState } from '@/lib/cycle/periodState'
import {
  isSorenessRegionKey,
} from '@/lib/recovery/sorenessRegions'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate } from '@/lib/timezone'

const DEFAULT_CYCLE_LENGTH = 28
const MINIMUM_CYCLE_LENGTH = 18
const MAXIMUM_CYCLE_LENGTH = 60

type PeriodStartLog = {
  log_date?: string | null
  period_start_date?: string | null
}



function getDateOnly(
  value: unknown,
): string | null {
  if (!value) {
    return null
  }

  const rawValue = String(value).trim()

  if (!rawValue) {
    return null
  }

  const datePart = rawValue.split('T')[0]

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      datePart,
    )
  ) {
    return null
  }

  const parsedDate = new Date(
    `${datePart}T00:00:00Z`,
  )

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return null
  }

  return parsedDate
    .toISOString()
    .split('T')[0]
}

function getValidFallbackCycleLength(
  value: unknown,
): number {
  const numericValue = Number(value)

  if (
    Number.isFinite(numericValue) &&
    numericValue >=
      MINIMUM_CYCLE_LENGTH &&
    numericValue <=
      MAXIMUM_CYCLE_LENGTH
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

  return (
    dates[dates.length - 1] ??
    fallback
  )
}

export async function POST(
  request: Request,
) {
  let confirmedPeriodState: PeriodState | null = null
  let retryPeriodAction = false
  try {
    const supabase =
      await createClient()

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      )
    }

    const body =
      await request.json()

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from('clients')
      .select(
        `
          client_id,
          auth_user_id,
          timezone,
          onboarding_data,
          state,
          last_period_start,
          average_cycle_length,
          reproductive_status,
          cycle_tracking_enabled
        `,
      )
      .eq(
        'client_id',
        body.clientId,
      )
      .eq(
        'auth_user_id',
        user.id,
      )
      .maybeSingle()

    if (clientError) {
      return NextResponse.json(
        {
          error:
            clientError.message,
        },
        {
          status: 500,
        },
      )
    }

    if (!client) {
      return NextResponse.json(
        {
          error:
            'Client not found.',
        },
        {
          status: 404,
        },
      )
    }

    const today =
      getClientLocalDate(client)
    if (body.date !== undefined && body.date !== today) return NextResponse.json({ error: 'A new day has started. Open Today before saving your check-in.' }, { status: 409 })

    const requestedAction = body.periodAction
    if (requestedAction != null && !['start', 'end', 'resume'].includes(requestedAction)) return NextResponse.json({ error: 'Choose a valid period action.' }, { status: 400 })
    if (body.periodStarted !== undefined && typeof body.periodStarted !== 'boolean') return NextResponse.json({ error: 'Choose a valid period start answer.' }, { status: 400 })
    if (body.periodStarted === true && requestedAction && requestedAction !== 'start') return NextResponse.json({ error: 'Choose one period action before saving.' }, { status: 400 })
    const periodAction: 'start' | 'end' | 'resume' | null = requestedAction || (body.periodStarted === true ? 'start' : null)
    if (periodAction && !cycleTrackingAllowed(client)) return NextResponse.json({ error: 'Period tracking is disabled. Update your cycle settings before recording a period action.' }, { status: 409 })
    let periodState = await readPeriodState(supabase, client, today)
    if (periodAction && periodState.loadError) return NextResponse.json({ error: 'Your period status could not be loaded. Your check-in has not been saved. Try again.' }, { status: 503 })
    if (periodAction === 'start' && periodState.status === 'active' && periodState.recordedDate !== today) return NextResponse.json({ error: 'Your period is already marked active. Mark it ended before recording a new start.', periodState }, { status: 409 })

    const updatedAt = new Date().toISOString()

    const { data: previous, error: previousError } = await supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).maybeSingle()
    if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 })
    const fields: Record<string, string> = { sleepHours: 'sleep_hours', sleepQuality: 'sleep_quality', stress: 'stress_level', soreness: 'soreness_level', energy: 'energy_level', mood: 'mood_level', hunger: 'hunger_level' }
    const answers: Record<string, unknown> = {}
    for (const [key, column] of Object.entries(fields)) {
      if (body[key] === undefined) continue
      const value = Number(body[key])
      const min = key === 'sleepHours' ? 0 : 1, max = key === 'sleepHours' ? 12 : 10
      if (body[key] === null || !Number.isFinite(value) || value < min || value > max) return NextResponse.json({ error: `Choose a valid ${key}.` }, { status: 400 })
      answers[column] = value
    }
    if (answers.energy_level === undefined && previous?.energy_level == null) return NextResponse.json({ error: 'Choose your energy level. Other questions are optional.' }, { status: 400 })
    if (answers.soreness_level !== undefined) {
      const soreness = Number(answers.soreness_level)
      const regions = soreness <= 5 ? [] : Array.from(new Set((Array.isArray(body.sorenessRegions) ? body.sorenessRegions : []).filter(isSorenessRegionKey)))
      if (soreness > 5 && !regions.length) return NextResponse.json({ error: 'Select where you are experiencing soreness.' }, { status: 400 })
      answers.soreness_regions = regions
    }
    if (body.notes !== undefined) answers.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    if (getClientLocalDate(client) !== today) return NextResponse.json({ error: 'A new day has started. Open Today before saving your check-in.' }, { status: 409 })
    let cyclePrediction:
      | ReturnType<
          typeof getCyclePrediction
        >
      | null = null

    let resolvedLastPeriodStart:
      | string
      | null =
      getDateOnly(
        client.last_period_start,
      )

    let resolvedAverageCycleLength =
      getValidFallbackCycleLength(
        client.average_cycle_length,
      )

    if (periodAction === 'start') {
      const {
        data:
          storedPeriodStartLogs,
        error:
          periodLogsError,
      } = await supabase
        .from('cycle_logs')
        .select(
          `
            log_date,
            period_started
          `,
        )
        .eq(
          'client_id',
          client.client_id,
        )
        .eq(
          'auth_user_id',
          user.id,
        )
        .eq(
          'period_started',
          true,
        )
        .order(
          'log_date',
          {
            ascending: true,
          },
        )

      if (periodLogsError) {
        return NextResponse.json(
          {
            error:
              periodLogsError.message,
          },
          {
            status: 500,
          },
        )
      }

      if (periodState.status === 'active' && !(storedPeriodStartLogs ?? []).some((log: PeriodStartLog) => log.log_date === today)) {
        return NextResponse.json({ error: 'Your period is already marked active. Update its existing start date on the Cycle page instead of recording a new start.', periodState }, { status: 409 })
      }
      const periodStartLogs =
        [...(storedPeriodStartLogs ?? []), { log_date: today, period_started: true }] as PeriodStartLog[]

      const fallbackLastPeriodStart =
        getDateOnly(
          client.last_period_start,
        ) ?? today

      cyclePrediction =
        getCyclePrediction({
          periodStartLogs,
          fallbackLastPeriodStart,
          fallbackAverageCycleLength:
            resolvedAverageCycleLength,
        })

      resolvedLastPeriodStart =
        getLatestPeriodStart(
          periodStartLogs,
          today,
        )

      resolvedAverageCycleLength =
        cyclePrediction
          .averageCycleLength ??
        resolvedAverageCycleLength

    }

    let periodSaved = false
    const partialFailure = (error: string, status = 500) => {
      if (periodSaved) invalidateDailyPlan()
      return NextResponse.json({ error: periodSaved ? `Your period update was saved, but your Daily Check-In was not saved. ${error} Retry to finish saving your check-in.` : error,
        ...(periodSaved ? { periodState, partialSave: true, retryPeriodAction } : {}) }, { status })
    }
    if (getClientLocalDate(client) !== today) return partialFailure('A new day has started. Open Today before saving your check-in.', 409)
    if (periodAction) {
      const nextStatus: PeriodState['status'] = periodAction === 'end' ? 'ended' : 'active'
      const { error: cycleError } = await supabase.from('cycle_logs').upsert({
        client_id: client.client_id, auth_user_id: user.id, log_date: today,
        period_status: nextStatus, updated_at: updatedAt,
        ...(periodAction === 'start' ? { period_started: true, cycle_day: 1, cycle_phase: 'menstrual', bleeding: true } : {}),
      }, { onConflict: 'client_id,log_date' })
      if (cycleError) return partialFailure(cycleError.message)
      periodSaved = true
      periodState = { status: nextStatus, recordedDate: today }
      confirmedPeriodState = periodState
      retryPeriodAction = periodAction === 'start'
    }

    if (periodAction === 'start') {
      const {
        error:
          clientUpdateError,
      } = await supabase
        .from('clients')
        .update({
          cycle_tracking_enabled:
            true,

          last_period_start:
            resolvedLastPeriodStart,

          average_cycle_length:
            resolvedAverageCycleLength,

          updated_at:
            updatedAt,
        })
        .eq(
          'client_id',
          client.client_id,
        )
        .eq(
          'auth_user_id',
          user.id,
        )

      if (clientUpdateError) return partialFailure(clientUpdateError.message)
      retryPeriodAction = false
    }

    const { error: recoveryError } = await supabase.from('recovery_logs').upsert({ client_id: client.client_id, auth_user_id: user.id, log_date: today,
      ...answers, check_in_completed_at: previous?.check_in_completed_at || updatedAt, updated_at: updatedAt }, { onConflict: 'client_id,log_date' })

    if (recoveryError) return partialFailure(recoveryError.message)

    invalidateDailyPlan()

    return NextResponse.json({
      success: true,
      periodState,

      period_started:
        periodAction === 'start',

      last_period_start:
        resolvedLastPeriodStart,

      average_cycle_length:
        resolvedAverageCycleLength,

      estimated_next_period_start:
        cyclePrediction
          ?.estimatedNextPeriodStart ??
        null,

      days_until_expected_period:
        cyclePrediction
          ?.daysUntilExpectedPeriod ??
        null,

      cycle_history_confidence:
        cyclePrediction
          ?.confidence ??
        null,

      valid_cycle_intervals:
        cyclePrediction
          ?.recentCycleLengths ??
        [],

      has_enough_history:
        cyclePrediction
          ?.hasEnoughHistory ??
        false,

      prediction_note:
        cyclePrediction?.note ??
        null,
    })
  } catch (error) {
    if (confirmedPeriodState) {
      invalidateDailyPlan()
      return NextResponse.json({ error: 'Your period update was saved. The rest of your Daily Check-In could not be confirmed. Retry to finish saving your check-in.', periodState: confirmedPeriodState, partialSave: true, retryPeriodAction }, { status: 500 })
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Daily check-in failed',
      },
      {
        status: 500,
      },
    )
  }
}
