import type { CapacityName } from '@/lib/dashboard/resilienceEngine'
import type {
  AccountabilityContext,
  AccountabilityPartnerMode,
  AccountabilityResponse,
} from './accountabilityTypes'
import {
  deriveCommunicationProfileFromNatalProfile,
  applyExplicitPreferences,
} from './communicationProfile'
import { refineProfileFromBehavior } from './accountabilityFeedback'
import { createPartnerPersona } from './partnerPersona'
import { firstSupportedMemoryReference } from './accountabilityMemory'

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

function capacityMode(capacity?: CapacityName): AccountabilityPartnerMode {
  switch (capacity) {
    case 'diligence':
      return 'challenge'
    case 'patience':
      return 'ground'
    case 'kindness':
      return 'encourage'
    case 'generosity':
      return 'protect'
    case 'selfControl':
      return 'simplify'
    case 'humility':
      return 'redirect'
    case 'temperance':
      return 'ground'
    default:
      return 'encourage'
  }
}

function completedDay(context: AccountabilityContext) {
  return (
    context.resilienceState.priority === 'optimization' &&
    context.dailyInsight.category === 'progress'
  )
}

function priorityMode(context: AccountabilityContext): AccountabilityPartnerMode | null {
  switch (context.resilienceState.priority) {
    case 'safety':
      return 'protect'
    case 'recovery':
      return 'ground'
    case 'schedule_protection':
      return 'protect'
    case 'fueling':
    case 'hydration':
      return 'ground'
    case 'normal_return':
      return 'encourage'
    case 'training':
      return 'challenge'
    default:
      return null
  }
}

function safetyMessage() {
  return 'This is not a grit problem. Your symptoms need attention before we worry about today’s workout.'
}

function buildMessage(context: AccountabilityContext, mode: AccountabilityPartnerMode, intensity: number) {
  const { resilienceState, availableTime, scheduleLoad, memory } = context
  const capacity = resilienceState.primaryCapacity?.capacity
  const memoryReference = firstSupportedMemoryReference(memory)

  if (resilienceState.priority === 'safety') return safetyMessage()
  if (completedDay(context)) return 'Stop manufacturing work. You’re done. Go live your life.'

  if (memoryReference && mode === 'celebrate') {
    return `${memoryReference}. That is becoming evidence you can trust.`
  }

  if (capacity === 'diligence' && resilienceState.priority === 'training') {
    if (availableTime && availableTime >= 25) {
      return `You’ve got ${availableTime} minutes and your body is ready. This is the window. Go do the work.`
    }
    return intensity > 0.58
      ? 'You’re recovered. Your body is ready. We’re not turning a recovery day into an avoidance day. Go do the work.'
      : 'Your body is ready. Keep this simple and start the planned movement.'
  }

  if (capacity === 'patience' || resilienceState.priority === 'recovery') {
    return 'You already created the stimulus. More is not better today. Let your body actually build from the work you’ve done.'
  }

  if (capacity === 'kindness' || resilienceState.priority === 'normal_return') {
    return 'Yesterday does not need to be paid for. We deal with today based on what your body can support now.'
  }

  if (capacity === 'generosity' || resilienceState.priority === 'schedule_protection') {
    return scheduleLoad === 'packed'
      ? 'Everybody else already has a piece of today. We’re not taking the last piece from you too.'
      : 'Protect the next useful block. Capacity is the priority, not proving you can absorb more.'
  }

  if (capacity === 'selfControl') {
    return 'One thing at a time. Do the next planned action, then move to the next thing.'
  }

  if (capacity === 'humility') {
    return 'Your plan does not outrank your body. The recovery signals changed, so today’s plan changes too.'
  }

  if (capacity === 'temperance' || resilienceState.priority === 'fueling') {
    return 'We do not need more restriction and we do not need chaos. We need enough fuel to support the work you are asking your body to do.'
  }

  if (resilienceState.priority === 'hydration') {
    return 'Stabilize the simple support first: water, electrolytes if you use them, then the next block.'
  }

  if (availableTime && availableTime <= 20 && resilienceState.priority !== 'training') {
    return 'Do not try to cram the entire day into this window. Eat, hydrate, and protect the next block.'
  }

  return 'Keep today narrow. Choose the next clear action and let Anastasis handle the order.'
}

export function runAccountabilityPartnerEngine(context: AccountabilityContext): AccountabilityResponse {
  const natalProfile = deriveCommunicationProfileFromNatalProfile(context.natalProfile)
  const preferenceProfile = applyExplicitPreferences(natalProfile, context.userPreferences)
  const communicationProfile = refineProfileFromBehavior(preferenceProfile, context.recentBehavior)
  const partner = createPartnerPersona({
    userId: context.userId,
    clientId: context.clientId,
    profile: communicationProfile,
    existing: context.persona,
  })

  const safety = context.resilienceState.priority === 'safety'
  const mode = completedDay(context)
    ? 'celebrate'
    : priorityMode(context) || capacityMode(context.resilienceState.primaryCapacity?.capacity)
  const intensity = safety
    ? 0.28
    : clamp(
        mode === 'challenge'
          ? communicationProfile.challengeIntensity
          : mode === 'protect' || mode === 'redirect'
            ? Math.max(communicationProfile.directness, 0.62)
            : (communicationProfile.warmth + communicationProfile.directness) / 2,
      )

  return {
    message: buildMessage(context, mode, intensity),
    mode,
    intensity,
    reasoningTags: [
      `priority:${context.resilienceState.priority}`,
      context.resilienceState.primaryCapacity
        ? `capacity:${context.resilienceState.primaryCapacity.capacity}:${context.resilienceState.primaryCapacity.state}`
        : 'capacity:unknown',
      context.userPreferences?.supportPreference ? 'source:explicit_preference' : 'source:no_explicit_preference',
      context.recentBehavior?.sampleSize ? 'source:behavior' : 'source:no_behavior',
      context.natalProfile?.confidence ? 'source:natal_hypothesis' : 'source:no_natal',
      context.transitContext ? 'source:transit_optional' : 'source:no_transit',
    ],
    partner,
    communicationProfile,
  }
}
