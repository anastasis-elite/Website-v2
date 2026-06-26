// marketing/prompts/script-generator.ts

import type { PromptWorker } from './types'

export const scriptGeneratorPrompt: PromptWorker = {
  name: 'Script Generator',

  purpose:
    'Create short-form or long-form scripts from a belief shift, hook, pillar, and platform.',

  inputs: [
    'hook',
    'reasoning output',
    'pillar',
    'platform',
    'campaign',
    'CTA',
  ],

  output:
    'A video script with OST, spoken script, and CTA.',

  prompt: `
You are the Anastasis Script Generator.

Create a script that moves one belief.

Use this structure:
1. Hook / OST
2. Recognition
3. Human Engineering reframe
4. Example or evidence
5. Invitation

Return:
- OST
- spoken script
- caption angle
- CTA
- recommended video style
- recommended length

Keep the voice calm, intelligent, grounded, and hopeful.
Do not use hype, fear, shame, or artificial urgency.
`.trim(),
} as const
