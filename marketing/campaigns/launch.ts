import type { Campaign } from './types'

export const launchCampaign: Campaign = {
  name: 'Launch Framework',
  status: 'evergreen',
  stage: 0,

  purpose:
    'Provide the universal launch logic for any Anastasis or Aion Arche initiative.',

  audience:
    'Women or aligned audiences being introduced to a new offer, framework, feature, or movement initiative.',

  currentBelief:
    'I do not understand why this matters yet.',

  desiredBelief:
    'This is the next aligned step in understanding, rebuilding, or expanding capacity.',

  offer:
    'Variable by initiative',

  primaryCTA:
    'Begin here',

  secondaryCTA:
    'Learn more',

  primaryPillars: ['Identity', 'Philosophy', 'Education'],
  secondaryPillars: ['Evidence', 'Invitation', 'Lifestyle'],

  primaryHooks: ['Curiosity', 'Authority', 'Contrarian'],
  secondaryHooks: ['Story', 'Emotional', 'Why Now'],

  primaryPlatforms: ['TikTok', 'Instagram', 'Email'],
  supportingPlatforms: ['YouTube', 'Pinterest', 'Facebook', 'LinkedIn', 'Threads'],

  contentRatio: {
    Identity: '20%',
    Philosophy: '20%',
    Education: '25%',
    Evidence: '20%',
    Invitation: '15%',
  },

  successMetrics: [
    'Awareness',
    'Engagement',
    'Link Clicks',
    'Conversions',
    'Replies',
    'Applications',
  ],

  notes: [
    'Launches should never rely on artificial urgency.',
    'Every launch should introduce the belief shift before asking for action.',
    'Use this as the master framework for future initiatives.',
  ],
} as const
