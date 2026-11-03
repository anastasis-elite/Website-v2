import { getTierCapabilities, type TierCapability } from '../entitlements'
import { parseMembershipTier } from './tiers'
export { parseMembershipTier, type MembershipTier } from './tiers'

export type MembershipCapability = TierCapability | 'community' | 'workoutLogging' | 'generatedCoaching' | 'healthRecords' | 'accountData' | 'phoenixTasks'
export type MembershipRecord = {
  program?: unknown; auth_user_id?: unknown; access?: unknown; active?: unknown; verified_purchase?: unknown
  subscription_ends_at?: unknown; membership_expires_at?: unknown; subscription_status?: unknown
  timezone?: unknown; state?: unknown; onboarding_data?: unknown
}

/** Read only canonical server-owned fields. JWT user_metadata and request tiers are never grants. */
export function hasActiveMembership(client: MembershipRecord | null | undefined, now = new Date()): boolean {
  const tier = parseMembershipTier(client?.program)
  if (!client || !tier || client.access !== true || client.active === false) return false
  const exact = client.membership_expires_at
  const end = client.subscription_ends_at
  if (exact !== null && exact !== undefined && exact !== '') {
    if (typeof exact !== 'string' || !/[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(exact) || !Number.isFinite(Date.parse(exact)) || Date.parse(exact) <= now.getTime()) return false
  } else if (end !== null && end !== undefined && end !== '') {
    if (typeof end !== 'string') return false
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      // Keep the existing DATE-only UTC-midnight cutoff; only the new
      // provider-backed timestamp can supply a more precise expiry.
      if (!Number.isFinite(Date.parse(end)) || new Date(end).toISOString().slice(0, 10) !== end || Date.parse(end) <= now.getTime()) return false
    } else if (!Number.isFinite(Date.parse(end)) || Date.parse(end) <= now.getTime()) return false
  }
  if (tier !== 'free' && client.verified_purchase === true && (exact === null || exact === undefined || exact === '') && (end === null || end === undefined || end === '')) return false
  return true
}

export function membershipCan(client: MembershipRecord | null | undefined, capability: MembershipCapability, now = new Date()): boolean {
  const tier = parseMembershipTier(client?.program)
  // Historical self-service data/account access survives expiry; route ownership
  // still must be verified independently and this grants no content mutation.
  if (capability === 'accountData') return Boolean(client && tier)
  if (!hasActiveMembership(client, now) || !tier) return false
  if (capability === 'community') return true
  if (capability === 'phoenixTasks') return tier === 'phoenix'
  if (capability === 'workoutLogging' || capability === 'healthRecords') return tier !== 'free'
  if (capability === 'generatedCoaching') return ['ember', 'ignite', 'phoenix'].includes(tier)
  return getTierCapabilities(tier)[capability]
}

/** Member API families matched by middleware; public/auth/provider endpoints stay outside. */
export const PROTECTED_API_PREFIXES = [
  '/api/nutrition', '/api/nutrition-log', '/api/today-meals',
  '/api/workout-log', '/api/workout-set-log', '/api/workout-feedback', '/api/workout/prescription', '/api/program',
  '/api/recovery-log', '/api/recovery', '/api/assessment', '/api/assessment-strength',
  '/api/assessment-photos', '/api/assessment-window', '/api/schedule', '/api/onboarding',
  '/api/cycle', '/api/phoenix', '/api/check-access', '/api/membership', '/api/tracker',
  '/api/calendars', '/api/daily-check-in', '/api/account', '/api/billing', '/api/mobile', '/api/health',
] as const

export function isProtectedApiPath(path: string): boolean {
  return PROTECTED_API_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'))
}

export function isAssessmentHistoryView(path: string, method: string, search?: Pick<URLSearchParams, 'get'>): boolean {
  if (path !== '/dashboard/assessment/start2' || method !== 'GET' || !search) return false
  const period = search.get('period'), assessmentId = search.get('assessmentId')
  if (period !== null && !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)) return false
  if (assessmentId !== null && !/^[a-zA-Z0-9_-]{1,100}$/.test(assessmentId)) return false
  return period !== null || assessmentId !== null
}

