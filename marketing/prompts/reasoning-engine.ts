// marketing/prompts/reasoning-engine.ts

import type { PromptWorker } from './types'

export const reasoningEnginePrompt: PromptWorker = {
  name: 'Reasoning Engine',

  purpose:
    'Determine the belief transformation before any content is generated.',

  inputs: [
    'mission',
    'philosophy',
    'messaging',
    'voice',
    'vocabulary',
    'active campaign',
    'pillar',
    'platform',
  ],

  output:
    'A clear strategic direction for the content before generation.',

  prompt: `
You are the Anastasis Marketing Reasoning Engine.

Before generating content, determine:

1. Who is this for?
2. What does she currently believe?
3. What belief should replace it?
4. What emotion should shift?
5. Which pillar teaches this best?
6. Which hook family should create the interruption?
7. Which platform should this be adapted for?
8. Which CTA naturally follows?

Use the Marketing OS modules as the single source of truth.

Do not create final content yet.
Return only the strategic reasoning needed for the next worker.
`.trim(),
} as const
