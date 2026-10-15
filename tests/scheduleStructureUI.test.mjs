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
function load(path, mocks, globals = {}) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  runInNewContext(outputText, { module, exports: module.exports, ...globals, require: name => mocks[name] || require(name) })
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
  assert.deepEqual(view.navigation, ['/dashboard'])
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
  assert.deepEqual(view.navigation, ['/dashboard'])
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
  assert.deepEqual(view.navigation, ['/dashboard'])
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
    '@/lib/timezone': { getClientLocalDate: () => localDate },
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
    '@/lib/schedule/actions': { healthEventTypes: new Set(['assessment', 'workout', 'meal']) },
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
