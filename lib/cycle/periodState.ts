export type PeriodState = {
  status: 'active' | 'ended' | 'unknown'
  recordedDate: string | null
  loadError?: boolean
}

export function cycleTrackingAllowed(client: any): boolean {
  return client.cycle_tracking_enabled !== false &&
    !['menopause', 'pregnant', 'not_tracking'].includes(String(client.reproductive_status || 'cycling'))
}

// An onset alone cannot tell us whether bleeding has ended. Only explicit
// lifecycle answers participate; there is no expiry for a confirmed active period.
export async function readPeriodState(supabase: any, client: any, today: string): Promise<PeriodState> {
  const unknown: PeriodState = { status: 'unknown', recordedDate: null }
  if (!cycleTrackingAllowed(client)) return unknown
  try {
    const { data, error } = await supabase.from('cycle_logs')
      .select('log_date, period_status')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
      .in('period_status', ['active', 'ended']).lte('log_date', today)
      .order('log_date', { ascending: false }).limit(1).maybeSingle()
    if (error) return { ...unknown, loadError: true }
    if (!data || !['active', 'ended'].includes(data.period_status)) return unknown
    // The Cycle page can record a newer onset without an explicit end answer.
    // A status from an older cycle does not establish that new period's state.
    const latestStart = String(client.last_period_start || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(latestStart) && latestStart > data.log_date && latestStart <= today) return unknown
    return { status: data.period_status, recordedDate: data.log_date }
  } catch {
    return { ...unknown, loadError: true }
  }
}
