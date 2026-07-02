import { NextResponse } from 'next/server'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTikTokVideos, getValidTikTokAccessToken } from '@/lib/aos/social/tiktok/api'
import { normalizeSocialPost } from '@/lib/aos/social/normalizeSocialPost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await getAOSAdminUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { account, accessToken } = await getValidTikTokAccessToken()
    const rawVideos = await fetchTikTokVideos(accessToken)
    const posts = rawVideos.map((raw) => normalizeSocialPost('tiktok', raw))
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const postRows = posts.map((post, index) => ({
      account_id: account.id,
      platform: 'tiktok',
      post_id: post.postId,
      post_url: post.postUrl,
      caption: post.caption,
      posted_at: post.postedAt,
      title: String(rawVideos[index].title || ''),
      duration_seconds: Number(rawVideos[index].duration || 0),
      cover_image_url: String(rawVideos[index].cover_image_url || ''),
      embed_url: String(rawVideos[index].embed_link || ''),
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      raw: post.raw,
      updated_at: now,
    }))

    if (postRows.length) {
      const { error: postError } = await admin.from('social_posts').upsert(postRows, { onConflict: 'platform,post_id' })
      if (postError) throw new Error(postError.message)
      const metricDate = now.slice(0, 10)
      const { error: metricError } = await admin.from('social_post_metrics_daily').upsert(
        posts.map((post) => ({
          account_id: account.id,
          platform: 'tiktok',
          post_id: post.postId,
          metric_date: metricDate,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
          captured_at: now,
        })),
        { onConflict: 'platform,post_id,metric_date' }
      )
      if (metricError) throw new Error(metricError.message)
    }

    await admin.from('social_accounts').update({ last_synced_at: now, last_error: null, updated_at: now }).eq('id', account.id)
    return NextResponse.json({ status: 'synced', videos: postRows.length })
  } catch (error) {
    console.error('TikTok video sync failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TikTok video sync failed.' }, { status: 500 })
  }
}
