import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import RecoveryDashboardClient from '@/components/recovery/RecoveryDashboardClient'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getDailyScheduleState } from '@/lib/schedule/service'
import type { DailyScheduleState } from '@/lib/schedule/types'

export default async function RecoveryPage() {
  const { client, supabase, user } = await getDashboardContext()
  const dailyPlan = await getDailyExecutionPlan({supabase,client})
  const logic = await getProgramLogicForClient({supabase,user,client,dailyPlan})
  let schedule: DailyScheduleState | undefined
  try {
    // Recovery uses the same owner/day/window/hold/tier presentation as Today.
    schedule = await getDailyScheduleState({supabase,user,client,logic,dailyPlan,sourceTimeoutMs:2000})
  } catch {
    // An optional suggestion must not prevent opening the existing activities.
  }
  const model = schedule?.todayViewModel
  const candidate = model?.version === 1 && model.clientId === client.client_id && model.tier === logic.program &&
    model.date === schedule?.date && model.timezone === schedule?.timezone && model.generatedAt === schedule?.now
    ? model.recoveryRewardSuggestion
    : !schedule && logic.recoveryRewardSuggestion?.kind === 'safety' ? logic.recoveryRewardSuggestion : undefined
  const suggestion = candidate?.version === 1 && candidate.clientId === client.client_id &&
    candidate.date === getClientLocalDate(client) && candidate.timezone === getClientTimeZone(client) ? candidate : undefined

  const emberRecoveryCopy = logic.program === 'ember' && logic.recoveryRewardSuggestion?.kind !== 'safety'

  const refreshBoundary = Math.min(...[model?.nextRefreshAt, model?.deferredReturnAt]
    .flatMap(value => value && Number.isFinite(Date.parse(value)) ? [Date.parse(value)] : []))
  const nextRefreshAt = Number.isFinite(refreshBoundary) ? new Date(refreshBoundary).toISOString() : null

  return (
    <PhoneAppFrame eyebrow="Recovery" title={emberRecoveryCopy ? 'A little reward, just for you.' : 'A little room to restore.'} subtitle={emberRecoveryCopy ? 'Choose your own way to unwind.' : 'Choose what feels right today.'}><RecoveryDashboardClient
      clientId={client.client_id} suggestion={suggestion}
      schedule={schedule ? { date: schedule.date, timezone: schedule.timezone, events: schedule.events,
        nextRefreshAt } : undefined}
    /></PhoneAppFrame>
  )
}
