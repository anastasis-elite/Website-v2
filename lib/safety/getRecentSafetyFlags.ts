import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateSafetyEscalation, type SafetyFlag } from '@/lib/safety/evaluateSafetyEscalation'

export async function getRecentSafetyFlags(supabase: SupabaseClient, clientId: string): Promise<SafetyFlag[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('client_symptom_logs')
    .select('severity, notes, created_at, symptom_types(name, category)')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    console.error('Safety signal lookup failed:', error.message)
    return []
  }
  return evaluateSafetyEscalation(data || [])
}
