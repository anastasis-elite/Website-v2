export type NormalizedSocialPost = {
  platform: 'tiktok' | 'instagram'
  postId: string
  postUrl: string
  caption: string
  postedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  raw: Record<string, unknown>
}

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function instagramInsight(raw: Record<string, unknown>, metric: string) {
  const insights = Array.isArray(raw._insights) ? raw._insights : []
  const match = insights.find(
    (item) => item && typeof item === 'object' && (item as any).metric === metric
  ) as { value?: unknown } | undefined
  return number(match?.value)
}

export function normalizeSocialPost(
  platform: 'tiktok' | 'instagram',
  raw: Record<string, unknown>
): NormalizedSocialPost {
  if (platform === 'tiktok') {
    return {
      platform,
      postId: String(raw.id || ''),
      postUrl: String(raw.share_url || ''),
      caption: String(raw.video_description || raw.title || ''),
      postedAt: raw.create_time
        ? new Date(number(raw.create_time) * 1000).toISOString()
        : new Date(0).toISOString(),
      views: number(raw.view_count),
      likes: number(raw.like_count),
      comments: number(raw.comment_count),
      shares: number(raw.share_count),
      saves: 0,
      raw,
    }
  }

  return {
    platform,
    postId: String(raw.id || ''),
    postUrl: String(raw.permalink || ''),
    caption: String(raw.caption || ''),
    postedAt: raw.timestamp ? new Date(String(raw.timestamp)).toISOString() : new Date(0).toISOString(),
    views: instagramInsight(raw, 'views'),
    likes: number(raw.like_count),
    comments: number(raw.comments_count),
    shares: instagramInsight(raw, 'shares'),
    saves: instagramInsight(raw, 'saved'),
    raw,
  }
}
