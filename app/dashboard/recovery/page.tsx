import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import RecoveryDashboardClient from '@/components/recovery/RecoveryDashboardClient'
import { getClientLocalDateOffset } from '@/lib/timezone'
import { isSorenessRegionKey } from '@/lib/recovery/sorenessRegions'

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function average(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null)
  if (!known.length) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

export default async function RecoveryPage() {
  const { client, supabase, user } = await getDashboardContext()
  const logic = await getProgramLogicForClient({supabase,user,client})
  const today = getClientLocalDateOffset(client)
  const sevenDaysAgo = getClientLocalDateOffset(client, -6)
  const fourteenDaysAgo = getClientLocalDateOffset(client, -13)

  const [{ data: todayRecoveryLog }, { data: recentRecoveryLogs }, { data: recentActivities }] = await Promise.all([
    supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).maybeSingle(),
    supabase
      .from('recovery_logs')
      .select('log_date,sleep_hours,sleep_quality,stress_level,soreness_level,energy_level')
      .eq('client_id', client.client_id)
      .gte('log_date', fourteenDaysAgo)
      .lte('log_date', today)
      .order('log_date', { ascending: true }),
    supabase
      .from('recovery_activity_logs')
      .select('id,activity_type,duration_minutes,log_date,created_at')
      .eq('user_id', user.id)
      .eq('client_id', client.client_id)
      .gte('log_date', sevenDaysAgo)
      .lte('log_date', today)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const trendRows = recentRecoveryLogs || []
  const buildTrend = (key: string, label: string, unit: string, column: string) => {
    const values = trendRows.map((row: any) => nullableNumber(row[column]))
    return { key, label, unit, values, currentAverage: average(values.slice(-7)) }
  }

  const trends = [
    buildTrend('sleep_hours', 'Sleep Duration', ' hr', 'sleep_hours'),
    buildTrend('sleep_quality', 'Sleep Quality', '/10', 'sleep_quality'),
    buildTrend('stress', 'Stress', '/10', 'stress_level'),
    buildTrend('soreness', 'Soreness', '/10', 'soreness_level'),
    buildTrend('energy', 'Energy', '/10', 'energy_level'),
  ].filter((trend) => trend.values.some((value) => value !== null))

  const cycleTrackingEnabled = !['menopause','pregnant','not_tracking'].includes(String(client.reproductive_status||'cycling'))

  return (
    <RecoveryDashboardClient
      logic={logic}
      clientId={client.client_id}
      program={client.program || logic.program}
      cycleTrackingEnabled={cycleTrackingEnabled}
      checkInInitial={{
        sleepHours: todayRecoveryLog?.sleep_hours,
        sleepQuality: todayRecoveryLog?.sleep_quality,
        stress: todayRecoveryLog?.stress_level,
        soreness: todayRecoveryLog?.soreness_level,
        energy: todayRecoveryLog?.energy_level,
        mood: todayRecoveryLog?.mood_level,
        hunger: todayRecoveryLog?.hunger_level,
        notes: todayRecoveryLog?.notes,
        sorenessRegions: Array.isArray(todayRecoveryLog?.soreness_regions)
          ? todayRecoveryLog.soreness_regions.filter(isSorenessRegionKey)
          : [],
      }}
      trends={trends}
      recentActivities={recentActivities || []}
    />
  )
}
