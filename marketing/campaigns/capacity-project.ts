import type { Campaign } from './types'

export const capacityProjectCampaign: Campaign = {
  name: 'The Capacity Project',
  status: 'evergreen',
  stage: 7,

  purpose:
    'Establish ongoing thought leadership through long-form Human Engineering conversations that deepen trust and strengthen the movement.',

  audience:
    'Women who resonate with Anastasis and want deeper conversations around health, leadership, motherhood, recovery, and thriving.',

  currentBelief:
    'I want to understand this more deeply.',

  desiredBelief:
    'Human Engineering changes how I see every part of my life.',

  offer: 'The Capacity Project',

  primaryCTA: 'Listen to this week’s episode',

  secondaryCTA: 'Subscribe',

  primaryPillars: ['Philosophy', 'Education', 'Story'],
  secondaryPillars: ['Identity', 'Lifestyle'],

  primaryHooks: ['Story', 'Authority', 'Curiosity'],
  secondaryHooks: ['Contrarian', 'Emotional'],

  primaryPlatforms: ['YouTube', 'Email'],
  supportingPlatforms: ['TikTok', 'Instagram', 'Spotify'],

  contentRatio: {
    Philosophy: '35%',
    Education: '30%',
    Story: '20%',
    Identity: '10%',
    Lifestyle: '5%',
  },

  successMetrics: [
    'Watch Time',
    'Subscribers',
    'Newsletter Growth',
    'Returning Viewers',
  ],

  notes: [
    'Long-form builds trust.',
    'Every episode should generate dozens of short-form clips.',
  ],
} as const
