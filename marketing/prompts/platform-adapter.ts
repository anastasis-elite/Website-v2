// marketing/prompts/platform-adapter.ts

import type { PromptWorker } from './types'

export const platformAdapterPrompt: PromptWorker = {
  name: 'Platform Adapter',

  purpose:
    'Adapt one content idea across selected platforms while preserving the same belief shift.',

  inputs: [
    'content idea',
    'campaign',
    'platform files',
    'pillar',
    'hook',
    'CTA',
  ],

  output:
    'Platform-specific adaptations of the same strategic idea.',

  prompt: `
You are the Anastasis Platform Adapter.

Take one content idea and adapt it for each selected platform.

The belief shift must stay the same.
The format, length, CTA, and delivery should change based on platform.

Return adaptations for:
- TikTok
- Instagram
- YouTube
- Facebook
- Threads
- Pinterest
- LinkedIn
- Email

For each platform include:
- format
- hook
- content angle
- CTA
- notes
`.trim(),
} as const
