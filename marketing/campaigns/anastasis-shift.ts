import type { Campaign } from './types'

export const anastasisShiftCampaign: Campaign = {
  name: 'The Anastasis Shift',
  status: 'planned',
  stage: 2,

  purpose:
    'Help women understand why previous wellness attempts have failed and introduce the Human Engineering framework through foundational education.',

  audience:
    'Women who have recognized they have a capacity problem and want to understand why.',

  currentBelief:
    'Nothing has ever worked for me.',

  desiredBelief:
    'My body makes sense when I understand it.',

  offer: 'The Anastasis Shift',

  primaryCTA: 'Read The Anastasis Shift',

  secondaryCTA: 'Learn Human Engineering',

  primaryPillars: ['Education', 'Philosophy', 'Identity'],
  secondaryPillars: ['Evidence', 'Invitation'],

  primaryHooks: ['Authority', 'Curiosity', 'Story'],
  secondaryHooks: ['Contrarian', 'Emotional'],

  primaryPlatforms: ['Email', 'Instagram', 'YouTube'],
  supportingPlatforms: ['TikTok', 'Pinterest'],

  contentRatio: {
    Education: '35%',
    Philosophy: '30%',
    Identity: '20%',
    Evidence: '10%',
    Invitation: '5%',
  },

  successMetrics: [
    'Guide Purchases',
    'Guide Completion',
    'Email Subscribers',
    'EMBER Interest',
  ],

  notes: [
    'Teach before selling.',
    'This campaign bridges awareness into commitment.',
  ],
} as const
