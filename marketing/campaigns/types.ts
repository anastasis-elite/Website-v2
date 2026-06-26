// marketing/campaigns/types.ts

export type CampaignStatus = 'active' | 'planned' | 'paused' | 'evergreen'

export type Campaign = {
  name: string
  status: CampaignStatus
  stage: number
  purpose: string
  audience: string
  currentBelief: string
  desiredBelief: string
  offer: string
  primaryCTA: string
  secondaryCTA: string
  primaryPillars: string[]
  secondaryPillars: string[]
  primaryHooks: string[]
  secondaryHooks: string[]
  primaryPlatforms: string[]
  supportingPlatforms: string[]
  contentRatio: Record<string, string>
  successMetrics: string[]
  notes: string[]
}
