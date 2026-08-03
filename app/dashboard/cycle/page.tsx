import Link from 'next/link'

import CycleTracker from '@/components/CycleTracker'

import * as styles from '../../styles/globalstyles'

import { getCyclePrediction } from '@/lib/cycle/getCyclePrediction'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getClientLocalDate } from '@/lib/timezone'

type PeriodStartLog = {
  log_date?: string | null
  period_start_date?: string | null
}

function normalizeDateValue(
  value: unknown,
): string | null {
  if (!value) {
    return null
  }

  const datePart = String(value)
    .trim()
    .split('T')[0]

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      datePart,
    )
  ) {
    return null
  }

  return datePart
}

function getLatestPeriodStart(
  logs: PeriodStartLog[],
  fallback?: string | null,
): string | null {
  const dates = logs
    .map((log) =>
      normalizeDateValue(
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
          `${first}T00:00:00`,
        ).getTime() -
        new Date(
          `${second}T00:00:00`,
        ).getTime(),
    )

  return (
    dates[dates.length - 1] ??
    normalizeDateValue(fallback) ??
    null
  )
}

export default async function CyclePage() {
  const { supabase, client } =
    await getDashboardContext()

  const today =
    getClientLocalDate(client)

  const [
    todayLogResult,
    periodStartLogsResult,
  ] = await Promise.all([
    supabase
      .from('cycle_logs')
      .select('*')
      .eq(
        'client_id',
        client.client_id,
      )
      .eq(
        'auth_user_id',
        client.auth_user_id,
      )
      .eq('log_date', today)
      .maybeSingle(),

    supabase
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
        client.auth_user_id,
      )
      .eq(
        'period_started',
        true,
      )
      .order('log_date', {
        ascending: true,
      }),
  ])

  const todayLog =
    todayLogResult.data

  const periodStartLogs =
    (periodStartLogsResult.data ??
      []) as PeriodStartLog[]

  const cyclePrediction =
    getCyclePrediction({
      periodStartLogs,
      fallbackLastPeriodStart:
        client.last_period_start,
      fallbackAverageCycleLength:
        Number(
          client.average_cycle_length ||
            28,
        ),
    })

  const resolvedLastPeriodStart =
    getLatestPeriodStart(
      periodStartLogs,
      client.last_period_start,
    )

  const resolvedAverageCycleLength =
    cyclePrediction.averageCycleLength ??
    Number(
      client.average_cycle_length ||
        28,
    )

  const resolvedClient = {
    ...client,
    last_period_start:
      resolvedLastPeriodStart,
    average_cycle_length:
      resolvedAverageCycleLength,
  }

  const cycleStatus =
    getCycleStatus(resolvedClient)

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>
          Cycle Awareness
        </p>

        <h1 style={styles.heroTitleStyle}>
          Your body context for today.
        </h1>

        <p style={styles.heroTextStyle}>
          This space helps Anastasis interpret your
          logged cycle history alongside your actual
          symptoms. It does not diagnose, prescribe,
          or override what your body is telling you.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            {cycleStatus.enabled &&
            cycleStatus.cycleDay
              ? `Cycle Day ${cycleStatus.cycleDay}`
              : 'Cycle tracking is not active yet.'}
          </h2>

          {cycleStatus.enabled ? (
            <>
              <p style={styles.bodyStyle}>
                <strong>
                  Estimated phase:
                </strong>{' '}
                {cycleStatus.phase}
              </p>

              {cycleStatus.recoveryNote ? (
                <p style={styles.bodyStyle}>
                  {
                    cycleStatus.recoveryNote
                  }
                </p>
              ) : null}

              <p
                style={{
                  ...styles.bodyStyle,
                  opacity: 0.72,
                }}
              >
                {cyclePrediction
                  .recentCycleLengths
                  .length > 0
                  ? `This estimate uses all ${
                      cyclePrediction
                        .recentCycleLengths
                        .length
                    } valid logged cycle interval${
                      cyclePrediction
                        .recentCycleLengths
                        .length === 1
                        ? ''
                        : 's'
                    } and your most recent period start.`
                  : 'This estimate is currently using your saved cycle length as a fallback until more period starts are logged.'}{' '}
                Your current symptoms remain the
                stronger signal.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px',
                  marginTop: '22px',
                }}
              >
                <div
                  style={{
                    borderRadius: '20px',
                    padding: '18px',
                    background:
                      'rgba(255,255,255,0.018)',
                  }}
                >
                  <p
                    style={{
                      ...styles.eyebrowStyle,
                      marginBottom: '8px',
                      fontSize: '10px',
                      letterSpacing: '3px',
                    }}
                  >
                    Calculated Average
                  </p>

                  <strong
                    style={{
                      color: '#f5f0e8',
                      fontSize: '1.35rem',
                      fontWeight: 500,
                    }}
                  >
                    {
                      resolvedAverageCycleLength
                    }{' '}
                    days
                  </strong>
                </div>

                <div
                  style={{
                    borderRadius: '20px',
                    padding: '18px',
                    background:
                      'rgba(255,255,255,0.018)',
                  }}
                >
                  <p
                    style={{
                      ...styles.eyebrowStyle,
                      marginBottom: '8px',
                      fontSize: '10px',
                      letterSpacing: '3px',
                    }}
                  >
                    Prediction Confidence
                  </p>

                  <strong
                    style={{
                      color: '#f5f0e8',
                      fontSize: '1.35rem',
                      fontWeight: 500,
                      textTransform:
                        'capitalize',
                    }}
                  >
                    {
                      cyclePrediction.confidence
                    }
                  </strong>
                </div>

                {cyclePrediction
                  .estimatedNextPeriodStart ? (
                  <div
                    style={{
                      borderRadius: '20px',
                      padding: '18px',
                      background:
                        'rgba(255,255,255,0.018)',
                    }}
                  >
                    <p
                      style={{
                        ...styles.eyebrowStyle,
                        marginBottom: '8px',
                        fontSize: '10px',
                        letterSpacing: '3px',
                      }}
                    >
                      Estimated Next Start
                    </p>

                    <strong
                      style={{
                        color: '#f5f0e8',
                        fontSize: '1.1rem',
                        fontWeight: 500,
                      }}
                    >
                      {new Date(
                        `${cyclePrediction.estimatedNextPeriodStart}T12:00:00`,
                      ).toLocaleDateString(
                        'en-US',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </strong>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p style={styles.bodyStyle}>
              Enable cycle awareness and add at least
              your most recent period start date to
              begin cycle-aware recovery and training
              guidance.
            </p>
          )}
        </section>

        <CycleTracker
          clientId={client.client_id}
          cycleStatus={cycleStatus}
          lastPeriodStart={
            resolvedLastPeriodStart
          }
          averageCycleLength={
            resolvedAverageCycleLength
          }
          cycleTrackingEnabled={
            client.cycle_tracking_enabled
          }
          todayLog={todayLog}
        />

        <div style={styles.buttonRowStyle}>
          <Link
            href="/dashboard"
            style={
              styles.secondaryButtonStyle
            }
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
