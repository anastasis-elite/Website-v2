import type { SupabaseClient } from '@supabase/supabase-js'
import { getTierCapabilities } from '@/lib/entitlements'

export async function getMealLoggingAccess(supabase: SupabaseClient, userId: string) {
  const { data: client, error } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (error || !client) return { allowed: false, status: 404, error: 'Client not found.' } as const
  const capabilities = getTierCapabilities(client.program)
  if (!capabilities.nutritionMealLogging) return { allowed: false, status: 403, error: 'Meal logging is not available for this tier.' } as const
  return { allowed: true, client, capabilities } as const
}
