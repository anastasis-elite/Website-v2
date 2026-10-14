import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SafetyFlag } from '@/lib/safety/evaluateSafetyEscalation'
import { createAdminClient } from '@/lib/supabase/admin'

type RecommendationAuditType =
  | 'dashboard_safety_escalation'
  | 'daily_program_logic'
  | 'program_generation_safety_escalation'
  | 'program_generation'

const authorizedOperations = new Set<RecommendationAuditType>([
  'dashboard_safety_escalation',
  'daily_program_logic',
  'program_generation_safety_escalation',
  'program_generation',
])

export async function logRecommendationAudit({
  supabase, userId, clientId, recommendationType, inputSnapshot, inputReference,
  engineVersion, recommendationOutput, confidenceLevel, safetyFlags = [],
}: {
  supabase: SupabaseClient
  userId: string
  clientId: string
  recommendationType: RecommendationAuditType
  inputSnapshot?: unknown
  inputReference?: string
  engineVersion: string
  recommendationOutput: unknown
  confidenceLevel?: string
  safetyFlags?: SafetyFlag[]
}) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId || !clientId || !authorizedOperations.has(recommendationType)) {
      console.error('Recommendation audit authorization rejected.')
      return false
    }
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_id,auth_user_id')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (clientError || !client || client.client_id !== clientId || client.auth_user_id !== user.id) {
      console.error('Recommendation audit ownership could not be verified.')
      return false
    }

    // Only verified server operations may use the privileged audit transport.
    // Canonical ownership is stored alongside the original recommendation input.
    const snapshot = inputSnapshot && typeof inputSnapshot === 'object' && !Array.isArray(inputSnapshot)
      ? inputSnapshot : { input: inputSnapshot ?? null }
    const { error } = await createAdminClient().from('recommendation_audit_logs').insert({
      user_id: user.id,
      recommendation_type: recommendationType,
      input_snapshot: { ...snapshot, client_id: client.client_id },
      input_reference: inputReference || null,
      engine_version: engineVersion,
      recommendation_output: recommendationOutput,
      confidence_level: confidenceLevel || null,
      safety_flags: safetyFlags,
    })
    if (error) {
      console.error('Recommendation audit log failed:', 'Database write rejected.', { code: error.code || null })
      return false
    }
    return true
  } catch (error) {
    // Audit transport failures must not prevent recommendations or safety notices.
    console.error('Recommendation audit log failed:', 'Audit operation unavailable.')
    return false
  }
}
