import { NextResponse } from 'next/server'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTikTokUser, getValidTikTokAccessToken } from '@/lib/aos/social/tiktok/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await getAOSAdminUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { account, accessToken } = await getValidTikTokAccessToken()
    const profile = await fetchTikTokUser(accessToken)
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { error } = await admin.from('social_profiles').upsert({
      account_id: account.id,
      platform: 'tiktok',
      platform_user_id: String(profile.open_id || account.provider_account_id),
      username: profile.username || null,
      display_name: profile.display_name || null,
      bio: profile.bio_description || null,
      avatar_url: profile.avatar_url || null,
      profile_url: profile.profile_deep_link || null,
      is_verified: Boolean(profile.is_verified),
      followers: Number(profile.follower_count || 0),
      following: Number(profile.following_count || 0),
      likes: Number(profile.likes_count || 0),
      post_count: Number(profile.video_count || 0),
      raw: profile,
      synced_at: now,
      updated_at: now,
    }, { onConflict: 'platform,platform_user_id' })
    if (error) throw new Error(error.message)
    await admin.from('social_accounts').update({ last_synced_at: now, last_error: null, updated_at: now }).eq('id', account.id)
    return NextResponse.json({ status: 'synced', profile })
  } catch (error) {
    console.error('TikTok profile sync failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TikTok profile sync failed.' }, { status: 500 })
  }
}