/** Only existing member operations receive a capability; new paths require an explicit decision. */
export function capabilityForPath(path: string, method = 'GET', search?: Pick<URLSearchParams, 'get'>): MembershipCapability | null {
  const read = method === 'GET' || method === 'HEAD'
  if (isAssessmentHistoryView(path, method, search)) return 'accountData'
  if (path === '/api/check-access' || path === '/api/membership/enroll' || path === '/api/membership/experience') return 'accountData'
  if (path === '/dashboard/experience') return 'accountData'
  if (path === '/api/tracker/nutrition') return read ? 'accountData' : 'nutritionTracking'
  if (/^\/api\/account\/(?:password|profile)$/.test(path) || path === '/api/billing/portal') return 'accountData'
  if (/^\/dashboard\/(?:account|payment-issue)(?:\/|$)/.test(path)) return 'accountData'
  if (/^\/(?:dashboard\/community|api\/community)(?:\/|$)/.test(path)) return 'community'
  if (path === '/dashboard' || path === '/dashboard/tracker') return 'accountData'
  if (/^\/api\/(?:workout-log|workout-set-log)$/.test(path)) return read ? 'accountData' : 'workoutLogging'
  if (path === '/api/workout/prescription') return 'generatedCoaching'
  if (path === '/api/mobile/health/sync') return 'healthRecords'
  if (path === '/api/health/apple-export') return 'healthRecords'
  if (path === '/api/mobile/actions/recovery') return 'recoveryBasic'
  if (path === '/api/mobile/actions/water' || path === '/api/mobile/dashboard') return 'generatedCoaching'
  if (/^\/api\/mobile\/schedule(?:\/[^/]+\/(?:complete|defer))?$/.test(path)) return 'calendar'
  if (path === '/api/recovery-log' || path === '/api/recovery/activity') return read ? 'accountData' : 'recoveryBasic'
  if (/^\/api\/nutrition\/(?:supplement-recommendation|suggested-foods|nutrient-insights)$/.test(path)) return 'nutritionMicronutrients'
  if (path === '/api/nutrition/photo-estimate') return 'nutritionPhotoMacroEstimation'
  if (path === '/api/nutrition/barcode') return 'nutritionBarcodeScanning'
  if (path === '/api/nutrition-log' && read) return 'accountData'
  if (path === '/api/nutrition' || path === '/api/nutrition-log') return 'generatedCoaching'
  if (path === '/api/nutrition/hydration') return 'generatedCoaching'
  if (/^\/api\/nutrition\/(?:add-macros|add-meal|add-water|custom-food|delete-meal|hydration|recurring-foods|search-foods|serving-options)$/.test(path) || path === '/api/today-meals') return 'nutritionTracking'
  if (/^\/dashboard\/(?:calendar|schedule|settings\/calendars)(?:\/|$)/.test(path)) return 'calendar'
  if (path !== '/api/calendars/cron' && /^\/api\/calendars(?:\/(?:preferences|availability|events(?:\/[^/]+)?|google\/(?:connect|callback)|icloud|[^/]+(?:\/sync)?))?$/.test(path)) return 'calendar'
  if (/^\/api\/schedule(?:\/(?:plan|checkoff|[^/]+(?:\/(?:complete|defer))?))?$/.test(path)) return 'calendar'
  if (path === '/api/assessment-strength' && read) return 'accountData'
  if (/^\/api\/(?:assessment|assessment-strength|assessment-photos\/(?:upload|landmarks))$/.test(path)) return 'assessmentsView'
  if (/^\/api\/(?:program\/(?:generate|workout)|workout-feedback|daily-check-in|onboarding\/profile|assessment-window\/save)$/.test(path)) return 'generatedCoaching'
  if (/^\/api\/cycle(?:\/(?:flow|quick-log|quick-symptoms|start-period))?$/.test(path)) return 'generatedCoaching'
  if (path === '/api/phoenix/tasks') return 'phoenixTasks'
  if (path.startsWith('/dashboard/')) return 'generatedCoaching'
  return null
}
