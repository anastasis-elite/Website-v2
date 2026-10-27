export const photoViews = ['front', 'back', 'left', 'right'] as const
export type PhotoView = typeof photoViews[number]
export type PhotoSet = { id: string; date: string; type: string; views: Partial<Record<PhotoView, string>> }
export type PhotoComparison = { first: PhotoSet | null; latest: PhotoSet | null; side: 'left' | 'right'; unavailable: boolean }

export function matchingPhotoSide(first: PhotoSet | null, latest: PhotoSet | null): 'left' | 'right' {
  if (first?.views.left && latest?.views.left) return 'left'
  if (first?.views.right && latest?.views.right) return 'right'
  // A missing matching view stays missing; never substitute the opposite side.
  return first?.views.left || latest?.views.left ? 'left' : first?.views.right || latest?.views.right ? 'right' : 'left'
}

export async function signPhotoSet(supabase: any, client: any, row: any): Promise<PhotoSet | null> {
  if (!row || row.client_id !== client.client_id || row.auth_user_id !== client.auth_user_id
    || !row.id || !Number.isFinite(Date.parse(row.uploaded_at))) return null
  const views: PhotoSet['views'] = {}
  await Promise.all(photoViews.map(async view => {
    const path = row[`${view}_photo_url`]
    if (typeof path !== 'string' || !path.startsWith(`${client.client_id}/`)) return
    try {
      const { data, error } = await supabase.storage.from('assessment_photos').createSignedUrl(path, 1800)
      if (!error && data?.signedUrl) views[view] = data.signedUrl
    } catch { /* An unavailable view stays visibly unavailable. */ }
  }))
  return { id: String(row.id), date: row.uploaded_at, type: row.assessment_type || 'progress', views }
}

export async function getProgressPhotoComparison(supabase: any, client: any, now = new Date()): Promise<PhotoComparison> {
  const empty: PhotoComparison = { first: null, latest: null, side: 'left', unavailable: false }
  if (!client?.client_id || !client?.auth_user_id) return { ...empty, unavailable: true }
  try {
    const query = (ascending: boolean) => supabase.from('assessment_photos').select('*')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
      .neq('assessment_type', 'posture').lte('uploaded_at', now.toISOString())
      .order('uploaded_at', { ascending }).order('id', { ascending }).limit(1).maybeSingle()
    const [firstResult, latestResult] = await Promise.all([query(true), query(false)])
    if (firstResult.error || latestResult.error) return { ...empty, unavailable: true }
    const [first, last] = await Promise.all([
      signPhotoSet(supabase, client, firstResult.data), signPhotoSet(supabase, client, latestResult.data),
    ])
    if (firstResult.data && !first || latestResult.data && !last) return { ...empty, unavailable: true }
    const latest = last?.id === first?.id ? null : last
    return { first, latest, side: matchingPhotoSide(first, latest), unavailable: false }
  } catch { return { ...empty, unavailable: true } }
}
