import type { Campaign } from './types'

export const evergreenCampaign: Campaign = {
  name: 'Evergreen',

  status: 'evergreen',

  stage: 9,

  purpose:
    'Maintain continual awareness, education, trust, and movement growth independent of active launches.',

  audience:
    'Women across every stage of the Anastasis journey.',

  currentBelief:
    'Wherever I am today, there is a next step.',

  desiredBelief:
    'Anastasis is the place I continue returning to for understanding and growth.',

  offer:
    'Entire Anastasis Ecosystem',

  primaryCTA:
    'Take your next step.',

  secondaryCTA:
    'Continue rebuilding.',

  primaryPillars: [
    'Identity',
    'Education',
    'Evidence',
    'Lifestyle',
  ],

  secondaryPillars: [
    'Philosophy',
    'Invitation',
  ],

  primaryHooks: [
    'Identity',
    'Story',
    'Authority',
  ],

  secondaryHooks: [
    'Curiosity',
    'Contrarian',
    'Emotional',
  ],

  primaryPlatforms: [
    'All Platforms',
  ],

  supportingPlatforms: [],

  contentRatio: {
    Identity: '20%',
    Education: '20%',
    Evidence: '20%',
    Lifestyle: '15%',
    Philosophy: '15%',
    Invitation: '10%',
  },

  successMetrics: [
    'Brand Search',
    'Returning Visitors',
    'Follower Growth',
    'Email Growth',
    'Program Applications',
    'Community Retention',
  ],

  notes: [
    'This is the default campaign when no active initiative is running.',
    'Maintain trust, education, and movement momentum.',
    'Every piece of content should strengthen the Human Engineering worldview.',
  ],
} as const
