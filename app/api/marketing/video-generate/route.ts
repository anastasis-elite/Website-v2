import { NextResponse } from 'next/server'

import { capacityAuditCampaign } from '@/marketing/campaigns/capacity-audit'
import { evergreenCampaign } from '@/marketing/campaigns/evergreen'
import { emberCampaign } from '@/marketing/campaigns/ember'
import { igniteCampaign } from '@/marketing/campaigns/ignite'
import { phoenixCampaign } from '@/marketing/campaigns/phoenix'

import { identityHooks } from '@/marketing/hooks/identity'
import { emotionalHooks } from '@/marketing/hooks/emotional'
import { authorityHooks } from '@/marketing/hooks/authority'
import { contrarianHooks } from '@/marketing/hooks/contrarian'
import { urgencyHooks } from '@/marketing/hooks/urgency'
import { storyHooks } from '@/marketing/hooks/story'

export const runtime = 'nodejs'

const campaigns = [
  capacityAuditCampaign,
  evergreenCampaign,
  emberCampaign,
  igniteCampaign,
  phoenixCampaign,
]

const hooksByFamily: Record<string, any> = {
  Identity: identityHooks,
  Emotional: emotionalHooks,
  Authority: authorityHooks,
  Contrarian: contrarianHooks,
  'Why Now': urgencyHooks,
  Story: storyHooks,
}

function getCampaign(name: string) {
  return campaigns.find((campaign) => campaign.name === name) || evergreenCampaign
}

function getHookOptions(hookFamily: string) {
  const hookSet = hooksByFamily[hookFamily]

  if (!hookSet) return []

  if (hookSet.strongestHooks) {
    return hookSet.strongestHooks
  }

  if (hookSet.hooks) {
    return hookSet.hooks.flatMap((group: any) => group.examples || [])
  }

  return []
}

function createCaption({
  ost,
  campaign,
  pillar,
  platform,
  topic,
}: {
  ost: string
  campaign: any
  pillar: string
  platform: string
  topic: string
}) {
  return `${ost}

Most women are not stuck because they need more discipline.

They are stuck because their current capacity, recovery, stress, environment, and season of life are not being accounted for.

${topic}

This is why Anastasis does not ask women to force themselves through another rigid plan.

We help women understand what their body is communicating, rebuild capacity, and create systems that adapt with them.

Health should not become another demand on your life.

It should give you more capacity to live it.

${campaign.primaryCTA}.`
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const campaignName = String(formData.get('campaign') || 'Evergreen')
  const pillar = String(formData.get('pillar') || 'Identity')
  const hookFamily = String(formData.get('hookFamily') || 'Contrarian')
  const platform = String(formData.get('platform') || 'TikTok')
  const topic = String(formData.get('topic') || '')
  const outputCount = Number(formData.get('outputCount') || 5)

  const campaign = getCampaign(campaignName)
  const hooks = getHookOptions(hookFamily)

  const selectedHooks = hooks.slice(0, outputCount)

  const outputs = selectedHooks.map((ost: string, index: number) => ({
    id: String(index + 1),
    ost,
    caption: createCaption({
      ost,
      campaign,
      pillar,
      platform,
      topic,
    }),
    cta: campaign.primaryCTA,
    platformNotes:
      platform === 'TikTok'
        ? 'Use this as OST in the first 1-2 seconds. Keep the video simple and let the caption deepen the belief shift.'
        : 'Use this as the primary hook and adapt the caption to the selected platform.',
  }))

  return NextResponse.json({ outputs })
}
