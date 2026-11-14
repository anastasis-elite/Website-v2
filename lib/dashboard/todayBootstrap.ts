import 'server-only'

import type { ProgramTier } from '@/lib/dashboard/logic/types'
import type { TodayDaySections } from '@/lib/dashboard/todayDaySections'
import { getLocalParts, zonedDateTimeToUtc } from '@/lib/schedule/time'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

/** This is deliberately independent of ProgramLogicOutput. Unknown targets,
 * assessments and recommendations are not safe defaults for the full engine. */
export type TodayBootstrap = {
  version: 1
  ownerUserId: string
  clientId: string
  program: ProgramTier
  memberName: string
  carouselStyle: 'section' | 'step'
  date: string
  timezone: string
  generatedAt: string
  checkIn: {
    status: 'pending' | 'ready' | 'error'
    completed: boolean | null
    message?: string
  }
  day: TodayDaySections
}

type BootstrapContext = {
  user: { id: string }
  client: any
  program: ProgramTier
}

export function createTodayBootstrap({ user, client, program, now = new Date() }: BootstrapContext & { now?: Date }): TodayBootstrap {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id ||
    !['ember', 'ignite', 'phoenix'].includes(program) || (client.program || 'ignite') !== program) {
    throw new Error('Today startup requires the verified member and program.')
  }
  const date = getClientLocalDate(client, now)
  const timezone = getClientTimeZone(client)
  const hour = getLocalParts(now, timezone).hour
  const nextBoundaryAt = ['10:00', '15:00']
    .map(time => zonedDateTimeToUtc(date, time, timezone))
    .find(boundary => boundary.getTime() > now.getTime())?.toISOString() || null
  return {
    version: 1,
    ownerUserId: user.id,
    clientId: String(client.client_id),
    program,
    memberName: String(client.full_name || client.first_name || 'there').split(' ')[0],
    carouselStyle: client.carousel_style === 'step' ? 'step' : 'section',
    date,
    timezone,
    generatedAt: now.toISOString(),
    checkIn: { status: 'pending', completed: null },
    day: {
      sections: [
        { id: 'morning', title: 'Morning', range: 'Before 10:00 a.m.', items: [] },
        { id: 'midday', title: 'Midday', range: '10:00 a.m. – before 3:00 p.m.', items: [] },
        { id: 'evening', title: 'Evening', range: '3:00 p.m. onward', items: [] },
      ],
      untimed: [],
      currentSection: hour < 10 ? 'morning' : hour < 15 ? 'midday' : 'evening',
      nextBoundaryAt,
    },
  }
}

/** Only today's owner-bound completion evidence is necessary to offer check-in.
 * No plan generation, recommendation persistence or display history is awaited. */
export async function loadTodayBootstrap({ supabase, now = () => new Date(), ...context }: BootstrapContext & {
  supabase: any
  now?: () => Date
}): Promise<TodayBootstrap> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const seed = createTodayBootstrap({ ...context, now: now() })
    let result: { data: { check_in_completed_at?: string | null } | null; error?: unknown }
    try {
      result = await supabase.from('recovery_logs').select('check_in_completed_at')
        .eq('client_id', seed.clientId).eq('auth_user_id', seed.ownerUserId)
        .eq('log_date', seed.date).maybeSingle()
    } catch {
      result = { data: null, error: true }
    }
    const current = createTodayBootstrap({ ...context, now: now() })
    // Retry with the new member-local day. Yesterday's absence or completion is
    // never allowed to activate an action for the new date.
    if (current.date !== seed.date || current.timezone !== seed.timezone) continue
    if (result.error) return {
      ...current,
      checkIn: { status: 'error', completed: null, message: 'Your check-in status could not be confirmed. Try again.' },
    }
    const completed = Boolean(result.data?.check_in_completed_at)
    current.checkIn = { status: 'ready', completed }
    if (!completed) current.day.sections[0].items.push({
      id: 'activity:check-in', activityId: 'check-in', category: 'check_in',
      title: 'Daily check-in', detail: 'Take a moment to check in with how you are feeling today.',
      href: '/dashboard/check-in', status: 'available',
      startAt: null, endAt: null, timing: 'untimed', timingPending: true, continuesFromPreviousDay: false,
    })
    return current
  }
  return {
    ...createTodayBootstrap({ ...context, now: now() }),
    checkIn: { status: 'error', completed: null, message: 'Your local day changed while loading. Refresh your check-in status.' },
  }
}
