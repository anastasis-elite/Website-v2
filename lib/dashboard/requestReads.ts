import 'server-only'

export type DashboardInitialAssessment = {
  data?: Record<string, unknown> | null
  submitted_at?: string | null
  [key: string]: unknown
}
export type DashboardAssessmentRead = {
  data: DashboardInitialAssessment | null
  error?: { message: string; [key: string]: unknown } | null
  [key: string]: unknown
}
export type DashboardRequestReads = {
  readLatestInitialAssessment: (context: { supabase: any; clientId: string }) => Promise<DashboardAssessmentRead>
}

/** Create only inside an authorized server request. No module-level cache or
 * effective-profile snapshot is retained: the database still supplies raw rows.
 * Only the identical, undated latest-initial query is shared. Date-bound reads
 * with different ranges, projections or limits keep their original queries. */
export function createDashboardRequestReads({ supabase, user, client }: {
  supabase: any
  user: { id: string }
  client: { client_id: string; auth_user_id?: string | null }
}): DashboardRequestReads {
  if (!supabase || !user?.id || !client?.client_id || client.auth_user_id !== user.id) {
    throw new Error('Dashboard request reads require the verified member owner.')
  }
  const clientId = client.client_id
  let initial: Promise<DashboardAssessmentRead> | undefined
  return {
    async readLatestInitialAssessment(context) {
      if (context.supabase !== supabase || context.clientId !== clientId) {
        throw new Error('Dashboard request read scope changed.')
      }
      initial ||= Promise.resolve().then(() => supabase.from('assessments').select('*')
        .eq('client_id', clientId).eq('assessment_type', 'initial')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle())
      const result = await initial
      // Separate query responses previously had separate JSON objects. Keep that
      // property while sharing the I/O and preserving errors/rejections as-is.
      return { ...result, data: result.data == null ? result.data : structuredClone(result.data) }
    },
  }
}
