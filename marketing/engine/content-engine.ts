// marketing/engine/content-engine.ts

export const contentEngine = {
  purpose:
    'Generate aligned content by combining campaign, pillar, hook family, platform, CTA, voice, and vocabulary.',

  pipeline: [
    'Load foundation',
    'Load active campaign',
    'Select pillar',
    'Select hook family',
    'Select platform',
    'Generate content',
    'Audit content',
    'Return final output',
  ],
} as const
