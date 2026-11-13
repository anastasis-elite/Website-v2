export type AnalyticsEnvironment = 'production' | 'test' | 'development'
export type SafeAnalyticsProperties = Record<string, string | number | boolean>
export const SERVER_CONVERSION_EVENTS = new Set([
  'analytics_identity_linked',
  'subscription_activated', 'subscription_upgraded', 'subscription_cancelled',
  'onboarding_completed', 'first_workout_completed', 'first_nutrition_completed', 'first_recovery_completed',
])
const tiers = ['free', 'free_community', 'tracker', 'ember', 'ignite', 'phoenix']
const activities = ['check-in', 'check_in', 'water', 'schedule', 'nutrition', 'workout', 'recovery']
const sources = ['landing', 'about', 'program', 'pricing', 'audit', 'audit_results', 'daily_check_in', 'recovery', 'session_draft', 'manual', 'recommended', 'checkout', 'onboarding', 'server']
const pages = ['landing', 'about', 'why', 'what-is-anastasis', 'programs', 'guide', 'conditions', 'audit', 'audit_results', 'pricing',
  ...['ember', 'ignite', 'phoenix'].flatMap(tier => ['why', 'support', 'success', 'recommend', 'cart'].map(page => `${tier}_${page}`))]
const navItems = ['today', 'plan', 'community', 'progress', 'account', 'you', 'nutrition', 'workout', 'recovery', 'schedule', 'support', 'Today', 'Plan', 'Community', 'Progress', 'Account', 'Nutrition', 'Workout', 'Recovery', 'Schedule', 'Support']
const homepageFields = { page: ['landing'], experiment_id: ['homepage_storytelling_v1'], homepage_version: ['storytelling_v1'] }
const homepagePlacements = ['features', 'final_cta', 'outcome', 'how_it_works', 'for_you', 'story', 'founder', 'community', 'programs', 'navigation', 'footer']

// Explicit value schemas also reject health content hidden behind benign keys.
const eventFields: Record<string, Record<string, string[] | 'path'>> = {
  analytics_identity_linked: {},
  landing_page_viewed: homepageFields,
  homepage_story_section_viewed: homepageFields,
  homepage_founder_section_viewed: homepageFields,
  homepage_community_section_viewed: homepageFields,
  homepage_program_cta_clicked: { ...homepageFields, program: ['ember', 'ignite', 'phoenix', 'all'], location: homepagePlacements, cta_location: homepagePlacements },
  about_page_viewed: { page: pages }, why_page_viewed: { page: pages },
  what_is_anastasis_page_viewed: { page: pages }, guide_page_viewed: { page: pages }, conditions_page_viewed: { page: pages },
  program_page_viewed: { page: pages }, program_viewed: { program: tiers },
  audit_page_viewed: { page: ['audit'] }, audit_started: { page: ['audit'] }, audit_submit_clicked: { page: ['audit'] },
  audit_page_completed: { page: ['audit'] }, audit_results_viewed: { page: ['audit_results'] },
  pricing_viewed: { program: tiers, tier: tiers, source: sources }, checkout_started: { program: tiers, tier: tiers, source: sources },
  today_page_viewed: { tier: tiers }, dashboard_viewed: { tier: tiers },
  daily_check_in_started: { program: tiers, source: sources }, daily_check_in_completed: { program: tiers, source: sources },
  dashboard_navigation_clicked: { item: navItems, href: 'path' },
  next_action_opened: { activity: activities, tier: tiers }, next_action_completed: { activity: activities, tier: tiers },
  activity_deferred: { activity: activities, tier: tiers }, activity_skipped: { activity: activities, tier: tiers },
  activity_resumed: { activity: activities, tier: tiers, program: tiers, source: sources },
  subscription_activated: { tier: tiers, source: ['server'] }, subscription_upgraded: { tier: tiers, previous_tier: tiers, source: ['server'] },
  subscription_cancelled: { tier: tiers, source: ['server'] }, onboarding_completed: { tier: tiers, source: ['server'] },
  first_workout_completed: { tier: tiers, source: ['server'] }, first_nutrition_completed: { tier: tiers, source: ['server'] }, first_recovery_completed: { tier: tiers, source: ['server'] },
}
for (const tier of ['ember', 'ignite', 'phoenix']) for (const page of ['why', 'support', 'success', 'recommend', 'cart']) eventFields[`${tier}_${page}_page_viewed`] = { page: pages }
for (const [event, location] of [['audit_cta_clicked_1', 'hero'], ['audit_cta_clicked_2', 'outcome'], ['audit_cta_clicked_3', 'final_cta']]) eventFields[event] = { ...homepageFields, location: [location], cta_location: [location] }
eventFields.audit_cta_clicked_about = { page: pages, source: sources }
for (const action of ['resolved', 'eligible', 'shown', 'dismissed', 'expanded', 'clicked']) eventFields[`supplement_recommendation_${action}`] = { tier: tiers, source: sources }

export function analyticsEnvironment(): AnalyticsEnvironment {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENV === 'test' || process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) return 'test'
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENV === 'production') return 'production'
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENV === 'development') return 'development'
  // Vercel's deployment target distinguishes production from preview builds.
  // NEXT_PUBLIC_* is inlined for the browser; VERCEL_ENV covers server events.
  if ((process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV) === 'production') return 'production'
  // A production build alone does not identify the production analytics environment.
  return 'development'
}

export function safeAnalyticsPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  let path: string
  try { path = new URL(value, 'https://analytics.invalid').pathname.replace(/\/+$/, '') || '/' } catch { return undefined }
  if (path === '/audit/results' || path.startsWith('/audit/results/')) return '/audit/results'
  if (path.startsWith('/dashboard/program/')) return path.endsWith('/workout') ? '/dashboard/workout' : '/dashboard'
  if (path.startsWith('/dashboard/assessment') || path.startsWith('/dashboard/progress')) return '/dashboard/progress'
  if (path.startsWith('/dashboard/cycle') || path.startsWith('/dashboard/account')) return '/dashboard/account'
  if (path.startsWith('/dashboard/community')) return '/dashboard/community'
  const exact = ['/', '/about', '/why', '/what-is-anastasis', '/guide', '/conditions', '/audit', '/program', '/login', '/dashboard',
    '/dashboard/nutrition', '/dashboard/workout', '/dashboard/recovery', '/dashboard/calendar', '/dashboard/schedule', '/dashboard/support', '/support']
  if (exact.includes(path)) return path
  if (/^\/program\/(ember|ignite|phoenix)(?:\/(cart|why|support|recommend|success))?$/.test(path)) return path
  return undefined
}

export function filterAnalyticsEvent(event: unknown, properties?: Record<string, unknown> | null, environment: AnalyticsEnvironment = analyticsEnvironment()): { event: string; properties: SafeAnalyticsProperties } | null {
  if (typeof event !== 'string' || !Object.hasOwn(eventFields, event)) return null
  const result: SafeAnalyticsProperties = { analytics_environment: environment, analytics_schema: 1 }
  for (const [key, allowed] of Object.entries(eventFields[event])) {
    const value = properties?.[key]
    if (allowed === 'path') { const path = safeAnalyticsPath(value); if (path) result[key] = path }
    else if (typeof value === 'string' && allowed.includes(value)) result[key] = value
  }
  return { event, properties: result }
}
