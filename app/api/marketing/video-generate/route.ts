import { NextResponse } from 'next/server'

import { mission } from '@/marketing/strategy/mission'
import { philosophy } from '@/marketing/strategy/philosophy'
import { messaging } from '@/marketing/strategy/messaging'
import { voice } from '@/marketing/strategy/voice'
import { vocabulary } from '@/marketing/strategy/vocabulary'

export const runtime = 'nodejs'

type MarketingOutput = {
  id: string
  ost: string
  caption: string
  cta: string
  platformNotes: string
}

function safeJsonParse(text: string): MarketingOutput[] {
  try {
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed.outputs)) {
      return parsed.outputs
    }

    if (Array.isArray(parsed)) {
      return parsed
    }

    return []
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const campaign = String(formData.get('campaign') || '')
    const pillar = String(formData.get('pillar') || '')
    const hookFamily = String(formData.get('hookFamily') || '')
    const platform = String(formData.get('platform') || '')
    const topic = String(formData.get('topic') || '')
    const outputCount = Number(formData.get('outputCount') || 5)
    const video = formData.get('video') as File | null

    const prompt = `
You are the Anastasis Marketing OS.

Generate ${outputCount} content options for one uploaded video.

VIDEO CONTEXT:
${topic}

VIDEO FILE:
${video ? `Uploaded file name: ${video.name}` : 'No video file provided'}

BRAND FOUNDATION:
Mission: ${mission.shortStatement}
Philosophy: ${philosophy.humanEngineering}
Messaging: ${messaging.oneSentence}
Voice: ${voice.oneSentence}
Vocabulary Rule: ${vocabulary.oneRule}

CONTENT PARAMETERS:
Campaign: ${campaign}
Pillar: ${pillar}
Hook Family: ${hookFamily}
Platform: ${platform}

OUTPUT REQUIREMENTS:
Return valid JSON only.

Shape:
{
  "outputs": [
    {
      "id": "1",
      "ost": "short on-screen hook text",
      "caption": "full platform-ready caption",
      "cta": "clear CTA",
      "platformNotes": "how to use this on the selected platform"
    }
  ]
}

RULES:
- Generate exactly ${outputCount} outputs.
- Each output should be meaningfully different.
- Each OST should be short enough to overlay on a video.
- Each caption should match the selected platform.
- Move one belief.
- Create understanding before invitation.
- Do not use fear, shame, hype, clickbait, or artificial urgency.
- Do not sound like generic fitness marketing.
- Do not use "buy now" language.
- Keep the Anastasis voice calm, intelligent, grounded, and hopeful.
`.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      return NextResponse.json(
        {
          error: 'OpenAI request failed.',
          details: errorText,
        },
        { status: 500 }
      )
    }

    const result = await response.json()

    const text =
      result.output_text ||
      result.output?.[0]?.content?.[0]?.text ||
      ''

    const outputs = safeJsonParse(text)

    return NextResponse.json({
      outputs,
      raw: outputs.length ? undefined : text,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate marketing content.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
