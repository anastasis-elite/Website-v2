type OnboardingData = Record<string, any>
type UpdateResult = { saved: true; onboardingData: OnboardingData } | { saved: false; status: 404 | 409 | 500 }

// Merge a small owner-scoped preference change into the latest JSON snapshot.
// Re-reading after a missed comparison avoids discarding another device's choices.
export async function updateOwnedOnboardingData({
  supabase, userId, clientId, merge, fields = {},
}: {
  supabase: any
  userId: string
  clientId: string
  merge: (current: OnboardingData) => OnboardingData
  fields?: Record<string, unknown>
}): Promise<UpdateResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: client, error: readError } = await supabase.from('clients').select('onboarding_data')
      .eq('client_id', clientId).eq('auth_user_id', userId).maybeSingle()
    if (readError) return { saved: false, status: 500 }
    if (!client) return { saved: false, status: 404 }
    const original = client.onboarding_data
    if (original != null && (typeof original !== 'object' || Array.isArray(original))) return { saved: false, status: 409 }
    const onboardingData = merge(original || {})
    let update = supabase.from('clients').update({ ...fields, onboarding_data: onboardingData })
      .eq('client_id', clientId).eq('auth_user_id', userId)
    update = original == null ? update.is('onboarding_data', null) : update.eq('onboarding_data', JSON.stringify(original))
    const { data: saved, error: writeError } = await update.select('client_id').maybeSingle()
    if (writeError) return { saved: false, status: 500 }
    if (saved) return { saved: true, onboardingData }
  }
  return { saved: false, status: 409 }
}
