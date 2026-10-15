import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/dashboard/getDashboardContext': 'export const getDashboardContext = async () => globalThis.structureMutationContext',
  '@/lib/mobile/auth': 'export const createMobileRequestContext = async () => globalThis.structureMutationContext',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.structureMutationInvalidations++ }',
  '@/lib/schedule/service': 'export const getDailyScheduleState = async () => ({ events: [], unavailableSources: [], preferences: { transitionMinutes: 10 } })',
}
const webPatch = await importTs('app/api/schedule/[id]/route.ts', mocks)
const webDefer = await importTs('app/api/schedule/[id]/defer/route.ts', mocks)
const mobileDefer = await importTs('app/api/mobile/schedule/[id]/defer/route.ts', mocks)
const owner = 'qa-assessment-owner', clientId = 'QA-STRUCTURE-MUTATIONS'
const answers = { execution_style: 'flow', carousel_style: 'section', wake_time: '07:00', bed_time: '22:00', workout_days_available: 0 }
const event = { id: 'qa-structure', client_id: clientId, user_id: owner,
  event_type: 'assessment', title: 'Schedule Structure Assessment', source: 'anastasis',
  status: 'scheduled', flexibility_type: 'flexible', movable: true, approval_required: false,
  start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T14:15:00Z' }
const submission = { assessmentVersion: 1, eventId: event.id, submittedAt: '2026-10-12T14:10:00Z', answers }
const params = { params: Promise.resolve({ id: event.id }) }
const request = body => new Request('https://disposable.test', { method: 'POST', body: JSON.stringify(body) })
function setup({ submitted = true, eventClientId = clientId } = {}) {
  const row = { ...event, client_id: eventClientId }, writes = []
  const client = { client_id: clientId, timezone: 'America/Chicago', onboarding_data: submitted
    ? { scheduleStructureAssessments: { '1': { [event.id]: structuredClone(submission) } } } : {} }
  const db = { from(table) {
    assert.equal(table, 'anastasis_schedule_events')
    const filters = []; let mutation
    const result = () => {
      if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null }
      if (mutation) { writes.push(mutation); Object.assign(row, mutation) }
      return { data: structuredClone(row), error: null }
    }
    const query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query },
      update(value) { mutation = value; return query }, maybeSingle: async () => result(), single: async () => result() }
    return query
  } }
  globalThis.structureMutationContext = { supabase: db, user: { id: owner }, client }
  globalThis.structureMutationInvalidations = 0
  return { row, writes }
}
const futureWindow = () => {
  const start = new Date(Date.now() + 24 * 60 * 60000)
  return { start_at: start.toISOString(), end_at: new Date(start.getTime() + 15 * 60000).toISOString() }
}

test('saved submission prevents stale web skip, cancel, reopen and relabel mutations even while raw status is scheduled', async () => {
  for (const body of [{ status: 'skipped' }, { status: 'cancelled' }, { status: 'scheduled' }, { title: 'Another assessment' }]) {
    const state = setup()
    const response = await webPatch.PATCH(request(body), params)
    assert.equal(response.status, 409)
    assert.equal(state.row.status, 'scheduled', 'canonical proof is authoritative without an independent task-row update')
    assert.equal(state.writes.length, 0)
    assert.equal(globalThis.structureMutationInvalidations, 0)
  }
})

test('saved submission prevents stale web and mobile defer actions', async () => {
  for (const route of [webDefer, mobileDefer]) {
    const state = setup()
    assert.equal((await route.POST(request(futureWindow()), params)).status, 409)
    assert.equal(state.writes.length, 0)
    assert.equal(globalThis.structureMutationInvalidations, 0)
  }
})

test('assessment mutation lookups require both the owner and the current member client', async () => {
  for (const route of [webPatch, webDefer, mobileDefer]) {
    const state = setup({ submitted: false, eventClientId: 'QA-DIFFERENT-CLIENT' })
    const response = route.PATCH ? await route.PATCH(request({ status: 'skipped' }), params) : await route.POST(request(futureWindow()), params)
    assert.equal(response.status, 404)
    assert.equal(state.writes.length, 0)
  }
})

test('unsubmitted flexible assessments retain existing skip and defer choices', async () => {
  let state = setup({ submitted: false })
  assert.equal((await webPatch.PATCH(request({ status: 'skipped' }), params)).status, 200)
  assert.equal(state.writes[0].status, 'skipped')
  for (const route of [webDefer, mobileDefer]) {
    state = setup({ submitted: false })
    assert.equal((await route.POST(request(futureWindow()), params)).status, 200)
    assert.equal(state.writes[0].status, 'scheduled')
    assert.ok(state.writes[0].adjusted_start_at)
  }
})
