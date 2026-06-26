import type { Campaign } from './types'

export const phoenixCampaign: Campaign = {
  name: 'PHOENIX',
  status: 'planned',
  stage: 5,

  purpose:
    'Position PHOENIX as full Human Engineering for women ready for comprehensive personalization, integration, and high-touch adaptive support.',

  audience:
    'High-responsibility women who want the deepest level of personalization across fitness, nutrition, recovery, hormones, stress, lifestyle, and education.',

  currentBelief:
    'My life is too complex for a normal program to work.',

  desiredBelief:
    'I need a fully adaptive system that understands the whole woman.',

  offer:
    'PHOENIX',

  primaryCTA:
    'Engineer your health',

  secondaryCTA:
    'Apply for PHOENIX',

  primaryPillars: ['Philosophy', 'Education', 'Evidence'],
  secondaryPillars: ['Identity', 'Lifestyle', 'Invitation'],

  primaryHooks: ['Authority', 'Contrarian', 'Story'],
  secondaryHooks: ['Curiosity', 'Why Now', 'Emotional'],

  primaryPlatforms: ['Email', 'Instagram', 'YouTube'],
  supportingPlatforms: ['TikTok', 'LinkedIn', 'Facebook'],

  contentRatio: {
    Philosophy: '25%',
    Education: '25%',
    Evidence: '25%',
    Identity: '10%',
    Lifestyle: '10%',
    Invitation: '5%',
  },

  successMetrics: [
    'PHOENIX Page Views',
    'Application Starts',
    'Qualified Applications',
    'PHOENIX Enrollments',
  ],

  notes: [
    'Position PHOENIX as full Human Engineering, not premium coaching alone.',
    'Emphasize integration, personalization, adaptive intelligence, and education.',
    'This offer should feel precise, high-touch, and deeply individualized.',
  ],
} as const
