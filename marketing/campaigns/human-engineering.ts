import type { Campaign } from './types'

export const humanEngineeringCampaign: Campaign = {
  name: 'Human Engineering',

  status: 'planned',

  stage: 6,

  purpose:
    'Establish Human Engineering as the new framework for understanding women’s wellness.',

  audience:
    'Women ready to move beyond programs and understand the principles behind thriving.',

  currentBelief:
    'Health is about discipline.',

  desiredBelief:
    'Health is about understanding.',

  offer:
    'Human Engineering Foundations',

  primaryCTA:
    'Learn Human Engineering',

  secondaryCTA:
    'Join the movement',

  primaryPillars: [
    'Philosophy',
    'Education',
    'Identity',
  ],

  secondaryPillars: [
    'Evidence',
  ],

  primaryHooks: [
    'Authority',
    'Contrarian',
    'Curiosity',
  ],

  secondaryHooks: [
    'Story',
    'Emotional',
  ],

  primaryPlatforms: [
    'YouTube',
    'LinkedIn',
    'Email',
  ],

  supportingPlatforms: [
    'Instagram',
    'TikTok',
  ],

  contentRatio: {
    Philosophy: '40%',
    Education: '30%',
    Identity: '15%',
    Evidence: '10%',
    Invitation: '5%',
  },

  successMetrics: [
    'Video Watch Time',
    'Newsletter Subscribers',
    'Educational Engagement',
    'Framework Recognition',
  ],

  notes: [
    'Teach the discipline.',
    'Build the category.',
    'Do not sell fitness.',
  ],
} as const
