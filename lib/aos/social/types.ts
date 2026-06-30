// lib/aos/social/types.ts

export type SocialPlatform =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'substack'

export type SocialPost = {
  id: string
  platform: SocialPlatform
  externalId?: string
  url?: string
  title?: string
  caption?: string
  ost?: string
  hook?: string
  pillar?: string
  format?: string
  postedAt: string

  views: number
  likes: number
  comments: number
  shares: number
  saves?: number
  follows?: number
  profileViews?: number

  averageWatchTime?: number
  watchThroughRate?: number
  completionRate?: number

  audienceFemalePercent?: number
  topAgeRange?: string
  returningViewers?: number
  newViewers?: number
}

export type SocialSnapshot = {
  platform: SocialPlatform
  date: string
  followers: number
  profileViews?: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalFollows?: number
}

export type ContentSignal = {
  postId: string
  platform: SocialPlatform
  signalType:
    | 'reach'
    | 'resonance'
    | 'conversion'
    | 'retention'
    | 'audience_alignment'
  score: number
  reason: string
}

export type SocialIntelligenceSnapshot = {
  date: string
  totalViews: number
  totalEngagement: number
  strongestPost?: SocialPost
  strongestSignals: ContentSignal[]
  nextContentMoves: string[]
}
