import { NextResponse } from 'next/server'

import { getCyclePrediction } from '@/lib/cycle/getCyclePrediction'
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

function rating(value: unknown): number {
  return Math.max(
    1,
    Math.min(
      10,
      Math.round(Number(value) || 5),
    ),
  )
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

async function updateOrInsertByClientDate(
  supabase: any,
  table: string,
  payload: Record<
    string,
    unknown
  >,
) {
  const {
    data: updated,
    error: updateError,
  } = await supabase
    .from(table)
    .update(payload)
    .eq(
      'client_id',
      payload.client_id,
    )
    .eq(
      'log_date',
      payload.log_date,
    )
    .select('id')
    .maybeSingle()

  if (updateError) {
    return {
      error: updateError,
    }
  }

  if (updated) {
    return {
      error: null,
    }
  }

  const { error: insertError } =
    await supabase
      .from(table)
      .insert(payload)

  return {
    error: insertError,
  }
}

export async function POST(
  request: Request,
) {
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
          average_cycle_length
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

    const updatedAt =
      new Date().toISOString()

    const sorenessLevel =
      rating(body.soreness)

    const submittedRegions =
      Array.isArray(
        body.sorenessRegions,
      )
        ? body.sorenessRegions
        : []

    const validatedSorenessRegions =
      sorenessLevel <= 5
        ? []
        : Array.from(
            new Set(
              submittedRegions.filter(
                isSorenessRegionKey,
              ),
            ),
          )

    if (
      sorenessLevel > 5 &&
      validatedSorenessRegions
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Select where you are experiencing soreness.',
        },
        {
          status: 400,
        },
      )
    }

    const {
      error: recoveryError,
    } =
      await updateOrInsertByClientDate(
        supabase,
        'recovery_logs',
        {
          client_id:
            client.client_id,
          auth_user_id:
            user.id,
          log_date: today,

          sleep_hours: Math.max(
            0,
            Math.min(
              12,
              Number(
                body.sleepHours,
              ) || 0,
            ),
          ),

          sleep_quality:
            rating(
              body.sleepQuality,
            ),

          stress_level:
            rating(body.stress),

          soreness_level:
            sorenessLevel,

          soreness_regions:
            validatedSorenessRegions,

          energy_level:
            rating(body.energy),

          mood_level:
            rating(body.mood),

          hunger_level:
            rating(body.hunger),

          notes:
            typeof body.notes ===
            'string'
              ? body.notes.trim() ||
                null
              : null,

          check_in_completed_at:
            updatedAt,

          updated_at:
            updatedAt,
        },
      )

    if (recoveryError) {
      return NextResponse.json(
        {
          error:
            recoveryError.message,
        },
        {
          status: 500,
        },
      )
    }

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

    if (body.periodStarted) {
      const {
        error: cycleError,
      } =
        await updateOrInsertByClientDate(
          supabase,
          'cycle_logs',
          {
            client_id:
              client.client_id,
            auth_user_id:
              user.id,
            log_date: today,

            period_started: true,
            cycle_day: 1,
            cycle_phase:
              'menstrual',
            bleeding: true,

            updated_at:
              updatedAt,
          },
        )

      if (cycleError) {
        return NextResponse.json(
          {
            error:
              cycleError.message,
          },
          {
            status: 500,
          },
        )
      }

      /*
       * Reload every period start, including the
       * one just logged through the daily check-in.
       */
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

      const periodStartLogs =
        (storedPeriodStartLogs ??
          []) as PeriodStartLog[]

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

      if (clientUpdateError) {
        return NextResponse.json(
          {
            error:
              clientUpdateError.message,
          },
          {
            status: 500,
          },
        )
      }
    }

    return NextResponse.json({
      success: true,

      period_started:
        Boolean(
          body.periodStarted,
        ),

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
