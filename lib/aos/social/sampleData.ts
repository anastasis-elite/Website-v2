import { SocialPost, SocialSnapshot } from './types'

export const sampleSocialPosts: SocialPost[] = [
  {
    id: 'tiktok-001',
    platform: 'tiktok',
    caption:
      'Women do not need more discipline. They need systems that account for capacity.',
    ost: 'You are not lazy. Your system is overloaded.',
    hook: 'You do not need more discipline.',
    pillar: 'capacity',
    format: 'talking_head',
    postedAt: '2026-06-24',

    views: 1200,
    likes: 84,
    comments: 6,
    shares: 8,
    saves: 4,
    follows: 3,
    profileViews: 18,

    averageWatchTime: 6.8,
    watchThrough: 42,
    completion: 31,

    audienceFemalePercent: 94,
    topAgeRange: '35-44',
    returningViewers: 140,
    newViewers: 1060,
  },
  {
    id: 'tiktok-002',
    platform: 'tiktok',
    caption:
      'Behind the scenes building the future of women’s wellness, one decision at a time.',
    ost: 'Come with me as I build the future of women’s wellness.',
    hook: 'Come with me...',
    pillar: 'brand_philosophy',
    format: 'dashboard_bts',
    postedAt: '2026-06-25',

    views: 850,
    likes: 61,
    comments: 4,
    shares: 5,
    saves: 3,
    follows: 2,
    profileViews: 11,

    averageWatchTimeSeconds: 5.1,
    watchThroughPercent: 36,
    completionPercent: 24,

    audienceFemalePercent: 91,
    topAgeRange: '35-44',
    returningViewers: 118,
    newViewers: 732,
  },
  {
    id: 'instagram-001',
    platform: 'instagram',
    caption:
      'Every time you make progress, you move the finish line. That is not always bad. Forgetting to acknowledge the progress is what kills motivation.',
    ost: 'Moving the finish line...',
    hook: 'Moving the finish line...',
    pillar: 'progress_identity',
    format: 'educational',
    postedAt: '2026-06-25',

    views: 700,
    likes: 42,
    comments: 3,
    shares: 2,
    saves: 5,
    follows: 1,
    profileViews: 7,

    watchThroughPercent: 39,
    completionPercent: 28,

    audienceFemalePercent: 88,
    topAgeRange: '35-44',
    returningViewers: 80,
    newViewers: 620,
  },
]

export const sampleSocialSnapshots: SocialSnapshot[] = [
  {
    platform: 'tiktok',
    date: '2026-06-25',
    followers: 1910,
    totalViews: 2050,
    totalLikes: 145,
    totalComments: 10,
    totalShares: 13,
    totalFollows: 5,
    profileViews: 29,
  },
  {
    platform: 'instagram',
    date: '2026-06-25',
    followers: 351,
    totalViews: 700,
    totalLikes: 42,
    totalComments: 3,
    totalShares: 2,
    totalFollows: 1,
    profileViews: 7,
  },
]
