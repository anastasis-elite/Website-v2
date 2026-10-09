import { getClientLocalDate } from '@/lib/timezone'
import { getClientDayRange } from '@/lib/schedule/time'
export function mergeDailySymptoms(symptoms: any[], cycle: any) {
  const byName = new Map<string, any>()
  for (const symptom of symptoms) {
    const key = String(symptom.symptom_types?.name || symptom.symptom_name || '').toLowerCase()
    if (!byName.has(key)) byName.set(key, { ...symptom, source: 'symptom_log' })
  }
  const flags = ['cramps','headache','fatigue','mood_sensitivity']
  for (const name of flags) {
    if (!cycle?.answered_fields?.includes(name) || cycle[name] !== false) continue
    for (const [key, symptom] of byName) if (key.includes(name.replace('_',' ')) && new Date(cycle.updated_at || cycle.created_at || 0) > new Date(symptom.created_at || 0)) byName.delete(key)
  }
  const cycleNames = new Set([...flags.filter(key => cycle?.[key] === true), ...Object.keys(cycle?.symptoms || {})])
  for (const name of cycleNames) {
    if (![...byName.keys()].some(key => key.includes(name.replace('_', ' ')))) byName.set(name, {
      symptom_name: name.replaceAll('_',' '), severity: null, reported_intensity: cycle?.symptoms?.[name] || null,
      created_at: cycle?.updated_at || cycle?.created_at || null, source: 'cycle_log' })
  }
  return [...byName.values()]
}
export async function loadDailySignals(supabase: any, client: any) {
  const date = getClientLocalDate(client), day = getClientDayRange(client, date)
  const [recovery, cycle, symptoms] = await Promise.all([
    supabase.from('recovery_logs').select('*').eq('client_id',client.client_id).eq('log_date',date).maybeSingle(),
    supabase.from('cycle_logs').select('*').eq('client_id',client.client_id).eq('log_date',date).maybeSingle(),
    supabase.from('client_symptom_logs').select('*,symptom_types(name,category)').eq('client_id',client.client_id).gte('created_at',day.start.toISOString()).lt('created_at',day.end.toISOString()).order('created_at',{ascending:false}),
  ])
  return { date, recovery: recovery.data, cycle: cycle.data, symptoms: mergeDailySymptoms(symptoms.data || [], cycle.data) }
}
