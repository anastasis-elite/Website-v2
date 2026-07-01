const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'
const GRAPH_ROOT = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const MEDIA_FIELDS = [
  'id',
  'caption',
  'permalink',
  'timestamp',
  'media_type',
  'like_count',
  'comments_count',
].join(',')

type GraphCollection = {
  data?: Record<string, unknown>[]
  paging?: { next?: string }
  error?: { message?: string }
}

async function fetchInsight(postId: string, metric: string, accessToken: string) {
  const url = new URL(`${GRAPH_ROOT}/${postId}/insights`)
  url.searchParams.set('metric', metric)
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json()

  if (!response.ok) {
    return { metric, value: 0, unavailable: true, error: payload?.error || payload }
  }

  const value = Number(payload?.data?.[0]?.values?.[0]?.value || 0)
  return { metric, value, raw: payload }
}

export async function fetchInstagramPosts({
  accessToken,
  businessAccountId,
}: {
  accessToken: string
  businessAccountId: string
}) {
  const url = new URL(`${GRAPH_ROOT}/${businessAccountId}/media`)
  url.searchParams.set('fields', MEDIA_FIELDS)
  url.searchParams.set('limit', '100')
  url.searchParams.set('access_token', accessToken)

  const posts: Record<string, unknown>[] = []
  let nextUrl: string | undefined = url.toString()

  for (let page = 0; page < 5 && nextUrl; page += 1) {
    const response = await fetch(nextUrl, { cache: 'no-store' })
    const payload = (await response.json()) as GraphCollection

    if (!response.ok) {
      throw new Error(payload.error?.message || `Instagram API request failed (${response.status}).`)
    }

    posts.push(...(payload.data || []))
    nextUrl = payload.paging?.next
  }

  return Promise.all(
    posts.map(async (post) => {
      const postId = String(post.id || '')
      const insights = await Promise.all(
        ['views', 'saved', 'shares'].map((metric) =>
          fetchInsight(postId, metric, accessToken)
        )
      )

      return { ...post, _insights: insights }
    })
  )
}
