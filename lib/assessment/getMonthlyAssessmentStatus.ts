export async function getMonthlyAssessmentStatus(supabase: any, clientId: string) {
  const { data } = await supabase
    .from('assessments')
    .select('id,submitted_at')
    .eq('client_id', clientId)
    .eq('assessment_type', 'monthly')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastCompletedAt = data?.submitted_at || null
  const due = !lastCompletedAt || Date.now() - new Date(lastCompletedAt).getTime() >= 30 * 24 * 60 * 60 * 1000
  return { due, lastCompletedAt }
}
