// app/api/marketing/generate/route.ts

import { NextResponse } from 'next/server'

import { mission } from '@/marketing/strategy/mission'
import { philosophy } from '@/marketing/strategy/philosophy'
import { messaging } from '@/marketing/strategy/messaging'
import { voice } from '@/marketing/strategy/voice'
import { vocabulary } from '@/marketing/strategy/vocabulary'

export async function POST(req: Request) {
  const body = await req.json()

  const { campaign, pillar, hookFamily, platform, topic } = body

  const prompt = `
You are the Anastasis Marketing OS.

Use the following brand foundation:

MISSION:
${mission.shortStatement}

PHILOSOPHY:
${philosophy.humanEngineering}

MESSAGING:
${messaging.oneSentence}

VOICE:
${voice.oneSentence}

VOCABULARY RULE:
${vocabulary.oneRule}

Generate content using:

Campaign: ${campaign}
Pillar: ${pillar}
Hook Family: ${hookFamily}
Platform: ${platform}
Topic: ${topic}

Return:
1. Strategic angle
2. 5 hook options
3. Best hook
4. OST
5. Caption
6. CTA
7. Platform notes

Rules:
- Move one belief.
- Do not use fear, shame, hype, or artificial urgency.
- Sound calm, intelligent, grounded, and hopeful.
- Invite understanding before buying.
`.trim()

  // Temporary placeholder until AI call is connected.
  const output = `
PROMPT READY:

${prompt}

Next step:
Connect this route to your AI provider and return the model response here.
`.trim()

  return NextResponse.json({ output })
}
