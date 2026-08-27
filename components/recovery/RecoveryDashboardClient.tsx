'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

import DailyCheckInForm from '@/components/DailyCheckInForm'
import RecoveryLogger from '@/components/RecoveryLogger'
import BreathingReset from '@/components/recovery/BreathingReset'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { SorenessRegionKey } from '@/lib/recovery/sorenessRegions'

type ProgressTab = 'daily' | 'trends'
type ActionTab = 'tools' | 'checkIn'
type ManagementTab = 'assessment' | 'history' | 'insights'

type RecoveryTrend = {
  key: string
  label: string
  unit: string
  values: Array<number | null>
  currentAverage: number | null
}

type RecoveryActivity = {
  id?: string
  activity_type?: string | null
  duration_minutes?: number | null
  log_date?: string | null
  created_at?: string | null
}

type CheckInInitial = {
  sleepHours?: number | null
  sleepQuality?: number | null
  stress?: number | null
  soreness?: number | null
  energy?: number | null
  mood?: number | null
  hunger?: number | null
  notes?: string | null
  sorenessRegions?: SorenessRegionKey[]
}

function progressPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0
  return Math.max(0, Math.min(100, Math.round(Number(value))))
}

function scoreFromLowIsGood(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  return progressPercent(100 - ((Number(value) - 1) / 9) * 100)
}

function scoreFromHighIsGood(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  return progressPercent((Number(value) / 10) * 100)
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ')
}

function formatDuration(action: ProgramLogicOutput['recoveryActions'][number]) {
  if (action.duration.minutes) return `${action.duration.minutes} min`
  if (action.duration.minimumMinutes && action.duration.maximumMinutes) {
    return `${action.duration.minimumMinutes}-${action.duration.maximumMinutes} min`
  }
  if (action.duration.minimumMinutes) return `${action.duration.minimumMinutes}+ min`
  return 'Flexible'
}

function TrendLine({ values }: { values: Array<number | null> }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null)

  if (points.length < 2) return <span className="tier-no-trend">Keep logging to build this trend.</span>

  const raw = points.map((point) => point.value)
  const min = Math.min(...raw)
  const range = Math.max(...raw) - min || 1
  const coordinates = points
    .map((point) => `${(point.index / Math.max(1, values.length - 1)) * 100},${44 - ((point.value - min) / range) * 36}`)
    .join(' ')

  return <svg className="tier-trend-line" viewBox="0 0 100 48" role="img"><polyline points={coordinates} /></svg>
}

function RecoveryMetric({
  label,
  percent,
  value,
  detail,
}: {
  label: string
  percent: number | null
  value: string
  detail: string
}) {
  return (
    <article className="tier-metric-card">
      <div className={`tier-metric-ring${percent === null ? ' is-empty' : ''}`} style={{ '--tier-progress': `${progressPercent(percent) * 3.6}deg` } as CSSProperties}>
        <strong>{percent === null ? '--' : `${progressPercent(percent)}%`}</strong>
      </div>
      <span>{label}</span>
      <small>{value}</small>
      <small>{detail}</small>
    </article>
  )
}

