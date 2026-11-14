import { localDateKey } from '@/lib/timezone'
import type { TodayBootstrap } from './todayBootstrap'
import { nextScheduleBoundary } from '@/lib/schedule/refresh'
import type { TodayEnrichment } from './loadTodayEnrichment'

export function todayStartupKey(seed: TodayBootstrap) {
  return [seed.ownerUserId, seed.clientId, seed.program, seed.date, seed.timezone, seed.generatedAt].join('|')
}

// Both the request generation and the member-local date must still agree when
// a response arrives. No authenticated data is persisted in browser storage.
export function matchesTodayStartup(value: unknown, seed: TodayBootstrap, now = new Date()): boolean {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as TodayBootstrap
  return snapshot.version === 1 && snapshot.ownerUserId === seed.ownerUserId && snapshot.clientId === seed.clientId &&
    snapshot.program === seed.program && snapshot.date === seed.date && snapshot.timezone === seed.timezone &&
    Number.isFinite(Date.parse(snapshot.generatedAt)) && localDateKey(now, seed.timezone) === seed.date
}

export function canRetainTodayStartup(value: TodayBootstrap | TodayEnrichment | undefined, seed: TodayBootstrap, now = new Date()): boolean {
  if (!value || !matchesTodayStartup(value, seed, now)) return false
  if (!('schedule' in value)) return true
  const model = value.schedule.todayViewModel
  const boundaries = [model?.nextRefreshAt, model?.deferredReturnAt].filter(Boolean).map(at => Date.parse(at!))
  boundaries.push(nextScheduleBoundary(value.schedule, Date.parse(value.generatedAt)))
  return boundaries.every(at => Number.isFinite(at) && at > now.getTime())
}
