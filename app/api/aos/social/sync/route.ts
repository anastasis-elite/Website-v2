import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { fetchTikTokPosts } from '@/lib/aos/social/connectors/tiktok'
import { fetchInstagramPosts } from '@/lib/aos/social/connectors/instagram'
import {
  normalizeSocialPost,
  type NormalizedSocialPost,
} from '@/lib/aos/social/normalizeSocialPost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SyncResult = {
  platform: 'tiktok' | 'instagram'
  status: 'synced' | 'skipped' | 'error'
  postsFetched?: number
  postsUpserted?: number
  reason?: string
}

function databaseRows(posts: NormalizedSocialPost[]) {
  return posts.map((post) => ({
    platform: post.platform,
    post_id: post.postId,
    post_url: post.postUrl,
    caption: post.caption,
    posted_at: post.postedAt,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    saves: post.saves,
    raw: post.raw,
    updated_at: new Date().toISOString(),
  }))
}

async function upsertPosts(posts: NormalizedSocialPost[]) {
  if (!posts.length) return 0

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service-role environment variables.')
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rows = databaseRows(posts)
  const { error } = await admin
    .from('social_posts')
    .upsert(rows, { onConflict: 'platform,post_id' })

  if (error) throw new Error(error.message)
  return rows.length
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.all([syncTikTok(), syncInstagram()])

  return NextResponse.json({
    success: results.some((result) => result.status === 'synced'),
    results,
  })
}

async function syncTikTok(): Promise<SyncResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN

  if (!accessToken) {
    return {
      platform: 'tiktok',
      status: 'skipped',
      reason: 'TIKTOK_ACCESS_TOKEN is not configured.',
    }
  }

  try {
    const rawPosts = await fetchTikTokPosts(accessToken)
    const posts = rawPosts
      .map((post) => normalizeSocialPost('tiktok', post))
      .filter((post) => post.postId)
    const postsUpserted = await upsertPosts(posts)

    return {
      platform: 'tiktok',
      status: 'synced',
      postsFetched: rawPosts.length,
      postsUpserted,
    }
  } catch (error) {
    return {
      platform: 'tiktok',
      status: 'error',
      reason: error instanceof Error ? error.message : 'TikTok sync failed.',
    }
  }
}

async function syncInstagram(): Promise<SyncResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  const missing = [
    !accessToken ? 'INSTAGRAM_ACCESS_TOKEN' : null,
    !businessAccountId ? 'INSTAGRAM_BUSINESS_ACCOUNT_ID' : null,
  ].filter(Boolean)

  if (missing.length) {
    return {
      platform: 'instagram',
      status: 'skipped',
      reason: `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not configured.`,
    }
  }

  try {
    const rawPosts = await fetchInstagramPosts({
      accessToken: accessToken!,
      businessAccountId: businessAccountId!,
    })
    const posts = rawPosts
      .map((post) => normalizeSocialPost('instagram', post))
      .filter((post) => post.postId)
    const postsUpserted = await upsertPosts(posts)

    return {
      platform: 'instagram',
      status: 'synced',
      postsFetched: rawPosts.length,
      postsUpserted,
    }
  } catch (error) {
    return {
      platform: 'instagram',
      status: 'error',
      reason:
        error instanceof Error ? error.message : 'Instagram sync failed.',
    }
  }
}
