import type { Campaign } from './types'

export const referralCampaign: Campaign = {
  name: 'Referral',

  status: 'planned',

  stage: 8,

  purpose:
    'Empower women to naturally introduce Anastasis to others because they believe in the philosophy and have experienced the transformation.',

  audience:
    'Current members and women who deeply trust the movement.',

  currentBelief:
    'This has helped me.',

  desiredBelief:
    'Someone else deserves to experience this too.',

  offer:
    'Referral Program',

  primaryCTA:
    'Invite someone you love.',

  secondaryCTA:
    'Share your story.',

  primaryPillars: [
    'Evidence',
    'Story',
    'Lifestyle',
  ],

  secondaryPillars: [
    'Invitation',
    'Identity',
  ],

  primaryHooks: [
    'Story',
    'Emotional',
  ],

  secondaryHooks: [
    'Why Now',
    'Identity',
  ],

  primaryPlatforms: [
    'Email',
    'Instagram',
  ],

  supportingPlatforms: [
    'Facebook',
    'TikTok',
  ],

  contentRatio: {
    Evidence: '35%',
    Story: '35%',
    Lifestyle: '20%',
    Invitation: '10%',
  },

  successMetrics: [
    'Referral Invitations',
    'Referral Applications',
    'Referral Enrollments',
  ],

  notes: [
    'Never incentivize manipulation.',
    'Lead with transformation, not rewards.',
  ],
} as const
