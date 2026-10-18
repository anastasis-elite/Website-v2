import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const assessment = await importTs('lib/assessment/scheduleStructure.ts')
const validation = await importTs('lib/assessment/validateScheduleStructure.ts')
const timezone = await importTs('lib/timezone.ts')
const scheduleActions = await importTs('lib/schedule/actions.ts')
const commitmentWeekdays = await importTs('lib/assessment/commitmentWeekdays.ts')
const routinePreferences = await importTs('lib/assessment/routinePreferences.ts')
function load(path, mocks, globals = {}) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  runInNewContext(outputText, { module, exports: module.exports, ...globals, require: name => mocks[name] ||
    (name === '@/lib/assessment/commitmentWeekdays' ? commitmentWeekdays
      : name === '@/lib/assessment/routinePreferences' ? routinePreferences : require(name)) })
  return module.exports.default
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
const validProps = { clientId: 'qa-client', eventId: 'qa-structure', assessmentVersion: 1,
  currentExecutionStyle: 'flow', currentCarouselStyle: 'section', wakeTime: '07:00', bedTime: '22:00', workoutDaysAvailable: 0 }
const tick = () => new Promise(resolve => setImmediate(resolve))
function harness(props = validProps) {
  const states = [], refs = [], calls = [], navigation = []
  let stateIndex = 0, refIndex = 0, announced = 0, refreshes = 0
  let send = async () => Response.json({ error: 'Save unavailable.' }, { status: 503 })
  const Component = load('components/DailyStructureAssessment.tsx', {
    react: {
      useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
        return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial } },
    },
    'next/link': () => null,
    'next/navigation': { useRouter: () => ({ push: href => navigation.push(href), refresh: () => refreshes++ }) },
    '@/app/styles/globalstyles': {},
    '@/lib/assessment/scheduleStructure': assessment,
    '@/lib/assessment/validateScheduleStructure': validation,
    '@/lib/calendar/client': { announceCalendarChange: () => announced++ },
  }, { fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return send(url, options) } })
  const render = () => { stateIndex = refIndex = 0; return Component(props) }
  const submit = () => {
    let prevented = false
    const tree = render()
    nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() { prevented = true } })
    assert.equal(prevented, true)
  }
  return { render, submit, calls, navigation, setSend(fn) { send = fn }, get announced() { return announced }, get refreshes() { return refreshes } }
}
function confirmation(body) {
  return Response.json({ success: true, submission: { assessmentVersion: body.assessmentVersion, eventId: body.eventId,
    submittedAt: '2026-10-15T18:00:00Z', answers: body } })
}

const dayGroup = (view, label) => nodes(view.render(), node => node.type === 'fieldset' && node.props['aria-label'] === label)[0]
const dayInputs = (view, label) => nodes(dayGroup(view, label), node => node.type === 'input' && node.props.type === 'checkbox')
const selectedDays = (view, label) => dayInputs(view, label).filter(node => node.props.checked).map(node => node.props.value).sort((left, right) => left - right)
const chooseDay = (view, label, day) => dayInputs(view, label).find(node => node.props.value === day).props.onChange()
const setTime = (view, label, value) => nodes(view.render(), node => node.props?.label === label)[0].props.onChange(value)
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : ''