export default function RecoveryDashboardClient({
  logic,
  clientId,
  program,
  cycleTrackingEnabled,
  checkInInitial,
  trends,
  recentActivities,
}: {
  logic: ProgramLogicOutput
  clientId: string
  program: string
  cycleTrackingEnabled: boolean
  checkInInitial: CheckInInitial
  trends: RecoveryTrend[]
  recentActivities: RecoveryActivity[]
}) {
  const [progressTab, setProgressTab] = useState<ProgressTab>('daily')
  const [actionTab, setActionTab] = useState<ActionTab>('tools')
  const [managementTab, setManagementTab] = useState<ManagementTab>('assessment')

  const recoveryScore = progressPercent(logic.recoveryStatus.score)
  const sleepPercent = logic.sleep.quality !== null
    ? scoreFromHighIsGood(logic.sleep.quality)
    : logic.sleep.hours !== null
      ? progressPercent((logic.sleep.hours / 8) * 100)
      : null
  const stressPercent = scoreFromLowIsGood(logic.recoveryCheck.stress)
  const sorenessPercent = scoreFromLowIsGood(logic.recoveryCheck.soreness)
  const energyPercent = scoreFromHighIsGood(logic.recoveryCheck.energy)

  const metricCards = [
    {
      label: 'Recovery',
      percent: recoveryScore,
      value: formatStatus(logic.recoveryStatus.status),
      detail: logic.recoveryStatus.movementPreserved ? 'Movement can stay in the plan.' : 'Recovery should lead the day.',
    },
    {
      label: 'Sleep',
      percent: sleepPercent,
      value: logic.sleep.logged ? `${logic.sleep.hours ?? '--'} hr · ${logic.sleep.quality ?? '--'}/10` : 'Needs input',
      detail: logic.sleep.logged ? 'Connected to today’s capacity decision.' : 'Log sleep to refine readiness.',
    },
    {
      label: 'Stress',
      percent: stressPercent,
      value: logic.recoveryCheck.stress === null ? 'Needs input' : `${logic.recoveryCheck.stress}/10`,
      detail: stressPercent === null ? 'Daily check-in will update this.' : stressPercent >= 70 ? 'Currently supportive.' : 'Needs downshift attention.',
    },
    {
      label: 'Soreness',
      percent: sorenessPercent,
      value: logic.recoveryCheck.soreness === null ? 'Needs input' : `${logic.recoveryCheck.soreness}/10`,
      detail: sorenessPercent === null ? 'Daily check-in will update this.' : sorenessPercent >= 70 ? 'No major soreness signal.' : 'Protect sore areas today.',
    },
    {
      label: 'Energy',
      percent: energyPercent,
      value: logic.recoveryCheck.energy === null ? 'Needs input' : `${logic.recoveryCheck.energy}/10`,
      detail: 'Subjective check-in signal.',
    },
    {
      label: 'Hydration',
      percent: progressPercent(logic.hydration.percent),
      value: `${Math.round(logic.hydration.consumed)} / ${Math.round(logic.hydration.target)} oz`,
      detail: logic.hydration.recoverySupportNote,
    },
  ]

  const passiveMetrics = [
    ['HRV', logic.passiveHealth.hrv, 'ms'],
    ['Resting Heart Rate', logic.passiveHealth.restingHeartRate, 'bpm'],
    ['Steps', logic.passiveHealth.steps, 'steps'],
    ['Active Energy', logic.passiveHealth.activeEnergy, 'cal'],
  ].filter(([, value]) => value !== null && value !== undefined)
  const normalizedCheckInInitial = {
    sleepHours: checkInInitial.sleepHours ?? undefined,
    sleepQuality: checkInInitial.sleepQuality ?? undefined,
    stress: checkInInitial.stress ?? undefined,
    soreness: checkInInitial.soreness ?? undefined,
    energy: checkInInitial.energy ?? undefined,
    mood: checkInInitial.mood ?? undefined,
    hunger: checkInInitial.hunger ?? undefined,
    notes: checkInInitial.notes ?? undefined,
    sorenessRegions: checkInInitial.sorenessRegions,
  }

  return (
    <main className="aos-nutrition-page recovery-dashboard-page">
      <div className="aos-nutrition-shell recovery-dashboard-shell">
        <section className="recovery-dashboard-workspace" data-tier={logic.program}>
          <article className="tier-daily-insight workout-objective recovery-objective" data-testid="recovery-objective">
            <p className="tier-dashboard-label">Recovery Status</p>
            <div>
              <h1>{formatStatus(logic.recoveryStatus.status)}</h1>
              <BreathingReset clientId={clientId} />
            </div>
            <p>{logic.recoveryStatus.reasoning}</p>
            <small>Today&apos;s priority: {logic.recoveryActions[0]?.label || logic.symptoms.recoveryRecommendation}</small>
            <div className="recovery-objective-metrics">
              <article><span>Recovery Score</span><strong>{recoveryScore}%</strong></article>
              <article><span>Capacity</span><strong>{formatStatus(logic.capacityStatus.status)}</strong></article>
              <article><span>Check-In</span><strong>{logic.assessments.dailyCompleted ? 'Complete' : 'Open'}</strong></article>
            </div>
          </article>

          <div className="recovery-dashboard-row">
            <section className="recovery-dashboard-panel" data-testid="recovery-progress-panel">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Recovery Signals</p>
                  <h2>{progressTab === 'daily' ? 'Daily Recovery' : 'Trends'}</h2>
                </div>
                <div className="tier-tab-list recovery-panel-tabs" role="tablist" aria-label="Recovery progress">
                  {([
                    ['daily', 'Daily Recovery'],
                    ['trends', 'Trends'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={progressTab === key ? 'is-active' : ''} onClick={() => setProgressTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {progressTab === 'daily' ? (
                <div className="recovery-metric-grid" data-testid="recovery-daily-tab">
                  {metricCards.map((metric) => <RecoveryMetric key={metric.label} {...metric} />)}
                </div>
              ) : null}

              {progressTab === 'trends' ? (
                <div className="tier-trends-layout recovery-trends-layout" data-testid="recovery-trends-tab">
                  {trends.length ? trends.map((trend) => (
                    <article key={trend.key}>
                      <div><span>{trend.label}</span><strong>{trend.currentAverage === null ? 'No data' : `${Math.round(trend.currentAverage)}${trend.unit}`}</strong></div>
                      <TrendLine values={trend.values} />
                      <small>Recent recovery history remains connected here.</small>
                    </article>
                  )) : <p className="tier-calendar-empty">Keep completing check-ins to build recovery trends.</p>}
                </div>
              ) : null}
            </section>

            <section className="recovery-dashboard-panel recovery-actions-panel" data-testid="recovery-actions-panel">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Recovery Actions</p>
                  <h2>{actionTab === 'tools' ? 'Recovery Tools' : 'Check-In'}</h2>
                </div>
                <div className="tier-tab-list recovery-panel-tabs" role="tablist" aria-label="Recovery actions">
                  {([
                    ['tools', 'Recovery Tools'],
                    ['checkIn', 'Check-In'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={actionTab === key ? 'is-active' : ''} onClick={() => setActionTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {actionTab === 'tools' ? (
                <div className="recovery-tools-stack" data-testid="recovery-tools-tab">
                  <div className="recovery-action-list">
                    {logic.recoveryActions.length ? logic.recoveryActions.map((action) => (
                      <article key={action.id}>
                        <span>{formatDuration(action)}</span>
                        <strong>{action.label}</strong>
                        <small>Suggested by the existing recovery engine.</small>
                      </article>
                    )) : <p className="tier-calendar-empty">{logic.symptoms.recoveryRecommendation}</p>}
                  </div>
                  <RecoveryLogger clientId={clientId} />
                </div>
              ) : null}

              {actionTab === 'checkIn' ? (
                <div className="recovery-check-in-panel" data-testid="recovery-check-in-tab">
                  <DailyCheckInForm
                    clientId={clientId}
                    program={program}
                    cycleTrackingEnabled={cycleTrackingEnabled}
                    initial={normalizedCheckInInitial}
                    stayOnSave
                  />
                </div>
              ) : null}
            </section>
          </div>

          <section className="tier-info-panel recovery-management-panel" data-testid="recovery-management-panel">
            <div className="tier-tab-list recovery-management-tabs" role="tablist" aria-label="Recovery management">
              {([
                ['assessment', 'Recovery Assessment'],
                ['history', 'History'],
                ['insights', 'Insights'],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" className={managementTab === key ? 'is-active' : ''} onClick={() => setManagementTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {managementTab === 'assessment' ? (
              <div className="tier-info-grid recovery-assessment-grid" data-testid="recovery-assessment-tab">
                <article><span>Baseline Capacity</span><strong>{logic.client.baselineCapacity || 'Not set'}</strong><small>Assessment-derived capacity context.</small></article>
                <article><span>Recovery Target</span><strong>{logic.recoveryTarget} action{logic.recoveryTarget === 1 ? '' : 's'}</strong><small>From current capacity history.</small></article>
                <article><span>Exercise Target</span><strong>{logic.exerciseTarget} exercises</strong><small>Current training dose guardrail.</small></article>
                <article><span>Cycle Context</span><strong>{logic.cycle.enabled ? logic.cycle.phase || `Day ${logic.cycle.day}` : 'Not tracking'}</strong><small>{logic.cycle.insight || logic.cycle.recoveryAdjustment}</small></article>
                <article><span>Fuel Readiness</span><strong>{logic.fuelReadiness.displayStatus}</strong><small>{logic.fuelReadiness.postWorkoutPriority}</small></article>
                <article><span>Symptoms</span><strong>{logic.symptoms.severity}</strong><small>{logic.symptoms.recoveryRecommendation}</small></article>
              </div>
            ) : null}

            {managementTab === 'history' ? (
              <div className="recovery-history-grid" data-testid="recovery-history-tab">
                {recentActivities.length ? recentActivities.map((activity, index) => (
                  <article key={activity.id || `${activity.activity_type}-${index}`}>
                    <time>{activity.log_date || (activity.created_at ? new Date(activity.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recovery')}</time>
                    <strong>{activity.activity_type || 'Recovery action'}</strong>
                    <small>{activity.duration_minutes ? `${activity.duration_minutes} minutes` : 'Rest-based action'}</small>
                  </article>
                )) : <p className="tier-calendar-empty">Completed recovery actions will appear here.</p>}
              </div>
            ) : null}

            {managementTab === 'insights' ? (
              <div className="tier-info-grid recovery-insights-grid" data-testid="recovery-insights-tab">
                <article><span>Readiness</span><strong>{logic.workoutDecision.intensityTarget}</strong><small>{logic.workoutDecision.reasonForModification}</small></article>
                <article><span>Capacity Drivers</span><strong>{logic.capacityStatus.drivers.length ? logic.capacityStatus.drivers.join(', ') : 'Stable'}</strong><small>Existing capacity engine output.</small></article>
                <article><span>Sleep Support</span><strong>{logic.sleep.logged ? 'Logged' : 'Needs input'}</strong><small>{logic.sleep.logged ? 'Sleep is informing today’s guidance.' : 'Check in to add sleep context.'}</small></article>
                <article><span>Hydration</span><strong>{logic.hydration.status.replaceAll('_', ' ')}</strong><small>{logic.hydration.prompt}</small></article>
                {passiveMetrics.map(([label, value, unit]) => (
                  <article key={label}><span>{label}</span><strong>{Math.round(Number(value))} {unit}</strong><small>{logic.passiveHealth.sources.length ? `Source: ${logic.passiveHealth.sources.join(', ')}` : 'Health metric source'}</small></article>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  )
}
