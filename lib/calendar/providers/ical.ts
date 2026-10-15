import 'server-only'
import ICAL from 'ical.js'
import { ProviderError, type EventDraft, type ProviderCalendar, type ProviderEvent, type SyncWindow } from './types'

const pad = (value: number) => String(value).padStart(2, '0')
const dateString = (time: ICAL.Time) => `${time.year}-${pad(time.month)}-${pad(time.day)}`

/** Resolve IANA wall time with the runtime tz database; never interpret floating times in server TZ. */
export function wallTimeToInstant(wall: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(wall)
  if (!match) throw new ProviderError('invalid_input', 'The event contains an invalid date or time.')
  const values = match.slice(1).map(Number)
  const target = Date.UTC(values[0], values[1] - 1, values[2], values[3], values[4], values[5])
  let guess = target
  let formatter: Intl.DateTimeFormat
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) }
  catch { throw new ProviderError('invalid_input', 'Choose a supported IANA time zone.') }
  for (let iteration = 0; iteration < 5; iteration++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]))
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    const delta = target - rendered
    if (!delta) return new Date(guess).toISOString()
    guess += delta
  }
  // RFC5545 uses the pre-transition offset for a nonexistent wall time.
  return new Date(guess).toISOString()
}

export function instantToWall(instant: string, timeZone: string): string {
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new ProviderError('invalid_input', 'The event contains an invalid date or time.')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

export function icalTimeString(time: ICAL.Time, fallbackTimeZone: string): string {
  if (time.isDate) return dateString(time)
  if (time.zone === ICAL.Timezone.utcTimezone) return time.toJSDate().toISOString()
  if (time.zone?.component) return time.toJSDate().toISOString()
  const wall = `${dateString(time)}T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`
  return wallTimeToInstant(wall, time.zone?.tzid && time.zone.tzid !== 'floating' ? time.zone.tzid : fallbackTimeZone)
}

function eventTime(value: string, allDay: boolean, timeZone: string): ICAL.Time {
  if (allDay) return ICAL.Time.fromDateString(value)
  // A floating representation lets recurrence follow wall clock time across daylight saving.
  return ICAL.Time.fromDateTimeString(instantToWall(value, timeZone))
}

function replaceTime(component: ICAL.Component, name: string, value: string, draft: EventDraft) {
  const property = new ICAL.Property(name)
  property.setValue(eventTime(value, draft.allDay, draft.timeZone))
  if (!draft.allDay) property.setParameter('tzid', draft.timeZone)
  component.removeAllProperties(name)
  component.addProperty(property)
}

function cleanText(value: string) { return value.replace(/\u0000/g, '') }

/** Validate writes more strictly than the permissive parser; imported provider rules remain intact. */
export function validateRecurrenceRules(lines: string[], allDay = false): void {
  const knownParts = new Set(['FREQ', 'UNTIL', 'COUNT', 'INTERVAL', 'BYSECOND', 'BYMINUTE', 'BYHOUR', 'BYDAY', 'BYMONTHDAY', 'BYYEARDAY', 'BYWEEKNO', 'BYMONTH', 'BYSETPOS', 'WKST'])
  for (const line of lines) {
    if (!/^(RRULE|RDATE|EXDATE)(;[^:\r\n]*)?:[^\r\n]+$/i.test(line)) throw new ProviderError('invalid_input', 'Use valid RRULE, RDATE, or EXDATE recurrence rules.')
    if (/^RRULE:/i.test(line)) {
      const parts = line.slice(6).toUpperCase().split(';'), seen = new Set<string>()
      for (const part of parts) {
        const [name, value] = part.split('=')
        if (!knownParts.has(name) || seen.has(name) || !value || part.split('=').length !== 2) throw new ProviderError('invalid_input', 'The recurrence rule contains an unsupported or repeated field.')
        seen.add(name)
        if (['COUNT', 'INTERVAL'].includes(name) && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100_000)) {
          throw new ProviderError('invalid_input', 'Repeat count and interval must be positive and at most 100,000.')
        }
        if (allDay && ['BYSECOND', 'BYMINUTE', 'BYHOUR'].includes(name)) throw new ProviderError('invalid_input', 'All-day repeats cannot contain time-of-day rules.')
      }
      if (!seen.has('FREQ') || (seen.has('COUNT') && seen.has('UNTIL'))) throw new ProviderError('invalid_input', 'Add a repeat frequency and choose either an end date or a repeat count.')
      const frequency = /^FREQ=([^;]+)$/.exec(parts.find(part => part.startsWith('FREQ=')) || '')?.[1]
      if (!['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency || '')) throw new ProviderError('invalid_input', 'Use hourly, daily, weekly, monthly, or yearly repeats.')
      try { ICAL.Recur.fromString(line.slice(6)) }
      catch { throw new ProviderError('invalid_input', 'The recurrence rule is invalid.') }
    }
    try { ICAL.Property.fromString(line) }
    catch { throw new ProviderError('invalid_input', 'The recurrence rule contains an invalid date or parameter.') }
  }
}

const zoneCache = new Map<string, string>()
function timeZoneComponent(timeZone: string, startYear: number): ICAL.Component {
  const key = `${timeZone}:${startYear}`
  const cached = zoneCache.get(key)
  if (cached) return new ICAL.Component(ICAL.parse(cached))
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
  const offset = (instant: number) => {
    const value = formatter.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')?.value || 'GMT'
    const match = /GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] || 0)) : 0
  }
  const offsetString = (seconds: number) => `${seconds < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(seconds) / 3600))}${pad(Math.floor(Math.abs(seconds) % 3600 / 60))}${seconds % 60 ? pad(Math.abs(seconds) % 60) : ''}`
  const compactWall = (instant: number, seconds: number) => new Date(instant + seconds * 1000).toISOString().slice(0, 19).replace(/[-:]/g, '')
  const from = Date.UTC(startYear - 1, 0, 1), until = Date.UTC(Math.max(startYear + 101, new Date().getUTCFullYear() + 101), 0, 1)
  let previousInstant = from, previousOffset = offset(from)
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`, 'BEGIN:STANDARD', `DTSTART:${compactWall(from, previousOffset)}`,
    `TZOFFSETFROM:${offsetString(previousOffset)}`, `TZOFFSETTO:${offsetString(previousOffset)}`, 'END:STANDARD']
  // Explicit transitions avoid approximating political/IANA changes with US-style DST rules.
  for (let next = from + 86400000; next <= until; next += 86400000) {
    const nextOffset = offset(next)
    if (nextOffset !== previousOffset) {
      let low = previousInstant, high = next
      while (high - low > 1000) {
        const midpoint = Math.floor((low + high) / 2000) * 1000
        if (offset(midpoint) === previousOffset) low = midpoint
        else high = midpoint
      }
      const kind = nextOffset > previousOffset ? 'DAYLIGHT' : 'STANDARD'
      lines.push(`BEGIN:${kind}`, `DTSTART:${compactWall(high, previousOffset)}`, `TZOFFSETFROM:${offsetString(previousOffset)}`,
        `TZOFFSETTO:${offsetString(nextOffset)}`, `END:${kind}`)
      previousOffset = nextOffset
    }
    previousInstant = next
  }
  lines.push('END:VTIMEZONE')
  const ics = lines.join('\r\n')
  if (zoneCache.size >= 64) zoneCache.delete(zoneCache.keys().next().value!)
  zoneCache.set(key, ics)
  return new ICAL.Component(ICAL.parse(ics))
}

/** Preserve unrelated properties and recurrence exceptions when explicitly editing a series. */
export function buildICalendar(draft: EventDraft, uid: string, options: { existingIcs?: string; operationKey?: string; updateOperationKey?: string } = {}): string {
  let calendar: ICAL.Component
  try { calendar = options.existingIcs ? new ICAL.Component(ICAL.parse(options.existingIcs)) : new ICAL.Component('vcalendar') }
  catch { throw new ProviderError('invalid_response', 'The calendar event could not be read safely. Refresh before editing.') }
  calendar.updatePropertyWithValue('version', '2.0')
  calendar.updatePropertyWithValue('prodid', '-//Anastasis//Connected Calendars//EN')
  let component = calendar.getAllSubcomponents('vevent').find(item => !item.hasProperty('recurrence-id'))
  if (!component) { component = new ICAL.Component('vevent'); calendar.addSubcomponent(component) }
  component.updatePropertyWithValue('uid', uid)
  component.updatePropertyWithValue('summary', cleanText(draft.title))
  component.updatePropertyWithValue('description', cleanText(draft.description || ''))
  component.updatePropertyWithValue('location', cleanText(draft.location || ''))
  component.updatePropertyWithValue('transp', draft.busy === false ? 'TRANSPARENT' : 'OPAQUE')
  component.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))
  component.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(), true))
  component.updatePropertyWithValue('sequence', Number(component.getFirstPropertyValue('sequence') || 0) + 1)
  replaceTime(component, 'dtstart', draft.start, draft)
  replaceTime(component, 'dtend', draft.end, draft)
  component.removeAllProperties('duration')
  if (draft.recurrence !== undefined) {
    validateRecurrenceRules(draft.recurrence, draft.allDay)
    for (const name of ['rrule', 'rdate', 'exdate']) component.removeAllProperties(name)
    for (const line of draft.recurrence) {
      if (!/^(RRULE|RDATE|EXDATE)(;[^:\r\n]*)?:[^\r\n]+$/i.test(line)) {
        throw new ProviderError('invalid_input', 'Use valid RRULE, RDATE, or EXDATE recurrence rules.')
      }
      try { component.addProperty(ICAL.Property.fromString(line)) }
      catch { throw new ProviderError('invalid_input', 'The recurrence rule is invalid.') }
    }
  }
  if (draft.reminders !== undefined) {
    component.removeAllSubcomponents('valarm')
    for (const reminder of draft.reminders) {
      // CalDAV email alarms need ATTENDEE; use only device display alarms here.
      if (reminder.method !== 'popup') throw new ProviderError('invalid_input', 'iCloud supports display reminders in Anastasis. Choose a popup reminder.')
      const alarm = new ICAL.Component('valarm')
      alarm.updatePropertyWithValue('action', 'DISPLAY')
      alarm.updatePropertyWithValue('description', 'Event reminder')
      alarm.updatePropertyWithValue('trigger', ICAL.Duration.fromSeconds(-reminder.minutes * 60))
      component.addSubcomponent(alarm)
    }
  }
  if (options.operationKey) component.updatePropertyWithValue('x-anastasis-operation', options.operationKey)
  if (options.updateOperationKey) component.updatePropertyWithValue('x-anastasis-update-operation', options.updateOperationKey)
  if (!draft.allDay && !calendar.getAllSubcomponents('vtimezone').some(zone => zone.getFirstPropertyValue('tzid') === draft.timeZone)) {
    // RFC5545 requires a VTIMEZONE for each TZID; include runtime IANA transitions.
    calendar.addSubcomponent(timeZoneComponent(draft.timeZone, Number(draft.start.slice(0, 4))))
  }
  return calendar.toString() + '\r\n'
}

export function parseICalendar(ics: string, calendar: ProviderCalendar, resourceId: string, etag?: string): ProviderEvent[] {
  let component: ICAL.Component
  try { component = new ICAL.Component(ICAL.parse(ics)) }
  catch { throw new ProviderError('invalid_response', 'An iCloud event contains invalid calendar data. Please retry synchronization.') }
  const entries: ProviderEvent[] = []
  for (const vevent of component.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent)
    if (!vevent.hasProperty('dtstart') && String(vevent.getFirstPropertyValue('status')).toUpperCase() !== 'CANCELLED') continue
    const start = vevent.hasProperty('dtstart') ? icalTimeString(event.startDate, calendar.timeZone) : ''
    const end = vevent.hasProperty('dtstart') ? icalTimeString(event.endDate, calendar.timeZone) : ''
    const recurrenceId = vevent.getFirstPropertyValue('recurrence-id') as ICAL.Time | null
    const originalStart = recurrenceId ? icalTimeString(recurrenceId, calendar.timeZone) : undefined
    const tzid = vevent.getFirstProperty('dtstart')?.getParameter('tzid')
    let timeZone = calendar.timeZone
    if (typeof tzid === 'string') {
      try { new Intl.DateTimeFormat('en', { timeZone: tzid }); timeZone = tzid } catch { /* Embedded custom VTIMEZONE still determines instants; display uses calendar IANA zone. */ }
    }
    const lastModified = vevent.getFirstPropertyValue('last-modified') as ICAL.Time | null
    const reminders = vevent.getAllSubcomponents('valarm').flatMap(alarm => {
      const trigger = alarm.getFirstPropertyValue('trigger') as ICAL.Duration | null
      if (alarm.getFirstPropertyValue('action') !== 'DISPLAY' || !trigger || typeof trigger.toSeconds !== 'function') return []
      const minutes = -trigger.toSeconds() / 60
      return minutes >= 0 ? [{ method: 'popup' as const, minutes }] : []
    })
    entries.push({
      id: recurrenceId ? `${resourceId}#${encodeURIComponent(originalStart || '')}` : resourceId,
      uid: event.uid, calendarId: calendar.id, etag, title: event.summary || 'Busy',
      description: event.description || undefined, location: event.location || undefined,
      start, end, timeZone,
      allDay: vevent.hasProperty('dtstart') ? event.startDate.isDate : Boolean(recurrenceId?.isDate),
      status: String(vevent.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED' ? 'cancelled' :
        String(vevent.getFirstPropertyValue('status')).toUpperCase() === 'TENTATIVE' ? 'tentative' : 'confirmed',
      busy: String(vevent.getFirstPropertyValue('transp')).toUpperCase() !== 'TRANSPARENT',
      recurrence: ['rrule', 'rdate', 'exdate'].flatMap(name => vevent.getAllProperties(name).map(property => property.toICALString())),
      recurringEventId: recurrenceId ? resourceId : undefined, originalStart, reminders,
      updatedAt: lastModified ? icalTimeString(lastModified, calendar.timeZone) : undefined,
      metadata: { ical: ics, resourceId, editScope: 'series', recurrenceRange: vevent.getFirstProperty('recurrence-id')?.getParameter('range'),
        anastasisOperation: vevent.getFirstPropertyValue('x-anastasis-operation'),
        anastasisUpdateOperation: vevent.getFirstPropertyValue('x-anastasis-update-operation') },
    })
  }
  return entries
}

