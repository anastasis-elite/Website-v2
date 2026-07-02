import type { SupabaseClient } from '@supabase/supabase-js'
import type { SafetyFlag } from '@/lib/safety/evaluateSafetyEscalation'

export async function logRecommendationAudit({
  supabase, userId, recommendationType, inputSnapshot, inputReference,
  engineVersion, recommendationOutput, confidenceLevel, safetyFlags = [],
}: {
  supabase: SupabaseClient
  userId: string
  recommendationType: string
  inputSnapshot?: unknown
  inputReference?: string
  engineVersion: string
  recommendationOutput: unknown
  confidenceLevel?: string
  safetyFlags?: SafetyFlag[]
}) {
  const { error } = await supabase.from('recommendation_audit_logs').insert({
    user_id: userId,
    recommendation_type: recommendationType,
    input_snapshot: inputSnapshot || null,
    input_reference: inputReference || null,
    engine_version: engineVersion,
    recommendation_output: recommendationOutput,
    confidence_level: confidenceLevel || null,
    safety_flags: safetyFlags,
  })
  if (error) console.error('Recommendation audit log failed:', error.message)
}
