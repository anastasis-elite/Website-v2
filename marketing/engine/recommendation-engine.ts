// marketing/engine/recommendation-engine.ts

export const recommendationEngine = {
  purpose:
    'Recommend what content should be created next based on campaign priorities, platform needs, pillar balance, and analytics.',

  considers: [
    'Active campaign',
    'Content ratio',
    'Recent posts',
    'Platform performance',
    'Audience response',
    'Business goal',
  ],

  output: [
    'Recommended platform',
    'Recommended pillar',
    'Recommended hook family',
    'Recommended content type',
    'Recommended CTA',
  ],
} as const