test('every fixed anchor offers seven accessible days and submits independent weekday, weekend and custom choices', async () => {
  const view = harness({ ...validProps, scheduleTimezone: 'America/Chicago', workStartTime: '09:00', workEndTime: '17:00', workDaysOfWeek: [1,2,3,4,5],
    schoolDropoffTime: '08:00', schoolDropoffDaysOfWeek: [0,6], schoolPickupTime: '15:00', schoolPickupDaysOfWeek: [2,4] })
  for (const label of ['Work days', 'School drop-off days', 'School pickup days']) {
    const inputs = dayInputs(view, label)
    assert.equal(inputs.length, 7)
    assert.deepEqual(inputs.map(input => input.props['aria-label']), ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
    assert.deepEqual(inputs.map(input => input.props.value).sort((left, right) => left - right), [0,1,2,3,4,5,6])
    assert.equal(dayGroup(view, label).props.disabled, false)
  }
  assert.deepEqual(selectedDays(view, 'Work days'), [1,2,3,4,5])
  assert.deepEqual(selectedDays(view, 'School drop-off days'), [0,6], 'school may intentionally occur on weekends')
  assert.deepEqual(selectedDays(view, 'School pickup days'), [2,4])
  assert.match(text(view.render()), /Days and times follow your schedule time zone: America\/Chicago\./)
  view.setSend((_url, options) => confirmation(JSON.parse(options.body)))
  view.submit(); await tick()
  assert.deepEqual(view.calls[0].body.work_days_of_week, [1,2,3,4,5])
  assert.deepEqual(view.calls[0].body.school_dropoff_days_of_week, [0,6])
  assert.deepEqual(view.calls[0].body.school_pickup_days_of_week, [2,4])
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
})

test('blank anchors start with no selected days and newly entered times require an explicit day choice', async () => {
  const view = harness()
  for (const label of ['Work days', 'School drop-off days', 'School pickup days']) {
    assert.deepEqual(selectedDays(view, label), [])
    assert.equal(dayGroup(view, label).props.disabled, true)
  }
  assert.doesNotMatch(text(view.render()), /Existing time anchors without saved days/)
  setTime(view, 'School pickup', '15:00')
  assert.equal(dayGroup(view, 'School pickup days').props.disabled, false)
  assert.deepEqual(selectedDays(view, 'School pickup days'), [])
  view.submit(); await tick()
  assert.equal(view.calls.length, 0)
  assert.match(text(view.render()), /Choose at least one day/)
  chooseDay(view, 'School pickup days', 6)
  chooseDay(view, 'School pickup days', 0)
  view.setSend((_url, options) => confirmation(JSON.parse(options.body)))
  view.submit(); await tick()
  assert.deepEqual(view.calls[0].body.work_days_of_week, [])
  assert.deepEqual(view.calls[0].body.school_dropoff_days_of_week, [])
  assert.deepEqual(view.calls[0].body.school_pickup_days_of_week, [0,6])
})

test('legacy timed anchors show all seven days with an explanation, while an explicit empty choice is never replaced by a default', async () => {
  const legacy = harness({ ...validProps, workStartTime: '09:00', workEndTime: '17:00', schoolDropoffTime: '08:00' })
  assert.deepEqual(selectedDays(legacy, 'Work days'), [0,1,2,3,4,5,6])
  assert.deepEqual(selectedDays(legacy, 'School drop-off days'), [0,1,2,3,4,5,6])
  assert.deepEqual(selectedDays(legacy, 'School pickup days'), [])
  assert.match(text(legacy.render()), /Existing time anchors without saved days repeat every day\. Choose days and Save routine to change future occurrences\./)
  const explicit = harness({ ...validProps, workStartTime: '09:00', workEndTime: '17:00', workDaysOfWeek: [] })
  assert.deepEqual(selectedDays(explicit, 'Work days'), [])
  explicit.submit(); await tick()
  assert.equal(explicit.calls.length, 0)
  assert.match(text(explicit.render()), /Choose at least one day/)
  chooseDay(explicit, 'Work days', 3)
  assert.equal(nodes(explicit.render(), node => node.props?.role === 'alert').length, 0)
})

test('a failed weekday save preserves choices and an intentional routine retry submits the edited days', async () => {
  const view = harness({ ...validProps, mode: 'routine', routineRevision: 4, schoolDropoffTime: '08:00', schoolDropoffDaysOfWeek: [1,3] })
  view.submit(); await tick()
  assert.deepEqual(selectedDays(view, 'School drop-off days'), [1,3])
  assert.match(text(view.render()), /Save unavailable/)
  assert.deepEqual(view.navigation, [])
  chooseDay(view, 'School drop-off days', 6)
  view.setSend((_url, options) => {
    const body = JSON.parse(options.body)
    assert.deepEqual(body.school_dropoff_days_of_week, [1,3,6])
    assert.equal(body.expected_revision, 4)
    return Response.json({ success: true, routine: { revision: 5, savedAt: '2026-10-18T12:00:00Z' } })
  })
  view.submit(); await tick()
  assert.equal(view.calls[1].url, '/api/daily-structure/routine')
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
})

function pageHarness(client) {
  const Assessment = () => null
  const query = { select() { return query }, eq() { return query }, async order() { return { data: [], error: null } } }
  const mocks = {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ client, user: { id: 'qa-owner' }, supabase: { from() { return query } } }) },
    '@/components/DailyStructureAssessment': Assessment, '@/components/ScheduleBlockEditor': () => null,
    '@/lib/assessment/scheduleStructure': assessment, '@/lib/timezone': timezone,
  }
  const props = tree => nodes(tree, node => node.type === Assessment)[0].props
  return { assessmentPage: load('app/dashboard/assessment/daily-structure/page.tsx', mocks),
    routinePage: load('app/dashboard/schedule/settings/routine/page.tsx', mocks), props }
}

