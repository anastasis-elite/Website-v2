import type { WaterSubmission } from './waterSubmission'

export type WaterReceiptStatus = 'confirmed' | 'unconfirmed' | 'unknown'

// Read-only reconciliation. Both ownership and the original local day must
// match before a saved RPC receipt can prove that this drink was committed.
export async function readWaterReceiptStatus(supabase: any, clientId: string, receipt: WaterSubmission): Promise<WaterReceiptStatus> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) return 'unknown'
    const { data, error } = await supabase.from('nutrition_logs')
      .select('client_id,auth_user_id,log_date,water_submission_ids')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .eq('log_date', receipt.logDate)
      .maybeSingle()
    if (error || !data || data.client_id !== clientId || data.auth_user_id !== user.id ||
        data.log_date !== receipt.logDate || !Array.isArray(data.water_submission_ids)) return 'unknown'
    return data.water_submission_ids.includes(receipt.submissionId) ? 'confirmed' : 'unconfirmed'
  } catch { return 'unknown' }
}
