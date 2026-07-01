const TIKTOK_VIDEO_FIELDS = [
  'id',
  'title',
  'video_description',
  'create_time',
  'share_url',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',')

type TikTokListResponse = {
  data?: {
    videos?: Record<string, unknown>[]
    cursor?: number
    has_more?: boolean
  }
  error?: { code?: string; message?: string; log_id?: string }
}

export async function fetchTikTokPosts(accessToken: string) {
  const posts: Record<string, unknown>[] = []
  let cursor: number | undefined

  for (let page = 0; page < 5; page += 1) {
    const response = await fetch(
      `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(TIKTOK_VIDEO_FIELDS)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_count: 20,
          ...(cursor ? { cursor } : {}),
        }),
        cache: 'no-store',
      }
    )

    const payload = (await response.json()) as TikTokListResponse

    if (!response.ok || (payload.error?.code && payload.error.code !== 'ok')) {
      throw new Error(
        payload.error?.message || `TikTok API request failed (${response.status}).`
      )
    }

    posts.push(...(payload.data?.videos || []))

    if (!payload.data?.has_more || !payload.data.cursor) break
    cursor = payload.data.cursor
  }

  return posts
}