test('assessment and routine defaults reopen current saved weekday metadata without weekday-name assumptions', async () => {
  const client = { client_id: 'qa-client', timezone: 'America/Chicago', ...{ wake_time: '07:00', bed_time: '22:00', school_dropoff_time: '08:00' },
    onboarding_data: { routinePreferences: { revision: 4 }, scheduleCommitmentWeekdays: {
      work_days_of_week: [0,6], school_dropoff_days_of_week: [1,3,5], school_pickup_days_of_week: [2,4],
    } } }
  const pages = pageHarness(client)
  const pending = pages.props(await pages.assessmentPage({ searchParams: Promise.resolve({ eventId: 'qa-weekdays' }) }))
  const routine = pages.props(await pages.routinePage())
  for (const props of [pending, routine]) {
    assert.equal(props.scheduleTimezone, 'America/Chicago')
    assert.deepEqual([...props.workDaysOfWeek], [0,6])
    assert.deepEqual([...props.schoolDropoffDaysOfWeek], [1,3,5])
    assert.deepEqual([...props.schoolPickupDaysOfWeek], [2,4])
  }
  assert.equal(routine.mode, 'routine')
  assert.equal(routine.routineRevision, 4)
  assert.equal(pending.routineRevision, 4)
})

test('assessment sends the displayed shared revision and refreshes a conflict before a fresh form can save', async () => {
  const stale = harness({ ...validProps, routineRevision: 4 })
  stale.setSend((_url, options) => {
    assert.equal(JSON.parse(options.body).expected_revision, 4)
    return Response.json({ error: 'Your routine changed on another screen.' }, { status: 409 })
  })
  stale.submit(); await tick()
  assert.equal(stale.calls[0].url, '/api/daily-structure')
  assert.equal(stale.refreshes, 1)
  assert.deepEqual(stale.navigation, [])
  assert.equal(stale.announced, 0)
  assert.match(text(stale.render()), /Your routine changed on another screen/)
  const refreshed = harness({ ...validProps, routineRevision: 5 })
  refreshed.setSend((_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.expected_revision, 5)
    return confirmation(body)
  })
  refreshed.submit(); await tick()
  assert.deepEqual(refreshed.navigation, ['/dashboard/schedule'])
})

test('a refreshed assessment page remounts its pending form when the shared preference revision changes', async () => {
  const client = { client_id: 'qa-client', onboarding_data: { routinePreferences: { revision: 4 } } }
  const pages = pageHarness(client)
  const first = nodes(await pages.assessmentPage({ searchParams: Promise.resolve({ eventId: 'qa-weekdays' }) }),
    node => node.props?.clientId === client.client_id)[0]
  assert.equal(first.props.routineRevision, 4)
  client.onboarding_data.routinePreferences.revision = 5
  const next = nodes(await pages.assessmentPage({ searchParams: Promise.resolve({ eventId: 'qa-weekdays' }) }),
    node => node.props?.clientId === client.client_id)[0]
  assert.equal(next.props.routineRevision, 5)
  assert.notEqual(first.key, next.key, 'React must discard stale local form state after conflict refresh')
  assert.equal(first.props.eventId, next.props.eventId)
  assert.equal(first.props.completedAt, undefined)
  assert.equal(next.props.completedAt, undefined)
})

