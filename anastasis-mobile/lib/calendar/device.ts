import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Calendar from 'expo-calendar'
import { Platform } from 'react-native'

import { supabase } from '../supabase'
import { calendarDayToDate, dateInZone, occurrenceKey, validateEventTimes, type PreferredHours } from './logic'

export type DeviceCalendar = { id: string; title: string; writable: boolean; account: string; color?: string }
export type DeviceEvent = {
  id: string; key: string; calendarId: string; title: string; start_at: string; end_at: string
  allDay: boolean; timezone: string; location: string; notes: string; recurring: boolean
  source_label: string; writable: boolean; busy: boolean; fingerprint: string
  alarms: Calendar.Alarm[]
  start_date?: string; end_date?: string
}
export type DevicePreferences = {
  connected: boolean; selected: string[]; defaultCalendar: string | null
  cloudMappings: Record<string, string>; lastSync: string | null; hours: PreferredHours
}
export type DeviceEventDraft = {
  title: string; start: string; end: string; timezone: string; allDay: boolean
  location: string; notes: string; reminderMinutes: number | null
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'; occurrences: number
  preserveAlarms?: Calendar.Alarm[]
}
export type DeviceSnapshot = {
  preferences: DevicePreferences; calendars: DeviceCalendar[]; events: DeviceEvent[]
  status: 'disconnected' | 'connected' | 'denied' | 'unavailable' | 'error'; error: string | null
}
const defaults: DevicePreferences = {
  connected: false, selected: [], defaultCalendar: null, cloudMappings: {}, lastSync: null,
  hours: { start: 6, end: 21, bufferMinutes: 15 },
}
const listeners = new Set<() => void>()
export function observeDeviceCalendar(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
function notify() { for (const listener of listeners) listener() }
async function identity() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user.id) throw new Error('Sign in to Anastasis first.')
  return data.session.user.id
}
function storageKey(userId: string) { return `anastasis:device-calendars:v1:${userId}` }
async function preferencesFor(userId: string): Promise<DevicePreferences> {
  const value = await AsyncStorage.getItem(storageKey(userId))
  return value ? { ...defaults, ...JSON.parse(value) } : { ...defaults }
}
export async function getDevicePreferences(): Promise<DevicePreferences> { return preferencesFor(await identity()) }
export async function saveDevicePreferences(preferences: DevicePreferences) {
  await AsyncStorage.setItem(storageKey(await identity()), JSON.stringify(preferences)); notify()
}
async function permission(request = false) {
  if (Platform.OS === 'web') throw new Error('Device calendars are available in the iOS and Android app. Use cloud calendars on the web.')
  const result = request ? await Calendar.requestCalendarPermissions(false) : await Calendar.getCalendarPermissions(false)
  if (result.status !== 'granted') throw new Error('Calendar access is denied. Enable full calendar access in device Settings, then reconnect.')
}
export async function connectDeviceCalendars() {
  await permission(true)
  const preferences = await getDevicePreferences()
  await saveDevicePreferences({ ...preferences, connected: true })
}
export async function disconnectDeviceCalendars() {
  const userId = await identity()
  await AsyncStorage.removeItem(storageKey(userId))
  const keys = await AsyncStorage.getAllKeys()
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(`anastasis:calendar-write:${userId}:`)))
  notify()
}
function fingerprint(event: Calendar.ExpoCalendarEvent) {
  return JSON.stringify([event.title, event.startDate, event.endDate, event.allDay, event.timeZone,
    event.location, event.notes, event.recurrenceRule, event.alarms, event.availability, event.lastModifiedDate])
}
function calendarWritable(calendar: Calendar.ExpoCalendar) {
  return calendar.allowsModifications && !['read', 'freebusy', 'respond', 'none'].includes(calendar.accessLevel || '')
}
function eventWritable(event: Calendar.ExpoCalendarEvent, calendar: Calendar.ExpoCalendar) {
  if (!calendarWritable(calendar)) return false
  return !(event.organizerEmail && calendar.ownerAccount && event.organizerEmail.toLowerCase() !== calendar.ownerAccount.toLowerCase() && !event.guestsCanModify)
}
export async function readDeviceCalendars(start: Date, end: Date): Promise<DeviceSnapshot> {
  const userId = await identity()
  const preferences = await preferencesFor(userId)
  if (!preferences.connected || Platform.OS === 'web') {
    return { preferences, calendars: [], events: [], status: Platform.OS === 'web' ? 'unavailable' : 'disconnected', error: null }
  }
  try {
    await permission()
    const nativeCalendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT)
    const calendars = nativeCalendars.map((calendar) => ({
      id: calendar.id, title: calendar.title, writable: calendarWritable(calendar),
      account: calendar.ownerAccount || calendar.source?.name || 'Device calendar', color: calendar.color,
    }))
    const selected = preferences.selected.filter((id) => calendars.some((calendar) => calendar.id === id))
    // Android encodes DATE events at UTC midnight. Widen the provider query,
    // then project those dates onto the device's civil day before range filtering.
    const nativeEvents = selected.length ? await Calendar.listEvents(selected,
      new Date(start.getTime() - 86400000), new Date(end.getTime() + 86400000)) : []
    const events = nativeEvents.filter((event) => event.status !== Calendar.EventStatus.CANCELED).map((event): DeviceEvent => {
      const calendar = calendars.find((item) => item.id === event.calendarId)
      const nativeCalendar = nativeCalendars.find((item) => item.id === event.calendarId)
      const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const eventZone = event.timeZone || viewerZone
      const startDate = event.allDay ? (Platform.OS === 'android' ? new Date(event.startDate).toISOString().slice(0, 10) : dateInZone(new Date(event.startDate), eventZone)) : undefined
      const endDate = event.allDay ? (Platform.OS === 'android' ? new Date(event.endDate).toISOString().slice(0, 10) : dateInZone(new Date(event.endDate), eventZone)) : undefined
      const start_at = startDate ? calendarDayToDate(startDate, viewerZone).toISOString() : new Date(event.startDate).toISOString()
      const end_at = endDate ? calendarDayToDate(endDate, viewerZone).toISOString() : new Date(event.endDate).toISOString()
      return {
        id: event.id, key: occurrenceKey({ id: event.id, start_at }), calendarId: event.calendarId,
        title: event.title || 'Busy', start_at, end_at, start_date: startDate, end_date: endDate,
        allDay: event.allDay, timezone: event.allDay ? viewerZone : eventZone,
        location: event.location || '', notes: event.notes || '', recurring: Boolean(event.recurrenceRule || event.originalId || event.isDetached),
        source_label: `${Platform.OS === 'ios' ? 'Apple device' : 'Android device'} · ${calendar?.title || 'Calendar'}`,
        writable: Boolean(nativeCalendar && eventWritable(event, nativeCalendar)), busy: event.availability !== Calendar.Availability.FREE, fingerprint: fingerprint(event),
        alarms: event.alarms,
      }
    }).filter(event => Date.parse(event.start_at) < end.getTime() && Date.parse(event.end_at) > start.getTime())
    const unique = [...new Map(events.map((event) => [event.key, event])).values()]
    const next = { ...preferences, selected, lastSync: new Date().toISOString() }
    if (await identity() !== userId) throw new Error('Your Anastasis account changed. Refresh the calendar.')
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next))
    return { preferences: next, calendars, events: unique, status: 'connected', error: null }
  } catch (error) {
    // Never keep stale imported details after permissions are revoked or a read fails.
    const message = error instanceof Error ? error.message : 'Device calendar refresh failed. Try again.'
    return { preferences, calendars: [], events: [], status: /denied/i.test(message) ? 'denied' : 'error', error: message }
  }
}
async function writable(calendarId: string) {
  await permission()
  const prefs = await getDevicePreferences()
  if (!prefs.connected) throw new Error('Connect device calendars first.')
  const calendar = await Calendar.ExpoCalendar.get(calendarId)
  if (!calendarWritable(calendar)) throw new Error('This calendar is read-only. Choose a writable calendar.')
  return calendar
}
function details(draft: DeviceEventDraft) {
  new Intl.DateTimeFormat('en-US', { timeZone: draft.timezone })
  const eventZone = draft.allDay && Platform.OS === 'android' ? 'UTC' : draft.timezone
  const { startDate, endDate } = draft.allDay
    ? { startDate: calendarDayToDate(draft.start, eventZone), endDate: calendarDayToDate(draft.end, eventZone) }
    : validateEventTimes(draft.start, draft.end, draft.timezone)
  if (endDate <= startDate) throw new Error('End date must be after start date.')
  if (!draft.title.trim()) throw new Error('Enter an event title.')
  if (draft.reminderMinutes != null && (!Number.isFinite(draft.reminderMinutes) || draft.reminderMinutes < 0 || draft.reminderMinutes > 43200)) throw new Error('Choose a reminder from 0 to 43200 minutes before the event.')
  const frequency = { daily: Calendar.Frequency.DAILY, weekly: Calendar.Frequency.WEEKLY, monthly: Calendar.Frequency.MONTHLY }
  if (draft.recurrence !== 'none' && (!Number.isInteger(draft.occurrences) || draft.occurrences < 2 || draft.occurrences > 365)) throw new Error('Choose 2–365 occurrences.')
  return {
    title: draft.title.trim(), startDate, endDate, timeZone: eventZone, allDay: draft.allDay,
    location: draft.location, notes: draft.notes, availability: Calendar.Availability.BUSY,
    alarms: draft.preserveAlarms ?? (draft.reminderMinutes == null ? [] : [{ relativeOffset: -Math.abs(draft.reminderMinutes) }]),
    recurrenceRule: draft.recurrence === 'none' ? null : { frequency: frequency[draft.recurrence], interval: 1, occurrence: draft.occurrences },
  }
}
// Persist a pending marker before creation. A crash during native creation requires
// user reconciliation rather than blindly creating a second external event.
const writes = new Map<string, Promise<string>>()
export async function createDeviceEvent(calendarId: string, draft: DeviceEventDraft, requestId: string): Promise<string> {
  const userId = await identity()
  const key = `anastasis:calendar-write:${userId}:${requestId}`
  const running = writes.get(key); if (running) return running
  const write = (async () => {
    const calendar = await writable(calendarId)
    const saved = await AsyncStorage.getItem(key)
    if (saved && saved !== 'pending') {
      const existing = await Calendar.ExpoCalendarEvent.get(saved)
      if (existing.calendarId !== calendarId) throw new Error('This request already created an event in a different calendar.')
      return existing.id
    }
    if (saved === 'pending') throw new Error('The previous save may have completed. Refresh and check the calendar before starting a new event.')
    const eventDetails = details(draft)
    await AsyncStorage.setItem(key, 'pending')
    const created = await calendar.createEvent(eventDetails)
    const confirmed = await Calendar.ExpoCalendarEvent.get(created.id)
    await AsyncStorage.setItem(key, confirmed.id)
    notify(); return confirmed.id
  })()
  writes.set(key, write)
  try { return await write } finally { writes.delete(key) }
}
export async function updateDeviceEvent(event: DeviceEvent, draft: DeviceEventDraft) {
  const calendar = await writable(event.calendarId)
  if (event.recurring) throw new Error('Use the system calendar editor to choose this occurrence or the recurring series.')
  const current = await Calendar.ExpoCalendarEvent.get(event.id)
  if (!eventWritable(current, calendar)) throw new Error('This appointment cannot be modified by your account.')
  if (fingerprint(current) !== event.fingerprint) throw new Error('This event changed since you opened it. Refresh before editing.')
  await current.update({ ...details(draft), availability: current.availability }); await Calendar.ExpoCalendarEvent.get(event.id); notify()
}
export async function deleteDeviceEvent(event: DeviceEvent) {
  const calendar = await writable(event.calendarId)
  if (event.recurring) throw new Error('Use the system calendar editor to choose which recurring occurrences to delete.')
  const current = await Calendar.ExpoCalendarEvent.get(event.id)
  if (!eventWritable(current, calendar)) throw new Error('This appointment cannot be modified by your account.')
  if (fingerprint(current) !== event.fingerprint) throw new Error('This event changed since you opened it. Refresh before deleting.')
  await current.delete(); notify()
}
export async function editDeviceRecurringEvent(event: DeviceEvent) {
  const calendar = await writable(event.calendarId)
  const current = await Calendar.ExpoCalendarEvent.get(event.id)
  if (!eventWritable(current, calendar)) throw new Error('This appointment cannot be modified by your account.')
  await current.editInCalendar(); notify()
}
