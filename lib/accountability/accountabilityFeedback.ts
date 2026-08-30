import type {
  AccountabilityBehaviorSummary,
  AccountabilityCommunicationProfile,
  AccountabilityFeedbackEvent,
} from './accountabilityTypes'
import { getDefaultCommunicationProfile } from './communicationProfile'

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

function adjust(
  profile: AccountabilityCommunicationProfile,
  key: keyof AccountabilityCommunicationProfile,
  delta: number,
) {
  return { ...profile, [key]: clamp(profile[key] + delta) }
}

export function refineProfileFromBehavior(
  profile: AccountabilityCommunicationProfile,
  behavior?: AccountabilityBehaviorSummary,
) {
  if (!behavior || (behavior.sampleSize || 0) < 3) return profile
  let next = { ...profile }

  if ((behavior.highChallengeDismissalRate || 0) >= 0.55) {
    next = adjust(next, 'challengeIntensity', -0.08)
    next = adjust(next, 'warmth', 0.04)
  }

  if (
    (behavior.supportivePromptCompletionRate || 0) >
    (behavior.directPromptCompletionRate || 0) + 0.18
  ) {
    next = adjust(next, 'challengeIntensity', -0.06)
    next = adjust(next, 'reassuranceNeed', 0.04)
  }

  if (
    (behavior.directPromptCompletionRate || 0) >
    (behavior.gentlePromptCompletionRate || 0) + 0.18
  ) {
    next = adjust(next, 'directness', 0.05)
    next = adjust(next, 'actionBias', 0.04)
  }

  if ((behavior.concisePromptCompletionRate || 0) >= 0.65) {
    next = adjust(next, 'structurePreference', 0.04)
    next = adjust(next, 'emotionalDepth', -0.03)
  }

  if ((behavior.ignoredMessageRate || 0) >= 0.6) {
    next = adjust(next, 'challengeIntensity', -0.04)
    next = adjust(next, 'directness', -0.03)
  }

  return next
}

export function applyFeedbackEvent(
  current: AccountabilityCommunicationProfile = getDefaultCommunicationProfile(),
  event: AccountabilityFeedbackEvent,
) {
  let next = { ...current }
  const weight = event.helpful || event.completedRecommendedAction ? 0.025 : 0.015

  if (event.tone === 'too_intense' || event.dismissed) {
    next = adjust(next, 'challengeIntensity', -weight * 2)
    next = adjust(next, 'warmth', weight)
  }

  if (event.tone === 'too_soft') {
    next = adjust(next, 'directness', weight)
    next = adjust(next, 'challengeIntensity', weight)
  }

  if (event.style === 'simplify' && event.completedRecommendedAction) {
    next = adjust(next, 'structurePreference', weight)
  }

  if (event.style === 'encourage' && event.completedRecommendedAction) {
    next = adjust(next, 'warmth', weight)
    next = adjust(next, 'reassuranceNeed', weight)
  }

  return next
}