test('completed assessments reopen their own submitted weekdays instead of newer routine days', async () => {
  const answers = { execution_style: 'flow', carousel_style: 'section', wake_time: '07:00', bed_time: '22:00', workout_days_available: 0,
    work_start_time: '09:00', work_end_time: '17:00', work_days_of_week: [1,2,3,4,5],
    school_dropoff_time: '08:00', school_dropoff_days_of_week: [0,6], school_pickup_days_of_week: [] }
  const client = { client_id: 'qa-client', onboarding_data: {
    scheduleCommitmentWeekdays: { work_days_of_week: [0], school_dropoff_days_of_week: [2], school_pickup_days_of_week: [3] },
    scheduleStructureAssessments: { '1': { 'qa-weekdays': { assessmentVersion: 1, eventId: 'qa-weekdays', submittedAt: '2026-10-18T12:00:00Z', answers } } },
  } }
  const original = JSON.stringify(client)
  const pages = pageHarness(client)
  const props = pages.props(await pages.assessmentPage({ searchParams: Promise.resolve({ eventId: 'qa-weekdays', assessmentVersion: '1' }) }))
  assert.deepEqual([...props.workDaysOfWeek], [1,2,3,4,5])
  assert.deepEqual([...props.schoolDropoffDaysOfWeek], [0,6])
  assert.deepEqual([...props.schoolPickupDaysOfWeek], [])
  const view = harness(props)
  assert.equal(nodes(view.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  assert.deepEqual(selectedDays(view, 'School drop-off days'), [0,6])
  view.submit(); await tick()
  assert.equal(view.calls.length, 0)
  assert.equal(JSON.stringify(client), original)
})

test('completed legacy assessment without submitted weekdays shows its old daily anchors despite newer routine metadata', async () => {
  const answers = { execution_style: 'flow', carousel_style: 'section', wake_time: '07:00', bed_time: '22:00', workout_days_available: 0,
    work_start_time: '09:00', work_end_time: '17:00', school_dropoff_time: '08:00' }
  const client = { client_id: 'qa-client', onboarding_data: {
    scheduleCommitmentWeekdays: { work_days_of_week: [1], school_dropoff_days_of_week: [6] },
    scheduleStructureAssessments: { '1': { 'qa-weekdays': { assessmentVersion: 1, eventId: 'qa-weekdays', submittedAt: '2026-10-18T12:00:00Z', answers } } },
  } }
  const pages = pageHarness(client)
  const props = pages.props(await pages.assessmentPage({ searchParams: Promise.resolve({ eventId: 'qa-weekdays', assessmentVersion: '1' }) }))
  assert.ok(props.completedAt)
  assert.equal(props.workDaysOfWeek, undefined)
  assert.equal(props.schoolDropoffDaysOfWeek, undefined)
  const view = harness(props)
  assert.deepEqual(selectedDays(view, 'Work days'), [0,1,2,3,4,5,6])
  assert.deepEqual(selectedDays(view, 'School drop-off days'), [0,1,2,3,4,5,6])
  assert.equal(nodes(view.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  assert.match(text(view.render()), /Existing time anchors without saved days repeat every day/)
  view.submit(); await tick()
  assert.equal(view.calls.length, 0)
})

test('opening or leaving the form is read-only; incomplete submission explains missing answers without posting', async () => {
  const view = harness({ clientId: 'qa-client' })
  let tree = view.render()
  assert.equal(view.calls.length, 0)
  assert.equal(nodes(tree, n => n.type === 'form')[0].props['aria-label'], 'Schedule Structure Assessment')
  assert.equal(nodes(tree, n => n.type === 'button' && n.props.type === 'submit')[0].props.children, 'Complete Assessment')
  assert.equal(nodes(tree, n => n.type === 'fieldset')[0].props.disabled, false)
  view.submit(); await tick()
  assert.equal(view.calls.length, 0)
  assert.equal(view.navigation.length, 0)
  tree = view.render()
  assert.match(nodes(tree, n => n.props?.role === 'alert')[0].props.children, /Choose how/)
  assert.equal(nodes(tree, n => n.props?.href === '/dashboard').length, 1)
})

test('intentional routine edit stays editable after assessment completion and saves separately before returning to Schedule', async () => {
  const view = harness({ ...validProps, mode: 'routine', routineRevision: 2, completedAt: '2026-10-15T18:00:00Z' })
  assert.equal(nodes(view.render(), n => n.type === 'form')[0].props['aria-label'], 'Edit My Routine')
  assert.equal(nodes(view.render(), n => n.type === 'fieldset')[0].props.disabled, false)
  view.setSend((_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.expected_revision, 2)
    return Response.json({ success: true, routine: { revision: 3, savedAt: '2026-10-16T01:00:00Z', answers: body } })
  })
  view.submit(); await tick()
  assert.equal(view.calls[0].url, '/api/daily-structure/routine')
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
  assert.equal(view.announced, 1)
})

test('submit carries task/version, locks double clicks, and advances only after confirmed persistence', async () => {
  const view = harness()
  let resolve
  view.setSend(() => new Promise(done => { resolve = done }))
  view.submit(); view.submit()
  assert.equal(view.calls.length, 1)
  assert.equal(view.navigation.length, 0)
  assert.equal(view.announced, 0)
  assert.equal(view.calls[0].url, '/api/daily-structure')
  assert.equal(view.calls[0].body.action, 'submit')
  assert.equal(view.calls[0].body.eventId, 'qa-structure')
  assert.equal(view.calls[0].body.assessmentVersion, 1)
  assert.equal(view.calls[0].body.workout_days_available, 0)
  assert.equal(nodes(view.render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled, true)
  assert.equal(nodes(view.render(), n => n.type === 'fieldset')[0].props.disabled, true, 'answers stay fixed while persistence is pending')
  assert.equal(nodes(view.render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.children, 'Completing…')
  resolve(confirmation(view.calls[0].body)); await tick()
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
  assert.equal(view.announced, 1)
  assert.equal(view.refreshes, 1)
  assert.equal(nodes(view.render(), n => n.type === 'button' && n.props.type === 'submit').length, 0)
  assert.equal(nodes(view.render(), n => n.type === 'fieldset')[0].props.disabled, true)
  view.submit(); assert.equal(view.calls.length, 1, 'success stays locked during navigation')
})

test('failed/offline saves and malformed or mismatched confirmations stay retryable without advancing', async () => {
  const view = harness()
  for (const send of [
    async () => { throw new Error('Offline. Try again.') },
    async () => Response.json({ error: 'Write failed.' }, { status: 500 }),
    async () => Response.json({ success: true }),
    async () => Response.json({ success: true, submission: { assessmentVersion: 2, submittedAt: '2026-10-15' } }),
    async () => Response.json({ success: true, submission: { assessmentVersion: 1, eventId: 'wrong-task', submittedAt: '2026-10-15' } }),
    async () => Response.json({ success: true, submission: { assessmentVersion: 1, eventId: 'qa-structure', submittedAt: 'invalid' } }),
  ]) {
    view.setSend(send); view.submit(); await tick()
    assert.equal(view.navigation.length, 0)
    assert.equal(view.announced, 0)
    assert.equal(view.refreshes, 0)
    assert.equal(nodes(view.render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled, false)
    assert.ok(nodes(view.render(), n => n.props?.role === 'alert').length)
  }
  view.setSend((_url, options) => confirmation(JSON.parse(options.body)))
  view.submit(); await tick()
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
  assert.equal(view.calls.length, 7)
})

test('required choices and conditional training inputs become a valid form submission', async () => {
  const view = harness({ clientId: 'qa-client', eventId: 'qa-structure' })
  const choose = title => nodes(view.render(), n => n.props?.title === title)[0].props.onClick()
  const time = (label, value) => nodes(view.render(), n => n.props?.label === label)[0].props.onChange(value)
  const select = (id, value) => nodes(view.render(), n => n.type === 'select' && n.props.id === id)[0].props.onChange({ target: { value } })
  choose('Flexible rhythm'); choose('Morning / Midday / Evening')
  time('Wake time', '07:00'); time('Bed time', '22:00')
  select('workout-days-available', '3')
  view.submit(); await tick()
  assert.equal(view.calls.length, 0)
  select('current-workout-days-per-week', '0')
  select('current-workout-minutes-per-session', '30')
  select('current-training-intensity', 'gentle')
  select('workout-schedule-preference', 'suggested')
  assert.equal(nodes(view.render(), n => n.props?.role === 'alert').length, 0, 'editing clears validation feedback')
  view.setSend((_url, options) => confirmation(JSON.parse(options.body)))
  view.submit(); await tick()
  assert.equal(view.calls.length, 1)
  assert.equal(view.calls[0].body.workout_days_available, 3)
  assert.equal(view.calls[0].body.current_workout_days_per_week, 0)
  assert.deepEqual(view.navigation, ['/dashboard/schedule'])
})

test('assessment page preserves task and requested version without mutating completion on navigation', async () => {
  let reads = 0
  const Assessment = () => null, Commitments = () => null
  const query = { select() { return query }, eq() { return query }, async order() { reads++; return { data: [] } } }
  const Page = load('app/dashboard/assessment/daily-structure/page.tsx', {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ client: { client_id: 'qa-client' }, user: { id: 'owner' }, supabase: { from(table) { assert.equal(table, 'client_schedule_blocks'); return query } } }) },
    '@/components/DailyStructureAssessment': Assessment,
    '@/components/ScheduleBlockEditor': Commitments,
    '@/lib/assessment/scheduleStructure': assessment,
    '@/lib/assessment/validateScheduleStructure': validation,
    '@/lib/timezone': timezone,
  })
  for (const version of ['1', '2']) {
    const tree = await Page({ searchParams: Promise.resolve({ eventId: 'qa-structure', assessmentVersion: version }) })
    const form = nodes(tree, n => n.type === Assessment)[0]
    assert.equal(form.props.eventId, 'qa-structure')
    assert.equal(form.props.assessmentVersion, Number(version), 'stale version must reach API conflict rather than silently submit a new version')
    assert.equal(form.props.completedAt, undefined)
  }
  const tree = await Page({ searchParams: Promise.resolve({}) })
  assert.equal(nodes(tree, n => n.type === Assessment)[0].props.assessmentVersion, 1)
  assert.match(nodes(tree, n => n.type === Assessment)[0].props.eventId, /^schedule-structure:\d{4}-\d{2}$/)
  assert.equal(reads, 3)
})

test('monthly Schedule and legacy standalone links reopen one immutable saved completion across refreshes', async () => {
  const Assessment = () => null
  let localDate = '2026-10-15'
  const submittedAt = '2026-10-15T18:00:00Z'
  const answers = { execution_style: 'hybrid', carousel_style: 'step', wake_time: '06:30', bed_time: '22:30',
    workout_days_available: 0, daily_non_negotiables: ['Caregiving'], day_structure_notes: 'Saved monthly review.' }
  const client = { client_id: 'qa-client', execution_style: 'flow', workout_days_available: 1,
    onboarding_data: { scheduleStructureAssessments: { '1': { 'standalone:2026-10': {
      assessmentVersion: 1, submittedAt, answers,
    } } } } }
  const original = JSON.stringify(client.onboarding_data)
  const query = { select() { return query }, eq() { return query }, async order() { return { data: [] } } }
  const Page = load('app/dashboard/assessment/daily-structure/page.tsx', {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ client, user: { id: 'owner' }, supabase: { from(table) {
      assert.equal(table, 'client_schedule_blocks', 'opening a virtual task does not depend on a saved schedule row')
      return query
    } } }) },
    '@/components/DailyStructureAssessment': Assessment, '@/components/ScheduleBlockEditor': () => null,
    '@/lib/assessment/scheduleStructure': assessment,
    '@/lib/timezone': { ...timezone, getClientLocalDate: () => localDate },
  })

  for (const search of [
    { eventId: 'schedule-structure:2026-10', assessmentVersion: '1' },
    {},
    { eventId: 'schedule-structure:2026-10', assessmentVersion: '1' },
  ]) {
    const tree = await Page({ searchParams: Promise.resolve(search) })
    const form = nodes(tree, n => n.type === Assessment)[0]
    assert.equal(form.props.eventId, 'schedule-structure:2026-10', 'bare assessment URLs share the canonical monthly task identity')
    assert.equal(form.props.completedAt, submittedAt)
    assert.equal(form.props.currentExecutionStyle, 'hybrid')
    assert.equal(form.props.wakeTime, '06:30')
    assert.equal(form.props.dayStructureNotes, 'Saved monthly review.')
    assert.equal(form.props.workoutDaysAvailable, 0)
    const reopened = harness(form.props)
    assert.equal(nodes(reopened.render(), n => n.type === 'fieldset')[0].props.disabled, true)
    assert.equal(nodes(reopened.render(), n => n.type === 'button' && n.props.type === 'submit').length, 0)
    reopened.submit(); await tick()
    assert.equal(reopened.calls.length, 0)
    assert.equal(reopened.announced, 0)
  }
  assert.equal(JSON.stringify(client.onboarding_data), original, 'reading/reopening completion never rewrites its answers or timestamp')

  for (const search of [
    { eventId: 'schedule-structure:2026-11', assessmentVersion: '1' },
    { eventId: 'schedule-structure:2026-10', assessmentVersion: '2' },
  ]) {
    const tree = await Page({ searchParams: Promise.resolve(search) })
    const props = nodes(tree, n => n.type === Assessment)[0].props
    assert.equal(props.completedAt, undefined, 'completion belongs only to its saved monthly task and version')
    assert.equal(props.currentExecutionStyle, 'flow')
    assert.equal(nodes(harness(props).render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.children, 'Complete Assessment')
  }

  localDate = '2026-11-01'
  const nextMonth = await Page({ searchParams: Promise.resolve({}) })
  const nextMonthProps = nodes(nextMonth, n => n.type === Assessment)[0].props
  assert.equal(nextMonthProps.eventId, 'schedule-structure:2026-11')
  assert.equal(nextMonthProps.completedAt, undefined, 'a new month does not inherit a previous month completion')
  const previousMonth = await Page({ searchParams: Promise.resolve({ eventId: 'schedule-structure:2026-10' }) })
  assert.equal(nodes(previousMonth, n => n.type === Assessment)[0].props.completedAt, submittedAt, 'the previous monthly review still reopens as completed')
})


test('reopening saved completion is read-only, restores submitted answers, and cannot submit or reset completion', async () => {
  const Assessment = () => null
  const answers = { execution_style: 'hybrid', carousel_style: 'step', wake_time: '06:30', bed_time: '22:30',
    workout_days_available: 4, current_workout_days_per_week: 2, current_workout_minutes_per_session: 45,
    current_training_intensity: 'moderate', workout_schedule_preference: 'suggested' }
  const client = { client_id: 'qa-client', workout_days_available: 1, current_workout_minutes_per_session: 15,
    onboarding_data: { scheduleStructureAssessments: { '1': { 'qa-structure': {
      assessmentVersion: 1, eventId: 'qa-structure', submittedAt: '2026-10-15T18:00:00Z', answers,
    } } } } }
  const query = { select() { return query }, eq() { return query }, async order() { return { data: [] } } }
  const Page = load('app/dashboard/assessment/daily-structure/page.tsx', {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ client, user: { id: 'owner' }, supabase: { from() { return query } } }) },
    '@/components/DailyStructureAssessment': Assessment, '@/components/ScheduleBlockEditor': () => null,
    '@/lib/assessment/scheduleStructure': assessment, '@/lib/assessment/validateScheduleStructure': validation, '@/lib/timezone': timezone,
  })
  const tree = await Page({ searchParams: Promise.resolve({ eventId: 'qa-structure', assessmentVersion: '1' }) })
  const props = nodes(tree, n => n.type === Assessment)[0].props
  assert.equal(props.workoutDaysAvailable, 4)
  assert.equal(props.currentWorkoutMinutesPerSession, 45)
  assert.equal(props.currentExecutionStyle, 'hybrid')
  assert.equal(props.wakeTime, '06:30')
  assert.equal(props.completedAt, '2026-10-15T18:00:00Z')

  const reopened = harness(props)
  const savedTree = reopened.render()
  assert.equal(nodes(savedTree, n => n.type === 'fieldset')[0].props.disabled, true, 'saved answers cannot be changed')
  assert.equal(nodes(savedTree, n => n.type === 'button' && n.props.type === 'submit').length, 0, 'completed tasks have no completion action')
  assert.equal(nodes(savedTree, n => n.type === 'strong')[0].props.children, 'Assessment completed.')
  assert.equal(nodes(savedTree, n => n.props?.title === 'Hybrid')[0].props.active, true)
  assert.equal(nodes(savedTree, n => n.props?.title === 'One next step at a time')[0].props.active, true)
  assert.equal(nodes(savedTree, n => n.props?.label === 'Wake time')[0].props.value, '06:30')
  assert.equal(nodes(savedTree, n => n.type === 'select' && n.props.id === 'workout-days-available')[0].props.value, '4')
  assert.equal(nodes(savedTree, n => n.type === 'select' && n.props.id === 'current-workout-minutes-per-session')[0].props.value, '45')
  assert.equal(nodes(savedTree, n => n.props?.href === '/dashboard').length, 1)
  assert.equal(nodes(savedTree, n => n.props?.href === '/dashboard/schedule').length, 1)
  reopened.submit(); await tick()
  assert.equal(reopened.calls.length, 0, 'even a programmatic form submission cannot resubmit saved completion')
  assert.equal(reopened.navigation.length, 0)
  assert.equal(reopened.announced, 0, 'viewing saved completion does not announce a new completion')

  const newer = await Page({ searchParams: Promise.resolve({ eventId: 'qa-structure', assessmentVersion: '2' }) })
  assert.equal(nodes(newer, n => n.type === Assessment)[0].props.workoutDaysAvailable, 1, 'a different version cannot restore older-version answers as submitted evidence')
  assert.equal(nodes(newer, n => n.type === Assessment)[0].props.completedAt, undefined)

  for (const invalid of [
    { ...client.onboarding_data.scheduleStructureAssessments['1']['qa-structure'], submittedAt: 'invalid' },
    { ...client.onboarding_data.scheduleStructureAssessments['1']['qa-structure'], eventId: 'another-task' },
    { ...client.onboarding_data.scheduleStructureAssessments['1']['qa-structure'], answers: { execution_style: 'hybrid' } },
  ]) {
    client.onboarding_data.scheduleStructureAssessments['1']['qa-structure'] = invalid
    const invalidTree = await Page({ searchParams: Promise.resolve({ eventId: 'qa-structure', assessmentVersion: '1' }) })
    const invalidProps = nodes(invalidTree, n => n.type === Assessment)[0].props
    assert.equal(invalidProps.completedAt, undefined, 'invalid saved evidence cannot disable assessment completion')
    assert.equal(invalidProps.workoutDaysAvailable, 1)
  }
})

