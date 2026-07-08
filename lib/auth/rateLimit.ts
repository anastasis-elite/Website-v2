import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enforceRateLimit({
  supabase,
  scope,
  key,
  limit,
  windowMinutes,
}: {
  supabase: SupabaseClient
  scope: string
  key: string
  limit: number
  windowMinutes: number
}) {
  const keyHash = createHash('sha256').update(key).digest('hex')
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { count, error } = await supabase
    .from('api_request_events')
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .eq('key_hash', keyHash)
    .gte('created_at', since)
  if (error) throw new Error('Rate limit service is unavailable.')
  if ((count || 0) >= limit) return false
  const { error: insertError } = await supabase.from('api_request_events').insert({ scope, key_hash: keyHash })
  if (insertError) throw new Error('Rate limit service is unavailable.')
  return true
}
