import type { Campaign } from './types'

export const emberCampaign: Campaign = {
  name: 'EMBER',
  status: 'planned',
  stage: 3,

  purpose:
    'Invite women into foundational capacity building through adaptive movement, nutrition, recovery, and consistency support.',

  audience:
    'Women who understand they need capacity and are ready to begin rebuilding without burnout.',

  currentBelief:
    'I can never stay consistent.',

  desiredBelief:
    'I can stay consistent when my system adapts to my life.',

  offer:
    'EMBER',

  primaryCTA:
    'Begin rebuilding',

  secondaryCTA:
    'Find your pathway',

  primaryPillars: ['Education', 'Lifestyle', 'Evidence'],
  secondaryPillars: ['Identity', 'Invitation'],

  primaryHooks: ['Authority', 'Story', 'Curiosity'],
  secondaryHooks: ['Emotional', 'Why Now'],

  primaryPlatforms: ['Instagram', 'TikTok', 'Email'],
  supportingPlatforms: ['Facebook', 'Pinterest', 'YouTube'],

  contentRatio: {
    Education: '30%',
    Evidence: '25%',
    Lifestyle: '20%',
    Identity: '15%',
    Invitation: '10%',
  },

  successMetrics: [
    'EMBER Page Views',
    'Pathway Clicks',
    'Applications',
    'EMBER Enrollments',
  ],

  notes: [
    'Position EMBER as foundational rebuilding.',
    'Do not overcomplicate the offer.',
    'Focus on consistency through adaptation, not intensity.',
  ],
} as const
