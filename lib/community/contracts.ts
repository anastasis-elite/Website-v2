export const COMMUNITY_CATEGORIES = ['Progress', 'Wins', 'Questions', 'Encouragement', 'Struggle', 'Transformation'] as const
export const COMMUNITY_REPORT_REASONS = ['spam', 'harassment', 'unsafe', 'other'] as const
export const COMMUNITY_MEDIA_BUCKET = 'community-media'
export const COMMUNITY_BODY_LIMIT = 3000
export const COMMUNITY_IMAGE_LIMIT = 10 * 1024 * 1024
export const COMMUNITY_VIDEO_LIMIT = 50 * 1024 * 1024
export const COMMUNITY_MEDIA_FORMATS = {
  'image/jpeg': { kind: 'image', extension: 'jpg', limit: COMMUNITY_IMAGE_LIMIT },
  'image/png': { kind: 'image', extension: 'png', limit: COMMUNITY_IMAGE_LIMIT },
  'image/webp': { kind: 'image', extension: 'webp', limit: COMMUNITY_IMAGE_LIMIT },
  'video/mp4': { kind: 'video', extension: 'mp4', limit: COMMUNITY_VIDEO_LIMIT },
  'video/quicktime': { kind: 'video', extension: 'mov', limit: COMMUNITY_VIDEO_LIMIT },
  'video/webm': { kind: 'video', extension: 'webm', limit: COMMUNITY_VIDEO_LIMIT },
} as const

export type CommunityCategory = typeof COMMUNITY_CATEGORIES[number]
export type CommunityMediaMime = keyof typeof COMMUNITY_MEDIA_FORMATS
export type CommunityReportReason = typeof COMMUNITY_REPORT_REASONS[number]
export type CommunityPost = {
  id: string
  authorId: string
  authorName: string
  category: CommunityCategory
  body: string
  publishedAt: string
  media: null | { type: 'image' | 'video'; mimeType: CommunityMediaMime; url: string }
}
export type CommunityDraft = { id: string; mediaPath: string; mediaMime: CommunityMediaMime; mediaSize: number }
export type CommunityPostInput = { id: string; body: string; category: CommunityCategory; media?: { mimeType: CommunityMediaMime; size: number } | null }
export type CommunityReserveResponse = { post?: CommunityPost; draft?: CommunityDraft }

export function validCommunityId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function communityMediaError(mimeType: unknown, size: unknown): string | null {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'HEIC/HEIF photos are not supported. Export the photo as JPEG and choose it again.'
  if (typeof mimeType !== 'string' || !Object.hasOwn(COMMUNITY_MEDIA_FORMATS, mimeType)) return 'Choose a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.'
  const format = COMMUNITY_MEDIA_FORMATS[mimeType as CommunityMediaMime]
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) return 'Choose a nonempty media file.'
  if (size > format.limit) return format.kind === 'image' ? 'Photos must be 10 MB or smaller.' : 'Videos must be 50 MB or smaller.'
  return null
}
