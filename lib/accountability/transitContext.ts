import type { TransitContext } from './accountabilityTypes'

export type TransitProvider = {
  getTransitContext(date: string): Promise<TransitContext | null>
}

export async function getOptionalTransitContext(input: {
  date: string
  provider?: TransitProvider
}) {
  if (!input.provider) {
    return {
      date: input.date,
      majorAspects: [],
      unavailableReason: 'transit_provider_not_configured',
    } satisfies TransitContext
  }

  return input.provider.getTransitContext(input.date)
}
