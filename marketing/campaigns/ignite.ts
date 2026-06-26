import type { Campaign } from './types'

export const igniteCampaign: Campaign = {
  name: 'IGNITE',
  status: 'planned',
  stage: 4,

  purpose:
    'Position IGNITE as the next level of whole-system optimization for women ready for deeper nutrition, progress tracking, and adaptive intelligence.',

  audience:
    'Women who have begun rebuilding capacity and want more precision, structure, and insight.',

  currentBelief:
    'I am doing the basics, but I need more clarity and optimization.',

  desiredBelief:
    'I can optimize my health when I understand the whole system.',

  offer:
    'IGNITE',

  primaryCTA:
    'Optimize your system',

  secondaryCTA:
    'Choose your level of support',

  primaryPillars: ['Education', 'Evidence', 'Philosophy'],
  secondaryPillars: ['Lifestyle', 'Invitation'],

  primaryHooks: ['Authority', 'Curiosity', 'Contrarian'],
  secondaryHooks: ['Story', 'Why Now'],

  primaryPlatforms: ['Instagram', 'Email', 'YouTube'],
  supportingPlatforms: ['TikTok', 'Pinterest', 'Facebook'],

  contentRatio: {
    Education: '35%',
    Evidence: '25%',
    Philosophy: '15%',
    Lifestyle: '15%',
    Invitation: '10%',
  },

  successMetrics: [
    'IGNITE Page Views',
    'Dashboard Interest',
    'Applications',
    'IGNITE Enrollments',
  ],

  notes: [
    'Position IGNITE as optimization, not complexity.',
    'Emphasize deeper insight, nutrition precision, and adaptive feedback.',
    'Show evidence through dashboard, progress, and daily insights.',
  ],
} as const
