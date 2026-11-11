import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildTodayDaySections, todayDaySectionAt } = await importTs('lib/dashboard/todayDaySections.ts')
const { buildTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const date = '2026-11-11', owner = 'QA-OWNER', clientId = 'QA-DAY-CAROUSEL'
const event = (id, time, type = 'work', patch = {}) => ({ id, user_id: owner, client_id: clientId, title: id,
  event_type: type, source: 'manual', description: null, status: 'scheduled', all_day: false,
  start_at: `${date}T${time}:00Z`, end_at: `${date}T${time}:30Z`, adjusted_start_at: null, adjusted_end_at: null,
  timezone: 'UTC', schedule_date: date, flexibility_type: 'fixed', ...patch })
const logic = (patch = {}) => ({ program: 'ignite', client: { id: clientId },
  assessments: { dailyCompleted: false }, hydration: { target: 80, remaining: 40, consumed: 40, status: 'ready', presentationPacing: { state: 'on_pace' } },
  nutrition: { dataStatus: 'known', pacing: { state: 'on_pace' } }, symptoms: { redFlag: false },
  workout: { assigned: true }, workoutDecision: { canTrain: true, reasonForModification: 'Your saved workout.', assignedWorkout: { workout_state: 'train' } },
  execution: { nutritionLogged: false, workoutComplete: false, recoveryComplete: false }, sleep: { logged: false },
  ...patch })
const schedule = (events = [], patch = {}) => ({ date, now: `${date}T08:00:00Z`, timezone: 'UTC', events,
  dailyGuide: { date, activities: {} }, preferences: { carouselStyle: 'section', executionStyle: 'flow', transitionMinutes: 10 }, ...patch })
const project = (current, saved) => buildTodayDaySections(current, saved, buildTodayActivities(current, saved).activities)
const items = result => [...result.sections.flatMap(section => section.items), ...result.untimed]
const ids = result => items(result).map(item => item.id)
const recoveryEvidence = (completedAt, patch = {}) => ({ ownerUserId: owner, clientId, date, available: true,
  completedAt, unlinkedRecordCount: 0, ...patch })

test('Today uses exact 10:00 and 15:00 section boundaries in the member timezone', () => {
  for (const [at, expected] of [
    ['09:59:59.999', 'morning'], ['10:00:00.000', 'midday'], ['14:59:59.999', 'midday'], ['15:00:00.000', 'evening'],
  ]) assert.equal(todayDaySectionAt(`${date}T${at}Z`, 'UTC'), expected)
  assert.equal(todayDaySectionAt(`${date}T14:59:59Z`, 'America/New_York'), 'morning')
  assert.equal(todayDaySectionAt(`${date}T15:00:00Z`, 'America/New_York'), 'midday')
  assert.equal(todayDaySectionAt(`${date}T20:00:00Z`, 'America/New_York'), 'evening')
  assert.equal(todayDaySectionAt('invalid', 'UTC'), null)
  assert.equal(todayDaySectionAt(`${date}T10:00:00Z`, 'invalid-zone'), null)
  const saved = schedule([event('before10', '09:59'), event('at10', '10:00'), event('before15', '14:59'), event('at15', '15:00')])
  const result = project(logic(), saved)
  assert.deepEqual(result.sections.map(section => section.items.map(item => item.eventId)), [['before10'], ['at10', 'before15'], ['at15']])
})

test('section refresh instants follow saved timezone and DST, with exact boundaries assigned forward', () => {
  const saved = schedule([], { timezone: 'America/New_York', now: `${date}T14:59:59Z` })
  assert.equal(project(logic(), saved).nextBoundaryAt, `${date}T15:00:00.000Z`)
  saved.now = `${date}T15:00:00Z`
  assert.equal(project(logic(), saved).nextBoundaryAt, `${date}T20:00:00.000Z`)
  saved.now = `${date}T20:00:00Z`
  assert.equal(project(logic(), saved).nextBoundaryAt, null)
  const dst = schedule([], { date: '2026-03-08', timezone: 'America/New_York', now: '2026-03-08T12:00:00Z' })
  assert.equal(project(logic(), dst).nextBoundaryAt, '2026-03-08T14:00:00.000Z')
  const auckland = schedule([event('local10', '00:00', 'school', { start_at: '2026-11-10T21:00:00Z', end_at: '2026-11-10T21:30:00Z' })], { timezone: 'Pacific/Auckland', now: '2026-11-10T20:00:00Z' })
  assert.equal(project(logic(), auckland).sections[1].items[0].eventId, 'local10')
})

test('future actions and on-pace incomplete hydration/nutrition remain all day without a schedule-review activity', () => {
  const saved = schedule([event('late-workout', '18:00', 'workout'), event('late-recovery', '19:00', 'recovery'), event('lunch', '12:00', 'meal')])
  const current = logic()
  const early = project(current, saved)
  assert.ok(ids(early).includes('event:late-workout')); assert.ok(ids(early).includes('event:late-recovery'))
  assert.ok(ids(early).includes('activity:water')); assert.ok(ids(early).includes('event:lunch'))
  assert.equal(items(early).some(item => item.activityId === 'schedule'), false)
  saved.now = `${date}T23:00:00Z`
  assert.deepEqual(ids(project(current, saved)).sort(), ids(early).sort(), 'the clock does not hide incomplete earlier actions')
  current.hydration.presentationPacing.state = 'sleep'; current.nutrition.pacing.state = 'sleep'
  assert.deepEqual(ids(project(current, saved)).sort(), ids(early).sort(), 'sleep pacing is not completion evidence')
})

test('saved adjusted starts, commitments, all-day and untimed actions retain their actual timing', () => {
  const saved = schedule([
    event('work', '09:00'), event('school', '10:00', 'school'), event('appointment', '15:00', 'appointment'),
    event('moved', '08:00', 'personal', { adjusted_start_at: `${date}T16:00:00Z`, adjusted_end_at: `${date}T16:30:00Z` }),
    event('all-day', '00:00', 'custom', { all_day: true, end_at: '2026-11-12T00:00:00Z' }),
    event('untimed', '00:00', 'household', { start_at: '', end_at: '' }),
  ])
  const result = project(logic(), saved)
  assert.deepEqual(result.sections[2].items.map(item => item.eventId), ['appointment', 'moved'])
  const allDay = result.untimed.find(item => item.eventId === 'all-day')
  assert.equal(allDay.timing, 'all_day'); assert.equal(allDay.startAt, null); assert.equal(allDay.endAt, null)
  const untimed = result.untimed.find(item => item.eventId === 'untimed')
  assert.equal(untimed.timing, 'untimed'); assert.equal(untimed.startAt, null)
  assert.ok(result.untimed.some(item => item.id === 'activity:check-in'))
  assert.equal(result.sections.length, 3)
})

test('overlapping overnight commitments appear once as continued, while events moved outside today stay outside today', () => {
  const saved = schedule([
    event('overnight', '00:00', 'work', { start_at: '2026-11-10T23:00:00Z', end_at: `${date}T07:00:00Z` }),
    event('moved-out', '09:00', 'school', { adjusted_start_at: '2026-11-12T09:00:00Z', adjusted_end_at: '2026-11-12T09:30:00Z' }),
  ])
  const result = project(logic(), saved), ongoing = result.sections[0].items[0]
  assert.equal(ongoing.eventId, 'overnight'); assert.equal(ongoing.continuesFromPreviousDay, true)
  assert.equal(ongoing.startAt, '2026-11-10T23:00:00.000Z')
  assert.equal(ids(result).filter(id => id === 'event:overnight').length, 1)
  assert.equal(ids(result).includes('event:moved-out'), false)
})

test('confirmed completion removes actions and commitments; skipped/deferred stay visible without completing other saved meals', () => {
  const current = logic()
  current.assessments.dailyCompleted = true; current.hydration.remaining = 0
  current.execution.workoutComplete = true; current.execution.nutritionLogged = true
  const saved = schedule([
    event('work-done', '09:00', 'work', { status: 'completed', checkoff: { completed: true, revision: 1 } }),
    event('check-in', '08:00', 'check_in'), event('water', '10:00', 'hydration'), event('workout', '18:00', 'workout'),
    event('skipped-school', '10:00', 'school', { status: 'skipped' }), event('deferred-work', '11:00', 'work', { status: 'deferred' }),
    event('lunch', '12:00', 'meal'), event('cancelled', '13:00', 'personal', { status: 'cancelled' }),
  ])
  const result = project(current, saved)
  for (const id of ['work-done', 'check-in', 'water', 'cancelled']) assert.equal(ids(result).includes(`event:${id}`), false)
  assert.ok(ids(result).includes('event:workout'), 'daily completion does not confirm a separate saved workout')
  saved.events.find(event => event.id === 'workout').status = 'completed'
  assert.equal(ids(project(current, saved)).includes('event:workout'), false, 'this occurrence disappears when its own saved status confirms completion')
  for (const id of ['skipped-school', 'deferred-work', 'lunch']) assert.ok(ids(result).includes(`event:${id}`))
  assert.equal(ids(result).includes('activity:nutrition'), false)
})

test('recovery logs remove only their uniquely linked block, keeping future blocks visible and ambiguous/unavailable evidence neutral', () => {
  const morning = event('morning-recovery', '08:00', 'recovery'), evening = event('evening-recovery', '18:00', 'recovery')
  const saved = schedule([morning, evening], { now: `${date}T09:00:00Z` })
  const current = logic(); current.execution.recoveryComplete = true
  current.execution.recoveryEvidence = recoveryEvidence([`${date}T08:00:10Z`])
  let result = project(current, saved)
  assert.equal(ids(result).includes('event:morning-recovery'), false); assert.ok(ids(result).includes('event:evening-recovery'))
  saved.now = `${date}T23:00:00Z`; assert.ok(ids(project(current, saved)).includes('event:evening-recovery'))
  current.execution.recoveryEvidence.completedAt.push(`${date}T18:00:10Z`)
  assert.equal(ids(project(current, saved)).includes('event:evening-recovery'), false)
  saved.events.push(event('overlap', '18:00', 'recovery'))
  result = project(current, saved)
  assert.ok(ids(result).includes('event:evening-recovery'), 'an overlapping log cannot complete either block')
  assert.match(items(result).find(item => item.eventId === 'evening-recovery').detail, /completion could not be confirmed/)
  current.execution.recoveryEvidence.unlinkedRecordCount = 1
  result = project(current, saved)
  assert.ok(ids(result).includes('event:morning-recovery'))
  assert.match(items(result).find(item => item.eventId === 'morning-recovery').detail, /completion could not be confirmed/)
  current.execution.recoveryEvidence.available = false
  result = project(current, saved)
  assert.ok(ids(result).includes('event:morning-recovery'))
  assert.match(items(result).find(item => item.eventId === 'evening-recovery').detail, /could not be confirmed/)
})

test('a prior-night sleep report does not complete an upcoming saved sleep occurrence', () => {
  const current = logic({ sleep: { logged: true, hours: 8 } })
  const saved = schedule([event('tonight-sleep', '22:00', 'sleep')])
  assert.ok(ids(project(current, saved)).includes('event:tonight-sleep'))
  saved.events[0].status = 'completed'
  assert.equal(ids(project(current, saved)).includes('event:tonight-sleep'), false)
})

test('identity projection avoids duplicate event/action cards, preserves destinations and respects workout safety', () => {
  const current = logic(), workout = event('workout', '18:00', 'workout')
  const assessment = event('assessment', '12:00', 'assessment', { title: 'Schedule Structure Assessment', source: 'system', action_route: '/dashboard/assessment/daily-structure?assessmentVersion=1' })
  const imported = event('imported-lunch', '12:00', 'meal', { calendar_event_id: 'calendar-meal', source: 'external_calendar', action_route: '/dashboard/schedule' })
  const saved = schedule([workout, { ...workout }, assessment, imported])
  let result = project(current, saved)
  assert.equal(new Set(ids(result)).size, items(result).length)
  assert.equal(items(result).filter(item => item.activityId === 'workout').length, 1)
  assert.equal(items(result).filter(item => item.activityId === 'assessment:assessment').length, 1)
  assert.match(items(result).find(item => item.eventId === 'assessment').href, /eventId=assessment/)
  assert.match(items(result).find(item => item.eventId === 'imported-lunch').href, /\/dashboard\/nutrition/)
  assert.doesNotMatch(items(result).find(item => item.eventId === 'imported-lunch').href, /calendar|schedule/)
  current.symptoms.redFlag = true; current.workoutDecision.canTrain = false
  result = project(current, saved)
  const held = items(result).find(item => item.eventId === 'workout')
  assert.equal(held.href, '/dashboard/recovery'); assert.match(held.detail, /Training is paused/)
})

test('style preference only changes presentation inputs and this projection never mutates saved schedule, evidence or history', () => {
  const current = logic(), saved = schedule([event('future', '19:00', 'personal')])
  const beforeLogic = structuredClone(current), beforeSchedule = structuredClone(saved)
  function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } }
  freeze(current); freeze(saved)
  const section = project(current, saved)
  const step = project(current, { ...saved, preferences: { ...saved.preferences, carouselStyle: 'step' } })
  assert.deepEqual(section, step)
  assert.deepEqual(current, beforeLogic); assert.deepEqual(saved, beforeSchedule)
})
