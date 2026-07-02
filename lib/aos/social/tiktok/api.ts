import { createAdminClient } from '@/lib/supabase/admin'
import {
  decryptTikTokToken,
  encryptTikTokToken,
} from '@/lib/aos/social/tiktok/tokenCrypto'

export const TIKTOK_OWNER = 'internal/anastasis'
export const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
]

export const TIKTOK_USER_FIELDS = [
  'open_id',
  'union_id',
  'avatar_url',
  'display_name',
  'bio_description',
  'profile_deep_link',
  'is_verified',
  'username',
  'follower_count',
  'following_count',
  'likes_count',
  'video_count',
]

export const TIKTOK_VIDEO_FIELDS = [
  'id',
  'title',
  'video_description',
  'create_time',
  'duration',
  'cover_image_url',
  'share_url',
  'embed_link',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
]

type TikTokToken = {
  access_token: string
  expires_in: number
  open_id: string
  refresh_expires_in: number
  refresh_token: string
  scope: string
  token_type: string
}

export type SocialAccount = {
  id: string
  provider: string
  owner: string
  provider_account_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  access_token_expires_at: string
  refresh_token_expires_at: string
  scopes: string[]
}

function credentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) {
    throw new Error('TikTok client credentials are not configured.')
  }
  return { clientKey, clientSecret }
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const payload = (await response.json()) as TikTokToken & {
    error?: string
    error_description?: string
  }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'TikTok token request failed.')
  }
  return payload
}

export async function exchangeTikTokCode(code: string, redirectUri: string) {
  const { clientKey, clientSecret } = credentials()
  return tokenRequest(
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })
  )
}

function tokenDates(token: TikTokToken) {
  const now = Date.now()
  return {
    access_token_expires_at: new Date(now + token.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + token.refresh_expires_in * 1000).toISOString(),
  }
}

export async function saveTikTokAccount(token: TikTokToken) {
  const admin = createAdminClient()
  const dates = tokenDates(token)
  const { data, error } = await admin
    .from('social_accounts')
    .upsert(
      {
        provider: 'tiktok',
        owner: TIKTOK_OWNER,
        provider_account_id: token.open_id,
        access_token_encrypted: encryptTikTokToken(token.access_token),
        refresh_token_encrypted: encryptTikTokToken(token.refresh_token),
        ...dates,
        scopes: token.scope.split(',').map((scope) => scope.trim()).filter(Boolean),
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,owner' }
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as SocialAccount
}

export async function getTikTokAccount() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('provider', 'tiktok')
    .eq('owner', TIKTOK_OWNER)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as SocialAccount | null
}

export async function getValidTikTokAccessToken() {
  const account = await getTikTokAccount()
  if (!account) throw new Error('Lyndsey’s TikTok is not connected.')

  const refreshBuffer = Date.now() + 5 * 60 * 1000
  if (new Date(account.access_token_expires_at).getTime() > refreshBuffer) {
    return { account, accessToken: decryptTikTokToken(account.access_token_encrypted) }
  }

  if (new Date(account.refresh_token_expires_at).getTime() <= Date.now()) {
    throw new Error('TikTok authorization expired. Reconnect the account.')
  }

  const { clientKey, clientSecret } = credentials()
  const refreshed = await tokenRequest(
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: decryptTikTokToken(account.refresh_token_encrypted),
    })
  )
  const updated = await saveTikTokAccount(refreshed)
  return { account: updated, accessToken: refreshed.access_token }
}

export function tikTokRedirectUri(origin: string) {
  return process.env.TIKTOK_REDIRECT_URI || `${origin}/api/internal/tiktok/callback`
}

export async function fetchTikTokUser(accessToken: string) {
  const response = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${TIKTOK_USER_FIELDS.join(',')}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  )
  const payload = await response.json()
  if (!response.ok || (payload.error?.code && payload.error.code !== 'ok')) {
    throw new Error(payload.error?.message || 'TikTok profile sync failed.')
  }
  return payload.data?.user as Record<string, unknown>
}

export async function fetchTikTokVideos(accessToken: string) {
  const videos: Record<string, unknown>[] = []
  let cursor: number | undefined

  for (let page = 0; page < 5; page += 1) {
    const response = await fetch(
      `https://open.tiktokapis.com/v2/video/list/?fields=${TIKTOK_VIDEO_FIELDS.join(',')}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
        cache: 'no-store',
      }
    )
    const payload = await response.json()
    if (!response.ok || (payload.error?.code && payload.error.code !== 'ok')) {
      throw new Error(payload.error?.message || 'TikTok video sync failed.')
    }
    videos.push(...(payload.data?.videos || []))
    if (!payload.data?.has_more || !payload.data.cursor) break
    cursor = payload.data.cursor
  }
  return videos
}
