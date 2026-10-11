const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`)
      return dependencies[name]
    }, Date, Intl, Map, Set, Promise, JSON, Math, Number, Error,
  }, { filename: file })
  return module.exports
}
const logic = load('lib/calendar/logic.ts')

test('chosen time zone, fold, gap and civil all-day date round-trip', () => {
  assert.equal(logic.wallTimeToDate('2026-10-12', '09:00', 'America/Chicago').toISOString(), '2026-10-12T14:00:00.000Z')
  assert.equal(logic.wallTimeToDate('2026-11-01', '01:30', 'America/Chicago').toISOString(), '2026-11-01T06:30:00.000Z')
  assert.throws(() => logic.wallTimeToDate('2026-03-08', '02:30', 'America/Chicago'), /does not exist/)
  assert.throws(() => logic.wallTimeToDate('2026-02-30', '09:00', 'America/Chicago'), /valid date/)
  const havana = logic.calendarDayToDate('2026-03-08', 'America/Havana')
  assert.equal(logic.dateInZone(havana, 'America/Havana'), '2026-03-08')
  assert.equal(logic.timeInZone(havana, 'America/Havana'), '01:00')
  assert.equal(logic.calendarDayToDate('2026-03-08', 'America/Chicago').toISOString(), '2026-03-08T06:00:00.000Z')
})

test('busy commitments and buffers determine actual openings; free/suggested items do not block', () => {
  const date = new Date('2026-10-12T12:00:00Z')
  const start = new Date(date); start.setHours(9, 0, 0, 0)
  const end = new Date(date); end.setHours(12, 0, 0, 0)
  const events = [{ start_at: start.toISOString(), end_at: end.toISOString() },
    { start_at: start.toISOString(), end_at: new Date(end.getTime() + 10 * 3600000).toISOString(), busy: false },
    { start_at: start.toISOString(), end_at: new Date(end.getTime() + 10 * 3600000).toISOString(), suggested: true }]
  const slots = logic.suggestOpenings(date, 30, events, { start: 9, end: 14, bufferMinutes: 15 }, new Date(0))
  assert.ok(slots.length)
  assert.equal(new Date(slots[0].start_at).getHours(), 12)
  assert.equal(new Date(slots[0].start_at).getMinutes(), 15)
  assert.deepEqual(logic.suggestOpenings(date, 30, [], { start: 14, end: 9, bufferMinutes: 15 }, new Date(0)).length, 0)
})

test('only an explicit selected cloud calendar mapping suppresses the device calendar', () => {
  assert.equal(logic.shouldSuppressDeviceCalendar('device-1', { 'device-1': 'google:user@example.com' }, ['google:user@example.com']), true)
  assert.equal(logic.shouldSuppressDeviceCalendar('device-1', { 'device-1': 'google:user@example.com' }, []), false)
  assert.equal(logic.shouldSuppressDeviceCalendar('device-2', { 'device-1': 'google:user@example.com' }, ['google:user@example.com']), false)
  assert.notEqual(logic.occurrenceKey({ id: 'series', start_at: '2026-10-12' }), logic.occurrenceKey({ id: 'series', start_at: '2026-10-13' }))
})

function fixture(platform = 'ios') {
  const storage = new Map()
  const events = new Map()
  const state = { userId: 'alice', granted: true, writable: true, createCalls: 0, rejectCreate: false, beforeList: null }
  const calendar = {
    id: 'device-1', title: 'Personal', allowsModifications: true, source: { name: 'iCloud' },
    async createEvent(details) {
      state.createCalls++
      if (state.rejectCreate) throw new Error('Uncertain native write')
      const id = `event-${state.createCalls}`
      const event = { id, calendarId: this.id, ...details, status: 'confirmed', alarms: details.alarms || [],
        async update(patch) { Object.assign(this, patch) }, async delete() { events.delete(id) }, async editInCalendar() {} }
      events.set(id, event); return event
    },
  }
  const api = {
    EntityTypes: { EVENT: 'event' }, EventStatus: { CANCELED: 'canceled' }, Availability: { FREE: 'free', BUSY: 'busy' },
    Frequency: { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
    async requestCalendarPermissions() { return { status: state.granted ? 'granted' : 'denied' } },
    async getCalendarPermissions() { return { status: state.granted ? 'granted' : 'denied' } },
    async getCalendars() { return [{ ...calendar, allowsModifications: state.writable }] },
    async listEvents() { if (state.beforeList) await state.beforeList(); return [...events.values()] },
    ExpoCalendar: { async get() { return { ...calendar, allowsModifications: state.writable } } },
    ExpoCalendarEvent: { async get(id) { if (!events.has(id)) throw new Error('Missing event'); return events.get(id) } },
  }
  const AsyncStorage = {
    async getItem(key) { return storage.get(key) || null }, async setItem(key, value) { storage.set(key, value) },
    async removeItem(key) { storage.delete(key) }, async getAllKeys() { return [...storage.keys()] },
    async multiRemove(keys) { keys.forEach((key) => storage.delete(key)) },
  }
  const device = load('lib/calendar/device.ts', {
    '@react-native-async-storage/async-storage': AsyncStorage, 'expo-calendar': api, 'react-native': { Platform: { OS: platform } },
    '../supabase': { supabase: { auth: { async getSession() { return { data: { session: { user: { id: state.userId } } } } } } } },
    './logic': logic,
  })
  const draft = { title: 'Workout', start: '2026-10-12T09:00', end: '2026-10-12T09:30', timezone: 'America/Chicago', allDay: false,
    location: 'Park', notes: '', reminderMinutes: 10, recurrence: 'none', occurrences: 8 }
  return { device, state, events, storage, draft }
}
async function connected(f) {
  await f.device.connectDeviceCalendars()
  await f.device.saveDevicePreferences({ ...await f.device.getDevicePreferences(), selected: ['device-1'], defaultCalendar: 'device-1' })
}

test('mocked native connect→select→create/read→external change→edit/delete; recurrence/all-day', async () => {
  const f = fixture(); await connected(f)
  const id = await f.device.createDeviceEvent('device-1', f.draft, 'request-1')
  assert.equal(f.events.get(id).startDate.toISOString(), '2026-10-12T14:00:00.000Z')
  let snapshot = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  assert.equal(snapshot.events[0].source_label, 'Apple device · Personal')
  f.events.get(id).title = 'Externally changed'
  await assert.rejects(f.device.updateDeviceEvent(snapshot.events[0], f.draft), /changed since/)
  snapshot = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  assert.equal(snapshot.events[0].title, 'Externally changed')
  f.events.get(id).availability = 'free'; f.events.get(id).alarms = [{ relativeOffset: -40 }, { relativeOffset: -90 }]
  snapshot = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  await f.device.updateDeviceEvent(snapshot.events[0], { ...f.draft, title: 'Changed title', preserveAlarms: snapshot.events[0].alarms })
  assert.equal(f.events.get(id).availability, 'free')
  assert.equal(f.events.get(id).alarms.length, 2)
  assert.equal(f.events.get(id).alarms[0].relativeOffset, -40)
  snapshot = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  await f.device.deleteDeviceEvent(snapshot.events[0]); assert.equal(f.events.has(id), false)
  const repeated = await f.device.createDeviceEvent('device-1', { ...f.draft, recurrence: 'weekly' }, 'request-repeat')
  assert.equal(f.events.get(repeated).recurrenceRule.frequency, 'weekly')
  const allDay = await f.device.createDeviceEvent('device-1', { ...f.draft, allDay: true, start: '2026-03-08', end: '2026-03-09' }, 'request-all-day')
  assert.equal(f.events.get(allDay).allDay, true)
  assert.equal((f.events.get(allDay).endDate - f.events.get(allDay).startDate) / 3600000, 23)
})

test('Android all-day writes use UTC boundaries and read back as the complete civil date across DST', async () => {
  const f = fixture('android'); await connected(f)
  const id = await f.device.createDeviceEvent('device-1', { ...f.draft, allDay: true, start: '2026-03-08', end: '2026-03-09' }, 'android-date')
  assert.equal(f.events.get(id).timeZone, 'UTC')
  assert.equal(f.events.get(id).startDate.toISOString(), '2026-03-08T00:00:00.000Z')
  assert.equal(f.events.get(id).endDate.toISOString(), '2026-03-09T00:00:00.000Z')
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const start = logic.calendarDayToDate('2026-03-08', zone), end = logic.calendarDayToDate('2026-03-09', zone)
  const snapshot = await f.device.readDeviceCalendars(start, end)
  assert.equal(snapshot.events.length, 1)
  assert.equal(snapshot.events[0].start_at, start.toISOString())
  assert.equal(snapshot.events[0].end_at, end.toISOString())
  assert.equal(snapshot.events[0].start_date, '2026-03-08')
  assert.equal(snapshot.events[0].end_date, '2026-03-09')
  assert.equal(snapshot.events[0].source_label, 'Android device · Personal')
})

test('mocked retries cannot create duplicates including uncertain native saves', async () => {
  const f = fixture(); await connected(f)
  const ids = await Promise.all([f.device.createDeviceEvent('device-1', f.draft, 'same'), f.device.createDeviceEvent('device-1', f.draft, 'same')])
  assert.equal(ids[0], ids[1]); assert.equal(f.state.createCalls, 1)
  assert.equal(await f.device.createDeviceEvent('device-1', f.draft, 'same'), ids[0]); assert.equal(f.state.createCalls, 1)
  f.state.rejectCreate = true
  await assert.rejects(f.device.createDeviceEvent('device-1', f.draft, 'uncertain'), /Uncertain/)
  await assert.rejects(f.device.createDeviceEvent('device-1', f.draft, 'uncertain'), /may have completed/)
  assert.equal(f.state.createCalls, 2)
})

test('mocked denied/revoked/read-only access and disconnect preserve external events', async () => {
  const f = fixture(); f.state.granted = false
  await assert.rejects(f.device.connectDeviceCalendars(), /denied/)
  f.state.granted = true; await connected(f)
  await f.device.createDeviceEvent('device-1', f.draft, 'save')
  f.state.writable = false; await assert.rejects(f.device.createDeviceEvent('device-1', f.draft, 'readonly'), /read-only/)
  f.state.granted = false
  const snapshot = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  assert.equal(snapshot.status, 'denied'); assert.equal(snapshot.events.length, 0)
  await f.device.disconnectDeviceCalendars(); assert.equal(f.events.size, 1); assert.equal(f.storage.size, 0)
  f.state.granted = true; await connected(f)
  assert.equal((await f.device.getDevicePreferences()).connected, true)
})

test('mocked account isolation and account change during native read discard appointment details', async () => {
  const f = fixture(); await connected(f)
  await f.device.createDeviceEvent('device-1', f.draft, 'save')
  f.state.userId = 'bob'; assert.equal((await f.device.getDevicePreferences()).connected, false)
  f.state.userId = 'alice'
  f.state.beforeList = async () => { f.state.userId = 'bob' }
  const result = await f.device.readDeviceCalendars(new Date(0), new Date('2030-01-01'))
  assert.equal(result.events.length, 0); assert.equal(result.status, 'error')
  assert.equal(f.storage.has('anastasis:device-calendars:v1:bob'), false)
})
