import {
  ContentSignal,
  SocialIntelligenceSnapshot,
  SocialPost,
} from './types'
import { sampleSocialPosts } from './sampleData'

function getEngagement(post: SocialPost) {
  return (
    post.likes +
    post.comments +
    post.shares +
    (post.saves ?? 0) +
    (post.follows ?? 0)
  )
}

function scoreReach(post: SocialPost): ContentSignal {
  const score = Math.min(100, Math.round(post.views / 15))

  return {
    postId: post.id,
    platform: post.platform,
    signalType: 'reach',
    score,
    reason: `${post.platform} post reached ${post.views} views.`,
  }
}

function scoreResonance(post: SocialPost): ContentSignal {
  const engagement = getEngagement(post)
  const rate = post.views > 0 ? engagement / post.views : 0
  const score = Math.min(100, Math.round(rate * 1000))

  return {
    postId: post.id,
    platform: post.platform,
    signalType: 'resonance',
    score,
    reason: `Engagement rate is approximately ${(rate * 100).toFixed(1)}%.`,
  }
}

function scoreConversion(post: SocialPost): ContentSignal {
  const follows = post.follows ?? 0
  const profileViews = post.profileViews ?? 0
  const conversionBase = follows + profileViews
  const score = Math.min(100, conversionBase * 5)

  return {
    postId: post.id,
    platform: post.platform,
    signalType: 'conversion',
    score,
    reason: `${conversionBase} conversion signals from follows/profile views.`,
  }
}

function scoreRetention(post: SocialPost): ContentSignal {
  const score = Math.round(
    ((post.watchThroughPercent ?? 0) + (post.completionPercent ?? 0)) / 2
  )

  return {
    postId: post.id,
    platform: post.platform,
    signalType: 'retention',
    score,
    reason: `Watch-through ${post.watchThroughPercent ?? 0}% and completion ${
      post.completionPercent ?? 0
    }%.`,
  }
}

function scoreAudienceAlignment(post: SocialPost): ContentSignal {
  let score = 0

  if ((post.audienceFemalePercent ?? 0) >= 85) score += 40
  if (post.topAgeRange === '35-44') score += 40
  if ((post.returningViewers ?? 0) > 75) score += 20

  return {
    postId: post.id,
    platform: post.platform,
    signalType: 'audience_alignment',
    score,
    reason: `Audience is ${post.audienceFemalePercent ?? 0}% female with top age range ${
      post.topAgeRange ?? 'unknown'
    }.`,
  }
}

export function getSocialSignals(posts: SocialPost[] = sampleSocialPosts) {
  return posts.flatMap((post) => [
    scoreReach(post),
    scoreResonance(post),
    scoreConversion(post),
    scoreRetention(post),
    scoreAudienceAlignment(post),
  ])
}

export function getSocialIntelligenceSnapshot(
  posts: SocialPost[] = sampleSocialPosts
): SocialIntelligenceSnapshot {
  const totalViews = posts.reduce((sum, post) => sum + post.views, 0)

  const totalEngagement = posts.reduce(
    (sum, post) => sum + getEngagement(post),
    0
  )

  const strongestPost = [...posts].sort(
    (a, b) => getEngagement(b) + b.views - (getEngagement(a) + a.views)
  )[0]

  const strongestSignals = getSocialSignals(posts)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const topPillar = strongestPost?.pillar ?? 'capacity'
  const topFormat = strongestPost?.format ?? 'talking_head'

  const nextContentMoves = [
    `Repeat the strongest pillar: ${topPillar}.`,
    `Create another ${topFormat.replace('_', ' ')} post with a clearer CTA.`,
    'Look for comments, saves, shares, and follows before judging by views alone.',
    'Use one post for reach, one for resonance, and one for conversion.',
  ]

  return {
    date: new Date().toISOString(),
    totalViews,
    totalEngagement,
    strongestPost,
    strongestSignals,
    nextContentMoves,
  }
}
