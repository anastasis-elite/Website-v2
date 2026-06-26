// marketing/campaigns/capacity-audit.ts

import type { Campaign } from './types'

export const capacityAuditCampaign: Campaign = {
  name: 'Capacity Audit',
  status: 'active',
  stage: 1,

  purpose:
    'Introduce the concept of Capacity and help women realize they do not have a discipline problem.',

  audience:
    'Women who feel stuck, overwhelmed, burned out, and blame themselves.',

  currentBelief:
    'I need more discipline.',

  desiredBelief:
    'I need more capacity.',

  offer:
    'Capacity Audit',

  primaryCTA:
    'Take the Capacity Audit',

  secondaryCTA:
    'Learn Human Engineering',

  primaryPillars: [
    'Identity',
    'Philosophy',
  ],

  secondaryPillars: [
    'Evidence',
    'Education',
  ],

  primaryHooks: [
    'Curiosity',
    'Contrarian',
  ],

  secondaryHooks: [
    'Authority',
    'Story',
  ],

  primaryPlatforms: [
    'TikTok',
    'Instagram',
  ],

  supportingPlatforms: [
    'Pinterest',
    'Email',
    'YouTube',
  ],

  contentRatio: {
    Identity: '40%',
    Philosophy: '25%',
    Evidence: '20%',
    Education: '10%',
    Invitation: '5%',
  },

  successMetrics: [
    'Landing Page Views',
    'Audit Starts',
    'Audit Completions',
    'Applications',
  ],

  notes: [
    'Never talk about workouts as the primary offer.',
    'Never sell programs directly in this campaign.',
    'Only introduce Capacity.',
    'The goal is belief shift before offer awareness.',
  ],
} as const
