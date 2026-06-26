// marketing/types/index.ts

export type MarketingPillar =
  | 'Identity'
  | 'Philosophy'
  | 'Evidence'
  | 'Education'
  | 'Lifestyle'
  | 'Invitation'

export type HookFamily =
  | 'Identity'
  | 'Emotional'
  | 'Authority'
  | 'Contrarian'
  | 'Curiosity'
  | 'Why Now'
  | 'Story'

export type MarketingPlatform =
  | 'TikTok'
  | 'Instagram'
  | 'YouTube'
  | 'Facebook'
  | 'Threads'
  | 'Pinterest'
  | 'LinkedIn'
  | 'Email'

export type ContentType =
  | 'Reel'
  | 'Short'
  | 'Caption'
  | 'Carousel'
  | 'Email'
  | 'Story'
  | 'Long Form'
  | 'Thread'
  | 'Pin'

export type MarketingRecommendation = {
  platform: MarketingPlatform
  pillar: MarketingPillar
  hookFamily: HookFamily
  contentType: ContentType
  campaign: string
  cta: string
  reason: string
}