function withinWindow(event: ProviderEvent, window: SyncWindow) {
  const start = event.allDay ? wallTimeToInstant(`${event.start}T00:00:00`, event.timeZone) : event.start
  const end = event.allDay ? wallTimeToInstant(`${event.end}T00:00:00`, event.timeZone) : event.end
  return new Date(start).getTime() < new Date(window.end).getTime() && new Date(end).getTime() > new Date(window.start).getTime()
}

/** Bounded expansion includes EXDATE/RDATE, detached exceptions, and DST-aware wall times. */
export function expandProviderEvents(events: ProviderEvent[], window: SyncWindow): ProviderEvent[] {
  const results: ProviderEvent[] = []
  const exceptions = events.filter(event => event.recurringEventId)
  for (const master of events.filter(event => !event.recurringEventId && event.status !== 'cancelled')) {
    if (!master.start || !master.end) continue
    if (!master.recurrence?.length) { if (withinWindow(master, window)) results.push(master); continue }
    let component: ICAL.Component
    try {
      // Google imports can contain valid frequencies our personal-event editor does not offer.
      const ics = typeof master.metadata?.ical === 'string' ? master.metadata.ical : buildICalendar({ ...master, recurrence: undefined }, master.uid || master.id)
      component = new ICAL.Component(ICAL.parse(ics))
      if (typeof master.metadata?.ical !== 'string') {
        const vevent = component.getFirstSubcomponent('vevent')!
        for (const line of master.recurrence) vevent.addProperty(ICAL.Property.fromString(line))
      }
    } catch { throw new ProviderError('invalid_response', 'A recurring event could not be expanded. Refresh your calendar.') }
    const base = component.getAllSubcomponents('vevent').find(event => !event.hasProperty('recurrence-id'))
    if (!base) continue
    const recurrence = new ICAL.Event(base)
    const localExceptions = exceptions.filter(event => event.recurringEventId === master.id)
    // For iCloud, ICAL.Event also handles RANGE=THISANDFUTURE from the original resource.
    const iterator = recurrence.iterator()
    const upper = new Date(window.end).getTime()
    const seenExceptions = new Set<string>()
    let exhausted = false
    for (let count = 0; count < 100_000; count++) {
      const occurrence = iterator.next()
      if (!occurrence) { exhausted = true; break }
      const original = icalTimeString(occurrence, master.timeZone)
      const details = recurrence.getOccurrenceDetails(occurrence)
      const start = icalTimeString(details.startDate, master.timeZone)
      const end = icalTimeString(details.endDate, master.timeZone)
      const match = localExceptions.find(event => event.originalStart === original || (event.originalStart && new Date(event.originalStart).getTime() === new Date(original).getTime()))
      if (match) {
        seenExceptions.add(match.id)
        if (match.status !== 'cancelled' && match.start && match.end && withinWindow(match, window)) results.push({ ...match, metadata: { ...match.metadata, resourceId: master.id, seriesTitle: master.title, editScope: 'series' } })
      } else if (String(details.item.component.getFirstPropertyValue('status')).toUpperCase() !== 'CANCELLED') {
        const suffix = master.allDay ? original.replace(/-/g, '') : new Date(original).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        const projected = { ...master, id: `${master.id}_${suffix}`, start, end, recurringEventId: master.id,
          originalStart: original, recurrence: master.recurrence,
          title: details.item.summary || master.title, description: details.item.description || master.description,
          location: details.item.location || master.location,
          metadata: { ...master.metadata, resourceId: master.id, editScope: 'series', projected: true } }
        if (withinWindow(projected, window)) results.push(projected)
      }
      const originalInstant = master.allDay ? wallTimeToInstant(`${original}T00:00:00`, master.timeZone) : original
      if (new Date(originalInstant).getTime() > upper) { exhausted = true; break }
    }
    if (!exhausted) throw new ProviderError('invalid_response', 'This recurrence has too many instances to display safely. Narrow its recurrence rule.')
    // An instance moved into the window can originate outside the expansion window or before DTSTART.
    for (const exception of localExceptions) {
      if (!seenExceptions.has(exception.id) && exception.status !== 'cancelled' && exception.start && exception.end && withinWindow(exception, window)) {
        results.push({ ...exception, metadata: { ...exception.metadata, resourceId: master.id, editScope: 'series' } })
      }
    }
  }
  return results.sort((a, b) => a.start.localeCompare(b.start))
}