test('completed Schedule Structure assessments retain Done and provide a read-only review link for their task and version', () => {
  const calls = [], refreshes = []
  const Actions = load('components/ScheduleEventActions.tsx', {
    react: {
      useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
      useRef(initial) { return { current: initial } },
      useEffect() {},
    },
    'next/link': () => null,
    'next/navigation': { useRouter: () => ({ refresh() { refreshes.push(true) } }) },
    '@/lib/schedule/engine': { getActionRouteForEvent() { throw new Error('Completed activities must not resolve a new activity action.') } },
    '@/lib/schedule/actions': scheduleActions,
    '@/lib/schedule/time': {},
    '@/lib/timezone': timezone,
    '@/lib/calendar/client': { announceCalendarChange() { throw new Error('Review navigation must not announce a new completion.') } },
    '@/lib/assessment/scheduleStructure': assessment,
  }, { fetch: async (...args) => { calls.push(args); throw new Error('Review navigation must not save completion.') } })
  const base = { id: 'qa-structure', source: 'system', event_type: 'assessment', title: 'Schedule Structure Assessment',
    status: 'completed', start_at: '2026-10-15T12:00:00Z', end_at: '2026-10-15T12:15:00Z',
    flexibility_type: 'flexible', movable: true, virtual: false }
  const render = overrides => Actions({ event: { ...base, ...overrides }, timezone: 'America/Chicago' })

  for (const task of [
    { id: 'schedule-structure:2026-10', virtual: true, action_route: '/dashboard/assessment/daily-structure?assessmentVersion=1', version: '1' },
    { id: 'qa-version-two', action_route: '/dashboard/assessment/daily-structure?assessmentVersion=2', version: '2' },
    { id: 'qa-legacy-review', title: 'Daily Structure Review', version: '1' },
  ]) {
    const tree = render(task)
    assert.equal(nodes(tree, n => n.type === 'span')[0].props.children, 'Done')
    const review = nodes(tree, n => n.props?.children === 'Review assessment')[0]
    assert.ok(review, 'completed recognized assessments remain reopenable from Schedule')
    const href = new URL(review.props.href, 'https://anastasis.test')
    assert.equal(href.pathname, '/dashboard/assessment/daily-structure')
    assert.equal(href.searchParams.get('eventId'), task.id)
    assert.equal(href.searchParams.get('assessmentVersion'), task.version)
    assert.equal(review.props.onClick, undefined, 'review is navigation with no completion handler')
    assert.equal(nodes(tree, n => n.type === 'button').length, 0, 'completed assessment has no mutation controls')
  }

  for (const overrides of [
    { event_type: 'workout', title: 'Workout' },
    { event_type: 'assessment', title: 'Another assessment' },
    { event_type: 'assessment', source: 'external_calendar' },
    { status: 'skipped' },
    { status: 'cancelled' },
  ]) {
    assert.equal(nodes(render(overrides), n => n.props?.children === 'Review assessment').length, 0, 'unrelated completed or unfinished assessments keep their existing behavior')
  }
  assert.equal(calls.length, 0)
  assert.equal(refreshes.length, 0)
})
